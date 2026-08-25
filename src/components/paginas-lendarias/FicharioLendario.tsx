'use client'

/**
 * FicharioLendario — o fichario das Paginas Lendarias (fundo continuo).
 *
 * A arte da carta-heroi se estende pela pagina inteira do fichario 3x3.
 * Nivel 1 (hoje): o fundo e gerado da propria imagem da carta — duas camadas
 * ampliadas e desfocadas + vinheta, custo marginal zero. Nivel 2: quando a
 * pagina tem arte curada (arte_url no catalogo), ela substitui o eco.
 *
 * O que separa isto do concorrente (estudo 15/08/2026):
 * 1. Ancora na carta real: preco BRL e "voce tem" dentro do bolso — a Bynx
 *    precifica 69k cartas, o concorrente vende arte solta sem set/numero.
 * 2. Preview de verdade: a pagina e esta tela, nao uma foto estatica.
 * 3. Compartilhar: gera a imagem da pagina em 1080x1350 pro Instagram.
 * 4. Imprimir: folha A4 com linhas de recorte (bolso 63x88mm) pra levar o
 *    fundo continuo pro fichario FISICO.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'

export interface CartaLend {
  card_id: string
  slot: number
  heroi: boolean
  nome: string
  numero: string
  set_name: string
  image_small: string | null
  image_large: string | null
  preco: number | null
  owned: boolean
}

export interface PaginaLend {
  id: string
  nome: string
  sub: string
  ordem: number
  gratis: boolean
  arte_url: string | null
  liberada: boolean
  cartas: CartaLend[]
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function heroiDe(p: PaginaLend): CartaLend | null {
  return p.cartas.find(c => c.heroi) || p.cartas[0] || null
}

function fundoDe(p: PaginaLend): string | null {
  const h = heroiDe(p)
  return p.arte_url || h?.image_large || h?.image_small || null
}

// ─── Canvas: imagem de compartilhamento (1080x1350, retrato de feed) ────────

/**
 * images.pokemontcg.io NAO manda header CORS (testado 15/08/2026): carregar
 * direto com crossOrigin taintaria o canvas e o toBlob falharia. O host esta
 * no images.remotePatterns do next.config, entao o otimizador do Next serve
 * a MESMA imagem em same-origin — canvas limpo sem depender do host.
 * q=75 e o unico quality permitido por padrao no Next 16; w=1080 esta nos
 * deviceSizes default.
 */
function proxied(url: string): string {
  if (!/^https?:\/\//.test(url)) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=1080&q=75`
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('img'))
    img.src = proxied(url)
  })
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const ir = img.width / img.height
  const r = w / h
  let sw = img.width, sh = img.height, sx = 0, sy = 0
  if (ir > r) { sw = img.height * r; sx = (img.width - sw) / 2 }
  else { sh = img.width / r; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

async function gerarImagemPagina(p: PaginaLend): Promise<Blob> {
  const W = 1080, H = 1350
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('canvas')

  const bgUrl = fundoDe(p)
  if (!bgUrl) throw new Error('sem imagem')
  const bg = await loadImg(bgUrl)

  // Fundo: eco ampliado e desfocado da arte (nivel 1) ou a arte curada
  ctx.fillStyle = '#0f0d0a'
  ctx.fillRect(0, 0, W, H)
  ctx.filter = p.arte_url ? 'saturate(1.05)' : 'blur(60px) saturate(1.45) brightness(0.78)'
  drawCover(ctx, bg, -W * 0.15, -H * 0.15, W * 1.3, H * 1.3)
  ctx.filter = 'none'

  // Vinheta
  const rad = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.16, W / 2, H * 0.44, H * 0.78)
  rad.addColorStop(0, 'rgba(8,6,4,0)')
  rad.addColorStop(1, 'rgba(8,6,4,0.78)')
  ctx.fillStyle = rad
  ctx.fillRect(0, 0, W, H)

  // Grade 3x3
  const gap = 16, mx = 84, topo = 168
  const cw = (W - mx * 2 - gap * 2) / 3
  const ch = cw * 88 / 63
  const porSlot = new Map(p.cartas.map(c => [c.slot, c]))
  for (let s = 0; s < 9; s++) {
    const x = mx + (s % 3) * (cw + gap)
    const y = topo + Math.floor(s / 3) * (ch + gap)
    const carta = porSlot.get(s)
    roundRectPath(ctx, x, y, cw, ch, 14)
    if (carta?.image_small || carta?.image_large) {
      ctx.save()
      ctx.clip()
      try {
        const ci = await loadImg((carta.image_large || carta.image_small) as string)
        drawCover(ctx, ci, x, y, cw, ch)
      } catch {
        ctx.fillStyle = 'rgba(10,8,6,0.4)'
        ctx.fillRect(x, y, cw, ch)
      }
      ctx.restore()
      roundRectPath(ctx, x, y, cw, ch, 14)
      ctx.lineWidth = carta.heroi ? 5 : 2.5
      ctx.strokeStyle = carta.heroi ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)'
      ctx.stroke()
    } else {
      ctx.fillStyle = 'rgba(12,10,8,0.32)'
      ctx.fill()
      roundRectPath(ctx, x, y, cw, ch, 14)
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.stroke()
    }
  }

  // Titulo e marca
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(251,191,36,0.95)'
  ctx.font = '800 30px ui-sans-serif, system-ui, sans-serif'
  const label = 'PAGINA LENDARIA'
  ctx.save()
  ctx.translate(mx, 96)
  ctx.fillText(label.split('').join(' '), 0, 0)
  ctx.restore()
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 58px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(p.nome, mx, 152, W - mx * 2)

  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('bynx.gg', mx, H - 62)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '600 24px ui-sans-serif, system-ui, sans-serif'
  const sub = p.sub
  const subW = ctx.measureText(sub).width
  ctx.fillText(sub, W - mx - subW, H - 62)

  return await new Promise<Blob>((resolve, reject) => {
    cv.toBlob(b => (b ? resolve(b) : reject(new Error('blob'))), 'image/png')
  })
}

// ─── Bolso ──────────────────────────────────────────────────────────────────

function BolsoLend({ carta }: { carta: CartaLend | null }) {
  const [erro, setErro] = useState(false)
  if (!carta) return <div className="pl-bolso pl-vazio" aria-hidden="true" />
  const mostra = !!carta.image_small && !erro
  return (
    <div className={`pl-bolso${carta.heroi ? ' pl-heroi' : ''}`} title={`${carta.nome} · ${carta.numero}`}>
      {mostra ? (
        <img src={carta.image_small as string} alt={carta.nome} loading="lazy" onError={() => setErro(true)} />
      ) : (
        <span className="pl-semimg">{carta.numero}</span>
      )}
      {carta.owned && (
        <span className="pl-check" aria-label="Você tem">
          <svg viewBox="0 0 20 20" fill="none" width="9" height="9"><path d="M4 10l4.5 4.5L16 6" stroke="#052e16" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
      {!carta.owned && <span className="pl-falta">falta</span>}
      {carta.preco != null && carta.preco > 0 && (
        <span className="pl-preco">{fmtBRL(carta.preco)}</span>
      )}
    </div>
  )
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function FicharioLendario({
  paginas,
  precoAvulsa,
  precoPacote,
  onComprar,
  onComprarPacote,
  onPagina,
  comprando,
}: {
  paginas: PaginaLend[]
  precoAvulsa: number
  precoPacote: number
  onComprar?: (paginaId: string) => void
  onComprarPacote?: () => void
  /** avisa a page qual pagina esta aberta — a impressao usa pra imprimir SO ela */
  onPagina?: (p: PaginaLend) => void
  comprando: boolean
}) {
  const [idx, setIdx] = useState(0)
  const [verTudo, setVerTudo] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const toqueX = useRef<number | null>(null)

  const pagina = paginas[idx] || null

  useEffect(() => { if (pagina) onPagina?.(pagina) }, [pagina, onPagina])

  const irPara = useCallback((n: number) => {
    setIdx(() => Math.max(0, Math.min(paginas.length - 1, n)))
  }, [paginas.length])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (verTudo) return
      if (e.key === 'ArrowRight') irPara(idx + 1)
      if (e.key === 'ArrowLeft') irPara(idx - 1)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [idx, irPara, verTudo])

  const faltando = useMemo(() => (pagina && pagina.liberada ? pagina.cartas.filter(c => !c.owned) : []), [pagina])
  const custoFechar = useMemo(() => faltando.reduce((s, c) => s + (c.preco || 0), 0), [faltando])

  async function compartilhar() {
    if (!pagina || !pagina.liberada || compartilhando) return
    setCompartilhando(true)
    try {
      const blob = await gerarImagemPagina(pagina)
      const file = new File([blob], `pagina-lendaria-${pagina.id}.png`, { type: 'image/png' })
      const nav: any = navigator
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: `Página Lendária — ${pagina.nome}`, text: 'Meu fichário na Bynx' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `pagina-lendaria-${pagina.id}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
      }
    } catch (e: any) {
      // AbortError = pessoa fechou o share sheet; silencio.
      if (e?.name !== 'AbortError') {
        alert('Não foi possível gerar a imagem agora. Tente de novo em instantes.')
      }
    }
    setCompartilhando(false)
  }

  function renderFolha(p: PaginaLend) {
    const fundo = fundoDe(p)
    const porSlot = new Map(p.cartas.map(c => [c.slot, c]))
    const curada = !!p.arte_url
    return (
      <div className="pl-folha">
        {fundo && (
          <div className="pl-fundo" aria-hidden="true">
            <div className={curada ? 'pl-arte' : 'pl-cam1'} style={{ backgroundImage: `url("${fundo}")` }} />
            {!curada && <div className="pl-cam2" style={{ backgroundImage: `url("${fundo}")` }} />}
            <div className="pl-vinheta" />
          </div>
        )}
        {p.liberada ? (
          <div className="pl-pagina">
            <div className="pl-grade">
              {Array.from({ length: 9 }).map((_, s) => <BolsoLend key={s} carta={porSlot.get(s) || null} />)}
            </div>
          </div>
        ) : (
          <div className="pl-trava">
            <svg viewBox="0 0 20 20" fill="none" width="26" height="26">
              <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="pl-trava-nome">{p.nome}</p>
            <p className="pl-trava-tema">{p.sub}</p>
            {onComprar && (
              <button className="pl-cta" disabled={comprando} onClick={() => onComprar(p.id)}>
                {comprando ? 'Aguarde...' : `Desbloquear por ${fmtBRL(precoAvulsa)}`}
              </button>
            )}
            {onComprarPacote && (
              <button className="pl-cta-sec" disabled={comprando} onClick={onComprarPacote}>
                Ou as {paginas.length} páginas por {fmtBRL(precoPacote)}
              </button>
            )}
          </div>
        )}
        <div className="pl-rodape-pg">
          <b>{p.nome}</b>
          <span>{p.sub}</span>
        </div>
      </div>
    )
  }

  if (!pagina) return null

  return (
    <div className="pl-root no-print">
      <style>{`
        .pl-root { --pl-couro: #1c1a17; --pl-couro-2: #2a2621; }
        .pl-barra { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
        .pl-acoes { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .pl-btn { display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12.5px; font-weight:600;
          color:var(--bx-text-2); background:var(--bx-surface); border:1px solid var(--bx-border);
          border-radius:10px; padding:8px 13px; cursor:pointer; transition:background .15s ease, color .15s ease; }
        .pl-btn:hover:not(:disabled) { background:var(--bx-surface-2); color:var(--bx-text); }
        .pl-btn:disabled { opacity:0.5; cursor:default; }
        .pl-contador { font-size:12px; color:var(--bx-text-3); font-variant-numeric:tabular-nums; }

        .pl-palco { position:relative; border-radius:16px; padding:22px 14px;
          background: radial-gradient(120% 90% at 50% 0%, rgba(245,158,11,0.05), transparent 60%),
                      linear-gradient(160deg, var(--pl-couro), var(--pl-couro-2));
          border:1px solid rgba(245,158,11,0.16);
          display:flex; align-items:center; justify-content:center; gap:10px; }

        .pl-folha { position:relative; width:100%; max-width:400px; border-radius:14px; overflow:hidden;
          border:1px solid rgba(245,158,11,0.35); box-shadow:0 22px 54px -18px rgba(0,0,0,0.75); }
        .pl-fundo { position:absolute; inset:0; }
        .pl-arte { position:absolute; inset:0; background-size:cover; background-position:center; }
        .pl-cam1 { position:absolute; inset:-14%; background-size:cover; background-position:center 18%;
          filter:blur(32px) saturate(1.45) brightness(0.8); transform:scale(1.3); }
        .pl-cam2 { position:absolute; inset:-4%; background-size:cover; background-position:center 12%;
          filter:blur(9px) saturate(1.25) brightness(0.62); opacity:0.7; mix-blend-mode:screen; }
        .pl-vinheta { position:absolute; inset:0; background:
          radial-gradient(120% 90% at 50% 42%, transparent 30%, rgba(8,6,4,0.72) 100%),
          linear-gradient(rgba(8,6,4,0.32), transparent 22% 70%, rgba(8,6,4,0.52)); }

        .pl-pagina { position:relative; z-index:2; padding:18px 16px 12px; }
        .pl-grade { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
        .pl-bolso { position:relative; aspect-ratio:63/88; border-radius:6px; overflow:hidden;
          border:1px solid rgba(255,255,255,0.24); background:rgba(10,8,6,0.30);
          box-shadow:inset 0 0 0 1px rgba(0,0,0,0.25), 0 4px 14px -4px rgba(0,0,0,0.5); }
        .pl-bolso img { width:100%; height:100%; object-fit:cover; display:block; }
        .pl-vazio { background:rgba(10,8,6,0.18); border-style:dashed; border-color:rgba(255,255,255,0.18);
          box-shadow:none; backdrop-filter:blur(1.5px); }
        .pl-heroi { border-color:rgba(255,255,255,0.6);
          box-shadow:0 0 0 1.5px rgba(255,255,255,0.3), 0 10px 26px -6px rgba(0,0,0,0.7); }
        .pl-semimg { position:absolute; inset:0; display:grid; place-items:center; font-size:12px; font-weight:800; color:rgba(255,255,255,0.35); }
        .pl-check { position:absolute; top:3px; right:3px; z-index:3; width:13px; height:13px; border-radius:50%;
          background:#22c55e; display:grid; place-items:center; }
        .pl-falta { position:absolute; left:0; right:0; top:0; z-index:2; font-size:7px; font-weight:800;
          letter-spacing:0.1em; text-transform:uppercase; text-align:center; padding:2.5px 0;
          color:rgba(255,255,255,0.6); background:rgba(0,0,0,0.5); }
        .pl-preco { position:absolute; left:0; right:0; bottom:0; z-index:2; font-size:8px; font-weight:800;
          text-align:center; padding:3px 1px; color:#fbbf24; font-variant-numeric:tabular-nums;
          background:linear-gradient(transparent, rgba(0,0,0,0.85) 55%); }

        /* A arte E o produto: quem ainda nao comprou precisa VER o que compra.
           O veu escurece so o miolo, onde ficam nome e CTA — as bordas ficam
           quase limpas pra arte aparecer. Blur baixo (2.5px) so pra tirar o
           detalhe fino, nunca a composicao. */
        .pl-trava { position:relative; z-index:2; min-height:380px; display:flex; flex-direction:column;
          align-items:center; justify-content:center; gap:10px; padding:26px 22px; text-align:center;
          color:rgba(255,255,255,0.85); backdrop-filter:blur(2.5px);
          background:radial-gradient(78% 52% at 50% 50%, rgba(8,6,4,0.62) 0%, rgba(8,6,4,0.34) 62%, rgba(8,6,4,0.12) 100%); }
        .pl-trava-nome { font-size:17px; font-weight:800; letter-spacing:-0.01em; margin:0; color:#fff; }
        .pl-trava-tema { font-size:12.5px; color:rgba(255,255,255,0.6); margin:0; max-width:300px; line-height:1.5; }
        .pl-cta { font:inherit; font-size:13.5px; font-weight:800; border:none; border-radius:11px; padding:11px 20px;
          margin-top:8px; background:linear-gradient(135deg,#f59e0b,#ef4444); color:#1a0e00; cursor:pointer; }
        .pl-cta:disabled { opacity:0.6; cursor:wait; }
        .pl-cta-sec { font:inherit; font-size:12px; font-weight:700; border-radius:10px; padding:9px 16px;
          background:transparent; border:1px solid rgba(245,158,11,0.45); color:#fbbf24; cursor:pointer; }
        .pl-cta-sec:disabled { opacity:0.6; cursor:wait; }

        .pl-rodape-pg { position:relative; z-index:2; display:flex; align-items:center; justify-content:space-between;
          gap:10px; padding:10px 16px 12px; font-size:11px; color:rgba(255,255,255,0.82);
          background:linear-gradient(transparent, rgba(8,6,4,0.55)); }
        .pl-rodape-pg b { font-weight:800; letter-spacing:0.05em; text-transform:uppercase; }
        .pl-rodape-pg span { color:rgba(255,255,255,0.55); }

        .pl-seta { width:34px; height:34px; border-radius:50%; flex:none; cursor:pointer;
          border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.6);
          display:grid; place-items:center; transition:background .15s ease, color .15s ease; }
        .pl-seta:hover:not(:disabled) { background:rgba(255,255,255,0.12); color:#fff; }
        .pl-seta:disabled { opacity:0.25; cursor:default; }

        .pl-rodape { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;
          margin-top:10px; font-size:12px; color:var(--bx-text-3); }
        .pl-tema { max-width:520px; line-height:1.5; }
        .pl-custo { color:var(--bx-text-2); white-space:nowrap; }
        .pl-custo strong { color:var(--bx-amber, #f59e0b); font-variant-numeric:tabular-nums; }

        .pl-modal { position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center; padding:18px; }
        .pl-modal-cx { background:var(--bx-bg-elev, #16130f); border:1px solid var(--bx-border-2, rgba(255,255,255,0.14));
          border-radius:18px; width:100%; max-width:760px; max-height:86vh; overflow-y:auto; padding:18px; }
        .pl-mini-grade { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:10px; margin-top:14px; }
        .pl-mini { position:relative; border:1px solid var(--bx-border, rgba(255,255,255,0.1)); border-radius:10px;
          overflow:hidden; cursor:pointer; aspect-ratio:63/88; background-size:cover; background-position:center;
          transition:border-color .15s ease; }
        .pl-mini:hover { border-color:rgba(245,158,11,0.5); }
        .pl-mini-nome { position:absolute; left:0; right:0; bottom:0; font-size:9.5px; font-weight:700; color:#fff;
          text-align:center; padding:14px 4px 5px; background:linear-gradient(transparent, rgba(0,0,0,0.85)); }
        .pl-mini-trava { position:absolute; top:5px; right:5px; color:rgba(255,255,255,0.85);
          background:rgba(0,0,0,0.55); border-radius:6px; padding:3px; display:grid; place-items:center; }
        .pl-mini-blur { filter:blur(2px) brightness(0.78); position:absolute; inset:0; background-size:cover; background-position:center; }

        @media (max-width: 640px) {
          .pl-palco { padding:14px 8px; }
          .pl-seta { display:none; }
        }
        @media (prefers-reduced-motion: reduce) { .pl-btn, .pl-seta, .pl-mini { transition:none; } }
      `}</style>

      <div className="pl-barra">
        <div className="pl-acoes">
          <button className="pl-btn" onClick={() => setVerTudo(true)}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /><rect x="11.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /><rect x="2.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /><rect x="11.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /></svg>
            Todas as páginas
          </button>
          <button className="pl-btn" onClick={compartilhar} disabled={!pagina.liberada || compartilhando} title={pagina.liberada ? 'Gerar imagem da página' : 'Desbloqueie a página pra compartilhar'}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M13.5 6.5L10 3 6.5 6.5M10 3v9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 11.5V15a2 2 0 002 2h8a2 2 0 002-2v-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            {compartilhando ? 'Gerando...' : 'Compartilhar'}
          </button>
          <button className="pl-btn" onClick={() => window.print()} disabled={!pagina.liberada} title={pagina.liberada ? 'Imprimir folha A4 com linhas de recorte' : 'Desbloqueie a página pra imprimir'}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5.5 7V3.5h9V7M5.5 14H4a1.5 1.5 0 01-1.5-1.5v-4A1.5 1.5 0 014 7h12a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0116 14h-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><rect x="5.5" y="11.5" width="9" height="5" rx="0.8" stroke="currentColor" strokeWidth="1.5" /></svg>
            Imprimir A4
          </button>
        </div>
        <span className="pl-contador">Página {idx + 1} de {paginas.length}</span>
      </div>

      <div
        className="pl-palco"
        onTouchStart={e => { toqueX.current = e.touches[0]?.clientX ?? null }}
        onTouchEnd={e => {
          if (toqueX.current === null) return
          const dx = (e.changedTouches[0]?.clientX ?? 0) - toqueX.current
          if (Math.abs(dx) > 48) irPara(idx + (dx < 0 ? 1 : -1))
          toqueX.current = null
        }}
      >
        <button className="pl-seta" onClick={() => irPara(idx - 1)} disabled={idx === 0} aria-label="Página anterior">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {renderFolha(pagina)}
        <button className="pl-seta" onClick={() => irPara(idx + 1)} disabled={idx >= paginas.length - 1} aria-label="Próxima página">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div className="pl-rodape">
        {pagina.liberada && custoFechar > 0 && (
          <span className="pl-custo">
            Falta{faltando.length === 1 ? '' : 'm'} {faltando.length} — <strong>{fmtBRL(custoFechar)}</strong> pra fechar a página
          </span>
        )}
      </div>

      {verTudo && (
        <div className="pl-modal" onClick={() => setVerTudo(false)} role="dialog" aria-label="Todas as páginas">
          <div className="pl-modal-cx" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Páginas Lendárias</p>
                <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: '2px 0 0' }}>
                  {paginas.length} páginas · {paginas.filter(p => p.liberada).length} liberadas
                </p>
              </div>
              <button className="pl-btn" onClick={() => setVerTudo(false)}>Fechar</button>
            </div>
            <div className="pl-mini-grade">
              {paginas.map((p, i) => {
                const fundo = fundoDe(p)
                return (
                  <div key={p.id} className="pl-mini" onClick={() => { irPara(i); setVerTudo(false) }}>
                    {fundo && (p.liberada
                      ? <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${fundo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      : <div className="pl-mini-blur" style={{ backgroundImage: `url("${fundo}")` }} />)}
                    {!p.liberada && (
                      <span className="pl-mini-trava">
                        <svg viewBox="0 0 20 20" fill="none" width="11" height="11"><rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </span>
                    )}
                    <span className="pl-mini-nome">{p.nome}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
