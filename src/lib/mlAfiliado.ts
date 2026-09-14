import { unstable_cache } from 'next/cache'
import { getServiceSupabase } from '@/lib/supabaseServer'

// ★ CACHE (14/09/2026). Estas duas funcoes rodam em TODA pagina de carta, set e
// hub de Pokemon sem cache -- 3 idas ao Supabase por render, pra um conteudo que
// so muda quando o Du edita a tabela direto no Supabase. Numa rajada de robo
// logo depois de um deploy (que zera o ISR das paginas) eram as idas mais
// numerosas nos logs. O Data Cache sobrevive a deploy.
//
// Nenhum codigo do app grava ml_afiliado_*: edicao feita na tabela aparece em
// ate 1h. Pra ver na hora, trocar a versao das chaves abaixo.
//
// Regra da casa: dentro de unstable_cache a falha LANCA -- vazio viraria entrada
// valida e ficaria servido ate o revalidate. Quem converte erro em null/[] e a
// funcao exportada, fora do cache.

export type MlAfiliadoLink = { url: string; titulo: string | null; subtitulo: string | null }

const linksAtivos = unstable_cache(
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
  { revalidate: 3600 },
)

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
const produtosAtivos = unstable_cache(
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
  { revalidate: 3600 },
)

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
