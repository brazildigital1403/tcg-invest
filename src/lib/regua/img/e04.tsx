import { E04 } from '@/lib/regua/templates/E04'
import { Abs, C, Check, type Desenho, GRAD, brlImg, eNum, eObj, eStr, fundoFixo, imagemCartaImg, numImg, Seta } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e04-proxima (600x372). Ref.: mockups/E04-pokedex-primeira-meta/assets/hero-proxima.html.
 * Fundo fixo: palco, mesa listrada e a fileira da pasta (img-proxima-fundo.jpg).
 * Por cima: "SEU <set>" / "voce tem N", os 3 bolsos (as cartas da pessoa com o
 * check e a que falta em cinza) e a etiqueta verde ligada ao bolso da que subiu.
 *
 * A carta que subiu vai sempre no bolso do meio: a etiqueta fica no lugar do
 * mockup e nunca cobre o "SEU <set>".
 */

export type ImgE04 = {
  /** Nome curto do set ("151"). */
  set: string
  /** Quantas cartas a pessoa tem no set. */
  tem: number
  /** A carta que mais subiu em 7 dias (a pessoa tem). */
  destaque: { imagem: string; pct: number; preco: number }
  /** Outra carta da pessoa no set (opcional). */
  outra: { imagem: string } | null
  /** A carta que falta (a mais procurada do set). */
  falta: { nome: string; imagem: string }
}

const ex = E04.exemplo
const exemplo: ImgE04 = {
  set: ex.set,
  tem: ex.tem.length,
  destaque: { imagem: 'https://images.pokemontcg.io/sv3pt5/180.png', pct: ex.destaque.pct, preco: ex.destaque.preco },
  outra: { imagem: 'https://images.pokemontcg.io/sv3pt5/151.png' },
  falta: { nome: ex.falta.nome, imagem: 'https://images.pokemontcg.io/sv3pt5/199.png' },
}

function valido(d: unknown): d is ImgE04 {
  return eObj(d) && eStr(d.set) && eNum(d.tem) &&
    eObj(d.destaque) && eStr(d.destaque.imagem) && eNum(d.destaque.pct) && eNum(d.destaque.preco) &&
    (d.outra === null || (eObj(d.outra) && eStr(d.outra.imagem))) &&
    eObj(d.falta) && eStr(d.falta.nome) && eStr(d.falta.imagem)
}

// pagina em (22,104); bolsos 168x234 no topo 12, em x = 12, 194, 376
const BY = 116
const BX = [34, 216, 398]

function Ok(props: { x: number; y: number }) {
  return (
    <Abs x={props.x} y={props.y} w={38} h={38} style={{ borderRadius: 19, background: C.texto, boxShadow: '0 4px 8px rgba(0,0,0,0.55)' }}>
      <Abs x={3} y={3} w={32} h={32} style={{ borderRadius: 16, backgroundImage: GRAD, alignItems: 'center', justifyContent: 'center' }}>
        <Check cor={C.tinta} tam={24} />
      </Abs>
    </Abs>
  )
}

async function desenhar(d: ImgE04) {
  const [fundo, dest, outra, falta] = await Promise.all([
    fundoFixo('e04/img-proxima-fundo.jpg'),
    imagemCartaImg(d.destaque.imagem, { largura: 168, altura: 234 }),
    d.outra ? imagemCartaImg(d.outra.imagem, { largura: 168, altura: 234 }) : Promise.resolve(null),
    imagemCartaImg(d.falta.imagem, { largura: 149, altura: 215, cinza: true }),
  ])
  const sombra = '0 10px 18px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)'
  const brilho = 'linear-gradient(118deg, rgba(255,255,255,0) 28%, rgba(255,255,255,0.20) 40%, rgba(255,255,255,0) 52%, rgba(255,255,255,0) 72%, rgba(255,255,255,0.06) 80%, rgba(255,255,255,0) 86%)'
  const setTxt = `SEU ${d.set.toUpperCase()}`
  const sobe = d.destaque.pct >= 0
  const cor = sobe ? C.verde : C.vermelho
  const nomeFalta = caber(d.falta.nome, 26, 230, 14, 0.56)

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={372} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Abs x={24} y={20} style={{ flexDirection: 'column' }}>
        <T max={165} style={{ fontSize: caber(setTxt, 28, 160, 14, 0.72), lineHeight: '32px', fontWeight: 900, letterSpacing: 2.8, color: C.ambar }}>{setTxt}</T>
        <T style={{ fontSize: 24, lineHeight: '30px', fontWeight: 700, color: C.sec }}>{`você tem ${d.tem}`}</T>
      </Abs>

      {/* bolso 1: a outra carta (ou vazio) */}
      {outra ? (
        <>
          <Carta src={outra} w={168} h={234} raio={9} sombra={sombra} brilho={brilho} style={{ left: BX[0], top: BY, transform: 'rotate(-1.5deg)' }} />
          <Ok x={BX[0] - 10} y={BY - 10} />
        </>
      ) : (
        <Abs x={BX[0]} y={BY} w={168} h={234} style={{ borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '2px solid rgba(255,255,255,0.08)' }} />
      )}

      {/* bolso 2: a que subiu */}
      <Carta src={dest} w={168} h={234} raio={9} sombra={sombra} brilho={brilho} style={{ left: BX[1], top: BY, transform: 'rotate(1.2deg)' }} />
      <Ok x={BX[1] - 10} y={BY - 10} />

      {/* bolso 3: a que falta, em cinza */}
      <Abs x={BX[2]} y={BY} w={168} h={234} style={{ borderRadius: 10, border: '2.5px dashed rgba(255,255,255,0.40)', background: 'rgba(255,255,255,0.03)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={falta} width={149} height={215} style={{ position: 'absolute', left: 7, top: 7, borderRadius: 7, opacity: 0.42 }} />
      </Abs>
      <Abs x={BX[2] - 40} y={284} w={248} style={{ justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 14px 7px', borderRadius: 12, background: C.elevado, border: '2px solid rgba(255,255,255,0.40)', boxShadow: '0 8px 16px rgba(0,0,0,0.6)', transform: 'rotate(-2deg)' }}>
          <T style={{ fontSize: 24, lineHeight: '26px', fontWeight: 700, color: C.sec }}>falta</T>
          <T max={230} style={{ fontSize: nomeFalta, lineHeight: '30px', fontWeight: 800, letterSpacing: -0.26, color: C.texto }}>{d.falta.nome}</T>
        </div>
      </Abs>

      {/* etiqueta da alta, ligada ao bolso do meio */}
      <Abs x={298} y={92} w={3} h={26} style={{ background: cor }} />
      <Abs x={290.5} y={107} w={18} h={18} style={{ borderRadius: 9, background: C.elevado }} />
      <Abs x={293.5} y={110} w={12} h={12} style={{ borderRadius: 6, background: cor }} />
      <Abs x={196} y={12} style={{ flexDirection: 'column', padding: '6px 16px 8px', borderRadius: 12, background: C.elevado, border: `2px solid ${cor}`, boxShadow: '0 8px 18px rgba(0,0,0,0.6)' }}>
        <T style={{ alignItems: 'center' }}>
          <Seta dir={sobe ? 'cima' : 'baixo'} cor={cor} tam={28} style={{ marginRight: 8 }} />
          <T style={{ fontSize: 32, lineHeight: '38px', fontWeight: 900, letterSpacing: -0.32, color: cor }}>{`${numImg(Math.abs(d.destaque.pct))}%`}</T>
          <T style={{ fontSize: 24, lineHeight: '38px', fontWeight: 700, color: C.sec, marginLeft: 8 }}>em 7 dias</T>
        </T>
        <T style={{ fontSize: 26, lineHeight: '28px', fontWeight: 800, color: C.texto }}>{brlImg(d.destaque.preco)}</T>
      </Abs>
    </>
  )
}

export const e04Proxima: Desenho<ImgE04> = { largura: 600, altura: 372, fundo: C.elevado, exemplo, valido, desenhar }
