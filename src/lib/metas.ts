/**
 * Metas de colecao (#368) -- tipos e acesso as RPCs.
 *
 * O motor mora no banco (migration 20260921120000_metas_colecao_motor):
 * `criar_meta` valida o alvo e cria; `meta_cartas` devolve as cartas da meta
 * com "tenho" e valor, e grava o retrato (total/tenho/valores) na linha da
 * meta. A lista de metas le esse retrato direto da tabela, sem recalcular.
 *
 * Liberado em TODOS os planos (decisao do Du, 21/09/2026): as Metas fazem o
 * colecionador adicionar carta e bater no limite de cartas, que e a parede.
 */
import { supabase } from '@/lib/supabaseClient'

/**
 * Flag de lancamento. Desligada = nenhuma entrada no menu nem na colecao; as
 * paginas /metas existem (noindex) para teste pela URL direta. Ligar e decisao
 * do Du, por causa da remedicao da Pokedex em 21/10 (#369): as Metas tambem
 * sobem a adicao de cartas no Gratis e as duas leituras se misturariam.
 */
export const METAS_ATIVO = process.env.NEXT_PUBLIC_METAS_ATIVO === '1'

export type MetaTipo = 'pokemon' | 'set'
export type MetaRegiao = 'ocidental' | 'jp' | 'cn'

export type Meta = {
  id: string
  tipo: MetaTipo
  alvo: string
  regiao: MetaRegiao | null
  idioma: string | null
  total: number | null
  tenho: number | null
  valor_total: number | null
  valor_tenho: number | null
  calculado_em: string | null
  concluida_em: string | null
  created_at: string
}

export type CartaDaMeta = {
  card_id: string
  nome: string
  numero: string | null
  set_id: string | null
  set_name: string | null
  lancamento: string | null
  image_small: string | null
  raridade: string | null
  regiao: string | null
  valor: number
  tenho: boolean
  idiomas_tenho: string[] | null
}

export const IDIOMAS_META: { key: string | null; label: string }[] = [
  { key: null, label: 'Tanto faz' },
  { key: 'pt', label: 'Português' },
  { key: 'en', label: 'Inglês' },
  { key: 'jp', label: 'Japonês' },
]

export function rotuloIdioma(idioma: string | null): string | null {
  return IDIOMAS_META.find(i => i.key === idioma && i.key !== null)?.label ?? null
}

export function tituloMeta(m: Pick<Meta, 'tipo' | 'alvo'>, nomeSet?: string | null): string {
  return m.tipo === 'pokemon' ? `Todos os ${m.alvo}` : (nomeSet || m.alvo)
}

export async function listarMetas(): Promise<Meta[]> {
  const { data, error } = await supabase
    .from('metas_colecao')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Meta[]
}

/** Traduz o erro das RPCs de meta em texto de tela. */
export function mensagemErroMeta(erro: { message?: string } | null | undefined): string {
  const m = erro?.message || ''
  if (m.startsWith('META_LIMITE')) return 'Você já tem 50 metas. Apague uma para criar outra.'
  if (m.startsWith('META_ALVO_INVALIDO')) return 'Não encontramos esse alvo no catálogo.'
  if (m.startsWith('META_NAO_AUTENTICADO')) return 'Entre na sua conta para criar metas.'
  return 'Não foi possível criar a meta agora. Tente de novo.'
}

export async function criarMeta(tipo: MetaTipo, alvo: string, idioma: string | null, regiao: MetaRegiao | null = 'ocidental'): Promise<string> {
  const { data, error } = await supabase.rpc('criar_meta', {
    p_tipo: tipo, p_alvo: alvo, p_regiao: regiao, p_idioma: idioma,
  })
  if (error) throw error
  return data as string
}

export async function carregarMeta(id: string): Promise<{ meta: Meta; cartas: CartaDaMeta[] } | null> {
  const { data, error } = await supabase.rpc('meta_cartas', { p_meta_id: id })
  if (error) throw error
  if (!data || (data as any).erro) return null
  const d = data as any
  return {
    meta: d.meta as Meta,
    cartas: (d.cartas || []).map((c: any) => ({ ...c, valor: Number(c.valor) || 0 })) as CartaDaMeta[],
  }
}

export const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1000 ? 0 : 2 }).format(v || 0)

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
