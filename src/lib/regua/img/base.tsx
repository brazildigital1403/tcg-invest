import { Children, createElement, isValidElement, type ReactElement, type ReactNode, type CSSProperties } from 'react'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { URL_CANONICA } from '@/lib/email'
import { imagemCarta } from '@/lib/regua/templates/blocos-a'

/**
 * Pecas comuns das imagens pessoais da regua (rota /api/email/img/[tipo]).
 *
 * Cada tipo desenha em coordenadas de 1x (as mesmas do mockup aprovado em
 * _Regua/mockups/<ID>/assets/*.html) e a raiz escala 2x: o JPG final sai com
 * o dobro de pixels, como os heros fixos da regua.
 *
 * O que o satori nao faz (perspectiva 3D, grid, mix-blend, filtro de cor) vira
 * versao plana: o fundo e a cena fixa de cada tipo sao um JPG pre-renderizado
 * do proprio mockup em public/emails/regua/<id>/ (sem os elementos da pessoa),
 * e os dados da pessoa entram por cima, nas mesmas coordenadas.
 *
 * ★ FALHA NUNCA VAI PARA O CACHE: imagem de carta que nao baixa, fundo que nao
 * le e fonte que falta LANCAM. A rota responde 500 sem Cache-Control publico e
 * a proxima abertura tenta de novo.
 */

/** Cores achatadas (o mesmo COR do lote B); imagem nao le var(). */
export const C = {
  texto: '#f0f0f0',
  texto2: '#a3a4a6',
  sec: 'rgba(255,255,255,.62)',
  ter: 'rgba(255,255,255,.40)',
  ambar: '#f59e0b',
  verde: '#22c55e',
  vermelho: '#ef4444',
  rosa: '#ec4899',
  roxo: '#a855f7',
  surface2: '#191b20',
  borda: '#202227',
  borda2: '#2f3135',
  elevado: '#0d0f14',
  fundo: '#080a0f',
  tinta: '#0a0a0a',
} as const

export const GRAD = 'linear-gradient(135deg, #f59e0b, #ef4444)'

export type Desenho<D> = {
  /** Tamanho do canvas em 1x (o JPG sai com o dobro). */
  largura: number
  altura: number
  /** Cor opaca de fundo (achata qualquer transparencia no JPG). */
  fundo: string
  /**
   * Tamanho final em px quando o template pede outro que o do mockup (o E16
   * desenha em 560x330 e entrega 1072x632). Sem isso, sai o dobro do canvas.
   */
  saida?: { largura: number; altura: number }
  /** Dados de exemplo (?exemplo=1): a persona do template. */
  exemplo: D
  /** Confere o JSON vindo de email_envios.meta.img.<tipo>. */
  valido: (d: unknown) => d is D
  desenhar: (d: D) => Promise<ReactElement>
}

// ─── formatos ───────────────────────────────────────────────────────────────

/** 1955.3 -> "R$ 1.955,30" (espaco normal: o satori nao quebra dentro de flex nowrap). */
export function brlImg(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\s/g, ' ')
}

/** 61.6 -> "61,6"; casas=0 -> "62". */
export function numImg(v: number, casas = 1): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

// ─── validacao leve do JSON do envio ────────────────────────────────────────

export const eObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const eStr = (v: unknown): v is string => typeof v === 'string'
export const eNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const eLista = (v: unknown, min = 0, max = 99): v is unknown[] => Array.isArray(v) && v.length >= min && v.length <= max

// ─── arquivos locais (fontes e fundos) ──────────────────────────────────────

// ─── busca na rede com nova tentativa ───────────────────────────────────────

/** Tempo de cada tentativa. Duas cabem com folga no maxDuration = 20 da rota. */
const TENTATIVA_MS = 7000
/** Teto de uma busca inteira (tentativas somadas), para sobrar tempo ao render. */
const PRAZO_BUSCA_MS = 14500

class FalhaTransitoria extends Error {}

/**
 * `fetch` com UMA nova tentativa quando a falha e transitoria: timeout, erro
 * de rede ou 5xx. 4xx nao repete (a imagem nao existe; tentar de novo nao
 * muda nada). Medido em producao (e13-lance): a 1a busca da funcao fria passou
 * dos 8s e virou 500; as seguintes responderam em ~3s. Cada tentativa tem
 * 7s e a soma respeita `PRAZO_BUSCA_MS`, dentro do maxDuration de 20s da rota.
 */
export async function buscarComRetentativa(url: string, prazoFinal = Date.now() + PRAZO_BUSCA_MS): Promise<Response> {
  let ultimo: unknown = null
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const resta = prazoFinal - Date.now()
    if (resta < 1000) break
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(Math.min(TENTATIVA_MS, resta)) })
      if (r.status >= 500) {
        ultimo = new FalhaTransitoria(`status ${r.status}`)
        continue
      }
      return r
    } catch (e) {
      // AbortError/TimeoutError ou falha de rede: transitoria, tenta de novo.
      ultimo = e
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error('busca sem tempo para tentar')
}

const cacheArquivo = new Map<string, Buffer>()

/**
 * Arquivo de public/. Disco primeiro (outputFileTracingIncludes leva a pasta
 * para o lambda); se o disco falhar, o proprio deploy pela rede. Lanca se os
 * dois falharem.
 */
async function arquivoPublico(caminho: string): Promise<Buffer> {
  const guardado = cacheArquivo.get(caminho)
  if (guardado) return guardado
  let buf: Buffer
  try {
    buf = await readFile(join(process.cwd(), 'public', caminho))
  } catch {
    const r = await buscarComRetentativa(`${URL_CANONICA}/${caminho}`)
    if (!r.ok) throw new Error(`[img regua] arquivo ${caminho}: ${r.status}`)
    buf = Buffer.from(await r.arrayBuffer())
  }
  cacheArquivo.set(caminho, buf)
  return buf
}

const PESOS = [500, 600, 700, 800, 900] as const
type Peso = (typeof PESOS)[number]
type FonteImg = { name: 'DM Sans'; data: ArrayBuffer; weight: Peso; style: 'normal' }

/** DM Sans nos 5 pesos dos mockups. Todos obrigatorios: peso errado muda a arte. */
export async function fontesImg(): Promise<FonteImg[]> {
  return Promise.all(PESOS.map(async (weight) => {
    const b = await arquivoPublico(`fonts/dm-sans-${weight}.ttf`)
    const data = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
    return { name: 'DM Sans' as const, data, weight, style: 'normal' as const }
  }))
}

function dataUri(buf: Buffer, tipo: 'jpeg' | 'png'): string {
  return `data:image/${tipo};base64,${buf.toString('base64')}`
}

/**
 * SVG montado em texto como data URI (o satori entrega ao resvg, que faz
 * filtro, mascara e gradiente). Usado nos graficos e tracos desenhados.
 */
export function svgUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** Fundo/cena fixa pre-renderizada: public/emails/regua/<arquivo>. */
export async function fundoFixo(arquivo: string): Promise<string> {
  const buf = await arquivoPublico(`emails/regua/${arquivo}`)
  return dataUri(buf, arquivo.endsWith('.png') ? 'png' : 'jpeg')
}

// ─── imagens de carta (rede) ────────────────────────────────────────────────

type Sharp = typeof import('sharp')
let _sharp: Sharp | null = null
async function sharp(): Promise<Sharp> {
  if (!_sharp) _sharp = (await import('sharp')).default as unknown as Sharp
  return _sharp
}

/** pokemontcg.io tem a versao _hires (734x1024); a pequena (245x342) estoura no 2x. */
function melhorUrl(url: string, larguraPx: number): string {
  if (larguraPx > 245 && /^https:\/\/images\.pokemontcg\.io\/[^?#]+\/[^/_]+\.png$/.test(url)) {
    return url.replace(/\.png$/, '_hires.png')
  }
  return url
}

export type OpcoesImagem = {
  /** Caixa em 1x onde a imagem vai entrar (ela e recortada em "cover"). */
  largura: number
  altura: number
  /** Posicao vertical do recorte, 0 = topo, 0.5 = centro (object-position). */
  posY?: number
  /** Escala de cinza (filter: grayscale do mockup). */
  cinza?: boolean
  /** Multiplicador de brilho (filter: brightness do mockup). */
  brilho?: number
  /**
   * Recorte de um pedaco da carta (o selo do E15): a carta e escalada para
   * `larguraTotal` (1x) e o pedaco largura x altura sai de (x, y).
   */
  recorte?: { larguraTotal: number; x: number; y: number }
}

const cacheImg = new Map<string, Promise<string>>()

/**
 * Baixa a imagem da carta (so de origem permitida), recorta em "cover" no
 * tamanho 2x e devolve data URI JPEG. O satori so le PNG/JPEG; passar por
 * aqui resolve WebP e deixa o payload pequeno. Lanca se nao baixar.
 */
export function imagemCartaImg(url: string, o: OpcoesImagem): Promise<string> {
  const chave = JSON.stringify([url, o])
  const ja = cacheImg.get(chave)
  if (ja) return ja
  const p = (async () => {
    const segura = imagemCarta(url)
    if (!segura) throw new Error('[img regua] imagem de origem nao permitida')
    const w = Math.round(o.largura * 2)
    const h = Math.round(o.altura * 2)
    // Um prazo so para as buscas desta imagem (_hires + original + retentativas).
    const prazo = Date.now() + PRAZO_BUSCA_MS
    let r = await buscarComRetentativa(melhorUrl(segura, w), prazo)
    if (!r.ok && melhorUrl(segura, w) !== segura) r = await buscarComRetentativa(segura, prazo)
    if (!r.ok) throw new Error(`[img regua] imagem ${r.status}`)
    const original = Buffer.from(await r.arrayBuffer())
    const s = await sharp()
    const meta = await s(original).metadata()
    const ow = meta.width ?? w
    const oh = meta.height ?? h
    let rw: number
    let rh: number
    let left: number
    let top: number
    if (o.recorte) {
      rw = Math.round(o.recorte.larguraTotal * 2)
      rh = Math.round((oh / ow) * rw)
      left = Math.min(Math.max(0, Math.round(o.recorte.x * 2)), Math.max(0, rw - w))
      top = Math.min(Math.max(0, Math.round(o.recorte.y * 2)), Math.max(0, rh - h))
    } else {
      // "cover" com object-position vertical: escala pela maior razao e recorta.
      const k = Math.max(w / ow, h / oh)
      rw = Math.max(w, Math.round(ow * k))
      rh = Math.max(h, Math.round(oh * k))
      left = Math.round((rw - w) / 2)
      top = Math.round((rh - h) * (o.posY ?? 0.5))
    }
    let img = s(original).resize(rw, rh).extract({ left, top, width: w, height: h }).flatten({ background: '#191b20' })
    if (o.cinza) img = img.grayscale()
    if (o.brilho && o.brilho !== 1) img = img.modulate({ brightness: o.brilho })
    const out = await img.jpeg({ quality: 88, chromaSubsampling: '4:4:4' }).toBuffer()
    return dataUri(out, 'jpeg')
  })()
  cacheImg.set(chave, p)
  p.catch(() => cacheImg.delete(chave))
  return p
}

// ─── pecas de desenho ───────────────────────────────────────────────────────

/** Caixa absoluta (o satori exige display flex em todo div com filhos). */
export function Abs(props: { x: number; y: number; w?: number; h?: number; style?: CSSProperties; children?: ReactNode }) {
  const { x, y, w, h, style, children } = props
  // satori quebra com propriedade `undefined` no style: so entra o que existe.
  const caixa: CSSProperties = { position: 'absolute', left: x, top: y, display: 'flex' }
  if (w !== undefined) caixa.width = w
  if (h !== undefined) caixa.height = h
  return (
    <div style={{ ...caixa, ...style }}>
      {children}
    </div>
  )
}

/** Seta triangular desenhada (o glifo do triangulo nao existe na DM Sans). */
export function Seta(props: { dir: 'cima' | 'baixo'; cor: string; tam: number; style?: CSSProperties }) {
  const { dir, cor, tam, style } = props
  const d = dir === 'cima' ? 'M12 3 L22 20 L2 20 Z' : 'M2 4 L22 4 L12 21 Z'
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ flexShrink: 0, ...style }}>
      <path d={d} fill={cor} />
    </svg>
  )
}

/** Ponto de check desenhado (selo ambar do E04). */
export function Check(props: { cor: string; tam: number }) {
  return (
    <svg width={props.tam} height={props.tam} viewBox="0 0 24 24">
      <path d="M5 12.5 L10 17.5 L19.5 6.5" fill="none" stroke={props.cor} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Sino outline (o mesmo do mockup E07). */
export function Sino(props: { cor: string; tam: number; traco?: number }) {
  return (
    <svg width={props.tam} height={props.tam} viewBox="0 0 24 24" fill="none" stroke={props.cor} strokeWidth={props.traco ?? 2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

// ─── escala 2x ──────────────────────────────────────────────────────────────

/** Propriedades numericas que NAO sao pixel. */
const SEM_UNIDADE = new Set(['opacity', 'fontWeight', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'lineHeight', 'order'])

function escalarValor(chave: string, v: unknown, k: number): unknown {
  if (typeof v === 'number') return SEM_UNIDADE.has(chave) ? v : v * k
  // url(...) com data URI: o base64 pode conter "9px" por acaso; nao mexer.
  if (typeof v === 'string' && !v.includes('url(')) return v.replace(/(-?\d*\.?\d+)px/g, (_, n: string) => `${Number(n) * k}px`)
  return v
}

function escalarEstilo(s: CSSProperties, k: number): CSSProperties {
  const out: Record<string, unknown> = {}
  for (const [c, v] of Object.entries(s)) out[c] = escalarValor(c, v, k)
  return out as CSSProperties
}

type ElementoQualquer = ReactElement<Record<string, unknown> & { children?: ReactNode; style?: CSSProperties }>

/**
 * Reescreve a arvore desenhada em 1x para `k`x: px do style, width/height de
 * img e svg. Componentes de funcao (pecas sem hook) sao expandidos aqui.
 *
 * ★ POR QUE NAO `transform: scale(2)` NA RAIZ: o satori posiciona imagem (e o
 * svg, que ele converte em imagem) sem levar em conta a escala do pai: a
 * imagem sai cortada no quarto superior esquerdo. Escalar os numeros evita isso.
 */
export function escalar(no: ReactNode, k: number): ReactNode {
  if (Array.isArray(no)) return no.map((n) => escalar(n, k))
  if (!isValidElement(no)) return no
  const el = no as ElementoQualquer
  if (typeof el.type === 'function') {
    return escalar((el.type as (p: unknown) => ReactNode)(el.props), k)
  }
  const props: Record<string, unknown> = { ...el.props }
  if (props.style) props.style = escalarEstilo(props.style as CSSProperties, k)
  if (el.type === 'img' || el.type === 'svg') {
    if (typeof props.width === 'number') props.width = props.width * k
    if (typeof props.height === 'number') props.height = props.height * k
  }
  const filhos = props.children
  // Texto puro fica como esta: virar array de 1 item faz o satori recusar
  // `display: block` (o corte com reticencias do T precisa dele).
  if (el.type !== 'svg' && filhos !== undefined && typeof filhos !== 'string' && typeof filhos !== 'number') {
    props.children = Children.map(filhos as ReactNode, (c) => escalar(c, k))
  }
  return createElement(el.type as string, { ...props, key: el.key ?? undefined })
}

// ─── render ─────────────────────────────────────────────────────────────────

/**
 * Desenha o tipo e devolve o JPG 2x opaco. Usa o `ImageResponse` (satori +
 * resvg) para o PNG e o sharp para achatar em JPEG. Lanca em qualquer falha.
 */
export async function renderizarJpg<D>(desenho: Desenho<D>, dados: D): Promise<Buffer> {
  const [arte, fonts] = await Promise.all([desenho.desenhar(dados), fontesImg()])
  const { largura: W, altura: H } = desenho
  const raiz = escalar(
    <div style={{ width: W, height: H, display: 'flex', position: 'relative', overflow: 'hidden', background: desenho.fundo, fontFamily: 'DM Sans', color: C.texto }}>
      {arte}
    </div>,
    2,
  ) as ReactElement
  const resp = new ImageResponse(raiz, { width: W * 2, height: H * 2, fonts })
  const png = Buffer.from(await resp.arrayBuffer())
  if (png.length === 0) throw new Error('[img regua] render vazio')
  const s = await sharp()
  let img = s(png)
  if (desenho.saida) img = img.resize(desenho.saida.largura, desenho.saida.altura, { fit: 'fill' })
  return img
    .flatten({ background: desenho.fundo })
    .jpeg({ quality: 84, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer()
}

/** O tipo como a rota enxerga: dados `unknown`, conferidos por `valido`. */
export type TipoImg = {
  largura: number
  altura: number
  exemplo: unknown
  valido: (d: unknown) => boolean
  renderizar: (d: unknown) => Promise<Buffer>
}

export function tipoImg<D>(desenho: Desenho<D>): TipoImg {
  return {
    largura: desenho.largura,
    altura: desenho.altura,
    exemplo: desenho.exemplo,
    valido: desenho.valido,
    renderizar: (d) => renderizarJpg(desenho, d as D),
  }
}
