import { authFetch } from './authFetch'

/**
 * Helper de upload de fotos de loja.
 *
 * Faz:
 *   1. Valida tipo de arquivo (jpg, png, webp)
 *   2. Comprime client-side: redimensiona para no máx 1600x1600 e converte
 *      pra WebP qualidade 0.85 (geralmente reduz 70-90% do tamanho)
 *   3. Envia via FormData pro endpoint POST /api/lojas/[id]/upload-foto
 *   4. Retorna { url, fotos } em sucesso ou throw com mensagem amigável
 *
 * Compressão é importante porque:
 *   - O bucket aceita até 5MB, mas fotos de celular comum vêm 4-8MB
 *   - WebP é ~30% menor que JPEG na mesma qualidade visual
 *   - Reduz custo de storage e largura de banda
 *
 * Uso:
 *   const { url, fotos } = await uploadFotoLoja(lojaId, file)
 */

const MIMES_OK   = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_INPUT  = 20 * 1024 * 1024 // 20MB no input bruto (pré-compressão)
const TAMANHO_MAX_OUTPUT = 5 * 1024 * 1024  //  5MB depois da compressão (limite do bucket)
const MAX_DIMENSION      = 1600              // 1600px maior lado

export interface UploadFotoResult {
  url: string
  fotos: string[] // array atualizado de fotos da loja
}

/**
 * Comprime uma imagem para WebP usando canvas.
 * Roda 100% no browser, sem dependências.
 */
async function compressToWebP(file: File): Promise<Blob> {
  // Carrega imagem
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload  = () => resolve(i)
    i.onerror = () => reject(new Error('Falha ao decodificar a imagem'))
    i.src = dataUrl
  })

  // Calcula dimensões finais (máx 1600 no maior lado, mantém proporção)
  let { width, height } = img
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    width  = Math.round(width  * ratio)
    height = Math.round(height * ratio)
  }

  // Desenha no canvas
  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível neste navegador')
  ctx.drawImage(img, 0, 0, width, height)

  // Exporta como WebP qualidade 0.85
  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/webp', 0.85)
  })
  if (!blob) throw new Error('Falha ao gerar imagem comprimida')

  return blob
}

/**
 * Faz upload de uma foto pra galeria da loja.
 *
 * @param lojaId - UUID da loja (deve ser owner do user logado)
 * @param file   - File do <input type="file">
 * @returns { url, fotos }
 * @throws Error com mensagem amigável em PT-BR
 */
export async function uploadFotoLoja(lojaId: string, file: File): Promise<UploadFotoResult> {
  // ─── Validações ────────────────────────────────────────────
  if (!MIMES_OK.includes(file.type as typeof MIMES_OK[number])) {
    throw new Error('Apenas imagens JPG, PNG ou WebP são aceitas.')
  }
  if (file.size > TAMANHO_MAX_INPUT) {
    throw new Error(`Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 20MB.`)
  }

  // ─── Compressão ────────────────────────────────────────────
  const blob = await compressToWebP(file)

  if (blob.size > TAMANHO_MAX_OUTPUT) {
    throw new Error('Não foi possível comprimir a imagem o suficiente. Tente uma foto menor.')
  }

  // ─── Upload ────────────────────────────────────────────────
  const formData = new FormData()
  formData.append('file', blob, 'foto.webp')

  const res = await authFetch(`/api/lojas/${lojaId}/upload-foto`, {
    method: 'POST',
    body: formData,
    // NÃO seta Content-Type — o browser seta automaticamente o multipart boundary
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao enviar foto. Tente novamente.')
  }

  return {
    url: data.url,
    fotos: data.fotos || [],
  }
}

/**
 * Deleta uma foto da galeria da loja.
 *
 * @param lojaId - UUID da loja
 * @param fotoUrl - URL pública da foto a remover
 * @returns array atualizado de fotos
 * @throws Error com mensagem amigável
 */
export async function deletarFotoLoja(lojaId: string, fotoUrl: string): Promise<string[]> {
  const res = await authFetch(`/api/lojas/${lojaId}/foto`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fotoUrl }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || 'Erro ao remover foto. Tente novamente.')
  }

  return data.fotos || []
}
