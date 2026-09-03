/**
 * Compressao de imagem NO BROWSER, antes do upload.
 *
 * ★ POR QUE ISTO EXISTE (03/09/2026): as fotos de produto subiam CRUAS. Medido
 * no bucket: media de **1,1 MB por foto**, com PNGs de ate 2 MB — e a galeria
 * do produto carrega ate 10. Um comprador no 4G baixava ~11 MB pra ver um item.
 * Os comentarios de `logo/route.ts` e `capa/route.ts` afirmavam que "a
 * compressao client-side ja reduz"; era falso, o `FormLoja` mandava o `File`
 * cru.
 *
 * Resolve na RAIZ (economiza banda do comprador E storage), diferente de
 * otimizar na entrega, que so conserta na saida. Os dois valem juntos.
 *
 * Formato: **WebP**, suportado por todo browser que a Bynx atende. Se o
 * `toBlob` falhar (browser sem WebP, canvas tainted, imagem corrompida), a
 * funcao devolve o arquivo ORIGINAL — comprimir e otimizacao, nunca pode ser
 * o motivo de um upload falhar.
 */

export interface OpcoesCompressao {
  /** Maior lado da imagem final, em px. */
  maxLado?: number
  /** 0..1 — 0.82 e o ponto onde o WebP para de ganhar peso sem ganhar olho. */
  qualidade?: number
}

export async function comprimirImagem(
  arquivo: File,
  { maxLado = 1600, qualidade = 0.82 }: OpcoesCompressao = {},
): Promise<File> {
  // GIF animado perde a animacao no canvas; SVG nao faz sentido rasterizar.
  if (!arquivo.type.startsWith('image/') || /gif|svg/.test(arquivo.type)) return arquivo

  try {
    const bitmap = await criarBitmap(arquivo)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))

    // Ja e pequena E ja e webp: nao ha o que ganhar reprocessando.
    if (escala === 1 && arquivo.type === 'image/webp') return arquivo

    const w = Math.round(bitmap.width * escala)
    const h = Math.round(bitmap.height * escala)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return arquivo
    ctx.drawImage(bitmap, 0, 0, w, h)
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', qualidade))
    if (!blob) return arquivo

    // Compressao que ENGORDA o arquivo nao entra (acontece com PNG pequeno de
    // poucas cores, onde o webp com perda fica maior que o original).
    if (blob.size >= arquivo.size) return arquivo

    const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], nome, { type: 'image/webp', lastModified: Date.now() })
  } catch {
    return arquivo
  }
}

/** `createImageBitmap` quando existe (rapido, fora da main thread); senao, `<img>`. */
async function criarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(arquivo) } catch { /* cai no fallback */ }
  }
  const url = URL.createObjectURL(arquivo)
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => rej(new Error('imagem invalida'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** "1,9 MB" — pra mostrar o ganho ao lojista. */
export function fmtTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
