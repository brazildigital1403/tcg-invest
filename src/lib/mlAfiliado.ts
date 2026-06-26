import { getServiceSupabase } from '@/lib/supabaseServer'

export type MlAfiliadoLink = { url: string; titulo: string | null; subtitulo: string | null }

// Resolve um link de afiliado do Mercado Livre pela chave (set_id, 'acessorios', etc.),
// caindo no 'default' quando nao houver link especifico. Retorna null se nada ativo
// (e o modulo simplesmente nao renderiza). A prova de erro: nunca quebra a pagina.
export async function getMlAfiliadoLink(chave: string): Promise<MlAfiliadoLink | null> {
  try {
    const sb = getServiceSupabase()
    const chaves = chave === 'default' ? ['default'] : [chave, 'default']
    const { data } = await sb
      .from('ml_afiliado_links')
      .select('chave, url, titulo, subtitulo')
      .in('chave', chaves)
      .eq('ativo', true)

    if (!data || data.length === 0) return null
    const row = data.find((r) => r.chave === chave) || data.find((r) => r.chave === 'default')
    if (!row || !row.url) return null
    return { url: row.url, titulo: row.titulo ?? null, subtitulo: row.subtitulo ?? null }
  } catch {
    return null
  }
}
