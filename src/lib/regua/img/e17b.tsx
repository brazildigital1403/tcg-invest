import { Abs, C, type Desenho, Seta, eLista, eObj, eStr, fundoFixo, imagemCartaImg, svgUri } from './base'
import { Carta, Faisca, T, caber } from './pecas'

/**
 * E17B (Seu 2026, quem tem 1 a 9 cartas): hero e 2 trofeus pessoais.
 * Ref.: mockups/E17B-seu-2026-menos-de-10-cartas/assets/hero-carta.html,
 * trofeu-dia.html e trofeu-alta.html. O trofeu 3 (a mais valiosa) e a arte fixa
 * do E17 (e17/trofeu-verso.jpg).
 *
 * A mais valiosa NUNCA aparece aberta: o verso Bynx dela e uma camada fixa
 * transparente (img-hero-verso.png, img-trofeu-dia-verso.png) recortada do
 * proprio mockup. Nome e valor dela nunca entram na arte.
 *
 * - e17b-hero (600x400): fundo fixo (palco, "2026" vazado, textos da arte,
 *   faiscas) + as outras cartas do ano em leque ATRAS (ate 3, so as que
 *   existem) + o verso + a etiqueta "R$ ?" amarrada (seta verde so com alta).
 * - e17b-trofeu-dia (244x136): visor + as cartas do primeiro dia em leque, a
 *   mais valiosa de costas quando ela entrou nesse dia, e a etiqueta da data.
 * - e17b-trofeu-alta (244x136): a carta aberta e a etiqueta (percentual com
 *   seta verde; ou o ano do set, sem seta, no trofeu "a mais antiga").
 */

const BRANCO = '#f0f0f0'

/** Etiqueta branca com a ponta e o ilho (o clip-path do mockup vira SVG). */
function etiqueta(w: number, h: number, ponta: 'esq' | 'dir', fundo: string): string {
  const p = 12
  const m = 16 // folga para a sombra
  const caminho = ponta === 'dir'
    ? `M${m + 10},${m} H${m + w - 14} L${m + w},${m + h / 2} L${m + w - 14},${m + h} H${m + 10} Q${m},${m + h} ${m},${m + h - 10} V${m + 10} Q${m},${m} ${m + 10},${m} Z`
    : `M${m + p},${m} H${m + w - 10} Q${m + w},${m} ${m + w},${m + 10} V${m + h - 10} Q${m + w},${m + h} ${m + w - 10},${m + h} H${m + p} L${m},${m + h / 2} Z`
  const ilho = ponta === 'dir' ? m + w - 13 : m + 12
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2 * m}" height="${h + 2 * m}" viewBox="0 0 ${w + 2 * m} ${h + 2 * m}">
    <defs><filter id="s" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000" flood-opacity=".6"/></filter></defs>
    <path d="${caminho}" fill="${BRANCO}" filter="url(#s)"/>
    <circle cx="${ilho}" cy="${m + h / 2}" r="3" fill="${fundo}"/>
  </svg>`
}

function fio(x1: number, y1: number, x2: number, y2: number, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(240,240,240,.6)" stroke-width="2"/></svg>`
}

// ─── hero ───────────────────────────────────────────────────────────────────

export type ImgE17BHero = {
  /** As outras cartas diferentes do ano, por valor (0 a 3). Nunca a mais valiosa. */
  leque: string[]
  /** A mais valiosa vale hoje mais do que no dia em que entrou? (seta verde) */
  subiu: boolean
}

const exHero: ImgE17BHero = {
  leque: ['https://images.pokemontcg.io/sm8/207.png', 'https://images.pokemontcg.io/sv1/211.png', 'https://images.pokemontcg.io/sv10/204.png'],
  subiu: true,
}

function validoHero(d: unknown): d is ImgE17BHero {
  return eObj(d) && eLista(d.leque, 0, 3) && d.leque.every(eStr) && typeof d.subiu === 'boolean'
}

// Leque do mockup (rotacao em torno da base) convertido para o centro de cada carta.
const LW = 82
const LH = 114
const POS_LEQUE = {
  esq: { cx: 375.5, cy: 119.2, rot: -30 },
  meio: { cx: 421, cy: 75, rot: 0 },
  dir: { cx: 466.5, cy: 119.2, rot: 30 },
}

async function desenharHero(d: ImgE17BHero) {
  const leque = d.leque.slice(0, 3)
  const [fundo, verso, ...imgs] = await Promise.all([
    fundoFixo('e17b/img-hero-fundo.jpg'),
    fundoFixo('e17b/img-hero-verso.png'),
    ...leque.map((u) => imagemCartaImg(u, { largura: LW, altura: LH, brilho: 0.62 })),
  ])
  // 1 carta: so no meio; 2: as laterais; 3: laterais e o meio por cima.
  const lugares = leque.length === 1 ? [POS_LEQUE.meio] : leque.length === 2 ? [POS_LEQUE.esq, POS_LEQUE.dir] : [POS_LEQUE.esq, POS_LEQUE.meio, POS_LEQUE.dir]
  const ordem = leque.length === 3 ? [0, 2, 1] : leque.map((_, i) => i)
  const sombra = '0 0 0 1px rgba(255,255,255,0.16), 0 14px 22px rgba(0,0,0,0.7)'
  const TW = 106
  const TH = 62
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={400} style={{ position: 'absolute', left: 0, top: 0 }} />
      {ordem.map((i) => {
        const l = lugares[i]
        return <Carta key={i} src={imgs[i]} w={LW} h={LH} raio={6} brilho={null} sombra={sombra} style={{ left: l.cx - LW / 2, top: l.cy - LH / 2, transform: `rotate(${l.rot}deg)` }} />
      })}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={verso} width={600} height={400} style={{ position: 'absolute', left: 0, top: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(fio(367, 150, 311, 185, 600, 400))} width={600} height={400} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={228 - 16} y={178 - 16} w={TW + 32} h={TH + 32} style={{ transform: 'rotate(-8deg)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={svgUri(etiqueta(TW, TH, 'dir', C.elevado))} width={TW + 32} height={TH + 32} style={{ position: 'absolute', left: 0, top: 0 }} />
        <Abs x={16} y={16} w={TW - 13} h={TH} style={{ alignItems: 'center', justifyContent: 'center' }}>
          {d.subiu ? <Seta dir="cima" cor={C.verde} tam={20} style={{ marginRight: 5 }} /> : null}
          <T style={{ fontSize: 30, lineHeight: 1, fontWeight: 900, letterSpacing: -0.9, color: C.tinta }}>R$ ?</T>
        </Abs>
      </Abs>
      <Faisca x={346 - 11} y={110 - 11} f={22} />
    </>
  )
}

// ─── trofeu 1: o primeiro dia ───────────────────────────────────────────────

export type ImgE17BDia = {
  /** Cartas abertas do primeiro dia (ate 3 com o verso; ate 4 sem). */
  abertas: string[]
  /** A mais valiosa entrou no primeiro dia? Ela fica de costas na ponta do leque. */
  verso: boolean
  /** "13 JUN" */
  data: string
}

const exDia: ImgE17BDia = {
  abertas: ['https://images.pokemontcg.io/sv10/204.png', 'https://images.pokemontcg.io/sv1/211.png', 'https://images.pokemontcg.io/sm8/207.png'],
  verso: true,
  data: '13 JUN',
}

function validoDia(d: unknown): d is ImgE17BDia {
  return eObj(d) && eLista(d.abertas, 0, 4) && d.abertas.every(eStr) && typeof d.verso === 'boolean' && eStr(d.data) &&
    d.abertas.length + (d.verso ? 1 : 0) >= 1 && (!d.verso || d.abertas.length <= 3)
}

// Leque do mockup (origem na base): deslocado para girar no centro.
const DW = 50
const DH = 70
const giro = (x: number, y: number, rot: number) => {
  const r = (rot * Math.PI) / 180
  return { x: x + (DH / 2) * Math.sin(r), y: y + (DH / 2) * (1 - Math.cos(r)), rot }
}
const POS_DIA = [giro(26, 24, -14), giro(46, 20, -5), giro(66, 20, 5), giro(84, 26, 14)]

async function desenharDia(d: ImgE17BDia) {
  const vagas = d.verso ? 3 : 4
  const abertas = d.abertas.slice(0, vagas)
  const [fundo, verso, ...imgs] = await Promise.all([
    fundoFixo('e17b/img-trofeu-dia-fundo.jpg'),
    d.verso ? fundoFixo('e17b/img-trofeu-dia-verso.png') : Promise.resolve(''),
    ...abertas.map((u) => imagemCartaImg(u, { largura: DW, altura: DH })),
  ])
  // As abertas ocupam as vagas mais a direita do leque (encostadas no verso).
  const inicio = vagas - abertas.length
  const sombra = '0 0 0 1px rgba(255,255,255,0.2), 0 10px 16px rgba(0,0,0,0.65)'
  const TW = 96
  const TH = 46
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      {imgs.map((src, i) => {
        const p = POS_DIA[inicio + i]
        return <Carta key={i} src={src} w={DW} h={DH} raio={4} brilho={null} sombra={sombra} style={{ left: p.x, top: p.y, transform: `rotate(${p.rot}deg)` }} />
      })}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {verso ? <img alt="" src={verso} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(fio(141, 30, 164, 49, 244, 136))} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={144 - 16} y={50 - 16} w={TW + 32} h={TH + 32} style={{ transform: 'rotate(7deg)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={svgUri(etiqueta(TW, TH, 'esq', C.fundo))} width={TW + 32} height={TH + 32} style={{ position: 'absolute', left: 0, top: 0 }} />
        <Abs x={16 + 20} y={16} w={TW - 20} h={TH} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontSize: caber(d.data, 24, 70, 18, 0.66), lineHeight: 1, fontWeight: 900, letterSpacing: -0.72, color: C.tinta }}>{d.data}</T>
        </Abs>
      </Abs>
    </>
  )
}

// ─── trofeu 2: tambem subiu (ou a mais antiga) ─────────────────────────────

export type ImgE17BAlta = {
  imagem: string
  /** "74,9%" (com seta verde) ou o ano do set ("1999", sem seta). */
  etiqueta: string
  seta: boolean
}

const exAlta: ImgE17BAlta = { imagem: 'https://images.pokemontcg.io/sm8/207.png', etiqueta: '74,9%', seta: true }

function validoAlta(d: unknown): d is ImgE17BAlta {
  return eObj(d) && eStr(d.imagem) && d.imagem.length > 0 && eStr(d.etiqueta) && typeof d.seta === 'boolean'
}

async function desenharAlta(d: ImgE17BAlta) {
  const [fundo, carta] = await Promise.all([
    fundoFixo('e17b/img-trofeu-alta-fundo.jpg'),
    imagemCartaImg(d.imagem, { largura: 84, altura: 117 }),
  ])
  const TW = 106
  const TH = 46
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Carta
        src={carta}
        w={84}
        h={117}
        raio={5}
        sombra="0 0 0 1px rgba(255,255,255,0.16), 0 16px 24px rgba(0,0,0,0.7), 0 0 22px rgba(34,197,94,0.25)"
        brilho="linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 42%, rgba(255,255,255,0) 54%)"
        style={{ left: 34, top: 10, transform: 'rotate(-6deg)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(fio(113, 34, 141, 63, 244, 136))} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={122 - 16} y={52 - 16} w={TW + 32} h={TH + 32} style={{ transform: 'rotate(7deg)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={svgUri(etiqueta(TW, TH, 'esq', C.fundo))} width={TW + 32} height={TH + 32} style={{ position: 'absolute', left: 0, top: 0 }} />
        <Abs x={16 + 12} y={16} w={TW - 12} h={TH} style={{ alignItems: 'center', justifyContent: 'center' }}>
          {d.seta ? <Seta dir="cima" cor={C.verde} tam={15} style={{ marginRight: 4 }} /> : null}
          <T style={{ fontSize: caber(d.etiqueta, 24, 76, 18, 0.6), lineHeight: 1, fontWeight: 900, letterSpacing: -0.72, color: C.tinta }}>{d.etiqueta}</T>
        </Abs>
      </Abs>
    </>
  )
}

export const e17bHero: Desenho<ImgE17BHero> = { largura: 600, altura: 400, fundo: C.elevado, exemplo: exHero, valido: validoHero, desenhar: desenharHero }
export const e17bTrofeuDia: Desenho<ImgE17BDia> = { largura: 244, altura: 136, fundo: C.fundo, exemplo: exDia, valido: validoDia, desenhar: desenharDia }
export const e17bTrofeuAlta: Desenho<ImgE17BAlta> = { largura: 244, altura: 136, fundo: C.fundo, exemplo: exAlta, valido: validoAlta, desenhar: desenharAlta }
