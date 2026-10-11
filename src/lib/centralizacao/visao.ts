// Visao da ferramenta de centralizacao: acha a carta na foto, endireita e acha
// a moldura. Modulo puro (sem React, sem DOM alem do formato ImageData), para
// o admin hoje e a previa do app depois usarem o mesmo nucleo.
//
// ★ Tudo aqui e SUGESTAO. Foto real com fundo escuro ja enganou a borda de
//   baixo em 2 a 4 mm no prototipo; quem fecha a medida e o ajuste a mao.
// ★ Carta full art nao tem moldura: o detector acha "alguma coisa" na arte com
//   confianca media. Por isso existe o modo sem moldura (linhas internas a mao).

export const CARTA_MM = { w: 63, h: 88 }

export type Pt = [number, number]
export type Imagem = { width: number; height: number; data: Uint8ClampedArray }
export type Retificada = Imagem & { pxPorMm: number }
type Reta = [number, number, number]

// ── utilitarios ──────────────────────────────────────────────────────────────

/** Reduz por media de blocos. `s` e o fator (original / reduzida). */
export function reduzir(img: Imagem, maxLado: number): { img: Imagem; s: number } {
  const s = Math.max(1, Math.max(img.width, img.height) / maxLado)
  const w = Math.round(img.width / s), h = Math.round(img.height / s)
  const out = new Uint8ClampedArray(w * h * 4)
  const src = img.data, W = img.width
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * s), y1 = Math.min(img.height, Math.max(y0 + 1, Math.floor((y + 1) * s)))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * s), x1 = Math.min(W, Math.max(x0 + 1, Math.floor((x + 1) * s)))
      let r = 0, g = 0, b = 0, n = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const o = (yy * W + xx) * 4; r += src[o]; g += src[o + 1]; b += src[o + 2]; n++
      }
      const o = (y * w + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255
    }
  }
  return { img: { width: w, height: h, data: out }, s: img.width / w }
}

function borrar(f: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w
    for (let x = -r; x <= r; x++) acc += f[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1)
      acc += f[row + Math.min(w - 1, x + r + 1)] - f[row + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1)
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

/** Cor bilinear em coordenada continua. */
function amostrar(img: Imagem, x: number, y: number, out: number[]) {
  const { width: w, height: h, data } = img
  if (x < 0) x = 0; if (y < 0) y = 0
  if (x > w - 1.001) x = w - 1.001; if (y > h - 1.001) y = h - 1.001
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0
  const o00 = (y0 * w + x0) * 4, o10 = o00 + 4, o01 = o00 + w * 4, o11 = o01 + 4
  for (let c = 0; c < 3; c++) {
    out[c] = (data[o00 + c] * (1 - fx) + data[o10 + c] * fx) * (1 - fy) + (data[o01 + c] * (1 - fx) + data[o11 + c] * fx) * fy
  }
  return out
}

/** Reta por minimos quadrados totais, com rejeicao iterativa de pontos fora. */
function ajustarReta(pts: Pt[]) {
  let usados = pts.slice(); let linha: Reta | null = null; let rms = 0
  for (let it = 0; it < 4; it++) {
    if (usados.length < 5) break
    let mx = 0, my = 0
    for (const p of usados) { mx += p[0]; my += p[1] }
    mx /= usados.length; my /= usados.length
    let sxx = 0, syy = 0, sxy = 0
    for (const p of usados) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy)
    const nx = -Math.sin(ang), ny = Math.cos(ang), c = -(nx * mx + ny * my)
    const reta: Reta = [nx, ny, c]
    linha = reta
    const res = pts.map(p => Math.abs(nx * p[0] + ny * p[1] + c))
    const ord = res.slice().sort((a, b) => a - b)
    const tol = Math.max(1, 2.5 * ord[ord.length >> 1] * 1.4826)
    usados = pts.filter((_, i) => res[i] <= tol)
    rms = Math.sqrt(usados.reduce((s, p) => s + (nx * p[0] + ny * p[1] + c) ** 2, 0) / Math.max(1, usados.length))
  }
  return { linha, dentro: usados.length, rms }
}

const cruzar = (a: Reta, b: Reta): Pt => {
  const d = a[0] * b[1] - a[1] * b[0]
  return [(a[1] * b[2] - a[2] * b[1]) / d, (a[2] * b[0] - a[0] * b[2]) / d]
}

// ── (a) achar a carta ────────────────────────────────────────────────────────

export type CartaDetectada = {
  /** TL, TR, BR, BL na foto original. null se nao achou nada que pareca carta. */
  cantos: Pt[] | null
  /** Por lado: topo, direita, base, esquerda. 0 a 1. */
  confianca: number[]
  /** Lado deduzido pela proporcao 63x88 (sem borda visivel na foto). */
  inferido: boolean[]
  ms: number
}

type Pico = { th: number; rho: number; v: number; virtual?: boolean }

export function detectarCarta(img: Imagem, opts: { ladoDeteccao?: number } = {}): CartaDetectada {
  const t0 = performance.now()
  const { img: sm, s } = reduzir(img, opts.ladoDeteccao ?? 500)
  const { width: w, height: h, data } = sm

  // Sobel por canal; vale o canal de maior magnitude (borda de cor, nao so de brilho).
  const gx = new Float32Array(w * h), gy = new Float32Array(w * h), mag = new Float32Array(w * h)
  const canais = [0, 1, 2].map(c => {
    const f = new Float32Array(w * h)
    for (let i = 0; i < w * h; i++) f[i] = data[i * 4 + c]
    return borrar(borrar(f, w, h, 1), w, h, 1)
  })
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let bm = -1, bx = 0, by = 0
    for (const f of canais) {
      const sx = f[i - w + 1] + 2 * f[i + 1] + f[i + w + 1] - f[i - w - 1] - 2 * f[i - 1] - f[i + w - 1]
      const sy = f[i + w - 1] + 2 * f[i + w] + f[i + w + 1] - f[i - w - 1] - 2 * f[i - w] - f[i - w + 1]
      const m = sx * sx + sy * sy
      if (m > bm) { bm = m; bx = sx; by = sy }
    }
    gx[i] = bx; gy[i] = by; mag[i] = Math.sqrt(bm)
  }

  // So o quarto mais forte das bordas vota.
  const amostra: number[] = []
  for (let i = 0; i < w * h; i += 7) amostra.push(mag[i])
  amostra.sort((a, b) => a - b)
  const corte = amostra[Math.floor(amostra.length * 0.75)]

  // Hough (theta, rho), voto restrito a orientacao do gradiente. theta em [-45, 135) graus.
  const TB = 180, dT = Math.PI / TB, T0 = -Math.PI / 4, RQ = 2
  const diag = Math.ceil(Math.hypot(w, h) / RQ), RB = 2 * diag + 1
  const acc = new Float32Array(TB * RB)
  const cosT = new Float32Array(TB), sinT = new Float32Array(TB)
  for (let t = 0; t < TB; t++) { cosT[t] = Math.cos(T0 + t * dT); sinT[t] = Math.sin(T0 + t * dT) }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    if (mag[i] < corte) continue
    let phi = Math.atan2(gy[i], gx[i])
    while (phi < T0) phi += Math.PI
    while (phi >= T0 + Math.PI) phi -= Math.PI
    const tc = Math.round((phi - T0) / dT)
    for (let dt = -2; dt <= 2; dt++) {
      const t = (tc + dt + TB) % TB
      acc[t * RB + Math.round((x * cosT[t] + y * sinT[t]) / RQ) + diag] += 1
    }
  }

  // Picos (supressao de nao-maximos 7x7).
  const picos: Pico[] = []
  for (let t = 0; t < TB; t++) for (let r = 0; r < RB; r++) {
    const v = acc[t * RB + r]
    if (v < Math.min(w, h) * 0.05) continue
    let ok = true
    for (let a = -3; a <= 3 && ok; a++) for (let b = -3; b <= 3; b++) {
      if (!a && !b) continue
      const tt = (t + a + TB) % TB, rr = r + b
      if (rr < 0 || rr >= RB) continue
      if (acc[tt * RB + rr] > v) { ok = false; break }
    }
    if (ok) picos.push({ th: T0 + t * dT, rho: (r - diag) * RQ, v })
  }
  // Inclinacao dominante: histograma da orientacao do gradiente modulo 90 graus,
  // pesado pela forca. Carta girada (foto de celular a mao) deixa de exigir
  // borda perto da vertical: as duas familias de retas ficam em torno de
  // theta0 e theta0 + 90 graus. Continua assumindo carta em pe (giro ate 45).
  const NB = 90, histo = new Float32Array(NB)
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    if (mag[i] < corte) continue
    let a = Math.atan2(gy[i], gx[i]) % (Math.PI / 2)
    if (a < 0) a += Math.PI / 2
    histo[Math.floor((a / (Math.PI / 2)) * NB) % NB] += mag[i]
  }
  let pico0 = 0
  for (let b = 0; b < NB; b++) {
    const v3 = histo[(b + NB - 1) % NB] + histo[b] + histo[(b + 1) % NB]
    const m3 = histo[(pico0 + NB - 1) % NB] + histo[pico0] + histo[(pico0 + 1) % NB]
    if (v3 > m3) pico0 = b
  }
  let theta0 = ((pico0 + 0.5) / NB) * (Math.PI / 2)
  if (theta0 >= Math.PI / 4) theta0 -= Math.PI / 2
  // Traz a reta para perto do centro da familia (theta e theta+pi sao a mesma reta com rho trocado).
  const perto = (p: Pico, centro: number): Pico => {
    let { th, rho } = p
    while (th - centro > Math.PI / 2) { th -= Math.PI; rho = -rho }
    while (centro - th > Math.PI / 2) { th += Math.PI; rho = -rho }
    return { ...p, th, rho }
  }
  const vert = picos.map(p => perto(p, theta0)).filter(p => Math.abs(p.th - theta0) < 0.44).sort((a, b) => b.v - a.v).slice(0, 30)
  const horz = picos.map(p => perto(p, theta0 + Math.PI / 2)).filter(p => Math.abs(p.th - theta0 - Math.PI / 2) < 0.44).sort((a, b) => b.v - a.v).slice(0, 30)
  const reta = (p: Pico): Reta => [Math.cos(p.th), Math.sin(p.th), -p.rho]

  // Combinacoes: 2 verticais + 2 horizontais com proporcao perto de 88/63.
  // Um lado pode faltar (carta escura em fundo escuro): vira lado VIRTUAL,
  // paralelo ao oposto, na distancia que a proporcao manda.
  type Combo = { q: Pt[]; score: number; area: number; inferido: boolean[] }
  const combos: Combo[] = []
  const PROP = 88 / 63
  const virtual = (p: Pico, par: Pico[], sinal: number, vertical: boolean): Pico => {
    const L = reta(p), i1 = cruzar(L, reta(par[0])), i2 = cruzar(L, reta(par[1]))
    const comp = Math.hypot(i1[0] - i2[0], i1[1] - i2[1]) * (vertical ? 1 / PROP : PROP)
    return { th: p.th, rho: p.rho + sinal * comp, v: 0, virtual: true }
  }
  const avaliar = (V: Pico[], Hz: Pico[]) => {
    if (Math.abs(V[0].th - V[1].th) > 0.14 || Math.abs(Hz[0].th - Hz[1].th) > 0.14) return
    const Ls = V.slice().sort((p, q) => p.rho / Math.cos(p.th) - q.rho / Math.cos(q.th))
    const Hs = Hz.slice().sort((p, q) => p.rho / Math.sin(p.th) - q.rho / Math.sin(q.th))
    const Ln = [reta(Hs[0]), reta(Ls[1]), reta(Hs[1]), reta(Ls[0])] // topo, dir, base, esq
    const q = [0, 1, 2, 3].map(k => cruzar(Ln[(k + 3) % 4], Ln[k])) // TL, TR, BR, BL
    if (q.some(p => !isFinite(p[0]) || p[0] < -0.05 * w || p[1] < -0.05 * h || p[0] > 1.05 * w || p[1] > 1.05 * h)) return
    const larg = (Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) + Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1])) / 2
    const alt = (Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2
    const prop = alt / larg
    if (prop < 1.15 || prop > 1.65 || larg < 0.15 * Math.min(w, h)) return
    const sup = (Math.min(1, V[0].v / alt) + Math.min(1, V[1].v / alt) + Math.min(1, Hz[0].v / larg) + Math.min(1, Hz[1].v / larg)) / 4
    const temVirtual = V.concat(Hz).some(l => l.virtual)
    const score = sup * Math.exp(-(((prop - PROP) / 0.2) ** 2)) * (temVirtual ? 0.6 : 1)
    combos.push({ q, score, area: larg * alt, inferido: [Hs[0], Ls[1], Hs[1], Ls[0]].map(l => !!l.virtual) })
  }
  for (let a = 0; a < vert.length; a++) for (let b = a + 1; b < vert.length; b++) for (let c = 0; c < horz.length; c++) {
    for (let d = c + 1; d < horz.length; d++) avaliar([vert[a], vert[b]], [horz[c], horz[d]])
    for (const sg of [1, -1]) avaliar([vert[a], vert[b]], [horz[c], virtual(horz[c], [vert[a], vert[b]], sg, false)])
  }
  for (let c = 0; c < horz.length; c++) for (let d = c + 1; d < horz.length; d++) for (let a = 0; a < vert.length; a++) {
    for (const sg of [1, -1]) avaliar([vert[a], virtual(vert[a], [horz[c], horz[d]], sg, true)], [horz[c], horz[d]])
  }
  if (!combos.length) return { cantos: null, confianca: [0, 0, 0, 0], inferido: [false, false, false, false], ms: performance.now() - t0 }

  // Entre os fortes, o MAIS EXTERNO (a moldura interna tambem forma um retangulo
  // 88/63). Virtuais so entram se baterem o melhor real.
  const reais = combos.filter(c => !c.inferido.some(Boolean)), virt = combos.filter(c => c.inferido.some(Boolean))
  const mR = reais.length ? Math.max(...reais.map(c => c.score)) : 0
  const mV = virt.length ? Math.max(...virt.map(c => c.score)) : 0
  const fila = [
    ...reais.filter(c => c.score >= 0.6 * mR).sort((a, b) => b.area - a.area).slice(0, 5),
    ...virt.sort((a, b) => b.score - a.score).slice(0, mV > mR ? 3 : 1),
  ]
  if (mV > mR) { const ult = fila.pop(); if (ult) fila.unshift(ult) }

  let melhor: (Omit<CartaDetectada, 'ms'> & { minC: number }) | null = null
  for (const escolhido of fila) {
    const r = refinar(img, escolhido.q.map(p => [(p[0] + 0.5) * s, (p[1] + 0.5) * s] as Pt), escolhido.inferido, s)
    const minC = Math.min(...r.confianca)
    if (!melhor || minC > melhor.minC) melhor = { ...r, minC }
    if (minC >= 0.5) break
  }
  if (!melhor) return { cantos: null, confianca: [0, 0, 0, 0], inferido: [false, false, false, false], ms: performance.now() - t0 }
  if (!melhor.cantos) return { cantos: null, confianca: [0, 0, 0, 0], inferido: [false, false, false, false], ms: performance.now() - t0 }
  let res: { cantos: Pt[]; confianca: number[]; inferido: boolean[] } = { cantos: melhor.cantos, confianca: melhor.confianca, inferido: melhor.inferido }
  const exp = expandirAteFundo(img, res.cantos, res.inferido, s)
  if (exp) res = exp
  const ext = bordaMaisExterna(img, res.cantos, res.confianca, res.inferido, s)
  if (ext) res = ext
  const prop = ajustarProporcao(img, res.cantos, res.confianca, res.inferido, s)
  if (prop) res = prop
  return { ...res, ms: performance.now() - t0 }
}

// ── borda mais externa ───────────────────────────────────────────────────────
// Carta com borda escura sobre fundo escuro (scan de full art: cinza sobre
// preto) faz a deteccao pegar o contorno de dentro, onde a arte comeca, nos 4
// lados. A borda do papel continua la, fraca mas reta: fazendo a media da cor ao
// longo do lado INTEIRO, faixa por faixa para fora, ela vira um pico limpo, e o
// granulado de um tapete se cancela. Candidata = pico mais externo bem acima do
// ruido daquela foto. Quem decide se empurra e a proporcao da carta: so vale a
// combinacao de lados que aproxima o retangulo de 63 x 88 (moldura de scanner ou
// outra carta por perto deixariam a proporcao pior).

function perfilLado(img: Imagem, P: Pt, Q: Pt, nx: number, ny: number, de: number, ate: number) {
  const { width: W, height: H, data } = img
  const cores: (number[] | null)[] = []
  for (let o = de; o <= ate; o++) {
    let r = 0, g = 0, b = 0, m = 0
    for (let i = 0; i <= 120; i++) {
      const t = 0.15 + (0.7 * i) / 120
      const x = Math.round(P[0] + (Q[0] - P[0]) * t + nx * o), y = Math.round(P[1] + (Q[1] - P[1]) * t + ny * o)
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const q = (y * W + x) * 4
      r += data[q]; g += data[q + 1]; b += data[q + 2]; m++
    }
    cores.push(m > 60 ? [r / m, g / m, b / m] : null)
  }
  const grad: number[] = cores.map((_, i) => {
    const a = cores[i - 1], c = cores[i + 1]
    return a && c ? Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]) : 0
  })
  return grad
}

function bordaMaisExterna(img: Imagem, cantos: Pt[], conf: number[], inferido: boolean[], s: number) {
  const ALVO = CARTA_MM.h / CARTA_MM.w
  const cx = cantos.reduce((a, p) => a + p[0], 0) / 4, cy = cantos.reduce((a, p) => a + p[1], 0) / 4
  const normais: [number, number][] = []
  const cand: number[] = [0, 0, 0, 0]
  for (let k = 0; k < 4; k++) {
    const P = cantos[k], Q = cantos[(k + 1) % 4]
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    let nx = (Q[1] - P[1]) / L, ny = -(Q[0] - P[0]) / L
    if (((P[0] + Q[0]) / 2 - cx) * nx + ((P[1] + Q[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny }
    normais.push([nx, ny])
    const de = -4, ate = Math.round(L * 0.1)
    const g = perfilLado(img, P, Q, nx, ny, de, ate)
    const at = (o: number) => g[o - de] ?? 0
    let principal = 0
    for (let o = -4; o <= 3; o++) principal = Math.max(principal, at(o))
    const fora = g.slice(5 - de).filter(v => v > 0).sort((a, b) => a - b)
    if (!fora.length || principal <= 0) continue
    const ruido = Math.max(2, fora[fora.length >> 1])
    for (let o = ate - 1; o >= 6; o--) {
      const v = at(o)
      if (v >= at(o - 1) && v >= at(o + 1) && v >= 4 * ruido && v >= 0.12 * principal) { cand[k] = o; break }
    }
  }
  if (!cand.some(o => o > 0)) return null

  const desloca = (mask: number) => {
    const retas: Reta[] = []
    for (let k = 0; k < 4; k++) {
      const P = cantos[k], [nx, ny] = normais[k]
      const d = mask & (1 << k) ? cand[k] : 0
      retas.push([nx, ny, -(nx * (P[0] + nx * d) + ny * (P[1] + ny * d))])
    }
    return [0, 1, 2, 3].map(k => cruzar(retas[(k + 3) % 4], retas[k]))
  }
  const desvio = (c: Pt[]) => Math.abs(medidasQuad(c).prop - ALVO)
  const atual = desvio(cantos)
  let melhorMask = 0, melhorDesv = atual
  for (let mask = 1; mask < 16; mask++) {
    if ([0, 1, 2, 3].some(k => mask & (1 << k) && !cand[k])) continue
    const dv = desvio(desloca(mask))
    if (dv < melhorDesv - 1e-9) { melhorDesv = dv; melhorMask = mask }
  }
  if (!melhorMask || atual - melhorDesv < 0.01) return null
  const r = refinar(img, desloca(melhorMask), inferido, s)
  if (desvio(r.cantos) >= atual - 0.005) return null
  const confianca = r.confianca.map((c, k) => (melhorMask & (1 << k) ? Math.min(c, 0.45) : c))
  return { cantos: r.cantos, confianca, inferido: r.inferido }
}

// ── conferencia pela proporcao ───────────────────────────────────────────────
// A faixa escura do rodape de uma full art (a do copyright) sobre um tapete
// escuro some no fundo: nem cor nem textura separam, e a borda de baixo saia
// ~3 mm para dentro. A proporcao denuncia (1,358 contra 88/63 = 1,397). Quando
// ela foge, testa empurrar para fora cada um dos dois lados do eixo curto o que
// falta, refaz o refino e fica com a tentativa que fecha a proporcao.

function medidasQuad(c: Pt[]) {
  const d = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])
  const larg = (d(c[0], c[1]) + d(c[3], c[2])) / 2, alt = (d(c[0], c[3]) + d(c[1], c[2])) / 2
  return { larg, alt, prop: alt / larg }
}

function ajustarProporcao(img: Imagem, cantos: Pt[], conf: number[], inferido: boolean[], s: number) {
  const ALVO = CARTA_MM.h / CARTA_MM.w
  const TOL = 0.015
  const { larg, alt, prop } = medidasQuad(cantos)
  if (Math.abs(prop - ALVO) <= TOL) return null
  // Curta demais: falta altura (empurra topo ou base). Larga demais: falta largura (esq ou dir).
  const faltaAltura = prop < ALVO
  const falta = faltaAltura ? larg * ALVO - alt : alt / ALVO - larg
  if (falta <= 0 || falta > Math.max(larg, alt) * 0.12) return null
  const lados = faltaAltura ? [0, 2] : [1, 3] // topo, dir, base, esq
  const cx = cantos.reduce((a, p) => a + p[0], 0) / 4, cy = cantos.reduce((a, p) => a + p[1], 0) / 4

  let melhor: { cantos: Pt[]; confianca: number[]; inferido: boolean[]; nota: number } | null = null
  const minAtual = Math.min(...conf)
  for (const k of lados) {
    const retas: Reta[] = []
    for (let j = 0; j < 4; j++) {
      const P = cantos[j], Q = cantos[(j + 1) % 4]
      const L = Math.hypot(Q[0] - P[0], Q[1] - P[1])
      let nx = (Q[1] - P[1]) / L, ny = -(Q[0] - P[0]) / L
      if (((P[0] + Q[0]) / 2 - cx) * nx + ((P[1] + Q[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny }
      const d = j === k ? falta : 0
      retas.push([nx, ny, -(nx * (P[0] + nx * d) + ny * (P[1] + ny * d))])
    }
    const novos = [0, 1, 2, 3].map(j => cruzar(retas[(j + 3) % 4], retas[j]))
    const r = refinar(img, novos, inferido, s)
    const pr = medidasQuad(r.cantos).prop
    if (Math.abs(pr - ALVO) > TOL) continue
    // So aceita se o lado empurrado achou borda de verdade.
    if (r.confianca[k] < 0.4) continue
    const nota = Math.min(...r.confianca) - Math.abs(pr - ALVO) * 10
    if (!melhor || nota > melhor.nota) melhor = { ...r, nota }
  }
  if (!melhor || Math.min(...melhor.confianca) < minAtual - 0.1) return null
  // O lado empurrado fica sempre para conferencia.
  const confianca = melhor.confianca.map((c, j) => (lados.includes(j) ? Math.min(c, 0.45) : c))
  return { cantos: melhor.cantos, confianca, inferido: melhor.inferido }
}

// ── conferencia contra o fundo ───────────────────────────────────────────────
// A linha mais forte nem sempre e a borda do papel: no verso, o fim da faixa
// azul-escura (onde comeca o redemoinho claro) bate mais que a borda da carta
// sobre um tapete escuro, e a borda de cima saia uns 3 mm para dentro. Cor nao
// separa (o tapete varia demais), TEXTURA separa: o fundo e granulado e a borda
// impressa e lisa. Se do lado de fora de um lado ainda e liso enquanto o fundo
// da foto e granulado, o lado anda para fora ate o granulado comecar.

function luminancia(img: Imagem, x: number, y: number) {
  const xi = Math.min(img.width - 1, Math.max(0, Math.round(x))), yi = Math.min(img.height - 1, Math.max(0, Math.round(y)))
  const o = (yi * img.width + xi) * 4
  return 0.299 * img.data[o] + 0.587 * img.data[o + 1] + 0.114 * img.data[o + 2]
}

/** Desvio padrao da luminancia numa janela 5x5: textura local. */
function textura(img: Imagem, x: number, y: number) {
  let s = 0, s2 = 0
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = luminancia(img, x + a, y + b); s += l; s2 += l * l }
  const m = s / 25
  return Math.sqrt(Math.max(0, s2 / 25 - m * m))
}

function expandirAteFundo(img: Imagem, cantos: Pt[], inferido: boolean[], s: number) {
  const { width: W, height: H } = img
  // Textura tipica do fundo: faixa de 3% na borda da foto.
  const m = Math.max(4, Math.round(Math.min(W, H) * 0.03))
  const amostras: number[] = []
  for (let i = 0; i < 60; i++) {
    const t = (i + 0.5) / 60
    amostras.push(textura(img, t * W, m / 2), textura(img, t * W, H - m / 2), textura(img, m / 2, t * H), textura(img, W - m / 2, t * H))
  }
  amostras.sort((a, b) => a - b)
  const fundo = amostras[amostras.length >> 1]
  // Fundo liso (papel, mesa lisa): a textura nao distingue nada.
  if (fundo < 12) return null
  const limiar = fundo * 0.5

  const cx = cantos.reduce((a, p) => a + p[0], 0) / 4, cy = cantos.reduce((a, p) => a + p[1], 0) / 4
  const desloc = [0, 0, 0, 0]
  for (let k = 0; k < 4; k++) {
    const P = cantos[k], Q = cantos[(k + 1) % 4]
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    let nx = (Q[1] - P[1]) / L, ny = -(Q[0] - P[0]) / L
    if (((P[0] + Q[0]) / 2 - cx) * nx + ((P[1] + Q[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny }
    const maxOff = Math.round(L * 0.1) // ~6 a 9 mm
    const fora = (off: number) => {
      const v: number[] = []
      for (let i = 0; i <= 30; i++) {
        const t = 0.2 + (0.6 * i) / 30
        const x = P[0] + (Q[0] - P[0]) * t + nx * off, y = P[1] + (Q[1] - P[1]) * t + ny * off
        if (x < 3 || y < 3 || x > W - 4 || y > H - 4) continue
        v.push(textura(img, x, y))
      }
      if (v.length < 10) return Infinity // saiu da foto: trata como fundo
      v.sort((a, b) => a - b)
      return v[v.length >> 1]
    }
    // Ja e fundo logo do lado de fora: o lado esta certo.
    if (fora(3) >= limiar || fora(5) >= limiar) continue
    for (let off = 6; off <= maxOff; off++) {
      if (fora(off) >= limiar && fora(off + 2) >= limiar) { desloc[k] = off; break }
    }
  }
  if (!desloc.some(d => d > 0)) return null

  // Desloca as retas dos lados e refaz o refino em volta da nova posicao.
  const retas: Reta[] = []
  for (let k = 0; k < 4; k++) {
    const P = cantos[k], Q = cantos[(k + 1) % 4]
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    let nx = (Q[1] - P[1]) / L, ny = -(Q[0] - P[0]) / L
    if (((P[0] + Q[0]) / 2 - cx) * nx + ((P[1] + Q[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny }
    const d = desloc[k]
    retas.push([nx, ny, -(nx * (P[0] + nx * d) + ny * (P[1] + ny * d))])
  }
  const novos = [0, 1, 2, 3].map(k => cruzar(retas[(k + 3) % 4], retas[k]))
  const r = refinar(img, novos, inferido, s)
  // O lado que andou fica sempre para conferencia.
  const confianca = r.confianca.map((c, k) => (desloc[k] > 0 ? Math.min(c, 0.45) : c))
  return { cantos: r.cantos, confianca, inferido: r.inferido }
}

/**
 * Refino na resolucao CHEIA: perfil de gradiente de cor normal a cada lado
 * (media de 7 px ao longo da borda), pico mais externo, reta robusta. Os cantos
 * saem do cruzamento das retas, entao o canto arredondado nao atrapalha.
 */
function refinar(img: Imagem, cant: Pt[], inferido: boolean[], s: number) {
  const cx = cant.reduce((a, p) => a + p[0], 0) / 4, cy = cant.reduce((a, p) => a + p[1], 0) / 4
  const rgb = [0, 0, 0]
  const lados: Reta[] = [], conf: number[] = []
  const N = 80
  for (let k = 0; k < 4; k++) {
    const P = cant[k], Q = cant[(k + 1) % 4]
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    const tx = (Q[0] - P[0]) / L, ty = (Q[1] - P[1]) / L
    let nx = ty, ny = -tx
    const midx = (P[0] + Q[0]) / 2, midy = (P[1] + Q[1]) / 2
    if ((midx - cx) * nx + (midy - cy) * ny < 0) { nx = -nx; ny = -ny }
    const R = inferido[k] ? Math.round(L * 0.07) : Math.max(6, Math.round(2.5 * s))
    const pts: Pt[] = []
    for (let i = 0; i <= N; i++) {
      const t = 0.12 + (0.76 * i) / N
      const bx = P[0] + (Q[0] - P[0]) * t, by = P[1] + (Q[1] - P[1]) * t
      const col = Array.from({ length: 2 * R + 1 }, () => [0, 0, 0])
      for (let d = -R; d <= R; d++) for (let e = -3; e <= 3; e++) {
        amostrar(img, bx + nx * d + tx * e, by + ny * d + ty * e, rgb)
        const c = col[d + R]; c[0] += rgb[0]; c[1] += rgb[1]; c[2] += rgb[2]
      }
      const g = new Float32Array(2 * R + 1); let gmax = 0
      for (let j = 1; j < 2 * R; j++) {
        const a = col[j - 1], b = col[j + 1]
        g[j] = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
        if (g[j] > gmax) gmax = g[j]
      }
      if (gmax <= 0) continue
      let jj = -1
      for (let j = 2 * R - 1; j >= 1; j--) if (g[j] >= 0.5 * gmax && g[j] >= g[j - 1] && g[j] >= g[j + 1]) { jj = j; break }
      if (jj < 1 || jj >= 2 * R) continue
      const a = g[jj - 1], b = g[jj], c = g[jj + 1]
      const off = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0
      const d = jj + off - R
      pts.push([bx + nx * d + 0.5, by + ny * d + 0.5])
    }
    const fit = ajustarReta(pts)
    if (!fit.linha) {
      // Sem pontos suficientes: fica a reta grossa, com confianca zero.
      const ax = P[1] - Q[1], ay = Q[0] - P[0], n = Math.hypot(ax, ay) || 1
      lados.push([ax / n, ay / n, -(ax * P[0] + ay * P[1]) / n]); conf.push(0); continue
    }
    lados.push(fit.linha)
    let cf = Math.max(0, Math.min(1, (fit.dentro / (N + 1)) * (1 - Math.min(1, fit.rms / 2))))
    if (inferido[k]) cf = Math.min(cf, 0.3) // lado deduzido: sempre pedir conferencia
    conf.push(Math.round(cf * 100) / 100)
  }
  const cantos = [0, 1, 2, 3].map(k => cruzar(lados[(k + 3) % 4], lados[k]))
  return { cantos, confianca: conf, inferido }
}

// ── (b) homografia ───────────────────────────────────────────────────────────

function resolver(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

/** H 3x3 (h33 = 1) com `para = H * de`, a partir de 4 pares de pontos. */
export function homografia(de: Pt[], para: Pt[]): number[] {
  const A: number[][] = [], b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = de[i], [u, v] = para[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  const h = resolver(A, b)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

export const aplicarH = (H: number[], x: number, y: number): Pt => {
  const w = H[6] * x + H[7] * y + H[8]
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]
}

/**
 * Endireita a carta para um retangulo 63 x 88 mm em `pxPorMm`. Com `margemMm`,
 * a imagem inclui essa sobra de foto em volta: se os cantos ficaram um pouco
 * para dentro, a borda real continua visivel para o ajuste. O pixel (x, y) da
 * saida corresponde ao mm (x / pxPorMm - margemMm) da carta.
 */
export function retificar(img: Imagem, cantos: Pt[], pxPorMm = 10, margemMm = 0): Retificada {
  const m = margemMm * pxPorMm
  const cw = CARTA_MM.w * pxPorMm, ch = CARTA_MM.h * pxPorMm
  const W = Math.round(cw + 2 * m), Hh = Math.round(ch + 2 * m)
  const H = homografia([[m, m], [m + cw, m], [m + cw, m + ch], [m, m + ch]], cantos)
  const out = new Uint8ClampedArray(W * Hh * 4)
  const rgb = [0, 0, 0]
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const [sx, sy] = aplicarH(H, x + 0.5, y + 0.5)
    amostrar(img, sx - 0.5, sy - 0.5, rgb)
    const o = (y * W + x) * 4
    out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; out[o + 3] = 255
  }
  return { width: W, height: Hh, data: out, pxPorMm }
}

/** Quanto o quadrilatero foge de um retangulo (0 = retangulo perfeito). */
export function desvioDeRetangulo(c: Pt[]): number {
  let pior = 0
  for (let k = 0; k < 4; k++) {
    const a = c[(k + 3) % 4], b = c[k], d = c[(k + 1) % 4]
    const u = [a[0] - b[0], a[1] - b[1]], v = [d[0] - b[0], d[1] - b[1]]
    const cos = Math.abs((u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])) || 1))
    pior = Math.max(pior, cos)
  }
  return pior
}

// ── (c) moldura ──────────────────────────────────────────────────────────────

export type Lado = 'esq' | 'dir' | 'topo' | 'base'
export const LADOS: Lado[] = ['esq', 'dir', 'topo', 'base']
export type MolduraLado = { mm: number | null; confianca: number }

/**
 * Distancia (mm) da borda do papel ate o fim da moldura em cada lado, com
 * confianca 0 a 1. O perfil de cada lado e a MEDIANA de 12 trechos: um
 * reflexo ou um dedo num trecho nao decide o resultado.
 */
export function detectarMoldura(ret: Retificada, opts: { minMm?: number; maxMm?: number; margemCantoMm?: number } = {}): Record<Lado, MolduraLado> {
  const ppm = ret.pxPorMm, W = ret.width, H = ret.height, d = ret.data
  const dMin = Math.round((opts.minMm ?? 0.7) * ppm), dMax = Math.round((opts.maxMm ?? 9) * ppm)
  const margemCanto = (opts.margemCantoMm ?? 10) * ppm
  const K = 12
  const px = (x: number, y: number) => (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4
  const lados: Record<Lado, { n: number; at: (s: number, k: number) => number }> = {
    esq: { n: H, at: (s, k) => px(k, s) },
    dir: { n: H, at: (s, k) => px(W - 1 - k, s) },
    topo: { n: W, at: (s, k) => px(s, k) },
    base: { n: W, at: (s, k) => px(s, H - 1 - k) },
  }
  const res = {} as Record<Lado, MolduraLado>
  for (const nome of LADOS) {
    const L = lados[nome]
    const s0 = Math.round(margemCanto), s1 = L.n - Math.round(margemCanto)
    const seg = Array.from({ length: K }, () => new Float32Array(dMax + 2))
    const cnt = new Array(K).fill(0)
    for (let s = s0; s < s1; s++) {
      const ks = Math.min(K - 1, Math.floor(((s - s0) / (s1 - s0)) * K))
      for (let k = 1; k <= dMax; k++) {
        const a = L.at(s, k - 1), b = L.at(s, k + 1)
        seg[ks][k] += Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2])
      }
      cnt[ks]++
    }
    seg.forEach((p, i) => { for (let k = 0; k < p.length; k++) p[k] /= cnt[i] || 1 })
    const perfil = new Float32Array(dMax + 2)
    for (let k = 1; k <= dMax; k++) {
      const v = seg.map(p => p[k]).sort((a, b) => a - b)
      perfil[k] = (v[(K - 1) >> 1] + v[K >> 1]) / 2
    }
    const pico = (p: Float32Array) => {
      let mx = 0
      for (let k = dMin; k < dMax; k++) mx = Math.max(mx, p[k])
      for (let k = dMin; k < dMax; k++) if (p[k] >= 0.45 * mx && p[k] >= p[k - 1] && p[k] >= p[k + 1]) {
        const a = p[k - 1], b = p[k], c = p[k + 1]
        const off = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0
        return { pos: k + off, val: b }
      }
      return null
    }
    const pk = pico(perfil)
    if (!pk) { res[nome] = { mm: null, confianca: 0 }; continue }
    // A moldura e lisa: o trecho ANTES do pico tem que ser quieto perto do pico.
    const antes = Array.from(perfil.slice(dMin, Math.max(dMin + 1, Math.floor(pk.pos) - 2))).sort((a, b) => a - b)
    const base = Math.max(1, antes[Math.floor(antes.length * 0.75)] || 1)
    const destaque = Math.max(0, Math.min(1, (pk.val / base - 1) / 4))
    const posSeg = seg.map(p => pico(p)?.pos).filter((v): v is number => v != null)
    const conc = posSeg.filter(v => Math.abs(v - pk.pos) <= 0.3 * ppm).length / K
    res[nome] = { mm: pk.pos / ppm, confianca: Math.round(destaque * conc * 100) / 100 }
  }
  return res
}
