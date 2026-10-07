import { E17 } from '@/lib/regua/templates/E17'
import { Abs, C, type Desenho, GRAD, brlImg, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg } from './base'
import { Carta, Faisca, T, caber } from './pecas'

/**
 * E17 (Seu 2026 na Bynx): o hero de Stories e 4 trofeus.
 * Ref.: mockups/E17-seu-2026/assets/hero-stories.html e trofeu-*.html.
 *
 * - e17-stories (600x400): fundo fixo atras (palco, "2026" vazado, chao e as
 *   duas telas laterais sem os numeros) + os numeros da pessoa + camada fixa
 *   transparente por cima (a tela da frente com a carta de costas e faiscas).
 *   Nunca o nome nem o valor da mais valiosa.
 * - e17-trofeu-cartas, -fichario, -repetidas, -primeira (244x136, fundo #080a0f).
 */

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

// ─── stories ────────────────────────────────────────────────────────────────

export type ImgE17Stories = {
  cartasHoje: number
  diferentes: number
  repetidas: { quantidade: number; valor: number }
}

const ex = E17.exemplo
const exStories: ImgE17Stories = {
  cartasHoje: ex.cartasHoje,
  diferentes: ex.diferentes,
  repetidas: { quantidade: ex.repetidas.quantidade, valor: ex.repetidas.valor },
}

function validoStories(d: unknown): d is ImgE17Stories {
  return eObj(d) && eNum(d.cartasHoje) && eNum(d.diferentes) && eObj(d.repetidas) && eNum(d.repetidas.quantidade) && eNum(d.repetidas.valor)
}

const NUM = (n: string) => ({
  fontSize: caber(n, 108, 150, 48, 0.62), lineHeight: 1, fontWeight: 900, letterSpacing: -7.56,
  backgroundImage: GRAD, backgroundClip: 'text' as const, color: 'transparent',
})

async function desenharStories(d: ImgE17Stories) {
  const [fundo, frente] = await Promise.all([
    fundoFixo('e17/img-stories-fundo.jpg'),
    fundoFixo('e17/img-stories-frente.png'),
  ])
  const n1 = String(d.cartasHoje)
  const n2 = String(d.repetidas.quantidade)
  const dif = `${d.diferentes} ${d.diferentes === 1 ? 'diferente' : 'diferentes'}`
  const valor = brlImg(d.repetidas.valor)
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={400} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={34} y={58} w={192} h={318} style={{ transform: 'rotate(-6deg)' }}>
        <T style={{ position: 'absolute', left: 12, top: 46, ...NUM(n1) }}>{n1}</T>
        <T style={{ position: 'absolute', left: 16, top: 152, fontSize: 26, lineHeight: 1, fontWeight: 800, color: C.texto }}>{d.cartasHoje === 1 ? 'carta' : 'cartas'}</T>
        <T style={{ position: 'absolute', left: 10, top: 190, fontSize: caber(dif, 22, 170, 15), lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.22, color: C.sec }}>{dif}</T>
      </Abs>
      <Abs x={374} y={58} w={192} h={318} style={{ transform: 'rotate(6deg)' }}>
        <T style={{ position: 'absolute', left: 58, top: 46, ...NUM(n2) }}>{n2}</T>
        <T style={{ position: 'absolute', left: 52, top: 152, fontSize: 26, lineHeight: 1, fontWeight: 800, color: C.texto }}>{d.repetidas.quantidade === 1 ? 'repetida' : 'repetidas'}</T>
        <T style={{ position: 'absolute', left: 52, top: 192, fontSize: caber(valor, 26, 150, 16, 0.5), lineHeight: 1, fontWeight: 900, letterSpacing: -0.78, color: C.verde }}>{valor}</T>
      </Abs>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={frente} width={600} height={400} style={{ position: 'absolute', left: 0, top: 0 }} />
    </>
  )
}

// ─── trofeu 1: cartas ───────────────────────────────────────────────────────

export type ImgE17TrofeuCartas = {
  /** A primeira carta da colecao. */
  primeira: string
  /** As 2 cartas mais recentes (topo da pilha); 1 basta. */
  recentes: string[]
}

const exCartas: ImgE17TrofeuCartas = {
  primeira: 'https://images.pokemontcg.io/base1/58.png',
  recentes: ['https://images.pokemontcg.io/sv3/224.png', 'https://images.pokemontcg.io/sv3/205.png'],
}

function validoCartas(d: unknown): d is ImgE17TrofeuCartas {
  return eObj(d) && eStr(d.primeira) && eLista(d.recentes, 1, 2) && d.recentes.every(eStr)
}

async function desenharCartas(d: ImgE17TrofeuCartas) {
  const [fundo, uma, ...recentes] = await Promise.all([
    fundoFixo('e17/img-trofeu-cartas-fundo.jpg'),
    imagemCartaImg(d.primeira, { largura: 52, altura: 72 }),
    ...d.recentes.slice(0, 2).map((u) => imagemCartaImg(u, { largura: 72, altura: 100 })),
  ])
  const sombra = '0 0 0 1px rgba(255,255,255,0.2), 0 12px 18px rgba(0,0,0,0.6)'
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Carta src={uma} w={52} h={72} raio={4} brilho={null} sombra="0 8px 14px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.14)" style={{ left: 18, top: 38, transform: 'rotate(-6deg)' }} />
      <Carta src={recentes[0]} w={72} h={100} raio={5} brilho={null} sombra={sombra} style={{ left: 134, top: 20, transform: 'rotate(-5deg)' }} />
      {recentes[1] ? <Carta src={recentes[1]} w={72} h={100} raio={5} brilho={null} sombra={sombra} style={{ left: 158, top: 18, transform: 'rotate(6deg)' }} /> : null}
      <Faisca x={216} y={4} f={18} />
      <Faisca x={124} y={18} f={11} />
    </>
  )
}

// ─── trofeu 2: fichario ─────────────────────────────────────────────────────

export type ImgE17TrofeuFichario = {
  /** Ate 7 cartas diferentes da pessoa (a mais valiosa NAO entra: ela fica de costas no meio). */
  cartas: string[]
}

const exFichario: ImgE17TrofeuFichario = {
  cartas: [
    'https://images.pokemontcg.io/base1/58.png',
    'https://images.pokemontcg.io/sv3pt5/151.png',
    'https://images.pokemontcg.io/sv3pt5/180.png',
    'https://images.pokemontcg.io/swsh12pt5/160.png',
    'https://images.pokemontcg.io/sv3/224.png',
    'https://images.pokemontcg.io/sv3/205.png',
    'https://images.pokemontcg.io/sv10/204.png',
  ],
}

function validoFichario(d: unknown): d is ImgE17TrofeuFichario {
  return eObj(d) && eLista(d.cartas, 0, 7) && d.cartas.every(eStr)
}

// pagina achatada (o mockup tem rotateX): 100x120 em (38,8), padding 6, vao 4
const PW = 100
const PH = 120
const CW = (PW - 12 - 8) / 3
const CH = (PH - 12 - 8) / 3

async function desenharFichario(d: ImgE17TrofeuFichario) {
  const cartas = d.cartas.slice(0, 7)
  const [fundo, emblema, ...imgs] = await Promise.all([
    fundoFixo('e17/img-trofeu-fichario-fundo.jpg'),
    fundoFixo('e17/img-emblema.png'),
    ...cartas.map((u) => imagemCartaImg(u, { largura: CW, altura: CH, posY: 0.2 })),
  ])
  // centro (indice 4) = a mais valiosa, de costas; as outras em volta, na ordem
  const ordem = [0, 1, 2, 3, 5, 6, 7, 8]
  const brilho = 'linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.18) 42%, rgba(255,255,255,0) 54%)'
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={38} y={8} w={PW} h={PH} style={{ transform: 'rotate(-6deg)', borderRadius: 8, backgroundImage: 'linear-gradient(180deg, #0d0f14, #080a0f)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14), 0 18px 28px rgba(0,0,0,0.7)' }}>
        {Array.from({ length: 9 }, (_, cel) => {
          const x = 6 + (cel % 3) * (CW + 4)
          const y = 6 + Math.floor(cel / 3) * (CH + 4)
          if (cel === 4) {
            return (
              <Abs key={cel} x={x} y={y} w={CW} h={CH} style={{ borderRadius: 3, backgroundImage: GRAD, boxShadow: '0 0 10px rgba(245,158,11,0.6)' }}>
                <Abs x={2} y={2} w={CW - 4} h={CH - 4} style={{ borderRadius: 2, background: C.fundo, alignItems: 'center', justifyContent: 'center' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={emblema} width={(CW - 4) * 0.62} height={(CW - 4) * 0.62 * (160 / 140)} />
                </Abs>
              </Abs>
            )
          }
          const k = ordem.indexOf(cel)
          const src = imgs[k]
          return (
            <Abs key={cel} x={x} y={y} w={CW} h={CH} style={{ borderRadius: 3, background: 'rgba(255,255,255,0.04)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src ? <img alt="" src={src} width={CW} height={CH} style={{ position: 'absolute', left: 0, top: 0 }} /> : null}
              <Abs x={0} y={0} w={CW} h={CH} style={{ backgroundImage: brilho }} />
            </Abs>
          )
        })}
      </Abs>
    </>
  )
}

// ─── trofeu 3: repetidas ────────────────────────────────────────────────────

export type ImgE17TrofeuRepetidas = {
  /** Ate 3 repetidas: imagem e quantas copias a pessoa tem. */
  repetidas: { imagem: string; copias: number }[]
}

const exRepetidas: ImgE17TrofeuRepetidas = {
  repetidas: [
    { imagem: 'https://images.pokemontcg.io/sv10/204.png', copias: 2 },
    { imagem: 'https://images.pokemontcg.io/sv3pt5/151.png', copias: 2 },
    { imagem: 'https://images.pokemontcg.io/base1/58.png', copias: 2 },
  ],
}

function validoRepetidas(d: unknown): d is ImgE17TrofeuRepetidas {
  return eObj(d) && eLista(d.repetidas, 1, 3) && d.repetidas.every((r) => eObj(r) && eStr(r.imagem) && eNum(r.copias))
}

const POS_PARES: Record<number, number[]> = { 1: [86], 2: [48, 124], 3: [10, 86, 162] }

async function desenharRepetidas(d: ImgE17TrofeuRepetidas) {
  const reps = d.repetidas.slice(0, 3)
  const [fundo, ...cima] = await Promise.all([
    fundoFixo('e17/img-trofeu-repetidas-fundo.jpg'),
    ...reps.map((r) => imagemCartaImg(r.imagem, { largura: 62, altura: 86 })),
  ])
  const baixo = await Promise.all(reps.map((r) => imagemCartaImg(r.imagem, { largura: 62, altura: 86, brilho: 0.7 })))
  const xs = POS_PARES[reps.length]
  const sombra = '0 0 0 1px rgba(255,255,255,0.16), 0 10px 16px rgba(0,0,0,0.6)'
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      {reps.map((r, i) => (
        <Abs key={i} x={xs[i]} y={24} w={62} h={86}>
          <Carta src={baixo[i]} w={62} h={86} raio={4} brilho={null} sombra={sombra} style={{ left: 7, top: 7, transform: 'rotate(7deg)' }} />
          <Carta src={cima[i]} w={62} h={86} raio={4} brilho={null} sombra={sombra} style={{ left: 0, top: 0, transform: 'rotate(-3deg)' }} />
          <Abs x={38} y={-12} w={36} h={36} style={{ borderRadius: 18, background: C.texto, boxShadow: `0 4px 10px rgba(0,0,0,0.6), 0 0 0 2px ${C.verde}`, alignItems: 'center', justifyContent: 'center' }}>
            <T style={{ fontSize: r.copias > 9 ? 17 : 22, fontWeight: 900, letterSpacing: -0.44, color: C.tinta }}>{String(r.copias)}</T>
          </Abs>
        </Abs>
      ))}
      <Faisca x={226} y={104} f={14} />
    </>
  )
}

// ─── trofeu 4: a primeira ───────────────────────────────────────────────────

export type ImgE17TrofeuPrimeira = {
  imagem: string
  /** Dia em que entrou, "18/05" (vira "18 MAI"). */
  data: string
}

const exPrimeira: ImgE17TrofeuPrimeira = { imagem: 'https://images.pokemontcg.io/base1/58.png', data: '18/05' }

function validoPrimeira(d: unknown): d is ImgE17TrofeuPrimeira {
  return eObj(d) && eStr(d.imagem) && eStr(d.data)
}

async function desenharPrimeira(d: ImgE17TrofeuPrimeira) {
  const [fundo, carta] = await Promise.all([
    fundoFixo('e17/img-trofeu-primeira-fundo.jpg'),
    imagemCartaImg(d.imagem, { largura: 78, altura: 109 }),
  ])
  const [dd, mm] = d.data.split('/')
  const mes = MESES[Number.parseInt(mm ?? '', 10) - 1]
  const rotulo = mes ? `${dd} ${mes}` : d.data
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={244} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Carta src={carta} w={78} h={109} raio={5}
        sombra="0 0 0 1px rgba(255,255,255,0.2), 0 14px 22px rgba(0,0,0,0.65), 0 0 22px rgba(245,158,11,0.35)"
        brilho="linear-gradient(118deg, rgba(240,240,240,0) 30%, rgba(240,240,240,0.22) 42%, rgba(240,240,240,0) 54%)"
        style={{ left: 52, top: 14, transform: 'rotate(-6deg)' }} />
      <Abs x={124} y={30} w={2} h={36} style={{ background: 'rgba(240,240,240,0.55)', transform: 'rotate(-48deg)', transformOrigin: 'top' }} />
      {/* texto da etiqueta (a etiqueta em si esta no fundo) */}
      <Abs x={142} y={52} w={94} h={46} style={{ transform: 'rotate(7deg)', alignItems: 'center', justifyContent: 'center', paddingLeft: 16 }}>
        <T style={{ fontSize: caber(rotulo, 24, 80, 14, 0.5), lineHeight: 1, fontWeight: 900, letterSpacing: -0.72, color: C.tinta }}>{rotulo}</T>
      </Abs>
      <Faisca x={40} y={8} f={18} />
      <Faisca x={118} y={104} f={12} />
    </>
  )
}

const T244 = { largura: 244, altura: 136, fundo: C.fundo }
export const e17Stories: Desenho<ImgE17Stories> = { largura: 600, altura: 400, fundo: C.elevado, exemplo: exStories, valido: validoStories, desenhar: desenharStories }
export const e17TrofeuCartas: Desenho<ImgE17TrofeuCartas> = { ...T244, exemplo: exCartas, valido: validoCartas, desenhar: desenharCartas }
export const e17TrofeuFichario: Desenho<ImgE17TrofeuFichario> = { ...T244, exemplo: exFichario, valido: validoFichario, desenhar: desenharFichario }
export const e17TrofeuRepetidas: Desenho<ImgE17TrofeuRepetidas> = { ...T244, exemplo: exRepetidas, valido: validoRepetidas, desenhar: desenharRepetidas }
export const e17TrofeuPrimeira: Desenho<ImgE17TrofeuPrimeira> = { ...T244, exemplo: exPrimeira, valido: validoPrimeira, desenhar: desenharPrimeira }
