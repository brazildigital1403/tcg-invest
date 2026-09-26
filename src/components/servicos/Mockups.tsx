// Mockups e ilustracoes das landings de servico (restauracao e pre-grading).
//
// Regra da area: estas pecas mostram o PROCESSO (bancada, medicao, custodia),
// nunca um resultado. Nada aqui e "antes/depois" e nada simula carta
// restaurada. Onde aparece rotulo, e "Ilustração" ou "Exemplo".
//
// Server components, sem 'use client'. O CSS vive num unico <style> com
// href + precedence: o React 19 deduplica pelo href e sobe pro <head>, entao
// usar 5 componentes na mesma pagina gera um bloco so. Prefixo mk- (o sv-
// e do css.ts das landings). So token --bx-*/--ac-*, motion 0.15s/0.2s ease,
// e os dois loops (brilho da luz rasante e o ponto do REC) morrem em
// prefers-reduced-motion.

import type { CSSProperties } from 'react'

// ─── Cartas reais (mesmo host da Pokedex; next/image nao libera esse host) ───
const IMG = (id: string) => `https://images.pokemontcg.io/${id}.png`

export interface CartaMockup {
  src: string
  nome: string
}

const CARTA_BANCADA: CartaMockup = { src: IMG('swsh7/215'), nome: 'Umbreon VMAX, Evolving Skies' }
const CARTA_LAUDO: CartaMockup = { src: IMG('base1/4'), nome: 'Charizard, Base Set' }

// ─── CSS ─────────────────────────────────────────────────────────────────────
const GRADE = `linear-gradient(var(--bx-border) 1px,transparent 1px),linear-gradient(90deg,var(--bx-border) 1px,transparent 1px)`

const MK_CSS = `
.mk-mesa{position:relative;background-color:var(--bx-bg-elev);background-image:${GRADE};background-size:28px 28px;border:1px solid var(--bx-border);border-radius:22px;box-shadow:var(--bx-shadow);text-align:left;isolation:isolate}
.mk-chip{position:absolute;z-index:6;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);color:var(--bx-text-2);font-size:clamp(10.5px,2.8cqi,12.5px);font-weight:600;line-height:1;white-space:nowrap;box-shadow:0 6px 18px -8px var(--bx-bg)}
.mk-chip b{color:var(--bx-text);font-weight:700;font-variant-numeric:tabular-nums}
.mk-chip small{font-size:inherit;color:var(--bx-text-3);font-weight:500;font-variant-numeric:tabular-nums}
.mk-chip svg{flex-shrink:0;color:var(--ac-1)}
.mk-rotulo{position:absolute;z-index:6;font-size:clamp(9.5px,2.4cqi,11px);font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}

/* ── Bancada (hero da restauracao) ── */
.mk-bench{width:min(100%,440px);aspect-ratio:10/11;container-type:inline-size;overflow:hidden}
.mk-feixe{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(70% 55% at 0% 0%,rgba(var(--ac-1-rgb),.16),transparent 70%),repeating-linear-gradient(122deg,rgba(var(--ac-1-rgb),.10) 0 1px,transparent 1px 17px);-webkit-mask-image:linear-gradient(140deg,black 8%,transparent 66%);mask-image:linear-gradient(140deg,black 8%,transparent 66%)}
.mk-carta-w{position:absolute;left:11%;top:15%;width:50%;aspect-ratio:245/342;z-index:2;transform:rotate(-5deg)}
.mk-carta{position:relative;width:100%;height:100%;overflow:hidden;border-radius:4.6%/3.3%;background:var(--bx-surface-2);box-shadow:var(--bx-shadow)}
.mk-carta img,.mk-lau-img img{display:block;width:100%;height:100%;object-fit:cover}
.mk-carta::after{content:"";position:absolute;inset:-25%;pointer-events:none;background:linear-gradient(115deg,transparent 43%,rgba(var(--ac-1-rgb),.22) 50%,transparent 57%);transform:translateX(-14%);animation:mk-varre 8s ease-in-out infinite}
@keyframes mk-varre{0%,12%{transform:translateX(-55%)}58%,100%{transform:translateX(55%)}}
.mk-lupa{position:absolute;left:52%;top:6%;width:39%;aspect-ratio:1;z-index:4}
.mk-lupa-vidro{position:absolute;inset:0;border-radius:50%;overflow:hidden;background-color:var(--bx-bg-elev);background-image:${GRADE};background-size:56px 56px;border:2px solid var(--bx-border-2);box-shadow:0 0 0 5px var(--bx-bg-elev),0 0 0 6.5px var(--bx-border-2),var(--bx-shadow)}
.mk-lupa-vidro img{position:absolute;width:250%;max-width:none;height:auto;left:-190%;top:30%;transform-origin:100% 0;transform:rotate(-5deg)}
.mk-lupa-vidro::after{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(55% 35% at 30% 20%,color-mix(in srgb,var(--bx-text) 13%,transparent),transparent 70%)}
.mk-lupa-cabo{position:absolute;left:79.5%;top:82%;width:12%;height:46%;transform-origin:50% 0;transform:rotate(-45deg);border-radius:999px;background:var(--bx-bg-elev);border:1.5px solid var(--bx-border-2);box-shadow:inset 0 0 0 3px var(--bx-surface-2)}
.mk-lupa-x{position:absolute;left:8%;bottom:10%;z-index:1}
.mk-luz{left:4%;top:4%}
.mk-ilus{right:4%;top:3.4%}
.mk-higro{right:4%;top:55%}
.mk-higro i{width:6px;height:6px;border-radius:50%;background:var(--bx-green);flex-shrink:0}
.mk-tag{position:absolute;left:5%;bottom:6%;z-index:5;transform:rotate(-4deg);display:flex;flex-direction:column;gap:4px;padding:9px 13px 9px 24px;border-radius:7px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.mk-tag::before{content:"";position:absolute;left:8px;top:50%;width:7px;height:7px;margin-top:-3.5px;border-radius:50%;border:1.5px solid var(--bx-border-2)}
.mk-tag span{font-size:clamp(8.5px,2.2cqi,10px);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1)}
.mk-tag b{font-size:clamp(12.5px,3.4cqi,15px);font-weight:800;letter-spacing:.02em;color:var(--bx-text);font-variant-numeric:tabular-nums;line-height:1.1}
.mk-barras{display:block;height:9px;opacity:.7;background:repeating-linear-gradient(90deg,var(--bx-text-2) 0 1px,transparent 1px 3px,var(--bx-text-2) 3px 5px,transparent 5px 6px,var(--bx-text-2) 6px 7px,transparent 7px 10px)}
.mk-prensa{position:absolute;right:4%;bottom:4%;width:39%;z-index:3;display:flex;flex-direction:column;align-items:center;gap:4px}
.mk-prensa svg{width:100%;height:auto;display:block}
.mk-prensa .mk-rotulo{position:static}

/* ── Laudo (hero do pre-grading) ── */
.mk-lau{position:relative;width:min(100%,460px);container-type:inline-size;text-align:left}
.mk-lau .mk-mesa{padding:10% 0 12% 9%}
.mk-lau-carta{position:relative;width:50%}
.mk-lau-img{position:relative;aspect-ratio:245/342;border-radius:4.6%/3.3%;background:var(--bx-surface-2);box-shadow:var(--bx-shadow)}
.mk-lau-img img{border-radius:inherit}
.mk-lau-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.mk-regua-h,.mk-regua-v{position:absolute;opacity:.9}
.mk-regua-h{left:0;right:0;bottom:calc(100% + 9px);height:9px;border-right:1px solid var(--bx-text-3);background:repeating-linear-gradient(90deg,var(--bx-text-3) 0 1px,transparent 1px 10%) top/100% 100% no-repeat,repeating-linear-gradient(90deg,var(--bx-border-2) 0 1px,transparent 1px 2.5%) bottom/100% 55% no-repeat}
.mk-regua-v{top:0;bottom:0;right:calc(100% + 9px);width:9px;border-bottom:1px solid var(--bx-text-3);background:repeating-linear-gradient(180deg,var(--bx-text-3) 0 1px,transparent 1px 10%) left/100% 100% no-repeat,repeating-linear-gradient(180deg,var(--bx-border-2) 0 1px,transparent 1px 2.5%) right/55% 100% no-repeat}
.mk-medida{position:absolute;z-index:2;top:27%;padding:3px 7px;border-radius:6px;background:var(--bx-bg-elev);border:1px solid rgba(var(--ac-1-rgb),.55);color:var(--ac-1);font-size:clamp(10px,2.7cqi,12.5px);font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.mk-medida-e{left:9%}
.mk-medida-d{right:9%}
.mk-lau .mk-ilus{top:3%;right:4%}
.mk-ficha{position:absolute;right:3%;top:50%;transform:translateY(-50%);width:37%;z-index:3;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow);font-size:clamp(10.5px,2.6cqi,12px)}
.mk-ficha-top{display:flex;flex-direction:column;align-items:flex-start;gap:7px;font-weight:700;font-size:1.08em;line-height:1.25;color:var(--bx-text)}
.mk-exemplo{flex-shrink:0;padding:3px 7px;border-radius:999px;border:1px solid rgba(var(--ac-1-rgb),.5);background:rgba(var(--ac-1-rgb),.10);color:var(--ac-1);font-size:.8em;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.mk-ficha-carta{color:var(--bx-text-3);font-size:.92em;margin-top:-6px}
.mk-ficha dl{margin:0;display:flex;flex-direction:column;gap:6px;padding-top:10px;border-top:1px solid var(--bx-border)}
.mk-ficha dl div{display:flex;justify-content:space-between;gap:8px}
.mk-ficha dt{color:var(--bx-text-2)}
.mk-ficha dd{margin:0;color:var(--bx-text);font-weight:700;font-variant-numeric:tabular-nums;text-align:right}
.mk-ficha-sec{font-size:.8em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.mk-faixa{display:flex;flex-direction:column;gap:6px;padding-top:10px;border-top:1px solid var(--bx-border)}
.mk-faixa-l{display:flex;justify-content:space-between;align-items:baseline;gap:8px;color:var(--bx-text-2)}
.mk-faixa-l b{font-size:1.3em;font-weight:800;color:var(--bx-text);font-variant-numeric:tabular-nums}
.mk-escala{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}
.mk-escala i{height:6px;border-radius:2px;background:var(--bx-surface-2);border:1px solid var(--bx-border)}
.mk-escala i.on{background:var(--ac-grad);border-color:transparent}
.mk-escala-n{display:flex;justify-content:space-between;font-size:.78em;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.mk-grad{display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--bx-border);color:var(--bx-text-2)}
.mk-grad b{padding:3px 9px;border-radius:7px;background:var(--bx-surface-2);border:1px solid var(--bx-border-2);color:var(--bx-text);font-weight:800;letter-spacing:.04em}
@container (max-width:419px){
  .mk-lau .mk-mesa{padding:13% 0 24% 16%}
  .mk-lau-carta{width:62%}
  .mk-ficha{position:relative;top:auto;right:auto;transform:none;width:86%;margin:-18% 4% 0 auto;font-size:12px}
  .mk-ficha-top{flex-direction:row-reverse;align-items:center;justify-content:space-between}
}

/* ── Diagrama de defeito (listas resolve / atenua / nao resolve) ── */
.mk-def{--mk-tom:var(--bx-text-2);display:grid;place-items:center;flex-shrink:0;border-radius:14px;color:var(--bx-text-3);background:color-mix(in srgb,var(--mk-tom) 9%,transparent);border:1px solid color-mix(in srgb,var(--mk-tom) 22%,transparent);transition:border-color .2s ease,background .2s ease}
.mk-def svg{display:block;width:100%;height:100%}
.mk-def .mk-d{color:var(--mk-tom)}
.mk-def-ok{--mk-tom:var(--bx-green)}
.mk-def-mid{--mk-tom:var(--ac-1)}
.mk-def-bad{--mk-tom:var(--bx-red)}
.sv-li:has(> .mk-def){grid-template-columns:auto minmax(0,1fr);gap:14px}

/* ── Ilustracoes (Quem faz, Custodia) ── */
.mk-ilustra{display:block;width:100%;height:100%;color:var(--bx-text-2)}
.mk-custodia{display:block;width:min(100%,560px);height:auto;margin:40px auto 0;color:var(--bx-text-2)}
.mk-rec{animation:mk-rec 1.6s ease-in-out infinite}
@keyframes mk-rec{0%,100%{opacity:1}50%{opacity:.3}}

@media (prefers-reduced-motion:reduce){
  .mk-carta::after,.mk-rec{animation:none}
}
`

function MkStyle() {
  return <style href="bynx-mk-servicos" precedence="medium">{MK_CSS}</style>
}

// Estilos de SVG por token. Presentation attribute nao aceita var() com
// garantia em todo navegador, por isso vai em style.
const S_ELEV: CSSProperties = { fill: 'var(--bx-bg-elev)' }
const S_AC: CSSProperties = { color: 'var(--ac-1)' }
const S_FRACO: CSSProperties = { color: 'var(--bx-text-3)' }

// ─── Icones pequenos dos chips ───────────────────────────────────────────────
function IcLuz() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4.5l5-2.5 1.2 2.4-5 2.5z" />
      <path d="M5.2 6.2l1.6 3.2" />
      <path d="M8.5 7.5l5.5 3M8 10l5 4M9.5 5.5L14.5 7" opacity=".7" />
    </svg>
  )
}

function IcGota() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden>
      <path d="M8 1.8S3.5 7 3.5 10a4.5 4.5 0 009 0C12.5 7 8 1.8 8 1.8z" />
    </svg>
  )
}

// ─── 1. MockupBancada ────────────────────────────────────────────────────────

export interface MockupBancadaProps {
  /** Carta real na bancada. Padrao: Umbreon VMAX (Evolving Skies). */
  carta?: CartaMockup
  /** Numero de custodia da etiqueta. */
  codigo?: string
  /** Umidade relativa do chip do higrometro, em %. */
  umidade?: number
  /** Temperatura do chip do higrometro, em graus Celsius. */
  temperatura?: number
}

/**
 * Hero da restauracao: carta real na bancada, sob luz rasante, com lupa sobre
 * o canto, etiqueta de custodia, higrometro e prensa. Mostra o processo, nao
 * resultado. Fica no lugar do slider enquanto nao houver caso real.
 */
export function MockupBancada({
  carta = CARTA_BANCADA, codigo = 'BX-R-0001', umidade = 45, temperatura = 21,
}: MockupBancadaProps) {
  return (
    <>
      <MkStyle />
      <div
        className="mk-mesa mk-bench"
        role="img"
        aria-label={`Ilustração da bancada de restauração: carta ${carta.nome} sob luz rasante, lupa sobre o canto da carta, etiqueta de custódia ${codigo}, higrômetro marcando ${umidade}% de umidade e prensa com placas de pressão.`}
      >
        <div className="mk-feixe" />

        <span className="mk-chip mk-luz"><IcLuz /> Luz rasante</span>
        <span className="mk-rotulo mk-ilus">Ilustração</span>

        <div className="mk-carta-w">
          <div className="mk-carta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={carta.src} alt="" fetchPriority="high" decoding="async" />
          </div>
        </div>

        <div className="mk-lupa">
          <span className="mk-lupa-cabo" />
          <div className="mk-lupa-vidro">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={carta.src} alt="" fetchPriority="high" decoding="async" />
          </div>
        </div>

        <span className="mk-chip mk-higro"><IcGota /> <b>UR {umidade}%</b> <small>{temperatura} °C</small> <i /></span>

        <div className="mk-tag">
          <span>Custódia</span>
          <b>{codigo}</b>
          <i className="mk-barras" />
        </div>

        <div className="mk-prensa">
          <PrensaSvg />
          <span className="mk-rotulo">Placas de pressão</span>
        </div>
      </div>
    </>
  )
}

/** Prensa de bancada vista de lado: fuso, travessa, colunas e placas com a carta entre mata-borroes. */
function PrensaSvg() {
  return (
    <svg viewBox="0 0 160 98" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--bx-text-2)' }} aria-hidden>
      <path d="M52 6h56" />
      <circle cx="50" cy="6" r="3.5" style={S_ELEV} />
      <circle cx="110" cy="6" r="3.5" style={S_ELEV} />
      <rect x="16" y="28" width="8" height="60" rx="1.5" style={S_ELEV} />
      <rect x="136" y="28" width="8" height="60" rx="1.5" style={S_ELEV} />
      <rect x="10" y="18" width="140" height="10" rx="3" style={S_ELEV} />
      <rect x="77" y="6" width="6" height="46" rx="1" style={S_ELEV} />
      <path d="M77 34l6-2M77 39l6-2M77 44l6-2" opacity=".6" />
      <g style={S_AC}>
        <path d="M44 36v9M41 42l3 3 3-3M116 36v9M113 42l3 3 3-3" />
      </g>
      <rect x="24" y="52" width="112" height="9" rx="2" style={S_ELEV} />
      <rect x="30" y="61" width="100" height="5" rx="1" strokeDasharray="2 2" opacity=".7" />
      <rect x="40" y="66" width="80" height="2.6" rx="1" stroke="none" style={{ fill: 'var(--ac-1)' }} />
      <rect x="30" y="68.6" width="100" height="5" rx="1" strokeDasharray="2 2" opacity=".7" />
      <rect x="10" y="73.6" width="140" height="12" rx="3" style={S_ELEV} />
      <path d="M16 90h12M132 90h12" />
    </svg>
  )
}

// ─── 2. MockupLaudo ──────────────────────────────────────────────────────────

export interface MockupLaudoProps {
  /** Carta real medida. Padrao: Charizard (Base Set). */
  carta?: CartaMockup
  /** Centralizacao da frente, esquerda/direita, formato "55/45". */
  frente?: string
  /** Centralizacao do verso, formato "60/40". */
  verso?: string
  /** Faixa provavel [min, max], de 1 a 10. */
  faixa?: [number, number]
  /** Graduadora indicada no exemplo. */
  graduadora?: string
}

function partes(r: string): [number, number] {
  const [a, b] = r.split('/').map(n => Number(n))
  return Number.isFinite(a) && Number.isFinite(b) && a + b > 0 ? [a, b] : [50, 50]
}

/**
 * Hero do pre-grading: carta real com reguas e as bordas medidas (faixas da
 * borda esquerda e direita em destaque), mais a ficha do laudo por cima.
 * Marcado como "Exemplo" na propria ficha.
 */
export function MockupLaudo({
  carta = CARTA_LAUDO, frente = '55/45', verso = '60/40', faixa = [8, 9], graduadora = 'PSA',
}: MockupLaudoProps) {
  // Geometria no viewBox 0 0 100 140 (proporcao da carta). A soma das bordas
  // laterais fica em ~9% da largura e a das bordas de cima e de baixo em ~9,5
  // unidades, perto de uma carta real; a divisao segue a proporcao informada.
  const [e, d] = partes(frente)
  const bordaE = (9 * e) / (e + d)
  const bordaD = 9 - bordaE
  const topo = 5
  const base = 4.5
  const [fMin, fMax] = faixa
  const faixaTxt = fMin === fMax ? `${fMin}` : `${fMin} a ${fMax}`

  return (
    <>
      <MkStyle />
      <div
        className="mk-lau"
        role="img"
        aria-label={`Exemplo de laudo de pré-grading: carta ${carta.nome} com a centralização medida por régua, ${frente} na frente e ${verso} no verso, faixa provável de nota ${faixaTxt} e graduadora indicada ${graduadora}.`}
      >
        <div className="mk-mesa">
          <span className="mk-rotulo mk-ilus">Exemplo</span>
          <div className="mk-lau-carta">
            <span className="mk-regua-h" />
            <span className="mk-regua-v" />
            <div className="mk-lau-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={carta.src} alt="" fetchPriority="high" decoding="async" />
              <svg className="mk-lau-svg" viewBox="0 0 100 140" preserveAspectRatio="none" fill="none" aria-hidden>
                <g style={{ fill: 'rgba(var(--ac-1-rgb), 0.28)' }}>
                  <rect x="0" y="0" width={bordaE} height="140" />
                  <rect x={100 - bordaD} y="0" width={bordaD} height="140" />
                </g>
                <g style={{ fill: 'rgba(var(--ac-1-rgb), 0.12)' }}>
                  <rect x={bordaE} y="0" width={100 - bordaE - bordaD} height={topo} />
                  <rect x={bordaE} y={140 - base} width={100 - bordaE - bordaD} height={base} />
                </g>
                <g stroke="currentColor" strokeWidth={1.2} vectorEffect="non-scaling-stroke" style={S_AC}>
                  <path d={`M${bordaE} -6V146M${100 - bordaD} -6V146M-6 ${topo}H106M-6 ${140 - base}H106`} vectorEffect="non-scaling-stroke" strokeDasharray="4 3" />
                  <path d="M0 -8V148M100 -8V148M-8 0H108M-8 140H108" vectorEffect="non-scaling-stroke" />
                </g>
                <g stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" style={S_FRACO}>
                  <path d="M50 8V132" vectorEffect="non-scaling-stroke" strokeDasharray="2 4" />
                </g>
              </svg>
              <span className="mk-medida mk-medida-e">{e}</span>
              <span className="mk-medida mk-medida-d">{d}</span>
            </div>
          </div>
        </div>

        <div className="mk-ficha">
          <div className="mk-ficha-top"><span className="mk-exemplo">Exemplo</span><span>Laudo de pré-grading</span></div>
          <span className="mk-ficha-carta">{carta.nome}</span>
          <dl>
            <div><dt className="mk-ficha-sec">Centralização</dt></div>
            <div><dt>Frente</dt><dd>{frente}</dd></div>
            <div><dt>Verso</dt><dd>{verso}</dd></div>
            <div><dt>Superfície</dt><dd>Sem risco</dd></div>
          </dl>
          <div className="mk-faixa">
            <div className="mk-faixa-l"><span>Faixa provável</span><b>{faixaTxt}</b></div>
            <div className="mk-escala">
              {Array.from({ length: 10 }, (_, i) => <i key={i} className={i + 1 >= fMin && i + 1 <= fMax ? 'on' : undefined} />)}
            </div>
            <div className="mk-escala-n"><span>1</span><span>10</span></div>
          </div>
          <div className="mk-grad"><span>Graduadora</span><b>{graduadora}</b></div>
        </div>
      </div>
    </>
  )
}

// ─── 3. DiagramaDefeito ──────────────────────────────────────────────────────

export type TipoDefeito =
  | 'ondulada' | 'amassado' | 'superficie' | 'sujeira'
  | 'vinco'
  | 'canto_branco' | 'arranhao_holo' | 'rasgo' | 'centralizacao'

export type TomDefeito = 'ok' | 'mid' | 'bad'

const TOM_PADRAO: Record<TipoDefeito, TomDefeito> = {
  ondulada: 'ok', amassado: 'ok', superficie: 'ok', sujeira: 'ok',
  vinco: 'mid',
  canto_branco: 'bad', arranhao_holo: 'bad', rasgo: 'bad', centralizacao: 'bad',
}

/** Titulo de cada item de RESOLVE / ATENUA / NAO_RESOLVE (src/lib/servicos.ts) -> tipo do diagrama. */
export const DEFEITO_POR_TITULO: Record<string, TipoDefeito> = {
  'Carta ondulada': 'ondulada',
  'Amassado sem papel rompido': 'amassado',
  'Superfície levantada por pressão': 'superficie',
  'Sujeira de manuseio': 'sujeira',
  'Vinco com fibra rompida': 'vinco',
  'Borda ou canto branco': 'canto_branco',
  'Arranhão no holo': 'arranhao_holo',
  'Rasgo, furo ou carta abrindo em camadas': 'rasgo',
  'Centralização e defeito de fábrica': 'centralizacao',
}

export interface DiagramaDefeitoProps {
  tipo: TipoDefeito
  /** Cor do defeito: ok = verde, mid = acento, bad = vermelho. Padrao: pela coluna do tipo. */
  tom?: TomDefeito
  /** Lado do quadrado, em px. Padrao 60. */
  size?: number
}

/**
 * Carta estilizada (5:7, moldura e janela de arte) com o defeito desenhado.
 * Vai no lugar do icone pequeno nas listas. Decorativo: o titulo ao lado ja diz o defeito.
 */
export function DiagramaDefeito({ tipo, tom, size = 60 }: DiagramaDefeitoProps) {
  const t = tom ?? TOM_PADRAO[tipo]
  const ondulada = tipo === 'ondulada'
  // Carta no viewBox 60x60: x 15..45, y 4..46 (30x42 = 5:7). Todas as
  // variantes, menos a ondulada, descem 5 pra centralizar; a ondulada usa o
  // espaco de baixo pro perfil lateral.
  const dy = ondulada ? 0 : 5
  const molduraX = tipo === 'centralizacao' ? 16.4 : 17.5
  const molduraW = tipo === 'centralizacao' ? 22.6 : 25

  return (
    <>
      <MkStyle />
      <span className={`mk-def mk-def-${t}`} style={{ width: size, height: size }} aria-hidden>
        <svg viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <g transform={`translate(0 ${dy})`}>
            {ondulada
              ? <path d="M17 4h26q2 0 2 2c2.2 6.4-1.6 12.4 0 19s-2.2 12.6 0 19q0 2-2 2H17q-2 0-2-2c-2.2-6.4 1.6-12.4 0-19s2.2-12.6 0-19q0-2 2-2z" />
              : <rect x="15" y="4" width="30" height="42" rx="2.5" />}
            <rect x={molduraX} y="6.5" width={molduraW} height="37" rx="1" strokeWidth={1} opacity=".55" />
            <rect x="19.5" y="11" width="21" height="14" rx="1" strokeWidth={1.2} />
            <path d="M19.5 8.8h11M19.5 30h21M19.5 33.5h15M19.5 37h18" strokeWidth={1.1} opacity=".6" />

            <g className="mk-d">
              {tipo === 'ondulada' && (
                <path d="M12 53.5c3-3.2 6-3.2 9 0s6 3.2 9 0 6-3.2 9 0 6 3.2 9 0" />
              )}
              {tipo === 'amassado' && (
                <>
                  <path d="M22 27.5l5 4.2-2.6 3.6 6 3.2-2 3.6 5.2 2.4" />
                  <path d="M31 34.8l6.5-2.6 3 3.4M25.5 38.4l-4 2" strokeWidth={1.2} />
                </>
              )}
              {tipo === 'superficie' && (
                <>
                  <ellipse cx="30" cy="19" rx="6.5" ry="3.8" />
                  <path d="M26.6 17.6q1.6-1.3 3.6-1.3" strokeWidth={1.1} />
                  <path d="M23 12.6q7-4.2 14 0" strokeDasharray="1.6 1.8" strokeWidth={1.1} />
                </>
              )}
              {tipo === 'sujeira' && (
                <>
                  <path d="M29.5 39.5c0-4.4 2.4-8 5.5-8s5.5 3.6 5.5 8" />
                  <path d="M31.8 39.5c0-3 1.4-5.4 3.2-5.4s3.2 2.4 3.2 5.4" strokeWidth={1.2} />
                  <path d="M34 39.5c0-1.4.4-2.6 1-2.6s1 1.2 1 2.6" strokeWidth={1.1} />
                  <path d="M21.5 40.5h.01M24 42.5h.01M22 27.5h.01M40 27.8h.01" strokeWidth={2.2} />
                </>
              )}
              {tipo === 'vinco' && (
                <>
                  <path d="M15 20l30 14" strokeWidth={1.7} />
                  <path d="M21.7 21.4l-1.4 2.9M27.7 24.2l-1.4 2.9M33.7 27l-1.4 2.9M39.7 29.8l-1.4 2.9" strokeWidth={1.1} />
                </>
              )}
              {tipo === 'canto_branco' && (
                <>
                  <path d="M38.5 4h4q2.5 0 2.5 2.5v4.5" strokeWidth={3} />
                  <path d="M15 38.5v5q0 2.5 2.5 2.5h4" strokeWidth={3} />
                  <path d="M28 46h5" strokeWidth={3} />
                </>
              )}
              {tipo === 'arranhao_holo' && (
                <>
                  <g opacity=".45" strokeWidth={0.9}>
                    <path d="M21 25l14-14M27 25l13.5-13.5M19.5 20.5L29 11M33 25l7.5-7.5M19.5 14.5L23 11" />
                  </g>
                  <path d="M21 14.5q9 3.5 18.5 9" />
                  <path d="M23.5 22l8-4.2" strokeWidth={1.1} />
                </>
              )}
              {tipo === 'rasgo' && (
                <>
                  <path d="M45 20.5l-4.6 2.6 1.8 2-5.2 2.2 1.6 2-5.4 2.2" />
                  <path d="M45 25l-3.4 2.2 1.2 1.6" strokeWidth={1.1} />
                </>
              )}
              {tipo === 'centralizacao' && (
                <>
                  <rect x="39" y="4" width="6" height="42" rx=".5" stroke="none" style={{ fill: 'currentColor', opacity: 0.18 }} />
                  <path d="M39 4v42" strokeDasharray="1.6 1.6" strokeWidth={1.1} />
                  <path d="M39.6 50.5h4.8M15 50.5h1.4" strokeWidth={1.4} />
                </>
              )}
            </g>
          </g>
        </svg>
      </span>
    </>
  )
}

// ─── 4. IlustracaoBancada ────────────────────────────────────────────────────

/**
 * Bancada em traco outline para a secao "Quem faz": prensa, higrometro, copo
 * com pinca, sleeve e toploader, e lupa articulada sobre uma carta. Preenche
 * a caixa 4:3 (.sv-quem-foto) enquanto nao houver foto da bancada.
 */
export function IlustracaoBancada() {
  return (
    <>
      <MkStyle />
      <svg className="mk-ilustra" viewBox="0 36 480 300" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* luminaria de luz rasante, presa na borda, mirando a carta */}
        <path d="M480 58l-30 10" strokeWidth={2.2} />
        <path d="M426 66l26-10 8 18-26 10z" style={S_ELEV} />
        <g style={S_AC} opacity=".5" strokeWidth={1.2} strokeDasharray="3 6">
          <path d="M428 84L352 204M438 82L366 208M448 80L380 212" />
        </g>

        {/* tampo */}
        <path d="M14 290h452" />
        <path d="M14 300h452" opacity=".35" />

        {/* prensa */}
        <path d="M58 118h74" />
        <circle cx="56" cy="118" r="4.5" style={S_ELEV} />
        <circle cx="134" cy="118" r="4.5" style={S_ELEV} />
        <rect x="36" y="150" width="10" height="130" rx="2" style={S_ELEV} />
        <rect x="134" y="150" width="10" height="130" rx="2" style={S_ELEV} />
        <rect x="28" y="138" width="124" height="14" rx="4" style={S_ELEV} />
        <rect x="86" y="112" width="8" height="84" rx="1.5" style={S_ELEV} />
        <path d="M86 164l8-3M86 172l8-3M86 180l8-3M86 188l8-3" opacity=".55" />
        <g style={S_AC}><path d="M62 170v12M58 178l4 4 4-4M118 170v12M114 178l4 4 4-4" /></g>
        <rect x="44" y="196" width="92" height="14" rx="3" style={S_ELEV} />
        <rect x="50" y="210" width="80" height="8" rx="1.5" strokeDasharray="3 3" opacity=".7" />
        <rect x="60" y="218" width="60" height="3.5" rx="1" stroke="none" style={{ fill: 'var(--ac-1)' }} />
        <rect x="50" y="221.5" width="80" height="8" rx="1.5" strokeDasharray="3 3" opacity=".7" />
        <rect x="28" y="229.5" width="124" height="18" rx="4" style={S_ELEV} />
        <path d="M34 247.5v42.5M146 247.5v42.5" />

        {/* higrometro */}
        <rect x="164" y="232" width="50" height="58" rx="8" style={S_ELEV} />
        <rect x="171" y="240" width="36" height="24" rx="4" />
        <text x="189" y="256.5" textAnchor="middle" stroke="none" style={{ fill: 'var(--ac-1)', fontSize: 12, fontWeight: 700 }}>45%</text>
        <text x="189" y="280" textAnchor="middle" stroke="none" style={{ fill: 'var(--bx-text-3)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>UR</text>

        {/* copo com pinca e pincel */}
        <path d="M226 170l7 50M240 170l-5 50" />
        <path d="M243 220l7-44" />
        <path d="M250 176l-1.5-8 5 1z" strokeWidth={1.2} />
        <path d="M224 218h26l-3 72h-20z" style={S_ELEV} />
        <path d="M226.5 234h21" opacity=".4" />

        {/* sleeve e toploader */}
        <rect x="270" y="214" width="50" height="76" rx="3" strokeDasharray="4 3" opacity=".75" />
        <rect x="262" y="206" width="54" height="84" rx="3" style={S_ELEV} />
        <path d="M262 214h54" />
        <rect x="270" y="222" width="38" height="60" rx="2" opacity=".55" />

        {/* carta no suporte, sob a lupa */}
        <rect x="330" y="212" width="48" height="67" rx="3" style={S_ELEV} />
        <rect x="334" y="216" width="40" height="59" rx="1.5" opacity=".5" />
        <rect x="337" y="222" width="34" height="22" rx="1" style={S_AC} />
        <path d="M337 252h34M337 258h24M337 264h28" opacity=".45" />
        <rect x="322" y="279" width="64" height="11" rx="3" style={S_ELEV} />

        {/* lupa articulada */}
        <rect x="396" y="280" width="62" height="10" rx="5" style={S_ELEV} />
        <path d="M428 280l10-104-54 32" strokeWidth={2.2} />
        <circle cx="438" cy="176" r="4" style={S_ELEV} />
        <circle cx="354" cy="226" r="31" style={{ fill: 'rgba(var(--ac-1-rgb), 0.06)' }} />
        <circle cx="354" cy="226" r="31" />
        <circle cx="354" cy="226" r="25" opacity=".5" />
        <g style={S_AC} strokeWidth={2}>
          <path d="M354 195h.01M375.9 204.1h.01M385 226h.01M332.1 204.1h.01M323 226h.01" />
        </g>
        <path d="M340 212q6-5 14-5" opacity=".6" strokeWidth={1.2} />
      </svg>
    </>
  )
}

// ─── 5. IlustracaoCustodia ───────────────────────────────────────────────────

/** Barras do codigo da etiqueta (x relativo, largura). Fixas: nao e codigo de verdade. */
const BARRAS: Array<[number, number]> = [
  [0, 2], [4, 1], [7, 3], [12, 1], [15, 1], [18, 2], [22, 3], [27, 1], [30, 2], [34, 1], [37, 3], [42, 1],
  [45, 2], [49, 1], [52, 1], [55, 3], [60, 2], [64, 1], [67, 2], [71, 3], [76, 1], [79, 2], [83, 1], [86, 3],
  [91, 1], [94, 2], [98, 1], [101, 3], [106, 1], [109, 2], [113, 1], [116, 2],
]

export interface IlustracaoCustodiaProps {
  /** Numero de custodia na etiqueta do pacote. */
  codigo?: string
}

/**
 * Pacote com etiqueta de custodia sendo aberto na frente do celular gravando
 * (ponto de REC). Decorativo: o texto da secao ja explica a custodia.
 */
export function IlustracaoCustodia({ codigo = 'BX-R-0001' }: IlustracaoCustodiaProps) {
  return (
    <>
      <MkStyle />
      <svg className="mk-custodia" viewBox="0 0 480 310" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 292h452" opacity=".6" />

        {/* carta no toploader saindo do pacote */}
        <g transform="rotate(-8 150 120)">
          <rect x="124" y="78" width="54" height="76" rx="3" style={S_ELEV} />
          <path d="M124 86h54" opacity=".6" />
          <rect x="131" y="92" width="40" height="56" rx="2" style={S_AC} />
        </g>

        {/* caixa aberta */}
        <path d="M56 150L30 116h112l19 34z" style={S_ELEV} />
        <path d="M161 150l19-34h112l-26 34z" style={S_ELEV} />
        <rect x="56" y="150" width="210" height="142" rx="4" style={S_ELEV} />
        <rect x="146" y="150" width="30" height="42" style={{ fill: 'rgba(var(--ac-1-rgb), 0.10)', color: 'var(--ac-1)' }} opacity=".8" />

        {/* etiqueta de custodia */}
        <rect x="84" y="204" width="152" height="70" rx="5" style={S_ELEV} />
        <text x="98" y="222" stroke="none" style={{ fill: 'var(--ac-1)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em' }}>CUSTÓDIA</text>
        <text x="98" y="241" stroke="none" style={{ fill: 'var(--bx-text)', fontSize: 16, fontWeight: 800, letterSpacing: '0.02em' }}>{codigo}</text>
        <g stroke="none" style={{ fill: 'var(--bx-text-2)' }}>
          {BARRAS.map(([x, w]) => <rect key={x} x={98 + x} y="250" width={w} height="14" />)}
        </g>

        {/* celular gravando */}
        <g transform="rotate(6 370 160)">
          <rect x="312" y="36" width="116" height="236" rx="18" style={S_ELEV} />
          <rect x="321" y="58" width="98" height="192" rx="9" opacity=".7" />
          <path d="M358 47h24" opacity=".6" />
          <circle className="mk-rec" cx="334" cy="75" r="4.2" stroke="none" style={{ fill: 'var(--bx-red)' }} />
          <text x="343" y="79" stroke="none" style={{ fill: 'var(--bx-text)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em' }}>REC</text>
          <text x="410" y="79" textAnchor="end" stroke="none" style={{ fill: 'var(--bx-text-3)', fontSize: 10, fontWeight: 600 }}>00:42</text>
          <g style={S_AC}>
            <path d="M333 102v-8h8M407 102v-8h-8M333 196v8h8M407 196v8h-8" />
          </g>
          <path d="M344 154l-6-9h24l4 9zM370 154l4-9h24l-6 9z" opacity=".6" />
          <rect x="344" y="154" width="52" height="38" rx="2" opacity=".75" />
          <rect x="352" y="168" width="30" height="14" rx="1.5" opacity=".75" />
          <circle cx="370" cy="232" r="10" />
          <circle cx="370" cy="232" r="6" stroke="none" style={{ fill: 'var(--bx-red)' }} />
        </g>
      </svg>
    </>
  )
}
