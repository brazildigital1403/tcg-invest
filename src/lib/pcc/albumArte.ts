// Envio da arte das cartas do Album do Club (21/11/2026). SO SERVIDOR (usa crypto e a chave
// de servico). A arte vai para o bucket club-colecao, de leitura publica: o que a mantem
// secreta e o caminho imprevisivel (<slug>/<32 hex>.<ext>), que o banco tambem exige por CHECK,
// e a RPC do membro so devolver o caminho de carta ganha ou liberada como previa.
// O tipo da imagem vem do CONTEUDO (os primeiros bytes), nao do que o navegador disse.

import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mesmo nome de BUCKET_ALBUM em album.ts (que importa o cliente do navegador e nao pode vir para ca).
const BUCKET = 'club-colecao'

/** 4 MB: o bucket aceita 5, mas a Vercel corta o corpo da requisicao em 4,5 MB. */
export const MAX_ARTE = 4 * 1024 * 1024

export type TipoImagem = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'png' | 'jpg' | 'webp' }

/** PNG, JPEG ou WebP pelos primeiros bytes. Qualquer outra coisa (SVG, GIF, HTML) e recusada. */
export function tipoDaImagem(b: Uint8Array): TipoImagem | null {
  const igual = (inicio: number, bytes: number[]) => bytes.every((x, i) => b[inicio + i] === x)
  if (b.length >= 8 && igual(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' }
  if (b.length >= 3 && igual(0, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 12 && igual(0, [0x52, 0x49, 0x46, 0x46]) && igual(8, [0x57, 0x45, 0x42, 0x50])) return { mime: 'image/webp', ext: 'webp' }
  return null
}

export type ResultadoArte =
  | { ok: true; carta: unknown; campos: string[] }
  | { ok: false; status: number; erro: string }

/**
 * Sobe a arte nova, grava o caminho na carta (club_carta_salvar_interno) e apaga a anterior.
 * Se o banco recusar, a arte recem-enviada sai do bucket: nunca sobra arquivo sem dono.
 */
export async function subirArte(sb: SupabaseClient, p: { colecaoId: string; numero: number; bytes: Uint8Array }): Promise<ResultadoArte> {
  if (p.bytes.byteLength === 0 || p.bytes.byteLength > MAX_ARTE) return { ok: false, status: 400, erro: 'arte_tamanho' }
  const tipo = tipoDaImagem(p.bytes)
  if (!tipo) return { ok: false, status: 400, erro: 'arte_tipo' }

  const { data: edicao } = await sb.from('club_colecoes').select('slug').eq('id', p.colecaoId).maybeSingle()
  if (!edicao) return { ok: false, status: 404, erro: 'edicao_nao_encontrada' }

  const path = `${edicao.slug}/${randomBytes(16).toString('hex')}.${tipo.ext}`
  const envio = await sb.storage.from(BUCKET).upload(path, p.bytes, { contentType: tipo.mime, cacheControl: '31536000', upsert: false })
  if (envio.error) return { ok: false, status: 500, erro: 'arte_envio' }

  const { data, error } = await sb.rpc('club_carta_salvar_interno', { p_colecao: p.colecaoId, p_numero: p.numero, p: { arte_path: path }, p_autor: null })
  if (error) {
    await sb.storage.from(BUCKET).remove([path])
    return { ok: false, status: 400, erro: error.message }
  }
  const r = data as { carta: unknown; campos: string[]; arte_anterior: string | null }
  if (r.arte_anterior) await sb.storage.from(BUCKET).remove([r.arte_anterior])
  return { ok: true, carta: r.carta, campos: r.campos }
}
