import { C, type Desenho, eLista, eObj, eStr, fundoFixo, imagemCartaImg } from './base'
import { Carta } from './pecas'

/**
 * e16-fichario (536x316 no e-mail; desenhado em 560x330 como o mockup e
 * reduzido para 1072x632). Ref.: mockups/E16-sunset/assets/fichario.html.
 *
 * So as cartas mudam. Fundo fixo atras (pagina, margem dos furos, os dois
 * bolsos vazios e o brilho ambar do bolso da no 1) e uma camada fixa
 * transparente POR CIMA (reflexo do plastico, solda, sombra do fim de tarde,
 * a faixa de luz e a lombada de metal), porque no mockup a luz passa sobre as
 * cartas. Com 1 carta so, o bolso da direita fica vazio.
 */

export type ImgE16 = {
  /** Imagem das 2 cartas que mais subiram em R$ (no 1 primeiro); 1 se so uma subiu. */
  cartas: string[]
}

// Persona Ana (E15/E16): Charizard G LV.X e Lugia-GX, as do mockup aprovado.
const exemplo: ImgE16 = {
  cartas: ['https://images.pokemontcg.io/dpp/DP45.png', 'https://images.pokemontcg.io/sm8/207.png'],
}

function valido(d: unknown): d is ImgE16 {
  return eObj(d) && eLista(d.cartas, 1, 2) && d.cartas.every(eStr)
}

async function desenhar(d: ImgE16) {
  const [fundo, frente, c1, c2] = await Promise.all([
    fundoFixo('e16/img-fichario-fundo.jpg'),
    fundoFixo('e16/img-fichario-frente.png'),
    imagemCartaImg(d.cartas[0], { largura: 210, altura: 293 }),
    d.cartas[1] ? imagemCartaImg(d.cartas[1], { largura: 210, altura: 293, brilho: 0.9 }) : Promise.resolve(null),
  ])
  const sombra = '-12px 16px 22px rgba(0,0,0,0.65)'
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={560} height={330} style={{ position: 'absolute', left: 0, top: 0 }} />
      {c2 ? <Carta src={c2} w={210} h={293} raio={10} brilho={null} sombra={sombra} style={{ left: 321, top: 18 }} /> : null}
      <Carta src={c1} w={210} h={293} raio={10} brilho={null} sombra={sombra} style={{ left: 65, top: 18 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={frente} width={560} height={330} style={{ position: 'absolute', left: 0, top: 0 }} />
    </>
  )
}

export const e16Fichario: Desenho<ImgE16> = {
  largura: 560, altura: 330, fundo: C.elevado, saida: { largura: 1072, altura: 632 }, exemplo, valido, desenhar,
}
