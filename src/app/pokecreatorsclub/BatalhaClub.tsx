'use client'

// Secao "Batalha de Ilustracao" da casa do Club (mockup aprovado em 26/11/2026). Mesmo esqueleto
// do carrossel das Trends (cards 9:16, scroll-snap, setas e barra em blocos no desktop), com pele
// propria: arena dividida entre o lado frio (azul e roxo) e o lado quente (laranja e vermelho),
// refletor dourado no topo e um raio no meio fazendo o papel do "VS". As cores da pele sao excecao
// aprovada a regra dos tres acentos, como as peles das Trends, e nao saem desta secao. So cor,
// forma e DM Sans; a unica imagem fora as capas e o logo do campeonato, no nosso bucket.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { BUCKET_CAPAS } from '@/lib/pcc/trends'
import { DUELOS, LOGO_BATALHA, type Duelo } from '@/lib/pcc/batalhas'

const urlBucket = (path: string) => supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl

function IcoInsta() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" />
    </svg>
  )
}
function IcoTrofeu() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
    </svg>
  )
}
const Seta = ({ dir }: { dir: 'e' | 'd' }) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === 'e' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
)

function CardDuelo({ d, i }: { d: Duelo; i: number }) {
  return (
    <article className={`bt-card${d.final ? ' final' : ''}`} data-lado={i % 2 === 0 ? 'frio' : 'quente'}>
      {d.final && (
        <span className="bt-coroa" aria-hidden="true">
          <svg viewBox="0 0 44 30"><path d="M3 9l9 7 10-13 10 13 9-7-4 19H7z" /></svg>
        </span>
      )}
      <a className="bt-capa" href={d.link} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${d.fase} no Instagram`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bt-img" src={urlBucket(d.capa)} alt="" loading={i < 3 ? 'eager' : 'lazy'} decoding="async" />
        <span className="bt-veu" />
        <span className="bt-fase">{d.final ? 'Grande final' : d.fase}</span>
        <span className="bt-ord">{i + 1}</span>
        <span className="bt-play"><IcoInsta /></span>
        <span className="bt-tit"><b>{d.fase}</b><span>{d.quem.map(q => `@${q}`).join(' × ')}</span></span>
      </a>
    </article>
  )
}

export default function BatalhaClub() {
  const trilho = useRef<HTMLDivElement>(null)
  const [acesos, setAcesos] = useState(1)
  const [pontas, setPontas] = useState({ inicio: true, fim: false })

  const medir = useCallback(() => {
    const t = trilho.current
    if (!t) return
    const max = t.scrollWidth - t.clientWidth
    const p = max > 0 ? t.scrollLeft / max : 1
    const card = t.querySelector<HTMLElement>('.bt-card')
    const visiveis = Math.max(1, Math.round(t.clientWidth / (card ? card.offsetWidth + 16 : 200)))
    setAcesos(Math.min(DUELOS.length, Math.round(visiveis + p * (DUELOS.length - visiveis))))
    setPontas({ inicio: t.scrollLeft < 8, fim: t.scrollLeft > max - 8 })
  }, [])

  useEffect(() => {
    const t = trilho.current
    if (!t) return
    const raf = requestAnimationFrame(medir)
    const ro = new ResizeObserver(medir)
    ro.observe(t)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [medir])

  function rolar(dir: 1 | -1) {
    const t = trilho.current
    if (!t) return
    const card = t.querySelector<HTMLElement>('.bt-card')
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    t.scrollBy({ left: dir * (card ? card.offsetWidth + 16 : t.clientWidth * 0.8), behavior: reduzir ? 'auto' : 'smooth' })
  }

  return (
    <section className="bt" aria-label="1º Campeonato de Ilustrações Pokémon">
      <style>{BT_CSS}</style>
      <div className="bt-cab">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="bt-logo" src={urlBucket(LOGO_BATALHA)} alt="1º Campeonato de Ilustrações Pokémon" width={830} height={616} />
        <div className="bt-cab-tx">
          <div className="bt-eye"><IcoTrofeu />Batalha de Ilustração</div>
          <p className="bt-faixa">Qual é a carta <b>mais bonita?</b></p>
          <p className="bt-sub"><b>{DUELOS.length} duelos, do primeiro round à grande final.</b> Cada ilustrador mostra a sua carta, e quem assiste decide no voto.</p>
        </div>
      </div>

      <div className="bt-trilho" ref={trilho} onScroll={medir} role="region" aria-label="Duelos do campeonato" tabIndex={0}>
        {DUELOS.map((d, i) => <CardDuelo key={d.link} d={d} i={i} />)}
      </div>

      <div className="bt-rodape">
        <div className="bt-seg" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${DUELOS.length}, 1fr)` }}>
          {DUELOS.map((d, k) => <i key={d.link} className={[k < acesos ? 'on' : '', d.final ? 'fim' : ''].filter(Boolean).join(' ') || undefined} />)}
        </div>
        <div className="bt-setas">
          <button type="button" onClick={() => rolar(-1)} disabled={pontas.inicio} aria-label="Duelos anteriores"><Seta dir="e" /></button>
          <button type="button" onClick={() => rolar(1)} disabled={pontas.fim} aria-label="Próximos duelos"><Seta dir="d" /></button>
        </div>
      </div>
    </section>
  )
}

const BT_CSS = `
.bt{
  --pl-claro:#fff;--pl-claro-2:rgba(255,255,255,.82);--pl-linha:rgba(255,255,255,.28);--pl-fundo-rgb:6,8,20;
  --pl-ouro:#ffcb05;--pl-ouro-rgb:255,203,5;--pl-ouro-2:#f5a524;
  --pl-frio-rgb:79,124,255;--pl-roxo-rgb:139,92,246;--pl-quente-rgb:255,90,31;
  position:relative;isolation:isolate;overflow:hidden;margin-top:12px;border-radius:20px;padding:18px 14px;
  display:flex;flex-direction:column;gap:16px;min-width:0;color:var(--pl-claro);
  background:
    radial-gradient(60% 46% at 50% -6%,rgba(var(--pl-ouro-rgb),.42),transparent 70%),
    radial-gradient(55% 70% at 0% 10%,rgba(var(--pl-roxo-rgb),.55),transparent 70%),
    radial-gradient(50% 60% at 6% 92%,rgba(var(--pl-frio-rgb),.5),transparent 70%),
    radial-gradient(55% 70% at 100% 8%,rgba(var(--pl-quente-rgb),.55),transparent 70%),
    radial-gradient(50% 60% at 96% 94%,rgba(220,38,38,.5),transparent 70%),
    linear-gradient(90deg,#0b1240 0%,#120a24 50%,#2a0907 100%);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
}
.bt::before{content:"";position:absolute;z-index:-1;top:-4%;bottom:-4%;left:50%;width:180px;margin-left:-90px;opacity:.5;
  background:linear-gradient(180deg,var(--pl-ouro),rgb(var(--pl-quente-rgb)));
  clip-path:polygon(58% 0,40% 34%,56% 36%,34% 70%,50% 71%,30% 100%,70% 58%,52% 57%,74% 26%,58% 25%,76% 0);
  filter:blur(1px) drop-shadow(0 0 18px rgba(var(--pl-ouro-rgb),.8))}
.bt::after{content:"";position:absolute;z-index:-1;inset:0;pointer-events:none;background:
  radial-gradient(2px 2px at 12% 18%,rgba(255,255,255,.9),transparent 60%),
  radial-gradient(2px 2px at 22% 8%,rgba(var(--pl-ouro-rgb),.9),transparent 60%),
  radial-gradient(1.5px 1.5px at 34% 22%,rgba(255,255,255,.7),transparent 60%),
  radial-gradient(2px 2px at 66% 12%,rgba(255,255,255,.85),transparent 60%),
  radial-gradient(2.5px 2.5px at 78% 20%,rgba(var(--pl-ouro-rgb),.9),transparent 60%),
  radial-gradient(1.5px 1.5px at 88% 6%,rgba(255,255,255,.7),transparent 60%),
  radial-gradient(2px 2px at 8% 64%,rgba(var(--pl-frio-rgb),.9),transparent 60%),
  radial-gradient(2px 2px at 93% 58%,rgba(var(--pl-quente-rgb),.9),transparent 60%),
  linear-gradient(180deg,transparent 72%,rgba(var(--pl-fundo-rgb),.7) 100%)}
.bt-cab{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding-top:4px}
.bt-cab-tx{display:contents}
.bt-eye{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pl-ouro)}
.bt-logo{display:block;width:min(300px,82%);height:auto;filter:drop-shadow(0 10px 24px rgba(0,0,0,.55)) drop-shadow(0 0 28px rgba(var(--pl-ouro-rgb),.25))}
.bt-faixa{display:inline-block;margin:0;padding:8px 18px 9px;transform:rotate(-2deg) skewX(-6deg);background:linear-gradient(90deg,var(--pl-ouro),#ffd84a 60%,var(--pl-ouro-2));color:#140a00;font-size:17px;font-weight:800;font-style:italic;letter-spacing:-.01em;text-transform:uppercase;line-height:1.05;box-shadow:0 8px 20px rgba(0,0,0,.45);clip-path:polygon(1% 8%,99% 0,100% 88%,0 100%)}
.bt-faixa b{color:#b91c1c}
.bt-sub{margin:0;max-width:44ch;font-size:13px;line-height:1.45;color:var(--pl-claro-2)}
.bt-sub b{color:var(--pl-claro)}
.bt-trilho{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(200px,60vw,240px);gap:16px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scroll-padding-inline:2px;padding:14px 2px 12px;scrollbar-width:none}
.bt-trilho::-webkit-scrollbar{display:none}
.bt-trilho:focus-visible{outline:2px solid var(--pl-claro);outline-offset:4px;border-radius:18px}
.bt-card{position:relative;aspect-ratio:9/16;scroll-snap-align:start;border-radius:16px;padding:5px;
  background:linear-gradient(160deg,#ffe66b,var(--pl-ouro) 40%,var(--pl-ouro-2));
  box-shadow:0 14px 30px rgba(0,0,0,.55),0 0 0 1px rgba(0,0,0,.6),0 0 22px rgba(var(--lado-rgb),.55);
  transition:transform .2s ease,box-shadow .2s ease}
.bt-card[data-lado="frio"]{--lado-rgb:var(--pl-frio-rgb)}
.bt-card[data-lado="quente"]{--lado-rgb:var(--pl-quente-rgb)}
.bt-card:hover{transform:translateY(-4px);box-shadow:0 18px 36px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.6),0 0 30px rgba(var(--lado-rgb),.8)}
.bt-capa{position:absolute;inset:5px;display:block;border-radius:11px;overflow:hidden;color:#fff;text-decoration:none;background:#0b0d18;border:2px solid rgba(var(--lado-rgb),.9)}
.bt-capa:focus-visible{outline:2px solid #fff;outline-offset:-5px}
.bt-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .2s ease}
.bt-card:hover .bt-img{transform:scale(1.04)}
.bt-veu{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,8,20,.55) 0%,rgba(6,8,20,0) 26%,rgba(6,8,20,0) 50%,rgba(6,8,20,.94) 100%)}
.bt-fase{position:absolute;top:10px;left:-4px;padding:5px 12px 5px 14px;background:var(--pl-ouro);color:#140a00;font-size:11px;font-weight:800;font-style:italic;letter-spacing:.06em;text-transform:uppercase;transform:skewX(-10deg);box-shadow:0 4px 10px rgba(0,0,0,.4)}
.bt-ord{position:absolute;top:10px;right:10px;min-width:30px;height:30px;padding:0 8px;display:grid;place-items:center;border-radius:999px;background:rgba(var(--pl-fundo-rgb),.72);border:1px solid rgba(255,255,255,.25);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.bt-play{position:absolute;top:50%;left:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;display:grid;place-items:center;background:rgba(var(--pl-fundo-rgb),.6);border:2px solid var(--pl-ouro);color:#fff;box-shadow:0 0 22px rgba(var(--pl-ouro-rgb),.55);transition:transform .2s ease}
.bt-card:hover .bt-play{transform:scale(1.08)}
.bt-tit{position:absolute;left:12px;right:12px;bottom:14px;display:flex;flex-direction:column;gap:4px}
.bt-tit b{font-size:19px;font-weight:800;font-style:italic;letter-spacing:-.02em;line-height:1.05;text-transform:uppercase}
.bt-tit span{font-size:12.5px;color:rgba(255,255,255,.78);overflow-wrap:anywhere}
.bt-card.final{padding:6px;background:linear-gradient(135deg,#fff3a6,#ffcb05 30%,#f59e0b 60%,#ffe66b);box-shadow:0 18px 36px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.6),-14px 0 26px rgba(var(--pl-frio-rgb),.55),14px 0 26px rgba(var(--pl-quente-rgb),.6),0 0 40px rgba(var(--pl-ouro-rgb),.45)}
.bt-card.final .bt-capa{inset:6px;border-color:var(--pl-ouro)}
.bt-card.final .bt-fase{background:linear-gradient(90deg,#ffe66b,#ffcb05);font-size:12px}
.bt-coroa{position:absolute;top:-14px;left:50%;z-index:2;width:44px;height:30px;margin-left:-22px;color:var(--pl-ouro);filter:drop-shadow(0 4px 8px rgba(0,0,0,.6))}
.bt-coroa svg{width:100%;height:100%;fill:currentColor;stroke:#7a4a00;stroke-width:1.2;stroke-linejoin:round}
.bt-rodape{display:flex;align-items:center;gap:14px}
.bt-seg{flex:1 1 140px;display:grid;gap:3px}
.bt-seg i{height:8px;border-radius:2px;background:rgba(var(--pl-fundo-rgb),.55);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);transition:background .15s ease}
.bt-seg i.on{background:linear-gradient(90deg,var(--pl-ouro),var(--pl-ouro-2))}
.bt-seg i.fim{background:rgba(var(--pl-ouro-rgb),.25)}
.bt-seg i.fim.on{background:linear-gradient(90deg,#fff3a6,var(--pl-ouro))}
.bt-setas{display:flex;gap:8px}
.bt-setas button{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--pl-linha);background:rgba(var(--pl-fundo-rgb),.5);color:var(--pl-claro);cursor:pointer;transition:background .15s ease,opacity .15s ease}
.bt-setas button:hover:not(:disabled){background:rgba(var(--pl-fundo-rgb),.75)}
.bt-setas button:disabled{opacity:.35;cursor:default}
.bt-setas button:focus-visible{outline:2px solid var(--pl-claro);outline-offset:2px}
@media (max-width:640px){.bt-setas{display:none}}
@media (min-width:1024px){
  .bt{margin-top:28px;padding:26px 22px 22px}
  .bt::before{width:260px;margin-left:-130px}
  .bt-cab{flex-direction:row;justify-content:space-between;align-items:center;text-align:left;gap:24px}
  .bt-logo{width:340px}
  .bt-cab-tx{display:flex;flex-direction:column;align-items:flex-end;gap:12px;text-align:right}
  .bt-faixa{font-size:24px;padding:10px 22px 11px}
  .bt-sub{font-size:14px}
}
@media (prefers-reduced-motion:reduce){
  .bt-card,.bt-img,.bt-play,.bt-seg i,.bt-setas button{transition:none}
  .bt-card:hover,.bt-card:hover .bt-img,.bt-card:hover .bt-play{transform:none}
}
`
