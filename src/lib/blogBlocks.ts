/**
 * Tipos e validacao dos blocos de conteudo do blog (`blog_posts.content`, jsonb).
 *
 * Cada bloco tem um `id` estavel (gerado no editor) pra servir de key em listas
 * React sem depender do indice do array. A validacao roda sempre no servidor
 * (rotas /api/admin/blog/*) antes de gravar — nunca confiar em HTML/URL vindos
 * do client, mesmo sendo o proprio Du digitando.
 */

export type BlogBlock =
  | { id: string; type: 'heading'; level: 2 | 3; text: string }
  | { id: string; type: 'paragraph'; html: string }
  | { id: string; type: 'image'; url: string; alt: string; caption?: string }
  | { id: string; type: 'youtube'; videoId: string; caption?: string }
  | { id: string; type: 'instagram'; url: string }
  | { id: string; type: 'tiktok'; url: string }
  | {
      id: string
      type: 'product'
      mode: 'card' | 'affiliate'
      cardId?: string
      cardSlug?: string
      title?: string
      imageUrl?: string
      url?: string
      priceLabel?: string
    }
  | { id: string; type: 'quote'; text: string; attribution?: string }

const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'youtube', 'instagram', 'tiktok', 'product', 'quote'] as const

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/
const INSTAGRAM_HOST_RE = /(^|\.)instagram\.com$/
const TIKTOK_HOST_RE = /(^|\.)tiktok\.com$/

function isValidHost(url: string, hostRe: RegExp): boolean {
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && hostRe.test(u.hostname)
  } catch {
    return false
  }
}

// Sanitizacao minima do HTML gerado pelo Tiptap — remove <script>, <style> e
// atributos on* (onclick etc). Nao e um sanitizador HTML completo (nao ha
// como injetar tag arbitraria vinda do editor, so as tags que o StarterKit
// gera), mas cobre o vetor obvio caso o payload seja forjado direto na API.
function sanitizeParagraphHtml(html: string): string {
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

export class BlogBlockValidationError extends Error {}

/**
 * Valida e normaliza um array de blocos vindo da API admin. Lanca
 * BlogBlockValidationError com mensagem em PT-BR se algo estiver fora do
 * formato — a rota admin so precisa dar 400 com `error.message`.
 */
export function validateBlocks(input: unknown): BlogBlock[] {
  if (!Array.isArray(input)) {
    throw new BlogBlockValidationError('conteudo do post precisa ser uma lista de blocos')
  }

  return input.map((raw, i) => {
    if (!raw || typeof raw !== 'object') {
      throw new BlogBlockValidationError(`bloco ${i + 1}: formato invalido`)
    }
    const b = raw as Record<string, unknown>
    const id = typeof b.id === 'string' && b.id ? b.id : `blk_${i}`
    const type = b.type

    if (typeof type !== 'string' || !(BLOCK_TYPES as readonly string[]).includes(type)) {
      throw new BlogBlockValidationError(`bloco ${i + 1}: tipo "${String(type)}" desconhecido`)
    }

    switch (type) {
      case 'heading': {
        const level = b.level === 3 ? 3 : 2
        const text = typeof b.text === 'string' ? b.text.trim() : ''
        if (!text) throw new BlogBlockValidationError(`bloco ${i + 1} (titulo): texto vazio`)
        return { id, type: 'heading', level, text } as BlogBlock
      }
      case 'paragraph': {
        const html = typeof b.html === 'string' ? sanitizeParagraphHtml(b.html) : ''
        if (!html.trim()) throw new BlogBlockValidationError(`bloco ${i + 1} (paragrafo): vazio`)
        return { id, type: 'paragraph', html } as BlogBlock
      }
      case 'image': {
        const url = typeof b.url === 'string' ? b.url.trim() : ''
        if (!url) throw new BlogBlockValidationError(`bloco ${i + 1} (imagem): sem URL`)
        const alt = typeof b.alt === 'string' ? b.alt.trim() : ''
        const caption = typeof b.caption === 'string' ? b.caption.trim() : undefined
        return { id, type: 'image', url, alt, caption } as BlogBlock
      }
      case 'youtube': {
        const videoId = typeof b.videoId === 'string' ? b.videoId.trim() : ''
        if (!YOUTUBE_ID_RE.test(videoId)) {
          throw new BlogBlockValidationError(`bloco ${i + 1} (youtube): ID de video invalido`)
        }
        const caption = typeof b.caption === 'string' ? b.caption.trim() : undefined
        return { id, type: 'youtube', videoId, caption } as BlogBlock
      }
      case 'instagram': {
        const url = typeof b.url === 'string' ? b.url.trim() : ''
        if (!isValidHost(url, INSTAGRAM_HOST_RE)) {
          throw new BlogBlockValidationError(`bloco ${i + 1} (instagram): URL precisa ser do instagram.com`)
        }
        return { id, type: 'instagram', url } as BlogBlock
      }
      case 'tiktok': {
        const url = typeof b.url === 'string' ? b.url.trim() : ''
        if (!isValidHost(url, TIKTOK_HOST_RE)) {
          throw new BlogBlockValidationError(`bloco ${i + 1} (tiktok): URL precisa ser do tiktok.com`)
        }
        return { id, type: 'tiktok', url } as BlogBlock
      }
      case 'product': {
        const mode = b.mode === 'card' ? 'card' : 'affiliate'
        if (mode === 'card') {
          const cardId = typeof b.cardId === 'string' ? b.cardId.trim() : ''
          const cardSlug = typeof b.cardSlug === 'string' ? b.cardSlug.trim() : ''
          if (!cardId && !cardSlug) {
            throw new BlogBlockValidationError(`bloco ${i + 1} (produto/carta): selecione uma carta`)
          }
          return { id, type: 'product', mode, cardId: cardId || undefined, cardSlug: cardSlug || undefined } as BlogBlock
        }
        const url = typeof b.url === 'string' ? b.url.trim() : ''
        if (!url) throw new BlogBlockValidationError(`bloco ${i + 1} (produto/afiliado): sem URL`)
        const title = typeof b.title === 'string' ? b.title.trim() : undefined
        const imageUrl = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : undefined
        const priceLabel = typeof b.priceLabel === 'string' ? b.priceLabel.trim() : undefined
        return { id, type: 'product', mode, url, title, imageUrl, priceLabel } as BlogBlock
      }
      case 'quote': {
        const text = typeof b.text === 'string' ? b.text.trim() : ''
        if (!text) throw new BlogBlockValidationError(`bloco ${i + 1} (citacao): texto vazio`)
        const attribution = typeof b.attribution === 'string' ? b.attribution.trim() : undefined
        return { id, type: 'quote', text, attribution } as BlogBlock
      }
      default:
        throw new BlogBlockValidationError(`bloco ${i + 1}: tipo nao tratado`)
    }
  })
}

// Extrai texto puro dos blocos pra calcular tempo de leitura (200 palavras/min).
export function estimateReadingMinutes(blocks: BlogBlock[]): number {
  let words = 0
  for (const b of blocks) {
    if (b.type === 'paragraph') words += b.html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
    else if (b.type === 'heading' || b.type === 'quote') words += b.text.trim().split(/\s+/).filter(Boolean).length
  }
  return Math.max(1, Math.round(words / 200))
}

export const REL_AFILIADO = 'sponsored nofollow noopener noreferrer'
