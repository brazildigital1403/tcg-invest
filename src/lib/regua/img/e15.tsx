import { E15 } from '@/lib/regua/templates/E15'
import { Abs, C, type Desenho, brlImg, eNum, eObj, eStr, fundoFixo, imagemCartaImg, Seta, svgUri } from './base'
import { T, caber } from './pecas'

/**
 * e15-postal (600x590). Ref.: mockups/E15-winback/assets/hero.html.
 * Fundo fixo: o postal de tras (LEMBRANCAS da BYNX com as letras recortadas
 * por arte de carta) e o corpo escuro do postal da frente, com o divisor
 * (img-postal-fundo.jpg). Por cima, no mesmo giro de -2,2 graus: a mensagem
 * (Oi, <nome>!, desde quando, a variacao, quantas subiram e cairam), o carimbo
 * com as datas, o selo com a carta destaque, as ondas e o endereco.
 */

export type ImgE15 = {
  nome: string
  cidade: string
  uf: string
  /** "07/09" e "07/10". */
  desde: string
  ate: string
  /** Variacao da colecao na janela, em R$. */
  variacao: number
  subiram: number
  cairam: number
  /** Imagem da carta destaque (vai no selo). */
  selo: string
}

const ex = E15.exemplo
const exemplo: ImgE15 = {
  nome: ex.nome, cidade: ex.cidade, uf: ex.uf, desde: ex.desde, ate: ex.ate,
  variacao: Math.round((ex.valorHoje - ex.valorInicio) * 100) / 100,
  subiram: ex.subiram, cairam: ex.cairam, selo: ex.destaque.imagem,
}

function valido(d: unknown): d is ImgE15 {
  return eObj(d) && eStr(d.nome) && eStr(d.cidade) && eStr(d.uf) && eStr(d.desde) && eStr(d.ate) &&
    eNum(d.variacao) && eNum(d.subiram) && eNum(d.cairam) && eStr(d.selo)
}

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
/** "07/09" -> "07 SET" */
function dataCarimbo(ddmm: string): string {
  const [dd, mm] = ddmm.split('/')
  const m = MESES[Number.parseInt(mm ?? '', 10) - 1]
  return m ? `${dd} ${m}` : ddmm
}

const TINTA = `<filter id="tinta" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="r"/>
  <feColorMatrix in="r" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.5" result="m"/>
  <feComposite in="SourceGraphic" in2="m" operator="in" result="t"/>
  <feDisplacementMap in="t" in2="r" scale="1.6"/>
</filter>`

const ANEL = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="142" height="142" viewBox="0 0 150 150"><defs>${TINTA}</defs>
  <g filter="url(#tinta)" fill="none" stroke="#f59e0b">
    <circle cx="75" cy="75" r="69" stroke-width="3"/>
    <circle cx="75" cy="75" r="61" stroke-width="5" stroke-dasharray="2 5"/>
    <line x1="30" y1="77" x2="120" y2="77" stroke-width="2"/>
  </g></svg>`)

const ONDAS = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="140" height="84" viewBox="0 0 150 90"><defs>${TINTA}</defs>
  <g filter="url(#tinta)" fill="none" stroke="#f59e0b" stroke-width="3">
    <path d="M2 20 q 15 -9 30 0 t 30 0 t 30 0 t 30 0 t 30 0"/>
    <path d="M2 38 q 15 -9 30 0 t 30 0 t 30 0 t 30 0 t 30 0"/>
    <path d="M2 56 q 15 -9 30 0 t 30 0 t 30 0 t 30 0 t 30 0"/>
    <path d="M2 74 q 15 -9 30 0 t 30 0 t 30 0 t 30 0 t 30 0"/>
  </g></svg>`)

/** Papel do selo com o picote (furos de raio 4 a cada 12px), com folga de 12px para a sombra. */
function papelSelo(): string {
  const furos: string[] = []
  for (let x = 5; x <= 96; x += 12) furos.push(`<circle cx="${x + 12}" cy="12" r="4.3"/><circle cx="${x + 12}" cy="130" r="4.3"/>`)
  for (let y = 7; y <= 118; y += 12) furos.push(`<circle cx="12" cy="${y + 12}" r="4.3"/><circle cx="108" cy="${y + 12}" r="4.3"/>`)
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="142" viewBox="0 0 120 142">
    <defs>
      <mask id="m"><rect x="12" y="12" width="96" height="118" fill="#fff"/><g fill="#000">${furos.join('')}</g></mask>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="3" flood-color="#000" flood-opacity=".6"/></filter>
    </defs>
    <g filter="url(#s)"><rect x="12" y="12" width="96" height="118" fill="#f0f0f0" mask="url(#m)"/></g>
  </svg>`)
}

const SUBLINHA = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="16" viewBox="0 0 300 16" preserveAspectRatio="none"><path d="M4 11 C 70 3, 150 4, 296 7 M 30 14 C 110 8, 200 9, 286 12" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/></svg>`)

const MAO = 'skewX(-6deg)'

async function desenhar(d: ImgE15) {
  const [fundo, arte] = await Promise.all([
    fundoFixo('e15/img-postal-fundo.jpg'),
    imagemCartaImg(d.selo, { largura: 80, altura: 102, recorte: { larguraTotal: 176, x: 48, y: 30 } }),
  ])
  const sobe = d.variacao >= 0
  const valor = `${sobe ? '+' : '-'}${brlImg(Math.abs(d.variacao))}`
  const tamValor = caber(valor, 56, 284, 34, 0.56)
  const subiram = `${d.subiram} ${d.subiram === 1 ? 'carta subiu' : 'cartas subiram'}`
  const cairam = `${d.cairam} ${d.cairam === 1 ? 'carta caiu' : 'cartas caíram'}`
  const oi = `Oi, ${d.nome}!`

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={590} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Abs x={22} y={250} w={556} h={310} style={{ transform: 'rotate(-2.2deg)' }}>
        {/* carimbo com as datas */}
        <Abs x={312} y={14} w={142} h={142} style={{ transform: 'rotate(-8deg)', opacity: 0.95 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={ANEL} width={142} height={142} style={{ position: 'absolute', left: 0, top: 0 }} />
          <Abs x={0} y={42} w={142} h={26} style={{ justifyContent: 'center' }}>
            <T style={{ fontSize: 23.7, lineHeight: '26px', fontWeight: 800, letterSpacing: -0.4, color: C.ambar, opacity: 0.88 }}>{dataCarimbo(d.desde)}</T>
          </Abs>
          <Abs x={0} y={76} w={142} h={26} style={{ justifyContent: 'center' }}>
            <T style={{ fontSize: 23.7, lineHeight: '26px', fontWeight: 800, letterSpacing: -0.4, color: C.ambar, opacity: 0.88 }}>{dataCarimbo(d.ate)}</T>
          </Abs>
        </Abs>

        {/* selo com a carta destaque */}
        <Abs x={428} y={10} w={120} h={142} style={{ transform: 'rotate(4deg)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={papelSelo()} width={120} height={142} style={{ position: 'absolute', left: 0, top: 0 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={arte} width={80} height={102} style={{ position: 'absolute', left: 20, top: 20 }} />
        </Abs>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={ONDAS} width={140} height={84} style={{ position: 'absolute', left: 432, top: 64, transform: 'rotate(-8deg)', opacity: 0.9 }} />

        {/* endereco */}
        <Abs x={340} y={176} w={196} style={{ flexDirection: 'column' }}>
          <div style={{ display: 'flex', position: 'relative', height: 40, borderBottom: '1.5px solid #2f3135' }}>
            <T style={{ position: 'absolute', left: 0, bottom: 6, fontSize: 22, fontWeight: 800, letterSpacing: 1, color: C.texto2 }}>PARA</T>
            <T style={{ position: 'absolute', left: 78, bottom: 5, fontSize: caber(d.nome, 23, 116, 14), maxWidth: 116, overflow: 'hidden', fontWeight: 700, color: C.texto, transform: MAO }}>{d.nome}</T>
          </div>
          <div style={{ display: 'flex', position: 'relative', height: 40, borderBottom: '1.5px solid #2f3135' }}>
            <T style={{ position: 'absolute', left: 2, bottom: 5, fontSize: caber(d.cidade, 23, 190, 14), maxWidth: 194, overflow: 'hidden', fontWeight: 700, color: C.texto, transform: MAO }}>{d.cidade}</T>
          </div>
          <div style={{ display: 'flex', position: 'relative', height: 40, borderBottom: '1.5px solid #2f3135' }}>
            <T style={{ position: 'absolute', left: 2, bottom: 5, fontSize: 23, fontWeight: 700, color: C.texto, transform: MAO }}>{d.uf ? `${d.uf} · Brasil` : 'Brasil'}</T>
          </div>
        </Abs>
      </Abs>
      {/* Mensagem escrita a mao. Fica FORA do postal girado, com o giro somado
          (-2,2 do postal + -1,2 da mensagem) e a posicao ja transformada: svg dentro
          de dois giros aninhados sai cortado no satori (as setas sumiam). */}
      <Abs x={48.6} y={278.1} w={288} h={290} style={{ flexDirection: 'column', transform: 'rotate(-3.4deg)' }}>
        <T max={284} style={{ fontSize: caber(oi, 30, 280, 18), lineHeight: '36px', fontWeight: 700, color: C.texto, transform: MAO }}>{oi}</T>
        <T style={{ marginTop: 2, fontSize: 22, lineHeight: '30px', fontWeight: 500, letterSpacing: -0.2, color: C.texto2, transform: MAO }}>{`Sua coleção desde ${d.desde}:`}</T>
        <div style={{ display: 'flex', position: 'relative', alignSelf: 'flex-start', marginTop: 8, transform: MAO }}>
          <T style={{ fontSize: tamValor, lineHeight: 1, fontWeight: 800, letterSpacing: -1.5, color: sobe ? C.verde : C.vermelho }}>{valor}</T>
          {sobe ? <Abs x={-4} y={tamValor - 4} h={16} style={{ right: -8, backgroundImage: `url(${SUBLINHA})`, backgroundSize: '100% 100%' }} /> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
          <T style={{ alignItems: 'center', marginTop: 14 }}>
            <Seta dir="cima" cor={C.verde} tam={20} style={{ marginRight: 10 }} />
            <T style={{ fontSize: 26, lineHeight: 1, fontWeight: 700, color: C.texto, transform: MAO }}>{subiram}</T>
          </T>
          {d.cairam > 0 ? (
            <T style={{ alignItems: 'center', marginTop: 14 }}>
              <Seta dir="baixo" cor={C.vermelho} tam={20} style={{ marginRight: 10 }} />
              <T style={{ fontSize: 26, lineHeight: 1, fontWeight: 700, color: C.texto, transform: MAO }}>{cairam}</T>
            </T>
          ) : null}
        </div>
        <T style={{ marginTop: 20, fontSize: 23, fontWeight: 700, color: C.texto2, transform: MAO }}>Bynx</T>
      </Abs>

    </>
  )
}

export const e15Postal: Desenho<ImgE15> = { largura: 600, altura: 590, fundo: C.elevado, exemplo, valido, desenhar }
