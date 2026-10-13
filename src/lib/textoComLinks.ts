/**
 * Texto livre (mensagem de ticket, resposta da equipe) com URL virando link.
 *
 * Por que existe: a mensagem do ticket era texto cru em cinco lugares (tres
 * e-mails e duas telas) e nenhum deles transformava URL em link. Quem recebia
 * "bynx.gg/carta/..." tinha que copiar e colar no navegador -- ninguem faz isso
 * (achado do Du em 12/10/2026, ao tentar mandar o link de uma carta pelo modal
 * "Falar com o usuario").
 *
 * Uma fonte de verdade, duas saidas:
 *   - `segmentarLinks`   -> pedacos tipados, pro componente React das telas
 *   - `textoComLinksHtml`-> HTML escapado com <a> e paragrafos, pros e-mails
 *
 * Reconhece `https://...`, `http://...` e `bynx.gg/...` sem protocolo (e como
 * a gente digita). Pontuacao colada no fim do link ("...celebration." ou
 * "...celebration)") fica fora do href, senao o link quebra.
 */

export type Segmento =
  | { tipo: 'texto'; valor: string }
  | { tipo: 'link'; valor: string; href: string; interno: boolean }

const HOSTS_INTERNOS = new Set(['bynx.gg', 'www.bynx.gg'])

// Grupo 1: URL com protocolo. Grupo 2: bynx.gg nu, com ou sem caminho.
// O lookbehind evita casar "abynx.gg" e "email@bynx.gg"; o lookahead, "bynx.gg.br". Aspas e <> ficam de fora de
// proposito: o texto passa por escapeHtml depois e o link nao pode engolir.
const RE_URL = /(https?:\/\/[^\s<>"']+)|((?<![\w@.\/-])(?:www\.)?bynx\.gg(?![\w-]|\.\w)(?:\/[^\s<>"']*)?)/gi

// O que nao faz parte de uma URL quando aparece no fim dela.
const RE_PONTUACAO_FINAL = /[.,;:!?)\]]+$/

function hostDe(href: string): string {
  try { return new URL(href).hostname.toLowerCase() } catch { return '' }
}

export function segmentarLinks(texto: string): Segmento[] {
  const out: Segmento[] = []
  const src = texto || ''
  let cursor = 0

  for (const m of src.matchAll(RE_URL)) {
    const inicio = m.index ?? 0
    let bruto = m[0]
    const sobra = bruto.match(RE_PONTUACAO_FINAL)?.[0] || ''
    if (sobra) bruto = bruto.slice(0, -sobra.length)
    if (!bruto) continue

    if (inicio > cursor) out.push({ tipo: 'texto', valor: src.slice(cursor, inicio) })

    const href = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`
    out.push({ tipo: 'link', valor: bruto, href, interno: HOSTS_INTERNOS.has(hostDe(href)) })
    cursor = inicio + m[0].length - sobra.length
  }

  if (cursor < src.length) out.push({ tipo: 'texto', valor: src.slice(cursor) })
  return out
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  )
}

/** Uma linha (sem quebra) vira HTML com os <a>. */
function linhaHtml(linha: string, estiloLink: string): string {
  return segmentarLinks(linha).map(seg => {
    if (seg.tipo === 'texto') return escapar(seg.valor)
    const alvo = seg.interno ? '' : ' target="_blank" rel="noopener"'
    return `<a href="${escapar(seg.href)}"${alvo} style="${estiloLink}">${escapar(seg.valor)}</a>`
  }).join('')
}

const ESTILO_LINK_EMAIL = 'color:#f59e0b;font-weight:600;text-decoration:underline;word-break:break-all;'

/**
 * Texto -> paragrafos com links, pro e-mail.
 *
 * Linha em branco separa paragrafo (ganha respiro); quebra simples vira <br/>.
 * Antes era um unico bloco `white-space:pre-wrap` cinza -- funcionava, mas
 * parecia log, nao mensagem.
 */
export function textoComLinksHtml(texto: string, opts: { fonte?: string; cor?: string } = {}): string {
  const fonte = opts.fonte || ''
  const cor = opts.cor || 'rgba(255,255,255,0.85)'
  const paragrafos = (texto || '').replace(/\r\n?/g, '\n').trim().split(/\n{2,}/)

  return paragrafos.map((par, i) => {
    const ultimo = i === paragrafos.length - 1
    const corpo = par.split('\n').map(l => linhaHtml(l, ESTILO_LINK_EMAIL)).join('<br/>')
    return `<p style="margin:0 0 ${ultimo ? 0 : 14}px;font-size:14px;line-height:1.65;color:${cor};${fonte}">${corpo}</p>`
  }).join('')
}
