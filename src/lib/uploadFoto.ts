import { authFetch } from './authFetch'

/**
 * Helpers de upload de fotos e logo de loja.
 *
 * Fotos da galeria (array `fotos[]` da loja):
 *   - uploadFotoLoja(lojaId, file)   → POST /api/lojas/[id]/upload-foto
 *   - deletarFotoLoja(lojaId, url)   → DELETE /api/lojas/[id]/foto
 *
 * Logo (campo `logo_url` único da loja):
 *   - uploadLogoLoja(lojaId, file)   → POST /api/lojas/[id]/logo
 *   - deletarLogoLoja(lojaId)        → DELETE /api/lojas/[id]/logo
 *
 * Compressão client-side:
 *   - Fotos: 1600px max, WebP 0.85
 *   - Logo:  400px quadrado (crop centralizado), WebP 0.9
 */

const MIMES_OK   = ['image/jpeg', 'image/png', 'image/webp'] as const
const TAMANHO_MAX_INPUT  = 20 * 1024 * 1024
const TAMANHO_MAX_OUTPUT = 5 * 1024 * 1024

// Galeria
const FOTO_MAX_DIMENSION = 1600
const FOTO_QUALITY       = 0.85

// Logo
const LOGO_DIMENSION = 400
const LOGO_QUALITY   = 0.9

export interface UploadFotoResult {
  url: string
  fotos: string[]
}

export interface UploadLogoResult {
  url: string
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload  = () => resolve(img)
      img.onerror = () => reject(new Error('Falha ao decodificar a imagem'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.readAsDataURL(file)
  })
}

/**
 * Comprime uma imagem para WebP usando canvas (modo "fit" — mantém proporção).
 * Usado para fotos da galeria.
 */
async function compressToWebP(file: File, maxDimension: number, quality: number): Promise<Blob> {
  const img = await fileToImage(file)

  let { width, height } = img
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height)
    width  = Math.round(width  * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível neste navegador')
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })
  if (!blob) throw new Error('Falha ao gerar imagem comprimida')

  return blob
}

/**
 * Crop quadrado centralizado + redimensionamento.
 * Usado para o logo (sempre 1:1).
 *
 * Algoritmo:
 *   1. Pega o menor lado da imagem original (s = min(w, h))
 *   2. Calcula offsets pra centralizar (sx = (w - s) / 2, sy = (h - s) / 2)
 *   3. Desenha s×s pixels da origem em um canvas dimension×dimension
 *   4. Exporta como WebP
 */
async function cropToSquareWebP(file: File, dimension: number, quality: number): Promise<Blob> {
  const img = await fileToImage(file)

  const s = Math.min(img.width, img.height)
  const sx = Math.floor((img.width  - s) / 2)
  const sy = Math.floor((img.height - s) / 2)

  const canvas = document.createElement('canvas')
  canvas.width  = dimension
  canvas.height = dimension
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas não disponível neste navegador')

  // Fundo branco (caso a imagem seja transparente — logo PNG)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, dimension, dimension)

  // Desenha s×s da origem em dimension×dimension do destino
  ctx.drawImage(img, sx, sy, s, s, 0, 0, dimension, dimension)

  const blob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })
  if (!blob) throw new Error('Falha ao gerar imagem comprimida')

  return blob
}

function validateFile(file: File): void {
  if (!MIMES_OK.includes(file.type as typeof MIMES_OK[number])) {
    throw new Error('Apenas imagens JPG, PNG ou WebP são aceitas.')
  }
  if (file.size > TAMANHO_MAX_INPUT) {
    throw new Error(`Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 20MB.`)
  }
}

// ─── Galeria de fotos ─────────────────────────────────────────────────────────

/**
 * Faz upload de uma foto pra galeria da loja.
 */
export async function uploadFotoLoja(lojaId: string, file: File): Promise<UploadFotoResult> {
  validateFile(file)
  const blob = await compressToWebP(file, FOTO_MAX_DIMENSION, FOTO_QUALITY)
  if (blob.size > TAMANHO_MAX_OUTPUT) {
    throw new Error('Não foi possível comprimir a imagem o suficiente. Tente uma foto menor.')
  }

  const formData = new FormData()
  formData.append('file', blob, 'foto.webp')

  const res = await authFetch(`/api/lojas/${lojaId}/upload-foto`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Erro ao enviar foto. Tente novamente.')

  return {
    url: data.url,
    fotos: data.fotos || [],
  }
}

/**
 * Deleta uma foto da galeria da loja.
 */
export async function deletarFotoLoja(lojaId: string, fotoUrl: string): Promise<string[]> {
  const res = await authFetch(`/api/lojas/${lojaId}/foto`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fotoUrl }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Erro ao remover foto. Tente novamente.')

  return data.fotos || []
}

// ─── Logo da loja ─────────────────────────────────────────────────────────────

/**
 * Faz upload do logo da loja.
 *
 * Comportamento:
 *   - Crop quadrado centralizado automático (400×400 WebP)
 *   - Substitui o logo anterior (se houver) — servidor apaga o antigo do bucket
 */
export async function uploadLogoLoja(lojaId: string, file: File): Promise<UploadLogoResult> {
  validateFile(file)
  const blob = await cropToSquareWebP(file, LOGO_DIMENSION, LOGO_QUALITY)
  if (blob.size > TAMANHO_MAX_OUTPUT) {
    throw new Error('Não foi possível comprimir o logo o suficiente. Tente uma imagem menor.')
  }

  const formData = new FormData()
  formData.append('file', blob, 'logo.webp')

  const res = await authFetch(`/api/lojas/${lojaId}/logo`, {
    method: 'POST',
    body: formData,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Erro ao enviar logo. Tente novamente.')

  return { url: data.url }
}

/**
 * Remove o logo da loja (limpa logo_url e apaga arquivo do bucket).
 */
export async function deletarLogoLoja(lojaId: string): Promise<void> {
  const res = await authFetch(`/api/lojas/${lojaId}/logo`, {
    method: 'DELETE',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'Erro ao remover logo. Tente novamente.')
}
