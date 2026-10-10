import { E09 } from '@/lib/regua/templates/E09'
import { Abs, C, type Desenho, brlImg, eNum, eObj, eStr, fundoFixo, imagemCartaImg, svgUri } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e09-bolso (600x420). Ref.: mockups/E09-carta-do-seu-set/assets/hero-bolso.html.
 * Fundo fixo: palco, a placa da pagina, a sombra da carta e as faiscas
 * (img-bolso-fundo.jpg). Por cima: "Seu <set>", "Voce tem: <carta>", os 9
 * bolsos numerados com o da carta anunciada vazio em rosa, a seta tracejada,
 * a carta a venda e o par de precos.
 *
 * Bolsos: os 9 numeros que terminam no da carta (012 a 020 no exemplo); com
 * numero abaixo de 9, a pagina e 001 a 009 e a seta aponta para o bolso dela.
 */

export type ImgE09 = {
  /** Nome do set ("Crown Zenith"). */
  set: string
  /** A carta que a pessoa tem nesse set (miniatura do rotulo). */
  temNoSet: { nome: string; imagem: string }
  anuncio: {
    imagem: string
    /** Numero da carta no set, como aparece ("020"). */
    numero: string
    preco: number
    /** Menor preco da MESMA carta no Mercado Brasileiro. */
    mercado: number
  }
}

const ex = E09.exemplo
const exemplo: ImgE09 = {
  set: ex.set.nome,
  temNoSet: { nome: ex.set.cartaQueTem, imagem: 'https://images.pokemontcg.io/swsh12pt5/160.png' },
  anuncio: { imagem: 'https://images.pokemontcg.io/swsh12pt5/20.png', numero: '020', preco: ex.anuncio.preco, mercado: ex.anuncio.mercado },
}

function valido(d: unknown): d is ImgE09 {
  return eObj(d) && eStr(d.set) && eObj(d.temNoSet) && eStr(d.temNoSet.nome) && eStr(d.temNoSet.imagem) &&
    eObj(d.anuncio) && eStr(d.anuncio.imagem) && eStr(d.anuncio.numero) && eNum(d.anuncio.preco) && eNum(d.anuncio.mercado)
}

// grade: pagina (16,8) + (20,80); bolsos 80x100, vao 8
const GX = 36
const GY = 88

async function desenhar(d: ImgE09) {
  const [fundo, carta, mini] = await Promise.all([
    fundoFixo('e09/img-bolso-fundo.jpg'),
    imagemCartaImg(d.anuncio.imagem, { largura: 186, altura: 260 }),
    imagemCartaImg(d.temNoSet.imagem, { largura: 21, altura: 29 }),
  ])

  const digitos = d.anuncio.numero.replace(/\D/g, '')
  const n = Number.parseInt(digitos || '0', 10)
  const casas = Math.max(3, digitos.length)
  const primeiro = n >= 9 ? n - 8 : 1
  const vazio = n >= 9 ? 8 : Math.max(0, n - 1)
  const rotulo = (k: number) => String(k).padStart(casas, '0')

  // seta da carta ate o bolso vazio (a do mockup vai ate o ultimo bolso)
  const cx = vazio % 3
  const cy = Math.floor(vazio / 3)
  const ex2 = GX + cx * 88 + 90
  const ey = GY + cy * 108 + 42
  const seta = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420" viewBox="0 0 600 420">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
    <path d="M 360 240 C ${360 - (360 - ex2) * 0.34} ${240 + (ey - 240) * 0.4}, ${ex2 + 22} ${ey - 26}, ${ex2} ${ey}" fill="none" stroke="url(#g)" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>
    <path d="M ${ex2 - 4} ${ey - 14} L ${ex2 - 2} ${ey + 3} L ${ex2 + 14} ${ey}" fill="none" stroke="#ec4899" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`

  const setTxt = `Seu ${d.set}`
  const temTxt = `Você tem: ${d.temNoSet.nome}`
  const preco = brlImg(d.anuncio.preco)

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={420} style={{ position: 'absolute', left: 0, top: 0 }} />

      <T max={262} style={{ position: 'absolute', left: 36, top: 18, fontSize: caber(setTxt, 22, 262, 14), lineHeight: '28px', fontWeight: 700, color: C.texto }}>{setTxt}</T>
      <Abs x={36} y={48} h={30} style={{ alignItems: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={mini} width={21} height={29} style={{ borderRadius: 3, marginRight: 8, boxShadow: '0 0 0 1px rgba(255,255,255,0.08)' }} />
        <T max={232} style={{ fontSize: caber(temTxt, 22, 232, 14), lineHeight: '28px', fontWeight: 600, color: C.sec }}>{temTxt}</T>
      </Abs>

      {Array.from({ length: 9 }, (_, i) => {
        const x = GX + (i % 3) * 88
        const y = GY + Math.floor(i / 3) * 108
        const num = rotulo(primeiro + i)
        if (i === vazio) {
          return (
            <Abs key={i} x={x} y={y} w={80} h={100} style={{ borderRadius: 10, border: `2px dashed ${C.rosa}`, background: 'rgba(236,72,153,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <Abs x={0} y={0} w={76} h={96} style={{ backgroundImage: 'radial-gradient(circle at center, rgba(236,72,153,0.28) 0%, rgba(236,72,153,0) 60%)' }} />
              <T style={{ fontSize: caber(num, 22, 70, 14, 0.62), lineHeight: '26px', fontWeight: 800, color: C.texto }}>{num}</T>
            </Abs>
          )
        }
        return (
          <Abs key={i} x={x} y={y} w={80} h={100} style={{ borderRadius: 10, background: C.fundo, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Abs x={0} y={0} w={80} h={100} style={{ borderRadius: 10, backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 40%)' }} />
            <T style={{ fontSize: caber(num, 22, 70, 14, 0.62), lineHeight: '26px', fontWeight: 700, color: C.ter }}>{num}</T>
          </Abs>
        )
      })}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={svgUri(seta)} width={600} height={420} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Carta src={carta} w={186} h={260} raio={10}
        sombra="0 28px 44px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08), 0 0 50px rgba(236,72,153,0.42)"
        brilho="linear-gradient(120deg, rgba(255,255,255,0) 24%, rgba(255,255,255,0.24) 36%, rgba(255,255,255,0) 48%)"
        style={{ left: 366, top: 16, transform: 'rotate(-7deg)' }} />

      <Abs x={352} y={298} style={{ flexDirection: 'column' }}>
        <T style={{ alignItems: 'baseline' }}>
          <T style={{ fontSize: caber(preco, 34, 160, 24, 0.56), lineHeight: '38px', fontWeight: 800, letterSpacing: -0.6, color: C.texto }}>{preco}</T>
          <T style={{ fontSize: 22, lineHeight: '38px', fontWeight: 600, color: C.sec, marginLeft: 8 }}>à venda</T>
        </T>
        <T style={{ marginTop: 6, fontSize: 22, lineHeight: '26px', fontWeight: 600, color: C.sec }}>Mercado Brasileiro:</T>
        <T style={{ fontSize: 22, lineHeight: '26px', fontWeight: 800, color: C.texto }}>{brlImg(d.anuncio.mercado)}</T>
      </Abs>
    </>
  )
}

export const e09Bolso: Desenho<ImgE09> = { largura: 600, altura: 420, fundo: C.elevado, exemplo, valido, desenhar }
