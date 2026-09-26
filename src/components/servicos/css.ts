// CSS das paginas de servico (restauracao, pre-grading, agendar). Mesmo molde
// da landing /presente (prefixo pr-), com prefixo sv-. So token --bx-*/--ac-*.
// O acento aparece em 4 lugares: CTA, alca do slider, etapa da timeline e
// quadrado de icone.

export const SV_CSS = `
.sv-root{min-height:100dvh;background:var(--bx-bg);color:var(--bx-text);font-family:var(--font-dm-sans),system-ui,sans-serif}
.sv-wrap{max-width:560px;margin:0 auto}
.sv-sec{padding:40px 0 0}
.sv-kicker{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--bx-text-3)}
.sv-h1{font-size:clamp(30px,8vw,40px);line-height:1.08;font-weight:800;letter-spacing:-0.03em;margin:0 0 12px;text-wrap:balance}
.sv-h1 span{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sv-h2{font-size:23px;line-height:1.18;font-weight:800;letter-spacing:-0.02em;margin:0 0 8px;text-wrap:balance}
.sv-h3{font-size:15px;font-weight:700;margin:0}
.sv-sub{font-size:16px;line-height:1.55;color:var(--bx-text-2);margin:0 0 20px}
.sv-p{font-size:14.5px;line-height:1.6;color:var(--bx-text-2);margin:0 0 14px}
.sv-small{font-size:12.5px;line-height:1.5;color:var(--bx-text-3);margin:10px 0 0}

.sv-hero{padding:28px 0 8px;background:radial-gradient(90% 55% at 50% 0%,rgba(var(--ac-1-rgb),0.12),transparent 70%)}

.sv-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;border:0;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.sv-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(var(--ac-2-rgb),.35)}
.sv-cta:disabled{opacity:.55;cursor:not-allowed}
.sv-ghost{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:48px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font:inherit;font-weight:600;font-size:15px;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.sv-ghost:hover{background:var(--bx-surface-2);border-color:var(--bx-border-2)}
.sv-link{display:inline-flex;align-items:center;gap:4px;min-height:44px;color:var(--bx-text);font-weight:600;font-size:14.5px;text-decoration:underline;text-decoration-color:var(--bx-border-2);text-underline-offset:4px}
.sv-cta:focus-visible,.sv-ghost:focus-visible,.sv-link:focus-visible,.sv-opt:focus-visible,.sv-chip:focus-visible,.sv-slot:focus-visible,.sv-caso:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}

.sv-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),0.10);color:var(--ac-1);flex-shrink:0}
.sv-ic-ok{color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}
.sv-ic-bad{color:var(--bx-red);background:color-mix(in srgb,var(--bx-red) 12%,transparent)}
.sv-ic-mid{color:var(--bx-text-2);background:var(--bx-surface-2)}

.sv-card{border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border);padding:16px}
.sv-list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.sv-li{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:start}
.sv-li > div > b{display:block;font-size:14.5px;font-weight:700;margin:1px 0 3px}
.sv-li > div > span{display:block;font-size:13.5px;line-height:1.5;color:var(--bx-text-2)}
.sv-stack{display:grid;gap:12px}
.sv-tag{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px}
.sv-tag-ok{color:var(--bx-green)}
.sv-tag-bad{color:var(--bx-red)}
.sv-tag-mid{color:var(--bx-text-2)}
.sv-card-ok{border-color:color-mix(in srgb,var(--bx-green) 28%,transparent)}
.sv-card-bad{border-color:color-mix(in srgb,var(--bx-red) 26%,transparent)}
.sv-regra{margin:14px 0 0;padding:14px 16px;border-radius:12px;background:var(--bx-surface-2);font-size:14px;line-height:1.55;color:var(--bx-text)}

.sv-risk{padding:18px 16px;border-radius:14px;background:color-mix(in srgb,var(--bx-green) 6%,transparent);border:1px solid color-mix(in srgb,var(--bx-green) 28%,transparent)}

/* Slider antes/depois: input range transparente por cima; o clip-path corta o "antes". */
/* Teto de 380px de altura: em 5:7 a 343px de largura a carta dava 480 e empurrava o CTA do hero pra fora da dobra. */
.sv-ba{position:relative;width:min(100%,272px);aspect-ratio:5/7;margin:0 auto;border-radius:14px;overflow:hidden;background:var(--bx-surface-2);border:1px solid var(--bx-border);user-select:none;-webkit-user-select:none}
.sv-ba-img{position:absolute;inset:0}
.sv-ba-img img{object-fit:cover}
.sv-ba-antes{clip-path:inset(0 calc(100% - var(--pos)) 0 0)}
.sv-ba-lbl{position:absolute;top:10px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(8,10,15,.72);color:#fff;pointer-events:none}
.sv-ba-lbl-a{left:10px}.sv-ba-lbl-d{right:10px}
.sv-ba-line{position:absolute;top:0;bottom:0;left:var(--pos);width:2px;margin-left:-1px;background:var(--ac-1);pointer-events:none}
.sv-ba-knob{position:absolute;top:50%;left:var(--pos);width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;display:grid;place-items:center;background:var(--ac-grad);color:var(--bx-brand-ink);box-shadow:0 6px 18px rgba(0,0,0,.45);pointer-events:none}
.sv-ba-range{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:ew-resize;touch-action:pan-y}
.sv-ba-range:focus-visible + .sv-ba-knob{outline:2px solid var(--bx-text);outline-offset:3px}
.sv-ba-vazio{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center;color:var(--bx-text-3);font-size:13px;line-height:1.45}

.sv-casos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.sv-caso{position:relative;display:block;padding:0;border:1px solid var(--bx-border);border-radius:12px;overflow:hidden;background:var(--bx-surface);aspect-ratio:5/7;cursor:pointer;font:inherit;color:var(--bx-text);transition:transform .15s ease,border-color .15s ease}
.sv-caso:hover{transform:translateY(-2px);border-color:var(--bx-border-2)}
.sv-caso img{object-fit:cover}
.sv-caso-tag{position:absolute;left:8px;bottom:8px;padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:600;background:rgba(8,10,15,.78);color:#fff}

.sv-tl{list-style:none;margin:0;padding:0;counter-reset:sv}
.sv-tl li{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;padding-bottom:20px}
.sv-tl li:not(:last-child)::before{content:"";position:absolute;left:17px;top:38px;bottom:2px;width:2px;background:var(--bx-border-2)}
.sv-tl-n{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:800;background:var(--bx-surface-2);color:var(--bx-text-2);border:1px solid var(--bx-border-2)}
.sv-tl li:first-child .sv-tl-n{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sv-tl li > div > b{display:block;font-size:15px;font-weight:700;margin:7px 0 4px}
.sv-tl li > div > span{display:block;font-size:13.5px;line-height:1.5;color:var(--bx-text-2)}

.sv-plans{display:grid;gap:10px}
.sv-plan{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:14px;border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border-2)}
.sv-plan-dest{border-color:rgba(var(--ac-1-rgb),.7);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.10),rgba(var(--ac-2-rgb),.04))}
.sv-plan-nome{display:block;font-size:15px;font-weight:700}
.sv-plan-d{display:block;font-size:12.5px;line-height:1.4;color:var(--bx-text-2);margin-top:3px}
.sv-plan-r{text-align:right}
.sv-plan-r b{display:block;font-size:19px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.sv-plan-r small{font-size:11px;color:var(--bx-text-3)}
.sv-ribbon{position:absolute;top:-9px;right:12px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink)}
.sv-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.sv-pill{font-size:12.5px;padding:6px 11px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text-2)}

.sv-quem{display:grid;gap:14px}
.sv-quem-foto{position:relative;width:100%;aspect-ratio:4/3;border-radius:14px;overflow:hidden;background:var(--bx-surface-2);border:1px solid var(--bx-border)}
.sv-quem-foto img{object-fit:cover}
.sv-redes{display:flex;flex-wrap:wrap;gap:8px}
.sv-redes a{flex:1 1 140px}

.sv-video{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000}
.sv-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.sv-video-btn{position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;cursor:pointer;background:none}
.sv-video-btn img{object-fit:cover}
.sv-video-play{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,.28);color:#fff;font-size:13px;font-weight:600}
.sv-video-play span{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--ac-grad);color:var(--bx-brand-ink);box-shadow:0 10px 30px rgba(0,0,0,.5)}
.sv-clip{display:block;width:100%;max-width:280px;aspect-ratio:9/16;margin:16px auto 0;border-radius:14px;background:#000;object-fit:cover}

.sv-faq{display:grid;gap:8px}
.sv-faq details{border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.sv-faq summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:12px 14px;font-size:14.5px;font-weight:600;cursor:pointer;list-style:none}
.sv-faq summary::-webkit-details-marker{display:none}
.sv-faq summary svg{flex-shrink:0;color:var(--bx-text-3);transition:transform .15s ease}
.sv-faq details[open] summary svg{transform:rotate(180deg)}
.sv-faq p{margin:0;padding:0 14px 14px;font-size:14px;line-height:1.6;color:var(--bx-text-2)}

.sv-tabela{width:100%;border-collapse:collapse;font-size:13.5px}
.sv-tabela th,.sv-tabela td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--bx-border);vertical-align:top}
.sv-tabela th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);font-weight:700}
.sv-tabela td:first-child{font-weight:700;white-space:nowrap}
.sv-tabela td:last-child{color:var(--bx-text-2);line-height:1.5}
.sv-tabela tr:last-child td{border-bottom:0}

.sv-laudo{display:grid;gap:10px;padding:16px;border-radius:14px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.sv-laudo-top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.sv-laudo-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--bx-border);font-size:13.5px}
.sv-laudo-row:last-child{border-bottom:0}
.sv-laudo-row span{color:var(--bx-text-2)}
.sv-laudo-row b{font-variant-numeric:tabular-nums;text-align:right}
.sv-exemplo{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text-2);letter-spacing:0;text-transform:none}

.sv-final{padding:40px 0 72px;text-align:center}
.sv-final .sv-link{justify-content:center;text-align:center}

.sv-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bx-bg) 34%);transform:translateY(0);transition:transform .2s ease,opacity .2s ease}
.sv-sticky-off{transform:translateY(110%);opacity:0;pointer-events:none}
.sv-sticky-in{max-width:560px;margin:0 auto}

.sv-sheet{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center}
.sv-panel{position:relative;width:100%;max-width:560px;max-height:92dvh;overflow:auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-bottom:0;border-radius:22px 22px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));display:grid;gap:12px}
.sv-x{position:absolute;top:8px;right:8px;z-index:2;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(8,10,15,.6);color:#fff;cursor:pointer}
.sv-dl{display:grid;gap:8px;margin:0}
.sv-dl div{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px;font-size:13.5px}
.sv-dl dt{color:var(--bx-text-3)}
.sv-dl dd{margin:0}

@media (min-width:769px){
  .sv-sticky{display:none}
}
@media (prefers-reduced-motion:reduce){
  .sv-cta,.sv-caso,.sv-sticky,.sv-faq summary svg{transition:none}
  .sv-cta:hover:not(:disabled),.sv-caso:hover{transform:none}
}
`
