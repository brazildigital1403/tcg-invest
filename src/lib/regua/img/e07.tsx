import { E07 } from '@/lib/regua/templates/E07'
import { Abs, C, type Desenho, brlImg, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg, Sino, svgUri } from './base'
import { T, caber } from './pecas'

/**
 * e07-fichario (598x439). Ref.: mockups/E07-meta-quase-completa/assets/hero-fichario.html.
 * Fundo fixo: palco, capa, pagina vazia, argolas e faiscas (img-fichario-fundo.jpg),
 * com a perspectiva achatada (so o giro de -1,6 grau). Por cima: os 9 bolsos
 * da pagina (na ordem do set) e o anel de progresso da meta.
 */

export type BolsoE07 = {
  nome: string
  /** Numero na colecao, sem o total: "209". */
  numero: string
  /** Imagem da carta (catalogo): cheia em quem a pessoa tem, fantasma em quem esta a venda. */
  imagem: string | null
  /** tem = a pessoa tem; anuncio = falta e esta a venda; aviso = falta e ninguem anunciou. */
  estado: 'tem' | 'anuncio' | 'aviso'
  /** Preco do anuncio (so em `anuncio`). */
  preco?: number
}

export type ImgE07 = {
  /** Cartas que a pessoa tem e total da meta (anel). */
  tem: number
  total: number
  /** Os 9 bolsos da pagina que contem as cartas que faltam. */
  bolsos: BolsoE07[]
}

const ex = E07.exemplo
const sv2 = (n: number) => `https://images.pokemontcg.io/sv2/${n}.png`
const exemplo: ImgE07 = {
  tem: ex.meta.tem,
  total: ex.meta.total,
  // Pagina #209 a #217 de Evolucoes em Paldea (mockup aprovado). O nome das que a
  // pessoa tem nao aparece na arte.
  bolsos: [
    { nome: 'Arctibax', numero: '209', imagem: sv2(209), estado: 'anuncio', preco: 225 },
    { nome: '', numero: '210', imagem: sv2(210), estado: 'tem' },
    { nome: '', numero: '211', imagem: sv2(211), estado: 'tem' },
    { nome: '', numero: '212', imagem: sv2(212), estado: 'tem' },
    { nome: '', numero: '213', imagem: sv2(213), estado: 'tem' },
    { nome: '', numero: '214', imagem: sv2(214), estado: 'tem' },
    { nome: '', numero: '215', imagem: sv2(215), estado: 'tem' },
    { nome: 'Tinkatink', numero: '216', imagem: null, estado: 'aviso' },
    { nome: 'Tinkatuff', numero: '217', imagem: sv2(217), estado: 'anuncio', preco: 125 },
  ],
}

function valido(d: unknown): d is ImgE07 {
  return eObj(d) && eNum(d.tem) && eNum(d.total) && d.total > 0 && eLista(d.bolsos, 1, 9) &&
    d.bolsos.every((b) => eObj(b) && eStr(b.nome) && eStr(b.numero) && (b.imagem === null || eStr(b.imagem)) &&
      (b.estado === 'tem' || b.estado === 'anuncio' || b.estado === 'aviso') && (b.preco === undefined || eNum(b.preco)))
}

const B = 112
// Fita crepe serrilhada, desenhada em SVG (o clip-path do satori nao vale
// dentro de pai girado: a fita saia retangular).
const PONTAS = [[2, 8], [6, 0], [12, 10], [18, 0], [26, 8], [34, 0], [42, 9], [50, 0], [58, 8], [66, 0], [74, 10], [82, 0], [90, 8], [96, 0], [100, 12], [98, 92], [92, 100], [84, 90], [76, 100], [68, 92], [60, 100], [52, 90], [44, 100], [36, 92], [28, 100], [20, 90], [12, 100], [4, 92], [0, 100]]
const FITA = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="123.2" height="35" viewBox="0 0 123.2 35">
  <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0f0f0" stop-opacity=".97"/><stop offset="1" stop-color="#f0f0f0" stop-opacity=".84"/></linearGradient></defs>
  <polygon fill="url(#f)" points="${PONTAS.map(([x, y]) => `${((x / 100) * 123.2).toFixed(1)},${((y / 100) * 35).toFixed(1)}`).join(' ')}"/>
</svg>`)
const LISTRAS = 'repeating-linear-gradient(135deg, rgba(245,158,11,0.08) 0px, rgba(245,158,11,0.08) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 9px)'
const SOMBRA_NUM = '0 2px 0 rgba(8,10,15,0.9)'

function Fita(props: { nome: string }) {
  return (
    <Abs x={-5.6} y={-14} w={123.2} h={35} style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={FITA} width={123.2} height={35} style={{ position: 'absolute', left: 0, top: 0 }} />
      <T max={114} style={{ fontSize: caber(props.nome, 23, 112, 14), fontWeight: 900, color: C.tinta, letterSpacing: -0.69 }}>{props.nome}</T>
    </Abs>
  )
}

async function desenhar(d: ImgE07) {
  const bolsos = d.bolsos.slice(0, 9)
  const [fundo, ...imgs] = await Promise.all([
    fundoFixo('e07/img-fichario-fundo.jpg'),
    ...bolsos.map((b) => (b.imagem && b.estado !== 'aviso'
      ? imagemCartaImg(b.imagem, { largura: 104, altura: 104, posY: 0.3, brilho: b.estado === 'anuncio' ? 1.05 : 1 })
      : Promise.resolve(null))),
  ])
  const fracao = Math.min(1, Math.max(0, d.tem / d.total))
  const pct = `${Math.floor(fracao * 100)}%`
  const anel = `<svg xmlns="http://www.w3.org/2000/svg" width="124" height="124" viewBox="0 0 124 124">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#ef4444"/></linearGradient></defs>
    <circle cx="62" cy="62" r="53" fill="none" stroke="rgba(240,240,240,.10)" stroke-width="9"/>
    <circle cx="62" cy="62" r="53" fill="none" stroke="url(#g)" stroke-width="9" stroke-linecap="butt" stroke-dasharray="${(fracao * 333.01).toFixed(2)} 333.01" transform="rotate(-90 62 62)"/>
  </svg>`

  const pecas = bolsos.map((b, i) => {
    const x = 34 + (i % 3) * (B + 10)
    const y = 16 + Math.floor(i / 3) * (B + 12)
    const img = imgs[i]
    if (b.estado === 'tem') {
      return (
        <Abs key={i} x={x} y={y} w={B} h={B} style={{ borderRadius: 8, background: 'rgba(240,240,240,0.03)', boxShadow: 'inset 0 0 0 1px rgba(240,240,240,0.10)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img alt="" src={img} width={104} height={104} style={{ position: 'absolute', left: 4, top: 4, borderRadius: 6 }} /> : null}
          <Abs x={0} y={0} w={B} h={B} style={{ borderRadius: 8, backgroundImage: 'linear-gradient(115deg, rgba(240,240,240,0) 30%, rgba(240,240,240,0.16) 42%, rgba(240,240,240,0) 52%, rgba(240,240,240,0) 70%, rgba(240,240,240,0.06) 78%, rgba(240,240,240,0) 84%)' }} />
        </Abs>
      )
    }
    if (b.estado === 'anuncio') {
      return (
        <Abs key={i} x={x} y={y} w={B} h={B} style={{ borderRadius: 8, background: 'rgba(245,158,11,0.05)', boxShadow: `inset 0 0 0 2.5px ${C.ambar}, 0 0 24px rgba(245,158,11,0.55), 0 0 56px rgba(239,68,68,0.22)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img alt="" src={img} width={104} height={104} style={{ position: 'absolute', left: 4, top: 4, borderRadius: 6, opacity: 0.66 }} /> : null}
          <Abs x={4} y={4} w={104} h={104} style={{ borderRadius: 6, backgroundImage: `linear-gradient(180deg, rgba(13,15,20,0), rgba(13,15,20,0.5)), ${LISTRAS}` }} />
          <Fita nome={b.nome} />
          <Abs x={0} y={29} w={B} style={{ justifyContent: 'center' }}>
            <T style={{ fontSize: 32, fontWeight: 900, color: C.ambar, letterSpacing: -0.32, textShadow: SOMBRA_NUM }}>{`#${b.numero}`}</T>
          </Abs>
          {b.preco !== undefined ? (
            <Abs x={-20} y={67} w={B + 40} style={{ justifyContent: 'center' }}>
              <T style={{ fontSize: caber(brlImg(b.preco), 23, 126, 16, 0.6), lineHeight: '23px', fontWeight: 900, letterSpacing: -0.23, padding: '7px 10px', borderRadius: 18, background: C.verde, color: C.tinta, boxShadow: '0 4px 10px rgba(8,10,15,0.6)' }}>{brlImg(b.preco)}</T>
            </Abs>
          ) : null}
        </Abs>
      )
    }
    return (
      <Abs key={i} x={x} y={y} w={B} h={B} style={{ borderRadius: 8, background: 'rgba(245,158,11,0.04)' }}>
        <Abs x={0.5} y={0.5} w={B - 1} h={B - 1} style={{ borderRadius: 8, border: `2.5px dashed ${C.ambar}` }} />
        <Abs x={6} y={6} w={B - 12} h={B - 12} style={{ borderRadius: 5, backgroundImage: LISTRAS.replace(/0\.08/g, '0.09').replace('9px)', '10px)') }} />
        <Fita nome={b.nome} />
        <Abs x={0} y={27} w={B} h={36} style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Sino cor={C.ambar} tam={24} />
          <T style={{ fontSize: 30, lineHeight: '36px', fontWeight: 900, color: C.ambar, letterSpacing: -0.3, marginLeft: 3, textShadow: SOMBRA_NUM }}>{`#${b.numero}`}</T>
        </Abs>
        <Abs x={-20} y={67} w={B + 40} style={{ justifyContent: 'center' }}>
          <T style={{ fontSize: 23, lineHeight: '23px', fontWeight: 900, letterSpacing: -0.8, padding: '7px 8px', borderRadius: 18, background: C.elevado, color: C.ambar, boxShadow: `inset 0 0 0 2px ${C.ambar}, 0 4px 10px rgba(8,10,15,0.6)` }}>AVISAMOS</T>
        </Abs>
      </Abs>
    )
  })

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={440} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={38} y={26} w={402} h={388} style={{ transform: 'rotate(-1.6deg)' }}>
        {pecas}
      </Abs>
      <Abs x={466} y={158} w={124} h={124} style={{ borderRadius: 62, background: C.elevado, boxShadow: '0 12px 28px rgba(8,10,15,0.85), 0 0 0 1px rgba(240,240,240,0.10)', alignItems: 'center', justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={svgUri(anel)} width={124} height={124} style={{ position: 'absolute', left: 0, top: 0 }} />
        <T style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.52, color: C.texto }}>{pct}</T>
      </Abs>
    </>
  )
}

export const e07Fichario: Desenho<ImgE07> = { largura: 598, altura: 439, fundo: C.elevado, exemplo, valido, desenhar }
