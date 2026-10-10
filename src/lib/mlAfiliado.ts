import { unstable_cache } from 'next/cache'
import { getServiceSupabase } from '@/lib/supabaseServer'

// ★ CACHE (14/09/2026). Estas duas funcoes rodam em TODA pagina de carta, set e
// hub de Pokemon sem cache -- 3 idas ao Supabase por render, pra um conteudo que
// muda pouco. Numa rajada de robo logo depois de um deploy (que zera o ISR das
// paginas) eram as idas mais numerosas nos logs. O Data Cache sobrevive a deploy.
//
// ★ TAG POR CHAVE (regua F1). Desde o /admin/promocoes o app GRAVA
// ml_afiliado_*. Cada entrada do cache leva a tag `ml-afiliado:<chave>` de cada
// chave consultada, e a API do admin chama revalidateTag so das chaves mexidas.
//
// ATENCAO: a tag tambem marca as PAGINAS ISR que leram o dado. Revalidar
// `ml-afiliado:acessorios` invalida todas as paginas de carta e
// `ml-afiliado:default` todos os sets e hubs -- a mesma rajada que motivou este
// cache. Por isso a API NAO revalida essas duas (CHAVES_SEM_REVALIDAR): nelas a
// edicao aparece em ate 1h, como antes. A vitrine `email` nao e lida por pagina
// nenhuma, revalida na hora sem risco.
//
// O revalidate (3600) e os keyParts NAO mudaram, e o corpo da funcao interna e
// o mesmo. A chave do unstable_cache inclui o texto COMPILADO da funcao: se o
// build gerar texto diferente, o custo e um cache frio unico (uma consulta
// pequena por combinacao de chaves, tabela de dezenas de linhas).
//
// Regra da casa: dentro de unstable_cache a falha LANCA -- vazio viraria entrada
// valida e ficaria servido ate o revalidate. Quem converte erro em null/[] e a
// funcao exportada, fora do cache.

export function tagMlAfiliado(chave: string): string {
  return `ml-afiliado:${chave}`
}

/** Chaves cuja tag invalidaria milhares de paginas ISR (ver acima). */
export const CHAVES_SEM_REVALIDAR: ReadonlySet<string> = new Set(['default', 'acessorios'])

export type MlAfiliadoLink = { url: string; titulo: string | null; subtitulo: string | null }

// O unstable_cache e montado por chamada porque as tags dependem das chaves.
const linksAtivos = (chaves: string[]) => unstable_cache(
  async (chaves: string[]) => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[mlAfiliado] sem cliente Supabase')
    const { data, error } = await sb
      .from('ml_afiliado_links')
      .select('chave, url, titulo, subtitulo')
      .in('chave', chaves)
      .eq('ativo', true)
    if (error) throw new Error(`[mlAfiliado] links: ${error.message}`)
    return data || []
  },
  ['ml-afiliado-links-v1'],
  { revalidate: 3600, tags: chaves.map(tagMlAfiliado) },
)(chaves)

// Resolve um link de afiliado do Mercado Livre pela chave (set_id, 'acessorios', etc.),
// caindo no 'default' quando nao houver link especifico. Retorna null se nada ativo
// (e o modulo simplesmente nao renderiza). A prova de erro: nunca quebra a pagina.
export async function getMlAfiliadoLink(chave: string): Promise<MlAfiliadoLink | null> {
  try {
    const chaves = chave === 'default' ? ['default'] : [chave, 'default']
    const data = await linksAtivos(chaves)
    if (data.length === 0) return null
    const row = data.find((r) => r.chave === chave) || data.find((r) => r.chave === 'default')
    if (!row || !row.url) return null
    return { url: row.url, titulo: row.titulo ?? null, subtitulo: row.subtitulo ?? null }
  } catch {
    return null
  }
}

export type MlAfiliadoProduto = { titulo: string; preco: string; imagem: string; url: string }

// Uma ida so ao banco (antes eram duas: a chave e depois o 'default'): busca as
// duas chaves juntas e escolhe em memoria.
const produtosAtivos = (chaves: string[]) => unstable_cache(
  async (chaves: string[]) => {
    const sb = getServiceSupabase()
    if (!sb) throw new Error('[mlAfiliado] sem cliente Supabase')
    const { data, error } = await sb
      .from('ml_afiliado_produtos')
      .select('chave, titulo, preco, imagem_url, url')
      .in('chave', chaves)
      .eq('ativo', true)
      .order('ordem', { ascending: true })
    if (error) throw new Error(`[mlAfiliado] produtos: ${error.message}`)
    return data || []
  },
  ['ml-afiliado-produtos-v1'],
  { revalidate: 3600, tags: chaves.map(tagMlAfiliado) },
)(chaves)

// Lista de produtos de afiliado por chave (set_id, 'acessorios', etc.), caindo no
// 'default' quando a chave nao tiver produtos proprios. Ordenado por 'ordem'.
// A prova de erro: retorna [] em qualquer falha (a galeria cai no CTA simples).
export async function getMlAfiliadoProdutos(chave: string): Promise<MlAfiliadoProduto[]> {
  try {
    const chaves = chave === 'default' ? ['default'] : [chave, 'default']
    const data = await produtosAtivos(chaves)
    const daChave = data.filter((r) => r.chave === chave)
    const rows = daChave.length > 0 ? daChave : data.filter((r) => r.chave === 'default')
    return rows.map((r) => ({ titulo: r.titulo, preco: r.preco, imagem: r.imagem_url, url: r.url }))
  } catch {
    return []
  }
}
