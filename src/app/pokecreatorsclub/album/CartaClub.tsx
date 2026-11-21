'use client'

// Carta do Álbum do Club (mockup da opção C, aprovado em 17/11/2026). Componente próprio,
// fora do CardItem: o CardItem é a carta do catálogo, com preço e variante, e esta é uma carta
// do Club, no molde próprio (63:88, sem moldura oficial). Três tamanhos: mini (trilho do
// celular e leque da casa), md (grade do computador) e f (destaque e ficha).
//
// Frente = arte, número e título (a arte só existe quando a carta é da pessoa ou foi liberada
// como prévia). Verso = bloqueada (ícone da missão, cadeado e número) ou nova (chegou fechada).
// São <span> de propósito: ficam dentro de <button>.

import type { CSSProperties } from 'react'
import { Ico, LOGO_PCC } from '../amigo-secreto/estilo'
import { missaoDe, nn, urlArte, type CartaAlbum } from '@/lib/pcc/album'

export type TamCarta = 'mini' | 'md' | 'f'

export function CartaFrente({ carta, total = 12, tam = 'mini', sel = false, virou = false }: {
  carta: CartaAlbum; total?: number; tam?: TamCarta; sel?: boolean; virou?: boolean
}) {
  const arte = carta.arte_path ? urlArte(carta.arte_path) : null
  return (
    <span className={`cd ${tam}${sel ? ' sel' : ''}${virou ? ' virou' : ''}`}>
      <span className="jan">
        {arte
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={arte} alt="" loading="lazy" decoding="async" draggable={false} />
          : <span className="pa" style={{ '--ang': `${(110 + carta.numero * 29) % 360}deg` } as CSSProperties}><span className="pn">{nn(carta.numero)}</span><span className="pl">arte a definir</span></span>}
      </span>
      <span className="fita"><span className="nn">{nn(carta.numero)}<i className="tot">/{total}</i></span><span className="tt">{carta.nome || 'Arte a definir'}</span></span>
    </span>
  )
}

export function CartaVerso({ carta, total = 12, tam = 'mini', sel = false, nova = false, tilt = false }: {
  carta: CartaAlbum; total?: number; tam?: TamCarta; sel?: boolean; nova?: boolean; tilt?: boolean
}) {
  const m = missaoDe(carta)
  return (
    <span className={`cv ${tam}${nova ? ' nova' : ''}${tilt ? ' tilt' : ''}${sel ? ' sel' : ''}`}>
      {nova ? (
        <>
          <span className="nv">Nova</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src={LOGO_PCC} alt="" draggable={false} />
          <span className="cad"><span>{nn(carta.numero)}<i className="tot">/{total}</i></span></span>
        </>
      ) : (
        <>
          <span className="mb"><Ico n={carta.secreta ? 'spark' : m?.icone || 'lock'} s={20} /></span>
          {m?.confere && <span className="eyeb"><Ico n="eye" s={12} /></span>}
          <span className="cad"><Ico n="lock" s={13} /><span>{nn(carta.numero)}<i className="tot">/{total}</i></span></span>
        </>
      )}
    </span>
  )
}

/** A carta como o álbum mostra: arte quando já pode, verso quando não. */
export function CartaDoAlbum({ carta, total, tam, sel, virou, tilt }: {
  carta: CartaAlbum; total?: number; tam?: TamCarta; sel?: boolean; virou?: boolean; tilt?: boolean
}) {
  if (carta.estado === 'ganha' || carta.estado === 'previa') return <CartaFrente carta={carta} total={total} tam={tam} sel={sel} virou={virou} />
  return <CartaVerso carta={carta} total={total} tam={tam} sel={sel} nova={carta.estado === 'nova'} tilt={tilt} />
}

/** As cinco primeiras cartas em leque (faixa da casa): arte nas que a pessoa já virou, verso nas outras. */
export function Leque5({ cartas, total }: { cartas: CartaAlbum[]; total: number }) {
  return (
    <div className="lq5" aria-hidden="true">
      {cartas.slice(0, 5).map(c => <div key={c.numero}><CartaDoAlbum carta={c} total={total} tam="mini" /></div>)}
    </div>
  )
}

/** Três cartas empilhadas no destaque: "chegaram fechadas" (versos) ou "álbum completo" (frentes). */
export function Pilha({ cartas, total, fechadas }: { cartas: CartaAlbum[]; total: number; fechadas: boolean }) {
  return (
    <div className="pil" aria-hidden="true">
      {cartas.slice(0, 3).map(c => (
        <div key={c.numero}>
          {fechadas ? <CartaVerso carta={c} total={total} tam="f" nova /> : <CartaFrente carta={c} total={total} tam="f" />}
        </div>
      ))}
    </div>
  )
}

/** "Energia do álbum": uma barra de 12 segmentos, um por carta virada. */
export function Energia({ n, total }: { n: number; total: number }) {
  return (
    <div className="as-hp">
      <div className="lb"><span>Energia do álbum</span><span>{n} de {total}</span></div>
      <div className="al-seg" style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)},minmax(0,1fr))` }} role="img" aria-label={`${n} de ${total} cartas viradas`}>
        {Array.from({ length: total }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
      </div>
    </div>
  )
}

export const CARTA_CSS = `
/* Carta: frente (molde proprio do Club, 63:88) */
.cd{position:relative;display:block;aspect-ratio:63/88;width:100%;flex:none;border-radius:9px;border:1px solid var(--bx-border-2);background:linear-gradient(160deg,var(--bx-bg-elev),var(--bx-bg));overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.45)}
.cd .jan{position:absolute;left:5px;right:5px;top:5px;bottom:28px;border-radius:6px;overflow:hidden;background:var(--bx-surface-3)}
.cd .jan img,.cd .jan .pa{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.cd .jan:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.2) 46%,transparent 62%);mix-blend-mode:soft-light;pointer-events:none}
.cd .fita{position:absolute;left:5px;right:5px;bottom:5px;height:22px;display:flex;align-items:center;gap:5px;min-width:0}
.cd .nn{font-size:9px;font-weight:800;padding:2px 6px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink);font-variant-numeric:tabular-nums;flex:none}
.cd .tt{display:none;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;color:var(--bx-text)}
.cd .pa{display:flex;align-items:center;justify-content:center;background:radial-gradient(at 28% 18%,rgba(var(--ac-1-rgb),.34),transparent 58%),radial-gradient(at 82% 84%,var(--bx-surface-3),transparent 60%),linear-gradient(var(--ang,160deg),var(--bx-bg-elev),var(--bx-bg))}
.cd .pa .pn{font-size:44px;font-weight:800;letter-spacing:-.04em;color:var(--bx-text-faint)}
.cd .pa .pl{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);font-weight:700}
.cd.mini{border-radius:7px;box-shadow:none}
.cd.mini .jan{left:3px;right:3px;top:3px;bottom:17px;border-radius:4px}
.cd.mini .fita{left:3px;right:3px;bottom:3px;height:13px}
.cd.mini .nn{font-size:8px;padding:1px 5px}
.cd.mini .pa .pn,.cd.mini .pa .pl{display:none}
.cd.md{border-radius:11px}
.cd.md .jan{left:6px;right:6px;top:6px;bottom:32px;border-radius:7px}
.cd.md .fita{left:7px;right:7px;bottom:6px;height:24px}
.cd.md .nn{font-size:10px}
.cd.md .pa .pn{font-size:48px}
.cd.f{border-radius:16px}
.cd.f .jan{left:8px;right:8px;top:8px;bottom:42px;border-radius:10px}
.cd.f .fita{left:10px;right:10px;bottom:9px;height:28px}
.cd.f .nn{font-size:11px;padding:3px 8px}
.cd.f .tt{display:block;font-size:11.5px}
.cd.f .pa .pn{font-size:72px}
.cd.f .pa .pl{font-size:9px}
.cd.virou{animation:cd-virar .2s ease}
@keyframes cd-virar{from{transform:perspective(600px) rotateY(90deg)}to{transform:none}}
/* Carta: verso (bloqueada ou nova) */
.cv{position:relative;aspect-ratio:63/88;width:100%;flex:none;border-radius:9px;border:2px solid transparent;background:repeating-linear-gradient(45deg,var(--bx-surface-3) 0 4px,transparent 4px 10px) padding-box,linear-gradient(var(--bx-surface-2),var(--bx-surface-2)) padding-box,linear-gradient(var(--bx-border-2),var(--bx-border-2)) border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.4)}
.cv:before{content:"";position:absolute;inset:6px;border-radius:6px;border:1px solid var(--bx-border);background:var(--bx-bg-elev)}
.cv:after{content:"";position:absolute;inset:12px;border-radius:4px;border:1px dashed var(--bx-border)}
.cv .mb{position:relative;z-index:1;width:48%;aspect-ratio:1;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);display:flex;align-items:center;justify-content:center;color:var(--bx-text);margin-top:-12%}
.cv .mb .as-ico{width:54%;height:54%}
.cv .logo{position:relative;width:62%;height:auto;display:block;z-index:1;margin-top:-8%}
.cv .cad{position:absolute;left:0;right:0;bottom:11%;display:flex;flex-direction:column;align-items:center;gap:2px;z-index:2;color:var(--bx-text-3);font-size:9px;font-weight:800;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.cv .cad .as-ico{width:13px;height:13px}
.cv.nova{background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.3),0 10px 28px rgba(var(--ac-1-rgb),.3)}
.cv .nv{position:absolute;top:8px;right:8px;z-index:3;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink)}
.cv .eyeb{position:absolute;top:7px;right:7px;z-index:3;width:20px;height:20px;border-radius:50%;background:var(--bx-bg);border:1px solid var(--bx-border-2);display:flex;align-items:center;justify-content:center;color:var(--bx-text-2)}
.cv .eyeb .as-ico{width:12px;height:12px}
.cv.tilt{transform:rotate(-6deg)}
.cv.mini{border-radius:7px;border-width:1px;box-shadow:none}
.cv.mini:before{inset:3px;border-radius:4px}
.cv.mini:after{display:none}
.cv.mini .mb{width:52%;margin-top:-16%}
.cv.mini .cad{font-size:9px;bottom:9%}
.cv.mini .logo{width:70%}
.cv.mini.nova{box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.35),0 4px 10px rgba(var(--ac-1-rgb),.25)}
.cv.mini .nv{font-size:0;width:8px;height:8px;padding:0;top:4px;left:4px;right:auto}
.cv.mini .eyeb{width:14px;height:14px;top:3px;right:3px}
.cv.mini .eyeb .as-ico{width:9px;height:9px}
.cv.md{border-radius:11px}
.cv.md .cad{font-size:11px}
.cv.md .cad .as-ico{width:14px;height:14px}
.cv.f{border-radius:16px}
.cv.f:before{inset:8px;border-radius:10px}
.cv.f:after{inset:16px;border-radius:7px}
.cv.f .cad{font-size:13px;bottom:10%}
.cv.f .cad .as-ico{width:16px;height:16px}
.cv.f .nv{top:12px;right:12px;font-size:10px}
.cv.f .eyeb{top:12px;right:12px;width:24px;height:24px}
.cv.f .eyeb .as-ico{width:14px;height:14px}
.cd .tot,.cv .tot{font-style:normal}
.cd.mini .tot,.cv.mini .tot{display:none}
.cv.mini .cad .as-ico{display:none}
.cd.sel,.cv.sel{outline:2px solid var(--bx-text);outline-offset:2px}
/* Leque de 5 (faixa da casa) e pilha de 3 (destaque) */
.lq5{display:flex;justify-content:center;align-items:flex-end;height:112px;margin:2px 0 4px}
.lq5>div{width:62px;margin:0 -9px;flex:none}
.lq5>div:nth-child(1){transform:rotate(-12deg) translateY(8px)}
.lq5>div:nth-child(2){transform:rotate(-6deg) translateY(2px)}
.lq5>div:nth-child(3){transform:translateY(-2px);position:relative;z-index:1}
.lq5>div:nth-child(4){transform:rotate(6deg) translateY(2px);position:relative;z-index:2}
.lq5>div:nth-child(5){transform:rotate(12deg) translateY(8px)}
.pil{position:relative;width:140px;height:196px}
.pil>div{position:absolute;width:108px;top:22px}
.pil>div:nth-child(1){left:0;transform:rotate(-9deg)}
.pil>div:nth-child(2){left:16px;top:10px;z-index:1}
.pil>div:nth-child(3){left:32px;transform:rotate(9deg)}
/* Energia do album: 12 segmentos */
.al-seg{display:grid;gap:3px;height:10px;padding:2px;border-radius:999px;background:var(--bx-surface-3);border:1px solid var(--bx-border)}
.al-seg i{display:block;border-radius:999px;background:transparent;transition:background .2s ease}
.al-seg i.on{background:var(--ac-grad)}
@media (min-width:1024px){
  .lq5{height:160px}
  .lq5>div{width:88px;margin:0 -10px}
}
@media (prefers-reduced-motion:reduce){.cd.virou{animation:none}.al-seg i{transition:none}}
`
