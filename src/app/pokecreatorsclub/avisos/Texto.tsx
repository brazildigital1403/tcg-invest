// Texto dos Avisos na sintaxe do WhatsApp (08/11/2026): *negrito*, "- item" de
// lista, linha toda em *negrito* vira subtitulo, link com https:// vira link.
// Monta nos do React, nunca HTML: o React escapa o resto, entao nao ha como
// injetar marcacao. As admins colam o texto do WhatsApp do jeito que esta.

import { Fragment, type ReactNode } from 'react'

const URL_RE = /(https:\/\/[^\s<>"']+)/g
const NEGRITO_RE = /\*([^*\n]+)\*/g

function inline(texto: string, chave: string): ReactNode[] {
  const out: ReactNode[] = []
  texto.split(URL_RE).forEach((pedaco, i) => {
    if (i % 2 === 1) {
      // Pontuacao colada no fim do link fica fora dele.
      const m = pedaco.match(/^(.*?)([.,;:!?)]*)$/) as RegExpMatchArray
      out.push(<a key={`${chave}-u${i}`} href={m[1]} target="_blank" rel="noopener noreferrer nofollow ugc">{m[1]}</a>)
      if (m[2]) out.push(m[2])
      return
    }
    let ultimo = 0
    let n = 0
    for (const m of pedaco.matchAll(NEGRITO_RE)) {
      if ((m.index ?? 0) > ultimo) out.push(pedaco.slice(ultimo, m.index))
      out.push(<strong key={`${chave}-b${i}-${n++}`}>{m[1]}</strong>)
      ultimo = (m.index ?? 0) + m[0].length
    }
    if (ultimo < pedaco.length) out.push(pedaco.slice(ultimo))
  })
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
