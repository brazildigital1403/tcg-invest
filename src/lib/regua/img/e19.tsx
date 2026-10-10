import { E19 } from '@/lib/regua/templates/E19'
import { Abs, C, type Desenho, eObj, eStr, fundoFixo, imagemCartaImg } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e19-bancada (600x360). Ref.: mockups/E19-servicos-restauracao/assets/hero.html.
 * A carta mais valiosa NAO graduada da pessoa, na bancada.
 *
 * Fundo fixo atras: palco, mesa quadriculada, regua milimetrada, colchetes e
 * marcadores 1 a 3 (img-bancada-fundo.jpg). Por cima: a carta e, dentro da
 * lupa, o canto dela ampliado 3x. Camada fixa transparente por cima de tudo
 * (img-bancada-frente.png): linhas-guia, cabo e aro da lupa, marcador 4 e o
 * laudo em branco. Por ultimo, o nome da carta no laudo.
 */

export type ImgE19 = {
  carta: { nome: string; imagem: string }
}

const exemplo: ImgE19 = { carta: { nome: E19.exemplo.carta.nome, imagem: 'https://images.pokemontcg.io/swsh11/186.png' } }

function valido(d: unknown): d is ImgE19 {
  return eObj(d) && eObj(d.carta) && eStr(d.carta.nome) && eStr(d.carta.imagem)
}

async function desenhar(d: ImgE19) {
  const [fundo, frente, carta, canto] = await Promise.all([
    fundoFixo('e19/img-bancada-fundo.jpg'),
    fundoFixo('e19/img-bancada-frente.png'),
    imagemCartaImg(d.carta.imagem, { largura: 176, altura: 246 }),
    // canto inferior direito a 3x (a carta escalada para 528 de largura), como no vidro da lupa
    imagemCartaImg(d.carta.imagem, { largura: 58, altura: 58, recorte: { larguraTotal: 528, x: 470, y: 680 } }),
  ])
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={360} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Carta src={carta} w={176} h={246} raio={9}
        sombra="0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.14)"
        brilho="linear-gradient(118deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0) 58%)"
        style={{ left: 100, top: 66 }} />
      {/* vidro da lupa: fundo da mesa ampliado + o canto da carta */}
      <Abs x={221} y={255} w={98} h={98} style={{ borderRadius: 49, overflow: 'hidden', background: C.surface2 }}>
        <Abs x={0} y={0} w={58} h={58} style={{ borderRadius: '0 0 27px 0', boxShadow: '0 0 0 3px rgba(255,255,255,0.40), 0 20px 40px rgba(0,0,0,0.55)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={canto} width={58} height={58} style={{ position: 'absolute', left: 0, top: 0, borderRadius: '0 0 27px 0' }} />
        </Abs>
      </Abs>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={frente} width={600} height={360} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={326} y={12} w={262} h={348} style={{ transform: 'rotate(1.5deg)' }}>
        <T max={228} style={{ position: 'absolute', left: 17.5, top: 45.5, fontSize: caber(d.carta.nome, 28, 228, 15), lineHeight: '34px', fontWeight: 800, letterSpacing: -0.3, color: C.texto }}>{d.carta.nome}</T>
      </Abs>
    </>
  )
}

export const e19Bancada: Desenho<ImgE19> = { largura: 600, altura: 360, fundo: C.elevado, exemplo, valido, desenhar }
