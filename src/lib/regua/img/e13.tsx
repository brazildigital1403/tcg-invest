import { E13 } from '@/lib/regua/templates/E13'
import { E14 } from '@/lib/regua/templates/E14'
import { Abs, C, type Desenho, brlImg, eNum, eObj, eStr, fundoFixo, imagemCartaImg, svgUri } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e13-lance (600x320). Ref.: mockups/E13-leilao-superado/assets/hero.html.
 * Fundo fixo: palco com o brilho ambar, rastros das placas, a seta pontilhada
 * de tras e a sombra da carta (img-lance-fundo.jpg). Por cima: a foto do lote,
 * a placa da pessoa caindo (valor riscado + SUPERADO), a placa do rival
 * subindo e a ponta da seta.
 *
 * BLOQUEIO DE ENVIO (do template): em producao a imagem e a foto do proprio
 * lote, no storage da Bynx. O exemplo usa a imagem do catalogo.
 */

export type ImgE13 = {
  /** Foto do lote (storage da Bynx) ou imagem da carta. */
  imagem: string
  seuLance: number
  lanceAtual: number
  /** Apelido mascarado do rival ("t***7"). */
  rival: string
}

const ex = E13.exemplo
const exemplo: ImgE13 = { imagem: E14.exemplo.carta.imagem, seuLance: ex.seuLance, lanceAtual: ex.lanceAtual, rival: ex.rival }

function valido(d: unknown): d is ImgE13 {
  return eObj(d) && eStr(d.imagem) && eNum(d.seuLance) && eNum(d.lanceAtual) && eStr(d.rival)
}

const CABECA = 'linear-gradient(160deg, #2f3135, #202227)'
const CABO = 'linear-gradient(90deg, #191b20, #2f3135 50%, #191b20)'

async function desenhar(d: ImgE13) {
  const [fundo, carta] = await Promise.all([
    fundoFixo('e13/img-lance-fundo.jpg'),
    imagemCartaImg(d.imagem, { largura: 200, altura: 280 }),
  ])
  const seu = brlImg(d.seuLance)
  const atual = brlImg(d.lanceAtual)
  const quem = `de ${d.rival}`
  const frente = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <defs><clipPath id="fora"><rect x="0" y="0" width="200" height="320"/><rect x="404" y="0" width="196" height="320"/></clipPath></defs>
    <path clip-path="url(#fora)" d="M156 116 C 186 40, 300 6, 374 54" fill="none" stroke="#f59e0b" stroke-opacity=".75" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 12"/>
    <path d="M352 40 C 360 44, 367 48, 374 54" fill="none" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
    <polygon points="392,68 366,62 380,42" fill="#f59e0b" stroke="#f59e0b" stroke-width="3" stroke-linejoin="round"/>
  </svg>`

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Carta src={carta} w={200} h={280} raio={10}
        sombra="0 26px 44px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.14), 0 0 70px rgba(245,158,11,0.34)"
        brilho="linear-gradient(118deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.22) 30%, rgba(245,158,11,0.10) 38%, rgba(255,255,255,0) 50%, rgba(255,255,255,0) 62%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0) 78%)"
        style={{ left: 200, top: 12, transform: 'rotate(-3deg)' }} />

      {/* placa da pessoa: cai a esquerda */}
      <Abs x={36} y={126} w={196} h={240} style={{ transform: 'rotate(-11deg)', transformOrigin: '98px 54px' }}>
        <Abs x={88} y={96} w={20} h={150} style={{ borderRadius: 10, backgroundImage: CABO }} />
        <Abs x={0} y={0} w={196} h={100} style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: `3px solid ${C.vermelho}`, backgroundImage: CABECA, boxShadow: '0 16px 28px rgba(0,0,0,0.7)' }}>
          <T style={{ fontSize: 22, lineHeight: '26px', fontWeight: 800, letterSpacing: 0.66, color: C.texto }}>SEU LANCE</T>
          <div style={{ display: 'flex', position: 'relative', alignItems: 'center' }}>
            <T style={{ fontSize: caber(seu, 30, 176, 20, 0.58), lineHeight: '36px', fontWeight: 900, letterSpacing: -0.9, color: 'rgba(240,240,240,0.62)' }}>{seu}</T>
            <Abs x={0} y={18} h={2} style={{ right: 0, background: C.vermelho }} />
          </div>
        </Abs>
      </Abs>
      <Abs x={60} y={234} style={{ transform: 'rotate(-13deg)', padding: '2px 12px', borderRadius: 10, border: `2px solid ${C.vermelho}`, background: '#28151a', boxShadow: '0 8px 16px rgba(0,0,0,0.55)' }}>
        <T style={{ fontSize: 22, lineHeight: '28px', fontWeight: 900, letterSpacing: 1.32, color: C.vermelho }}>SUPERADO</T>
      </Abs>

      {/* placa do rival: sobe a direita */}
      <Abs x={378} y={40} w={196} h={320} style={{ transform: 'rotate(6deg)', transformOrigin: '98px 64px' }}>
        <Abs x={87} y={124} w={22} h={200} style={{ borderRadius: 11, backgroundImage: CABO }} />
        <Abs x={0} y={0} w={196} h={128} style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 18, border: `3px solid ${C.ambar}`, backgroundImage: CABECA, boxShadow: '0 16px 28px rgba(0,0,0,0.7)' }}>
          <T style={{ fontSize: 22, lineHeight: '26px', fontWeight: 800, letterSpacing: 0.66, color: C.texto2 }}>LANCE ATUAL</T>
          <T style={{ marginTop: 2, fontSize: caber(atual, 30, 176, 20, 0.58), lineHeight: '36px', fontWeight: 900, letterSpacing: -0.9, color: C.texto }}>{atual}</T>
          <T max={176} style={{ marginTop: 2, fontSize: caber(quem, 22, 170, 14), lineHeight: '26px', fontWeight: 800, color: C.ambar }}>{quem}</T>
        </Abs>
      </Abs>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(frente)} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
    </>
  )
}

export const e13Lance: Desenho<ImgE13> = { largura: 600, altura: 320, fundo: C.elevado, exemplo, valido, desenhar }
