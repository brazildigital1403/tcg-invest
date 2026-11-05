'use client'

// Casca visual do Amigo Secreto (UI 2 aprovada em 04/11/2026: "o cartao de
// missao e o heroi"). Landing e sala compartilham estes blocos: o CSS com
// prefixo as-, os icones outline e o avatar com inicial ou Pokemon.
//
// Fora do AppLayout, como a /criadores: a pagina declara a DM Sans na propria
// raiz (o body do site e Arial) e usa o .bx-gutter. So tokens --bx-* / --ac-*.

import Image from 'next/image'
import Link from 'next/link'
import { spritePokemon } from '@/lib/amigoSecreto'

const PATHS: Record<string, React.ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chev: <path d="M9 6l6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  check: <path d="M5 12l5 5 9-10" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13M12 8c-2-3-6-3-6-1s3 1 6 1zM12 8c2-3 6-3 6-1s-3 1-6 1z" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  box: <path d="M3 8l9-4 9 4v9l-9 4-9-4z M3 8l9 4 9-4M12 12v9" />,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  ext: <path d="M14 5h5v5M19 5l-8 8M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />,
  send: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="9" r="3" /><path d="M17 14c3 0 5 2.2 5 5" /></>,
  alert: <path d="M12 3l10 18H2z M12 10v4M12 17.5v.5" />,
  truck: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
}

export function Ico({ n, s = 18, className = '' }: { n: keyof typeof PATHS | string; s?: number; className?: string }) {
  return (
    <svg className={`as-ico ${className}`} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[n]}
    </svg>
  )
}

/** Avatar: Pokemon de perfil quando tem; senao a inicial do @, em neutro. */
export function Avatar({ instagram, pokemon, tam = 32 }: { instagram: string; pokemon?: string | null; tam?: number }) {
  const sprite = spritePokemon(pokemon)
  const cls = `as-av${sprite ? ' pk' : ''}`
  if (sprite) {
    return (
      <span className={cls} style={{ width: tam, height: tam }}>
        <Image src={sprite} alt="" width={tam} height={tam} unoptimized referrerPolicy="no-referrer" />
      </span>
    )
  }
  return <span className={cls} style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.4) }}>{(instagram || '?').slice(0, 1).toUpperCase()}</span>
}

export const LOGO_PCC = '/amigo-secreto/poke-creators-club.png'

/** Volta sempre para a casa do Club: quem chega pelo WhatsApp nao tem historico. */
export function VoltarClub({ href }: { href: string }) {
  return (
    <Link href={href} className="as-voltar">
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      Club
    </Link>
  )
}

export const AS_CSS = `
.as{min-height:100vh;background:var(--bx-bg);color:var(--bx-text);font-family:var(--font-dm-sans),'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-size:14px;line-height:1.45;padding-bottom:40px}
.as *{box-sizing:border-box}
.as a{color:inherit}
.as-wrap{max-width:520px;margin:0 auto}
.as-top{position:sticky;top:0;z-index:20;height:56px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bx-border);background:color-mix(in srgb,var(--bx-bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.as-top .as-wrap{display:flex;align-items:center;justify-content:space-between;width:100%}
.as-logo-a{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;margin-left:-4px;border-radius:10px}
.as-logo{height:24px;width:auto;display:block}
.as-voltar{display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:0 8px 0 4px;margin-left:-4px;border-radius:10px;font-size:13px;font-weight:600;color:var(--bx-text-2);text-decoration:none;transition:background .15s ease,color .15s ease}
.as-voltar:hover{background:var(--bx-surface-2);color:var(--bx-text)}
.as-voltar:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.as-top .t{font-size:13px;color:var(--bx-text-2);font-weight:600}
.as-ib{width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;color:var(--bx-text-2);background:transparent;border:0;cursor:pointer;font:inherit;transition:background .15s ease,color .15s ease}
.as-ib:hover{background:var(--bx-surface-2);color:var(--bx-text)}
.as-ib.sq{border:1px solid var(--bx-border-2)}
.as-bd{padding-top:16px;display:flex;flex-direction:column;gap:12px}
.as-ico{flex:none}
.as h1,.as h2,.as h3,.as p{margin:0}
.as-h2{font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.as-h3{font-size:16px;font-weight:700;line-height:1.25}
.as-meta{font-size:12.5px;color:var(--bx-text-3)}
.as-meta strong{color:var(--bx-text-2)}
.as-chips{display:flex;gap:6px;flex-wrap:wrap}
.as-chip{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px;border-radius:999px;font-size:11.5px;font-weight:700;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text-2)}
.as-chip.fill{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.as-card{border:1px solid var(--bx-border);border-radius:12px;padding:12px;background:var(--bx-surface);display:flex;flex-direction:column;gap:8px}
.as-k{font-size:11px;color:var(--bx-text-3);text-transform:uppercase;letter-spacing:.08em;font-weight:800}
.as-row{display:flex;align-items:center;justify-content:space-between;min-height:44px;border-bottom:1px solid var(--bx-border);gap:8px;color:var(--bx-text);width:100%;background:transparent;border-left:0;border-right:0;border-top:0;padding:0;font:inherit;text-align:left;cursor:pointer}
.as-row:last-child{border-bottom:0}
.as-row .l{display:flex;align-items:center;gap:10px;font-size:14px}
.as-row .arr{color:var(--bx-text-3)}
.as-row.static{cursor:default}
.as-st{width:22px;height:22px;border:1.5px solid var(--bx-border-2);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--bx-brand-ink)}
.as-st.ok{background:var(--ac-grad);border-color:transparent}
.as-st.opt{border-style:dashed}
.as-mis{position:relative;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px;border:1px solid transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:var(--bx-shadow)}
.as-eye{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1)}
.as-mis .as-h3{font-size:18px;letter-spacing:-.01em}
.as-hp{display:flex;flex-direction:column;gap:6px}
.as-hp .lb{display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--bx-text-2)}
.as-hp .lb span:last-child{color:var(--bx-text-3);font-weight:600;font-variant-numeric:tabular-nums}
.as-hp .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;height:10px;padding:2px;border-radius:999px;background:var(--bx-surface-3);border:1px solid var(--bx-border)}
.as-hp .seg i{display:block;border-radius:999px;background:transparent;transition:background .2s ease}
.as-hp .seg i.on{background:var(--ac-grad)}
.as-verso{position:relative;width:112px;aspect-ratio:5/7;border-radius:10px;flex:none;border:1px solid var(--bx-border-2);background:repeating-linear-gradient(45deg,var(--bx-surface-3) 0 4px,transparent 4px 10px),var(--bx-surface-2);box-shadow:var(--bx-shadow);display:flex;align-items:center;justify-content:center;color:var(--bx-text-3);cursor:pointer;padding:0;transition:transform .15s ease,box-shadow .15s ease}
.as-verso:before{content:"";position:absolute;inset:7px;border-radius:6px;border:1px solid var(--bx-border);background:var(--bx-bg-elev)}
.as-verso:after{content:"";position:absolute;inset:14px;border-radius:4px;border:1px dashed var(--bx-border)}
.as-verso .as-ico{position:relative;color:var(--bx-text-3)}
.as-verso.tilt{transform:rotate(-6deg)}
.as-verso.tilt:hover{transform:rotate(-6deg) translateY(-2px)}
.as-verso.sm{width:84px}
.as-frente{position:relative;border-radius:16px;padding:12px 16px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;border:1px solid transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:var(--bx-shadow);animation:as-virar .2s ease}
.as-frente:before{content:"";position:absolute;inset:7px;border-radius:11px;border:1px solid var(--bx-border);pointer-events:none}
.as-frente .at{font-size:24px;font-weight:800;letter-spacing:-.02em;margin-top:6px;word-break:break-all}
.as-frente .ln{display:inline-flex;align-items:center;gap:6px;min-height:44px;font-size:13px;font-weight:600;color:var(--ac-1);text-decoration:none}
@keyframes as-virar{from{transform:perspective(600px) rotateY(90deg)}to{transform:none}}
.as-lane{display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid var(--bx-border)}
.as-lane.first{border-top:0;padding-top:0}
.as-lane.envio{flex-direction:row;align-items:center;gap:14px}
.as-lane.envio .tx{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.as-btn{min-height:44px;border:1px solid var(--bx-border-2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;font-size:14px;padding:0 14px;text-align:center;background:transparent;color:var(--bx-text);font-family:inherit;cursor:pointer;text-decoration:none;transition:transform .15s ease,background .15s ease,box-shadow .15s ease,opacity .15s ease;width:100%}
.as-btn:hover:not(:disabled){background:var(--bx-surface-2);transform:translateY(-2px)}
.as-btn:disabled{opacity:.5;cursor:default}
.as-btn.pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.as-btn.pri:hover:not(:disabled){background:var(--ac-grad);box-shadow:0 8px 24px rgba(var(--ac-1-rgb),.25)}
.as-btn.cta{min-height:56px;border-radius:12px;font-size:16px}
.as-btn.sm{font-size:13px;padding:0 12px;width:auto}
.as-btn.dis{opacity:.45;border-style:dashed;pointer-events:none}
.as-btn.lnk{border:0;font-weight:600;color:var(--bx-text-2);text-decoration:underline;text-underline-offset:3px}
.as-btn.lnk:hover:not(:disabled){transform:none;background:transparent;color:var(--bx-text)}
.as-btn.on{border-color:rgba(var(--ac-1-rgb),.5);background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1)}
.as-btn:focus-visible,.as-ib:focus-visible,.as-row:focus-visible,.as-verso:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.as-two{display:flex;gap:8px}
.as-two>*{flex:1;min-width:0}
.as-f{display:flex;flex-direction:column;min-width:0}
.as-lb{font-size:12.5px;font-weight:700;margin-bottom:6px;display:block;color:var(--bx-text-2)}
.as-in{width:100%;min-height:48px;border:1px solid var(--bx-border-2);border-radius:10px;padding:10px 12px;color:var(--bx-text);background:var(--bx-surface-2);font:inherit;font-size:16px;outline:none;transition:border-color .15s ease}
.as-in::placeholder{color:var(--bx-text-faint)}
.as-in:focus{border-color:rgba(var(--ac-1-rgb),.5)}
.as-in.err{border-color:var(--bx-red)}
.as-in.ta{min-height:92px;resize:vertical}
.as-pre{display:flex;align-items:center;border:1px solid var(--bx-border-2);border-radius:10px;background:var(--bx-surface-2);overflow:hidden}
.as-pre span{padding:0 10px 0 12px;font-weight:700;color:var(--bx-text-2);border-right:1px solid var(--bx-border-2);align-self:stretch;display:flex;align-items:center}
.as-pre .as-in{border:0;border-radius:0;background:transparent;flex:1}
.as-pre:focus-within{border-color:rgba(var(--ac-1-rgb),.5)}
.as-hint{font-size:11.5px;color:var(--bx-text-3);margin-top:5px}
.as-hint.err{color:var(--bx-red)}
.as-note{font-size:12.5px;color:var(--bx-text-2);background:var(--bx-surface-2);padding:10px 12px;border-radius:10px;border:1px solid var(--bx-border);border-left:3px solid var(--bx-text-3)}
.as-note.strong{border-color:rgba(var(--ac-1-rgb),.35);border-left:3px solid var(--ac-1);background:rgba(var(--ac-1-rgb),.06)}
.as-note strong{color:var(--bx-text)}
.as-erro{font-size:13px;color:var(--bx-red);background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 12px}
.as-av{border-radius:50%;background:var(--bx-surface-3);border:1px solid var(--bx-border-2);display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:var(--bx-text-2);flex:none;overflow:hidden}
.as-av.pk{background:rgba(var(--ac-1-rgb),.12);border-color:rgba(var(--ac-1-rgb),.3);color:var(--ac-1)}
.as-av img{width:100%;height:100%;object-fit:contain}
.as-hs{display:flex;gap:6px;flex-wrap:wrap}
.as-h{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);border-radius:999px;padding:0 10px 0 4px;font-size:12.5px;font-weight:600;min-height:32px;color:var(--bx-text-2)}
.as-h.more{border-style:dashed;padding-left:10px;color:var(--bx-text-3)}
.as-fh{display:flex;justify-content:space-between;align-items:center;min-height:32px}
.as-feed{display:flex;flex-direction:column;gap:10px}
.as-dia{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);padding-top:4px}
.as-fi{display:flex;gap:8px;align-items:flex-start}
.as-fi .bub{flex:1;border:1px solid var(--bx-border);border-radius:12px;padding:9px 12px;background:var(--bx-surface);min-width:0}
.as-fi.me .bub{border-color:rgba(var(--ac-1-rgb),.4);background:rgba(var(--ac-1-rgb),.06)}
.as-fi .who{font-size:12px;font-weight:700;display:flex;justify-content:space-between;gap:8px;color:var(--bx-text)}
.as-fi .who span{font-weight:500;color:var(--bx-text-3);white-space:nowrap}
.as-fi .tx{font-size:13.5px;margin-top:3px;color:var(--bx-text);overflow-wrap:anywhere}
.as-fi .sig{font-size:11.5px;color:var(--bx-text-3);margin-top:5px;font-style:italic}
.as-fi.sys .bub{background:transparent;border-style:dashed;text-align:center;font-size:12.5px;color:var(--bx-text-3)}
.as-comp{position:sticky;bottom:0;margin:8px -16px 0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--bx-border);background:var(--bx-bg-elev);display:flex;gap:8px;align-items:center}
@media (min-width:600px){.as-comp{margin-left:0;margin-right:0;padding-left:0;padding-right:0}}
.as-comp .fake{flex:1;min-width:0;min-height:44px;border:1px dashed var(--bx-border-2);border-radius:10px;padding:10px 12px;color:var(--bx-text-faint);background:var(--bx-surface-2);font:inherit;font-size:14px;display:block;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.as-comp .fake.live{border-style:solid;color:var(--bx-text-2)}
.as-comp .cnt-d{font-size:11px;color:var(--bx-text-3);white-space:nowrap;font-weight:600}
.as-sheet-bg{position:fixed;inset:0;z-index:50;background:var(--bx-scrim);display:flex;align-items:flex-end;justify-content:center}
.as-sheet{width:100%;max-width:520px;max-height:100dvh;overflow-y:auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-bottom:0;border-radius:18px 18px 0 0;padding:8px 16px calc(20px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;box-shadow:var(--bx-shadow)}
@media (min-width:640px){.as-sheet-bg{align-items:center}.as-sheet{border-radius:18px;border-bottom:1px solid var(--bx-border-2);max-height:92dvh}}
.as-handle{width:40px;height:4px;background:var(--bx-border-2);border-radius:2px;margin:0 auto 2px}
.as-sh{display:flex;justify-content:space-between;align-items:center;min-height:44px}
.as-sh .as-h3{font-size:17px}
.as-addr{font-size:13.5px;line-height:1.45;border:1px dashed var(--bx-border-2);padding:8px 12px;border-radius:10px;background:var(--bx-surface-2);color:var(--bx-text);white-space:pre-line}
.as-addr b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--bx-text-3);margin-bottom:4px}
.as-pill-lock{display:inline-flex;align-items:center;gap:6px;min-height:36px;white-space:nowrap;padding:0 10px 0 4px;border-radius:999px;border:1px solid rgba(var(--ac-1-rgb),.3);background:rgba(var(--ac-1-rgb),.08);font-weight:700;font-size:13px}
.as-pill-lock .as-ico{color:var(--ac-1)}
.as-pk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.as-pk{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface);font:inherit;font-size:11px;color:var(--bx-text-2);cursor:pointer;min-height:44px;transition:border-color .15s ease,background .15s ease}
.as-pk:hover{background:var(--bx-surface-2)}
.as-pk.on{border-color:var(--ac-1);background:rgba(var(--ac-1-rgb),.10);color:var(--bx-text)}
.as-pk img{width:44px;height:44px;object-fit:contain}
.as-hero{padding:20px 0 18px;display:flex;flex-direction:column;gap:10px}
/* O brilho do hero fica no main (largura toda da tela), nao na secao dentro do
   .as-wrap de 1120 px: em monitor largo o fundo parava na borda da coluna (05/11). */
.as-main-hero{background:var(--bx-hero-wash);background-repeat:no-repeat;background-size:100% 520px}
.as-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ac-1);background:rgba(var(--ac-1-rgb),.10);border:1px solid rgba(var(--ac-1-rgb),.25);padding:5px 10px;border-radius:999px;align-self:flex-start}
.as-h1{font-size:clamp(30px,8vw,38px);font-weight:800;letter-spacing:-.03em;line-height:1.08;text-wrap:balance}
.as-h1 em{font-style:normal;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.as-hero-g{display:flex;gap:14px;align-items:center}
.as-hero-g .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.as-p{color:var(--bx-text-2);font-size:14.5px;line-height:1.5}
.as-rules .as-row .l{gap:12px}
.as-ri{width:30px;height:30px;border-radius:8px;background:rgba(var(--ac-1-rgb),.10);border:1px solid rgba(var(--ac-1-rgb),.22);display:inline-flex;align-items:center;justify-content:center;color:var(--ac-1);flex:none}
.as-faq{border-top:1px solid var(--bx-border)}
.as-faq details{border-bottom:1px solid var(--bx-border)}
.as-faq summary{list-style:none;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:14.5px;cursor:pointer;color:var(--bx-text)}
.as-faq summary::-webkit-details-marker{display:none}
.as-faq summary .as-ico{color:var(--bx-text-3);transition:transform .15s ease}
.as-faq details[open] summary .as-ico{transform:rotate(180deg)}
.as-faq p{padding:0 0 14px;color:var(--bx-text-2);font-size:13.5px;line-height:1.5}
.as-foot{display:flex;justify-content:space-between;font-size:11.5px;color:var(--bx-text-3);padding-top:12px;border-top:1px solid var(--bx-border)}
.as-foot a{text-decoration:none;display:inline-flex;align-items:center;min-height:44px;padding:0 6px}
.as-foot span{display:inline-flex;align-items:center;gap:2px}
.as-chk{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--bx-text-2);cursor:pointer;min-height:44px;padding:6px 0}
.as-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ac-1);flex:none}
.as-chk a{color:var(--bx-text);text-decoration:underline;text-underline-offset:2px}
.as-chk.err{color:var(--bx-red)}
.as-cnt{font-size:28px;font-weight:800;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.as-cnt small{font-size:12px;font-weight:500;color:var(--bx-text-3);display:block;margin-top:4px;letter-spacing:0}
.as-center{text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 0}
@media (prefers-reduced-motion:reduce){.as *{transition:none !important;animation:none !important}}
.as-hero-cta,.as-hero-side{display:none}
/* v2 (analise de 04/11): sublinhas nas regras e no checklist, chip verde,
   caixas da revelacao, pontos dos recados restantes, aviso do grupo. */
.as-row small,.as-rules small{display:block;font-size:11.5px;color:var(--bx-text-3);font-weight:500;line-height:1.3;margin-top:1px}
.as-rules .as-row{min-height:52px}
.as-chip.ok{color:var(--bx-green);border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.08)}
.as-chip.wait{color:var(--ac-1);border-color:rgba(var(--ac-1-rgb),.35);background:rgba(var(--ac-1-rgb),.08)}
.as-eye-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.as-eye-row .as-btn{white-space:nowrap;flex:none}
.as-grupo{font-size:12.5px;color:var(--bx-text-3);line-height:1.45}
.as-rev{gap:8px}
.as-rev-box{border:1px solid var(--bx-border);border-radius:10px;padding:10px 12px;background:var(--bx-surface);display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--bx-text-2)}
.as-rev-box b{font-size:12px;color:var(--bx-text)}
.as-rev-box.ok{border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.06)}
.as-rev-box.ok b{color:var(--bx-green)}
.as-dots{display:inline-flex;gap:5px;align-items:center}
.as-dots i{width:8px;height:8px;border-radius:50%;background:var(--bx-border-2)}
.as-dots i.on{background:var(--ac-1)}
.as-prot{gap:6px;padding:10px 12px}
.as-prot .as-h3{font-size:14px}
.as-addr-lock{border:1px dashed var(--bx-border-2);border-radius:10px;padding:2px 12px;background:var(--bx-surface)}
.as-opts{display:flex;gap:6px;flex-wrap:wrap}
.as-opts .as-btn.sm{min-height:40px}
/* ── Desktop (>= 1024 px), mockup aprovado em 04/11/2026 ───────────────────
   Landing: hero em duas colunas (CTA acima da dobra, carta grande e "quem ja
   entrou" a direita), as 5 regras numa linha, "Como funciona" aberto em 3
   cartoes. Sala: missao a esquerda, mural fixo a direita com rolagem propria.
   O celular nao muda: .as-mob some e .as-hero-cta/.as-hero-side aparecem. */
@media (min-width:1024px){
  .as-wrap{max-width:1120px}
  .as-top{height:64px}
  .as-logo{height:30px}
  .as-bd{padding-top:28px;gap:20px}
  .as-h2{font-size:28px}
  .as-mob{display:none !important}
  .as-main-hero{background-size:100% 640px}
  .as-hero{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);grid-template-rows:min-content 1fr;column-gap:56px;row-gap:14px;align-items:start;padding:36px 0 28px}
  .as-hero .as-eyebrow{grid-column:1;justify-self:start}
  .as-hero-g{grid-column:1;flex-direction:column;align-items:flex-start;gap:14px}
  .as-hero-g .as-verso{display:none}
  .as-h1{font-size:56px;max-width:12ch}
  .as-p{font-size:17px;max-width:48ch}
  .as-hero-cta{display:flex;gap:12px;align-items:center;margin-top:6px}
  .as-hero-cta .as-btn{width:auto;padding:0 28px}
  .as-hero-side{grid-column:2;grid-row:1/3;align-self:center;display:flex;flex-direction:column;align-items:center;gap:18px}
  .as-hero-side .as-verso{width:220px}
  .as-hero-side .as-verso:before{inset:12px;border-radius:10px}
  .as-hero-side .as-verso:after{inset:24px;border-radius:7px}
  .as-hero-side .as-card{width:100%}
  .as-rules{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:0;border:0;background:transparent}
  .as-rules .as-row{flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:10px;border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:14px;min-height:0}
  .as-rules .as-row .l{flex-direction:column;align-items:flex-start;gap:10px;font-size:14px;line-height:1.3}
  .as-rules .as-ri{width:36px;height:36px}
  .as-faq{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;border-top:0}
  .as-faq details{border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:4px 16px 2px}
  .as-faq summary{pointer-events:none}
  .as-faq summary .as-ico{display:none}
  .as-faq p{padding-bottom:16px}
  .as-sala{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);column-gap:32px;align-items:start}
  .as-sala-main{display:flex;flex-direction:column;gap:16px;min-width:0}
  .as-mis{padding:22px 24px;gap:12px}
  .as-mis .as-h3{font-size:22px}
  .as-lane{padding:14px 0}
  .as-mis .as-lane:last-child{padding-bottom:0}
  .as-mis .as-chk{min-height:0;padding:2px 0}
  .as-mural{position:sticky;top:84px;display:flex;flex-direction:column;max-height:calc(100vh - 108px);border:1px solid var(--bx-border);border-radius:14px;background:var(--bx-surface);padding:14px 16px 0;min-width:0}
  .as-mural>.as-feed{overflow-y:auto;flex:1;padding-right:4px}
  .as-mural .as-comp{margin:8px -16px 0;padding:10px 16px;border-radius:0 0 14px 14px}
}
`
