import { E14, EXEMPLOS_EXTRAS } from '@/lib/regua/templates/E14'
import { Abs, C, type Desenho, GRAD, eNum, eObj, eStr, fundoFixo, imagemCartaImg } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e14-arrematado e e14-faltou (600x372). Ref.: mockups/E14-leilao-resultado/assets/hero-a.html e hero-b.html.
 *
 * A (arrematado): nenhum valor desenhado. Fundo fixo atras (palco, luz, chao,
 * sombra) + a foto do lote + uma camada fixa transparente POR CIMA (base,
 * martelo batendo, raios, carimbo ARREMATADO e confete), porque no mockup
 * tudo isso passa na frente da carta.
 *
 * B (faltou): fundo fixo com base, martelo parado e confete; por cima a placa
 * do lote, o placar (martelo e seu lance riscado), a carta e a etiqueta verde
 * do anuncio da mesma carta no Mercado (sem anuncio, sem etiqueta).
 */

export type ImgE14Arrematado = {
  /** Foto do lote (storage da Bynx) ou imagem da carta. */
  imagem: string
}

export type ImgE14Faltou = {
  imagem: string
  /** true enquanto a imagem nao e a foto do proprio lote. */
  imagemIlustrativa: boolean
  /** Numero do lote ("14"). */
  lote: string
  seuLance: number
  martelo: number
  /** Preco do anuncio da mesma carta; null = sem etiqueta. */
  anuncio: number | null
}

/** "R$ 1.350" sem centavo quando inteiro (como o placar do mockup). */
function rsCurto(v: number): string {
  return Number.isInteger(v)
    ? `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
    : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')
}

const exA: ImgE14Arrematado = { imagem: E14.exemplo.carta.imagem }
const b = EXEMPLOS_EXTRAS.b
const exB: ImgE14Faltou = b.resultado === 'faltou'
  ? { imagem: b.carta.imagem, imagemIlustrativa: b.imagemIlustrativa, lote: b.lote.numero, seuLance: b.faltou.seuLance, martelo: b.faltou.martelo, anuncio: b.faltou.anuncio?.preco ?? null }
  : { imagem: b.carta.imagem, imagemIlustrativa: true, lote: b.lote.numero, seuLance: 0, martelo: 0, anuncio: null }

function validoA(d: unknown): d is ImgE14Arrematado {
  return eObj(d) && eStr(d.imagem)
}

function validoB(d: unknown): d is ImgE14Faltou {
  return eObj(d) && eStr(d.imagem) && typeof d.imagemIlustrativa === 'boolean' && eStr(d.lote) &&
    eNum(d.seuLance) && eNum(d.martelo) && (d.anuncio === null || eNum(d.anuncio))
}

async function desenharA(d: ImgE14Arrematado) {
  const [fundo, frente, carta] = await Promise.all([
    fundoFixo('e14/img-arrematado-fundo.jpg'),
    fundoFixo('e14/img-arrematado-frente.png'),
    imagemCartaImg(d.imagem, { largura: 222, altura: 310 }),
  ])
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={372} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Carta src={carta} w={222} h={310} raio={12}
        sombra="0 40px 60px rgba(8,10,15,0.85), 0 0 0 1px rgba(255,255,255,0.18), 0 0 80px rgba(245,158,11,0.40)"
        brilho="linear-gradient(120deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.26) 33%, rgba(255,255,255,0) 46%)"
        style={{ left: 224, top: 16, transform: 'rotate(3deg)' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={frente} width={600} height={372} style={{ position: 'absolute', left: 0, top: 0 }} />
    </>
  )
}

async function desenharB(d: ImgE14Faltou) {
  const [fundo, carta] = await Promise.all([
    fundoFixo('e14/img-faltou-fundo.jpg'),
    imagemCartaImg(d.imagem, { largura: 186, altura: 260 }),
  ])
  const lote = `LOTE ${d.lote}`
  const martelo = rsCurto(d.martelo)
  const seu = rsCurto(d.seuLance)
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={372} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Abs x={74} y={296} w={96} h={24} style={{ borderRadius: 6, backgroundImage: 'linear-gradient(180deg, #f59e0b, #ef4444)', alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontSize: caber(lote, 14, 86, 10, 0.75), lineHeight: '24px', fontWeight: 800, letterSpacing: 1.96, color: C.tinta }}>{lote}</T>
      </Abs>

      <Abs x={214} y={70} w={156} style={{ flexDirection: 'column', padding: '9px 14px 10px', borderRadius: 12, backgroundImage: GRAD, transform: 'rotate(-3deg)', boxShadow: '0 18px 34px rgba(8,10,15,0.7), 0 0 50px rgba(245,158,11,0.30)' }}>
        <T style={{ fontSize: 12, lineHeight: '14px', fontWeight: 800, letterSpacing: 1.44, color: C.tinta }}>MARTELO</T>
        <T style={{ fontSize: caber(martelo, 30, 128, 18, 0.58), lineHeight: '34px', fontWeight: 800, letterSpacing: -0.6, color: C.tinta }}>{martelo}</T>
      </Abs>
      <Abs x={224} y={168} w={156} style={{ flexDirection: 'column', padding: '9px 14px 10px', borderRadius: 12, background: C.surface2, transform: 'rotate(5deg)', boxShadow: '0 14px 26px rgba(8,10,15,0.7), inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
        <T style={{ fontSize: 12, lineHeight: '14px', fontWeight: 800, letterSpacing: 1.44, color: C.sec }}>SEU LANCE</T>
        <div style={{ display: 'flex', position: 'relative', alignSelf: 'flex-start' }}>
          <T style={{ fontSize: caber(seu, 30, 128, 18, 0.58), lineHeight: '34px', fontWeight: 800, letterSpacing: -0.6, color: C.sec }}>{seu}</T>
          <Abs x={-4} y={17} h={4} style={{ right: -4, borderRadius: 2, background: C.vermelho, transform: 'rotate(-6deg)' }} />
        </div>
      </Abs>

      <Carta src={carta} w={186} h={260} raio={11}
        sombra="0 36px 54px rgba(8,10,15,0.85), 0 0 0 1px rgba(255,255,255,0.18), 0 0 70px rgba(245,158,11,0.32)"
        brilho="linear-gradient(120deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.24) 33%, rgba(255,255,255,0) 46%)"
        style={{ left: 398, top: 30, transform: 'rotate(4deg)' }}>
        {d.imagemIlustrativa ? (
          <Abs x={0} y={129} style={{ padding: '4px 8px 4px 7px', borderRadius: '0 6px 6px 0', background: 'rgba(13,15,20,0.92)', boxShadow: '0 0 0 1px rgba(255,255,255,0.14)' }}>
            <T style={{ fontSize: 9, lineHeight: '11px', fontWeight: 800, letterSpacing: 0.72, color: C.texto }}>IMAGEM ILUSTRATIVA</T>
          </Abs>
        ) : null}
      </Carta>

      {d.anuncio !== null ? (
        <Abs x={404} y={270} style={{ flexDirection: 'column', padding: '8px 14px 9px', borderRadius: 12, background: C.elevado, transform: 'rotate(-5deg)', boxShadow: `0 0 0 2px ${C.verde}, 0 16px 30px rgba(8,10,15,0.75)` }}>
          <T style={{ fontSize: 12, lineHeight: '14px', fontWeight: 800, letterSpacing: 1.44, color: C.verde }}>À VENDA NO MERCADO</T>
          <T style={{ fontSize: caber(rsCurto(d.anuncio), 26, 150, 18, 0.58), lineHeight: '30px', fontWeight: 800, letterSpacing: -0.52, color: C.texto }}>{rsCurto(d.anuncio)}</T>
        </Abs>
      ) : null}
    </>
  )
}

export const e14Arrematado: Desenho<ImgE14Arrematado> = { largura: 600, altura: 372, fundo: C.elevado, exemplo: exA, valido: validoA, desenhar: desenharA }
export const e14Faltou: Desenho<ImgE14Faltou> = { largura: 600, altura: 372, fundo: C.elevado, exemplo: exB, valido: validoB, desenhar: desenharB }
