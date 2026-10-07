import { E18 } from '@/lib/regua/templates/E18'
import { Abs, C, type Desenho, GRAD, brlImg, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg } from './base'
import { T, caber } from './pecas'

/**
 * e18-remarcadas (600x400). Ref.: mockups/E18-black-friday-mercado/assets/hero-etiqueta.html.
 * Igual para todos de uma edicao (muda com as ofertas do dia), entao o motor
 * pode gravar o mesmo bloco em todos os envios da edicao.
 *
 * Fundo fixo: palco, balcao, as molduras vazias (slab com o rotulo em branco e
 * dois toploaders) e a placa REMARCADAS / ATE 23:59 (img-remarcadas-fundo.jpg).
 * Por cima: as cartas, o texto do rotulo do slab e as etiquetas (a de ontem
 * riscada e a nova da Bynx com a ponta cortada).
 */

export type OfertaImgE18 = {
  imagem: string
  /** Nome em maiusculas no rotulo do slab ("MEGA GENGAR ex"): so a 1a usa. */
  nome: string
  /** "230/193" */
  numero: string
  /** Graduacao ou condicao curta do rotulo ("AGS 10", "NM"). */
  selo: string
  preco: number
  /** Menor preco do Brasil na vespera (Mercado Brasileiro). */
  menorOntem: number
}

export type ImgE18 = { ofertas: OfertaImgE18[] }

const exemplo: ImgE18 = {
  ofertas: E18.exemplo.ofertas.map((o) => ({
    imagem: o.imagem,
    nome: o.nome,
    numero: o.numero,
    selo: o.detalhe.split('·')[0].trim(),
    preco: o.preco,
    menorOntem: o.menorOntem,
  })),
}

function valido(d: unknown): d is ImgE18 {
  return eObj(d) && eLista(d.ofertas, 1, 3) && d.ofertas.every((o) => eObj(o) && eStr(o.imagem) && eStr(o.nome) &&
    eStr(o.numero) && eStr(o.selo) && eNum(o.preco) && eNum(o.menorOntem))
}

const REFLEXO = 'linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.14) 40%, rgba(255,255,255,0) 52%)'
/** Ponta cortada da etiqueta nova (canto de baixo a direita, 20px). */
const PONTA = 'linear-gradient(315deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 14px, #000 14.5px)'

function Ontem(props: { x: number; y: number; r: number; v: string; tam: number; rotulo?: boolean; pad: string }) {
  return (
    <Abs x={props.x} y={props.y} style={{ flexDirection: 'column', alignItems: 'flex-start', transform: `rotate(${props.r}deg)`, borderRadius: 8, background: C.texto, padding: props.pad, boxShadow: '0 10px 18px rgba(0,0,0,0.5)' }}>
      {props.rotulo ? <T style={{ fontSize: 22, lineHeight: 1, fontWeight: 700, color: C.elevado }}>ONTEM</T> : null}
      <div style={{ display: 'flex', position: 'relative', marginTop: props.rotulo ? 5 : 0 }}>
        <T style={{ fontSize: props.tam, lineHeight: 1, fontWeight: 800, letterSpacing: -props.tam * 0.01, color: C.tinta }}>{props.v}</T>
        <Abs x={-4} y={props.tam * 0.48 - 2} h={4} style={{ right: -4, borderRadius: 3, background: C.vermelho, transform: 'rotate(-5deg)' }} />
      </div>
    </Abs>
  )
}

function Nova(props: { x: number; y: number; r: number; v: string; tam: number; menos?: string; pad: string }) {
  return (
    <Abs x={props.x} y={props.y} style={{ transform: `rotate(${props.r}deg)`, boxShadow: '0 16px 26px rgba(0,0,0,0.5)', borderRadius: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, backgroundImage: GRAD, padding: props.pad, maskImage: PONTA }}>
        <T style={{ fontSize: props.tam, lineHeight: 1, fontWeight: 800, letterSpacing: -props.tam * 0.02, color: C.tinta }}>{props.v}</T>
        {props.menos ? <T style={{ marginTop: 7, fontSize: 22, lineHeight: 1, fontWeight: 800, color: C.tinta }}>{props.menos}</T> : null}
      </div>
    </Abs>
  )
}

async function desenhar(d: ImgE18) {
  const [o1, o2, o3] = d.ofertas
  const [fundo, i1, i2, i3] = await Promise.all([
    fundoFixo('e18/img-remarcadas-fundo.jpg'),
    imagemCartaImg(o1.imagem, { largura: 214, altura: 254, posY: 0.35 }),
    o2 ? imagemCartaImg(o2.imagem, { largura: 118, altura: 171 }) : Promise.resolve(null),
    o3 ? imagemCartaImg(o3.imagem, { largura: 118, altura: 171 }) : Promise.resolve(null),
  ])
  const nome = o1.nome.toUpperCase().replace(/ EX$/, ' ex')
  const menos = `${brlImg(Math.max(0, o1.menorOntem - o1.preco))} A MENOS`

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={400} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* slab: rotulo + janela (a moldura esta no fundo) */}
      <Abs x={32} y={18} w={236} h={344} style={{ transform: 'rotate(-4deg)' }}>
        <T max={196} style={{ position: 'absolute', left: 20, top: 18, fontSize: caber(nome, 22, 196, 14, 0.62), lineHeight: 1, fontWeight: 800, letterSpacing: -0.44, color: C.tinta }}>{nome}</T>
        <T style={{ position: 'absolute', left: 20, top: 46, fontSize: 22, lineHeight: 1, fontWeight: 700, color: C.elevado }}>{o1.numero}</T>
        <T style={{ position: 'absolute', right: 20, top: 46, fontSize: caber(o1.selo, 22, 92, 14, 0.62), lineHeight: 1, fontWeight: 800, color: C.tinta }}>{o1.selo}</T>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={i1} width={214} height={254} style={{ position: 'absolute', left: 11, top: 82, borderRadius: 6 }} />
        <Abs x={0} y={0} w={236} h={344} style={{ borderRadius: 14, backgroundImage: REFLEXO }} />
      </Abs>

      {/* toploaders */}
      {i2 ? (
        <Abs x={292} y={30} w={140} h={196} style={{ transform: 'rotate(-5deg)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={i2} width={118} height={171} style={{ position: 'absolute', left: 11, top: 14, borderRadius: 5 }} />
          <Abs x={0} y={0} w={140} h={196} style={{ borderRadius: 8, backgroundImage: REFLEXO }} />
        </Abs>
      ) : null}
      {i3 ? (
        <Abs x={442} y={44} w={140} h={196} style={{ transform: 'rotate(4deg)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={i3} width={118} height={171} style={{ position: 'absolute', left: 11, top: 14, borderRadius: 5 }} />
          <Abs x={0} y={0} w={140} h={196} style={{ borderRadius: 8, backgroundImage: REFLEXO }} />
        </Abs>
      ) : null}

      {/* etiquetas */}
      <Ontem x={50} y={204} r={-8} v={brlImg(o1.menorOntem)} tam={caber(brlImg(o1.menorOntem), 28, 200, 18, 0.56)} rotulo pad="7px 12px 9px" />
      <Nova x={86} y={282} r={3} v={brlImg(o1.preco)} tam={caber(brlImg(o1.preco), 36, 260, 22, 0.56)} menos={menos} pad="9px 34px 10px 14px" />
      {o2 ? <Ontem x={294} y={194} r={-7} v={brlImg(o2.menorOntem)} tam={caber(brlImg(o2.menorOntem), 24, 150, 16, 0.56)} pad="6px 10px 8px" /> : null}
      {o2 ? <Nova x={302} y={228} r={-2} v={brlImg(o2.preco)} tam={caber(brlImg(o2.preco), 28, 150, 18, 0.56)} pad="8px 12px 9px" /> : null}
      {o3 ? <Ontem x={440} y={210} r={6} v={brlImg(o3.menorOntem)} tam={caber(brlImg(o3.menorOntem), 24, 130, 16, 0.56)} pad="6px 10px 8px" /> : null}
      {o3 ? <Nova x={436} y={244} r={3} v={brlImg(o3.preco)} tam={caber(brlImg(o3.preco), 28, 130, 18, 0.56)} pad="8px 12px 9px" /> : null}
    </>
  )
}

export const e18Remarcadas: Desenho<ImgE18> = { largura: 600, altura: 400, fundo: C.elevado, exemplo, valido, desenhar }
