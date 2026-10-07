import { E20 } from '@/lib/regua/templates/E20'
import { Abs, C, type Desenho, GRAD, brlImg, eLista, eNum, eObj, eStr, fundoFixo, imagemCartaImg, numImg } from './base'
import { Carta, T } from './pecas'

/**
 * e20-varal (600x320). Ref.: mockups/E20-venda-suas-repetidas/assets/hero.html.
 * Fundo fixo atras: parede, raios e halo ambar, o fio e os ganchos
 * (img-varal-fundo.jpg). Por cima: as ate 3 repetidas, cada uma com a copia
 * gemea atras (a 1a, maior, no centro), e as etiquetas com o menor preco de
 * hoje (a do centro com o "era" de 30 dias atras, quando em alta). Camada fixa
 * transparente por cima (img-varal-frente.png): os prendedores e os brilhos.
 */

export type ImgE20 = {
  /** Ate 3 repetidas; a 1a e a mais cara (centro). */
  repetidas: { imagem: string; preco: number }[]
  /** Menor preco da 1a 30 dias atras, quando em alta; senao null. */
  altaDe: number | null
}

const ex = E20.exemplo
const exemplo: ImgE20 = {
  repetidas: ex.repetidas.map((r) => ({ imagem: r.imagem, preco: r.preco })),
  altaDe: ex.altaDe,
}

function valido(d: unknown): d is ImgE20 {
  return eObj(d) && eLista(d.repetidas, 1, 3) && d.repetidas.every((r) => eObj(r) && eStr(r.imagem) && eNum(r.preco)) &&
    (d.altaDe === null || eNum(d.altaDe))
}

// Mesma conta do mockup: fio Q de (14,20) a (586,20) com controle (300,60).
const yDe = (x: number) => { const t = (x - 14) / 572; return 20 + 80 * t * (1 - t) }

type Vaga = { x: number; w: number; tilt: number; gem: { dx: number; dr: number }; lap: number; tagDx: number; top?: boolean }
const CENTRO: Vaga = { x: 300, w: 184, tilt: 0, gem: { dx: 30, dr: 7 }, lap: 58, tagDx: 0, top: true }
const ESQ: Vaga = { x: 172, w: 120, tilt: -5, gem: { dx: -14, dr: -7 }, lap: 26, tagDx: -16 }
const DIR: Vaga = { x: 428, w: 120, tilt: 5, gem: { dx: 14, dr: 7 }, lap: 26, tagDx: 16 }

function geometria(v: Vaga) {
  const h = Math.round(v.w * 1.395)
  const y = yDe(v.x)
  const th = (v.tilt * Math.PI) / 180
  const oy = h - 4
  const ax = v.x - oy * Math.sin(th)
  const ay = y - 10 + oy * Math.cos(th)
  const furo = ay - v.lap + 8
  return { h, y, ax, furo }
}

async function desenhar(d: ImgE20) {
  const reps = d.repetidas.slice(0, 3)
  const vagas = [CENTRO, ESQ, DIR].slice(0, reps.length)
  const [fundo, frente, ...imgs] = await Promise.all([
    fundoFixo('e20/img-varal-fundo.jpg'),
    fundoFixo('e20/img-varal-frente.png'),
    ...reps.flatMap((r, i) => {
      const v = vagas[i]
      const h = Math.round(v.w * 1.395)
      return [
        imagemCartaImg(r.imagem, { largura: v.w, altura: h, brilho: 0.55 }),
        imagemCartaImg(r.imagem, { largura: v.w, altura: h, brilho: v.top ? 1 : 0.72 }),
      ]
    }),
  ])
  const reflexo = 'linear-gradient(125deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.16) 42%, rgba(255,255,255,0) 54%)'

  // ordem de pintura: laterais primeiro, centro por cima; etiquetas depois de todas as cartas
  const ordem = vagas.map((_, i) => i).sort((a, b) => Number(Boolean(vagas[a].top)) - Number(Boolean(vagas[b].top)))
  const itens = ordem.map((i) => {
    const v = vagas[i]
    const g = geometria(v)
    const gemea = imgs[i * 2]
    const frenteImg = imgs[i * 2 + 1]
    return (
      <Abs key={`c${i}`} x={v.x - v.w / 2} y={g.y - 10} w={v.w} h={g.h} style={{ transform: `rotate(${v.tilt}deg)`, transformOrigin: 'top' }}>
        <Carta src={gemea} w={v.w} h={g.h} raio={6} brilho={reflexo}
          sombra="7px 16px 18px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.10)"
          style={{ left: 0, top: 0, transform: `translate(${v.gem.dx}px, 4px) rotate(${v.gem.dr}deg)`, transformOrigin: 'top' }} />
        <Carta src={frenteImg} w={v.w} h={g.h} raio={v.top ? 8 : 6} brilho={reflexo}
          sombra={v.top
            ? '10px 22px 26px rgba(0,0,0,0.66), 0 0 0 3px #f59e0b, 0 0 0 5px rgba(239,68,68,0.55), 0 0 44px 14px rgba(245,158,11,0.62)'
            : '7px 16px 18px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.10)'}
          style={{ left: 0, top: 0 }} />
      </Abs>
    )
  })

  const etiquetas = ordem.map((i) => {
    const v = vagas[i]
    const g = geometria(v)
    const valor = numImg(reps[i].preco, 2)
    const top = Boolean(v.top)
    return (
      <Abs key={`t${i}`} x={g.ax + v.tagDx - 150} y={g.furo - 9} w={300} style={{ justifyContent: 'center' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative',
          padding: top ? '15px 15px 7px' : '15px 11px 7px', borderRadius: 10,
          ...(top ? { backgroundImage: GRAD } : { background: C.texto }),
          boxShadow: '0 10px 18px rgba(0,0,0,0.55)', transform: `rotate(${v.tilt / 3}deg)`,
        }}>
          <Abs x={0} y={6} style={{ left: 0, right: 0, justifyContent: 'center' }}>
            <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 3.5, background: C.elevado }} />
          </Abs>
          <T style={{ alignItems: 'baseline' }}>
            <T style={{ fontSize: top ? 24 : 22, lineHeight: top ? '36px' : '28px', fontWeight: 800, color: C.tinta, opacity: 0.82, marginRight: 4 }}>R$</T>
            <T style={{ fontSize: top ? 36 : 26, lineHeight: top ? '36px' : '28px', fontWeight: 800, letterSpacing: top ? -1 : -0.5, color: C.tinta }}>{valor}</T>
          </T>
          {top && d.altaDe ? (
            <T style={{ marginTop: 1, fontSize: 22, lineHeight: '24px', fontWeight: 700, color: C.tinta }}>
              era
              <div style={{ display: 'flex', position: 'relative', marginLeft: 6 }}>
                <T>{brlImg(d.altaDe)}</T>
                <Abs x={0} y={12} h={2} style={{ right: 0, background: C.tinta }} />
              </div>
            </T>
          ) : null}
        </div>
      </Abs>
    )
  })

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
      {itens}
      {etiquetas}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={frente} width={600} height={320} style={{ position: 'absolute', left: 0, top: 0 }} />
    </>
  )
}

export const e20Varal: Desenho<ImgE20> = { largura: 600, altura: 320, fundo: C.elevado, exemplo, valido, desenhar }
