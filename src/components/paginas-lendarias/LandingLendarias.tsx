'use client'

/**
 * LandingLendarias — landing publica de trafego pago do Fichario Lendario.
 *
 * Mobile-first (trafego vem de Instagram): hero com o flipbook REAL (nao
 * screenshot), demo de arrastar a carta pro bolso, galeria com lightbox,
 * passo a passo de impressao/recorte e precos com ancoragem. CTA sticky no
 * mobile. Zero lib nova: pointer events + CSS transitions do padrao da casa.
 *
 * As artes vem de /public/paginas-lendarias (as mesmas do produto) e as
 * cartas de images.pokemontcg.io (host ja liberado no next.config).
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

// ─── Dados das paginas exibidas (subset das 19, as mais vendedoras) ─────────

interface LpCarta { img: string; slot: number }
interface LpPagina {
  id: string
  nome: string
  carta: string
  valor: string
  cartas: LpCarta[]
}

const CARD = (setNum: string) => `https://images.pokemontcg.io/${setNum}.png`

const DESTAQUES: LpPagina[] = [
  { id: 'moonbreon', nome: 'Moonbreon', carta: 'Umbreon VMAX · Evolving Skies', valor: 'R$ 11.782', cartas: [{ img: CARD('swsh7/215'), slot: 4 }] },
  { id: 'eeveelutions', nome: 'Eeveelutions', carta: '9 SIR de Prismatic Evolutions', valor: 'R$ 16.081', cartas: [
    { img: CARD('sv8pt5/149'), slot: 0 }, { img: CARD('sv8pt5/153'), slot: 1 }, { img: CARD('sv8pt5/146'), slot: 2 },
    { img: CARD('sv8pt5/155'), slot: 3 }, { img: CARD('sv8pt5/167'), slot: 4 }, { img: CARD('sv8pt5/161'), slot: 5 },
    { img: CARD('sv8pt5/144'), slot: 6 }, { img: CARD('sv8pt5/150'), slot: 7 }, { img: CARD('sv8pt5/156'), slot: 8 },
  ] },
  { id: 'mega-charizard-x', nome: 'Mega Charizard X', carta: 'Phantasmal Flames · SIR', valor: 'R$ 4.999', cartas: [{ img: CARD('me2/125'), slot: 4 }] },
  { id: 'kanto-151', nome: 'Kanto 151', carta: 'Trio inicial + Mew · 151', valor: 'R$ 6.173', cartas: [
    { img: CARD('sv3pt5/198'), slot: 0 }, { img: CARD('sv3pt5/199'), slot: 1 }, { img: CARD('sv3pt5/200'), slot: 2 },
    { img: CARD('sv3pt5/205'), slot: 7 },
  ] },
  { id: 'gengar-vmax', nome: 'Gengar VMAX', carta: 'Fusion Strike · Alt Art', valor: 'R$ 6.074', cartas: [{ img: CARD('swsh8/271'), slot: 4 }] },
  { id: 'rayquaza-vmax', nome: 'Rayquaza VMAX', carta: 'Evolving Skies · Alt Art', valor: 'R$ 4.998', cartas: [{ img: CARD('swsh7/218'), slot: 4 }] },
]

const GALERIA: { id: string; nome: string }[] = [
  { id: 'moonbreon', nome: 'Moonbreon' }, { id: 'gengar-vmax', nome: 'Gengar VMAX' },
  { id: 'mega-charizard-x', nome: 'Mega Charizard X' }, { id: 'rayquaza-vmax', nome: 'Rayquaza' },
  { id: 'charizard-vmax-cp', nome: 'Charizard VMAX' }, { id: 'sylveon-vmax', nome: 'Sylveon VMAX' },
  { id: 'leafeon-vmax', nome: 'Leafeon VMAX' }, { id: 'glaceon-vmax', nome: 'Glaceon VMAX' },
  { id: 'pikachu-vmax-vv', nome: 'Pikachu VMAX' }, { id: 'mew-vmax', nome: 'Mew VMAX' },
  { id: 'pikachu-ex-ss', nome: 'Pikachu ex' }, { id: 'latias-ex', nome: 'Latias ex' },
  { id: 'greninja-ex', nome: 'Greninja ex' }, { id: 'mega-lucario-ex', nome: 'Mega Lucario ex' },
  { id: 'mega-gardevoir-ex', nome: 'Mega Gardevoir ex' }, { id: 'lugia-vstar', nome: 'Lugia VSTAR' },
  { id: 'giratina-vstar', nome: 'Giratina VSTAR' }, { id: 'eeveelutions', nome: 'Eeveelutions' },
  { id: 'kanto-151', nome: 'Kanto 151' },
  { id: 'umbreon-v', nome: 'Umbreon V' }, { id: 'charizard-v-bs', nome: 'Charizard V' },
  { id: 'espeon-vmax', nome: 'Espeon VMAX' }, { id: 'lugia-v', nome: 'Lugia V' },
  { id: 'giratina-v', nome: 'Giratina V' }, { id: 'sylveon-v', nome: 'Sylveon V' },
  { id: 'leafeon-v', nome: 'Leafeon V' }, { id: 'vaporeon-v', nome: 'Vaporeon V' },
  { id: 'machamp-v', nome: 'Machamp V' }, { id: 'tyranitar-v', nome: 'Tyranitar V' },
  { id: 'rayquaza-amazing', nome: 'Rayquaza Amazing' }, { id: 'zamazenta-amazing', nome: 'Zamazenta Amazing' },
  { id: 'magikarp-scroll', nome: 'Magikarp' }, { id: 'charmander-151', nome: 'Charmander' },
  { id: 'charmeleon-151', nome: 'Charmeleon' }, { id: 'squirtle-151', nome: 'Squirtle' },
  { id: 'bulbasaur-151', nome: 'Bulbasaur' }, { id: 'mew-ex-pf', nome: 'Mew ex Shiny' },
  { id: 'tr-mewtwo', nome: "TR Mewtwo" }, { id: 'tr-nidoking', nome: "TR Nidoking" },
  { id: 'cynthia-garchomp', nome: 'Garchomp da Cynthia' }, { id: 'gardevoir-ex-svi', nome: 'Gardevoir ex' },
  { id: 'charizard-ex-of', nome: 'Charizard ex OF' }, { id: 'roaring-moon', nome: 'Roaring Moon' },
  { id: 'terapagos-ex', nome: 'Terapagos ex' }, { id: 'victini-wf', nome: 'Victini' },
  { id: 'pikachu-ex-ah', nome: 'Pikachu ex AH' }, { id: 'mega-gengar-ex', nome: 'Mega Gengar ex' },
  { id: 'mega-dragonite-ex', nome: 'Mega Dragonite ex' }, { id: 'meowth-pf', nome: 'Meowth' },
  { id: 'clefairy-po', nome: 'Clefairy' }, { id: 'flareon-v', nome: 'Flareon V' },
  { id: 'glaceon-v', nome: 'Glaceon V' },
]

// Versoes otimizadas pra landing (LCP < 2,5s no 4G): -lp 760px (~60KB) no
// hero/folhas, -mini 320px (~17KB) na galeria. A arte cheia (~600KB) so
// carrega no lightbox, sob demanda.
const arte = (id: string) => `/paginas-lendarias/${id}-lp.webp`
const arteMini = (id: string) => `/paginas-lendarias/${id}-mini.webp`
const arteCheia = (id: string) => `/paginas-lendarias/${id}.webp`

// ─── Icones locais (outline, padrao Icons.tsx) ──────────────────────────────

function IcSeta({ dir }: { dir: 'esq' | 'dir' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      {dir === 'esq'
        ? <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

function IcCheck() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}><path d="M4 10.5l4 4L16 6" stroke="var(--bx-green, #22c55e)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

// ─── Pagina do fichario (render compartilhado hero/drag) ────────────────────

function PaginaFichario({ pagina, cartaVisivel = true, brilho = 1 }: { pagina: LpPagina; cartaVisivel?: boolean; brilho?: number }) {
  const porSlot = new Map(pagina.cartas.map(c => [c.slot, c]))
  return (
    <div className="lp-folha" style={{ filter: `brightness(${brilho})` }}>
      <img className="lp-folha-arte" src={arte(pagina.id)} alt={`Página Lendária ${pagina.nome}`} loading="lazy" />
      <div className="lp-folha-grade">
        {Array.from({ length: 9 }).map((_, s) => {
          const c = porSlot.get(s)
          return (
            <div key={s} className={`lp-bolso${c ? ' tem' : ''}`}>
              {c && cartaVisivel && <img src={c.img} alt="" loading="lazy" />}
            </div>
          )
        })}
      </div>
      <div className="lp-folha-rodape">
        <b>{pagina.nome}</b>
        <span>{pagina.carta}</span>
      </div>
    </div>
  )
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function LandingLendarias() {
  const [idx, setIdx] = useState(0)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [encaixada, setEncaixada] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const toqueX = useRef<number | null>(null)
  const dragRef = useRef<HTMLDivElement | null>(null)
  const alvoRef = useRef<HTMLDivElement | null>(null)
  const posRef = useRef({ x: 0, y: 0 })

  const pagina = DESTAQUES[idx]

  const irPara = useCallback((n: number) => {
    setIdx((n + DESTAQUES.length) % DESTAQUES.length)
  }, [])

  useEffect(() => {
    if (!lightbox) return
    function tecla(e: KeyboardEvent) { if (e.key === 'Escape') setLightbox(null) }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [lightbox])

  // ── Drag da carta pro bolso (pointer events; tap tambem encaixa) ──────────
  function dragStart(e: React.PointerEvent) {
    if (encaixada) return
    setArrastando(true)
    const el = dragRef.current
    el?.setPointerCapture(e.pointerId)
    posRef.current = { x: e.clientX, y: e.clientY }
  }
  function dragMove(e: React.PointerEvent) {
    if (!arrastando || !dragRef.current) return
    const dx = e.clientX - posRef.current.x
    const dy = e.clientY - posRef.current.y
    dragRef.current.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-8, Math.min(8, dx / 14))}deg)`
  }
  function dragEnd(e: React.PointerEvent) {
    if (!arrastando) return
    setArrastando(false)
    const alvo = alvoRef.current?.getBoundingClientRect()
    const solto = alvo
      && e.clientX >= alvo.left - 20 && e.clientX <= alvo.right + 20
      && e.clientY >= alvo.top - 20 && e.clientY <= alvo.bottom + 20
    if (dragRef.current) dragRef.current.style.transform = ''
    if (solto) setEncaixada(true)
  }

  return (
    <div className="lp-root">
      <style>{`
        .lp-root { background: var(--bx-bg, #080a0f); color: var(--bx-text, #f5f5f4); min-height: 100vh; }
        .lp-root section { padding: clamp(44px, 8vw, 84px) 0; }
        .lp-eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase;
          background: var(--ac-grad, linear-gradient(135deg,#f59e0b,#ef4444)); -webkit-background-clip: text;
          background-clip: text; color: transparent; margin: 0 0 12px; }
        .lp-h1 { font-size: clamp(30px, 7vw, 52px); line-height: 1.06; letter-spacing: -.025em; font-weight: 800;
          margin: 0 0 14px; text-wrap: balance; }
        .lp-h2 { font-size: clamp(22px, 4.5vw, 32px); line-height: 1.15; letter-spacing: -.02em; font-weight: 800;
          margin: 0 0 10px; text-wrap: balance; }
        .lp-sub { font-size: clamp(15px, 2.4vw, 17px); color: var(--bx-text-2, rgba(255,255,255,.65));
          line-height: 1.6; max-width: 56ch; margin: 0; }
        .lp-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 800;
          font-size: 15px; border: none; border-radius: 12px; padding: 15px 28px; cursor: pointer;
          background: var(--ac-grad, linear-gradient(135deg,#f59e0b,#ef4444)); color: var(--bx-brand-ink, #0a0a0a);
          text-decoration: none; transition: transform .15s ease, box-shadow .15s ease; }
        .lp-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 30px -10px rgba(var(--ac-1-rgb,245,158,11), .5); }
        .lp-cta-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700;
          font-size: 14px; border-radius: 12px; padding: 14px 24px; cursor: pointer; text-decoration: none;
          background: transparent; border: 1px solid var(--bx-border-2, rgba(255,255,255,.16));
          color: var(--bx-text-2, rgba(255,255,255,.7)); transition: color .15s ease, border-color .15s ease; }
        .lp-cta-ghost:hover { color: var(--bx-text, #fff); border-color: rgba(var(--ac-1-rgb,245,158,11), .5); }

        /* hero */
        .lp-hero { display: grid; gap: 34px; align-items: center; grid-template-columns: 1fr;
          background: var(--bx-hero-wash, radial-gradient(90% 60% at 50% 0%, rgba(245,158,11,.07), transparent 65%)); }
        @media (min-width: 900px) { .lp-hero-in { display: grid; grid-template-columns: 1.05fr .95fr; gap: 48px; align-items: center; } }
        .lp-hero-acoes { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
        .lp-hero-provas { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 22px; font-size: 13px;
          color: var(--bx-text-3, rgba(255,255,255,.45)); }
        .lp-hero-provas span { display: inline-flex; align-items: center; gap: 6px; }

        /* folha do fichario */
        .lp-palco { position: relative; display: flex; align-items: center; gap: 10px; justify-content: center; }
        .lp-folha { position: relative; width: min(100%, 380px); aspect-ratio: 3/4; border-radius: 16px; overflow: hidden;
          border: 1px solid rgba(var(--ac-1-rgb,245,158,11), .35); box-shadow: 0 30px 70px -24px rgba(0,0,0,.8);
          transition: filter .3s ease; }
        .lp-folha-arte { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lp-folha-grade { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(3,1fr);
          grid-template-rows: repeat(3,1fr); gap: 7px; padding: 16px 14px 40px; }
        .lp-bolso { border: 1px dashed rgba(255,255,255,.28); border-radius: 6px; overflow: hidden;
          background: rgba(8,6,4,.14); }
        .lp-bolso.tem { border-style: solid; border-color: rgba(255,255,255,.45); background: transparent;
          box-shadow: 0 6px 18px -6px rgba(0,0,0,.6); }
        .lp-bolso img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lp-folha-rodape { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center;
          justify-content: space-between; gap: 10px; padding: 22px 14px 10px; font-size: 11px;
          background: linear-gradient(transparent, rgba(5,4,3,.8)); color: rgba(255,255,255,.9); }
        .lp-folha-rodape b { font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
        .lp-folha-rodape span { color: rgba(255,255,255,.6); }
        .lp-seta { width: 38px; height: 38px; border-radius: 50%; flex: none; cursor: pointer; z-index: 2;
          border: 1px solid var(--bx-border-2, rgba(255,255,255,.16)); background: var(--bx-surface, rgba(255,255,255,.05));
          color: var(--bx-text-2, rgba(255,255,255,.65)); display: grid; place-items: center;
          transition: background .15s ease, color .15s ease; }
        .lp-seta:hover { background: var(--bx-surface-2, rgba(255,255,255,.1)); color: #fff; }
        .lp-dots { display: flex; gap: 6px; justify-content: center; margin-top: 14px; }
        .lp-dot { width: 7px; height: 7px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
          background: var(--bx-border-2, rgba(255,255,255,.18)); transition: background .15s ease; }
        .lp-dot[data-on="1"] { background: var(--ac-1, #f59e0b); }
        .lp-valor { margin-top: 12px; text-align: center; font-size: 12.5px; color: var(--bx-text-3, rgba(255,255,255,.45)); }
        .lp-valor b { color: var(--ac-1, #f59e0b); font-variant-numeric: tabular-nums; }

        /* drag demo */
        .lp-drag-wrap { display: grid; gap: 28px; align-items: center; }
        @media (min-width: 900px) { .lp-drag-wrap { grid-template-columns: .9fr 1.1fr; gap: 48px; } }
        .lp-drag-palco { position: relative; display: flex; justify-content: center; }
        .lp-drag-carta { position: absolute; z-index: 5; width: 27%; aspect-ratio: 63/88; border-radius: 7px;
          overflow: hidden; cursor: grab; touch-action: none; left: 4%; bottom: 6%;
          box-shadow: 0 14px 34px -8px rgba(0,0,0,.8); border: 1.5px solid rgba(255,255,255,.5);
          transition: box-shadow .15s ease; }
        .lp-drag-carta:active { cursor: grabbing; }
        .lp-drag-carta img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .lp-drag-alvo { position: absolute; z-index: 4; left: 50%; top: 50%; transform: translate(-50%, -54%);
          width: 30%; aspect-ratio: 63/88; border: 2px dashed rgba(255,255,255,.55); border-radius: 7px;
          display: grid; place-items: center; font-size: 10px; font-weight: 800; letter-spacing: .1em;
          text-transform: uppercase; color: rgba(255,255,255,.75); text-align: center;
          background: rgba(5,4,3,.25); backdrop-filter: blur(1px); }
        .lp-drag-alvo[data-ok="1"] { border-style: solid; border-color: transparent; background: transparent; }
        .lp-drag-alvo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
          border-radius: 6px; animation: lp-pousa .35s ease; }
        @keyframes lp-pousa { from { transform: scale(1.12); opacity: .4; } to { transform: scale(1); opacity: 1; } }
        .lp-drag-refazer { font: inherit; font-size: 12.5px; font-weight: 600; color: var(--bx-text-3, rgba(255,255,255,.45));
          background: none; border: none; cursor: pointer; margin-top: 12px; text-decoration: underline; }

        /* galeria */
        .lp-galeria { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 26px; }
        .lp-mini { position: relative; aspect-ratio: 3/4; border-radius: 12px; overflow: hidden; cursor: zoom-in;
          border: 1px solid var(--bx-border, rgba(255,255,255,.09)); padding: 0; background: var(--bx-surface, #101318);
          transition: transform .15s ease, border-color .15s ease; }
        .lp-mini:hover { transform: translateY(-2px); border-color: rgba(var(--ac-1-rgb,245,158,11), .45); }
        .lp-mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lp-mini span { position: absolute; left: 0; right: 0; bottom: 0; font-size: 10px; font-weight: 700;
          color: #fff; text-align: center; padding: 16px 4px 6px; background: linear-gradient(transparent, rgba(0,0,0,.85)); }
        .lp-lightbox { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.88); backdrop-filter: blur(10px);
          display: flex; align-items: center; justify-content: center; padding: 20px; cursor: zoom-out; }
        .lp-lightbox img { max-width: min(92vw, 560px); max-height: 88vh; border-radius: 14px;
          box-shadow: 0 40px 90px -20px rgba(0,0,0,.9); }

        /* passos */
        .lp-passos { counter-reset: p; display: grid; gap: 12px; margin-top: 26px; }
        @media (min-width: 760px) { .lp-passos { grid-template-columns: repeat(var(--cols, 4), 1fr); } }
        .lp-passo { counter-increment: p; background: var(--bx-surface, rgba(255,255,255,.03));
          border: 1px solid var(--bx-border, rgba(255,255,255,.08)); border-radius: 14px; padding: 18px; }
        .lp-passo::before { content: counter(p, decimal-leading-zero); font-size: 12px; font-weight: 800;
          letter-spacing: .1em; color: var(--ac-1, #f59e0b); font-variant-numeric: tabular-nums; }
        .lp-passo h3 { font-size: 15.5px; font-weight: 700; margin: 8px 0 6px; }
        .lp-passo p { font-size: 13.5px; color: var(--bx-text-2, rgba(255,255,255,.6)); line-height: 1.55; margin: 0; }

        /* visuais dos passos: a MESMA pagina (Moonbreon) atravessando o processo */
        .lp-viz { position: relative; aspect-ratio: 5/6; border-radius: 10px; overflow: hidden;
          margin: 12px 0 14px; background: var(--bx-surface-2, rgba(255,255,255,.06)); }
        /* 1: folha A4 saindo da impressora */
        .lp-viz-a4 { position: absolute; inset: 8% 16%; background: #f5f3ee; border-radius: 3px;
          padding: 5%; box-shadow: 0 10px 26px -8px rgba(0,0,0,.6); }
        .lp-viz-a4 img { width: 100%; height: 100%; object-fit: cover; border-radius: 2px; }
        .lp-viz-a4::after { content: ''; position: absolute; inset: 5%;
          background:
            linear-gradient(rgba(255,255,255,.75), rgba(255,255,255,.75)) 33.3% 0 / 1.5px 100% no-repeat,
            linear-gradient(rgba(255,255,255,.75), rgba(255,255,255,.75)) 66.6% 0 / 1.5px 100% no-repeat,
            linear-gradient(rgba(255,255,255,.75), rgba(255,255,255,.75)) 0 33.3% / 100% 1.5px no-repeat,
            linear-gradient(rgba(255,255,255,.75), rgba(255,255,255,.75)) 0 66.6% / 100% 1.5px no-repeat; }
        .lp-viz-impressora { position: absolute; left: 0; right: 0; top: 0; height: 9%;
          background: var(--bx-surface-3, #1b1f27); border-bottom: 2px solid rgba(0,0,0,.5); }
        /* 2: as 9 pecas recortadas, separadas */
        .lp-viz-pecas { position: absolute; inset: 9% 13%; display: grid;
          grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,1fr); gap: 7%; }
        .lp-viz-pecas i { background-image: var(--pg); background-size: 300% 300%; border-radius: 3px;
          box-shadow: 0 5px 12px -4px rgba(0,0,0,.7); }
        .lp-viz-pecas i:nth-child(2) { transform: rotate(3deg); }
        .lp-viz-pecas i:nth-child(4) { transform: rotate(-2.5deg); }
        .lp-viz-pecas i:nth-child(8) { transform: rotate(2deg); }
        .lp-viz-tesoura { position: absolute; right: 5%; bottom: 4%; color: var(--ac-1, #f59e0b); }
        /* 3 e 4: pagina montada no fichario */
        .lp-viz-fich { position: absolute; inset: 6% 13%; border-radius: 8px; overflow: hidden;
          border: 1px solid rgba(var(--ac-1-rgb,245,158,11), .4); }
        .lp-viz-fich img.fundo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .lp-viz-fich .bolsos { position: absolute; inset: 5%; display: grid;
          grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,1fr); gap: 5px; }
        .lp-viz-fich .bolsos i { border: 1px solid rgba(255,255,255,.3); border-radius: 4px;
          background: rgba(8,6,4,.12); }
        .lp-viz-carta { position: absolute; left: 50%; top: 50%; width: 31%; aspect-ratio: 63/88;
          transform: translate(-50%, -52%); border-radius: 4px; overflow: hidden; z-index: 2;
          border: 1.5px solid rgba(255,255,255,.65); box-shadow: 0 0 22px rgba(var(--ac-1-rgb,245,158,11), .45),
          0 10px 24px -6px rgba(0,0,0,.8); }
        .lp-viz-carta img { width: 100%; height: 100%; object-fit: cover; display: block; }

        /* precos */
        .lp-precos { display: grid; gap: 14px; margin-top: 28px; }
        @media (min-width: 820px) { .lp-precos { grid-template-columns: repeat(3, 1fr); align-items: stretch; } }
        .lp-preco { display: flex; flex-direction: column; background: var(--bx-surface, rgba(255,255,255,.03));
          border: 1px solid var(--bx-border, rgba(255,255,255,.08)); border-radius: 16px; padding: 24px 22px; }
        .lp-preco.destaque { border-color: rgba(var(--ac-1-rgb,245,158,11), .5);
          background: linear-gradient(170deg, rgba(var(--ac-1-rgb,245,158,11), .1), var(--bx-surface, rgba(255,255,255,.03)) 55%); }
        .lp-preco .nome { font-size: 13px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
          color: var(--bx-text-3, rgba(255,255,255,.45)); }
        .lp-preco.destaque .nome { color: var(--ac-1, #f59e0b); }
        .lp-preco .valor { font-size: 34px; font-weight: 800; letter-spacing: -.02em; margin: 10px 0 2px;
          font-variant-numeric: tabular-nums; }
        .lp-preco .valor small { font-size: 14px; font-weight: 600; color: var(--bx-text-3, rgba(255,255,255,.45)); }
        .lp-preco .por { font-size: 12.5px; color: var(--bx-text-3, rgba(255,255,255,.45)); margin-bottom: 16px; }
        .lp-preco ul { list-style: none; padding: 0; margin: 0 0 20px; display: grid; gap: 9px; font-size: 13.5px;
          color: var(--bx-text-2, rgba(255,255,255,.65)); }
        .lp-preco li { display: flex; gap: 8px; align-items: flex-start; line-height: 1.45; }
        .lp-preco .lp-cta, .lp-preco .lp-cta-ghost { margin-top: auto; width: 100%; }

        /* faq */
        .lp-faq { display: grid; gap: 10px; margin-top: 26px; max-width: 760px; }
        .lp-faq details { background: var(--bx-surface, rgba(255,255,255,.03));
          border: 1px solid var(--bx-border, rgba(255,255,255,.08)); border-radius: 12px; padding: 0 18px; }
        .lp-faq summary { font-size: 14.5px; font-weight: 700; padding: 15px 0; cursor: pointer; list-style: none;
          display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .lp-faq summary::-webkit-details-marker { display: none; }
        .lp-faq summary::after { content: '+'; font-size: 18px; font-weight: 400; color: var(--ac-1, #f59e0b); }
        .lp-faq details[open] summary::after { content: '\\2212'; }
        .lp-faq details p { font-size: 13.5px; color: var(--bx-text-2, rgba(255,255,255,.6)); line-height: 1.6;
          margin: 0; padding: 0 0 16px; }

        /* sticky mobile */
        .lp-sticky { position: fixed; left: 0; right: 0; bottom: 0; z-index: 999; display: flex; gap: 10px;
          align-items: center; justify-content: space-between; padding: 10px max(16px, env(safe-area-inset-left))
          calc(10px + env(safe-area-inset-bottom)); background: rgba(8,10,15,.92); backdrop-filter: blur(12px);
          border-top: 1px solid var(--bx-border, rgba(255,255,255,.09)); }
        .lp-sticky .info { font-size: 12px; color: var(--bx-text-2, rgba(255,255,255,.6)); line-height: 1.3; }
        .lp-sticky .info b { color: var(--bx-text, #fff); font-size: 13.5px; display: block; }
        .lp-sticky .lp-cta { padding: 12px 20px; font-size: 14px; white-space: nowrap; }
        @media (min-width: 900px) { .lp-sticky { display: none; } }
        .lp-root { padding-bottom: 76px; }
        @media (min-width: 900px) { .lp-root { padding-bottom: 0; } }

        @media (prefers-reduced-motion: reduce) {
          .lp-cta, .lp-mini, .lp-seta { transition: none; }
          .lp-drag-alvo img { animation: none; }
        }
      `}</style>

      <PublicHeader />

      {/* ═══ HERO ═══ */}
      <section className="lp-hero">
        <div className="bx-gutter lp-hero-in" style={{ maxWidth: 1080, margin: '0 auto', width: '100%' }}>
          <div>
            <p className="lp-eyebrow">Páginas Lendárias</p>
            <h1 className="lp-h1">A arte da carta não precisa acabar na borda.</h1>
            <p className="lp-sub">
              Sabe quando você para de folhear o fichário só pra olhar UMA carta? Agora a página inteira
              é o cenário dela. São 52 páginas com a ilustração continuando pelos 9 bolsos — no fichário
              virtual da Bynx e numa folha A4 pronta pra imprimir, recortar e montar no seu fichário de verdade.
            </p>
            <div className="lp-hero-acoes">
              <Link className="lp-cta" href="/paginas-lendarias">Folhear a página grátis</Link>
              <a className="lp-cta-ghost" href="#precos">Ver preços</a>
            </div>
            <div className="lp-hero-provas">
              <span><IcCheck /> Primeira página grátis, sem cartão</span>
              <span><IcCheck /> A partir de R$ 12,90, compra única e vitalícia</span>
              <span><IcCheck /> Impressão ilimitada · bolso padrão 63x88mm</span>
            </div>
          </div>

          <div>
            <div className="lp-palco">
              <button className="lp-seta" onClick={() => irPara(idx - 1)} aria-label="Página anterior"><IcSeta dir="esq" /></button>
              <div
                onTouchStart={e => { toqueX.current = e.touches[0]?.clientX ?? null }}
                onTouchEnd={e => {
                  if (toqueX.current === null) return
                  const dx = (e.changedTouches[0]?.clientX ?? 0) - toqueX.current
                  if (Math.abs(dx) > 48) irPara(idx + (dx < 0 ? 1 : -1))
                  toqueX.current = null
                }}
                style={{ width: 'min(100%, 380px)' }}
              >
                <PaginaFichario pagina={pagina} />
              </div>
              <button className="lp-seta" onClick={() => irPara(idx + 1)} aria-label="Próxima página"><IcSeta dir="dir" /></button>
            </div>
            <div className="lp-dots" role="tablist" aria-label="Páginas em destaque">
              {DESTAQUES.map((p, i) => (
                <button key={p.id} className="lp-dot" data-on={i === idx ? '1' : '0'} onClick={() => irPara(i)} aria-label={p.nome} />
              ))}
            </div>
            <p className="lp-valor">Cartas desta página no Mercado Brasileiro: <b>{pagina.valor}</b></p>
          </div>
        </div>
      </section>

      {/* ═══ DRAG DEMO ═══ */}
      <section style={{ background: 'var(--bx-bg-elev, #0b0e14)', borderTop: '1px solid var(--bx-border, rgba(255,255,255,.06))', borderBottom: '1px solid var(--bx-border, rgba(255,255,255,.06))' }}>
        <div className="bx-gutter lp-drag-wrap" style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div>
            <p className="lp-eyebrow">Experimente agora</p>
            <h2 className="lp-h2">Arrasta a carta pro bolso do meio.</h2>
            <p className="lp-sub">
              É esse o momento que vende a página: a carta pousa no bolso e o cenário dela continua em volta,
              como se a ilustração nunca tivesse sido cortada. No app, isso acontece com as SUAS cartas —
              a Bynx marca as que você já tem e soma quanto falta pra fechar cada página.
            </p>
            {encaixada && (
              <button className="lp-drag-refazer" onClick={() => setEncaixada(false)}>Tirar a carta e arrastar de novo</button>
            )}
          </div>
          <div className="lp-drag-palco">
            <div style={{ position: 'relative', width: 'min(100%, 380px)' }}>
              <PaginaFichario pagina={DESTAQUES[0]} cartaVisivel={false} brilho={encaixada ? 1 : 0.55} />
              <div ref={alvoRef} className="lp-drag-alvo" data-ok={encaixada ? '1' : '0'}>
                {encaixada
                  ? <img src={CARD('swsh7/215')} alt="Umbreon VMAX encaixada" />
                  : <span>solta aqui</span>}
              </div>
              {!encaixada && (
                <div
                  ref={dragRef}
                  className="lp-drag-carta"
                  onPointerDown={dragStart}
                  onPointerMove={dragMove}
                  onPointerUp={dragEnd}
                  onClick={() => { if (!arrastando) setEncaixada(true) }}
                  role="button"
                  aria-label="Arraste a carta até o bolso central (ou toque pra encaixar)"
                >
                  <img src={CARD('swsh7/215')} alt="Umbreon VMAX" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ GALERIA ═══ */}
      <section>
        <div className="bx-gutter" style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p className="lp-eyebrow">A coleção</p>
          <h2 className="lp-h2">52 páginas. As cartas que todo mundo caça.</h2>
          <p className="lp-sub">
            Moonbreon, a página Eeveelution com as 9 SIR de Prismatic, o trio de Kanto do 151, as alt arts
            de Evolving Skies e a era Mega Evolution — 63 cartas ao todo, uma página de cada vez.
            Toque em qualquer arte pra ver em tamanho grande.
          </p>
          <div className="lp-galeria">
            {GALERIA.map(p => (
              <button key={p.id} className="lp-mini" onClick={() => setLightbox(p.id)} aria-label={`Ver ${p.nome} em tamanho grande`}>
                <img src={arteMini(p.id)} alt={`Página Lendária ${p.nome}`} loading="lazy" />
                <span>{p.nome}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRECOS ═══ */}
      <section id="precos">
        <div className="bx-gutter" style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p className="lp-eyebrow">Preços</p>
          <h2 className="lp-h2">Comece de graça. Complete quando quiser.</h2>
          <p className="lp-sub">
            Compra única, sem assinatura: a página desbloqueada é sua pra sempre, com impressão ilimitada
            e as suas cartas já marcadas.
          </p>
          <div className="lp-precos">
            <div className="lp-preco">
              <span className="nome">Página avulsa</span>
              <span className="valor">R$ 12,90</span>
              <span className="por">por página, uma única vez</span>
              <ul>
                <li><IcCheck /> Fichário virtual + folha A4 de impressão</li>
                <li><IcCheck /> Vitalícia, impressão ilimitada</li>
                <li><IcCheck /> Suas cartas marcadas automaticamente</li>
              </ul>
              <Link className="lp-cta-ghost" href="/paginas-lendarias">Escolher minha página</Link>
            </div>
            <div className="lp-preco destaque">
              <span className="nome">Coleção Lendária</span>
              <span className="valor">R$ 79,90 <small>as 52 páginas</small></span>
              <span className="por">avulsas custariam R$ 670,80 — você economiza R$ 590,90</span>
              <ul>
                <li><IcCheck /> As 52 páginas — 50 de 1 carta + 2 especiais</li>
                <li><IcCheck /> Página de 9 cartas custa o mesmo da de 1</li>
                <li><IcCheck /> Novas páginas do trimestre já inclusas</li>
                <li><IcCheck /> Vitalícia, impressão ilimitada</li>
              </ul>
              <Link className="lp-cta" href="/paginas-lendarias">Desbloquear a coleção</Link>
            </div>
            <div className="lp-preco">
              <span className="nome">Pro Anual</span>
              <span className="valor">R$ 249 <small>/ano</small></span>
              <span className="por">a Coleção Lendária vem inclusa</span>
              <ul>
                <li><IcCheck /> Tudo da Coleção Lendária</li>
                <li><IcCheck /> Todos os Master Sets liberados</li>
                <li><IcCheck /> Coleção ilimitada + Scan IA</li>
              </ul>
              <Link className="lp-cta-ghost" href="/paginas-lendarias">Conhecer o Pro</Link>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--bx-text-3, rgba(255,255,255,.4))', marginTop: 14 }}>
            Não inclui as cartas — elas são as da sua coleção. Pagamento único via Stripe, sem assinatura nas páginas.
          </p>
        </div>
      </section>

      {/* ═══ IMPRESSAO ═══ */}
      <section style={{ background: 'var(--bx-bg-elev, #0b0e14)', borderTop: '1px solid var(--bx-border, rgba(255,255,255,.06))', borderBottom: '1px solid var(--bx-border, rgba(255,255,255,.06))' }}>
        <div className="bx-gutter" style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p className="lp-eyebrow">Do virtual pro fichário real</p>
          <h2 className="lp-h2">Imprimiu, recortou, montou.</h2>
          <p className="lp-sub">
            Cada página liberada vira uma folha A4 com a arte inteira e as linhas de recorte já marcadas
            no tamanho exato do bolso 9-pocket (63x88mm). A carta de verdade entra por cima da arte.
          </p>
          <div className="lp-passos" style={{ ['--cols' as any]: 4 }}>
            <div className="lp-passo">
              <div className="lp-viz">
                <div className="lp-viz-impressora" />
                <div className="lp-viz-a4">
                  <img src={arte('moonbreon')} alt="Folha A4 da Moonbreon com linhas de recorte" loading="lazy" />
                </div>
              </div>
              <h3>Imprima a folha A4</h3>
              <p>Pelo computador, escala 100% (nunca "ajustar à página"), sem margens. Papel couché ou fotográfico FOSCO 180-230g dá o acabamento de loja.</p>
            </div>
            <div className="lp-passo">
              <div className="lp-viz" style={{ ['--pg' as any]: `url("${arte('moonbreon')}")` }}>
                <div className="lp-viz-pecas" aria-hidden="true">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <i key={i} style={{ backgroundPosition: `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%` }} />
                  ))}
                </div>
                <svg className="lp-viz-tesoura" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="M8.2 7.6L20 16M8.2 16.4L20 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </div>
              <h3>Recorte nas linhas</h3>
              <p>As 9 peças saem no tamanho exato do bolso (63x88mm). Tesoura resolve; régua e estilete deixam perfeito.</p>
            </div>
            <div className="lp-passo">
              <div className="lp-viz">
                <div className="lp-viz-fich">
                  <img className="fundo" src={arte('moonbreon')} alt="Página montada no fichário" loading="lazy" />
                  <div className="bolsos" aria-hidden="true">{Array.from({ length: 9 }).map((_, i) => <i key={i} />)}</div>
                </div>
              </div>
              <h3>Monte a página</h3>
              <p>Cada peça entra num bolso do fichário, na ordem da grade. A arte se reconstrói atravessando os 9 bolsos.</p>
            </div>
            <div className="lp-passo">
              <div className="lp-viz">
                <div className="lp-viz-fich">
                  <img className="fundo" src={arte('moonbreon')} alt="" loading="lazy" />
                  <div className="bolsos" aria-hidden="true">{Array.from({ length: 9 }).map((_, i) => <i key={i} />)}</div>
                  <div className="lp-viz-carta">
                    <img src={CARD('swsh7/215')} alt="Umbreon VMAX pousada no bolso central" loading="lazy" />
                  </div>
                </div>
              </div>
              <h3>Pouse a carta</h3>
              <p>A carta real entra no bolso marcado, por cima da arte. O cenário dela continua página afora.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section style={{ paddingTop: 0 }}>
        <div className="bx-gutter" style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p className="lp-eyebrow">Dúvidas</p>
          <h2 className="lp-h2">O que todo mundo pergunta</h2>
          <div className="lp-faq">
            <details>
              <summary>As cartas vêm junto?</summary>
              <p>Não — as cartas são as da sua coleção. Você compra a arte da página, digital e vitalícia. A Bynx marca automaticamente quais das 30 cartas você já tem e soma quanto custa fechar cada página no Mercado Brasileiro.</p>
            </details>
            <details>
              <summary>Serve no meu fichário?</summary>
              <p>Serve em qualquer fichário 9-pocket padrão: o recorte segue o bolso de 63x88mm, o mesmo das cartas. A folha sai em A4 com as linhas de corte marcadas.</p>
            </details>
            <details>
              <summary>Quantas vezes posso imprimir?</summary>
              <p>Quantas quiser, pra sempre. Errou o corte, mudou de fichário, quer uma cópia na gráfica e outra em casa? É só imprimir de novo.</p>
            </details>
            <details>
              <summary>E se eu não gostar?</summary>
              <p>Você testa antes: a página da Moonbreon é grátis, sem cartão — dá pra folhear, ver o encaixe e imprimir a amostra antes de gastar um real.</p>
            </details>
            <details>
              <summary>Que papel usar na impressão?</summary>
              <p>Sulfite comum já funciona pra testar. Pro acabamento de loja, couché ou papel fotográfico fosco de 180g a 230g — o fosco não briga com o brilho da carta. Qualquer gráfica rápida imprime uma folha A4 por poucos reais.</p>
            </details>
            <details>
              <summary>Encaixa certinho no meu fichário?</summary>
              <p>As linhas de corte seguem o bolso padrão de 63x88mm. Marcas de fichário variam alguns milímetros entre si, então a primeira peça pode pedir um ajuste fino de tesoura — imprima uma folha de teste em sulfite antes da definitiva.</p>
            </details>
            <details>
              <summary>Preciso de conta na Bynx?</summary>
              <p>Pra folhear a página grátis, não. Pra desbloquear e imprimir, sim — a conta é grátis e é ela que guarda suas páginas pra sempre (e marca as cartas que você já tem).</p>
            </details>
          </div>
          <div style={{ marginTop: 44, textAlign: 'center' }}>
            <Link className="lp-cta" href="/paginas-lendarias">Abrir meu fichário grátis</Link>
            <p style={{ fontSize: 12.5, color: 'var(--bx-text-3, rgba(255,255,255,.4))', marginTop: 12 }}>
              Sem cartão. A Moonbreon te espera na página 1.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />

      {/* CTA fixo mobile */}
      <div className="lp-sticky">
        <div className="info">
          <b>52 páginas por R$ 79,90</b>
          Vitalício. Primeira grátis.
        </div>
        <Link className="lp-cta" href="/paginas-lendarias">Começar grátis</Link>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="lp-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Arte em tamanho grande">
          <img src={arteCheia(lightbox)} alt={`Página Lendária ${lightbox}`} />
        </div>
      )}
    </div>
  )
}
