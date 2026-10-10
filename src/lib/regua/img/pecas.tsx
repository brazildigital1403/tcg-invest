import type { CSSProperties, ReactNode } from 'react'

/**
 * Pecas de desenho reaproveitadas entre os tipos (carta com brilho, bolso de
 * fichario, etiqueta). Tudo em coordenadas de 1x.
 */

/**
 * Tamanho de fonte que cabe na largura. Estimativa pela largura media do
 * glifo da DM Sans em peso alto (~0,58em; caixa alta ~0,68em). Nunca sobe
 * acima de `max` e nunca desce abaixo de `min`.
 */
export function caber(texto: string, max: number, largura: number, min = 14, fator = 0.58): number {
  const maiusculas = texto.replace(/[^A-Z0-9#$]/g, '').length
  const f = fator + (maiusculas / Math.max(texto.length, 1)) * 0.1
  const t = largura / Math.max(texto.length * f, 1)
  return Math.max(min, Math.min(max, Math.floor(t)))
}

/** Carta (imagem ja preparada) com raio, sombra e o brilho diagonal dos mockups. */
export function Carta(props: {
  src: string
  w: number
  h: number
  raio?: number
  sombra?: string
  brilho?: string | null
  style?: CSSProperties
  children?: ReactNode
}) {
  const { src, w, h, raio = 6, sombra, brilho, style, children } = props
  const reflexo = brilho === undefined
    ? 'linear-gradient(125deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 40%)'
    : brilho
  return (
    <div style={{ position: 'absolute', width: w, height: h, display: 'flex', borderRadius: raio, boxShadow: sombra, ...style }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={src} width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: raio }} />
      {reflexo ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: raio, backgroundImage: reflexo, display: 'flex' }} />
      ) : null}
      {children}
    </div>
  )
}

/** Faisca dos mockups (ponto branco com halo ambar e cruz de luz), em (x, y) com tamanho f. */
export function Faisca(props: { x: number; y: number; f?: number }) {
  const f = props.f ?? 20
  const l = f * 1.6
  const raio = 'linear-gradient(90deg, rgba(240,240,240,0), #f0f0f0, rgba(240,240,240,0))'
  return (
    <div style={{ position: 'absolute', left: props.x, top: props.y, width: f, height: f, display: 'flex' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: f, height: f, display: 'flex', borderRadius: f / 2, backgroundImage: 'radial-gradient(circle at center, #f0f0f0 0px, #f0f0f0 1.5px, rgba(245,158,11,0.95) 2.5px, rgba(245,158,11,0) 70%)' }} />
      <div style={{ position: 'absolute', left: f / 2 - l / 2, top: f / 2 - 0.75, width: l, height: 1.5, display: 'flex', backgroundImage: raio }} />
      <div style={{ position: 'absolute', left: f / 2 - l / 2, top: f / 2 - 0.75, width: l, height: 1.5, display: 'flex', backgroundImage: raio, transform: 'rotate(90deg)' }} />
    </div>
  )
}

/**
 * Texto em uma linha so. Com `max`, corta com reticencias ao passar dessa
 * largura (rede de seguranca para nome comprido que nem o `caber` resolve).
 */
export function T(props: { children: ReactNode; style?: CSSProperties; max?: number }) {
  const corte: CSSProperties = props.max
    ? { display: 'block', maxWidth: props.max, overflow: 'hidden', textOverflow: 'ellipsis' }
    : { display: 'flex' }
  return <div style={{ whiteSpace: 'nowrap', ...corte, ...props.style }}>{props.children}</div>
}
