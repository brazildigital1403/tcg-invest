import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * A fonte das imagens de compartilhamento (25 rotas `opengraph-image`).
 *
 * ★ POR QUE EXISTE (24/09/2026, depois de derrubar um deploy). As 25 rotas
 * baixavam a DM Sans do Google Fonts durante o BUILD. Quando as duas
 * requisicoes falham, o array de fontes chega vazio no `ImageResponse` e o
 * satori estoura com "Cannot read properties of undefined (reading 'split')"
 * -- ele nao tem como desenhar texto sem nenhuma fonte. O build inteiro cai
 * por causa de uma rota de imagem: foi o que aconteceu com /blog e segurou as
 * abas do Guia de Lojas.
 *
 * O `Promise.allSettled` dos arquivos protegia logo e arte, nao a fonte. E
 * tratar "sem fonte" como caso normal nao adianta: sem fonte nao ha imagem.
 *
 * ★ AGORA O ARQUIVO VEM DE DENTRO. `public/fonts/dm-sans-{700,900}.ttf` estao
 * no repositorio (96 KB somados, OFL). Ler do proprio deploy tira a rede do
 * caminho critico do build e ainda economiza 50 downloads por deploy. A rede
 * continua ali como ultimo recurso, nao como primeira opcao.
 *
 * ★ AS ROTAS DINAMICAS (/lojas/[slug], /set/[id], /pokemon/[name]) rodam no
 * lambda, e o Next nao empacota `public/` no servidor sozinho -- por isso o
 * `outputFileTracingIncludes` do next.config.ts inclui esta pasta. Mexer num
 * sem o outro quebra justamente as tres que nao sao pre-renderizadas.
 */

export type PesoOg = 700 | 900

const REMOTO: Record<PesoOg, string> = {
  700: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf',
  900: 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf',
}

/** Uma leitura por processo: o build gera dezenas de imagens seguidas. */
const cache = new Map<PesoOg, ArrayBuffer>()

function paraArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/**
 * O arquivo da fonte. Disco primeiro, rede so se o disco falhar.
 *
 * Lanca quando os dois caminhos falham -- o chamador usa `Promise.allSettled`
 * e continua sem essa fonte. O que NAO pode acontecer e ficar sem nenhuma, e
 * para isso existe `fontesOg()`.
 */
export async function fonteOg(peso: PesoOg): Promise<ArrayBuffer> {
  const guardada = cache.get(peso)
  if (guardada) return guardada

  try {
    const buf = await readFile(join(process.cwd(), 'public', 'fonts', `dm-sans-${peso}.ttf`))
    const ab = paraArrayBuffer(buf)
    cache.set(peso, ab)
    return ab
  } catch {
    // Ultimo recurso: o arquivo sumiu do deploy (tracing mal configurado, por
    // exemplo). Melhor uma ida a rede do que uma imagem sem texto.
    const r = await fetch(REMOTO[peso])
    if (!r.ok) throw new Error(`fonte ${peso}: ${r.status}`)
    const ab = await r.arrayBuffer()
    cache.set(peso, ab)
    return ab
  }
}

export type FonteOg = { name: 'DM Sans'; data: ArrayBuffer; weight: PesoOg; style: 'normal' }

/**
 * O array pronto para o `ImageResponse`, nos dois pesos que as imagens usam.
 *
 * ★ NUNCA DEVOLVE VAZIO SEM MOTIVO: se um peso falhar, o outro sustenta a
 * imagem (o satori usa a fonte mais proxima). Devolver `[]` so acontece se os
 * DOIS pesos falharem no disco E na rede -- e ai a imagem sai sem texto, que
 * e feio, mas nao derruba o deploy.
 */
export async function fontesOg(): Promise<FonteOg[]> {
  const [f700, f900] = await Promise.allSettled([fonteOg(700), fonteOg(900)])
  const out: FonteOg[] = []
  if (f700.status === 'fulfilled') out.push({ name: 'DM Sans', data: f700.value, weight: 700, style: 'normal' })
  if (f900.status === 'fulfilled') out.push({ name: 'DM Sans', data: f900.value, weight: 900, style: 'normal' })
  if (out.length === 0) console.error('[og] nenhuma fonte carregou -- a imagem sai sem texto')
  return out
}
