// Conta da centralizacao: das 8 linhas (em mm, no referencial da carta
// endireitada) para mm por lado e proporcao por eixo. Aritmetica pura: roda a
// cada movimento do dedo sem custo.

import { CARTA_MM, type Lado } from './visao'

export type Lados = Record<Lado, number>
/** ext = borda do papel; int = fim da moldura. Tudo em mm, 0..63 x 0..88. */
export type Linhas = { ext: Lados; int: Lados }
export type ChaveLinha = `${'ext' | 'int'}.${Lado}`

export const ORDEM_LINHAS: ChaveLinha[] = ['ext.esq', 'ext.dir', 'ext.topo', 'ext.base', 'int.esq', 'int.dir', 'int.topo', 'int.base']

export const NOME_LINHA: Record<ChaveLinha, string> = {
  'ext.esq': 'Borda esquerda', 'ext.dir': 'Borda direita', 'ext.topo': 'Borda de cima', 'ext.base': 'Borda de baixo',
  'int.esq': 'Moldura esquerda', 'int.dir': 'Moldura direita', 'int.topo': 'Moldura de cima', 'int.base': 'Moldura de baixo',
}

export const ehVertical = (k: ChaveLinha) => k.endsWith('esq') || k.endsWith('dir')

export function lerLinha(l: Linhas, k: ChaveLinha): number {
  const [grupo, lado] = k.split('.') as ['ext' | 'int', Lado]
  return l[grupo][lado]
}

/** Move uma linha sem deixar a moldura cruzar a borda (folga de 0,2 mm). */
export function moverLinha(l: Linhas, k: ChaveLinha, valor: number): Linhas {
  const [grupo, lado] = k.split('.') as ['ext' | 'int', Lado]
  const lim = ehVertical(k) ? CARTA_MM.w : CARTA_MM.h
  const F = 0.2
  let v = valor
  if (grupo === 'ext') {
    if (lado === 'esq' || lado === 'topo') v = Math.min(v, l.int[lado] - F)
    else v = Math.max(v, l.int[lado] + F)
    v = Math.max(-5, Math.min(lim + 5, v))
  } else {
    const centro = lim / 2
    if (lado === 'esq' || lado === 'topo') v = Math.max(l.ext[lado] + F, Math.min(centro, v))
    else v = Math.min(l.ext[lado] - F, Math.max(centro, v))
  }
  return { ...l, [grupo]: { ...l[grupo], [lado]: Math.round(v * 1000) / 1000 } }
}

/** Moldura padrao (3 mm) quando nao ha deteccao. */
export function linhasPadrao(moldura?: Partial<Record<Lado, number | null>>): Linhas {
  const m = (lado: Lado) => moldura?.[lado] ?? 3
  return {
    ext: { esq: 0, dir: CARTA_MM.w, topo: 0, base: CARTA_MM.h },
    int: { esq: m('esq'), dir: CARTA_MM.w - m('dir'), topo: m('topo'), base: CARTA_MM.h - m('base') },
  }
}

export type Eixo = { a: number; b: number; maior: number; texto: string }
export type Medida = { mm: Lados; lr: Eixo; tb: Eixo }

const umaCasa = (n: number) => {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',')
}

/**
 * Proporcao com UMA casa decimal. Arredondar para inteiro esconde o caso de
 * 54,5/45,5, que fica exatamente no limite de 55/45 da PSA para o 10.
 */
function eixo(a: number, b: number): Eixo {
  const pa = (100 * a) / (a + b)
  const maior = Math.round(Math.max(pa, 100 - pa) * 10) / 10
  return { a, b, maior, texto: `${umaCasa(maior)}/${umaCasa(100 - maior)}` }
}

/**
 * mm reais por lado. As linhas externas reescalam para 63 x 88: se a borda do
 * papel ficou a 62,4 mm de largura na foto, o que esta dentro estica junto.
 */
export function medir(l: Linhas): Medida {
  const sx = CARTA_MM.w / (l.ext.dir - l.ext.esq), sy = CARTA_MM.h / (l.ext.base - l.ext.topo)
  const mm: Lados = {
    esq: (l.int.esq - l.ext.esq) * sx,
    dir: (l.ext.dir - l.int.dir) * sx,
    topo: (l.int.topo - l.ext.topo) * sy,
    base: (l.ext.base - l.int.base) * sy,
  }
  return { mm, lr: eixo(mm.esq, mm.dir), tb: eixo(mm.topo, mm.base) }
}

export const fmtMm = (n: number) => `${n.toFixed(2).replace('.', ',')} mm`

/**
 * Texto que vai para o laudo. O pior eixo e o que vale para a graduadora, e o
 * `lerProporcao` de servicos.ts ja pega o pior quando vem mais de um par.
 */
export function textoDoLaudo(m: Medida): string {
  return `${m.lr.texto} (laterais) e ${m.tb.texto} (topo e base)`
}

/** Pior lado maior entre os dois eixos (55,2 para 55,2/44,8). */
export const piorEixo = (m: Medida) => Math.max(m.lr.maior, m.tb.maior)

// ── Regua 1 a 10 ─────────────────────────────────────────────────────────────
// Molduras concentricas a cada 0,5 mm a partir da borda do papel, como as
// reguas fisicas de centralizacao. Linha n = n x 0,5 mm.

export const REGUA_PASSO_MM = 0.5
export const REGUA_LINHAS = 10

/** Em que linha da regua cada lado cai (0,5 mm por linha, arredondado). */
export function leituraRegua(m: Medida): Lados {
  const r = (v: number) => Math.round(v / REGUA_PASSO_MM)
  return { esq: r(m.mm.esq), dir: r(m.mm.dir), topo: r(m.mm.topo), base: r(m.mm.base) }
}
