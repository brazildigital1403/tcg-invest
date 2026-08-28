'use client'

/**
 * /parceiros — Central do Parceiro.
 *
 * Fora do menu; acesso por link direto. Autenticada.
 * Se deslogado, redireciona pro login com next=/parceiros.
 * Se logado mas não-parceiro (404 not_partner), mostra tela restrita.
 *
 * Mostra:
 *   - Cupom do parceiro (código + copiar + desconto + comissão)
 *   - Ciclo atual (assinantes pelo cupom + a receber no fechamento)
 *   - Conversões do ciclo (sem nenhum dado do assinante — LGPD)
 *   - Fechamentos anteriores (período, total, status)
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import { IconCheck, IconTag } from '@/components/ui/Icons'

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface Parceiro {
  nome: string
  cupom: string
  descontoPct: number
  comissaoPrimeiraPct: number
  comissaoRenovacaoPct: number
  recorrenteMeses: number
  ativo: boolean
  desde: string
}

interface Conversao {
  tipo: 'venda' | 'renovacao' | 'estorno' | 'ajuste'
  plano: string
  valor_base_cents: number
  comissao_cents: number
  criado_em: string
}

interface CicloAtual {
  somaPendenteCents: number
  assinantes: number
  conversoes: Conversao[]
}

interface Fechamento {
  periodo_inicio: string
  periodo_fim: string
  total_comissao_cents: number
  qtd_linhas: number
  status: 'fechado' | 'pago'
  pago_em: string | null
  criado_em: string
}

interface MeData {
  ok: boolean
  parceiro: Parceiro
  cicloAtual: CicloAtual
  fechamentos: Fechamento[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<Conversao['tipo'], string> = {
  venda: 'venda',
  renovacao: 'renovação',
  estorno: 'estorno',
  ajuste: 'ajuste',
}

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDiaMes(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

// ─── Componente ────────────────────────────────────────────────────────────

export default function ParceirosPage() {
  const router = useRouter()
  const [data, setData] = useState<MeData | null>(null)
  const [notPartner, setNotPartner] = useState(false)
  const [erro, setErro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // ── Auth + fetch dados ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          router.replace('/?auth=login&next=/parceiros')
          return
        }
        const res = await fetch('/api/parceiros/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })
        if (!mounted) return
        if (res.status === 401) {
          router.replace('/?auth=login&next=/parceiros')
          return
        }
        if (res.status === 404) {
          setNotPartner(true)
          return
        }
        // 404 = nao e parceiro; qualquer outra falha e ERRO (banco instavel,
        // migration pendente) — dizer "area restrita" pra um parceiro real
        // seria mensagem errada ("perdi minha parceria?").
        if (!res.ok) {
          setErro(true)
          return
        }
        const json = await res.json()
        if (!mounted) return
        if (json?.ok) setData(json)
        else setErro(true)
      } catch (err) {
        console.error('[parceiros] fetch err:', err)
        if (mounted) setErro(true)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [router])

  // ── Copiar cupom ─────────────────────────────────────────────────────
  async function copiarCupom() {
    if (!data?.parceiro?.cupom) return
    try {
      await navigator.clipboard.writeText(data.parceiro.cupom)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível: sem feedback, o código está visível na tela
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div style={S.container}>
        {loading && <div style={S.loading}>Carregando…</div>}

        {!loading && erro && (
          <div style={S.restrictedBox}>
            <div style={S.restrictedIcon}><IconTag size={28} color="var(--bx-text-3)" /></div>
            <h1 style={S.restrictedTitle}>Não conseguimos carregar seus dados</h1>
            <p style={S.restrictedText}>
              Deu algo errado do nosso lado. Tenta de novo em instantes.
            </p>
            <button onClick={() => window.location.reload()} style={{ ...S.restrictedLink, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>Tentar de novo</button>
          </div>
        )}

        {!loading && !erro && notPartner && (
          <div style={S.restrictedBox}>
            <div style={S.restrictedIcon}><IconTag size={28} color="var(--bx-text-3)" /></div>
            <h1 style={S.restrictedTitle}>Esta área é restrita a parceiros da Bynx</h1>
            <p style={S.restrictedText}>
              Se você acha que deveria ter acesso, fala com a gente.
            </p>
            <Link href="/" style={S.restrictedLink}>Voltar pra home</Link>
          </div>
        )}

        {!loading && !notPartner && data && (
          <>
            {/* Header */}
            <header style={S.header}>
              <h1 style={S.headerTitle}>Central do Parceiro</h1>
              <p style={S.headerSubtitle}>Olá, {data.parceiro.nome}. Aqui está o resumo do seu cupom.</p>
            </header>

            {/* Card do cupom (hero) */}
            <section style={S.couponCard}>
              <div style={S.couponTopRow}>
                <div style={S.couponLabel}>Seu cupom</div>
                {!data.parceiro.ativo && (
                  <span style={S.pausedChip}>cupom pausado</span>
                )}
              </div>
              <div style={S.couponCode}>{data.parceiro.cupom}</div>
              <button onClick={copiarCupom} style={S.copyBtn}>
                {copied
                  ? <><IconCheck size={16} color="var(--bx-green)" /> Copiado</>
                  : 'Copiar código'}
              </button>
              <div style={S.couponLines}>
                <div style={S.couponLine}>
                  {data.parceiro.descontoPct}% pro seu público na 1ª cobrança
                </div>
                <div style={S.couponLine}>
                  Sua comissão: <strong style={S.couponStrong}>{data.parceiro.comissaoPrimeiraPct}% da 1ª cobrança</strong>
                  {' + '}
                  <strong style={S.couponStrong}>{data.parceiro.comissaoRenovacaoPct}% das renovações</strong>
                  {' por '}{data.parceiro.recorrenteMeses} meses
                </div>
              </div>
            </section>

            {/* Ciclo atual — stats */}
            <section style={S.statsGrid}>
              <div style={S.statCard}>
                <div style={S.statValue}>{data.cicloAtual.assinantes}</div>
                <div style={S.statLabel}>assinantes pelo cupom</div>
              </div>
              <div style={S.statCard}>
                <div style={{ ...S.statValue, color: 'var(--bx-green)' }}>
                  {fmtBRL(data.cicloAtual.somaPendenteCents)}
                </div>
                <div style={S.statLabel}>a receber no fechamento</div>
              </div>
            </section>

            {/* Conversões do ciclo */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>Conversões do ciclo</h2>
              {data.cicloAtual.conversoes.length === 0 ? (
                <div style={S.emptyBox}>
                  Suas vendas aparecem aqui. Divulga teu cupom que a gente cuida do resto.
                </div>
              ) : (
                <div style={S.list}>
                  {data.cicloAtual.conversoes.map((c, i) => {
                    const negativa = c.comissao_cents < 0
                    return (
                      <div
                        key={`${c.criado_em}-${i}`}
                        style={{
                          ...S.listRow,
                          borderBottom: i === data.cicloAtual.conversoes.length - 1
                            ? 'none'
                            : '1px solid var(--bx-border)',
                        }}
                      >
                        <div style={S.listRowLeft}>
                          <span style={S.listDate}>{fmtDiaMes(c.criado_em)}</span>
                          <span style={S.listPlano}>{c.plano}</span>
                          <span style={S.listTipo}>{TIPO_LABEL[c.tipo]}</span>
                        </div>
                        <div style={{
                          ...S.listValue,
                          color: negativa ? 'var(--bx-red)' : 'var(--bx-green)',
                        }}>
                          {fmtBRL(c.comissao_cents)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Fechamentos anteriores */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>Fechamentos anteriores</h2>
              {data.fechamentos.length === 0 ? (
                <div style={S.emptyBox}>
                  Seu primeiro fechamento aparece aqui no fim do ciclo.
                </div>
              ) : (
                <div style={S.list}>
                  {data.fechamentos.map((f, i) => (
                    <div
                      key={`${f.periodo_inicio}-${i}`}
                      style={{
                        ...S.listRow,
                        borderBottom: i === data.fechamentos.length - 1
                          ? 'none'
                          : '1px solid var(--bx-border)',
                      }}
                    >
                      <div style={S.fechLeft}>
                        <div style={S.fechPeriodo}>
                          {fmtData(f.periodo_inicio)} – {fmtData(f.periodo_fim)}
                        </div>
                        <div style={S.fechMeta}>
                          {f.qtd_linhas} {f.qtd_linhas === 1 ? 'lançamento' : 'lançamentos'}
                        </div>
                      </div>
                      <div style={S.fechRight}>
                        <div style={S.fechTotal}>{fmtBRL(f.total_comissao_cents)}</div>
                        {f.status === 'pago' ? (
                          <span style={S.chipPago}>
                            <IconCheck size={11} color="var(--bx-green)" />
                            {' '}Pago{f.pago_em ? ` em ${fmtData(f.pago_em)}` : ''}
                          </span>
                        ) : (
                          <span style={S.chipFechado}>Fechado</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Rodapé de regras */}
            <footer style={S.rulesFooter}>
              Comissão sobre cobrança liquidada há 30+ dias. Estorno desconta do saldo.
              Fechamento mensal, pagamento via Pix. Saldo menor que R$ 50 acumula pro
              próximo ciclo.
            </footer>
          </>
        )}
      </div>
    </AppLayout>
  )
}

// ─── Estilos ───────────────────────────────────────────────────────────────
// Dentro do AppLayout: sem padding lateral próprio (o .tcg-content já dá 16/24px).

const S: Record<string, CSSProperties> = {
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '8px 0 80px',
    color: 'var(--bx-text)',
  },

  loading: { padding: 60, textAlign: 'center', color: 'var(--bx-text-3)' },

  // Não-parceiro
  restrictedBox: {
    maxWidth: 420,
    margin: '48px auto 0',
    textAlign: 'center',
    background: 'var(--bx-surface)',
    border: '1px solid var(--bx-border)',
    borderRadius: 12,
    padding: '36px 24px',
  },
  restrictedIcon: { display: 'flex', justifyContent: 'center', marginBottom: 14 },
  restrictedTitle: { fontSize: 18, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 },
  restrictedText: { fontSize: 14, color: 'var(--bx-text-2)', marginBottom: 20, lineHeight: 1.5 },
  restrictedLink: {
    display: 'inline-block',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ac-1)',
    textDecoration: 'none',
  },

  // Header
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.5 },

  // Cupom (hero)
  couponCard: {
    background: 'var(--bx-surface)',
    border: '1px solid rgba(var(--ac-1-rgb), 0.35)',
    borderRadius: 16,
    padding: '22px 20px',
    marginBottom: 20,
    textAlign: 'center',
  },
  couponTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  couponLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--bx-text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  pausedChip: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--bx-text-3)',
    border: '1px solid var(--bx-border)',
    borderRadius: 999,
    padding: '2px 10px',
  },
  couponCode: {
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: '0.12em',
    background: 'var(--ac-grad)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.15,
    marginBottom: 14,
    wordBreak: 'break-all',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: 'rgba(var(--ac-1-rgb), 0.12)',
    border: '1px solid rgba(var(--ac-1-rgb), 0.35)',
    color: 'var(--bx-text)',
    padding: '10px 20px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease, border-color 0.15s ease',
    marginBottom: 16,
  },
  couponLines: {
    borderTop: '1px solid var(--bx-border)',
    paddingTop: 14,
    display: 'grid',
    gap: 6,
  },
  couponLine: { fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5 },
  couponStrong: { color: 'var(--bx-text)', fontWeight: 600 },

  // Stats do ciclo
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    background: 'var(--bx-surface)',
    border: '1px solid var(--bx-border)',
    borderRadius: 12,
    padding: '18px 14px',
    textAlign: 'center',
  },
  statValue: { fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginBottom: 6 },
  statLabel: { fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.4 },

  // Seções
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12, letterSpacing: '-0.01em' },

  // Listas
  list: {
    background: 'var(--bx-surface)',
    border: '1px solid var(--bx-border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  listRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
  },
  listRowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  listDate: { fontSize: 12, color: 'var(--bx-text-3)', flexShrink: 0 },
  listPlano: { fontSize: 14, fontWeight: 600 },
  listTipo: { fontSize: 12, color: 'var(--bx-text-2)' },
  listValue: { fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' },

  // Fechamentos
  fechLeft: { minWidth: 0 },
  fechPeriodo: { fontSize: 13, fontWeight: 600, marginBottom: 2 },
  fechMeta: { fontSize: 12, color: 'var(--bx-text-3)' },
  fechRight: { textAlign: 'right', flexShrink: 0 },
  fechTotal: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  chipPago: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--bx-green)',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 999,
    padding: '2px 10px',
    whiteSpace: 'nowrap',
  },
  chipFechado: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--ac-1)',
    background: 'rgba(var(--ac-1-rgb), 0.12)',
    border: '1px solid rgba(var(--ac-1-rgb), 0.3)',
    borderRadius: 999,
    padding: '2px 10px',
    whiteSpace: 'nowrap',
  },

  // Estado vazio
  emptyBox: {
    background: 'var(--bx-surface)',
    border: '1px dashed var(--bx-border-2)',
    borderRadius: 12,
    padding: '28px 20px',
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--bx-text-2)',
    lineHeight: 1.5,
  },

  // Regras
  rulesFooter: {
    fontSize: 12,
    color: 'var(--bx-text-3)',
    lineHeight: 1.6,
    borderTop: '1px solid var(--bx-border)',
    paddingTop: 16,
  },
}
