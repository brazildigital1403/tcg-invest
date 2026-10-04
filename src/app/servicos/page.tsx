'use client'

/**
 * /servicos -- "Meus servicos": os pedidos de restauracao e pre-grading.
 *
 * Ate 04/10/2026 esses pedidos eram um bloco solto no topo de /compras, fora
 * das abas e dos contadores. Um pedido de servico e outra coisa (a carta e do
 * proprio cliente, sai e volta, tem orcamento, proposta e dois pagamentos),
 * entao ganhou tela propria. A URL de cada pedido NAO mudou: /servico/[id],
 * que e para onde o sino e os e-mails apontam.
 *
 * ★ O PROXIMO PASSO DEPENDE DO PAGAMENTO, NAO SO DO STATUS. "aceito" cobre
 * tres situacoes (pagamento em aberto, ja pago, sem cobranca registrada), e
 * "recebida" ainda pode ter sinal em aberto -- que o `turnoServico` marca como
 * vez da Bynx. Por isso a lista le `servico_pagamentos` e o evento
 * `cobranca_servico` e usa o MESMO `etapaCobravel` do GET do pedido e do
 * checkout (src/lib/servicos.ts). "Sua vez" = existe acao do cliente agora
 * (o mesmo calculo do CTA); sem o pagamento uma cobranca ficaria escondida em
 * "Em andamento".
 *
 * Le direto do Supabase: a RLS de servico_solicitacoes, servico_pagamentos e
 * servico_eventos libera SELECT so ao dono. Client-side e logada, como /compras.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { IconArrowRight, IconShield, IconRestauro } from '@/components/ui/Icons'
import {
  STATUS_SERVICO, SERVICOS, numeroServico, turnoServico, etapaCobravel, brl, fmtDataHoraBRT,
  type LinhaPagamento,
} from '@/lib/servicos'

type Pedido = {
  id: string; numero: number; servico: string; status: string; created_at: string
  proposta_aceita_em: string | null; rastreio_ida: string | null
}

type Linha = {
  p: Pedido
  /** Vai na secao "Sua vez". */
  vez: boolean
  fim: boolean
  cta: string
  devida: LinhaPagamento | null
}

/**
 * O CTA do card, por status E por pagamento (tabela G da arquitetura).
 * ★ "Sua vez" = existe uma acao do cliente AGORA, e sai do MESMO calculo do
 * CTA -- nao do `turnoServico` puro. O turno diz 'cliente' para toda a
 * 'proposta' e todo o 'aceito', mas proposta ja aceita (servico sem cobranca
 * ou ja pago) e aceito ja pago com rastreio informado nao tem nada a fazer.
 */
function proximoPasso(p: Pedido, linhas: LinhaPagamento[], cobrancaEnviada: boolean): Linha {
  const aceita = !!p.proposta_aceita_em
  const { devida } = etapaCobravel(p.status, aceita, linhas, cobrancaEnviada)
  let cta = 'Ver o pedido'
  let acao = false
  if (p.status === 'orcado') { cta = 'Aprovar orçamento'; acao = true }
  else if (p.status === 'aceito') {
    const temCobranca = linhas.some(l => l.etapa === 'integral' || l.etapa === 'sinal')
    if (devida) { cta = 'Pagar para liberar o endereço'; acao = true }
    else if (p.rastreio_ida) cta = 'Ver o envio'
    else { cta = temCobranca ? 'Enviar a carta' : 'Ver como enviar'; acao = true }
  } else if (p.status === 'proposta') {
    if (!aceita) { cta = 'Decidir a proposta'; acao = true }
    else if (devida) { cta = 'Pagar o serviço'; acao = true }
  } else if (devida) { cta = 'Pagar'; acao = true }
  return { p, vez: acao, fim: turnoServico(p.status) === 'fim', cta, devida }
}

export default function ServicosPage() {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semLogin, setSemLogin] = useState(false)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setSemLogin(true); setCarregando(false); return }

    const { data: sols, error } = await supabase
      .from('servico_solicitacoes')
      .select('id, numero, servico, status, created_at, proposta_aceita_em, rastreio_ida')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    // Falha de leitura nao pode virar "voce nao tem pedidos".
    if (error) { setErro(true); setCarregando(false); return }
    const pedidos = (sols || []) as Pedido[]

    const ids = pedidos.map(p => p.id)
    const pagPor = new Map<string, LinhaPagamento[]>()
    const cobradas = new Set<string>()
    if (ids.length) {
      const [{ data: pags, error: e1 }, { data: evs, error: e2 }] = await Promise.all([
        supabase.from('servico_pagamentos')
          .select('id, solicitacao_id, etapa, valor_cents, metodo, pago_em')
          .in('solicitacao_id', ids),
        supabase.from('servico_eventos')
          .select('solicitacao_id')
          .in('solicitacao_id', ids)
          .eq('status', 'cobranca_servico'),
      ])
      // Sem os pagamentos o CTA mentiria ("Enviar a carta" com sinal em aberto).
      if (e1 || e2) { setErro(true); setCarregando(false); return }
      for (const pg of (pags || []) as (LinhaPagamento & { solicitacao_id: string })[]) {
        const l = pagPor.get(pg.solicitacao_id) || []
        l.push(pg)
        pagPor.set(pg.solicitacao_id, l)
      }
      for (const ev of evs || []) cobradas.add(ev.solicitacao_id as string)
    }

    setLinhas(pedidos.map(p => proximoPasso(p, pagPor.get(p.id) || [], cobradas.has(p.id))))
    setErro(false)
    setCarregando(false)
  }, [])

  // Todo setState de carregar() acontece depois do primeiro await; o lint nao enxerga isso.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  if (carregando) return <Casca><p className="sv-muted sv-centro">Carregando…</p></Casca>

  if (semLogin) {
    return (
      <Casca>
        <div className="sv-msg">
          <IconShield size={26} color="var(--ac-1)" />
          <h2>Entre para ver seus serviços</h2>
          <p className="sv-muted">Você precisa estar logado com a conta que fez o pedido.</p>
        </div>
      </Casca>
    )
  }

  const cabecalho = (stat?: string) => (
    <PageHeader
      trilha={[INICIO, { name: 'Meus serviços', href: '/servicos' }]}
      titulo="Meus serviços"
      descricao="Seus pedidos de restauração e pré-grading, do orçamento à devolução."
      stat={stat}
    />
  )

  if (erro) {
    return (
      <Casca>
        {cabecalho()}
        <div className="sv-msg">
          <p className="sv-muted">Não conseguimos carregar seus pedidos agora.</p>
          <button type="button" className="sv-bt" onClick={() => { setCarregando(true); carregar() }}>Tentar de novo</button>
        </div>
      </Casca>
    )
  }

  if (linhas.length === 0) {
    return (
      <Casca>
        {cabecalho()}
        <div className="sv-vazio">
          <span className="sv-vazio-ic"><IconRestauro size={30} color="var(--bx-text-3)" /></span>
          <h2>Você ainda não pediu nenhum serviço</h2>
          <p className="sv-muted">Quando você pedir uma restauração ou um pré-grading, o pedido aparece aqui para você acompanhar do orçamento até a carta voltar.</p>
          <div className="sv-vazio-acoes">
            <Link className="sv-bt sv-bt-pri" href="/restauracao-de-cartas">Restauração de cartas</Link>
            <Link className="sv-bt" href="/pre-grading">Pré-grading</Link>
          </div>
        </div>
      </Casca>
    )
  }

  const suaVez = linhas.filter(l => l.vez)
  const andamento = linhas.filter(l => !l.vez && !l.fim)
  const encerrados = linhas.filter(l => !l.vez && l.fim)
  const stat = `${linhas.length} ${linhas.length === 1 ? 'pedido' : 'pedidos'}`
    + (suaVez.length ? ` · ${suaVez.length} esperando por você` : '')

  return (
    <Casca>
      {cabecalho(stat)}
      <Secao titulo="Sua vez" itens={suaVez} />
      <Secao titulo="Em andamento" itens={andamento} />
      <Secao titulo="Encerrados" itens={encerrados} />
    </Casca>
  )
}

function Secao({ titulo, itens }: { titulo: string; itens: Linha[] }) {
  if (!itens.length) return null
  return (
    <section className="sv-secao" aria-label={titulo}>
      <h2 className="sv-secao-t">{titulo} <span>{itens.length}</span></h2>
      {itens.map(l => <Card key={l.p.id} l={l} />)}
    </section>
  )
}

function Card({ l }: { l: Linha }) {
  const { p, vez, fim, cta, devida } = l
  const nome = SERVICOS.find(x => x.id === p.servico)?.nome || 'Serviço'
  const apagado = fim && p.status !== 'entregue'
  return (
    <Link href={`/servico/${p.id}`} className={`sv-card${vez ? ' sv-card-vez' : ''}${apagado ? ' sv-card-fim' : ''}`}>
      <div className="sv-card-mid">
        <div className="sv-card-nm">{nome} <span className="sv-nowrap">{numeroServico(p.numero)}</span></div>
        <div className="sv-card-meta">
          <span className={`sv-pill${fim ? ' sv-pill-fim' : ''}`}>{STATUS_SERVICO[p.status] || p.status}</span>
          <span>Pedido em {fmtDataHoraBRT.format(new Date(p.created_at))}</span>
        </div>
        {devida && <div className="sv-card-devida">R$ {brl(devida.valor_cents / 100)} em aberto</div>}
      </div>
      <span className={`sv-cta${vez ? ' sv-cta-pri' : ''}`}>
        {cta}<IconArrowRight size={14} />
      </span>
    </Link>
  )
}

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <AppLayout>
      <style>{CSS}</style>
      <div className="sv-wrap">{children}</div>
    </AppLayout>
  )
}

const CSS = `
.sv-wrap{max-width:720px;margin:0 auto;padding:4px 0 40px;color:var(--bx-text)}
.sv-muted{font-size:14px;line-height:1.55;color:var(--bx-text-2);margin:0}
.sv-centro{text-align:center;padding:40px 0}
.sv-msg{max-width:460px;margin:10px auto 0;display:grid;justify-items:center;gap:10px;text-align:center;padding:28px 20px;border-radius:16px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.sv-msg h2{font-size:17px;font-weight:800;margin:0}
.sv-secao{margin-bottom:22px}
.sv-secao-t{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);margin:0 0 10px}
.sv-secao-t span{font-variant-numeric:tabular-nums;letter-spacing:0}
.sv-card{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px;min-height:44px;padding:15px;margin-bottom:10px;border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface);color:inherit;text-decoration:none;transition:transform .15s ease,background .15s ease,border-color .15s ease}
.sv-card:hover{transform:translateY(-2px);background:var(--bx-surface-2);border-color:var(--bx-border-2)}
.sv-card:focus-visible{outline:2px solid var(--ac-1);outline-offset:2px}
.sv-card-vez{border-color:rgba(var(--ac-1-rgb),.4)}
.sv-card-fim{opacity:.75}
.sv-card-mid{flex:1 1 220px;min-width:0;display:grid;gap:6px}
.sv-card-nm{font-size:15px;font-weight:700;line-height:1.3}
.sv-nowrap{white-space:nowrap}
.sv-card-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:12.5px;color:var(--bx-text-3)}
.sv-card-devida{font-size:13px;font-weight:700;color:var(--ac-1);font-variant-numeric:tabular-nums}
.sv-pill{font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:999px;color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12);white-space:nowrap}
.sv-pill-fim{color:var(--bx-text-3);background:var(--bx-surface-2)}
.sv-cta{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:700;white-space:nowrap;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text-2)}
.sv-cta-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sv-bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 18px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;text-decoration:none;transition:transform .15s ease}
.sv-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sv-bt:hover{transform:translateY(-2px)}
.sv-vazio{display:grid;justify-items:center;gap:10px;text-align:center;padding:36px 20px;border-radius:16px;border:1px dashed var(--bx-border-2)}
.sv-vazio h2{font-size:16px;font-weight:700;margin:0}
.sv-vazio .sv-muted{max-width:380px}
.sv-vazio-ic{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:var(--bx-surface)}
.sv-vazio-acoes{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:6px}
@media (max-width:480px){
  .sv-cta{flex:1 1 100%;justify-content:center;min-height:44px}
  .sv-vazio-acoes{width:100%}
  .sv-vazio-acoes .sv-bt{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){
  .sv-card,.sv-bt{transition:none}
  .sv-card:hover,.sv-bt:hover{transform:none}
}
`
