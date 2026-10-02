'use client'

// Pagina do cliente: acompanhar um pedido de restauracao / pre-grading.
//
// O que a pessoa faz aqui depende do status:
//   orcado   -> ve o orcamento (com o motivo de cada carta recusada), le o
//               termo e aprova, ou recusa
//   aceito   -> ve o endereco e o guia de embalagem e informa o rastreio
//   depois   -> acompanha: custodia, fotos de entrada e saida, laudo, rastreio
// A leitura vem de GET /api/servicos/[id] (so o dono); as acoes usam as rotas
// /aceitar e /rastreio, que conferem dono e status no servidor.

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { authFetch } from '@/lib/authFetch'
import {
  STATUS_SERVICO, SERVICOS, termoDoServico, GUIA_EMBALAGEM, CAMPOS_LAUDO, brl, numeroServico, fmtDataHoraBRT, turnoServico,
  PILARES, ESCALA, DANOS, TERMO_PROPOSTA_V1, RISCOS, OBJETIVOS, ALERTA_GRADUACAO, SERVICOS_CARTAO_ATIVO, type FichaCondicao,
} from '@/lib/servicos'
import { IconCheck, IconClose, IconTruck, IconShield, IconWarning, IconBox, IconWallet } from '@/components/ui/Icons'
import GaleriaMidias from '@/components/servicos/GaleriaMidias'
import Rastreio from '@/components/servicos/Rastreio'

type Sol = {
  id: string; numero: number; servico: string; prazo: string; status: string
  valor_declarado_cents: number; orcamento_cents: number | null; seguro_cents: number | null
  frete_volta_cents: number | null; total_cents: number | null; orcamento_obs: string | null
  pago_em: string | null; termo_aceito_em: string | null; rastreio_ida: string | null; rastreio_volta: string | null; created_at: string
  objetivo: string | null; objetivo_outro: string | null; graduadora_alvo: string | null
  proposta_enviada_em: string | null; proposta_aceita_em: string | null
}
type Item = {
  id: string; nome: string; card_id: string | null; queixas: string[]; valor_declarado_cents: number
  custodia: string | null; aceito: boolean | null; recusa_motivo: string | null; laudo: Record<string, string> | null
  ficha_entrada: FichaCondicao | null; ficha_saida: FichaCondicao | null
}
type Proc = {
  id: string; item_id: string; ordem: number; problema: string; procedimento: string; objetivo: string | null
  resultado_esperado: string | null; risco: string; risco_descricao: string | null; alternativa: string; decisao: string
}
type Evento = { id: string; status: string; nota: string | null; created_at: string }
type Midia = { id: string; item_id: string | null; tipo: string; posicao: string | null; mime: string; url: string | null }
type Pag = { etapa: 'sinal' | 'servico' | 'integral'; valor_cents: number; pago_em: string | null; reembolsado_cents?: number | null; reembolsado_em?: string | null }
type Dados = {
  solicitacao: Sol; itens: Item[]; eventos: Evento[]; midias: Midia[]; procedimentos: Proc[]; endereco: string | null
  pagamentos: Pag[]; devida: { etapa: Pag['etapa']; valor_cents: number } | null; pix: { chave: string; nome: string | null } | null
  recalculando: boolean
}
const ETAPA_PAG: Record<string, { t: string; d: string }> = {
  sinal: { t: 'Sinal', d: 'Frete de volta e valor declarado nos Correios, pago no aceite. Libera o endereço de envio.' },
  servico: { t: 'Serviço', d: 'Pago quando você aprova a proposta. Libera a bancada.' },
  integral: { t: 'Pagamento', d: 'Pago no aceite. Libera o endereço de envio.' },
}

// Linha de etapas: onde o pedido esta, em linguagem do cliente.
const ETAPAS = [
  { t: 'Orçamento', status: ['aguardando_orcamento', 'orcado'] },
  { t: 'Envio', status: ['aceito'] },
  { t: 'Proposta', status: ['recebida', 'proposta'] },
  { t: 'Na bancada', status: ['em_bancada', 'descansando'] },
  { t: 'Pronta', status: ['pronta'] },
  { t: 'A caminho', status: ['enviada'] },
  { t: 'Entregue', status: ['entregue'] },
]
const ROTULO_MIDIA: Record<string, string> = {
  cliente_frente: 'Sua foto · frente', cliente_verso: 'Sua foto · verso', cliente_extra: 'Sua foto',
  entrada_difusa: 'Entrada', entrada_rasante: 'Entrada · rasante', saida_difusa: 'Saída', saida_rasante: 'Saída · rasante',
  entrada_canto: 'Canto na chegada', entrada_borda: 'Borda na chegada', entrada_angulo: 'Superfície na chegada', entrada_dano: 'Dano registrado',
  saida_canto: 'Canto na saída', saida_borda: 'Borda na saída', processo: 'Durante o processo',
  video_abertura: 'Abertura do pacote', video_devolucao: 'Devolução', embalagem: 'Embalagem', laudo: 'Laudo',
}
const reais = (c: number | null | undefined) => (c == null ? '—' : `R$ ${brl(c / 100)}`)

export default function ServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AppLayout>
      <Pedido id={id} />
    </AppLayout>
  )
}

function Pedido({ id }: { id: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [termo, setTermo] = useState(false)
  const [rastreio, setRastreio] = useState('')
  const [decisoes, setDecisoes] = useState<Record<string, 'aprovado' | 'recusado'>>({})
  const [termoProposta, setTermoProposta] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const r = await authFetch(`/api/servicos/${id}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(r.status === 401 ? 'Entre na sua conta para ver este pedido.' : d.error || 'Não conseguimos abrir o pedido.'); return }
      setErro('')
      setDados(d)
    } catch { setErro('Sem conexão. Tente de novo em instantes.') }
  }, [id])
  useEffect(() => { carregar() }, [carregar])

  // Volta do Checkout da Stripe (?pagamento=ok|cancelado). Quem confirma e o
  // webhook, entao no "ok" a pagina rele algumas vezes ate a etapa aparecer paga.
  useEffect(() => {
    if (!SERVICOS_CARTAO_ATIVO) return
    const url = new URL(window.location.href)
    const retorno = url.searchParams.get('pagamento')
    if (retorno !== 'ok' && retorno !== 'cancelado') return
    url.searchParams.delete('pagamento')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    if (retorno === 'cancelado') {
      setMsg({ ok: false, t: 'Pagamento com cartão cancelado. Nada foi cobrado. Você pode tentar de novo ou pagar com Pix.' })
      return
    }
    setMsg({ ok: true, t: 'Recebemos o seu pagamento. A confirmação aparece aqui em instantes.' })
    let vezes = 0
    const t = window.setInterval(() => { vezes += 1; carregar(); if (vezes >= 5) window.clearInterval(t) }, 3000)
    return () => window.clearInterval(t)
  }, [carregar])

  async function pagarCartao() {
    setOcupado(true); setMsg(null)
    try {
      const r = await authFetch(`/api/servicos/${id}/checkout`, { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) { setMsg({ ok: false, t: d.error || 'Não foi possível abrir o pagamento com cartão. Tente de novo.' }); setOcupado(false); return }
      window.location.href = d.url
    } catch { setMsg({ ok: false, t: 'Sem conexão. Tente de novo.' }); setOcupado(false) }
  }

  async function postar(rota: string, body: object, ok: string) {
    setOcupado(true); setMsg(null)
    try {
      const r = await authFetch(`/api/servicos/${id}/${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, t: d.error || 'Não deu certo. Tente de novo.' }); return }
      setMsg({ ok: true, t: ok })
      await carregar()
    } catch { setMsg({ ok: false, t: 'Sem conexão. Tente de novo.' }) }
    finally { setOcupado(false) }
  }

  if (erro) return <div className="sp"><style>{CSS}</style><div className="sp-card sp-vazio"><IconShield size={24} /><p>{erro}</p><Link className="sp-bt" href="/compras">Minhas compras</Link></div></div>
  if (!dados) return <div className="sp"><style>{CSS}</style><p className="sp-muted">Carregando...</p></div>

  const { solicitacao: s, itens, eventos, midias, procedimentos, endereco, pagamentos, devida, pix, recalculando } = dados
  const pendentes = procedimentos.filter(p => p.decisao === 'pendente')
  const tudoDecidido = pendentes.every(p => decisoes[p.id])
  const objetivoRotulo = OBJETIVOS.find(o => o.id === s.objetivo)?.rotulo
  const etapaAtual = ETAPAS.findIndex(e => e.status.includes(s.status))
  const encerrado = turnoServico(s.status) === 'fim' && s.status !== 'entregue'
  const aceitas = itens.filter(i => i.aceito !== false)

  return (
    <div className="sp">
      <style>{CSS}</style>
      <PageHeader
        trilha={[INICIO, { name: 'Compras', href: '/compras' }, { name: numeroServico(s.numero), href: `/servico/${s.id}` }]}
        titulo={`${SERVICOS.find(x => x.id === s.servico)?.nome || 'Serviço'} ${numeroServico(s.numero)}`}
        selo={<span className={`sp-pill${encerrado ? ' sp-pill-fim' : ''}`}>{STATUS_SERVICO[s.status] || s.status}</span>}
        descricao={`Pedido feito em ${fmtDataHoraBRT.format(new Date(s.created_at))}. ${itens.length} ${itens.length === 1 ? 'carta' : 'cartas'}.`}
      />

      {!encerrado && (
        <ol className="sp-etapas" aria-label="Andamento do pedido">
          {ETAPAS.map((e, i) => {
            // Entregue e o fim da jornada: a ultima etapa fica verde (concluida), nao laranja (em andamento).
            const feito = i < etapaAtual || (s.status === 'entregue' && i === etapaAtual)
            return (
              <li key={e.t} className={feito ? `feito${i === etapaAtual ? ' fim' : ''}` : i === etapaAtual ? 'agora' : ''}>
                <span>{feito ? <IconCheck size={12} strokeWidth={2.6} /> : i + 1}</span>{e.t}
              </li>
            )
          })}
        </ol>
      )}

      {objetivoRotulo && (
        <p className="sp-objetivo">Objetivo: <b>{s.objetivo === 'outro' ? s.objetivo_outro : objetivoRotulo}</b>{s.objetivo === 'graduacao' && s.graduadora_alvo && s.graduadora_alvo !== 'indefinida' ? ` · ${s.graduadora_alvo}` : ''}</p>
      )}
      {msg && <p className={msg.ok ? 'sp-ok' : 'sp-erro'} role="status">{msg.t}</p>}

      <div className="sp-grid">
        <div className="sp-col">

          {s.status === 'proposta' && !s.proposta_aceita_em && pendentes.length > 0 && (
            <section className="sp-card sp-card-acao">
              <h2>Proposta de tratamento</h2>
              <p className="sp-muted">Sua carta chegou e foi registrada com fotos de cada canto e borda. Para cada procedimento abaixo, você decide: fazer ou não fazer. Nada começa sem a sua resposta.</p>
              {s.objetivo === 'graduacao' && <p className="sp-aviso"><IconWarning size={15} /> {ALERTA_GRADUACAO}</p>}
              {itens.filter(it => pendentes.some(p => p.item_id === it.id)).map(it => (
                <div key={it.id} className="sp-prop-carta">
                  <b>{it.nome}{it.custodia ? ` · ${it.custodia}` : ''}</b>
                  {pendentes.filter(p => p.item_id === it.id).map(p => {
                    const d = decisoes[p.id]
                    return (
                      <div key={p.id} className="sp-proc">
                        <div className="sp-proc-topo">
                          <b>{p.procedimento}</b>
                          <span className={`sp-risco sp-risco-${p.risco}`}>{RISCOS.find(r => r.id === p.risco)?.rotulo}</span>
                        </div>
                        <dl className="sp-dl sp-proc-dl">
                          <div><dt>Encontramos</dt><dd>{p.problema}</dd></div>
                          {p.objetivo && <div><dt>Objetivo</dt><dd>{p.objetivo}</dd></div>}
                          {p.resultado_esperado && <div><dt>Resultado esperado</dt><dd>{p.resultado_esperado}</dd></div>}
                          {p.risco_descricao && <div><dt>O que pode acontecer</dt><dd>{p.risco_descricao}</dd></div>}
                          <div><dt>Alternativa</dt><dd>{p.alternativa}</dd></div>
                        </dl>
                        <div className="sp-decide" role="radiogroup" aria-label={`Decisão sobre ${p.procedimento}`}>
                          <button type="button" role="radio" aria-checked={d === 'aprovado'} className={d === 'aprovado' ? 'on' : ''} onClick={() => setDecisoes(x => ({ ...x, [p.id]: 'aprovado' }))}><IconCheck size={14} /> Fazer</button>
                          <button type="button" role="radio" aria-checked={d === 'recusado'} className={d === 'recusado' ? 'on off' : ''} onClick={() => setDecisoes(x => ({ ...x, [p.id]: 'recusado' }))}><IconClose size={14} /> Não fazer</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="sp-termo">
                <b>Termo da proposta</b>
                <ul>{TERMO_PROPOSTA_V1.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
              <label className="sp-chk">
                <input type="checkbox" checked={termoProposta} onChange={e => setTermoProposta(e.target.checked)} />
                <span>Li o termo e autorizo somente os procedimentos que marquei como fazer.</span>
              </label>
              <button type="button" className="sp-bt sp-bt-pri" disabled={ocupado || !termoProposta || !tudoDecidido}
                onClick={() => postar('proposta', { termo_aceito: true, decisoes }, 'Decisão enviada. A Bynx segue só com o que você aprovou.')}>
                {tudoDecidido ? 'Enviar minha decisão' : `Decida os ${pendentes.length - Object.keys(decisoes).filter(k => pendentes.some(p => p.id === k)).length} procedimentos restantes`}
              </button>
            </section>
          )}

          {s.status === 'proposta' && s.proposta_aceita_em && !devida && (
            <section className="sp-card">
              <h2>Recebemos a sua decisão</h2>
              <p className="sp-muted">
                {recalculando
                  ? 'Como parte da proposta foi recusada, a Bynx está recalculando o valor do serviço. Você recebe a cobrança com o valor certo por e-mail e aqui nesta página.'
                  : 'A Bynx segue só com os procedimentos que você aprovou.'}
              </p>
            </section>
          )}

          {s.status === 'aguardando_orcamento' && (
            <section className="sp-card">
              <h2>Estamos analisando as suas fotos</h2>
              <p className="sp-muted">Você recebe o orçamento por e-mail e ele aparece aqui. Não envie a carta ainda: o endereço só aparece depois da aprovação.</p>
            </section>
          )}

          {s.status === 'orcado' && (
            <section className="sp-card sp-card-acao">
              <h2>Seu orçamento</h2>
              <dl className="sp-dl">
                <div><dt>Serviço</dt><dd>{reais(s.orcamento_cents)}</dd></div>
                {s.seguro_cents ? <div><dt>Valor declarado nos Correios</dt><dd>{reais(s.seguro_cents)}</dd></div> : null}
                {s.frete_volta_cents ? <div><dt>Frete de volta</dt><dd>{reais(s.frete_volta_cents)}</dd></div> : null}
                <div className="sp-total"><dt>Total</dt><dd>{reais(s.total_cents)}</dd></div>
              </dl>
              {s.orcamento_obs && <p className="sp-obs">{s.orcamento_obs}</p>}
              {itens.some(i => i.aceito === false) && (
                <p className="sp-muted">{aceitas.length === 1 ? 'Uma carta entra' : `${aceitas.length} cartas entram`} no serviço. As recusadas estão abaixo, com o motivo.</p>
              )}
              <div className="sp-termo">
                <b>Termo de ciência</b>
                <ul>{termoDoServico(s.servico).itens.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
              <label className="sp-chk">
                <input type="checkbox" checked={termo} onChange={e => setTermo(e.target.checked)} />
                <span>Li o termo e aprovo o orçamento de {reais(s.total_cents)}.</span>
              </label>
              <div className="sp-acoes">
                <button type="button" className="sp-bt sp-bt-pri" disabled={!termo || ocupado} onClick={() => postar('aceitar', { termo_aceito: true }, 'Orçamento aprovado. Veja abaixo como enviar a carta.')}>
                  Aprovar e ver o endereço
                </button>
                <button type="button" className="sp-bt sp-bt-perigo" disabled={ocupado} onClick={() => confirm('Recusar o orçamento? O pedido será encerrado.') && postar('aceitar', { recusar: true }, 'Orçamento recusado.')}>
                  Recusar orçamento
                </button>
              </div>
            </section>
          )}

          {devida && (
            <section className="sp-card sp-card-acao">
              <h2>{devida.etapa === 'servico' ? 'Pagamento do serviço' : devida.etapa === 'sinal' ? 'Pagamento do sinal' : 'Pagamento'}</h2>
              <p className="sp-muted">
                {devida.etapa === 'servico'
                  ? 'Com o pagamento do serviço, sua carta vai para a bancada e o prazo começa a contar.'
                  : devida.etapa === 'sinal'
                    ? 'O sinal cobre o frete de volta da sua carta e o valor declarado nos Correios. O serviço só é cobrado quando você aprovar a proposta de tratamento. Com o sinal confirmado, o endereço de envio aparece aqui.'
                    : 'Com o pagamento confirmado, o endereço de envio aparece aqui.'}
              </p>
              <div className="sp-metodos">
              <div className="sp-pix">
                <span>Pix</span>
                <b>R$ {brl(devida.valor_cents / 100)}</b>
                {pix ? (
                  <>
                    <div className="sp-pix-chave">
                      <code>{pix.chave}</code>
                      <button type="button" className="sp-bt" onClick={() => navigator.clipboard?.writeText(pix.chave).then(() => setMsg({ ok: true, t: 'Chave Pix copiada.' })).catch(() => {})}>Copiar chave</button>
                    </div>
                    {pix.nome && <small>Favorecido: {pix.nome}</small>}
                  </>
                ) : <small>A chave Pix chega por e-mail ou WhatsApp.</small>}
                <small>Na descrição do Pix, escreva <b>{numeroServico(s.numero)}</b>.</small>
              </div>
              {SERVICOS_CARTAO_ATIVO && (
                <div className="sp-pix sp-cartao">
                  <span>Cartão de crédito</span>
                  <b>R$ {brl(devida.valor_cents / 100)}</b>
                  <small>Mesmo valor do Pix, sem acréscimo. O pagamento abre em uma página segura e volta para cá.</small>
                  <button type="button" className="sp-bt sp-bt-pri" disabled={ocupado} onClick={pagarCartao}>
                    <IconWallet size={16} /> Pagar com cartão
                  </button>
                </div>
              )}
              </div>
              <p className="sp-muted">Depois do Pix, a Bynx confirma o pagamento e esta página atualiza sozinha no próximo acesso. Você também recebe um e-mail.</p>
            </section>
          )}

          {s.status === 'aceito' && (
            <section className="sp-card sp-card-acao">
              <h2>Como enviar a sua carta</h2>
              {endereco ? (
                <div className="sp-endereco">
                  <span>Envie para</span>
                  <p>{endereco}</p>
                  <small>Escreva &quot;Pedido {numeroServico(s.numero)}&quot; do lado de fora do pacote.</small>
                </div>
              ) : (
                <p className="sp-aviso"><IconWarning size={15} /> {devida ? 'O endereço de envio aparece aqui assim que o pagamento acima for confirmado.' : 'O endereço de envio chega por e-mail ou WhatsApp em seguida.'}</p>
              )}
              <ol className="sp-guia">{GUIA_EMBALAGEM.map(g => <li key={g}>{g}</li>)}</ol>
              {endereco && <div className="sp-rastreio">
                {s.rastreio_ida && <Rastreio codigo={s.rastreio_ida} />}
                <label htmlFor="sp-rastreio">{s.rastreio_ida ? 'Informou errado? Corrija abaixo' : 'Código de rastreio da postagem'}</label>
                <div>
                  <input id="sp-rastreio" value={rastreio} onChange={e => setRastreio(e.target.value.toUpperCase())} placeholder="AA123456789BR" maxLength={30} autoCapitalize="characters" />
                  <button type="button" className="sp-bt sp-bt-pri" disabled={ocupado || rastreio.replace(/\W/g, '').length < 8} onClick={async () => { await postar('rastreio', { codigo: rastreio }, 'Rastreio registrado.'); setRastreio('') }}>
                    {s.rastreio_ida ? 'Corrigir' : 'Informar'}
                  </button>
                </div>
              </div>}
            </section>
          )}

          {s.rastreio_volta && (
            <section className="sp-card">
              <h2><IconTruck size={18} /> Sua carta está a caminho</h2>
              <Rastreio codigo={s.rastreio_volta} />
            </section>
          )}

          {midias.some(m => !m.item_id) && (
            <section className="sp-card">
              <h2>Chegada e embalagem</h2>
              <GaleriaMidias midias={paraGaleria(midias.filter(m => !m.item_id))} />
            </section>
          )}

          <section className="sp-card">
            <h2>{itens.length === 1 ? 'Sua carta' : 'Suas cartas'}</h2>
            <div className="sp-itens">
              {itens.map(it => (
                <article key={it.id} className={`sp-item${it.aceito === false ? ' sp-item-fora' : ''}`}>
                  <div className="sp-item-topo">
                    <div><b>{it.nome}</b><small>declarado {reais(it.valor_declarado_cents)}</small></div>
                    {it.custodia && <span className="sp-custodia" title="Número de custódia">{it.custodia}</span>}
                  </div>
                  {it.aceito === false && <p className="sp-recusa"><IconClose size={13} /> Fora do serviço: {it.recusa_motivo}</p>}
                  <GaleriaMidias midias={paraGaleria(midias.filter(m => m.item_id === it.id))} />
                  {it.ficha_entrada && <FichaComparada entrada={it.ficha_entrada} saida={it.ficha_saida} />}
                  {procedimentos.some(p => p.item_id === it.id && p.decisao !== 'pendente') && (
                    <ul className="sp-procs-feitos">
                      {procedimentos.filter(p => p.item_id === it.id && p.decisao !== 'pendente').map(p => (
                        <li key={p.id} className={p.decisao === 'aprovado' ? 'ok' : 'nao'}>
                          {p.decisao === 'aprovado' ? <IconCheck size={13} /> : <IconClose size={13} />} {p.procedimento}
                          <small>{p.decisao === 'aprovado' ? 'aprovado por você' : 'você preferiu não fazer'}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.laudo && (
                    <dl className="sp-dl sp-laudo">
                      {CAMPOS_LAUDO.filter(c => it.laudo?.[c.k]).map(c => <div key={c.k}><dt>{c.rotulo}</dt><dd>{it.laudo![c.k]}</dd></div>)}
                    </dl>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="sp-col">
          {pagamentos.length > 0 && (
            <section className="sp-card">
              <h2>Pagamentos</h2>
              <ul className="sp-pags">
                {pagamentos.map(pg => (
                  <li key={pg.etapa} className={pg.pago_em ? 'ok' : ''}>
                    <div><b>{ETAPA_PAG[pg.etapa]?.t}</b><span>R$ {brl(pg.valor_cents / 100)}</span></div>
                    <small>{pg.pago_em ? <><IconCheck size={12} /> Pago em {fmtDataHoraBRT.format(new Date(pg.pago_em))}</> : ETAPA_PAG[pg.etapa]?.d}</small>
                    {!!pg.reembolsado_cents && (
                      <small className="sp-estorno">
                        {pg.reembolsado_cents >= pg.valor_cents ? 'Estornado' : `Estornado R$ ${brl(pg.reembolsado_cents / 100)}`}
                        {pg.reembolsado_em ? ` em ${fmtDataHoraBRT.format(new Date(pg.reembolsado_em))}` : ''}
                        {pg.reembolsado_cents < pg.valor_cents ? `. Ficou R$ ${brl((pg.valor_cents - pg.reembolsado_cents) / 100)}.` : '.'}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="sp-card">
            <h2>Linha do tempo</h2>
            <ol className="sp-tl">
              {[...eventos].reverse().map(e => (
                <li key={e.id}>
                  <b>{e.status === 'fotos_completas' ? 'Fotos recebidas' : STATUS_SERVICO[e.status] || e.status}</b>
                  {e.nota && <span>{e.nota}</span>}
                  <small>{fmtDataHoraBRT.format(new Date(e.created_at))}</small>
                </li>
              ))}
            </ol>
          </section>
          <section className="sp-card sp-garantia">
            <IconBox size={18} />
            <p>Cada etapa com a sua carta deixa registro: vídeo da abertura, fotos na mesma luz na entrada e na saída, e o número de custódia.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

const POSICAO: Record<string, string> = {
  frente: 'frente', verso: 'verso', superior: 'borda superior', inferior: 'borda inferior', esquerda: 'borda esquerda', direita: 'borda direita',
}
function rotuloPosicao(p: string | null) {
  if (!p) return ''
  if (POSICAO[p]) return ` · ${POSICAO[p]}`
  const [lado, vert, hor] = p.split('_')
  return ` · ${vert === 'sup' ? 'superior' : 'inferior'} ${hor === 'esq' ? 'esquerdo' : 'direito'} (${lado})`
}
function paraGaleria(ms: Midia[]) {
  return ms.map(m => ({ id: m.id, url: m.url, mime: m.mime, rotulo: `${ROTULO_MIDIA[m.tipo] || m.tipo}${rotuloPosicao(m.posicao)}` }))
}

// Condicao na chegada x na saida, pilar a pilar. Escala textual, nunca nota.
function FichaComparada({ entrada, saida }: { entrada: FichaCondicao; saida: FichaCondicao | null }) {
  const rot = (v?: string) => ESCALA.find(e => e.id === v)?.rotulo || '—'
  const danos = (ids: string[]) => ids.map(d => DANOS.find(x => x.id === d)?.rotulo || d).join(', ')
  return (
    <div className="sp-ficha">
      <table>
        <thead><tr><th>Condição</th><th>Chegada</th>{saida && <th>Saída</th>}</tr></thead>
        <tbody>
          {PILARES.map(p => (['frente', 'verso'] as const).map(lado => (
            <tr key={`${p.id}-${lado}`}>
              <td>{p.rotulo} <small>{lado}</small></td>
              <td>{rot(entrada[lado][p.id])}</td>
              {saida && <td>{rot(saida[lado][p.id])}</td>}
            </tr>
          )))}
        </tbody>
      </table>
      {(entrada.danos_frente.length > 0 || entrada.danos_verso.length > 0) && (
        <p className="sp-muted">Registrado na chegada: {[danos(entrada.danos_frente) && `frente: ${danos(entrada.danos_frente)}`, danos(entrada.danos_verso) && `verso: ${danos(entrada.danos_verso)}`].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  )
}

const CSS = `
.sp{color:var(--bx-text);padding-bottom:48px}
.sp-muted{font-size:14px;line-height:1.55;color:var(--bx-text-2);margin:0}
.sp-pill{font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12)}
.sp-pill-fim{color:var(--bx-text-3);background:var(--bx-surface-2)}
.sp-etapas{list-style:none;margin:0 0 18px;padding:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.sp-etapas::-webkit-scrollbar{display:none}
.sp-etapas li{flex:1 0 auto;display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border-radius:10px;background:var(--bx-surface);border:1px solid var(--bx-border);font-size:12.5px;font-weight:600;color:var(--bx-text-3);white-space:nowrap}
.sp-etapas li span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;background:var(--bx-surface-2)}
.sp-etapas li.feito{color:var(--bx-text-2)}
.sp-etapas li.feito span{background:color-mix(in srgb,var(--bx-green) 16%,transparent);color:var(--bx-green)}
.sp-etapas li.fim{color:var(--bx-text);border-color:color-mix(in srgb,var(--bx-green) 50%,transparent)}
.sp-etapas li.agora{color:var(--bx-text);border-color:rgba(var(--ac-1-rgb),.5)}
.sp-etapas li.agora span{background:var(--ac-grad);color:var(--bx-brand-ink)}
.sp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.sp-col{display:grid;gap:16px;min-width:0}
.sp-card{border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface);padding:18px;display:grid;gap:12px;min-width:0}
.sp-card h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin:0}
.sp-card-acao{border-color:rgba(var(--ac-1-rgb),.4)}
.sp-vazio{justify-items:center;text-align:center;padding:40px 20px;color:var(--bx-text-3)}
.sp-vazio p{margin:0}
.sp-dl{display:grid;gap:8px;margin:0}
.sp-dl div{display:flex;justify-content:space-between;gap:12px;font-size:14px}
.sp-dl dt{color:var(--bx-text-2)}
.sp-dl dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.sp-total{padding-top:8px;border-top:1px solid var(--bx-border);font-weight:800;font-size:16px}
.sp-obs{margin:0;padding:12px 14px;border-radius:10px;background:var(--bx-surface-2);font-size:14px;line-height:1.55;white-space:pre-wrap}
.sp-termo{padding:14px;border-radius:10px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.sp-termo b{font-size:13px}
.sp-termo ul{margin:8px 0 0;padding-left:18px;display:grid;gap:6px;font-size:13px;line-height:1.5;color:var(--bx-text-2)}
.sp-chk{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;font-size:14px;line-height:1.5;cursor:pointer}
.sp-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ac-1)}
.sp-acoes{display:flex;flex-wrap:wrap;gap:10px}
.sp-bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 18px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s ease,transform .15s ease}
.sp-bt:disabled{opacity:.5;cursor:not-allowed}
.sp-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sp-bt-pri:hover:not(:disabled){transform:translateY(-2px)}
.sp-bt-perigo{background:transparent;color:var(--bx-red);border-color:color-mix(in srgb,var(--bx-red) 40%,transparent)}
.sp-endereco{padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid rgba(var(--ac-1-rgb),.4)}
.sp-endereco span{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1)}
.sp-endereco p{margin:6px 0;font-size:15px;line-height:1.55;white-space:pre-wrap}
.sp-endereco small{font-size:12.5px;color:var(--bx-text-2)}
.sp-aviso{display:flex;gap:8px;align-items:flex-start;margin:0;font-size:14px;color:var(--bx-text-2)}
.sp-aviso svg{flex-shrink:0;margin-top:2px;color:var(--ac-1)}
.sp-guia{margin:0;padding-left:20px;display:grid;gap:6px;font-size:14px;line-height:1.5;color:var(--bx-text-2)}
.sp-rastreio{display:grid;gap:6px}
.sp-rastreio label{font-size:13px;font-weight:600;color:var(--bx-text-2)}
.sp-rastreio > div{display:flex;gap:8px}
.sp-rastreio input{flex:1;min-width:0;min-height:48px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text);padding:0 12px;font:inherit;font-size:16px;letter-spacing:.04em;color-scheme:dark}
.sp-rastreio input:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.7)}
.sp-ok{font-size:14px;color:var(--bx-green);margin:0 0 14px}
.sp-erro{font-size:14px;color:var(--bx-red);margin:0 0 14px}
.sp-itens{display:grid;gap:12px}
.sp-item{display:grid;gap:10px;padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.sp-item-fora{opacity:.8}
.sp-item-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.sp-item-topo b{display:block;font-size:15px}
.sp-item-topo small{font-size:12.5px;color:var(--bx-text-3)}
.sp-custodia{font-size:12px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:8px;border:1px solid rgba(var(--ac-1-rgb),.45);color:var(--ac-1);white-space:nowrap}
.sp-recusa{display:flex;gap:6px;align-items:flex-start;margin:0;font-size:13.5px;line-height:1.5;color:var(--bx-red)}
.sp-recusa svg{flex-shrink:0;margin-top:3px}
.sp-laudo{padding-top:10px;border-top:1px solid var(--bx-border)}
.sp-tl{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.sp-tl li{display:grid;gap:2px;padding-left:12px;border-left:2px solid var(--bx-border-2)}
.sp-tl li:first-child{border-left-color:var(--ac-1)}
.sp-tl b{font-size:14px}
.sp-tl span{font-size:13px;color:var(--bx-text-2);line-height:1.45}
.sp-tl small{font-size:11.5px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.sp-objetivo{font-size:13.5px;color:var(--bx-text-2);margin:0 0 14px}
.sp-prop-carta{display:grid;gap:10px;padding-top:6px}
.sp-prop-carta > b{font-size:14px}
.sp-proc{display:grid;gap:10px;padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.sp-proc-topo{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.sp-proc-topo b{font-size:15px}
.sp-risco{flex-shrink:0;font-size:11px;font-weight:800;padding:4px 9px;border-radius:999px}
.sp-risco-baixo{color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}
.sp-risco-medio{color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12)}
.sp-risco-alto{color:var(--bx-red);background:color-mix(in srgb,var(--bx-red) 12%,transparent)}
.sp-proc-dl div{flex-direction:column;gap:2px}
.sp-proc-dl dd{text-align:left;color:var(--bx-text)}
.sp-decide{display:grid;grid-template-columns:1fr 1fr;border-radius:12px;overflow:hidden;border:1px solid var(--bx-border-2)}
.sp-decide button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;border:0;background:transparent;color:var(--bx-text-2);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer}
.sp-decide button.on{background:color-mix(in srgb,var(--bx-green) 16%,transparent);color:var(--bx-green)}
.sp-decide button.on.off{background:color-mix(in srgb,var(--bx-red) 14%,transparent);color:var(--bx-red)}
.sp-ficha{padding-top:10px;border-top:1px solid var(--bx-border);display:grid;gap:8px}
.sp-ficha table{width:100%;border-collapse:collapse;font-size:13px}
.sp-ficha th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text-3);padding:4px 6px}
.sp-ficha td{padding:5px 6px;border-top:1px solid var(--bx-border)}
.sp-ficha td small{color:var(--bx-text-3)}
.sp-procs-feitos{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.sp-procs-feitos li{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13.5px}
.sp-procs-feitos li.ok svg{color:var(--bx-green)}
.sp-procs-feitos li.nao{color:var(--bx-text-2)}
.sp-procs-feitos li.nao svg{color:var(--bx-red)}
.sp-procs-feitos small{font-size:12px;color:var(--bx-text-3)}
.sp-pix{display:grid;gap:6px;padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid rgba(var(--ac-1-rgb),.4)}
.sp-pix > span{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1)}
.sp-pix > b{font-size:26px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.sp-pix small{font-size:13px;color:var(--bx-text-2)}
.sp-metodos{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.sp-cartao{align-content:start}
.sp-cartao .sp-bt{margin-top:4px}
.sp-pix-chave{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.sp-pix-chave code{flex:1 1 180px;min-width:0;padding:10px 12px;border-radius:10px;background:var(--bx-surface-2);font-size:14px;overflow-wrap:anywhere}
.sp-pags{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.sp-pags li{display:grid;gap:4px;padding:10px 12px;border-radius:10px;border:1px solid var(--bx-border)}
.sp-pags li.ok{border-color:color-mix(in srgb,var(--bx-green) 35%,transparent)}
.sp-pags li > div{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.sp-pags li span{font-weight:700;font-variant-numeric:tabular-nums}
.sp-pags li small.sp-estorno,.sp-pags li.ok small.sp-estorno{color:var(--bx-amber);font-weight:600}
.sp-pags small{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;line-height:1.45;color:var(--bx-text-2)}
.sp-pags li.ok small{color:var(--bx-green)}
.sp-garantia{grid-template-columns:24px minmax(0,1fr);align-items:start;color:var(--bx-green)}
.sp-garantia p{margin:0;font-size:13px;line-height:1.55;color:var(--bx-text-2)}
@media (max-width:980px){ .sp-grid{grid-template-columns:1fr} }
@media (max-width:640px){
  .sp-acoes > .sp-bt{flex:1 1 100%}
  .sp-rastreio > div{flex-direction:column}
}
@media (prefers-reduced-motion:reduce){ .sp-bt{transition:none} .sp-bt-pri:hover:not(:disabled){transform:none} }
`
