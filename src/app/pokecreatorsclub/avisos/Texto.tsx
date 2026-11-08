// Texto dos Avisos na sintaxe do WhatsApp (08/11/2026): *negrito*, _italico_, ~riscado~, "- item" de
// lista, linha toda em *negrito* vira subtitulo, link com https:// vira link.
// Monta nos do React, nunca HTML: o React escapa o resto, entao nao ha como
// injetar marcacao. As admins colam o texto do WhatsApp do jeito que esta.

import { Fragment, type ReactNode } from 'react'

// Um token por vez, o que comeca primeiro ganha: link, *negrito*, _italico_ ou
// ~riscado~ (como no WhatsApp, o marcador nao pode estar colado em letra). O
// miolo do negrito/italico/riscado passa de novo, entao *https://...* vira link
// em negrito, e o "_" de dentro de um link nao vira italico.
const TOKEN_RE = /(https:\/\/[^\s<>"'*~]+)|(?<![\p{L}\p{N}])([*_~])([^\n]+?)\2(?![\p{L}\p{N}])/gu

function link(url: string, chave: string): ReactNode[] {
  // Pontuacao colada no fim fica fora do link; ")" so sai se nao tiver "(" aberto.
  let fim = url.length
  while (fim > 0 && '.,;:!?)'.includes(url[fim - 1])) {
    if (url[fim - 1] === ')' && url.slice(0, fim).split('(').length > url.slice(0, fim).split(')').length - 1) break
    fim--
  }
  const href = url.slice(0, fim)
  const out: ReactNode[] = [<a key={chave} href={href} target="_blank" rel="noopener noreferrer nofollow ugc">{href}</a>]
  if (fim < url.length) out.push(url.slice(fim))
  return out
}

function inline(texto: string, chave: string, fundo = 0): ReactNode[] {
  const out: ReactNode[] = []
  let ultimo = 0
  let n = 0
  for (const m of texto.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0
    if (i > ultimo) out.push(texto.slice(ultimo, i))
    const k = `${chave}-${n++}`
    if (m[1]) out.push(...link(m[1], k))
    else {
      const miolo = fundo < 3 ? inline(m[3], k, fundo + 1) : [m[3]]
      out.push(m[2] === '*' ? <strong key={k}>{miolo}</strong> : m[2] === '_' ? <em key={k}>{miolo}</em> : <s key={k}>{miolo}</s>)
    }
    ultimo = i + m[0].length
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo))
  return out
}

type Bloco = { tipo: 'p'; linhas: string[] } | { tipo: 'ul'; itens: string[] } | { tipo: 'h'; texto: string }

export function blocos(texto: string): Bloco[] {
  const out: Bloco[] = []
  for (const bruta of texto.replace(/\r/g, '').split('\n')) {
    const linha = bruta.trim()
    const ultimo = out[out.length - 1]
    if (!linha) { out.push({ tipo: 'p', linhas: [] }); continue }
    const item = linha.match(/^[-•]\s+(.*)$/)
    if (item) {
      if (ultimo?.tipo === 'ul') ultimo.itens.push(item[1])
      else out.push({ tipo: 'ul', itens: [item[1]] })
      continue
    }
    const sub = linha.match(/^\*([^*]+)\*:?$/)
    if (sub) { out.push({ tipo: 'h', texto: sub[1] }); continue }
    if (ultimo?.tipo === 'p') ultimo.linhas.push(linha)
    else out.push({ tipo: 'p', linhas: [linha] })
  }
  return out.filter(b => b.tipo !== 'p' || b.linhas.length > 0)
}

export function TextoAviso({ texto }: { texto: string }) {
  return (
    <div className="av-texto">
      {blocos(texto).map((b, i) => {
        if (b.tipo === 'h') return <h3 key={i} className="av-sub">{inline(b.texto, `h${i}`)}</h3>
        if (b.tipo === 'ul') return <ul key={i}>{b.itens.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`)}</li>)}</ul>
        return <p key={i}>{b.linhas.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `p${i}-${j}`)}</Fragment>)}</p>
      })}
    </div>
  )
}

export const TEXTO_CSS = `
.av-texto{display:flex;flex-direction:column;gap:10px;font-size:15px;line-height:1.6;color:var(--bx-text);overflow-wrap:anywhere}
.av-texto p{margin:0}
.av-texto strong{font-weight:800}
.av-texto ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px;list-style:disc}
.av-texto li::marker{color:var(--ac-1)}
.av-texto a{color:var(--ac-1);text-decoration:underline;text-underline-offset:2px}
.av-texto .av-sub{font-size:15px;font-weight:800;margin:6px 0 -4px}
`
