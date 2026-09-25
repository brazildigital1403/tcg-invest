'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { pctLabel, calcularCheckout, fmtBRL, type PrazoRepasse } from '@/lib/comissao'
import { IconWallet, IconCheck, IconSearch, IconWarning, IconClock, IconKey, IconLocation, IconShield, IconLoja } from '@/components/ui/Icons'

/**
 * /recebimentos — ativar o recebimento de vendas SEM ter loja.
 *
 * ★ POR QUE EXISTE (24/09/2026, Quadro #389). Ate hoje so loja recebia: a tela
 * de ativacao era `/minha-loja/[id]/pagamentos` e exigia um `lojaId`. Medido no
 * dia: 70 dos 100 anuncios ativos sao de pessoa fisica sem loja -- 18 pessoas,
 * R$ 27.877 parados -- e para elas nao existia caminho nenhum, nem ruim.
 *
 * ★ QUEM TEM LOJA NAO VEM PARA CA. A tela detecta a loja e aponta para o
 * painel dela, em vez de abrir uma segunda conta Connect paralela. A conta da
 * loja continua valendo; o `resolverRecebedor` e que escolhe qual usar.
 *
 * ★ O CEP FICA ANTES DO BOTAO, de proposito. Quem vende de casa nao tem painel
 * de frete fixo: a cotacao sai do CEP dela. Sem CEP, a conta seria aprovada e o
 * botao "Comprar" continuaria escondido -- a pessoa faria o KYC inteiro para
 * nada. Por isso a rota de onboarding tambem recusa sem CEP; a tela so nao
 * deixa a pessoa descobrir isso depois.
 *
 * Acento: ambar do app (esta tela e do vendedor pessoa fisica, nao da loja).
 * Zero emoji — icones de Icons.tsx.
 *
 * ★ O SUSPENSE NAO E ENFEITE: esta rota e ESTATICA, e `useSearchParams` num
 * componente sem boundary derruba o BUILD inteiro no prerender
 * ("missing-suspense-with-csr-bailout"). A tela de pagamentos da loja nao
 * precisa disso porque vive sob `[id]`, que ja e dinamica. Pego no build local
 * antes do deploy.
 */

type Status = 'nao_iniciado' | 'pendente' | 'em_analise' | 'ativo' | 'restrito'

interface Info {
  status: Status
  charges_enabled: boolean
  payouts_enabled: boolean
  cep: string | null
  repasse_prazo: PrazoRepasse
  anuncios_no_ar: number
  loja: { id: string; nome: string; tem_conta_propria: boolean } | null
  pendencias: string[]
  disabled_reason?: string | null
}

const EXEMPLO_CENTS = 9990

function fmtCep(v: string): string {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export default function RecebimentosPage() {
  return (
    <AppLayout>
      <Suspense fallback={<div style={{ ...S.card, textAlign: 'center', color: 'var(--bx-text-3)' }}>Carregando…</div>}>
        <Conteudo />
      </Suspense>
    </AppLayout>
  )
}

function Conteudo() {
  const search = useSearchParams()
  const [info, setInfo] = useState<Info | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const [cepTxt, setCepTxt] = useState('')
  const [salvandoCep, setSalvandoCep] = useState(false)
  const [cepOk, setCepOk] = useState(false)
  const [salvandoPrazo, setSalvandoPrazo] = useState(false)

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const t = await token()
      if (!t) { setErro('Faça login para ver seus recebimentos.'); return }
      const r = await fetch('/api/recebimentos', { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao carregar')
      setInfo(j)
      setCepTxt(j.cep ? fmtCep(j.cep) : '')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function salvarCep() {
    const d = cepTxt.replace(/\D/g, '')
    if (d.length !== 8) { setErro('CEP inválido. Use 8 dígitos.'); return }
    setSalvandoCep(true)
    setErro(null)
    try {
      const t = await token()
      const r = await fetch('/api/recebimentos', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep: d }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Falha ao salvar')
      setInfo(prev => (prev ? { ...prev, cep: d } : prev))
      setCepOk(true)
      setTimeout(() => setCepOk(false), 2500)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvandoCep(false)
    }
  }

  async function trocarPrazo(p: PrazoRepasse) {
    if (!info || info.repasse_prazo === p) return
    setSalvandoPrazo(true)
    setErro(null)
    const antes = info.repasse_prazo
    setInfo({ ...info, repasse_prazo: p })
    try {
      const t = await token()
      const r = await fetch('/api/recebimentos', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repasse_prazo: p }),
      })
      const j = await r.json().catch(() => null)
      // 409 = a Stripe recusou (piso de 30 dias). A rota NAO grava nesse caso.
      if (!r.ok) {
        setInfo(prev => (prev ? { ...prev, repasse_prazo: antes } : prev))
        throw new Error(j?.error || 'Falha ao trocar o prazo')
      }
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvandoPrazo(false)
    }
  }

  async function ativar() {
    setIndo(true)
    setErro(null)
    try {
      const t = await token()
      const r = await fetch('/api/recebimentos/onboard', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      })
      const j = await r.json()
      if (!r.ok || !j?.url) throw new Error(j?.error || 'Falha ao iniciar o cadastro')
      window.location.href = j.url
    } catch (e) {
      setErro((e as Error).message)
      setIndo(false)
    }
  }

  const status: Status = info?.status || 'nao_iniciado'
  const prazo: PrazoRepasse = info?.repasse_prazo || 30
  const temCep = String(info?.cep || '').replace(/\D/g, '').length === 8
  const voltouDoOnboarding = search.get('done') === '1'
  const c = calcularCheckout(EXEMPLO_CENTS, prazo, 'cartao')

  return (
    <>
      <PageHeader
        trilha={[INICIO, { name: 'Recebimentos', href: '/recebimentos' }]}
        titulo="Recebimentos"
        descricao="Receba pelas suas vendas direto na sua conta, sem precisar ter loja."
        stat={
          info
            ? `${info.anuncios_no_ar} ${info.anuncios_no_ar === 1 ? 'anúncio' : 'anúncios'} no ar`
            : undefined
        }
      />

      {erro && <div style={S.erro}>{erro}</div>}

      {carregando ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--bx-text-3)' }}>Carregando…</div>
      ) : (
        <div style={S.colunas}>
          {/* ─── Quem tem loja gerencia por la ──────────────────────────── */}
          {info?.loja && (
            <div style={S.faixaLoja}>
              <span style={S.faixaIco}><IconLoja size={18} /></span>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <strong style={S.faixaTit}>Você tem a loja {info.loja.nome}</strong>
                <p style={S.faixaTxt}>
                  {info.loja.tem_conta_propria
                    ? 'Ela já recebe pela conta dela. O que você ativar aqui vale para o que ficar fora da loja.'
                    : 'O que você ativar aqui vale também para a sua loja — ela usa esta mesma conta.'}
                </p>
              </div>
              <Link href={`/minha-loja/${info.loja.id}/pagamentos`} style={S.faixaBtn}>Abrir a loja</Link>
            </div>
          )}

          {/* ─── Status ─────────────────────────────────────────────────── */}
          <div style={S.card}>
            {status === 'ativo' ? (
              <div style={S.centro}>
                <div style={{ ...S.icone, color: 'var(--bx-green)' }}><IconCheck size={34} strokeWidth={1.6} /></div>
                <span style={{ ...S.badge, ...S.badgeOk }}>Recebimentos ativos</span>
                <p style={S.txt}>
                  Seus anúncios já podem ser comprados aqui na Bynx, com pagamento, frete e rastreio.
                  O dinheiro cai na conta que você cadastrou, sem passar pela gente.
                </p>
              </div>
            ) : status === 'em_analise' ? (
              <div style={S.centro}>
                <div style={S.icone}><IconSearch size={34} strokeWidth={1.2} /></div>
                <span style={{ ...S.badge, ...S.badgeAnalise }}>Em análise pela Stripe</span>
                <p style={S.txt}>
                  Seus dados foram enviados e estão sendo conferidos. <b>Você não precisa fazer nada</b> —
                  normalmente leva de alguns minutos a 1 dia útil. A gente avisa quando liberar.
                </p>
              </div>
            ) : status === 'pendente' ? (
              <div style={S.centro}>
                <div style={S.icone}><IconClock size={34} strokeWidth={1.2} /></div>
                <span style={{ ...S.badge, ...S.badgePend }}>Cadastro incompleto</span>
                <p style={S.txt}>
                  {voltouDoOnboarding
                    ? 'A Stripe ainda está conferindo, ou faltou algum dado. Continue de onde parou.'
                    : 'Você começou o cadastro e ainda falta concluir.'}
                </p>
                {(info?.pendencias?.length || 0) > 0 && (
                  <p style={S.pend}>Pendências: {info!.pendencias.length} item(ns) a preencher</p>
                )}
                <button onClick={ativar} disabled={indo} style={{ ...S.btn, opacity: indo ? 0.6 : 1 }}>
                  {indo ? 'Abrindo…' : 'Continuar cadastro'}
                </button>
              </div>
            ) : status === 'restrito' ? (
              <div style={S.centro}>
                <div style={{ ...S.icone, color: '#f59e0b' }}><IconWarning size={34} strokeWidth={1.2} /></div>
                <span style={{ ...S.badge, ...S.badgeRestr }}>Conta com pendência</span>
                <p style={S.txt}>A Stripe pediu informações a mais para liberar os seus recebimentos.</p>
                <button onClick={ativar} disabled={indo} style={{ ...S.btn, opacity: indo ? 0.6 : 1 }}>
                  {indo ? 'Abrindo…' : 'Resolver pendência'}
                </button>
              </div>
            ) : (
              <div style={S.centro}>
                <div style={{ ...S.icone, color: 'var(--ac-1)' }}><IconWallet size={34} strokeWidth={1.2} /></div>
                <h2 style={S.h2}>Venda de verdade pelos seus anúncios</h2>
                <p style={S.txt}>
                  Hoje quem se interessa pelas suas cartas só consegue conversar com você — o
                  pagamento e o envio acontecem por fora. Ativando o recebimento, o botão de comprar
                  aparece nos seus anúncios e a venda fecha aqui dentro.
                </p>
                {/* ★ O CEP E PRE-REQUISITO, nao um passo depois: sem ele o frete
                    nao cota e o botao continuaria escondido mesmo com a conta
                    aprovada. Por isso o botao fica travado ate o CEP existir. */}
                <button
                  onClick={ativar}
                  disabled={indo || !temCep}
                  title={temCep ? undefined : 'Informe o CEP de envio primeiro'}
                  style={{ ...S.btn, opacity: indo || !temCep ? 0.5 : 1, cursor: temCep ? 'pointer' : 'not-allowed' }}
                >
                  {indo ? 'Abrindo…' : 'Ativar recebimentos'}
                </button>
                <p style={S.mini}>
                  {temCep
                    ? 'Leva uns 3 minutos. Você precisa do CPF (ou CNPJ) e dos dados bancários.'
                    : 'Informe o CEP de envio logo abaixo para liberar a ativação.'}
                </p>
              </div>
            )}
          </div>

          {/* ─── CEP de envio ───────────────────────────────────────────── */}
          <div style={S.card}>
            <h2 style={S.h3}><IconLocation size={16} /> CEP de envio</h2>
            <p style={S.sub}>
              De onde você posta as cartas. É por ele que o frete é calculado para quem compra —
              sem CEP, o preço do envio não existe.
            </p>
            <div style={S.linhaCampo}>
              <input
                value={cepTxt}
                onChange={e => setCepTxt(fmtCep(e.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                style={S.input}
              />
              <button onClick={salvarCep} disabled={salvandoCep} style={{ ...S.btnGhost, opacity: salvandoCep ? 0.6 : 1 }}>
                {salvandoCep ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
            {cepOk && <p style={S.ok}>CEP salvo.</p>}
            <p style={S.mini}>Só o CEP, nunca o endereço completo. Quem compra vê apenas o valor do frete.</p>
          </div>

          {/* ─── Prazo de repasse ───────────────────────────────────────── */}
          <div style={S.card}>
            <h2 style={S.h3}>Prazo de repasse</h2>
            <p style={S.sub}>Quanto antes você recebe, um pouco maior é a comissão.</p>
            <div style={S.chips}>
              {([14, 30] as PrazoRepasse[]).map(p => {
                const bloqueado = p === 14
                return (
                  <button
                    key={p}
                    onClick={() => trocarPrazo(p)}
                    disabled={salvandoPrazo || bloqueado}
                    title={bloqueado ? 'Libera conforme você vende mais e ganha histórico' : undefined}
                    style={{ ...S.chip, ...(prazo === p ? S.chipOn : {}), ...(bloqueado ? S.chipLocked : {}) }}
                  >
                    {bloqueado && <IconKey size={12} />}
                    {p} dias · {pctLabel(p)}
                  </button>
                )
              })}
            </div>
            <p style={S.mini}>
              Contas novas começam com repasse em 30 dias — é regra da Stripe, não da Bynx.
            </p>

            {/* A conta fechada, sem letra miuda: numa carta de R$ 99,90. */}
            <div style={S.conta}>
              <div style={S.contaLinha}><span>Carta anunciada por</span><b>{fmtBRL(EXEMPLO_CENTS)}</b></div>
              <div style={S.contaLinha}><span>Comissão da Bynx</span><b>− {fmtBRL(c.comissaoVendedorCents)}</b></div>
              <div style={{ ...S.contaLinha, ...S.contaTotal }}><span>Você recebe</span><b>{fmtBRL(c.liquidoLojaCents)}</b></div>
              <p style={S.mini}>
                O frete vai integral para você, fora da comissão. Quem compra paga o acréscimo do
                cartão — o seu líquido é o mesmo em qualquer forma de pagamento.
              </p>
            </div>
          </div>

          <div style={S.rodape}>
            <IconShield size={15} />
            <span>
              O cadastro é feito na Stripe, que processa os pagamentos. A Bynx nunca vê seus dados
              bancários nem os do comprador.
            </span>
          </div>
        </div>
      )}
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  colunas: { display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 },
  card: {
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    borderRadius: 16, padding: 18,
  },
  centro: { textAlign: 'center', padding: '6px 0' },
  icone: { display: 'flex', justifyContent: 'center', color: 'var(--bx-text-3)', marginBottom: 10 },
  h2: { fontSize: 18, fontWeight: 800, color: 'var(--bx-text)', margin: '0 0 8px' },
  h3: {
    fontSize: 14, fontWeight: 800, color: 'var(--bx-text)', margin: '0 0 4px',
    display: 'flex', alignItems: 'center', gap: 7,
  },
  sub: { fontSize: 12.5, color: 'var(--bx-text-2)', margin: '0 0 12px', lineHeight: 1.5 },
  txt: { fontSize: 13.5, color: 'var(--bx-text-2)', margin: '0 0 14px', lineHeight: 1.6 },
  mini: { fontSize: 11.5, color: 'var(--bx-text-3)', margin: '10px 0 0', lineHeight: 1.5 },
  pend: { fontSize: 12.5, color: '#f59e0b', margin: '0 0 12px', fontWeight: 700 },
  ok: { fontSize: 12, color: 'var(--bx-green)', margin: '8px 0 0', fontWeight: 700 },
  badge: {
    display: 'inline-block', fontSize: 11.5, fontWeight: 800, padding: '5px 11px',
    borderRadius: 999, marginBottom: 10,
  },
  badgeOk: { background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--bx-green)' },
  badgeAnalise: { background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)' },
  badgePend: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', color: '#f59e0b' },
  badgeRestr: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.28)', color: '#f59e0b' },
  btn: {
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', border: 'none',
    padding: '12px 20px', borderRadius: 11, fontSize: 14, fontWeight: 800,
    cursor: 'pointer', minHeight: 44, transition: 'opacity 0.15s ease',
  },
  btnGhost: {
    background: 'var(--bx-surface-2)', color: 'var(--bx-text)', border: '1px solid var(--bx-border-2)',
    padding: '0 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', minHeight: 44, flex: '0 0 auto', transition: 'background 0.15s ease',
  },
  linhaCampo: { display: 'flex', gap: 8, alignItems: 'stretch' },
  input: {
    flex: 1, minWidth: 0, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    borderRadius: 10, padding: '0 12px', color: 'var(--bx-text)',
    // ★ 16px: abaixo disso o Safari iOS da zoom ao focar e nao volta.
    fontSize: 16, minHeight: 44,
  },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text-2)', padding: '10px 14px', borderRadius: 999,
    fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 44,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  chipOn: { background: 'var(--bx-surface-3)', borderColor: 'var(--ac-1)', color: 'var(--bx-text)' },
  chipLocked: { opacity: 0.5, cursor: 'not-allowed' },
  conta: {
    marginTop: 16, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
    borderRadius: 12, padding: 14,
  },
  contaLinha: {
    display: 'flex', justifyContent: 'space-between', gap: 12,
    fontSize: 13, color: 'var(--bx-text-2)', padding: '5px 0',
  },
  contaTotal: {
    borderTop: '1px solid var(--bx-border)', marginTop: 5, paddingTop: 10,
    color: 'var(--bx-text)', fontWeight: 800,
  },
  faixaLoja: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    borderRadius: 14, padding: '12px 14px',
  },
  faixaIco: {
    width: 34, height: 34, flex: '0 0 auto', borderRadius: 9,
    background: 'var(--bx-surface-3)', color: 'var(--bx-text-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  faixaTit: { fontSize: 13, fontWeight: 800, color: 'var(--bx-text)', display: 'block' },
  faixaTxt: { fontSize: 12, color: 'var(--bx-text-2)', margin: '2px 0 0', lineHeight: 1.45 },
  faixaBtn: {
    flex: '0 0 auto', background: 'var(--bx-surface-3)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text)', padding: '0 14px', borderRadius: 10, fontSize: 12.5,
    fontWeight: 700, textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center',
  },
  rodape: {
    display: 'flex', gap: 9, alignItems: 'flex-start',
    fontSize: 11.5, color: 'var(--bx-text-3)', lineHeight: 1.5, padding: '0 2px',
  },
  erro: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5', borderRadius: 12, padding: '11px 14px', fontSize: 13, marginBottom: 14,
  },
}
