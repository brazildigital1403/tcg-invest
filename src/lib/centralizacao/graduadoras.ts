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

/** Numero da nota do degrau ("MINT 9" -> 9, "Gem Mint 9.5" -> 9,5, "Pristine 10" -> 10). */
export function notaNumero(nota: string): number | null {
  const m = nota.match(/(\d+(?:\.\d)?)\s*$/)
  return m ? Number(m[1]) : null
}

/**
 * Aviso quando a faixa provavel escrita passa do que a centralizacao permite na
 * graduadora escolhida. Nao trava nada: a faixa e do admin.
 */
export function avisoFaixa(e: Escada | undefined, faixaMax: number | null): string | null {
  if (!e || !e.publica || faixaMax == null) return null
  if (e.teto == null) return `Pela centralização, a carta fica abaixo da tabela da ${e.graduadora}. Confira se a faixa considera isso.`
  const nota = e.degraus[e.teto].nota
  const n = notaNumero(nota)
  if (n == null || faixaMax <= n) return null
  return `Pela centralização, a carta cabe até ${nota} na ${e.graduadora}, e a faixa vai até ${String(faixaMax).replace('.', ',')}. Confira se a faixa considera isso.`
}

/**
 * Frases da escada de UMA graduadora para o relatorio do cliente (o admin usa
 * as do EscadasGraduadoras, que tem instrucao de bancada). Sem nota: so onde a
 * centralizacao cabe e quanto falta.
 */
export function frasesCliente(e: Escada, base: 'duas' | FaceNome): { principal: string; extras: string[]; limite: string | null } {
  const g = e.graduadora
  if (!e.publica) {
    return { principal: `A ${g} não publica limite de centralização em proporção e avalia esse critério de forma qualitativa. As medidas acima valem como referência para o envio.`, extras: [], limite: null }
  }
  const teto = e.teto != null ? e.degraus[e.teto] : null
  const prox = e.teto == null ? e.degraus[0] : e.degraus[e.teto + 1]
  const extras: string[] = []
  let principal: string
  if (teto) {
    principal = prox ? `Na ${g}, a centralização cabe em ${teto.nota}.` : `Na ${g}, a centralização cabe em ${teto.nota}, o degrau mais alto da tabela.`
  } else {
    const baixo = e.degraus[0]
    principal = `A centralização fica abaixo da tabela publicada pela ${g}. O degrau mais baixo, ${baixo.nota}, vai até ${fmtLimite(baixo.frente)} na frente.`
  }
  if (prox && e.folga.length) {
    const partes = e.folga.map(f => `${fmtPontos(f.pp)} ${f.face === 'verso' ? 'no verso' : 'na frente'}`)
    const mm = e.folga.length === 1 ? ` (${fmtMmCurto(e.folga[0].mm)})` : ''
    const margem = e.folga.every(f => f.naMargem) ? ', menos que a precisão da medição' : ''
    principal += ` Para ${prox.nota}, faltam ${partes.join(' e ')}${mm}${margem}.`
  }
  if (e.margem?.naMargem && teto) extras.push('Está no limite da faixa: uma diferença de 0,1 mm muda o resultado.')
  if ((base === 'frente' || base === 'verso') && e.outraFace) {
    const outra = e.outraFace.face
    extras.push(`Só ${base === 'frente' ? 'a frente foi medida' : 'o verso foi medido'}. ${outra === 'verso' ? 'O verso' : 'A frente'} pode baixar a faixa.${e.outraFace.ate != null ? ` Para manter, ${outra === 'verso' ? 'o verso' : 'a frente'} precisa ficar até ${fmtLimite(e.outraFace.ate)}.` : ''}`)
  }
  const limite = teto ? `Limite de ${teto.nota}: frente até ${fmtLimite(teto.frente)}${teto.verso != null ? `, verso até ${fmtLimite(teto.verso)}` : ''}.` : null
  return { principal, extras, limite }
}
