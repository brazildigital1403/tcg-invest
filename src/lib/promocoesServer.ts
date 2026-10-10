// Apoio das rotas /api/admin/promocoes. SOMENTE servidor (service key).
//
// Gravacao das tabelas ml_afiliado_produtos / ml_afiliado_links passa so por
// aqui, depois do requireAdmin. A validacao mora em src/lib/promocoes.ts, a
// mesma que a tela usa para dar o erro na hora.

import { revalidateTag } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { CHAVES_SEM_REVALIDAR, tagMlAfiliado } from '@/lib/mlAfiliado'
import { normalizarPreco, normalizarTitulo, validarImagemUrl, validarLink } from '@/lib/promocoes'

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export const COLUNAS_PRODUTO =
  'id, ml_id, chave, titulo, preco, imagem_url, url, ordem, ativo, last_seen_at, updated_at, link_manual, produto_codigo'

/**
 * Revalida o cache de 1h do mlAfiliado SO das chaves que nao arrastam paginas
 * ISR junto (ver o topo de src/lib/mlAfiliado.ts). Devolve o que foi adiado
 * para a tela avisar "aparece em ate 1h".
 *
 * `{ expire: 0 }`: no Next 16 o segundo argumento e obrigatorio; expire 0
 * expira na hora (o perfil 'max' ainda serviria o valor velho uma vez).
 */
export function revalidarChaves(chaves: Iterable<string>): { revalidadas: string[]; adiadas: string[] } {
  const revalidadas: string[] = []
  const adiadas: string[] = []
  for (const chave of new Set(chaves)) {
    if (CHAVES_SEM_REVALIDAR.has(chave)) {
      adiadas.push(chave)
      continue
    }
    try {
      revalidateTag(tagMlAfiliado(chave), { expire: 0 })
      revalidadas.push(chave)
    } catch (e) {
      console.warn(`[admin/promocoes] revalidateTag(${chave}) falhou: ${(e as Error)?.message}`)
      adiadas.push(chave)
    }
  }
  return { revalidadas, adiadas }
}

export type CamposProduto = { url: string; imagem_url: string; titulo: string; preco: string }

/** Valida os 4 campos de conteudo. `parcial` aceita ausencia (PATCH). */
export function validarCampos(
  body: Record<string, unknown>,
  parcial = false,
): { ok: true; campos: Partial<CamposProduto> } | { ok: false; erro: string } {
  const campos: Partial<CamposProduto> = {}

  if (!parcial || body.url !== undefined) {
    const r = validarLink(String(body.url ?? ''))
    if (!r.ok) return { ok: false, erro: r.erro }
    campos.url = r.url
  }
  if (!parcial || body.imagem_url !== undefined) {
    const r = validarImagemUrl(String(body.imagem_url ?? ''))
    if (!r.ok) return { ok: false, erro: r.erro }
    campos.imagem_url = r.url
  }
  if (!parcial || body.titulo !== undefined) {
    const r = normalizarTitulo(String(body.titulo ?? ''))
    if (!r.ok) return { ok: false, erro: r.erro }
    campos.titulo = r.valor
  }
  if (!parcial || body.preco !== undefined) {
    const r = normalizarPreco(String(body.preco ?? ''))
    if (!r.ok) return { ok: false, erro: r.erro }
    campos.preco = r.valor
  }
  return { ok: true, campos }
}

/** Proxima ordem da vitrine: max(ordem) + 1, ou 0 se vazia. */
export async function proximaOrdem(sb: ReturnType<typeof supabaseAdmin>, chave: string): Promise<number> {
  const { data, error } = await sb
    .from('ml_afiliado_produtos')
    .select('ordem')
    .eq('chave', chave)
    .order('ordem', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const max = data?.[0]?.ordem
  return typeof max === 'number' ? max + 1 : 0
}

/** A mesma URL ja esta na vitrine? (ignora a propria linha ao editar) */
export async function urlJaNaVitrine(
  sb: ReturnType<typeof supabaseAdmin>, chave: string, url: string, ignorarId?: number,
): Promise<boolean> {
  let q = sb.from('ml_afiliado_produtos').select('id').eq('chave', chave).eq('url', url).limit(1)
  if (ignorarId !== undefined) q = q.neq('id', ignorarId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}
