// Álbum do Club, área de quem organiza e regra pública (21/11/2026, fatia 4 da Fase 1).
// A pessoa com o papel "colecao" (a Mika) entra com a conta normal da Bynx e só fala com
// quatro funções do banco: club_colecao_organizar (a edição, as cartas que ela pode
// conceder e os lotes dela), club_colecao_previa (o que acontece com cada nome colado, sem
// gravar), club_colecao_conceder e club_colecao_desfazer_lote. A regra pública lê uma
// quinta, club_colecao_regras_publica, que o visitante sem conta também chama e que nunca
// traz o rosto de uma carta. As regras de verdade ficam no banco; aqui só os tipos, os
// textos dos erros e as chamadas.

import { supabase } from '@/lib/supabaseClient'
import type { MissaoId } from '@/lib/pcc/album'
import type { EstadoLinha, FaseEdicao, LinhaPrevia, ResultadoLote } from '@/lib/pcc/albumAdmin'

/** Quantos @ ou e-mails cabem em um lote da organização (o Admin aceita 200). */
export const MAX_NOMES_ORG = 60

// ── Quem organiza ───────────────────────────────────────────────────────────

/** Carta de missão conferida pela organização: a única que ela pode conceder. Sem rosto. */
export type CartaManual = { numero: number; missao: MissaoId; como_ganhar: string; missao_titulo?: string | null }

export type LoteOrg = {
  lote: string
  quando: string
  numeros: number[] | null
  pessoas: number | null
  nota: string | null
  /** Quantas linhas do lote ainda valem: maior que zero = dá para desfazer. */
  ativas: number
}

export type EdicaoOrg = {
  slug: string
  edicao: number
  titulo: string
  status: 'rascunho' | 'publicada' | 'encerrada'
  fase: FaseEdicao
  abre_em: string | null
  fecha_em: string | null
  pedir_set_ate: string | null
  papel?: 'base' | 'capitulo' | 'especial'
  trilha?: 'creator' | 'bynx' | 'club' | null
}

/** Uma edição no seletor de quem organiza, com quantas cartas de missão conferida ela tem. */
export type EdicaoSeletorOrg = { slug: string; edicao: number; titulo: string; status: string; papel: 'base' | 'capitulo' | 'especial'; trilha: string | null; manuais: number }

export type PainelOrg = { edicao: EdicaoOrg; cartas: CartaManual[]; lotes: LoteOrg[]; edicoes: EdicaoSeletorOrg[] }

/** "proprio" é a própria pessoa colada na lista: ela nunca recebe de si mesma. */
export type EstadoLinhaOrg = EstadoLinha | 'proprio'
export type LinhaOrg = Omit<LinhaPrevia, 'estado'> & { estado: EstadoLinhaOrg }
export type PreviaOrg = { linhas: LinhaOrg[]; totais: Record<EstadoLinhaOrg, number> }
export type ResultadoOrg = ResultadoLote & { proprio_ignorado: boolean }
export type DesfeitoOrg = { revogadas: number; pessoas: number; bloqueadas_por_retirada: number }

export type RespostaOrg<T> = { ok: true; d: T } | { ok: false; msg: string }

/** Mensagens das funções do banco em texto para quem organiza. */
export function erroOrganizarAlbum(msg?: string | null): string {
  const m = msg || ''
  if (m.includes('sem_papel')) return 'Só quem organiza o álbum pode fazer isso.'
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('edicao_encerrada')) return 'A edição está encerrada: não dá mais para conceder cartas.'
  if (m.includes('edicao_nao_encontrada')) return 'A edição não foi encontrada.'
  if (m.includes('carta_nao_encontrada')) return 'Carta não encontrada.'
  if (m.includes('carta_automatica')) return 'Essa carta se ganha sozinha. Só as cartas de missão conferida pela organização podem ser concedidas.'
  if (m.includes('lote_grande_demais')) return `Cole no máximo ${MAX_NOMES_ORG} nomes por vez.`
  if (m.includes('lote_nao_encontrado')) return 'Esse lote não é seu ou não existe mais.'
  return 'Não conseguimos concluir. Tente de novo.'
}

async function chamar<T>(funcao: string, args: Record<string, unknown>): Promise<RespostaOrg<T>> {
  const { data, error } = await supabase.rpc(funcao, args)
  if (error) return { ok: false, msg: erroOrganizarAlbum(error.message) }
  return { ok: true, d: data as T }
}

/** Os papéis da conta logada (agenda, aniversariantes, avisos, colecao). Nunca lança: sem resposta, nenhum papel. */
export async function meusPapeis(): Promise<string[]> {
  const { data, error } = await supabase.rpc('club_meus_papeis')
  return !error && Array.isArray(data) ? (data as string[]) : []
}

/** A edição pedida (sem slug, a Base), as cartas que ela concede, os lotes dela e a lista de edições. Edição nula = ainda não existe nenhuma. */
export async function carregarPainelOrg(slug?: string | null): Promise<RespostaOrg<PainelOrg | null>> {
  const r = await chamar<{ edicao: EdicaoOrg | null; cartas?: CartaManual[]; lotes?: LoteOrg[]; edicoes?: EdicaoSeletorOrg[] } | null>('club_colecao_organizar_v2', { p_slug: slug || null })
  if (!r.ok) return r
  const d = r.d
  if (!d || !d.edicao) return { ok: true, d: null }
  return { ok: true, d: { edicao: d.edicao, cartas: d.cartas ?? [], lotes: d.lotes ?? [], edicoes: d.edicoes ?? [] } }
}

export const previaOrg = (slug: string, numero: number, ids: string[]) =>
  chamar<PreviaOrg>('club_colecao_previa', { p_slug: slug, p_numero: numero, p_ids: ids })

export const concederOrg = (slug: string, numero: number, ids: string[], nota: string) =>
  chamar<ResultadoOrg>('club_colecao_conceder', { p_slug: slug, p_numero: numero, p_ids: ids, p_nota: nota.trim() || null })

export const desfazerLoteOrg = (lote: string) => chamar<DesfeitoOrg>('club_colecao_desfazer_lote', { p_lote: lote })

// ── Regra pública ───────────────────────────────────────────────────────────

/** Uma carta na regra: só o número e o que é regra. A secreta vai só com o número. */
export type CartaRegra = { numero: number; secreta: boolean; missao?: MissaoId; modo?: 'auto' | 'manual'; como_ganhar?: string; missao_titulo?: string | null }

export type EdicaoRegra = {
  slug: string
  edicao: number
  titulo: string
  status: 'publicada' | 'encerrada'
  abre_em: string
  fecha_em: string
  pedir_set_ate: string
  tiragem_fisica: number | null
  total: number
  papel?: 'base' | 'capitulo' | 'especial'
  trilha?: 'creator' | 'bynx' | 'club' | null
}

/** Nula quando nenhuma edição abriu ainda. `capitulos` = as outras edições já abertas, além da do topo. */
export type RegrasAlbum = { edicao: EdicaoRegra; cartas: CartaRegra[]; capitulos: { edicao: EdicaoRegra; cartas: CartaRegra[] }[] } | null

/** Lê a edição já aberta (a mesma que o membro vê), sem sessão. */
export async function carregarRegras(): Promise<{ ok: true; d: RegrasAlbum } | { ok: false }> {
  const { data, error } = await supabase.rpc('club_colecao_regras_publica_v2', { p_slug: null })
  if (error) return { ok: false }
  const d = data as { edicao: EdicaoRegra | null; cartas?: CartaRegra[]; edicoes?: { edicao: EdicaoRegra; cartas: CartaRegra[] }[] } | null
  if (!d || !d.edicao) return { ok: true, d: null }
  const topo = d.edicao.slug
  return { ok: true, d: { edicao: d.edicao, cartas: d.cartas ?? [], capitulos: (d.edicoes ?? []).filter(e => e.edicao.slug !== topo) } }
}

/** 21/11/2026 às 09:00, no horário de Brasília. */
export function dataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const v = (t: string) => p.find(x => x.type === t)?.value || ''
  return `${v('day')}/${v('month')}/${v('year')} às ${v('hour')}:${v('minute')}`
}
