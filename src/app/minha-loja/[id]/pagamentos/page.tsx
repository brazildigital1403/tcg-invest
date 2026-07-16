'use client'

import { use as usePromise, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLojaOwner, LojaEstadoFallback, SH } from '../_shared'
import { pctLabel, calcularCheckout, fmtBRL, type PrazoRepasse, type MetodoPagamento } from '@/lib/comissao'

/**
 * Pagamentos da loja — Stripe Connect Express (Fase 1 do epico de vendas).
 *
 * Estados: nao_iniciado -> pendente -> ativo | restrito.
 * O lojista cadastra dados/banco na Stripe (hospedado). A Bynx nunca ve.
 */

interface ConnectInfo {
  status: 'nao_iniciado' | 'pendente' | 'ativo' | 'restrito'
  charges_enabled: boolean
  payouts_enabled: boolean
  repasse_prazo: PrazoRepasse
  pendencias: string[]
  disabled_reason?: string | null
}

const EXEMPLO_CENTS = 24990

export default function LojaPagamentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, loja } = useLojaOwner(lojaId)
  const search = useSearchParams()

  const [info, setInfo] = useState<ConnectInfo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvandoPrazo, setSalvandoPrazo] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPagamento>('cartao')

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/connect`, { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao carregar')
      setInfo(j)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId, token])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  async function ativar() {
    setIndo(true)
    setErro(null)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/connect/onboard`, {
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

  async function trocarPrazo(p: PrazoRepasse) {
    if (!info || info.repasse_prazo === p) return
    setSalvandoPrazo(true)
    const antes = info.repasse_prazo
    setInfo({ ...info, repasse_prazo: p })
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/connect`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repasse_prazo: p }),
      })
      if (!r.ok) throw new Error('Falha ao salvar')
    } catch {
      setInfo(prev => (prev ? { ...prev, repasse_prazo: antes } : prev))
      setErro('Nao consegui salvar o prazo. Tente de novo.')
    } finally {
      setSalvandoPrazo(false)
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const voltouDoOnboarding = search.get('done') === '1'
  const status = info?.status || 'nao_iniciado'
  const prazo: PrazoRepasse = info?.repasse_prazo || 30
  const c = calcularCheckout(EXEMPLO_CENTS, prazo, metodo)

  return (
    <div style={SH.page}>
      <header style={SH.head}>
        <h1 style={SH.title}>Pagamentos</h1>
        <p style={SH.subtitle}>Receba direto na sua conta pelas vendas na Bynx.</p>
      </header>

      {erro && <div style={S.erro}>{erro}</div>}

      {carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>Carregando…</div>
      ) : (
        <>
          {/* ─── Cartao de status ─────────────────────────────── */}
          <div style={SH.card}>
            {status === 'ativo' ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={S.icone}>✅</div>
                <span style={S.badgeOk}>Recebimentos ativos</span>
                <p style={S.txt}>
                  Sua loja está pronta para vender na Bynx. O dinheiro cai direto na conta que você
                  cadastrou, sem passar pela gente.
                </p>
              </div>
            ) : status === 'pendente' ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={S.icone}>⏳</div>
                <span style={S.badgePend}>Cadastro incompleto</span>
                <p style={S.txt}>
                  {voltouDoOnboarding
                    ? 'A Stripe ainda está conferindo (ou faltou algum dado). Continue de onde parou.'
                    : 'Você começou o cadastro mas ainda falta concluir.'}
                </p>
                {(info?.pendencias?.length || 0) > 0 && (
                  <p style={S.pend}>Pendências: {info!.pendencias.length} item(ns) a preencher</p>
                )}
                <button onClick={ativar} disabled={indo} style={{ ...SH.btnPrimary, marginTop: 4, opacity: indo ? 0.6 : 1 }}>
                  {indo ? 'Abrindo…' : 'Continuar cadastro →'}
                </button>
              </div>
            ) : status === 'restrito' ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={S.icone}>⚠️</div>
                <span style={S.badgeRestr}>Conta com pendência</span>
                <p style={S.txt}>A Stripe pediu informações adicionais para liberar seus recebimentos.</p>
                <button onClick={ativar} disabled={indo} style={{ ...SH.btnPrimary, marginTop: 4, opacity: indo ? 0.6 : 1 }}>
                  {indo ? 'Abrindo…' : 'Resolver pendência →'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={S.icone}>🏦</div>
                <h2 style={S.h2}>Comece a vender na Bynx</h2>
                <p style={S.txt}>
                  Ative os recebimentos e venda suas cartas direto na sua vitrine. O dinheiro cai na
                  sua conta bancária — seus dados ficam seguros com a Stripe, a Bynx nunca vê.
                </p>
                <button onClick={ativar} disabled={indo} style={{ ...SH.btnPrimary, marginTop: 4, opacity: indo ? 0.6 : 1 }}>
                  {indo ? 'Abrindo…' : 'Ativar recebimentos →'}
                </button>
                <p style={S.mini}>Leva uns 3 minutos. Você precisa do CNPJ/CPF e dos dados bancários.</p>
              </div>
            )}
          </div>

          {/* ─── Prazo de repasse + comissao ──────────────────── */}
          <div style={{ ...SH.card, marginTop: 16 }}>
            <h2 style={S.h3}>Prazo de repasse</h2>
            <p style={S.sub}>Quanto antes você recebe, um pouco maior é a comissão.</p>

            <div style={S.chips}>
              {([14, 30] as PrazoRepasse[]).map(p => (
                <button
                  key={p}
                  onClick={() => trocarPrazo(p)}
                  disabled={salvandoPrazo}
                  style={{ ...S.chip, ...(prazo === p ? S.chipOn : {}) }}
                >
                  {p} dias · {pctLabel(p)}
                </button>
              ))}
            </div>

            <div style={S.linhas}>
              <div style={S.linha}><span style={S.lbl}>Sua comissão</span><span>{pctLabel(prazo)} + R$ 0,40*</span></div>
              <div style={S.linha}><span style={S.lbl}>Numa venda de {fmtBRL(EXEMPLO_CENTS)}</span><span>− {fmtBRL(c.comissaoVendedorCents)}</span></div>
              <div style={{ ...S.linha, borderBottom: 'none', fontWeight: 800 }}>
                <span style={{ color: '#22c55e' }}>Você recebe</span>
                <span style={{ color: '#22c55e' }}>{fmtBRL(c.liquidoLojaCents)}</span>
              </div>
            </div>
            <p style={S.mini}>* A taxa fixa de R$ 0,40 só entra em vendas a partir de R$ 20,00.</p>
          </div>

          {/* ─── Lado do comprador ────────────────────────────── */}
          <div style={{ ...SH.card, marginTop: 16 }}>
            <h2 style={S.h3}>O que o comprador paga</h2>
            <p style={S.sub}>Como em outras plataformas do mercado, o custo do meio de pagamento vai pro comprador — o seu líquido não muda.</p>

            <div style={S.chips}>
              {(['pix', 'cartao'] as MetodoPagamento[]).map(m => (
                <button key={m} onClick={() => setMetodo(m)} style={{ ...S.chip, ...(metodo === m ? S.chipOn : {}) }}>
                  {m === 'pix' ? '⚡ Pix' : '💳 Cartão'}
                </button>
              ))}
            </div>

            <div style={S.linhas}>
              <div style={S.linha}><span style={S.lbl}>Preço do seu anúncio</span><span>{fmtBRL(c.valorCents)}</span></div>
              <div style={S.linha}>
                <span style={S.lbl}>Acréscimo {metodo === 'pix' ? 'do Pix' : 'do cartão (4,8%)'}</span>
                <span>+ {fmtBRL(c.acrescimoCents)}</span>
              </div>
              <div style={S.linha}><span style={S.lbl}>Comprador paga</span><span style={{ fontWeight: 700 }}>{fmtBRL(c.totalCompradorCents)}</span></div>
              <div style={{ ...S.linha, borderBottom: 'none', fontWeight: 800 }}>
                <span style={{ color: '#22c55e' }}>Você recebe (igual nos dois)</span>
                <span style={{ color: '#22c55e' }}>{fmtBRL(c.liquidoLojaCents)}</span>
              </div>
            </div>
            <p style={S.mini}>O Pix sai mais barato pro comprador — a maioria escolhe ele.</p>
          </div>
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  icone: { fontSize: 36, marginBottom: 10 },
  h2: { fontSize: 17, fontWeight: 800, margin: '0 0 8px' },
  h3: { fontSize: 15, fontWeight: 800, margin: '0 0 2px' },
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.45)', margin: '0 0 12px' },
  txt: { fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, margin: '0 0 14px', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' },
  mini: { fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginTop: 10 },
  pend: { fontSize: 12, color: '#f59e0b', margin: '0 0 12px' },
  badgeOk: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 12 },
  badgePend: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 12 },
  badgeRestr: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 12 },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  chip: { fontSize: 12.5, fontWeight: 700, padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' },
  chipOn: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.35)' },
  linhas: { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  lbl: { color: 'rgba(255,255,255,0.5)' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
}
