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
  status: 'nao_iniciado' | 'pendente' | 'em_analise' | 'ativo' | 'restrito'
  charges_enabled: boolean
  payouts_enabled: boolean
  repasse_prazo: PrazoRepasse
  frete_cents: number
  frete_gratis_acima_cents: number | null
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
  const [freteTxt, setFreteTxt] = useState('')
  const [gratisTxt, setGratisTxt] = useState('')
  const [salvandoFrete, setSalvandoFrete] = useState(false)
  const [freteOk, setFreteOk] = useState(false)

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
      setFreteTxt(j.frete_cents ? (j.frete_cents / 100).toFixed(2).replace('.', ',') : '')
      setGratisTxt(j.frete_gratis_acima_cents ? (j.frete_gratis_acima_cents / 100).toFixed(2).replace('.', ',') : '')
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
    setErro(null)
    const antes = info.repasse_prazo
    setInfo({ ...info, repasse_prazo: p }) // otimista
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/connect`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repasse_prazo: p }),
      })
      const j = await r.json().catch(() => null)
      // 409 = a Stripe recusou o prazo (ex: piso de 30 dias pra conta nova).
      // A rota NAO grava nesse caso, entao desfazemos o otimista e explicamos.
      if (!r.ok) throw new Error(j?.error || 'Não consegui salvar o prazo. Tente de novo.')
    } catch (e) {
      setInfo(prev => (prev ? { ...prev, repasse_prazo: antes } : prev))
      setErro((e as Error).message)
    } finally {
      setSalvandoPrazo(false)
    }
  }

  // "18,50" / "18.50" / "" -> centavos. String vazia = 0 (frete gratis).
  function paraCentavos(txt: string): number | null {
    const limpo = txt.trim().replace(/[^0-9,.]/g, '').replace(',', '.')
    if (!limpo) return 0
    const n = Number(limpo)
    if (!Number.isFinite(n) || n < 0) return null
    return Math.round(n * 100)
  }

  async function salvarFrete() {
    const f = paraCentavos(freteTxt)
    const g = gratisTxt.trim() ? paraCentavos(gratisTxt) : null
    if (f === null || (gratisTxt.trim() && (g === null || g <= 0))) {
      setErro('Valor de frete inválido. Use algo como 18,50.')
      return
    }
    setSalvandoFrete(true)
    setErro(null)
    setFreteOk(false)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/connect`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ frete_cents: f, frete_gratis_acima_cents: g }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Não consegui salvar o frete.')
      setInfo(prev => (prev ? { ...prev, frete_cents: f, frete_gratis_acima_cents: g } : prev))
      setFreteOk(true)
      setTimeout(() => setFreteOk(false), 2500)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvandoFrete(false)
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
            {status === 'em_analise' ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={S.icone}>🔎</div>
                <span style={S.badgeAnalise}>Em análise pela Stripe</span>
                <p style={S.txt}>
                  Seus dados foram enviados e estão sendo conferidos pela Stripe. <b>Você não precisa
                  fazer nada</b> — normalmente leva de alguns minutos a 1 dia útil. Avisamos assim que
                  seus recebimentos forem liberados.
                </p>
              </div>
            ) : status === 'ativo' ? (
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
                  Ative os recebimentos e venda direto na sua vitrine: cartas, selados, acessórios e
                  o que mais você quiser. O dinheiro cai na sua conta bancária e seus dados ficam
                  seguros com a Stripe, a Bynx nunca vê.
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
            <p style={S.mini}>
              Contas novas começam com repasse em 30 dias — é uma regra da Stripe, não da Bynx.
              Conforme sua loja cria histórico de vendas, o prazo de 14 dias pode ser liberado.
            </p>

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

          {/* ─── Frete ────────────────────────────────────────── */}
          <div style={{ ...SH.card, marginTop: 16 }}>
            <h2 style={S.h3}>Frete</h2>
            <p style={S.sub}>Valor fixo cobrado do comprador por pedido. Ele vai 100% pra você — a Bynx não cobra comissão sobre frete.</p>

            <div style={S.freteGrid}>
              <div>
                <label style={S.lbl2}>Frete fixo</label>
                <div style={S.inputWrap}>
                  <span style={S.prefixo}>R$</span>
                  <input
                    value={freteTxt}
                    onChange={e => setFreteTxt(e.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    style={S.input}
                  />
                </div>
                <p style={S.hint}>Deixe 0 para frete grátis</p>
              </div>
              <div>
                <label style={S.lbl2}>Frete grátis acima de</label>
                <div style={S.inputWrap}>
                  <span style={S.prefixo}>R$</span>
                  <input
                    value={gratisTxt}
                    onChange={e => setGratisTxt(e.target.value)}
                    placeholder="opcional"
                    inputMode="decimal"
                    style={S.input}
                  />
                </div>
                <p style={S.hint}>Vazio = sem regra</p>
              </div>
            </div>

            <button onClick={salvarFrete} disabled={salvandoFrete} style={{ ...SH.btnPrimary, width: '100%', marginTop: 14, opacity: salvandoFrete ? 0.6 : 1 }}>
              {salvandoFrete ? 'Salvando…' : freteOk ? '✓ Frete salvo!' : 'Salvar frete'}
            </button>

            {info && (
              <p style={S.previa}>
                {info.frete_cents === 0
                  ? '🚚 Seus compradores não pagam frete.'
                  : info.frete_gratis_acima_cents
                    ? `🚚 ${fmtBRL(info.frete_cents)} de frete — grátis em compras acima de ${fmtBRL(info.frete_gratis_acima_cents)}.`
                    : `🚚 ${fmtBRL(info.frete_cents)} de frete em todos os pedidos.`}
              </p>
            )}
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
  badgeAnalise: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 20, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', marginBottom: 12 },
  badgePend: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 20, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 12 },
  badgeRestr: { display: 'inline-block', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', marginBottom: 12 },
  freteGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  lbl2: { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  inputWrap: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0 10px' },
  prefixo: { fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginRight: 6 },
  input: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#f0f0f0', fontSize: 14, fontWeight: 600, padding: '10px 0' },
  hint: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 5 },
  previa: { fontSize: 12.5, color: '#22c55e', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 9, padding: '9px 12px', marginTop: 12, textAlign: 'center' },
  chips: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  chip: { fontSize: 12.5, fontWeight: 700, padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' },
  chipOn: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.35)' },
  linhas: { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  lbl: { color: 'rgba(255,255,255,0.5)' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
}
