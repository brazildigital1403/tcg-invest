'use client'

// Secao Trends da casa do Club (mockup aprovado em 11/11/2026). Mesmo formato do
// carrossel de pre-grading (ShortsCarrossel): cards verticais 9:16 numerados na
// ordem da lista, scroll-snap, setas e barra de progresso no desktop. O card leva
// ao post no Instagram (outra aba): nada do Instagram carrega na home.
//
// Pele por trend (22/11/2026, mockup "Trend GTA VI na home", direcao C nas duas): a trend
// selecionada pode vestir a secao inteira. A pele e so CSS, presa a `.tr[data-pele]`: troca os
// tokens de acento dentro da secao, poe um cabecalho proprio e muda a moldura do card. Trend sem
// pele continua com o visual da casa. As cores das peles sao excecao aprovada a regra dos tres
// acentos e nao saem desta secao. Nenhum ativo de terceiros: so cor, forma e DM Sans.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { BUCKET_CAPAS, linkSeguro, type Trend, type TrendPost } from '@/lib/pcc/trends'
import { Ico } from './amigo-secreto/estilo'

const ANGULOS = [135, 200, 160, 225, 110, 185, 150, 240]

type Pele = 'gta' | 'sombria'
/** Qual trend veste qual pele. Trend fora da lista fica com o visual da casa. */
const PELES: Record<string, Pele> = {
  'trend-gta-vi-2026': 'gta',
  'trend-sombria-halloween-2026': 'sombria',
}
const TEXTO_PELE: Record<Pele, { titulo: [string, string]; numero: string; completa: string; andamento: string; frase: string }> = {
  gta: { titulo: ['Bem-vindo', 'a Leonida'], numero: 'Missão', completa: 'Missão cumprida', andamento: 'Missão em andamento', frase: 'Cada creator do Club entrou na trend com a própria capa.' },
  sombria: { titulo: ['A noite', 'é do Club'], numero: 'Fita', completa: 'Sessão completa', andamento: 'Sessão em andamento', frase: 'Cada creator do Club mostrou a versão sombria dele.' },
}

const capaUrl = (path: string) => supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl

function IcoInsta({ s = 28 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" />
    </svg>
  )
}
const Seta = ({ dir }: { dir: 'e' | 'd' }) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'e' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
)

function CardPost({ p, i, pele }: { p: TrendPost; i: number; pele: Pele | null }) {
  const href = linkSeguro(p.link)
  const arte = `radial-gradient(at 28% 18%, rgba(var(--ac-1-rgb),.32), transparent 55%), radial-gradient(at 82% 82%, rgba(239,68,68,.30), transparent 52%), linear-gradient(${ANGULOS[i % ANGULOS.length]}deg, #171a22, #0c0e13)`
  const rotulo = p.tipo === 'reel' ? 'Reel' : 'Post'
  const conteudo = (
    <>
      {p.capa
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="tr-img" src={capaUrl(p.capa)} alt="" loading={i < 3 ? 'eager' : 'lazy'} />
        : <><span className="tr-arte" style={{ background: arte }} /><span className="tr-ini" aria-hidden="true">{p.nome.charAt(0).toUpperCase()}</span></>}
      <span className="tr-veu" />
      {pele === 'gta' && <span className="tr-top" aria-hidden="true"><i />@{p.nome.toLowerCase().replace(/\s+/g, '')}<em>No ar</em></span>}
      <span className="tr-num">{pele ? `${TEXTO_PELE[pele].numero} ` : ''}{String(i + 1).padStart(2, '0')}</span>
      <span className="tr-tema">{rotulo}</span>
      <span className="tr-play"><IcoInsta /></span>
      <span className="tr-tit"><b>{p.nome}</b>{p.pessoa && <span>{p.pessoa}</span>}</span>
    </>
  )
  return (
    <article className="tr-card">
      {href
        ? <a className="tr-capa" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Ver o ${rotulo.toLowerCase()} de ${p.nome} no Instagram`}>{conteudo}</a>
        : <div className="tr-capa">{conteudo}</div>}
    </article>
  )
}

export default function TrendsClub({ trends }: { trends: Trend[] | null }) {
  const trilho = useRef<HTMLDivElement>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [pontas, setPontas] = useState({ inicio: true, fim: false })

  const atual = trends?.find(t => t.slug === slug) || trends?.[0] || null

  const medir = useCallback(() => {
    const t = trilho.current
    if (!t) return
    const max = t.scrollWidth - t.clientWidth
    setProgresso(max > 0 ? t.scrollLeft / max : 1)
    setPontas({ inicio: t.scrollLeft < 8, fim: t.scrollLeft > max - 8 })
  }, [])

  useEffect(() => {
    const t = trilho.current
    if (!t) return
    t.scrollLeft = 0
    const raf = requestAnimationFrame(medir)
    const ro = new ResizeObserver(medir)
    ro.observe(t)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [medir, atual?.slug])

  function rolar(dir: 1 | -1) {
    const t = trilho.current
    if (!t) return
    const card = t.querySelector<HTMLElement>('.tr-card')
    const passo = card ? card.offsetWidth + 16 : t.clientWidth * 0.8
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    t.scrollBy({ left: dir * passo, behavior: reduzir ? 'auto' : 'smooth' })
  }

  // Sem trend publicada (ou se a leitura falhar), a home segue sem a secao.
  if (!atual || atual.posts.length === 0) return null

  const pele = PELES[atual.slug] ?? null
  const tx = pele ? TEXTO_PELE[pele] : null
  const blocos = atual.posts.length + (atual.aguardando.length > 0 ? 1 : 0)
  const acesos = Math.max(1, Math.round(progresso * blocos))

  return (
    <section className="tr" data-pele={pele ?? undefined} aria-label="Trends do Club">
      <style>{TR_CSS}</style>
      <div className="tr-cab">
        <div className="as-eye"><Ico n="spark" s={14} />Trends</div>
        {!tx && <h2 className="tr-h2">O que o Club está fazendo agora</h2>}
      </div>

      {trends && trends.length > 1 && (
        <div className="tr-filtros" role="group" aria-label="Trends">
          {trends.map(t => (
            <button key={t.slug} type="button" className={`tr-chip${t.slug === atual.slug ? ' on' : ''}`} aria-pressed={t.slug === atual.slug} onClick={() => setSlug(t.slug)}>{t.tema}</button>
          ))}
        </div>
      )}

      {tx && (
        <div className="tr-faixa">
          <h2 className="tr-h2">{tx.titulo[0]} <br />{tx.titulo[1]}</h2>
          <p><b>{atual.postaram >= atual.total ? tx.completa : tx.andamento}: {atual.postaram} de {atual.total}.</b> {tx.frase}</p>
        </div>
      )}

      <div className="tr-meta">
        {trends && trends.length > 1
          ? <b>{atual.titulo}</b>
          : <span className="tr-chip on pq">{atual.tema}</span>}
        <span><b>{atual.postaram} de {atual.total}</b> {atual.total === 1 ? 'creator já postou' : 'creators já postaram'}</span>
      </div>

      <div className="tr-trilho" ref={trilho} onScroll={medir} role="region" aria-label={`Posts da ${atual.titulo}`} tabIndex={0}>
        {atual.posts.map((p, i) => <CardPost key={`${atual.slug}-${i}`} p={p} i={i} pele={pele} />)}
        {atual.aguardando.length > 0 && (
          <article className="tr-card tr-fim">
            <div className="as-eye"><Ico n="clock" s={14} />Vem mais por aí</div>
            <p className="as-meta">Estes creators ainda vão postar a versão deles.</p>
            <ul>{atual.aguardando.map(n => <li key={n}><i />{n}</li>)}</ul>
          </article>
        )}
      </div>

      <div className="tr-rodape">
        <div className="tr-barra" aria-hidden="true"><span style={{ width: `${Math.max(12, progresso * 100)}%` }} /></div>
        {pele && <div className="tr-seg" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${blocos}, 1fr)` }}>{Array.from({ length: blocos }, (_, k) => <i key={k} className={k < acesos ? 'on' : undefined} />)}</div>}
        <div className="tr-setas">
          <button type="button" onClick={() => rolar(-1)} disabled={pontas.inicio} aria-label="Posts anteriores"><Seta dir="e" /></button>
          <button type="button" onClick={() => rolar(1)} disabled={pontas.fim} aria-label="Próximos posts"><Seta dir="d" /></button>
        </div>
      </div>
    </section>
  )
}

const TR_CSS = `
.tr{display:flex;flex-direction:column;gap:14px;padding-top:12px;min-width:0}
.tr-cab{display:flex;flex-direction:column;gap:6px}
.tr-h2{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.15;text-wrap:balance}
.tr-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--bx-text-2)}
.tr-meta b{color:var(--bx-text)}
.tr-filtros{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0}
.tr-filtros::-webkit-scrollbar{display:none}
.tr-chip{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;font:inherit;font-size:13px;font-weight:700;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text-2);white-space:nowrap;cursor:pointer;transition:background .15s ease,color .15s ease}
.tr-chip.on{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.tr-chip:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.tr-chip.pq{min-height:28px;padding:0 11px;font-size:11.5px;cursor:default}
.tr-trilho{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(210px,62vw,260px);gap:16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:2px;padding:6px 2px 10px;scrollbar-width:none}
.tr-trilho::-webkit-scrollbar{display:none}
.tr-trilho:focus-visible{outline:2px solid var(--bx-text);outline-offset:4px;border-radius:18px}
.tr-card{position:relative;aspect-ratio:9/16;border-radius:18px;overflow:hidden;scroll-snap-align:start;background:var(--bx-surface-2);border:1px solid var(--bx-border);box-shadow:var(--bx-shadow);transition:transform .2s ease,border-color .2s ease}
.tr-card:hover{transform:translateY(-4px);border-color:rgba(var(--ac-1-rgb),.55)}
.tr-capa{position:absolute;inset:0;display:block;color:#fff;text-decoration:none;overflow:hidden}
.tr-capa:focus-visible{outline:2px solid var(--bx-text);outline-offset:-4px}
.tr-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .2s ease}
.tr-card:hover .tr-img{transform:scale(1.04)}
.tr-arte{position:absolute;inset:0}
.tr-ini{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:120px;font-weight:800;letter-spacing:-.04em;color:rgba(255,255,255,.07);line-height:1}
.tr-veu{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,15,.55) 0%,rgba(8,10,15,0) 28%,rgba(8,10,15,0) 52%,rgba(8,10,15,.92) 100%)}
.tr-num{position:absolute;top:14px;left:14px;font-size:13px;font-weight:800;letter-spacing:.06em;font-variant-numeric:tabular-nums;opacity:.9}
.tr-tema{position:absolute;top:12px;right:12px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:999px;background:rgba(8,10,15,.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.18)}
.tr-play{position:absolute;top:50%;left:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;display:grid;place-items:center;background:var(--ac-grad);color:var(--bx-brand-ink);box-shadow:0 10px 30px rgba(0,0,0,.5);transition:transform .2s ease}
.tr-card:hover .tr-play{transform:scale(1.08)}
.tr-tit{position:absolute;left:14px;right:14px;bottom:16px;display:flex;flex-direction:column;gap:2px}
.tr-tit b{font-size:16px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.tr-tit span{font-size:12.5px;color:rgba(255,255,255,.7)}
.tr-fim{display:flex;flex-direction:column;justify-content:center;gap:10px;padding:18px;border-style:dashed;background:transparent;box-shadow:none}
.tr-fim:hover{transform:none;border-color:var(--bx-border)}
.tr-fim ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.tr-fim li{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.tr-fim li i{width:8px;height:8px;border-radius:50%;border:1.5px dashed var(--bx-text-3);flex:none}
.tr-rodape{display:flex;align-items:center;gap:14px}
.tr-barra{flex:1 1 140px;height:4px;border-radius:999px;background:var(--bx-surface-2);overflow:hidden}
.tr-barra span{display:block;height:100%;background:var(--ac-grad);transition:width .15s ease}
.tr-setas{display:flex;gap:8px}
.tr-setas button{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);cursor:pointer;transition:background .15s ease,opacity .15s ease}
.tr-setas button:hover:not(:disabled){background:var(--bx-surface-2)}
.tr-setas button:disabled{opacity:.35;cursor:default}
@media (max-width:640px){.tr-setas{display:none}}

/* ── Peles por trend. Tudo preso a .tr[data-pele]; fora daqui nada muda. ── */
.tr-faixa,.tr-top,.tr-seg{display:none}
.tr[data-pele]{position:relative;margin-top:12px;padding:18px 14px;border-radius:20px;overflow:hidden;transition:background .2s ease}
.tr[data-pele] .tr-meta{display:none}
.tr[data-pele] .tr-faixa{display:flex;flex-direction:column;gap:6px;padding-top:26px}
.tr[data-pele] .tr-faixa .tr-h2{font-size:30px;text-transform:uppercase;letter-spacing:-.035em;line-height:.98;color:var(--pl-claro)}
.tr[data-pele] .tr-faixa p{font-size:12.5px;line-height:1.45;color:var(--pl-claro-2);max-width:32ch}
.tr[data-pele] .tr-faixa p b{color:var(--pl-claro)}
.tr[data-pele] .tr-chip:not(.on){background:rgba(var(--pl-fundo-rgb),.45);border-color:var(--pl-linha);color:var(--pl-claro)}
.tr[data-pele] .tr-num{font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;opacity:1}
.tr[data-pele] .tr-play{background:rgba(var(--pl-fundo-rgb),.55);color:#fff;border:2px solid var(--pl-frio);box-shadow:0 0 22px rgba(var(--pl-frio-rgb),.5)}
.tr[data-pele] .tr-barra{display:none}
.tr[data-pele] .tr-seg{display:grid;gap:2px;flex:1 1 140px}
.tr[data-pele] .tr-seg i{height:8px;background:rgba(var(--pl-fundo-rgb),.45);transition:background .15s ease}
.tr[data-pele] .tr-seg i.on{background:var(--pl-claro)}
.tr[data-pele] .tr-setas button{background:rgba(var(--pl-fundo-rgb),.45);border-color:var(--pl-linha);color:var(--pl-claro)}
.tr[data-pele] .tr-setas button:hover:not(:disabled){background:rgba(var(--pl-fundo-rgb),.7)}
.tr[data-pele] .tr-fim{background:rgba(var(--pl-fundo-rgb),.55);border-color:var(--pl-linha);color:var(--pl-claro)}
.tr[data-pele] .tr-fim .as-meta{color:var(--pl-claro-2)}
.tr[data-pele] .tr-fim li i{border-color:var(--pl-claro-2)}
.tr[data-pele] .tr-chip:focus-visible,.tr[data-pele] .tr-trilho:focus-visible{outline-color:var(--pl-claro)}

/* GTA VI: por do sol inteiro no fundo, card com moldura de celular. */
.tr[data-pele="gta"]{--ac-1:#ffb347;--ac-1-rgb:255,179,71;--ac-grad:linear-gradient(160deg,#ff3c78,#ff6b35);--pl-claro:#fff;--pl-claro-2:rgba(255,255,255,.84);--pl-linha:rgba(255,255,255,.3);--pl-fundo-rgb:10,10,10;--pl-frio:#19d3c5;--pl-frio-rgb:25,211,197;background:linear-gradient(180deg,#1b1036 0%,#5a1e8c 34%,#b5179e 62%,#ff3c78 82%,#ff6b35 100%)}
/* Card 4:5 so nesta trend (22/11/2026): os posts sao de feed, e a previa publica e quadrada. A capa vai inteira para o bucket e o corte e do object-fit. */
.tr[data-pele="gta"] .tr-card{aspect-ratio:4/5;border-radius:26px;border:5px solid #0a0a0a;box-shadow:0 14px 34px rgba(27,16,54,.55)}
.tr[data-pele="gta"] .tr-play{width:52px;height:52px;margin:-26px 0 0 -26px}
.tr[data-pele="gta"] .tr-card:hover{border-color:#0a0a0a}
.tr[data-pele="gta"] .tr-top{display:flex;position:absolute;top:0;left:0;right:0;z-index:2;align-items:center;gap:6px;padding:10px 12px;font-size:11.5px;font-weight:700;background:linear-gradient(180deg,rgba(10,10,10,.75),transparent);white-space:nowrap;overflow:hidden}
.tr[data-pele="gta"] .tr-top i{width:18px;height:18px;border-radius:50%;background:var(--ac-grad);flex:none}
.tr[data-pele="gta"] .tr-top em{margin-left:auto;font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:4px;background:#ff3c78;color:#fff}
.tr[data-pele="gta"] .tr-num{top:auto;bottom:62px;left:14px;color:#ffb347}
.tr[data-pele="gta"] .tr-tema{display:none}

/* Sombria: noite inteira com lua e brasa no horizonte, card como fotograma de filme. */
.tr[data-pele="sombria"]{--ac-1:#ff7a18;--ac-1-rgb:255,122,24;--ac-grad:linear-gradient(160deg,#ff7a18,#e8421a);--pl-claro:#f3ead7;--pl-claro-2:rgba(243,234,215,.82);--pl-linha:rgba(243,234,215,.3);--pl-fundo-rgb:5,3,8;--pl-frio:#9bff3c;--pl-frio-rgb:155,255,60;background:radial-gradient(90px 90px at calc(100% - 62px) var(--pl-lua-y,168px),rgba(243,234,215,.95) 0 38%,rgba(243,234,215,.12) 40%,transparent 70%),linear-gradient(180deg,#050308 0%,#0d0716 22%,#2a0f4a 58%,#5b1a12 86%,#e8421a 100%)}
.tr[data-pele="sombria"] .tr-card{border-radius:6px;border:0;background:#050308;box-shadow:0 14px 34px rgba(5,3,8,.7)}
.tr[data-pele="sombria"] .tr-card:not(.tr-fim)::before,.tr[data-pele="sombria"] .tr-card:not(.tr-fim)::after{content:"";position:absolute;left:0;right:0;height:18px;z-index:3;background:repeating-linear-gradient(90deg,transparent 0 8px,rgba(243,234,215,.85) 8px 18px,transparent 18px 26px) center/100% 8px no-repeat #050308}
.tr[data-pele="sombria"] .tr-card::before{top:0}
.tr[data-pele="sombria"] .tr-card::after{bottom:0}
.tr[data-pele="sombria"] .tr-capa{inset:18px 0}
.tr[data-pele="sombria"] .tr-num{top:10px;left:12px;color:#f3ead7;background:rgba(5,3,8,.7);padding:3px 7px}
.tr[data-pele="sombria"] .tr-tema{top:10px;right:10px;border-radius:2px;border:0;background:#e8421a;color:#fff;font-weight:800;backdrop-filter:none;-webkit-backdrop-filter:none}
.tr[data-pele="sombria"] .tr-fim{border:1px dashed var(--pl-linha)}
@media (min-width:1024px){
  .tr[data-pele]{margin-top:28px;padding:24px 22px}
  .tr[data-pele="sombria"]{--pl-lua-y:84px}
  .tr[data-pele] .tr-faixa{padding-top:8px}
  .tr[data-pele] .tr-faixa .tr-h2{font-size:44px}
  .tr[data-pele] .tr-faixa .tr-h2 br{display:none}
  .tr[data-pele] .tr-faixa p{max-width:60ch;font-size:13.5px}
}
@media (min-width:1024px){.tr{padding-top:28px}}
@media (prefers-reduced-motion:reduce){
  .tr-card,.tr-img,.tr-play,.tr-barra span,.tr-chip,.tr[data-pele],.tr[data-pele] .tr-seg i{transition:none}
  .tr-card:hover,.tr-card:hover .tr-img,.tr-card:hover .tr-play{transform:none}
}
`
