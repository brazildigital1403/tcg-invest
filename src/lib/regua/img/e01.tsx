import { E01 } from '@/lib/regua/templates/E01'
import { Abs, C, type Desenho, brlImg, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg, Seta } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e01-fichario (598x380). Ref.: mockups/E01-tudo-que-mudou/assets/hero-fichario.html (variante .m).
 * Fundo fixo: palco, capa do fichario, pagina vazia e argolas (img-fichario-fundo.jpg).
 * Por cima: os 9 bolsos com as cartas da pessoa, os marcadores de quem mexeu,
 * a carta-gancho fora do bolso, o barbante, a etiqueta verde e o total.
 */

export type BolsoE01 = {
  /** Imagem da carta; ausente no bolso de onde o gancho "saiu". */
  imagem?: string
  /** Mexeu 10% ou mais em 7 dias (contorno e marcador). */
  mexeu?: 'subiu' | 'caiu'
  /** O bolso de onde a carta-gancho saiu (fica vazio). */
  gancho?: boolean
}

export type ImgE01 = {
  gancho: { nome: string; imagem: string; pct: number; ganho: number }
  /** Ate 8 cartas diferentes, na ordem da pagina; o 9o bolso e sempre tracejado. */
  pagina: BolsoE01[]
  totalCartas: number
  valorColecao: number
}

const ex = E01.exemplo
const exemplo: ImgE01 = {
  gancho: { nome: ex.gancho.nome, imagem: ex.gancho.imagem, pct: ex.gancho.pct, ganho: ex.gancho.precoAgora - ex.gancho.precoAntes },
  // As 8 diferentes da Marina, na ordem do mockup aprovado.
  pagina: [
    { imagem: 'https://images.pokemontcg.io/swsh12pt5/160.png' },
    { imagem: 'https://images.pokemontcg.io/sv3pt5/151.png' },
    { gancho: true },
    { imagem: 'https://images.pokemontcg.io/sv10/204.png' },
    { imagem: 'https://images.pokemontcg.io/swsh11/186.png', mexeu: 'subiu' },
    { imagem: 'https://images.pokemontcg.io/sv3/205.png', mexeu: 'caiu' },
    { imagem: 'https://images.pokemontcg.io/sv3/224.png', mexeu: 'caiu' },
    { imagem: 'https://images.pokemontcg.io/base1/58.png' },
  ],
  totalCartas: ex.totalCartas,
  valorColecao: ex.valorColecao,
}

function valido(d: unknown): d is ImgE01 {
  if (!eObj(d) || !eObj(d.gancho) || !eLista(d.pagina, 0, 8)) return false
  const g = d.gancho
  return eStr(g.nome) && eStr(g.imagem) && eNum(g.pct) && eNum(g.ganho) && eNum(d.totalCartas) && eNum(d.valorColecao) &&
    d.pagina.every((b) => eObj(b) && (b.imagem === undefined || eStr(b.imagem)))
}

// Geometria do mockup (.m): fichario 300x360 em (12,10), pagina em (34,8) 254x344, padding 6,
// bolsos 76x106 com vao de 7.
const BW = 76
const BH = 106
const VAO = 7

async function desenhar(d: ImgE01) {
  const pagina = d.pagina.slice(0, 8)
  const [fundo, gancho, ...imgs] = await Promise.all([
    fundoFixo('e01/img-fichario-fundo.jpg'),
    imagemCartaImg(d.gancho.imagem, { largura: 136, altura: 190 }),
    ...pagina.map((b) => (b.imagem && !b.gancho ? imagemCartaImg(b.imagem, { largura: 70, altura: 100 }) : Promise.resolve(null))),
  ])

  const bolsos = Array.from({ length: 9 }, (_, i) => {
    const b = pagina[i]
    const x = 6 + (i % 3) * (BW + VAO)
    const y = 6 + Math.floor(i / 3) * (BH + VAO)
    const img = imgs[i]
    if (!b || (!img && !b.gancho)) {
      // bolso vazio de verdade: tracejado
      return (
        <Abs key={i} x={x} y={y} w={BW} h={BH} style={{ borderRadius: 6, background: C.elevado, border: `2px dashed ${C.borda2}` }} />
      )
    }
    if (b.gancho) {
      return (
        <Abs key={i} x={x} y={y} w={BW} h={BH} style={{ borderRadius: 6, background: C.fundo, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 10px 14px rgba(0,0,0,0.6)' }}>
          <Abs x={0} y={0} w={BW} h={BH} style={{ borderRadius: 6, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 22%)' }} />
        </Abs>
      )
    }
    const anel = b.mexeu === 'subiu' ? `0 0 0 2px ${C.verde}` : b.mexeu === 'caiu' ? `0 0 0 2px ${C.vermelho}` : 'inset 0 0 0 1px rgba(255,255,255,0.08)'
    return (
      <Abs key={i} x={x} y={y} w={BW} h={BH} style={{ borderRadius: 6, background: C.surface2, boxShadow: anel }}>
        <Carta src={img!} w={70} h={100} raio={4} brilho={null} sombra="0 4px 10px rgba(0,0,0,0.5)" style={{ left: 3, top: 3 }} />
        <Abs x={0} y={0} w={BW} h={BH} style={{ borderRadius: 6, backgroundImage: 'linear-gradient(125deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 38%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.06) 100%)' }} />
      </Abs>
    )
  })

  // marcadores por cima de todos os bolsos (nao ficam cortados pelo vizinho)
  const pips = pagina.map((b, i) => {
    if (!b.mexeu || b.gancho || !imgs[i]) return null
    const x = 6 + (i % 3) * (BW + VAO) - 13
    const y = 6 + Math.floor(i / 3) * (BH + VAO) - 13
    const sobe = b.mexeu === 'subiu'
    return (
      <Abs key={`p${i}`} x={x} y={y} w={28} h={28} style={{ borderRadius: 999, background: sobe ? C.verde : C.vermelho, boxShadow: `0 0 0 2.5px ${C.fundo}, 0 3px 6px rgba(0,0,0,0.5)`, alignItems: 'center', justifyContent: 'center' }}>
        <Seta dir={sobe ? 'cima' : 'baixo'} cor={C.tinta} tam={14} style={{ marginTop: sobe ? -1 : 1 }} />
      </Abs>
    )
  })

  const pct = `${d.gancho.pct >= 0 ? '+' : '-'}${Math.abs(Math.round(d.gancho.pct))}%`
  const ganho = `${d.gancho.ganho >= 0 ? '+' : '-'}${brlImg(Math.abs(d.gancho.ganho))}`
  const nomeTam = caber(d.gancho.nome, 22, 118, 14)
  const pctTam = caber(pct, 52, 120, 34, 0.6)
  const ganhoTam = caber(ganho, 26, 124, 18, 0.56)
  const total = brlImg(d.valorColecao)

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={598} height={380} style={{ position: 'absolute', left: 0, top: 0 }} />

      {/* fichario: mesma caixa e mesma rotacao do fundo */}
      <Abs x={12} y={10} w={300} h={360} style={{ transform: 'rotate(-1.5deg)' }}>
        <Abs x={34} y={8} w={254} h={344}>
          {bolsos}
          {pips}
        </Abs>
      </Abs>

      {/* a carta-gancho fora do bolso */}
      <Carta
        src={gancho}
        w={136}
        h={190}
        raio={8}
        sombra={`0 0 0 3px ${C.verde}, 0 0 34px rgba(34,197,94,0.45), 0 18px 30px rgba(0,0,0,0.6)`}
        style={{ left: 284, top: 30, transform: 'rotate(6deg)' }}
      />

      {/* barbante ate o ilhos */}
      <svg width={598} height={380} viewBox="0 0 598 380" style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d="M420 42 C 440 26, 466 32, 494 68" fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth={2.5} strokeLinecap="round" />
      </svg>

      {/* etiqueta verde */}
      <Abs x={424} y={46} w={142} style={{ flexDirection: 'column', alignItems: 'center', padding: '30px 12px 14px', borderRadius: 12, background: C.verde, color: C.tinta, transform: 'rotate(-3deg)', boxShadow: '0 14px 26px rgba(0,0,0,0.55)' }}>
        {/* ilhos: aro claro + furo escuro (o satori nao arredonda o spread do box-shadow) */}
        <Abs x={58.5} y={4.5} w={25} h={25} style={{ borderRadius: 12.5, background: 'rgba(10,10,10,0.35)' }} />
        <Abs x={59.5} y={5.5} w={23} h={23} style={{ borderRadius: 11.5, background: C.texto }} />
        <Abs x={63} y={9} w={16} h={16} style={{ borderRadius: 8, background: C.elevado, boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.8)' }} />
        <T max={118} style={{ fontSize: nomeTam, lineHeight: '26px', fontWeight: 700 }}>{d.gancho.nome}</T>
        <T style={{ fontSize: pctTam, lineHeight: '56px', fontWeight: 900, letterSpacing: -pctTam * 0.04, marginTop: 2 }}>{pct}</T>
        <T style={{ fontSize: ganhoTam, lineHeight: '30px', fontWeight: 800, letterSpacing: -ganhoTam * 0.02 }}>{ganho}</T>
        <T style={{ fontSize: 22, lineHeight: '26px', fontWeight: 600, marginTop: 2 }}>em 7 dias</T>
      </Abs>

      {/* total discreto */}
      <Abs x={322} y={256} w={270} style={{ flexDirection: 'column' }}>
        <T style={{ fontSize: 22, lineHeight: '27px', fontWeight: 600, color: C.texto2, letterSpacing: -0.22 }}>
          {d.totalCartas === 1 ? 'Sua 1 carta vale hoje' : `Suas ${d.totalCartas} cartas valem hoje`}
        </T>
        <T style={{ fontSize: caber(total, 30, 270, 22, 0.56), lineHeight: '36px', fontWeight: 800, letterSpacing: -0.6, color: C.texto }}>{total}</T>
        <T style={{ fontSize: 22, lineHeight: '27px', fontWeight: 500, color: C.texto2 }}>no Mercado Brasileiro</T>
      </Abs>
    </>
  )
}

export const e01Fichario: Desenho<ImgE01> = { largura: 598, altura: 380, fundo: C.elevado, exemplo, valido, desenhar }
