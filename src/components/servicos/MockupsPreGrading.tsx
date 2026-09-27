// Ilustracoes da landing do pre-grading, na linha do hero (MockupLaudo):
// a mesma carta (Charizard, Base Set), papel milimetrado, regua, lupa e luz
// rasante. Mostram o METODO, nunca um resultado: toda medida ou faixa leva o
// rotulo "Exemplo", e os slabs sao genericos (so o nome em texto, sem logo,
// cor, holograma ou etiqueta real de graduadora).
//
// Server components. O CSS vive num <style> com href + precedence (o React
// deduplica e sobe pro <head>), prefixo mp-. So token --bx-*/--ac-*, motion
// 0.15s/0.2s ease e um loop so (a varredura da superficie), desligado em
// prefers-reduced-motion.

import type { CSSProperties } from 'react'
import { LAUDO_ITENS, GRADUADORAS } from '@/lib/servicos'
import { IconCheck } from '@/components/ui/Icons'

// Mesmo URL do hero: o navegador ja tem a imagem em cache.
const CHARIZARD = 'https://images.pokemontcg.io/base1/4.png'

const GRADE = `linear-gradient(var(--bx-border) 1px,transparent 1px),linear-gradient(90deg,var(--bx-border) 1px,transparent 1px)`

const MP_CSS = `
.mp-mesa{position:relative;background-color:var(--bx-bg-elev);background-image:${GRADE};background-size:28px 28px;border:1px solid var(--bx-border);border-radius:22px;box-shadow:var(--bx-shadow);text-align:left;isolation:isolate}
.mp-rotulo{position:absolute;z-index:6;top:14px;right:16px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.mp-exemplo{display:inline-flex;align-items:center;flex-shrink:0;padding:3px 8px;border-radius:999px;border:1px solid rgba(var(--ac-1-rgb),.5);background:rgba(var(--ac-1-rgb),.10);color:var(--ac-1);font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;line-height:1.2}
.mp-medida{position:absolute;z-index:3;padding:3px 7px;border-radius:6px;background:var(--bx-bg-elev);border:1px solid rgba(var(--ac-1-rgb),.55);color:var(--ac-1);font-size:12px;font-weight:800;line-height:1.1;white-space:nowrap;font-variant-numeric:tabular-nums}
.mp-img{display:block;width:100%;height:100%;object-fit:cover;border-radius:inherit}
.mp-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.mp-regua-h,.mp-regua-v{position:absolute;opacity:.9;pointer-events:none}
.mp-regua-h{left:0;right:0;bottom:calc(100% + 9px);height:9px;border-right:1px solid var(--bx-text-3);background:repeating-linear-gradient(90deg,var(--bx-text-3) 0 1px,transparent 1px 10%) top/100% 100% no-repeat,repeating-linear-gradient(90deg,var(--bx-border-2) 0 1px,transparent 1px 2.5%) bottom/100% 55% no-repeat}
.mp-regua-v{top:0;bottom:0;right:calc(100% + 9px);width:9px;border-bottom:1px solid var(--bx-text-3);background:repeating-linear-gradient(180deg,var(--bx-text-3) 0 1px,transparent 1px 10%) left/100% 100% no-repeat,repeating-linear-gradient(180deg,var(--bx-border-2) 0 1px,transparent 1px 2.5%) right/55% 100% no-repeat}
.mp-feixe{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(70% 55% at 0% 0%,rgba(var(--ac-1-rgb),.16),transparent 70%),repeating-linear-gradient(122deg,rgba(var(--ac-1-rgb),.10) 0 1px,transparent 1px 17px);-webkit-mask-image:linear-gradient(140deg,black 8%,transparent 66%);mask-image:linear-gradient(140deg,black 8%,transparent 66%)}
.mp-escala{display:grid;grid-template-columns:repeat(10,1fr);gap:3px}
.mp-escala i{height:7px;border-radius:2px;background:var(--bx-surface-2);border:1px solid var(--bx-border)}
.mp-escala i.on{background:var(--ac-grad);border-color:transparent}
.mp-n{display:inline-grid;place-items:center;flex-shrink:0;width:24px;height:24px;border-radius:50%;background:var(--bx-bg-elev);border:1.5px solid var(--ac-1);color:var(--ac-1);font-size:12px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}

/* ── Regua separadora ── */
.mp-regua-faixa{display:block;height:10px;margin:0 0 48px;opacity:.6;border-left:1px solid var(--bx-text-3);border-right:1px solid var(--bx-text-3);background:repeating-linear-gradient(90deg,var(--bx-text-3) 0 1px,transparent 1px 40px) top/100% 100% no-repeat,repeating-linear-gradient(90deg,var(--bx-border-2) 0 1px,transparent 1px 8px) bottom/100% 55% no-repeat}

/* ── 1. Medicao da centralizacao ── */
.mp-med{container-type:inline-size}
.mp-med-mesa{display:grid;grid-template-columns:1fr;gap:28px;padding:48px 20px 24px}
.mp-med-l{display:flex;flex-direction:column;align-items:center;gap:18px;min-width:0}
.mp-med-carta{position:relative;width:62%;aspect-ratio:245/342;margin-left:14px;border-radius:4.6%/3.3%;background:var(--bx-surface-2);box-shadow:var(--bx-shadow)}
.mp-m-e{left:9%;top:38%}
.mp-m-d{right:9%;top:54%}
.mp-m-t{top:7%;left:50%;transform:translateX(-50%)}
.mp-m-b{bottom:7%;left:50%;transform:translateX(-50%)}
.mp-lados{display:flex;align-items:center;gap:12px}
.mp-lado-f{display:block;width:40px;aspect-ratio:245/342;border-radius:3px;overflow:hidden;border:1px solid var(--bx-border-2);background:var(--bx-surface-2)}
.mp-lados-t{font-size:12.5px;font-weight:600;line-height:1.4;color:var(--bx-text-2)}
/* No celular as quatro medidas saem da carta e encostam na propria cota. */
@container (max-width:639px){
  .mp-med-l{gap:34px}
  .mp-med-carta{width:54%;margin:30px 0 0}
  .mp-med-carta .mp-medida{font-size:11px;padding:2px 5px}
  .mp-m-l{display:none}
  .mp-m-e{left:auto;right:calc(100% + 14px);top:47%;transform:translateY(-50%)}
  .mp-m-d{right:auto;left:calc(100% + 6px);top:63%;transform:translateY(-50%)}
  .mp-m-t{top:auto;bottom:calc(100% + 22px);left:30%}
  .mp-m-b{bottom:auto;top:calc(100% + 6px);left:70%}
}
.mp-conta{display:flex;flex-direction:column;gap:16px;min-width:0;align-self:center;padding:18px;border-radius:16px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.mp-conta-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mp-conta-top b{font-size:16px;font-weight:800}
.mp-conta dl{margin:0;display:flex;flex-direction:column;gap:12px}
.mp-conta dl > div{display:flex;flex-direction:column;gap:4px;padding-top:12px;border-top:1px solid var(--bx-border)}
.mp-conta dt{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.mp-conta dd{margin:0;font-size:15px;line-height:1.45;color:var(--bx-text-2)}
.mp-conta dd.mp-conta-n{font-size:20px;font-weight:800;color:var(--bx-text);font-variant-numeric:tabular-nums;letter-spacing:-0.01em}
.mp-conta dd.mp-conta-n b{color:var(--ac-1)}
.mp-tol{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--bx-border)}
.mp-tol-trilho{position:relative;height:6px;margin:26px 6px 0;border-radius:999px;background:var(--bx-surface-2);border:1px solid var(--bx-border)}
.mp-tol-trilho::before{content:"";position:absolute;left:0;top:0;bottom:0;width:25%;border-radius:inherit;background:rgba(var(--ac-1-rgb),.35)}
.mp-tol-pino{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--bx-bg-elev);border:2px solid var(--ac-1)}
.mp-tol-pino span{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11.5px;font-weight:700;color:var(--ac-1)}
.mp-tol-n{display:flex;justify-content:space-between;font-size:12px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.mp-tol p{margin:2px 0 0;font-size:13px;line-height:1.5;color:var(--bx-text-2)}
@container (min-width:640px){
  .mp-med-mesa{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:40px;padding:56px 44px 36px}
  .mp-med-carta{width:min(100%,300px)}
  .mp-medida{font-size:12.5px}
}

/* ── 2. Leituras de bancada (cantos, bordas, superficie) ── */
.mp-leit{margin:0;display:flex;flex-direction:column;gap:14px;min-width:0;padding:14px;border-radius:16px;background:var(--bx-surface);border:1px solid var(--bx-border);transition:transform .2s ease,border-color .2s ease}
.mp-leit:hover{transform:translateY(-2px);border-color:var(--bx-border-2)}
.mp-leit-mesa{aspect-ratio:4/3;overflow:hidden;border-radius:14px;box-shadow:none;background-size:22px 22px}
.mp-leit-mesa .mp-rotulo{top:10px;right:12px;font-size:10.5px}
.mp-leit figcaption{display:flex;flex-direction:column;gap:6px;padding:0 6px 6px}
.mp-leit figcaption b{font-size:16px;font-weight:700}
.mp-leit figcaption span{font-size:14px;line-height:1.6;color:var(--bx-text-2)}
.mp-leit figcaption .mp-exemplo{display:none}
@media (max-width:768px){
  .mp-leit{display:grid;grid-template-columns:112px minmax(0,1fr);gap:14px;align-items:center;padding:10px}
  .mp-leit-mesa{border-radius:10px;background-size:14px 14px}
  .mp-leit-mesa .mp-rotulo{display:none}
  .mp-leit figcaption{padding:0;gap:4px}
  .mp-leit figcaption b{font-size:15px}
  .mp-leit figcaption span{font-size:13.5px;line-height:1.5}
  .mp-leit figcaption .mp-exemplo{display:inline-flex;align-self:flex-start;margin-bottom:2px;font-size:10px;padding:2px 6px}
}
/* cantos */
.mp-c-carta{position:absolute;left:10%;top:17%;width:28%;aspect-ratio:245/342;z-index:2;border-radius:4.6%/3.3%;background:var(--bx-surface-2);box-shadow:var(--bx-shadow)}
.mp-alvo{position:absolute;z-index:3;border-radius:50%;border:1.5px dashed var(--ac-1);pointer-events:none}
.mp-c-alvo{right:-13%;top:-9%;width:34%;aspect-ratio:1}
.mp-c-liga{position:absolute;z-index:2;left:40%;top:17%;width:14%;border-top:1.5px dashed rgba(var(--ac-1-rgb),.6);transform:rotate(-8deg);transform-origin:0 0}
.mp-lupa{position:absolute;left:50%;top:9%;width:40%;aspect-ratio:1;z-index:4}
.mp-lupa-vidro{position:absolute;inset:0;border-radius:50%;overflow:hidden;background-color:var(--bx-bg-elev);background-image:${GRADE};background-size:22px 22px;border:2px solid var(--bx-border-2);box-shadow:0 0 0 4px var(--bx-bg-elev),0 0 0 5.5px var(--bx-border-2),var(--bx-shadow)}
.mp-lupa-vidro img{position:absolute;width:300%;max-width:none;height:auto;left:-240%;top:38%}
.mp-lupa-vidro::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(55% 35% at 30% 20%,color-mix(in srgb,var(--bx-text) 13%,transparent),transparent 70%)}
.mp-lupa-vidro .mp-alvo{left:60%;top:38%;width:44%;aspect-ratio:1;transform:translate(-50%,-50%)}
.mp-lupa-cabo{position:absolute;left:80%;top:82%;width:13%;height:52%;transform-origin:50% 0;transform:rotate(-45deg);border-radius:999px;background:var(--bx-bg-elev);border:1.5px solid var(--bx-border-2);box-shadow:inset 0 0 0 3px var(--bx-surface-2)}
/* bordas */
.mp-b-luz{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(90deg,rgba(var(--ac-1-rgb),.18),transparent 75%)}
.mp-b-luz::before{content:"";position:absolute;left:0;top:44%;width:5%;height:34%;border-radius:0 6px 6px 0;background:var(--bx-bg-elev);border:1.5px solid var(--bx-border-2);border-left:0}
.mp-b-tira{position:absolute;z-index:2;left:12%;right:8%;top:24%;height:42%;overflow:hidden;border-radius:0 0 14px 14px;box-shadow:var(--bx-shadow);-webkit-mask-image:linear-gradient(180deg,transparent,black 38%);mask-image:linear-gradient(180deg,transparent,black 38%)}
.mp-b-tira img{position:absolute;left:0;bottom:0;width:100%;height:auto;max-width:none}
.mp-b-ponto{position:absolute;z-index:3;top:66%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--ac-1);box-shadow:0 0 0 4px rgba(var(--ac-1-rgb),.22)}
.mp-b-regua{position:absolute;left:12%;right:8%;top:74%;height:9px;opacity:.85;border-right:1px solid var(--bx-text-3);background:repeating-linear-gradient(90deg,var(--bx-text-3) 0 1px,transparent 1px 10%) top/100% 100% no-repeat,repeating-linear-gradient(90deg,var(--bx-border-2) 0 1px,transparent 1px 2.5%) bottom/100% 55% no-repeat}
/* superficie */
.mp-s-janela{position:absolute;z-index:2;left:10%;right:10%;top:12%;bottom:12%;overflow:hidden;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);box-shadow:var(--bx-shadow)}
.mp-s-janela img{position:absolute;width:160%;max-width:none;height:auto;left:-30%;top:-39%}
.mp-s-janela .mp-feixe{z-index:2}
.mp-s-janela::after{content:"";position:absolute;inset:-25%;z-index:3;pointer-events:none;background:linear-gradient(115deg,transparent 43%,rgba(var(--ac-1-rgb),.26) 50%,transparent 57%);transform:translateX(-55%);animation:mp-varre 8s ease-in-out infinite}
@keyframes mp-varre{0%,12%{transform:translateX(-55%)}58%,100%{transform:translateX(55%)}}

/* ── 3. Prancha do laudo ── */
.mp-pr{display:grid;grid-template-columns:1fr;gap:28px;align-items:center}
.mp-pr-mesa{--mp-p:18px;padding:44px var(--mp-p) 24px}
.mp-pr-col{display:flex;flex-direction:column;gap:18px}
.mp-pr-linha{position:relative;display:flex;align-items:center;gap:10px;min-width:0}
.mp-pr-fio,.mp-pr-fc{display:none}
.mp-pr-etq{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);font-size:13px;font-weight:600;color:var(--bx-text-2);white-space:nowrap}
.mp-pr-etq::before{content:"";width:7px;height:7px;border-radius:50%;border:1.5px solid var(--bx-border-2)}
.mp-pr-carta-w{position:relative;width:62%;margin:6px auto 0}
.mp-pr-carta{position:relative;aspect-ratio:245/342;border-radius:4.6%/3.3%;background:var(--bx-surface-2);box-shadow:var(--bx-shadow);transform:rotate(-3deg)}
.mp-pr-carta .mp-feixe{border-radius:inherit}
.mp-pr-carta .mp-medida{left:7%;top:47%}
.mp-pr-carta .mp-alvo{right:-9%;top:-6%;width:26%;aspect-ratio:1}
.mp-pr-mk{position:absolute;z-index:4;left:calc(100% + 12px)}
.mp-pr-mk .mp-n{position:relative;z-index:1}
.mp-pr-mk-2{top:-1%}
.mp-pr-mk-6{top:22%}
.mp-pr-mk-1{top:46%}
.mp-pr-guia{position:absolute;z-index:3;left:52%;right:-12px;top:calc(22% + 12px);border-top:1px dashed rgba(var(--ac-1-rgb),.7)}
.mp-pr-esc{display:flex;flex-direction:column;gap:7px;flex:0 1 62%;min-width:0}
.mp-pr-esc small{font-size:12.5px;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.mp-pr-pills{display:flex;flex-wrap:nowrap;align-items:center;gap:10px;flex:0 1 auto;min-width:0}
.mp-pr-pill{font-size:12px;font-weight:600;color:var(--bx-text-3);white-space:nowrap;opacity:.45;text-decoration:line-through}
.mp-pr-pill.on{display:inline-flex;align-items:center;gap:5px;padding:4px 9px 4px 7px;border-radius:6px;background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);font-weight:700;opacity:1;text-decoration:none}
@media (max-width:768px){
  .mp-pr-pills{gap:8px}
  .mp-pr-pill{font-size:11.5px}
  /* marcador 1 do lado da etiqueta 55/45, a esquerda da carta */
  .mp-pr-mk-1{left:auto;right:calc(100% + 8px)}
}
@media (max-width:359px){.mp-pr-pills{flex-wrap:wrap;row-gap:4px}}
.mp-pr-lista{list-style:none;margin:0;padding:0;display:grid;gap:18px}
.mp-pr-lista li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:4px 12px;align-items:start}
.mp-pr-lista b{display:block;font-size:15.5px;font-weight:700;line-height:24px}
.mp-pr-lista span:not(.mp-n){grid-column:2;display:block;font-size:14px;line-height:1.6;color:var(--bx-text-2)}
@media (min-width:769px){
  .mp-pr{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:48px}
  .mp-pr-mesa{--mp-p:30px;padding:52px var(--mp-p) 30px}
  .mp-pr-carta-w{width:58%;margin:6px 0 0 4%}
  .mp-pr-fio{display:block;flex:0 0 22px;align-self:center;height:1px;background:var(--ac-1);position:relative}
  .mp-pr-fio::after{content:"";position:absolute;right:-2px;top:-1.5px;width:4px;height:4px;border-radius:50%;background:var(--ac-1)}
  /* Terminal curto: marca o numero sem sugerir ligacao com a lista ao lado. */
  .mp-pr-fc{display:block;position:absolute;z-index:3;left:calc(100% + 36px);width:22px;height:1px;margin-top:12px;background:var(--ac-1)}
  .mp-pr-fc::after{content:"";position:absolute;right:-2px;top:-1.5px;width:4px;height:4px;border-radius:50%;background:var(--ac-1)}
}

/* ── 4. Slabs das graduadoras ── */
.mp-slabs{padding:28px;border-radius:22px;border:1px solid var(--bx-border);background-color:var(--bx-bg-elev);background-image:${GRADE};background-size:28px 28px}
.mp-slabs ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
.mp-slab{display:flex;flex-direction:column;gap:12px;padding:12px;border-radius:14px;border:1px solid transparent;background:color-mix(in srgb,var(--bx-bg-elev) 70%,transparent);transition:translate .2s ease,border-color .15s ease}
.mp-slab:hover{translate:0 -2px;border-color:var(--bx-border-2)}
.mp-slab-fig{position:relative;width:100%;aspect-ratio:100/170;rotate:-1.5deg}
.mp-slab:nth-child(even) .mp-slab-fig{rotate:1.5deg}
.mp-slab-fig svg{display:block;width:100%;height:100%;overflow:visible}
.mp-slab-carta{position:absolute;left:14%;top:28.8%;width:72%;height:59.3%;overflow:hidden;border-radius:3px}
.mp-slab-txt{display:flex;flex-direction:column;gap:8px;min-width:0}
.mp-slab-txt b{font-size:15px;font-weight:800;letter-spacing:.02em}
.mp-slab-txt span{font-size:14px;line-height:1.55;color:var(--bx-text-2)}
.mp-slab-fig > .mp-exemplo{position:absolute;z-index:2;left:50%;bottom:-6px;transform:translateX(-50%)}
.mp-slab-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (max-width:900px){
  .mp-slabs{padding:12px}
  .mp-slabs ul{grid-template-columns:1fr;gap:6px}
  .mp-slab{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;align-items:start;padding:10px}
  .mp-slab-fig,.mp-slab:nth-child(even) .mp-slab-fig{rotate:none}
  .mp-slab-sr{position:static;width:auto;height:auto;overflow:visible;clip:auto;white-space:normal}
  .mp-slab-fig > .mp-exemplo{position:static;display:none}
  .mp-slab-txt .mp-exemplo{display:inline-flex;align-self:flex-start}
}
@media (min-width:901px){.mp-slab-txt .mp-exemplo{display:none}}

/* ── 5. Slab aberto (carta em slab) ── */
.mp-sa{padding:44px 20px 22px}
.mp-sa-row{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:start}
.mp-sa-q{margin:0;display:flex;flex-direction:column;align-items:center;gap:10px;min-width:0}
.mp-sa-q svg{display:block;width:100%;max-height:230px;color:var(--bx-text-2)}
.mp-sa-q figcaption{font-size:12.5px;font-weight:600;line-height:1.35;text-align:center;color:var(--bx-text-2)}
.mp-sa-seta{display:block;width:26px;margin-top:90px;color:var(--ac-1)}
@media (max-width:768px){
  .mp-sa{padding:40px 12px 16px}
  .mp-sa-row{gap:4px}
  .mp-sa-q svg{max-height:112px}
  .mp-sa-q figcaption{font-size:12px}
  .mp-sa-seta{width:16px;margin-top:48px}
}

/* ── Secoes da pagina: tres saidas e carta em slab ── */
.mp-saidas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.mp-saida{display:flex;flex-direction:column;gap:14px}
.mp-saida-top{display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.mp-saida-top b{font-size:17px;font-weight:700}
.mp-saida p{margin:0;font-size:14px;line-height:1.6;color:var(--bx-text-2)}
.mp-saida .sv-link{align-self:flex-start;margin-top:-6px}
.mp-slabsec{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:48px;align-items:center}
.mp-slabsec-txt{display:flex;flex-direction:column;gap:20px;min-width:0}
@media (max-width:768px){
  .mp-saidas{grid-template-columns:1fr}
  .mp-saida-top{flex-direction:row;align-items:center}
  .mp-slabsec{grid-template-columns:1fr;gap:28px}
  .mp-slabsec-ilus{order:-1}
}

.mp-ok{display:grid;place-items:center;flex-shrink:0;border-radius:14px;color:var(--bx-text-3);background:color-mix(in srgb,var(--bx-green) 9%,transparent);border:1px solid color-mix(in srgb,var(--bx-green) 22%,transparent)}
.mp-ok svg{display:block;width:100%;height:100%}
.mp-ok-d{color:var(--bx-green)}

@media (prefers-reduced-motion:reduce){
  .mp-s-janela::after{animation:none;opacity:0}
  .mp-leit,.mp-slab{transition:none}
  .mp-leit:hover{transform:none}
  .mp-slab:hover{translate:none}
}
`

function MpStyle() {
  return <style href="bynx-mp-pregrading" precedence="medium">{MP_CSS}</style>
}

const S_ELEV: CSSProperties = { fill: 'var(--bx-bg-elev)' }
const S_AC: CSSProperties = { color: 'var(--ac-1)' }

/** Imagem da carta fora do hero: decorativa (o contexto tem role="img" + aria-label) e preguicosa. */
function Carta({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={CHARIZARD} alt="" loading="lazy" decoding="async" className={className} />
}

/** Faixa de regua que separa secoes. Decorativa. */
export function ReguaSeparador() {
  return (
    <>
      <MpStyle />
      <span className="mp-regua-faixa" aria-hidden />
    </>
  )
}

// ─── 1. MedicaoCentralizacao ─────────────────────────────────────────────────

/**
 * Close da medicao da centralizacao: carta reta, reguas, as quatro margens
 * cotadas em milimetro e a conta ao lado, com a barra de tolerancia.
 * Valores fixos de exemplo (E 3,1 / D 2,5 / T 2,8 / B 2,6 mm).
 */
export function MedicaoCentralizacao() {
  // viewBox 0 0 100 140 ~ 63 x 88 mm. 3,1 mm = 4,9; 2,5 mm = 4,0; 2,8 mm = 4,5; 2,6 mm = 4,1.
  const e = 4.9, d = 4.0, t = 4.5, b = 4.1
  const xd = 100 - d, yb = 140 - b
  return (
    <>
      <MpStyle />
      <div className="mp-med">
        <div className="mp-mesa mp-med-mesa">
          <span className="mp-rotulo">Exemplo</span>
          <div className="mp-med-l" role="img" aria-label="Exemplo de medição de centralização na frente da carta: margem esquerda de 3,1 milímetros, direita de 2,5, topo de 2,8 e base de 2,6. Frente e verso são medidos.">
            <div className="mp-med-carta">
              <span className="mp-regua-h" />
              <span className="mp-regua-v" />
              <Carta className="mp-img" />
              <svg className="mp-svg" viewBox="0 0 100 140" preserveAspectRatio="none" fill="none" aria-hidden>
                <g style={{ fill: 'rgba(var(--ac-1-rgb), 0.22)' }}>
                  <rect x="0" y="0" width={e} height="140" />
                  <rect x={xd} y="0" width={d} height="140" />
                  <rect x={e} y="0" width={xd - e} height={t} />
                  <rect x={e} y={yb} width={xd - e} height={b} />
                </g>
                <g stroke="currentColor" strokeWidth={1.2} style={S_AC}>
                  <path d={`M${e} -6V146M${xd} -6V146M-6 ${t}H106M-6 ${yb}H106`} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
                  <path d="M0 -8V148M100 -8V148M-8 0H108M-8 140H108" vectorEffect="non-scaling-stroke" />
                  {/* cotas com terminacao em T */}
                  <path d={`M0 66H${e}M0 63.5V68.5M${e} 63.5V68.5`} vectorEffect="non-scaling-stroke" />
                  <path d={`M${xd} 88H100M${xd} 85.5V90.5M100 85.5V90.5`} vectorEffect="non-scaling-stroke" />
                  <path d={`M30 0V${t}M27 0H33M27 ${t}H33`} vectorEffect="non-scaling-stroke" />
                  <path d={`M70 ${yb}V140M67 ${yb}H73M67 140H73`} vectorEffect="non-scaling-stroke" />
                </g>
              </svg>
              <span className="mp-medida mp-m-e"><span className="mp-m-l">E </span>3,1 mm</span>
              <span className="mp-medida mp-m-d"><span className="mp-m-l">D </span>2,5 mm</span>
              <span className="mp-medida mp-m-t"><span className="mp-m-l">T </span>2,8 mm</span>
              <span className="mp-medida mp-m-b"><span className="mp-m-l">B </span>2,6 mm</span>
            </div>
            <div className="mp-lados">
              <span className="mp-lado-f"><Carta className="mp-img" /></span>
              <span className="mp-lado-f">
                <svg viewBox="0 0 48 67" width="100%" height="100%" fill="none" aria-hidden>
                  <ellipse cx="24" cy="33.5" rx="15" ry="20" strokeWidth={1.5} style={{ stroke: 'var(--bx-border-2)' }} />
                  <ellipse cx="24" cy="33.5" rx="8" ry="11" strokeWidth={1.2} style={{ stroke: 'var(--bx-border-2)' }} />
                </svg>
              </span>
              <span className="mp-lados-t">Frente e verso<br />são medidos</span>
            </div>
          </div>

          <div className="mp-conta">
            <div className="mp-conta-top"><b>A conta</b><span className="mp-exemplo">Exemplo</span></div>
            <dl>
              <div><dt>Fórmula</dt><dd>Esquerda ÷ (esquerda + direita)</dd></div>
              <div><dt>Nesta carta</dt><dd className="mp-conta-n">3,1 ÷ 5,6 = 55%</dd></div>
              <div><dt>Resultado</dt><dd className="mp-conta-n">Frente: <b>55/45</b></dd></div>
            </dl>
            <div className="mp-tol">
              <div className="mp-tol-trilho">
                <span className="mp-tol-pino" style={{ left: '25%' }}><span>esta carta</span></span>
              </div>
              <div className="mp-tol-n"><span>50/50</span><span>70/30</span></div>
              <p>Cada graduadora tem o próprio limite. O laudo compara com o da indicada.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 2. LeituraBancada ───────────────────────────────────────────────────────

export type TipoLeitura = 'cantos' | 'bordas' | 'superficie'

const LEITURAS: Record<TipoLeitura, { t: string; d: string; aria: string }> = {
  cantos: {
    t: 'Cantos',
    d: 'Lupa nos quatro cantos, um por um, procurando branco e desgaste.',
    aria: 'Ilustração de exemplo: lupa sobre o canto superior direito da carta, com o canto marcado.',
  },
  bordas: {
    t: 'Bordas',
    d: 'Luz lateral ao longo dos quatro lados, procurando lasca e branco.',
    aria: 'Ilustração de exemplo: borda de baixo da carta sob luz lateral, com dois pontos marcados e uma régua.',
  },
  superficie: {
    t: 'Superfície',
    d: 'Luz rasante inclinada sobre o holo, procurando risco, marca e ondulação.',
    aria: 'Ilustração de exemplo: arte holográfica da carta sob luz rasante inclinada.',
  },
}

/** Mini mesa 4:3 com uma das leituras da bancada, mais titulo e texto curto. */
export function LeituraBancada({ tipo }: { tipo: TipoLeitura }) {
  const l = LEITURAS[tipo]
  return (
    <>
      <MpStyle />
      <figure className="mp-leit">
        <div className="mp-mesa mp-leit-mesa" role="img" aria-label={l.aria}>
          <span className="mp-rotulo">Exemplo</span>

          {tipo === 'cantos' && (
            <>
              <div className="mp-c-carta">
                <Carta className="mp-img" />
                <span className="mp-alvo mp-c-alvo" />
              </div>
              <span className="mp-c-liga" />
              <div className="mp-lupa">
                <span className="mp-lupa-cabo" />
                <div className="mp-lupa-vidro">
                  <Carta />
                  <span className="mp-alvo" />
                </div>
              </div>
            </>
          )}

          {tipo === 'bordas' && (
            <>
              <span className="mp-b-luz" />
              <div className="mp-b-tira"><Carta /></div>
              <span className="mp-b-ponto" style={{ left: '34%' }} />
              <span className="mp-b-ponto" style={{ left: '71%' }} />
              <span className="mp-b-regua" />
            </>
          )}

          {tipo === 'superficie' && (
            <div className="mp-s-janela">
              <Carta />
              <span className="mp-feixe" />
            </div>
          )}
        </div>
        <figcaption><span className="mp-exemplo">Exemplo</span><b>{l.t}</b><span>{l.d}</span></figcaption>
      </figure>
    </>
  )
}

// ─── 3. PranchaLaudo ─────────────────────────────────────────────────────────

/**
 * O laudo desenhado sobre a carta: seis marcadores numerados, na ordem de
 * LAUDO_ITENS, e a lista ao lado com os mesmos numeros. A partir de 768px,
 * cada marcador puxa uma linha de chamada ate a borda da mesa, na direcao da lista.
 */
export function PranchaLaudo() {
  const fio = <span className="mp-pr-fio" aria-hidden />
  return (
    <>
      <MpStyle />
      <div className="mp-pr">
        <div
          className="mp-mesa mp-pr-mesa"
          role="img"
          aria-label="Exemplo de laudo desenhado sobre a carta Charizard, Base Set: centralização 55/45 nas faixas laterais, canto marcado, faixa provável de 8 a 9, graduadora PSA, próximo passo graduar agora e luz rasante sobre o holo."
        >
          <span className="mp-rotulo">Exemplo</span>
          <div className="mp-pr-col">
            <div className="mp-pr-linha">
              <span className="mp-pr-etq">Graduadora: PSA</span>
              <span className="mp-n">4</span>
              {fio}
            </div>

            <div className="mp-pr-carta-w">
              <div className="mp-pr-carta">
                <Carta className="mp-img" />
                <span className="mp-feixe" />
                <svg className="mp-svg" viewBox="0 0 100 140" preserveAspectRatio="none" fill="none" aria-hidden>
                  <g style={{ fill: 'rgba(var(--ac-1-rgb), 0.28)' }}>
                    <rect x="0" y="0" width="4.95" height="140" />
                    <rect x="95.95" y="0" width="4.05" height="140" />
                  </g>
                  <g stroke="currentColor" strokeWidth={1.2} style={S_AC}>
                    <path d="M4.95 -5V145M95.95 -5V145" vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
                  </g>
                </svg>
                <span className="mp-medida">55/45</span>
                <span className="mp-alvo" />
              </div>
              <span className="mp-pr-guia" aria-hidden />
              <span className="mp-pr-mk mp-pr-mk-2"><span className="mp-n">2</span></span>
              <span className="mp-pr-fc mp-pr-mk-2" aria-hidden />
              <span className="mp-pr-mk mp-pr-mk-6"><span className="mp-n">6</span></span>
              <span className="mp-pr-fc mp-pr-mk-6" aria-hidden />
              <span className="mp-pr-mk mp-pr-mk-1"><span className="mp-n">1</span></span>
              <span className="mp-pr-fc mp-pr-mk-1" aria-hidden />
            </div>

            <div className="mp-pr-linha">
              <div className="mp-pr-esc">
                <div className="mp-escala">
                  {Array.from({ length: 10 }, (_, i) => <i key={i} className={i + 1 >= 8 && i + 1 <= 9 ? 'on' : undefined} />)}
                </div>
                <small>Faixa provável 8 a 9 · exemplo</small>
              </div>
              <span className="mp-n">3</span>
              {fio}
            </div>

            <div className="mp-pr-linha">
              <div className="mp-pr-pills">
                <span className="mp-pr-pill on"><IconCheck size={13} strokeWidth={2.4} />Graduar agora</span>
                <span className="mp-pr-pill">Restaurar antes</span>
                <span className="mp-pr-pill">Guardar</span>
              </div>
              <span className="mp-n">5</span>
              {fio}
            </div>
          </div>
        </div>

        <ol className="mp-pr-lista">
          {LAUDO_ITENS.map((it, i) => (
            <li key={it.t}>
              <span className="mp-n">{i + 1}</span>
              <b>{it.t}</b>
              <span>{it.d}</span>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

// ─── 4. SlabsGraduadoras ─────────────────────────────────────────────────────

/** Slab generico: corpo 5:8,5, cabeca com so o nome, janela 5:7 com a silhueta tracejada. */
function SlabSvg({ nome }: { nome: string }) {
  const borda: CSSProperties = { stroke: 'var(--bx-border-2)' }
  return (
    <svg viewBox="0 0 100 170" fill="none" strokeWidth={1.5} aria-hidden>
      <rect x="1" y="1" width="98" height="168" rx="6" style={{ ...S_ELEV, ...borda }} vectorEffect="non-scaling-stroke" />
      <rect x="7" y="7" width="86" height="30.6" rx="3" style={{ fill: 'var(--bx-surface-2)', ...borda }} vectorEffect="non-scaling-stroke" />
      <text x="50" y="27.5" textAnchor="middle" style={{ fill: 'var(--bx-text-2)', fontSize: 15, fontWeight: 700, letterSpacing: '0.06em' }}>{nome}</text>
      <rect x="11" y="46" width="78" height="106" rx="3" style={borda} vectorEffect="non-scaling-stroke" />
      <rect x="18" y="52" width="64" height="94" rx="3" strokeDasharray="4 3" style={{ stroke: 'var(--bx-border-2)' }} vectorEffect="non-scaling-stroke" />
      <path d="M40 160h20" style={{ stroke: 'var(--bx-border-2)' }} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** As cinco graduadoras em slabs genericos. So o nome muda; a PSA leva a carta como exemplo. */
export function SlabsGraduadoras() {
  return (
    <>
      <MpStyle />
      <div className="mp-slabs">
        <ul>
          {GRADUADORAS.map(g => {
            const dest = g.nome === 'PSA'
            return (
              <li key={g.nome} className="mp-slab">
                <div className="mp-slab-fig">
                  <SlabSvg nome={g.nome} />
                  {dest && <span className="mp-slab-carta"><Carta className="mp-img" /></span>}
                  {dest && <span className="mp-exemplo">Exemplo</span>}
                </div>
                <div className="mp-slab-txt">
                  <b className="mp-slab-sr">{g.nome}</b>
                  {dest && <span className="mp-exemplo">Exemplo</span>}
                  <span>{g.quando}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

// ─── 5. SlabAberto ───────────────────────────────────────────────────────────

function Seta() {
  return (
    <svg className="mp-sa-seta" viewBox="0 0 26 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 6h21" strokeDasharray="3 3" />
      <path d="M19 2l4 4-4 4" />
    </svg>
  )
}

/** Carta em traco (5:7) com moldura, janela de arte e linhas de texto. */
function CartaTraco({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * 1.4
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" style={S_ELEV} />
      <rect x={x + w * 0.1} y={y + h * 0.1} width={w * 0.8} height={h * 0.38} rx="1.5" style={S_AC} />
      <path d={`M${x + w * 0.1} ${y + h * 0.6}h${w * 0.8}M${x + w * 0.1} ${y + h * 0.7}h${w * 0.55}M${x + w * 0.1} ${y + h * 0.8}h${w * 0.68}`} opacity=".5" />
    </g>
  )
}

/**
 * Carta em slab com nota abaixo do esperado: slab fechado, tampa aberta com
 * estilete na junta, carta livre sob a lupa. Traco, nao foto; sem nota e sem "depois".
 */
export function SlabAberto() {
  return (
    <>
      <MpStyle />
      <div
        className="mp-mesa mp-sa"
        role="img"
        aria-label="Ilustração em três quadros: slab fechado com nota abaixo do esperado, slab aberto com cuidado usando um estilete na junta, e a carta livre sob a lupa para restauração e novo pré-grading."
      >
        <span className="mp-rotulo">Ilustração</span>
        <div className="mp-sa-row">
          <figure className="mp-sa-q">
            <svg viewBox="0 -16 130 206" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="15" y="6" width="100" height="170" rx="6" style={S_ELEV} />
              <rect x="21" y="12" width="88" height="30" rx="3" style={{ fill: 'var(--bx-surface-2)' }} />
              <path d="M30 23h44M30 32h28" opacity=".55" />
              <rect x="25" y="50" width="80" height="116" rx="3" />
              <CartaTraco x={31} y={56} w={68} />
            </svg>
            <figcaption>Nota abaixo</figcaption>
          </figure>
          <Seta />
          <figure className="mp-sa-q">
            <svg viewBox="0 -16 130 206" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {/* base do slab */}
              <path d="M15 46v124a6 6 0 006 6h88a6 6 0 006-6V46" style={S_ELEV} />
              <path d="M15 46h100" />
              <CartaTraco x={31} y={56} w={68} />
              {/* tampa deslocada 12 para cima */}
              <path d="M15 34V0a6 6 0 016-6h88a6 6 0 016 6v34z" style={S_ELEV} />
              <rect x="21" y="0" width="88" height="28" rx="3" style={{ fill: 'var(--bx-surface-2)' }} />
              <path d="M30 10h44M30 19h28" opacity=".55" />
              {/* estilete na junta, com o alvo tracejado */}
              <circle cx="80" cy="40" r="11" strokeDasharray="3 2.5" style={S_AC} />
              <g style={S_AC}>
                <path d="M80 40l28-7v14z" style={S_ELEV} strokeWidth={2} />
              </g>
              <rect x="106" y="32" width="22" height="16" rx="3" style={S_ELEV} strokeWidth={2} />
              <path d="M112 36v8M118 36v8" opacity=".5" />
            </svg>
            <figcaption>Quebra com cuidado</figcaption>
          </figure>
          <Seta />
          <figure className="mp-sa-q">
            <svg viewBox="0 -16 130 206" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 178h122" opacity=".6" />
              <g transform="rotate(-4 60 120)">
                <CartaTraco x={22} y={64} w={76} />
              </g>
              {/* lupa */}
              <circle cx="84" cy="64" r="24" style={{ fill: 'rgba(var(--ac-1-rgb), 0.08)' }} />
              <circle cx="84" cy="64" r="24" />
              <circle cx="84" cy="64" r="19" opacity=".5" />
              <path d="M101 81l18 18" strokeWidth={4} />
              <g style={S_AC} strokeWidth={2.2}>
                <path d="M84 40h.01M108 64h.01M67 47h.01" />
              </g>
            </svg>
            <figcaption>Novo pré&#8209;grading</figcaption>
          </figure>
        </div>
      </div>
    </>
  )
}

// ─── 6. CartaDentroDoLimite ──────────────────────────────────────────────────

/**
 * Carta em traco sem defeito: as quatro margens tracejadas iguais e um check.
 * Mesmo quadro e mesmo tom "ok" do DiagramaDefeito, para a saida "Graduar agora".
 */
export function CartaDentroDoLimite({ size = 60 }: { size?: number }) {
  return (
    <>
      <MpStyle />
      <span className="mp-ok" style={{ width: size, height: size }} aria-hidden>
        <svg viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <g transform="translate(0 5)">
            <rect x="15" y="4" width="30" height="42" rx="2.5" />
            <rect x="19.5" y="11" width="21" height="14" rx="1" strokeWidth={1.2} />
            <path d="M19.5 30h21M19.5 33.5h15M19.5 37h18" strokeWidth={1.1} opacity=".6" />
            <g className="mp-ok-d" strokeWidth={1.1}>
              <rect x="18" y="7" width="24" height="36" rx="1" strokeDasharray="1.6 1.6" />
              <path d="M15 50.5h3M42 50.5h3" strokeWidth={1.4} />
            </g>
          </g>
          <g className="mp-ok-d">
            <circle cx="45" cy="13" r="7" style={S_ELEV} />
            <path d="M42 13l2.2 2.2L48.2 11" strokeWidth={1.6} />
          </g>
        </svg>
      </span>
    </>
  )
}
