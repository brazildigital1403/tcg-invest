import { E05 } from '@/lib/regua/templates/E05'
import { Abs, C, type Desenho, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg, numImg, Seta } from './base'
import { Carta, T } from './pecas'

/**
 * e05-trial (600x260). Ref.: mockups/E05-fim-do-trial/assets/hero.html.
 * Fundo fixo: palco, mesa e, a direita, a pilha com elastico sob o visor do
 * Scan IA (img-trial-fundo.jpg). Por cima, a esquerda: o leque com ate 3
 * cartas da pessoa, a carta que mais subiu desde que entrou e a etiqueta.
 */

export type ImgE05 = {
  /** A carta que mais subiu desde que entrou por foto. */
  destaque: { imagem: string; pct: number }
  /** Ate 3 outras cartas da pessoa, para o leque de tras. */
  leque: string[]
}

const exemplo: ImgE05 = {
  destaque: { imagem: 'https://images.pokemontcg.io/sv8/236.png', pct: E05.exemplo.destaque.pct },
  // Cartas que o Rafael tem (mockup aprovado): Blastoise Base, Cinccino ex, Pikachu Base.
  leque: [
    'https://images.pokemontcg.io/base1/2.png',
    'https://images.scrydex.com/pokemon/me4-119/large',
    'https://images.pokemontcg.io/base1/58.png',
  ],
}

function valido(d: unknown): d is ImgE05 {
  return eObj(d) && eObj(d.destaque) && eStr(d.destaque.imagem) && eNum(d.destaque.pct) &&
    eLista(d.leque, 0, 3) && d.leque.every(eStr)
}

// Posicoes do leque no mockup: esquerda, centro (por cima das laterais), direita.
const LEQUE = [
  { x: 40, y: 30, r: -16 },
  { x: 108, y: 20, r: 0 },
  { x: 176, y: 30, r: 16 },
]

async function desenhar(d: ImgE05) {
  const leque = d.leque.slice(0, 3)
  const [fundo, dest, ...atras] = await Promise.all([
    fundoFixo('e05/img-trial-fundo.jpg'),
    imagemCartaImg(d.destaque.imagem, { largura: 124, altura: 172 }),
    ...leque.map((u) => imagemCartaImg(u, { largura: 80, altura: 112, brilho: 0.78 })),
  ])
  // [vaga, carta] na ordem de pintura do mockup (laterais primeiro, centro por cima).
  // Com 2 cartas ficam as laterais; com 1, o centro.
  const ordem: [number, number][] = atras.length === 3 ? [[0, 0], [2, 2], [1, 1]] : atras.length === 2 ? [[0, 0], [2, 1]] : atras.length === 1 ? [[1, 0]] : []
  const sobe = d.destaque.pct >= 0

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={260} style={{ position: 'absolute', left: 0, top: 0 }} />
      {ordem.map(([v, c]) => {
        const p = LEQUE[v]
        return (
          <Carta key={v} src={atras[c]} w={80} h={112} raio={5} brilho={null}
            sombra="0 8px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.16)"
            style={{ left: p.x, top: p.y, transform: `rotate(${p.r}deg)` }} />
        )
      })}
      <Carta src={dest} w={124} h={172} raio={7}
        brilho="linear-gradient(125deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 34%)"
        sombra={`0 0 0 3px ${C.verde}, 0 0 30px rgba(34,197,94,0.45), 0 24px 36px rgba(0,0,0,0.75)`}
        style={{ left: 84, top: 42, transform: 'rotate(-4deg)' }} />
      <Abs x={30} y={168} w={236} h={64} style={{
        flexDirection: 'column', padding: '4px 0 0 20px', transform: 'rotate(-5deg)',
        background: C.surface2, border: `2px solid ${sobe ? C.verde : C.vermelho}`, borderRadius: 12, boxShadow: '0 12px 20px rgba(0,0,0,0.6)',
      }}>
        <T style={{ alignItems: 'center', fontSize: 28, lineHeight: '30px', fontWeight: 800, letterSpacing: -0.28, color: sobe ? C.verde : C.vermelho }}>
          <Seta dir={sobe ? 'cima' : 'baixo'} cor={sobe ? C.verde : C.vermelho} tam={24} style={{ marginRight: 8 }} />
          {`${numImg(Math.abs(d.destaque.pct))}%`}
        </T>
        <T style={{ fontSize: 24, lineHeight: '24px', fontWeight: 600, color: C.texto }}>desde que entrou</T>
      </Abs>
    </>
  )
}

export const e05Trial: Desenho<ImgE05> = { largura: 600, altura: 260, fundo: C.elevado, exemplo, valido, desenhar }
