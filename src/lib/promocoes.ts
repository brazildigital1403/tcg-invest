// Promocoes de afiliado (ml_afiliado_produtos / ml_afiliado_links).
//
// Modulo PURO: sem Supabase, sem Next. Roda no navegador (a tela de
// /admin/promocoes da o erro na hora) e no servidor (a API valida de novo,
// porque e ela que grava). Uma regra so, nos dois lados.

export type Vitrine = { chave: string; nome: string; descricao: string }

/**
 * Vitrines conhecidas. Chave que aparecer no banco e nao estiver aqui (ex.:
 * vitrine de um set) vira aba extra com o proprio nome da chave.
 */
export const VITRINES: Vitrine[] = [
  { chave: 'default', nome: 'Site', descricao: 'cartas, sets e Pokémon' },
  { chave: 'acessorios', nome: 'Acessórios', descricao: 'página de carta' },
  { chave: 'email', nome: 'E-mail', descricao: 'corpo dos disparos' },
]

export function nomeVitrine(chave: string): string {
  return VITRINES.find((v) => v.chave === chave)?.nome ?? chave
}

/** Chave aceita na API: texto curto, sem espaco. */
export function chaveValida(chave: unknown): chave is string {
  return typeof chave === 'string' && /^[a-z0-9_-]{1,40}$/i.test(chave)
}

// ── Link de afiliado ────────────────────────────────────────────────────────

const HOSTS_ML = ['meli.la', 'mercadolivre.com.br', 'mercadolivre.com', 'mercadolibre.com']

export type ResultadoLink =
  | { ok: true; url: string; aviso: string | null }
  | { ok: false; erro: string; sugestao: string | null }

export function validarLink(valor: string): ResultadoLink {
  const v = (valor || '').trim()
  if (!v) return { ok: false, erro: 'Cole o link de afiliado.', sugestao: null }
  if (v.length > 500) return { ok: false, erro: 'O link passou de 500 caracteres.', sugestao: null }

  let u: URL | null = null
  try { u = new URL(v) } catch { u = null }

  if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) {
    // Colado sem protocolo e com cara de dominio: oferece o conserto, nao aplica sozinho.
    const pareceDominio = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)
    return {
      ok: false,
      erro: 'O link precisa começar com http:// ou https://.',
      sugestao: pareceDominio ? `https://${v}` : null,
    }
  }

  const host = u.hostname.toLowerCase()
  const doMl = HOSTS_ML.some((h) => host === h || host.endsWith(`.${h}`))
  return {
    ok: true,
    url: u.toString(),
    aviso: doMl ? null : 'Este link não parece do Mercado Livre, a comissão pode não contar.',
  }
}

/** `https://meli.la/31uWKTC` -> `meli.la/31uWKTC` (so para exibir). */
export function encurtarLink(url: string): string {
  try {
    const u = new URL(url)
    const caminho = u.pathname === '/' ? '' : u.pathname
    const curto = `${u.hostname.replace(/^www\./, '')}${caminho}`
    return curto.length > 42 ? `${curto.slice(0, 41)}…` : curto
  } catch {
    return url
  }
}

// ── Imagem ──────────────────────────────────────────────────────────────────

export function validarImagemUrl(valor: string): { ok: true; url: string } | { ok: false; erro: string } {
  const v = (valor || '').trim()
  if (!v) return { ok: false, erro: 'Envie uma imagem ou cole a URL dela.' }
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return { ok: false, erro: 'A URL da imagem precisa começar com https://.' }
    return { ok: true, url: u.toString() }
  } catch {
    return { ok: false, erro: 'A URL da imagem não é válida.' }
  }
}

// ── Preco ───────────────────────────────────────────────────────────────────
//
// A coluna `preco` e TEXTO. Grava padronizado, sem simbolo, 2 casas e milhar
// com ponto: "62,29", "134,00", "1.234,50". Quem exibe poe o "R$ ".

export type ResultadoPreco = { ok: true; valor: string } | { ok: false; erro: string }

const PRECO_MILHAR = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/
const PRECO_SIMPLES = /^\d+(,\d{1,2})?$/

export function normalizarPreco(valor: string): ResultadoPreco {
  const v = (valor || '').replace(/R\$/gi, '').replace(/\s+/g, '')
  if (!v) return { ok: false, erro: 'Informe o preço.' }
  if (/^\d+\.\d{1,2}$/.test(v)) return { ok: false, erro: `Use vírgula para os centavos: ${v.replace('.', ',')}` }
  if (!PRECO_MILHAR.test(v) && !PRECO_SIMPLES.test(v)) {
    return { ok: false, erro: 'Preço inválido. Exemplos: 134, 134,00 ou R$ 134,00.' }
  }
  const [inteiro, dec = ''] = v.replace(/\./g, '').split(',')
  const centavos = Number(inteiro) * 100 + Number((dec + '00').slice(0, 2))
  if (!Number.isFinite(centavos) || centavos <= 0) return { ok: false, erro: 'O preço precisa ser maior que zero.' }
  if (centavos > 9_999_999) return { ok: false, erro: 'O preço passou de R$ 99.999,99.' }
  return { ok: true, valor: formatarCentavos(centavos) }
}

function formatarCentavos(centavos: number): string {
  const inteiro = Math.floor(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const dec = String(centavos % 100).padStart(2, '0')
  return `${inteiro},${dec}`
}

/** Exibicao: poe "R$ " so quando falta (funciona com o formato antigo e o novo). */
export function exibirPreco(preco: string | null | undefined): string {
  const p = (preco || '').trim()
  if (!p) return ''
  return /^R\$/i.test(p) ? p.replace(/^R\$\s*/i, 'R$ ') : `R$ ${p}`
}

// ── Titulo ──────────────────────────────────────────────────────────────────

export const TITULO_MAX = 80

export type ResultadoTitulo = { ok: true; valor: string } | { ok: false; erro: string }

// Construtor em vez de literal: o tsconfig mira ES2017 e o `\p{}` literal e ES2018.
const EMOJI = new RegExp('[\\p{Extended_Pictographic}\\uFE0F\\u200D]', 'gu')

export function normalizarTitulo(valor: string): ResultadoTitulo {
  const v = (valor || '')
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (v.length < 3) return { ok: false, erro: 'O título precisa de pelo menos 3 caracteres.' }
  if (v.length > TITULO_MAX) return { ok: false, erro: `O título passou de ${TITULO_MAX} caracteres.` }
  return { ok: true, valor: v }
}
