'use client'

// Medidor de centralizacao. O admin usa na bancada (avulso ou a partir de um
// pedido de servico); o nucleo de conta e visao vive em src/lib/centralizacao
// para a previa do app reaproveitar depois.
//
// Fluxo por face: foto -> deteccao automatica (cantos + moldura) -> ajuste das
// 8 linhas -> resultado ao vivo -> salvar/baixar.
//
// ★ A deteccao e SUGESTAO. Cada linha precisa ser conferida (arrastar, setas ou
//   Enter) antes de salvar: foto real com fundo escuro ja enganou a borda de
//   baixo em 2 a 4 mm no prototipo.
// ★ Nunca mostra nota. Diz so em que faixa da tabela de cada graduadora a
//   centralizacao cabe, com a mesma frase do relatorio.
// ★ Tudo roda no navegador: a foto nao vai para servidor nenhum para medir.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  detectarCarta, retificar, detectarMoldura, desvioDeRetangulo, CARTA_MM, LADOS,
  type Pt, type Imagem, type Retificada, type Lado,
} from '@/lib/centralizacao/visao'
import {
  medir, moverLinha, linhasPadrao, lerLinha, ehVertical, ORDEM_LINHAS, NOME_LINHA, textoDoLaudo, fmtMm,
  leituraRegua, REGUA_PASSO_MM, REGUA_LINHAS, MARGEM_MM, type Linhas, type ChaveLinha, type Medida,
} from '@/lib/centralizacao/medida'
import EscadasGraduadoras from './EscadasGraduadoras'
import { IconCamera, IconUpload, IconWarning, IconCheck, IconDownload, IconCopy, IconChevronLeft, IconChevronRight } from '@/components/ui/Icons'

export type Face = 'frente' | 'verso'
export const FACES: Face[] = ['frente', 'verso']
const ROTULO_FACE: Record<Face, string> = { frente: 'Frente', verso: 'Verso' }

export type FotoOpcao = { rotulo: string; url: string; midiaId: string }
/** O que fica gravado no laudo para refazer a medida depois. */
export type MedicaoFace = {
  cantos: Pt[]; img: [number, number]; linhas: Linhas; sem_moldura: boolean; midia_id: string | null; medido_em: string
}
export type ResultadoFace = { texto: string; medicao: MedicaoFace; imagem: () => Promise<Blob> }

/** Pixels por mm da carta endireitada (1008 x 1408). */
const PPM = 16
/** Lado maior da foto carregada: acima disso o iOS recusa o canvas. */
const MAX_LADO_FOTO = 3000
/** Confianca abaixo disso pede conferencia com destaque. */
const CONF_MIN = 0.5

type Etapa = 'vazio' | 'processando' | 'cantos' | 'linhas' | 'erro'
type EstadoFace = {
  etapa: Etapa
  aviso: string
  fotoUrl: string
  midiaId: string | null
  dims: [number, number]
  cantos: Pt[]
  retUrl: string
  linhas: Linhas
  conf: Partial<Record<ChaveLinha, number>>
  conferidas: ChaveLinha[]
  semMoldura: boolean
  /** Alguma borda veio incerta: o aviso oferece o ajuste de cantos. */
  sugerirCantos: boolean
}
const faceVazia = (): EstadoFace => ({
  etapa: 'vazio', aviso: '', fotoUrl: '', midiaId: null, dims: [0, 0], cantos: [], retUrl: '',
  linhas: linhasPadrao(), conf: {}, conferidas: [], semMoldura: false, sugerirCantos: false,
})

// ── imagem <-> canvas ────────────────────────────────────────────────────────

function novoCanvas(w: number, h: number) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv
}
const canvasParaUrl = (cv: HTMLCanvasElement) =>
  new Promise<string>((res, rej) => cv.toBlob(b => (b ? res(URL.createObjectURL(b)) : rej(new Error('toBlob'))), 'image/jpeg', 0.92))

async function carregarFoto(fonte: Blob) {
  const bmp = await createImageBitmap(fonte)
  const esc = Math.min(1, MAX_LADO_FOTO / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc)
  const cv = novoCanvas(w, h)
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const id = ctx.getImageData(0, 0, w, h)
  return { img: { width: w, height: h, data: id.data } as Imagem, canvas: cv, url: await canvasParaUrl(cv) }
}

function retParaCanvas(ret: Retificada) {
  const cv = novoCanvas(ret.width, ret.height)
  cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(ret.data), ret.width, ret.height), 0, 0)
  return cv
}

const cssVar = (nome: string, reserva: string) => {
  if (typeof window === 'undefined') return reserva
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || reserva
}

/** Retangulo 63x88 no meio da foto, para quando a deteccao nao acha a carta. */
function cantosPadrao(w: number, h: number): Pt[] {
  const ch = Math.min(h * 0.8, (w * 0.8 * CARTA_MM.h) / CARTA_MM.w), cw = (ch * CARTA_MM.w) / CARTA_MM.h
  const x0 = (w - cw) / 2, y0 = (h - ch) / 2
  return [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]]
}

// ── imagem anotada (vai para o relatorio do cliente) ─────────────────────────
// Proporcao 63:88 no total, para encaixar sem tarja na moldura do relatorio.

async function gerarAnotada(ret: HTMLCanvasElement, l: Linhas, m: Medida, face: Face, rodape: string): Promise<Blob> {
  const W = 1260, H = 1760, MX = 110, MY = 110
  const cw = W - 2 * MX, k = cw / CARTA_MM.w, chh = CARTA_MM.h * k
  const cv = novoCanvas(W, H)
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('canvas')
  const fonte = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const cor = {
    fundo: cssVar('--bx-bg', '#080a0f'), texto: cssVar('--bx-text', '#f0f0f0'), texto2: cssVar('--bx-text-2', 'rgba(255,255,255,.62)'),
    ext: cssVar('--bx-amber', '#f59e0b'), int: cssVar('--bx-blue', '#60a5fa'),
  }
  ctx.fillStyle = cor.fundo; ctx.fillRect(0, 0, W, H)
  const X = (mm: number) => MX + mm * k, Y = (mm: number) => MY + mm * k
  // `ret` tem MARGEM_MM de sobra em volta. Desenha a carta e, se a borda do papel
  // foi puxada para fora dos cantos detectados, um pouco da foto ate ela.
  const r0x = Math.max(-MARGEM_MM, Math.min(0, l.ext.esq) - 0.5), r1x = Math.min(CARTA_MM.w + MARGEM_MM, Math.max(CARTA_MM.w, l.ext.dir) + 0.5)
  const r0y = Math.max(-MARGEM_MM, Math.min(0, l.ext.topo) - 0.5), r1y = Math.min(CARTA_MM.h + MARGEM_MM, Math.max(CARTA_MM.h, l.ext.base) + 0.5)
  ctx.drawImage(ret, (r0x + MARGEM_MM) * PPM, (r0y + MARGEM_MM) * PPM, (r1x - r0x) * PPM, (r1y - r0y) * PPM, X(r0x), Y(r0y), (r1x - r0x) * k, (r1y - r0y) * k)
  const linha = (k2: ChaveLinha) => {
    const v = lerLinha(l, k2)
    ctx.beginPath()
    if (ehVertical(k2)) { ctx.moveTo(X(v), MY - 40); ctx.lineTo(X(v), MY + chh + 40) }
    else { ctx.moveTo(MX - 40, Y(v)); ctx.lineTo(MX + cw + 40, Y(v)) }
    ctx.strokeStyle = cor.fundo; ctx.lineWidth = 7; ctx.stroke()
    ctx.strokeStyle = k2.startsWith('ext') ? cor.ext : cor.int; ctx.lineWidth = 3.5; ctx.stroke()
  }
  ORDEM_LINHAS.forEach(linha)
  ctx.fillStyle = cor.texto; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const num = (n: number) => n.toFixed(2).replace('.', ',')
  ctx.font = `700 34px ${fonte}`
  ctx.fillText(num(m.mm.esq), MX / 2, MY + chh / 2 - 18)
  ctx.fillText(num(m.mm.dir), W - MX / 2, MY + chh / 2 - 18)
  ctx.fillText(`${num(m.mm.topo)} mm`, W / 2, MY / 2)
  ctx.fillText(`${num(m.mm.base)} mm`, W / 2, MY + chh + 52)
  ctx.font = `600 24px ${fonte}`; ctx.fillStyle = cor.texto2
  ctx.fillText('mm', MX / 2, MY + chh / 2 + 18)
  ctx.fillText('mm', W - MX / 2, MY + chh / 2 + 18)
  ctx.fillStyle = cor.texto; ctx.font = `800 38px ${fonte}`
  ctx.fillText(`${ROTULO_FACE[face]} · laterais ${m.lr.texto} · topo e base ${m.tb.texto}`, W / 2, H - 92)
  ctx.fillStyle = cor.texto2; ctx.font = `600 26px ${fonte}`
  ctx.fillText(rodape.length > 70 ? `${rodape.slice(0, 69)}…` : rodape, W / 2, H - 42)
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.9))
}

// ── componente ───────────────────────────────────────────────────────────────

export default function MedidorCentralizacao({ titulo, subtitulo, rodapeImagem, fotos, salvas, salvarRotulo, onSalvar }: {
  titulo: string
  subtitulo?: string
  /** Linha de identificacao na imagem anotada (pedido, carta, data). */
  rodapeImagem: string
  /** Fotos do pedido para cada face (a primeira e a padrao). */
  fotos?: Partial<Record<Face, FotoOpcao[]>>
  /** Medida ja gravada, para retomar onde parou. */
  salvas?: Partial<Record<Face, MedicaoFace>>
  salvarRotulo?: string
  /** Sem onSalvar = modo avulso (baixar imagem e copiar medida). Devolve erro ou null. */
  onSalvar?: (r: Partial<Record<Face, ResultadoFace>>) => Promise<string | null>
}) {
  const [face, setFace] = useState<Face>('frente')
  const [estado, setEstado] = useState<Record<Face, EstadoFace>>({ frente: faceVazia(), verso: faceVazia() })
  const [ativa, setAtiva] = useState<ChaveLinha>('ext.esq')
  const [modo, setModo] = useState<'linhas' | 'regua' | 'foto'>('linhas')
  const [lupa, setLupa] = useState(true)
  const [lupaPos, setLupaPos] = useState<{ x: number; y: number } | null>(null)
  const [cantoAtivo, setCantoAtivo] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; t: string } | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Dados pesados ficam fora do estado (nao precisam re-renderizar).
  const originais = useRef<Partial<Record<Face, { img: Imagem; canvas: HTMLCanvasElement }>>>({})
  const rets = useRef<Partial<Record<Face, HTMLCanvasElement>>>({})
  const svgRef = useRef<SVGSVGElement | null>(null)
  const lupaRef = useRef<HTMLCanvasElement | null>(null)
  const arrasto = useRef<{ tipo: 'linha'; k: ChaveLinha; delta: number } | { tipo: 'canto'; i: number } | null>(null)
  const inputArquivo = useRef<HTMLInputElement | null>(null)
  const inputCamera = useRef<HTMLInputElement | null>(null)

  const e = estado[face]
  const atualizar = useCallback((f: Face, mud: Partial<EstadoFace> | ((s: EstadoFace) => Partial<EstadoFace>)) => {
    setEstado(prev => ({ ...prev, [f]: { ...prev[f], ...(typeof mud === 'function' ? mud(prev[f]) : mud) } }))
  }, [])

  // ── processamento ──

  /** Endireita pelos cantos e (se a carta tem moldura) procura a moldura. */
  const endireitar = useCallback(async (f: Face, cantos: Pt[], opts: { semMoldura: boolean; confExt?: number[]; linhasSalvas?: Linhas; aviso?: string; sugerirCantos?: boolean }) => {
    const orig = originais.current[f]
    if (!orig) return
    // Duas versoes: sem sobra para achar a moldura (o detector parte da borda do
    // canvas) e com MARGEM_MM de foto em volta para mostrar, lupa e imagem anotada.
    const ret = retificar(orig.img, cantos, PPM)
    const cv = retParaCanvas(retificar(orig.img, cantos, PPM, MARGEM_MM))
    rets.current[f] = cv
    const retUrl = await canvasParaUrl(cv)
    let linhas: Linhas, conf: Partial<Record<ChaveLinha, number>> = {}
    const ce = opts.confExt ?? [1, 1, 1, 1] // topo, dir, base, esq
    conf = { 'ext.topo': ce[0], 'ext.dir': ce[1], 'ext.base': ce[2], 'ext.esq': ce[3] }
    if (opts.linhasSalvas) {
      linhas = opts.linhasSalvas
    } else if (opts.semMoldura) {
      linhas = linhasPadrao()
      for (const l of LADOS) conf[`int.${l}`] = 0
    } else {
      const m = detectarMoldura(ret)
      linhas = linhasPadrao({ esq: m.esq.confianca > 0 ? m.esq.mm : null, dir: m.dir.confianca > 0 ? m.dir.mm : null, topo: m.topo.confianca > 0 ? m.topo.mm : null, base: m.base.confianca > 0 ? m.base.mm : null })
      for (const l of LADOS) conf[`int.${l}`] = m[l].confianca
    }
    atualizar(f, s => {
      if (s.retUrl) URL.revokeObjectURL(s.retUrl)
      return {
        etapa: 'linhas', cantos, retUrl, linhas, conf, semMoldura: opts.semMoldura,
        conferidas: opts.linhasSalvas ? [...ORDEM_LINHAS] : [],
        aviso: opts.aviso ?? '', sugerirCantos: !!opts.sugerirCantos,
      }
    })
    // Comeca pela primeira linha incerta.
    const incerta = ORDEM_LINHAS.find(k => (conf[k] ?? 0) < CONF_MIN)
    setAtiva(incerta ?? 'ext.esq')
    setLupaPos(null)
  }, [atualizar])

  const processar = useCallback(async (f: Face, fonte: Blob, midiaId: string | null) => {
    atualizar(f, { etapa: 'processando', aviso: '' })
    setMsg(null)
    // Deixa a tela pintar o "processando" antes da conta pesada.
    await new Promise(r => setTimeout(r, 40))
    try {
      const { img, canvas, url } = await carregarFoto(fonte)
      originais.current[f] = { img, canvas }
      const semMoldura = estado[f].semMoldura
      atualizar(f, s => {
        if (s.fotoUrl) URL.revokeObjectURL(s.fotoUrl)
        return { fotoUrl: url, midiaId, dims: [img.width, img.height] }
      })

      // Retomar a medida gravada quando e a mesma foto.
      const salva = salvas?.[f]
      if (salva && midiaId && salva.midia_id === midiaId && salva.img[0] > 0) {
        const k = img.width / salva.img[0]
        const cantos = salva.cantos.map(([x, y]) => [x * k, y * k] as Pt)
        await endireitar(f, cantos, { semMoldura: salva.sem_moldura, linhasSalvas: salva.linhas, aviso: 'Medida gravada carregada. Ajuste e salve de novo se precisar.' })
        return
      }

      const det = detectarCarta(img)
      if (!det.cantos || desvioDeRetangulo(det.cantos) > 0.35) {
        atualizar(f, {
          etapa: 'cantos', cantos: cantosPadrao(img.width, img.height),
          aviso: 'Não encontrei a carta inteira na foto. Arraste os 4 cantos até os cantos da carta e toque em Endireitar.',
        })
        setCantoAtivo(0)
        return
      }
      const fracos = det.confianca.filter(c => c < CONF_MIN).length
      await endireitar(f, det.cantos, {
        semMoldura, confExt: det.confianca, sugerirCantos: fracos > 0,
        aviso: fracos ? `${fracos === 1 ? 'Uma borda ficou incerta' : `${fracos} bordas ficaram incertas`}. Se a carta aparece cortada ou com sobra, ajuste os 4 cantos.` : '',
      })
    } catch (err) {
      console.error('[centralizacao]', err)
      atualizar(f, { etapa: 'erro', aviso: 'Não foi possível ler a imagem. Tente outra foto.' })
    }
  }, [atualizar, endireitar, estado, salvas])

  const abrirFotoPedido = useCallback(async (f: Face, op: FotoOpcao) => {
    atualizar(f, { etapa: 'processando', aviso: '' })
    try {
      const r = await fetch(op.url)
      if (!r.ok) throw new Error(String(r.status))
      await processar(f, await r.blob(), op.midiaId)
    } catch {
      atualizar(f, { etapa: 'erro', aviso: 'Não deu para baixar a foto do pedido. Recarregue a página (o link da foto vence em 10 minutos).' })
    }
  }, [atualizar, processar])

  // Abre sozinha a foto padrao do pedido em cada face, uma vez.
  const abertas = useRef<Partial<Record<Face, boolean>>>({})
  useEffect(() => {
    for (const f of FACES) {
      const op = fotos?.[f]?.[0]
      if (op && !abertas.current[f]) { abertas.current[f] = true; abrirFotoPedido(f, op) }
    }
  }, [fotos, abrirFotoPedido])

  // ── medida ──

  const medidas = useMemo(() => {
    const out: Partial<Record<Face, Medida>> = {}
    for (const f of FACES) if (estado[f].etapa === 'linhas') out[f] = medir(estado[f].linhas)
    return out
  }, [estado])
  const m = medidas[face]
  // Sem moldura, as linhas azuis nascem a 3 mm so como ponto de partida: confirmar
  // sem mover nenhuma gravaria um 50/50 inventado.
  const moldurasNoPadrao = (f: Face) => {
    const s = estado[f], p = linhasPadrao()
    return s.semMoldura && LADOS.some(l => s.linhas.int[l] === p.int[l])
  }
  const completa = (f: Face) => estado[f].etapa === 'linhas' && estado[f].conferidas.length === ORDEM_LINHAS.length && !moldurasNoPadrao(f)

  // ── arraste ──

  const pontoSvg = (ev: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY
    const q = p.matrixTransform(ctm.inverse())
    return { x: q.x, y: q.y }
  }

  const conferir = useCallback((f: Face, k: ChaveLinha) => {
    atualizar(f, s => (s.conferidas.includes(k) ? {} : { conferidas: [...s.conferidas, k] }))
  }, [atualizar])

  const iniciarLinha = (k: ChaveLinha) => (ev: React.PointerEvent) => {
    ev.preventDefault(); ev.stopPropagation()
    const p = pontoSvg(ev)
    if (!p) return
    svgRef.current?.setPointerCapture(ev.pointerId)
    const v = lerLinha(e.linhas, k)
    arrasto.current = { tipo: 'linha', k, delta: v - (ehVertical(k) ? p.x : p.y) }
    setAtiva(k)
    setLupaPos(ehVertical(k) ? { x: v, y: Math.max(0, Math.min(CARTA_MM.h, p.y)) } : { x: Math.max(0, Math.min(CARTA_MM.w, p.x)), y: v })
  }
  const iniciarCanto = (i: number) => (ev: React.PointerEvent) => {
    ev.preventDefault(); ev.stopPropagation()
    svgRef.current?.setPointerCapture(ev.pointerId)
    arrasto.current = { tipo: 'canto', i }
    setCantoAtivo(i)
  }
  const mover = (ev: React.PointerEvent) => {
    const a = arrasto.current
    if (!a) return
    const p = pontoSvg(ev)
    if (!p) return
    if (a.tipo === 'linha') {
      const alvo = (ehVertical(a.k) ? p.x : p.y) + a.delta
      atualizar(face, s => ({ linhas: moverLinha(s.linhas, a.k, alvo) }))
      const v = lerLinha(moverLinha(e.linhas, a.k, alvo), a.k)
      setLupaPos(ehVertical(a.k) ? { x: v, y: Math.max(0, Math.min(CARTA_MM.h, p.y)) } : { x: Math.max(0, Math.min(CARTA_MM.w, p.x)), y: v })
    } else {
      const [w, h] = e.dims
      const x = Math.max(0, Math.min(w, p.x)), y = Math.max(0, Math.min(h, p.y))
      atualizar(face, s => ({ cantos: s.cantos.map((c, i) => (i === a.i ? [x, y] as Pt : c)) }))
    }
  }
  const soltar = () => {
    const a = arrasto.current
    arrasto.current = null
    if (a?.tipo === 'linha') conferir(face, a.k)
  }

  const empurrar = useCallback((k: ChaveLinha, passo: number) => {
    atualizar(face, s => ({ linhas: moverLinha(s.linhas, k, lerLinha(s.linhas, k) + passo) }))
    conferir(face, k)
  }, [atualizar, conferir, face])

  // ── teclado ──
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return
      const k = ev.key
      if (k === 'f' || k === 'F') { setFace('frente'); return }
      if (k === 'v' || k === 'V') { setFace('verso'); return }
      if (k === 'z' || k === 'Z') { setLupa(x => !x); return }
      if (k === 'r' || k === 'R') { setModo(x => (x === 'regua' ? 'linhas' : 'regua')); return }
      if (e.etapa !== 'linhas') return
      if (k === 'Tab') {
        ev.preventDefault()
        const i = ORDEM_LINHAS.indexOf(ativa)
        setAtiva(ORDEM_LINHAS[(i + (ev.shiftKey ? ORDEM_LINHAS.length - 1 : 1)) % ORDEM_LINHAS.length])
        setLupaPos(null)
        return
      }
      if (k === 'Enter') { ev.preventDefault(); conferir(face, ativa); return }
      const passo = ev.shiftKey ? 1 : 0.1
      const vert = ehVertical(ativa)
      if ((vert && k === 'ArrowLeft') || (!vert && k === 'ArrowUp')) { ev.preventDefault(); empurrar(ativa, -passo) }
      if ((vert && k === 'ArrowRight') || (!vert && k === 'ArrowDown')) { ev.preventDefault(); empurrar(ativa, passo) }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [ativa, conferir, e.etapa, empurrar, face])

  // ── lupa ──
  useEffect(() => {
    const cv = lupaRef.current
    if (!cv || !lupa) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const S = cv.width
    ctx.fillStyle = cssVar('--bx-bg', '#080a0f'); ctx.fillRect(0, 0, S, S)
    const cExt = cssVar('--bx-amber', '#f59e0b'), cInt = cssVar('--bx-blue', '#60a5fa'), cMira = cssVar('--bx-text', '#f0f0f0')
    ctx.imageSmoothingEnabled = false
    if (e.etapa === 'linhas') {
      const src = rets.current[face]
      if (!src) return
      const v = lerLinha(e.linhas, ativa)
      const c = lupaPos ?? (ehVertical(ativa) ? { x: v, y: CARTA_MM.h / 2 } : { x: CARTA_MM.w / 2, y: v })
      const janela = 6 // mm visiveis
      const x0 = c.x - janela / 2, y0 = c.y - janela / 2
      const k = S / janela
      ctx.drawImage(src, (x0 + MARGEM_MM) * PPM, (y0 + MARGEM_MM) * PPM, janela * PPM, janela * PPM, 0, 0, S, S)
      for (const kk of ORDEM_LINHAS) {
        const val = lerLinha(e.linhas, kk)
        ctx.beginPath()
        if (ehVertical(kk)) { const x = (val - x0) * k; ctx.moveTo(x, 0); ctx.lineTo(x, S) }
        else { const y = (val - y0) * k; ctx.moveTo(0, y); ctx.lineTo(S, y) }
        ctx.strokeStyle = kk.startsWith('ext') ? cExt : cInt
        ctx.lineWidth = kk === ativa ? 2 : 1
        ctx.setLineDash(kk === ativa ? [] : [5, 4])
        ctx.stroke()
      }
      ctx.setLineDash([])
    } else if (e.etapa === 'cantos' && cantoAtivo != null && e.cantos[cantoAtivo]) {
      const src = originais.current[face]?.canvas
      if (!src) return
      const [cx, cy] = e.cantos[cantoAtivo]
      const janela = Math.max(40, e.dims[0] * 0.06)
      const k = S / janela
      ctx.drawImage(src, cx - janela / 2, cy - janela / 2, janela, janela, 0, 0, S, S)
      ctx.beginPath()
      e.cantos.forEach(([x, y], i) => { const px = (x - cx) * k + S / 2, py = (y - cy) * k + S / 2; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py) })
      ctx.closePath(); ctx.strokeStyle = cExt; ctx.lineWidth = 1.5; ctx.stroke()
    } else return
    // Mira no centro.
    ctx.strokeStyle = cMira; ctx.globalAlpha = 0.5; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(S / 2 - 8, S / 2); ctx.lineTo(S / 2 + 8, S / 2); ctx.moveTo(S / 2, S / 2 - 8); ctx.lineTo(S / 2, S / 2 + 8); ctx.stroke()
    ctx.globalAlpha = 1
  }, [lupa, lupaPos, ativa, e.etapa, e.linhas, e.cantos, e.dims, cantoAtivo, face, e.retUrl])

  // ── acoes ──

  const escolherArquivo = (f: Face, file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg({ tipo: 'erro', t: 'Envie uma imagem (JPG, PNG, WEBP ou HEIC).' }); return }
    processar(f, file, null)
  }

  const alternarSemMoldura = (v: boolean) => {
    atualizar(face, { semMoldura: v })
    const confExt = (['topo', 'dir', 'base', 'esq'] as Lado[]).map(l => e.conf[`ext.${l}`] ?? 1)
    if (e.etapa === 'linhas') endireitar(face, e.cantos, { semMoldura: v, confExt, aviso: v ? 'Modo sem moldura: posicione as 4 linhas azuis na referência interna (o limite da arte, por exemplo).' : '' })
  }

  const resultados = useCallback((): Partial<Record<Face, ResultadoFace>> => {
    const out: Partial<Record<Face, ResultadoFace>> = {}
    for (const f of FACES) {
      const s = estado[f], md = medidas[f]
      const ret = rets.current[f]
      if (!completa(f) || !md || !ret) continue
      out[f] = {
        texto: textoDoLaudo(md),
        medicao: {
          cantos: s.cantos.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as Pt),
          img: s.dims, linhas: s.linhas, sem_moldura: s.semMoldura, midia_id: s.midiaId, medido_em: new Date().toISOString(),
        },
        imagem: () => gerarAnotada(ret, s.linhas, md, f, rodapeImagem),
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, medidas, rodapeImagem])

  const salvar = async () => {
    if (!onSalvar) return
    const r = resultados()
    if (!Object.keys(r).length) return
    setSalvando(true); setMsg(null)
    try {
      const erro = await onSalvar(r)
      setMsg(erro ? { tipo: 'erro', t: erro } : { tipo: 'ok', t: `Salvo no laudo em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.` })
    } finally { setSalvando(false) }
  }

  const baixar = async (f: Face) => {
    const r = resultados()[f]
    if (!r) return
    const blob = await r.imagem()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `centralizacao-${f}.jpg`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const copiar = async () => {
    const linhas = FACES.filter(f => medidas[f]).map(f => `${ROTULO_FACE[f]}: ${textoDoLaudo(medidas[f]!)}`)
    try { await navigator.clipboard.writeText(linhas.join('\n')); setMsg({ tipo: 'ok', t: 'Medida copiada.' }) }
    catch { setMsg({ tipo: 'erro', t: 'Não deu para copiar. Selecione o texto à mão.' }) }
  }

  // ── render ──

  const opcoesFoto = fotos?.[face] || []
  const prontas = FACES.filter(completa)
  const pendentesFace = FACES.filter(f => estado[f].etapa === 'linhas' && !completa(f))
  const podeSalvar = prontas.length > 0 && pendentesFace.length === 0 && !salvando
  const regua = m ? leituraRegua(m) : null

  // A lupa fica no canto oposto ao ponto que esta sendo medido, para nao cobri-lo.
  const posLupa = (() => {
    let fx = 0.5, fy = 0.5
    if (e.etapa === 'linhas') {
      const v = lerLinha(e.linhas, ativa)
      const p = lupaPos ?? (ehVertical(ativa) ? { x: v, y: CARTA_MM.h / 2 } : { x: CARTA_MM.w / 2, y: v })
      fx = p.x / CARTA_MM.w; fy = p.y / CARTA_MM.h
      // Alcas: externas em cima/esquerda, internas embaixo/direita.
      if (ehVertical(ativa)) fy = ativa.startsWith('ext') ? 0 : 1
      else fx = ativa.startsWith('ext') ? 0 : 1
    } else if (cantoAtivo != null && e.cantos[cantoAtivo] && e.dims[0]) {
      fx = e.cantos[cantoAtivo][0] / e.dims[0]; fy = e.cantos[cantoAtivo][1] / e.dims[1]
    }
    const m8 = 10
    return { ...(fx > 0.5 ? { left: m8 } : { right: m8 }), ...(fy > 0.5 ? { top: m8 } : { bottom: m8 }) }
  })()

  return (
    <div className="mc">
      <style>{CSS}</style>
      <div className="mc-topo">
        <div>
          <h1>{titulo}</h1>
          {subtitulo && <p className="mc-muted">{subtitulo}</p>}
        </div>
        <div className="mc-faces" role="tablist">
          {FACES.map(f => (
            <button key={f} type="button" role="tab" aria-selected={face === f} className={`mc-face${face === f ? ' on' : ''}`} onClick={() => setFace(f)}>
              {ROTULO_FACE[f]}{completa(f) && <IconCheck size={14} />}
            </button>
          ))}
        </div>
      </div>

      {/* No celular, enquanto houver linha a conferir, o ajuste vem antes das graduadoras. */}
      <div className={`mc-grid${pendentesFace.length ? ' mc-conferindo' : ''}`}>
        {/* ── palco ── */}
        <div className="mc-palco">
          {e.etapa === 'vazio' && (
            <div className="mc-vazio">
              <IconCamera size={28} />
              <b>Foto da {ROTULO_FACE[face].toLowerCase()} da carta</b>
              <span>De cima, carta fora do sleeve, fundo liso que contraste com a borda, sem reflexo.</span>
              <div className="mc-bts">
                <button type="button" className="mc-bt mc-bt-pri" onClick={() => inputArquivo.current?.click()}><IconUpload size={15} /> Enviar foto</button>
                <button type="button" className="mc-bt" onClick={() => inputCamera.current?.click()}><IconCamera size={15} /> Tirar foto</button>
              </div>
            </div>
          )}
          {e.etapa === 'processando' && (
            <div className="mc-vazio"><span className="mc-spin" aria-hidden /> <b>Encontrando as bordas...</b></div>
          )}
          {e.etapa === 'erro' && (
            <div className="mc-vazio"><IconWarning size={24} /><b>{e.aviso}</b>
              <button type="button" className="mc-bt" onClick={() => inputArquivo.current?.click()}><IconUpload size={15} /> Outra foto</button>
            </div>
          )}

          {e.etapa === 'cantos' && (
            <svg ref={svgRef} className="mc-svg" viewBox={`${-e.dims[0] * 0.03} ${-e.dims[1] * 0.03} ${e.dims[0] * 1.06} ${e.dims[1] * 1.06}`}
              onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
              <image href={e.fotoUrl} x={0} y={0} width={e.dims[0]} height={e.dims[1]} />
              <polygon points={e.cantos.map(c => c.join(',')).join(' ')} fill="none" stroke="var(--bx-bg)" strokeWidth={5} vectorEffect="non-scaling-stroke" />
              <polygon points={e.cantos.map(c => c.join(',')).join(' ')} fill="none" stroke="var(--bx-amber)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {e.cantos.map(([x, y], i) => {
                const r = e.dims[0] * 0.014
                return (
                  <g key={i} onPointerDown={iniciarCanto(i)} className="mc-alca">
                    <circle cx={x} cy={y} r={r * 4} fill="transparent" />
                    <circle cx={x} cy={y} r={r} fill={cantoAtivo === i ? 'var(--bx-amber)' : 'var(--bx-bg)'} stroke="var(--bx-amber)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </g>
                )
              })}
            </svg>
          )}

          {e.etapa === 'linhas' && (
            <svg ref={svgRef} className="mc-svg" viewBox="-12 -12 87 112" onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
              <image href={e.retUrl} x={-MARGEM_MM} y={-MARGEM_MM} width={CARTA_MM.w + 2 * MARGEM_MM} height={CARTA_MM.h + 2 * MARGEM_MM} preserveAspectRatio="none" />
              {modo === 'regua' && <Regua l={e.linhas} />}
              {modo !== 'foto' && ORDEM_LINHAS.map(k => (
                <LinhaSvg key={k} k={k} v={lerLinha(e.linhas, k)} ativa={k === ativa}
                  conferida={e.conferidas.includes(k)} incerta={(e.conf[k] ?? 0) < CONF_MIN}
                  onDown={iniciarLinha(k)} />
              ))}
            </svg>
          )}

          {lupa && (e.etapa === 'linhas' || (e.etapa === 'cantos' && cantoAtivo != null)) && (
            <canvas ref={lupaRef} className="mc-lupa" width={180} height={180} aria-label="Lupa" style={posLupa} />
          )}

          <input ref={inputArquivo} type="file" accept="image/*" hidden onChange={ev => { escolherArquivo(face, ev.target.files?.[0]); ev.target.value = '' }} />
          <input ref={inputCamera} type="file" accept="image/*" capture="environment" hidden onChange={ev => { escolherArquivo(face, ev.target.files?.[0]); ev.target.value = '' }} />
        </div>

        {/* ── graduadoras, embaixo da carta ── */}
        <div className="mc-grads">
          <EscadasGraduadoras
            frente={medidas.frente ?? null}
            verso={medidas.verso ?? null}
            previa={FACES.some(f => estado[f].etapa === 'linhas' && !completa(f))}
            onMedir={f => { setFace(f); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          />
        </div>

        {/* ── painel ── */}
        <aside className="mc-painel">
          {e.aviso && (
            <div className="mc-aviso">
              <IconWarning size={15} />
              <div>
                <p>{e.aviso}</p>
                {e.sugerirCantos && e.etapa === 'linhas' && (
                  <button type="button" className="mc-bt mc-bt-aviso" onClick={() => { atualizar(face, { etapa: 'cantos', sugerirCantos: false }); setCantoAtivo(0) }}>Ajustar os 4 cantos</button>
                )}
              </div>
            </div>
          )}

          {(opcoesFoto.length > 0 || e.etapa !== 'vazio') && (
            <div className="mc-bloco mc-bloco-foto">
              <span className="mc-h">Foto</span>
              <div className="mc-bts">
                {opcoesFoto.map(op => (
                  <button key={op.midiaId} type="button" className={`mc-chip${e.midiaId === op.midiaId ? ' on' : ''}`} onClick={() => abrirFotoPedido(face, op)}>{op.rotulo}</button>
                ))}
                <button type="button" className="mc-chip" onClick={() => inputArquivo.current?.click()}><IconUpload size={13} /> Enviar</button>
                <button type="button" className="mc-chip" onClick={() => inputCamera.current?.click()}><IconCamera size={13} /> Câmera</button>
              </div>
              <label className="mc-check">
                <input type="checkbox" checked={e.semMoldura} onChange={ev => alternarSemMoldura(ev.target.checked)} />
                Carta sem moldura (full art, alt art): marco a referência interna à mão
              </label>
            </div>
          )}

          {e.etapa === 'cantos' && (
            <div className="mc-bloco">
              <span className="mc-h">Cantos da carta</span>
              <p className="mc-muted">Arraste os 4 pontos até os cantos do papel. Em canto arredondado, use o ponto onde as duas bordas retas se cruzariam.</p>
              <button type="button" className="mc-bt mc-bt-pri" onClick={() => endireitar(face, e.cantos, { semMoldura: e.semMoldura, aviso: '' })}>Endireitar</button>
            </div>
          )}

          {e.etapa === 'linhas' && m && (
            <>
              <div className="mc-bloco">
                <div className="mc-ativa">
                  <span className={`mc-dot ${ativa.startsWith('ext') ? 'ext' : 'int'}`} aria-hidden />
                  <b>{NOME_LINHA[ativa]}</b>
                  {(e.conf[ativa] ?? 0) < CONF_MIN && !e.conferidas.includes(ativa) && <span className="mc-incerta">incerta</span>}
                </div>
                <div className="mc-nudge">
                  <button type="button" className="mc-bt" aria-label="Mover 0,1 mm para trás" onClick={() => empurrar(ativa, -0.1)}><IconChevronLeft size={16} /></button>
                  <button type="button" className="mc-bt" onClick={() => conferir(face, ativa)}>{e.conferidas.includes(ativa) ? <><IconCheck size={14} /> Conferida</> : 'Confirmar'}</button>
                  <button type="button" className="mc-bt" aria-label="Mover 0,1 mm para frente" onClick={() => empurrar(ativa, 0.1)}><IconChevronRight size={16} /></button>
                  <button type="button" className="mc-bt" onClick={() => { const i = ORDEM_LINHAS.indexOf(ativa); setAtiva(ORDEM_LINHAS[(i + 1) % ORDEM_LINHAS.length]); setLupaPos(null) }}>Próxima</button>
                </div>
                <p className="mc-muted mc-conta">{e.conferidas.length} de {ORDEM_LINHAS.length} conferidas · setas movem 0,1 mm (Shift, 1 mm) · Tab troca · Enter confirma</p>
              </div>

              <div className="mc-bloco">
                <Eixo rotulo="Laterais (esquerda / direita)" a={m.mm.esq} b={m.mm.dir} texto={m.lr.texto} />
                <Eixo rotulo="Topo / base" a={m.mm.topo} b={m.mm.base} texto={m.tb.texto} />
                {modo === 'regua' && regua && (
                  <p className="mc-muted">Régua de 0,5 mm: esquerda na linha {regua.esq}, direita na {regua.dir}, topo na {regua.topo}, base na {regua.base}.</p>
                )}
              </div>

            </>
          )}

          <div className="mc-bloco">
            <div className="mc-bts">
              {(['linhas', 'regua', 'foto'] as const).map(x => (
                <button key={x} type="button" className={`mc-chip${modo === x ? ' on' : ''}`} onClick={() => setModo(x)}>
                  {x === 'linhas' ? 'Linhas' : x === 'regua' ? 'Régua' : 'Só foto'}
                </button>
              ))}
              <button type="button" className={`mc-chip${lupa ? ' on' : ''}`} onClick={() => setLupa(v => !v)}>Lupa</button>
            </div>
            {e.etapa === 'linhas' && (
              <div className="mc-bts">
                <button type="button" className="mc-bt" onClick={() => atualizar(face, { etapa: 'cantos' })}>Ajustar cantos</button>
                <button type="button" className="mc-bt" onClick={() => {
                  const o = originais.current[face]
                  if (!o) return
                  const det = detectarCarta(o.img)
                  if (det.cantos) endireitar(face, det.cantos, { semMoldura: e.semMoldura, confExt: det.confianca })
                }}>Detectar de novo</button>
              </div>
            )}
          </div>

          <div className="mc-acoes">
            {msg && <p className={msg.tipo === 'ok' ? 'mc-ok' : 'mc-erro'}>{msg.tipo === 'ok' && <IconCheck size={14} />} {msg.t}</p>}
            {onSalvar ? (
              <>
                <button type="button" className="mc-bt mc-bt-pri" disabled={!podeSalvar} onClick={salvar}>
                  {salvando ? 'Salvando...' : salvarRotulo || 'Salvar no laudo'}
                </button>
                {!podeSalvar && !salvando && (
                  <p className="mc-muted">
                    {pendentesFace.some(moldurasNoPadrao)
                      ? 'No modo sem moldura, mova as 4 linhas azuis até a referência interna antes de salvar.'
                      : pendentesFace.length
                      ? `Confira as 8 linhas ${pendentesFace.length === 2 ? 'das duas faces' : `da ${ROTULO_FACE[pendentesFace[0]].toLowerCase()}`} para salvar.`
                      : 'Meça pelo menos uma face para salvar.'}
                  </p>
                )}
              </>
            ) : (
              <div className="mc-bts">
                {FACES.filter(completa).map(f => (
                  <button key={f} type="button" className="mc-bt" onClick={() => baixar(f)}><IconDownload size={14} /> Imagem da {ROTULO_FACE[f].toLowerCase()}</button>
                ))}
                {FACES.some(f => medidas[f]) && <button type="button" className="mc-bt" onClick={copiar}><IconCopy size={14} /> Copiar medida</button>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── pecas ────────────────────────────────────────────────────────────────────

function LinhaSvg({ k, v, ativa, conferida, incerta, onDown }: {
  k: ChaveLinha; v: number; ativa: boolean; conferida: boolean; incerta: boolean; onDown: (ev: React.PointerEvent) => void
}) {
  const vert = ehVertical(k), ext = k.startsWith('ext')
  const cor = ext ? 'var(--bx-amber)' : 'var(--bx-blue)'
  // Alcas fora da carta, em margens opostas para externa e interna nao se tocarem.
  const ax = vert ? v : ext ? -9.5 : CARTA_MM.w + 9.5
  const ay = vert ? (ext ? -9.5 : CARTA_MM.h + 9.5) : v
  const pts = vert ? { x1: v, y1: -11, x2: v, y2: CARTA_MM.h + 11 } : { x1: -11, y1: v, x2: CARTA_MM.w + 11, y2: v }
  return (
    <g className="mc-linha" onPointerDown={onDown}>
      <line {...pts} stroke="transparent" strokeWidth={2.2} />
      <line {...pts} stroke="var(--bx-bg)" strokeWidth={ativa ? 4 : 3} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <line {...pts} stroke={cor} strokeWidth={ativa ? 2 : 1.25} strokeDasharray={ativa ? undefined : '5 4'} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      <circle cx={ax} cy={ay} r={4.2} fill="transparent" className="mc-alca" />
      <circle cx={ax} cy={ay} r={ativa ? 2.3 : 1.9} fill={conferida ? cor : 'var(--bx-bg)'} stroke={cor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
      {incerta && !conferida && (
        <text x={ax} y={ay + 0.75} textAnchor="middle" fontSize={2.4} fontWeight={800} fill="var(--bx-text)" pointerEvents="none">?</text>
      )}
    </g>
  )
}

/** Molduras a cada 0,5 mm a partir da borda do papel; impares cheias, pares tracejadas. */
function Regua({ l }: { l: Linhas }) {
  const w = l.ext.dir - l.ext.esq, h = l.ext.base - l.ext.topo
  return (
    <g pointerEvents="none" opacity={0.75}>
      {Array.from({ length: REGUA_LINHAS }, (_, i) => {
        const n = i + 1, d = n * REGUA_PASSO_MM
        return (
          <g key={n}>
            <rect x={l.ext.esq + d} y={l.ext.topo + d} width={w - 2 * d} height={h - 2 * d} fill="none"
              stroke="var(--bx-text-2)" strokeWidth={0.6} strokeDasharray={n % 2 ? undefined : '2 2'} vectorEffect="non-scaling-stroke" />
            {n % 2 === 0 && (
              <text x={l.ext.esq + d} y={l.ext.topo + h / 2 + (n % 4 ? 2.4 : -1.2)} fontSize={1.6} fill="var(--bx-text)" textAnchor="middle">{n}</text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function Eixo({ rotulo, a, b, texto }: { rotulo: string; a: number; b: number; texto: string }) {
  const pa = (100 * a) / (a + b)
  return (
    <div className="mc-eixo">
      <div className="mc-eixo-t"><span>{rotulo}</span><b>{texto}</b></div>
      <div className="mc-barra" aria-hidden>
        <span style={{ width: `${pa}%` }} />
        <i style={{ left: '45%' }} /><i style={{ left: '55%' }} />
      </div>
      <div className="mc-eixo-mm"><span>{fmtMm(a)}</span><span>{fmtMm(b)}</span></div>
    </div>
  )
}

const CSS = `
.mc{width:100%;font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text)}
.mc-topo{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:14px}
.mc-topo h1{font-size:24px;font-weight:800;letter-spacing:-0.03em;margin:0 0 4px}
.mc-muted{font-size:12.5px;color:var(--bx-text-3);margin:0;line-height:1.5}
.mc-faces{display:flex;gap:6px}
.mc-face{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text-2);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.mc-face.on{background:rgba(var(--ac-1-rgb),.14);border-color:rgba(var(--ac-1-rgb),.5);color:var(--bx-text)}
.mc-face svg{color:var(--bx-green)}
.mc-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;grid-template-areas:"palco painel" "grads painel";gap:16px;align-items:start}
.mc-palco{grid-area:palco}
.mc-grads{grid-area:grads;min-width:0}
.mc-painel{grid-area:painel}
.mc-palco{position:relative;border:1px solid var(--bx-border);border-radius:14px;background:var(--bx-bg-elev);overflow:hidden;min-height:420px;display:flex;align-items:center;justify-content:center}
.mc-svg{display:block;width:100%;height:auto;max-height:82vh;touch-action:none;user-select:none;-webkit-user-select:none}
.mc-linha{cursor:grab}
.mc-alca{cursor:grab}
.mc-lupa{position:absolute;width:180px;height:180px;border-radius:12px;border:1px solid var(--bx-border-2);box-shadow:0 10px 30px rgba(0,0,0,.5);pointer-events:none}
.mc-vazio{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:40px 20px;color:var(--bx-text-2);font-size:13.5px;max-width:360px}
.mc-vazio b{color:var(--bx-text);font-size:15px}
.mc-spin{width:22px;height:22px;border-radius:999px;border:2px solid var(--bx-border-2);border-top-color:var(--ac-1);animation:mc-gira .8s linear infinite}
@keyframes mc-gira{to{transform:rotate(360deg)}}
.mc-painel{display:grid;gap:12px}
.mc-bloco{display:grid;gap:10px;padding:14px;border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.mc-h{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.mc-bts{display:flex;flex-wrap:wrap;gap:6px}
.mc-bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.mc-bt:hover:not(:disabled){background:var(--bx-surface-3)}
.mc-bt:disabled{opacity:.45;cursor:not-allowed}
.mc-bt-pri{background:var(--bx-brand);border-color:transparent;color:var(--bx-brand-ink)}
.mc-bt-pri:hover:not(:disabled){background:var(--bx-brand);filter:brightness(1.06)}
.mc-chip{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}
.mc-chip.on{background:rgba(var(--ac-1-rgb),.14);border-color:rgba(var(--ac-1-rgb),.5);color:var(--bx-text)}
.mc-check{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:var(--bx-text-2);line-height:1.45;cursor:pointer}
.mc-check input{margin-top:2px;accent-color:var(--ac-1)}
.mc-aviso{display:flex;gap:8px;align-items:flex-start;margin:0;padding:10px 12px;border-radius:10px;font-size:12.5px;line-height:1.5;color:var(--bx-text);background:color-mix(in srgb,var(--bx-amber) 10%,transparent);border:1px solid color-mix(in srgb,var(--bx-amber) 35%,transparent)}
.mc-aviso svg{flex:none;margin-top:1px;color:var(--bx-amber)}
.mc-aviso p{margin:0}
.mc-aviso > div{display:grid;gap:8px}
.mc-bt-aviso{justify-self:start;min-height:36px;border-color:color-mix(in srgb,var(--bx-amber) 45%,transparent)}
.mc-ativa{display:flex;align-items:center;gap:8px;font-size:14px}
.mc-dot{width:10px;height:10px;border-radius:999px}
.mc-dot.ext{background:var(--bx-amber)}
.mc-dot.int{background:var(--bx-blue)}
.mc-incerta{font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;color:var(--bx-amber);background:color-mix(in srgb,var(--bx-amber) 12%,transparent)}
.mc-nudge{display:grid;grid-template-columns:44px minmax(0,1fr) 44px auto;gap:6px}
.mc-nudge .mc-bt{padding:0 8px}
.mc-conta{font-variant-numeric:tabular-nums}
.mc-eixo{display:grid;gap:6px}
.mc-eixo-t{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12.5px;color:var(--bx-text-2)}
.mc-eixo-t b{font-size:22px;font-weight:800;color:var(--bx-text);font-variant-numeric:tabular-nums;letter-spacing:-0.02em}
.mc-barra{position:relative;height:8px;border-radius:999px;background:var(--bx-surface-2);overflow:hidden}
.mc-barra span{position:absolute;left:0;top:0;bottom:0;background:var(--ac-1);transition:width .15s ease}
.mc-barra i{position:absolute;top:0;bottom:0;width:1px;background:var(--bx-text-3)}
.mc-eixo-mm{display:flex;justify-content:space-between;font-size:12px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.mc-acoes{display:grid;gap:8px}
.mc-acoes > .mc-bt{min-height:46px;font-size:14px}
.mc-ok{display:flex;align-items:center;gap:6px;margin:0;font-size:13px;color:var(--bx-green)}
.mc-erro{margin:0;font-size:13px;color:var(--bx-red)}
@media (max-width:900px){
  .mc-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"palco" "grads" "painel"}
  .mc-grid.mc-conferindo{grid-template-areas:"palco" "painel" "grads"}
  .mc-svg{max-height:68vh}
  .mc-lupa{width:120px;height:120px}
  .mc-palco{min-height:300px}
  /* No celular, a linha ativa e o resultado vem logo abaixo da foto; trocar de foto fica depois. */
  .mc-bloco-foto{order:5}
}
@media (prefers-reduced-motion:reduce){.mc *{transition:none!important;animation:none!important}}
`
