'use client'

// /paginas-lendarias — o fichario lendario (fundo continuo).
//
// Tela: FicharioLendario (folhear, comprar, compartilhar).
// Impressao: a folha A4 fica montada escondida (mesmo padrao do master set) —
// window.print() imprime a arte em pagina cheia com linhas de recorte no
// tamanho do bolso 63x88mm, so das paginas liberadas. E o groundwork do
// piloto fisico: a mesma folha que a pessoa imprime em casa e a que uma loja
// parceira imprime em couche pra vender no marketplace.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabaseClient'
import FicharioLendario, { PaginaLend } from '@/components/paginas-lendarias/FicharioLendario'

const GRAD = 'linear-gradient(135deg,#f59e0b,#ef4444)'

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function PaginasLendariasPage() {
  const router = useRouter()
  const [paginas, setPaginas] = useState<PaginaLend[]>([])
  const [pacote, setPacote] = useState(false)
  const [viaAnual, setViaAnual] = useState(false)
  const [logado, setLogado] = useState(false)
  const [precoAvulsa, setPrecoAvulsa] = useState(12.9)
  const [precoPacote, setPrecoPacote] = useState(79.9)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [comprando, setComprando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState<PaginaLend | null>(null)

  const fetchSheet = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      // ?preview_artes=1 repassado pra API: modo de revisao de arte, dev-only
      // (a API ignora em producao).
      const preview = typeof window !== 'undefined' && window.location.search.includes('preview_artes=1')
      const res = await fetch(`/api/paginas-lendarias/sheet${preview ? '?preview_artes=1' : ''}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const json = await res.json()
      if (!res.ok) { setErro(json.error || 'Erro ao carregar.'); setLoading(false); return false }
      setPaginas(json.paginas || [])
      setPacote(!!json.pacote)
      setViaAnual(!!json.via_anual)
      setLogado(!!json.logado)
      if (json.preco_avulsa) setPrecoAvulsa(json.preco_avulsa)
      if (json.preco_pacote) setPrecoPacote(json.preco_pacote)
      setLoading(false)
      return (json.paginas || []).some((p: PaginaLend) => !p.liberada)
    } catch {
      setErro('Erro ao carregar o fichário.')
      setLoading(false)
      return false
    }
  }, [])

  useEffect(() => {
    let veioDoStripe = false
    if (typeof window !== 'undefined' && window.location.search.includes('desbloqueado=1')) {
      veioDoStripe = true
      setSucesso(true)
    }
    ;(async () => {
      const aindaBloqueado = await fetchSheet()
      // O webhook pode chegar depois do redirect: tenta de novo em 2,5s.
      if (veioDoStripe && aindaBloqueado) {
        setTimeout(() => { fetchSheet() }, 2500)
      }
    })()
  }, [fetchSheet])

  async function checkout(body: Record<string, string>) {
    setComprando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push('/'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.url) { window.location.href = json.url; return }
      if (json.code === 'ALREADY_OWNED' || json.code === 'INCLUDED_ANNUAL') { fetchSheet(); setComprando(false); return }
      alert(json.error || 'Não foi possível iniciar a compra.')
    } catch {
      alert('Erro ao iniciar a compra.')
    }
    setComprando(false)
  }

  const comprarPagina = (paginaId: string) => checkout({ plano: 'pagina_lendaria', paginaId })
  const comprarPacote = () => checkout({ plano: 'colecao_lendaria' })
  const assinarAnual = () => checkout({ plano: 'anual' })

  const liberadas = useMemo(() => paginas.filter(p => p.liberada), [paginas])

  return (
    <AppLayout>
      <style>{`
        @media print {
          .no-print, .tcg-sidebar, .tcg-header, .tcg-bottom-nav, .tcg-switchbar,
          footer, header, nav, aside { display: none !important; }

          .plp-print { display: block !important; }

          html, body {
            background: white !important;
            margin: 0 !important; padding: 0 !important;
            width: 210mm !important;
            overflow: visible !important;
          }
          .tcg-root, .tcg-main-col, .tcg-content {
            display: block !important;
            width: 210mm !important;
            max-width: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .tcg-content > div {
            max-width: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 210mm !important;
          }

          .plp-sheet {
            width: 210mm !important;
            height: 296mm !important;
            page-break-after: always !important;
            break-after: page !important;
            position: relative !important;
            overflow: hidden !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .plp-sheet:last-child { page-break-after: auto !important; break-after: auto !important; }
          .plp-sheet, .plp-sheet * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          .plp-blocked * { display: none !important; }
          .plp-blocked::before {
            display: block !important;
            content: 'Desbloqueie uma Pagina Lendaria em bynx.gg para imprimir a folha.';
            font-size: 14pt; text-align: center; margin-top: 120mm; color: #000;
          }
        }
        @page { size: A4 portrait; margin: 0; }

        /* Folha A4 na tela: escondida — quem manda e o @media print acima. */
        .plp-print { display: none; }
        .plp-fundo-eco { position: absolute; inset: -12%; background-size: cover; background-position: center 20%;
          filter: blur(28px) saturate(1.4) brightness(0.85); transform: scale(1.28); }
        .plp-fundo-arte { position: absolute; inset: 0; background-size: cover; background-position: center; }
        .plp-corte { position: absolute; border: 0.4mm dashed rgba(255,255,255,0.85); border-radius: 2mm;
          box-shadow: 0 0 0 0.4mm rgba(0,0,0,0.25); }
        .plp-corte span { position: absolute; top: 1.5mm; left: 2mm; font-size: 7pt; font-weight: 700;
          color: rgba(255,255,255,0.9); text-shadow: 0 0 2mm rgba(0,0,0,0.8); }
        .plp-rodape { position: absolute; left: 0; right: 0; bottom: 2.5mm; text-align: center;
          font-size: 7.5pt; color: rgba(255,255,255,0.95); text-shadow: 0 0 2mm rgba(0,0,0,0.9); }
      `}</style>

      {/* Padding lateral zero: quem da a margem e o .tcg-content do AppLayout. */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 0 80px' }}>
        <div className="no-print">
          <PageHeader
            trilha={[INICIO, { name: 'Páginas Lendárias', href: '/paginas-lendarias' }]}
            titulo="Páginas Lendárias"
            descricao="A arte da carta se estende pela página inteira do fichário."
            stat={loading ? undefined : `${paginas.length} páginas · ${liberadas.length} liberada${liberadas.length === 1 ? '' : 's'}`}
          />

          <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '-10px 0 20px', lineHeight: 1.5 }}>
            {paginas.length > 0 ? `${paginas.length} páginas` : 'Páginas'} com as cartas mais desejadas do mercado, cada uma com fundo contínuo no fichário virtual. A primeira página é grátis — folheie, compartilhe no Instagram e imprima em A4 com linhas de recorte pra levar pro fichário físico.
          </p>

          {sucesso && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 12, padding: '12px 16px', marginBottom: 18, color: '#22c55e', fontSize: 14 }}>
              <strong>Desbloqueado!</strong> Sua página já está liberada no fichário.
            </div>
          )}

          {!loading && !pacote && (
            <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: 'clamp(16px,4vw,28px) clamp(16px,4vw,32px)', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <p style={{ fontSize: 'clamp(15px,4vw,18px)', fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M16.5 12.2A7 7 0 018.3 3.6a7 7 0 108.2 8.6z" stroke="#f59e0b" strokeWidth="1.4" strokeLinejoin="round" /><path d="M14.5 4.5v3M13 6h3" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round" /></svg>
                  Coleção Lendária — todas as páginas
                </p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                  Leve as <strong style={{ color: '#f59e0b' }}>{paginas.length} páginas por {fmtBRL(precoPacote)}</strong>, vitalício e com as novas páginas do trimestre inclusas. Ou compre avulsa por <strong style={{ color: '#f59e0b' }}>{fmtBRL(precoAvulsa)}</strong>. No plano anual, tudo já vem incluso.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                <button onClick={comprarPacote} disabled={comprando} style={{ background: GRAD, border: 'none', borderRadius: 12, padding: '14px 28px', color: '#000', fontWeight: 800, fontSize: 15, cursor: comprando ? 'wait' : 'pointer', opacity: comprando ? 0.7 : 1 }}>
                  {comprando ? 'Aguarde...' : `Desbloquear tudo por ${fmtBRL(precoPacote)}`}
                </button>
                <button onClick={assinarAnual} style={{ background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 12, padding: '10px 28px', color: '#fbbf24', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                  Ou libere no plano anual
                </button>
              </div>
            </div>
          )}

          {!loading && pacote && (
            <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '10px 16px', marginBottom: 18, fontSize: 13, color: 'var(--bx-text-2)' }}>
              <strong style={{ color: '#fbbf24' }}>Coleção Lendária ativa</strong>
              {viaAnual ? ' — inclusa no seu plano anual.' : ' — todas as páginas liberadas, pra sempre.'}
            </div>
          )}

          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 60 }}>Carregando...</div>
          ) : erro ? (
            <div style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 60 }}>{erro}</div>
          ) : (
            <FicharioLendario
              paginas={paginas}
              precoAvulsa={precoAvulsa}
              precoPacote={precoPacote}
              onComprar={logado ? comprarPagina : () => router.push('/')}
              onComprarPacote={logado ? comprarPacote : () => router.push('/')}
              onPagina={setPaginaAtual}
              comprando={comprando}
            />
          )}
        </div>

        {/* Folha A4 (so imprime; na tela fica display:none). Imprime SO a
            pagina ABERTA no fichario — imprimir todas as liberadas de uma vez
            gerava dezenas de folhas e paginas em branco intercaladas (achado
            do Du na compra de teste). Bolso padrao 3x3 de 63x88mm; a pessoa
            recorta as 9 pecas e a carta real entra por cima da arte. */}
        <div className={`plp-print${!paginaAtual || !paginaAtual.liberada ? ' plp-blocked' : ''}`}>
          {(paginaAtual && paginaAtual.liberada ? [paginaAtual] : []).map(p => {
            const heroi = p.cartas.find(c => c.heroi) || p.cartas[0]
            const fundo = p.arte_url || heroi?.image_large || heroi?.image_small
            // Grade centrada: 3x63 + 2x3 = 195mm em 210 -> margem 7.5mm;
            // 3x88 + 2x3 = 270mm no topo 12mm.
            const cortes = Array.from({ length: 9 }).map((_, s) => ({
              left: 7.5 + (s % 3) * 66,
              top: 12 + Math.floor(s / 3) * 91,
              heroi: !!(heroi && p.cartas.find(c => c.slot === s && c.heroi)),
            }))
            return (
              <div key={p.id} className="plp-sheet">
                {fundo && (p.arte_url
                  ? <div className="plp-fundo-arte" style={{ backgroundImage: `url("${fundo}")` }} />
                  : <div className="plp-fundo-eco" style={{ backgroundImage: `url("${fundo}")` }} />)}
                {cortes.map((c, i) => (
                  <div key={i} className="plp-corte" style={{ left: `${c.left}mm`, top: `${c.top}mm`, width: '63mm', height: '88mm' }}>
                    {c.heroi && <span>bolso da carta</span>}
                  </div>
                ))}
                <div className="plp-rodape">
                  bynx.gg · Página Lendária — {p.nome} · recorte nas linhas tracejadas · bolso 63x88mm · imprimir A4, sem margens, escala 100%
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppLayout>
  )
}
