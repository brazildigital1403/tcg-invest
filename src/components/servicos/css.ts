// CSS das paginas de servico (restauracao, pre-grading, agendar), prefixo sv-.
//
// As landings seguem o molde das paginas institucionais da Bynx
// (/pokedex-pokemon-tcg, /colecionadores): faixas de largura total alternando
// fundo, conteudo ate 1160px, cabecalho de secao centralizado, hero em 2
// colunas que empilha abaixo de 768px e CTA final em faixa propria. So o
// formulario (/agendar) fica numa coluna estreita (sv-wrap).
//
// So token --bx-*/--ac-*. Motion 0.15s/0.2s ease.

export const SV_CSS = `
.sv-root{min-height:100dvh;background:var(--bx-bg);color:var(--bx-text);font-family:var(--font-dm-sans),system-ui,sans-serif}
.sv-wrap{max-width:560px;margin:0 auto}
.sv-container{max-width:1160px;margin:0 auto}
.sv-narrow{max-width:820px;margin:0 auto}

/* ── Tipografia ── */
.sv-kicker{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--bx-text-3)}
.sv-h1{font-size:clamp(34px,5.2vw,56px);line-height:1.06;font-weight:800;letter-spacing:-0.04em;margin:0;text-wrap:balance}
.sv-h1 span{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sv-h2{font-size:clamp(26px,3.4vw,38px);line-height:1.15;font-weight:800;letter-spacing:-0.03em;margin:0;text-wrap:balance}
.sv-h3{font-size:16px;font-weight:700;margin:0}
.sv-sub{font-size:clamp(15px,1.6vw,18px);line-height:1.65;color:var(--bx-text-2);margin:0;max-width:580px}
.sv-p{font-size:15px;line-height:1.65;color:var(--bx-text-2);margin:0}
.sv-small{font-size:12.5px;line-height:1.5;color:var(--bx-text-3);margin:10px 0 0}

/* ── Faixas ── */
.sv-band{padding:96px 0}
.sv-band-alt{padding:96px 0;background:color-mix(in srgb,var(--bx-text) 1.5%,transparent);border-top:1px solid var(--bx-border);border-bottom:1px solid var(--bx-border)}
.sv-head{text-align:center;margin:0 auto 56px;max-width:760px;display:flex;flex-direction:column;align-items:center;gap:14px}
.sv-eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-1)}
.sv-head .sv-p{max-width:620px}

/* ── Hero ── */
.sv-hero{position:relative;overflow:hidden;padding:88px 0 104px;background:radial-gradient(50% 60% at 72% 30%,rgba(var(--ac-1-rgb),0.13),transparent 70%),radial-gradient(35% 45% at 8% 70%,rgba(var(--ac-2-rgb),0.08),transparent 70%)}
.sv-hero-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:56px;align-items:center}
.sv-hero-l{display:flex;flex-direction:column;gap:22px;min-width:0}
.sv-hero-r{min-width:0;display:flex;justify-content:center}
.sv-badge{align-self:flex-start;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;padding:6px 14px;border-radius:999px;background:color-mix(in srgb,var(--bx-green) 8%,transparent);color:var(--bx-green);border:1px solid color-mix(in srgb,var(--bx-green) 26%,transparent)}
.sv-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}
.sv-trust{display:flex;flex-wrap:wrap;gap:8px 20px;font-size:13px;color:var(--bx-text-2)}
.sv-trust span{display:inline-flex;align-items:center;gap:6px}
.sv-trust svg{color:var(--ac-1)}

/* ── Botoes ── */
.sv-cta{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 26px;border:0;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.sv-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(var(--ac-2-rgb),.35)}
.sv-cta:disabled{opacity:.55;cursor:not-allowed}
.sv-block{display:flex;width:100%}
.sv-ghost{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:52px;padding:0 22px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font:inherit;font-weight:600;font-size:15px;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.sv-ghost:hover{background:var(--bx-surface-2)}
.sv-link{display:inline-flex;align-items:center;gap:4px;min-height:44px;color:var(--bx-text);font-weight:600;font-size:14.5px;text-decoration:underline;text-decoration-color:var(--bx-border-2);text-underline-offset:4px}
.sv-cta:focus-visible,.sv-ghost:focus-visible,.sv-link:focus-visible,.sv-opt:focus-visible,.sv-chip:focus-visible,.sv-slot:focus-visible,.sv-caso:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}

/* ── Icone, card, lista ── */
.sv-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),0.10);color:var(--ac-1);flex-shrink:0}
.sv-ic-lg{width:44px;height:44px;border-radius:12px}
.sv-ic-ok{color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}
.sv-ic-bad{color:var(--bx-red);background:color-mix(in srgb,var(--bx-red) 12%,transparent)}
.sv-ic-mid{color:var(--bx-text-2);background:var(--bx-surface-2)}
.sv-card{border-radius:16px;background:var(--bx-surface);border:1px solid var(--bx-border);padding:22px;min-width:0}
.sv-card-hover{transition:transform .2s ease,border-color .2s ease}
.sv-card-hover:hover{transform:translateY(-2px);border-color:var(--bx-border-2)}
.sv-card-ok{border-color:color-mix(in srgb,var(--bx-green) 28%,transparent)}
.sv-card-bad{border-color:color-mix(in srgb,var(--bx-red) 26%,transparent)}
.sv-list{list-style:none;margin:0;padding:0;display:grid;gap:16px}
.sv-li{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:start}
.sv-li > div > b{display:block;font-size:15px;font-weight:700;margin:1px 0 4px}
.sv-li > div > span{display:block;font-size:14px;line-height:1.55;color:var(--bx-text-2)}
.sv-tag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0 0 18px}
.sv-tag-ok{color:var(--bx-green)}
.sv-tag-bad{color:var(--bx-red)}
.sv-tag-mid{color:var(--bx-text-2)}

/* ── Grades ── */
.sv-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
.sv-g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.sv-g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:48px;align-items:center}
.sv-feat{display:flex;flex-direction:column;gap:12px}
.sv-feat b{font-size:16px;font-weight:700}
.sv-feat span{font-size:14px;line-height:1.6;color:var(--bx-text-2)}
.sv-regra{max-width:820px;margin:28px auto 0;padding:18px 22px;border-radius:14px;background:var(--bx-surface-2);font-size:15px;line-height:1.6;text-align:center}

/* ── Slider antes/depois ── */
.sv-ba{position:relative;width:min(100%,340px);aspect-ratio:5/7;margin:0 auto;border-radius:16px;overflow:hidden;background:var(--bx-surface-2);border:1px solid var(--bx-border);box-shadow:var(--bx-shadow);user-select:none;-webkit-user-select:none}
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

/* ── Casos ── */
.sv-casos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.sv-caso{position:relative;display:block;padding:0;border:1px solid var(--bx-border);border-radius:14px;overflow:hidden;background:var(--bx-surface);aspect-ratio:5/7;cursor:pointer;font:inherit;color:var(--bx-text);transition:transform .15s ease,border-color .15s ease}
.sv-caso:hover{transform:translateY(-2px);border-color:var(--bx-border-2)}
.sv-caso img{object-fit:cover}
.sv-caso-tag{position:absolute;left:8px;bottom:8px;padding:4px 9px;border-radius:999px;font-size:11.5px;font-weight:600;background:rgba(8,10,15,.78);color:#fff}

/* ── Linha do tempo: horizontal no desktop, vertical no celular ── */
.sv-tl{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:20px}
.sv-tl li{position:relative;display:flex;flex-direction:column;gap:12px}
.sv-tl li:not(:last-child)::before{content:"";position:absolute;top:21px;left:52px;right:-12px;height:2px;background:var(--bx-border-2)}
.sv-tl-n{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:15px;font-weight:800;background:var(--bx-surface-2);color:var(--bx-text-2);border:1px solid var(--bx-border-2)}
.sv-tl li:first-child .sv-tl-n{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sv-tl li > div > b{display:block;font-size:15.5px;font-weight:700;margin-bottom:6px}
.sv-tl li > div > span{display:block;font-size:14px;line-height:1.55;color:var(--bx-text-2)}

/* ── Precos ── */
.sv-plan{position:relative;display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:16px;background:var(--bx-surface);border:1px solid var(--bx-border-2)}
.sv-plan-dest{border-color:rgba(var(--ac-1-rgb),.7);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.10),rgba(var(--ac-2-rgb),.04))}
.sv-plan-nome{font-size:16px;font-weight:700}
.sv-plan-v{font-size:30px;font-weight:800;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.sv-plan-v small{font-size:13px;font-weight:500;letter-spacing:0;color:var(--bx-text-3)}
.sv-plan-d{font-size:13.5px;line-height:1.5;color:var(--bx-text-2)}
.sv-ribbon{position:absolute;top:-10px;right:16px;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink)}
.sv-pills{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:20px}
.sv-pill{font-size:13px;padding:7px 12px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text-2)}

/* ── Quem faz ── */
.sv-quem-foto{position:relative;width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:var(--bx-surface-2);border:1px solid var(--bx-border);display:grid;place-items:center;color:var(--bx-text-3)}
.sv-quem-foto img{width:100%;height:100%;object-fit:cover}
.sv-redes{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}

/* ── Video ── */
.sv-video{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000}
.sv-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.sv-video-btn{position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;cursor:pointer;background:none}
.sv-video-btn img{object-fit:cover}
.sv-video-play{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(0,0,0,.28);color:#fff;font-size:13px;font-weight:600}
.sv-video-play span{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--ac-grad);color:var(--bx-brand-ink);box-shadow:0 10px 30px rgba(0,0,0,.5)}
.sv-clip{display:block;width:100%;max-width:280px;aspect-ratio:9/16;margin:32px auto 0;border-radius:16px;background:#000;object-fit:cover}

/* ── FAQ ── */
.sv-faq{display:grid;gap:10px}
.sv-faq details{border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.sv-faq summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:14px 18px;font-size:15.5px;font-weight:600;cursor:pointer;list-style:none}
.sv-faq summary::-webkit-details-marker{display:none}
.sv-faq summary svg{flex-shrink:0;color:var(--bx-text-3);transition:transform .15s ease}
.sv-faq details[open] summary svg{transform:rotate(180deg)}
.sv-faq p{margin:0;padding:0 18px 18px;font-size:15px;line-height:1.65;color:var(--bx-text-2)}

/* ── Tabela de graduadoras ── */
.sv-tabela{width:100%;border-collapse:collapse;font-size:15px}
.sv-tabela th,.sv-tabela td{text-align:left;padding:14px 18px;border-bottom:1px solid var(--bx-border);vertical-align:top}
.sv-tabela th{font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);font-weight:700}
.sv-tabela td:first-child{font-weight:700;white-space:nowrap;width:140px}
.sv-tabela td:last-child{color:var(--bx-text-2);line-height:1.55}
.sv-tabela tr:last-child td{border-bottom:0}

/* ── Laudo (mockup do hero do pre-grading) ── */
.sv-laudo{width:min(100%,440px);display:grid;gap:4px;padding:22px;border-radius:18px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.sv-laudo-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.sv-laudo-row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--bx-border);font-size:14px}
.sv-laudo-row:last-child{border-bottom:0}
.sv-laudo-row span{color:var(--bx-text-2)}
.sv-laudo-row b{font-variant-numeric:tabular-nums;text-align:right}
.sv-exemplo{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text-2);letter-spacing:0;text-transform:none}

/* ── CTA final ── */
.sv-final{padding:96px 0;background:radial-gradient(60% 80% at 50% 50%,rgba(var(--ac-1-rgb),0.09),transparent 70%)}
.sv-final-in{text-align:center;display:flex;flex-direction:column;align-items:center;gap:18px;max-width:680px;margin:0 auto}
.sv-final-in .sv-ctas{justify-content:center}

/* ── CTA fixo (so celular) ── */
.sv-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bx-bg) 34%);transform:translateY(0);transition:transform .2s ease,opacity .2s ease}
.sv-sticky-off{transform:translateY(110%);opacity:0;pointer-events:none}
.sv-sticky-in{max-width:560px;margin:0 auto}
.sv-sticky .sv-cta{display:flex;width:100%}

/* ── Folha (galeria) ── */
.sv-sheet{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center}
.sv-panel{position:relative;width:100%;max-width:560px;max-height:92dvh;overflow:auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-bottom:0;border-radius:22px 22px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));display:grid;gap:12px}
.sv-x{position:absolute;top:8px;right:8px;z-index:2;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(8,10,15,.6);color:#fff;cursor:pointer}
.sv-dl{display:grid;gap:8px;margin:0}
.sv-dl div{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;font-size:14px}
.sv-dl dt{color:var(--bx-text-3)}
.sv-dl dd{margin:0}

@media (min-width:769px){
  .sv-sticky{display:none}
  .sv-sheet{align-items:center}
  .sv-panel{border-radius:22px;border-bottom:1px solid var(--bx-border-2)}
}
@media (max-width:1024px){
  .sv-casos{grid-template-columns:repeat(3,minmax(0,1fr))}
  .sv-g4{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:900px){
  .sv-tl{grid-template-columns:1fr;gap:0}
  .sv-tl li{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;padding-bottom:24px}
  .sv-tl li:not(:last-child)::before{top:48px;bottom:4px;left:21px;right:auto;width:2px;height:auto}
  .sv-tl li > div > b{margin-top:10px}
}
@media (max-width:768px){
  .sv-band,.sv-band-alt{padding:64px 0}
  .sv-final{padding:64px 0 88px}
  .sv-head{margin-bottom:36px}
  .sv-hero{padding:48px 0 64px}
  .sv-hero-grid{grid-template-columns:1fr;gap:40px;text-align:center}
  .sv-hero-l{align-items:center}
  .sv-badge{align-self:center}
  .sv-ctas{flex-direction:column;align-items:stretch;width:100%}
  .sv-trust{justify-content:center}
  .sv-g3,.sv-g2{grid-template-columns:1fr;gap:16px}
  .sv-g2{gap:32px}
  .sv-casos{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .sv-card{padding:18px}
  .sv-tabela{font-size:14px}
  .sv-tabela th,.sv-tabela td{padding:12px 14px}
  .sv-tabela td:first-child{width:auto}
  .sv-regra{text-align:left}
}
@media (max-width:480px){
  .sv-g4{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .sv-cta,.sv-caso,.sv-sticky,.sv-card-hover,.sv-faq summary svg{transition:none}
  .sv-cta:hover:not(:disabled),.sv-caso:hover,.sv-card-hover:hover{transform:none}
}
`
