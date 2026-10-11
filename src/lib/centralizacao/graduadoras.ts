// Escada de notas por graduadora a partir da centralizacao medida. Diz em que
// degrau de cada tabela publicada a centralizacao cabe e quanto falta para o
// proximo. Nunca e nota: a centralizacao e so um dos criterios.

import { LIMITES_CENTRALIZACAO, GRADUADORAS, LIMITES_CONSULTA, lerProporcao } from '@/lib/servicos'
import { textoDoLaudo, type Medida } from './medida'

export type FaceNome = 'frente' | 'verso'

/** Lado maior do pior eixo (mesma conta e arredondamento do laudo) e soma das 2 bordas desse eixo, em mm. */
export type FaceMedida = { lado: number; somaMm: number }

export function faceDaMedida(m: Medida): FaceMedida {
  const lado = lerProporcao(textoDoLaudo(m)) ?? Math.max(m.lr.maior, m.tb.maior)
  const eixo = m.lr.maior >= m.tb.maior ? m.lr : m.tb
  return { lado, somaMm: eixo.a + eixo.b }
}

/** O "10 comum" de cada tabela (o Pristine fica acima dele). */
export const GEM: Record<string, string> = { PSA: 'GEM-MT 10', BGS: 'Gem Mint 9.5', CGC: 'Gem Mint 10', TAG: 'Gem Mint 10' }

/** Rotulo curto do degrau. */
export function curto(nota: string): string {
  if (/^pristine/i.test(nota)) return '10P'
  const n = nota.match(/(\d+(?:\.\d)?)\s*$/)?.[1] ?? nota
  return n.replace('.', ',')
}

/** Precisao da ferramenta (passo das setas). */
export const PRECISAO_MM = 0.1

export type EstadoDegrau = 'atingido' | 'teto' | 'proximo' | 'acima'
export interface Degrau { nota: string; curto: string; gem: boolean; frente: number; verso: number | null; estado: EstadoDegrau }
/** Quanto falta numa face: pp = pontos percentuais do lado maior; mm = deslocamento da impressao. */
export interface Folga { face: FaceNome; pp: number; mm: number; naMargem: boolean }
export interface Escada {
  graduadora: string
  quando: string
  obs?: string
  publica: boolean
  degraus: Degrau[]
  teto: number | null
  folga: Folga[]
  margem: Folga | null
  outraFace: { face: FaceNome; ate: number | null } | null
  degrausAteGem: number | null
  melhor: boolean
}

export function escadasDeCentralizacao(frente: Medida | null, verso: Medida | null) {
  const F = frente ? faceDaMedida(frente) : null
  const V = verso ? faceDaMedida(verso) : null
  const base: 'duas' | FaceNome | 'nenhuma' = F && V ? 'duas' : F ? 'frente' : V ? 'verso' : 'nenhuma'

  const escadas: Escada[] = GRADUADORAS.map(g => {
    const tab = LIMITES_CENTRALIZACAO[g.nome]
    if (!tab) return { graduadora: g.nome, quando: g.quando, publica: false, degraus: [], teto: null, folga: [], margem: null, outraFace: null, degrausAteGem: null, melhor: false }
    const lims = tab.limites.slice().reverse() // do mais baixo ao mais alto
    const cabe = (i: number) => {
      const l = lims[i]
      return (!F || F.lado <= l.frente) && (!V || l.verso == null || V.lado <= l.verso)
    }
    let teto: number | null = null
    if (base !== 'nenhuma') for (let i = lims.length - 1; i >= 0; i--) if (cabe(i)) { teto = i; break }

    const prox = teto == null ? 0 : teto + 1
    const degraus: Degrau[] = lims.map((l, i) => ({
      nota: l.nota, curto: curto(l.nota), gem: l.nota === GEM[g.nome], frente: l.frente, verso: l.verso,
      estado: teto != null && i < teto ? 'atingido' : i === teto ? 'teto' : i === prox && base !== 'nenhuma' ? 'proximo' : 'acima',
    }))

    const folgaDe = (face: FaceNome, m: FaceMedida, limite: number): Folga => {
      const pp = Math.round((m.lado - limite) * 10) / 10
      const mm = (Math.abs(pp) * m.somaMm) / 100
      return { face, pp, mm, naMargem: mm < PRECISAO_MM }
    }
    const folga: Folga[] = []
    if (prox < lims.length && base !== 'nenhuma') {
      const l = lims[prox]
      if (F && F.lado > l.frente) folga.push(folgaDe('frente', F, l.frente))
      if (V && l.verso != null && V.lado > l.verso) folga.push(folgaDe('verso', V, l.verso))
    }

    let margem: Folga | null = null
    if (teto != null) {
      const l = lims[teto]
      const cands: Folga[] = []
      if (F) cands.push(folgaDe('frente', F, l.frente))
      if (V && l.verso != null) cands.push(folgaDe('verso', V, l.verso))
      margem = cands.sort((a, b) => a.mm - b.mm)[0] ?? null
    }

    const outraFace = base === 'frente' || base === 'verso'
      ? { face: (base === 'frente' ? 'verso' : 'frente') as FaceNome, ate: teto == null ? null : base === 'frente' ? lims[teto].verso : lims[teto].frente }
      : null
    const gemIdx = lims.findIndex(l => l.nota === GEM[g.nome])
    const degrausAteGem = base === 'nenhuma' || gemIdx < 0 ? null : teto == null ? gemIdx + 1 : Math.max(0, gemIdx - teto)

    return { graduadora: g.nome, quando: g.quando, obs: tab.obs, publica: true, degraus, teto, folga, margem, outraFace, degrausAteGem, melhor: false }
  })

  // Destaque so quando separa alguem: menor distancia ate o Gem entre as que cabem.
  const comTeto = escadas.filter(e => e.publica && e.teto != null && e.degrausAteGem != null)
  const min = comTeto.length ? Math.min(...comTeto.map(e => e.degrausAteGem as number)) : null
  const melhores = min == null ? [] : comTeto.filter(e => e.degrausAteGem === min)
  const publicas = escadas.filter(e => e.publica)
  const todasNoGem = base !== 'nenhuma' && publicas.every(e => e.degrausAteGem === 0)
  const separa = melhores.length > 0 && melhores.length < publicas.length
  if (separa) for (const e of melhores) e.melhor = true

  return {
    base,
    escadas,
    melhores: separa ? melhores.map(e => e.graduadora) : [],
    todasNoGem,
    nenhumaCabe: base !== 'nenhuma' && comTeto.length === 0,
    consulta: LIMITES_CONSULTA,
  }
}

const pct = (n: number) => `${String(n).replace('.', ',')}/${String(Math.round((100 - n) * 10) / 10).replace('.', ',')}`
export const fmtLimite = pct
export const fmtPontos = (pp: number) => {
  const v = Math.abs(pp)
  const t = (Math.round(v * 10) / 10).toFixed(1).replace('.', ',')
  return `${t} ${v >= 2 ? 'pontos' : 'ponto'}`
}
export const fmtMmCurto = (mm: number) => `${mm.toFixed(2).replace('.', ',')} mm`
