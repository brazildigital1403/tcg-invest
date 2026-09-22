'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconCheck, IconClose, IconShare } from '@/components/ui/Icons'

/**
 * "Copiar lista" da aba Faltam da meta (22/09/2026, mockup aprovado pelo Du).
 *
 * ★ POR QUE. Item 5 do brief de concorrencia: transformar a colecao em
 * INTENCAO DE COMPRA. A pessoa sai com o texto pronto para colar no grupo de
 * WhatsApp, no Discord ou na conversa com o lojista -- e o rodape com o
 * endereco faz a lista trabalhar como divulgacao.
 *
 * ★ Nao consulta nada: a aba Faltam ja tem as cartas em memoria. O texto e
 * montado aqui, no navegador.
 *
 * ★ TRES REGRAS DA CASA presentes de proposito:
 *   - o texto NUNCA diz de onde vem o preco: e "valor de mercado", igual ao
 *     resto do site;
 *   - valor sai DESLIGADO por padrao (decisao do Du);
 *   - corta em 100 cartas e diz quantas sobraram, senao o WhatsApp corta a
 *     mensagem no meio.
 */

const LIMITE = 100

type CartaFalta = { nome: string; numero: string | null; valor: number }
type Formato = 'numero' | 'nome' | 'linha'

const FORMATOS: { key: Formato; label: string }[] = [
  { key: 'numero', label: 'Número e nome' },
  { key: 'nome', label: 'Só o nome' },
  { key: 'linha', label: 'Em uma linha' },
]

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pad = (n: string | null) => {
  const so = (n || '').trim()
  return /^\d+$/.test(so) ? so.padStart(3, '0') : so
}

export function montarTexto(
  titulo: string,
  cartas: CartaFalta[],
  opcoes: { formato: Formato; valor: boolean; link: boolean },
): string {
  const linhas: string[] = [`Faltam na minha ${titulo} (${cartas.length} ${cartas.length === 1 ? 'carta' : 'cartas'})`, '']
  const mostradas = cartas.slice(0, LIMITE)
  const itens = mostradas.map(c => {
    const base = opcoes.formato === 'nome' ? c.nome : `${pad(c.numero)} ${c.nome}`.trim()
    return opcoes.valor && c.valor > 0 ? `${base} — ${brl(c.valor)}` : base
  })
  if (opcoes.formato === 'linha') linhas.push(itens.join(' · '))
  else linhas.push(...itens)
  const resto = cartas.length - mostradas.length
  if (resto > 0) linhas.push(`+${resto} ${resto === 1 ? 'carta' : 'cartas'}`)
  if (opcoes.link) linhas.push('', 'Lista feita na Bynx: bynx.gg/metas')
  return linhas.join('\n')
}

export default function CopiarFaltantes({ titulo, cartas, estilo }: {
  titulo: string
  cartas: CartaFalta[]
  /** Estilo do botao, para casar com os vizinhos da barra. */
  estilo: React.CSSProperties
}) {
  const [aberto, setAberto] = useState(false)
  const [formato, setFormato] = useState<Formato>('numero')
  const [valor, setValor] = useState(false)
  const [link, setLink] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)
  const botaoRef = useRef<HTMLButtonElement>(null)

  const fechar = useCallback(() => setAberto(false), [])

  useEffect(() => {
    if (!aberto) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') fechar() }
    function onClick(e: MouseEvent) {
      const alvo = e.target as Node
      if (caixaRef.current?.contains(alvo) || botaoRef.current?.contains(alvo)) return
      fechar()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [aberto, fechar])

  if (cartas.length === 0) return null

  const texto = montarTexto(titulo, cartas, { formato, valor, link })

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Contexto sem clipboard (http, permissao negada): o textarea temporario
      // ainda copia, e e o caminho que sobra em navegador antigo.
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* sem copia */ }
      ta.remove()
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  async function compartilhar() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: `Faltam na minha ${titulo}`, text: texto }) } catch { /* cancelou */ }
      return
    }
    copiar()
  }

  const chip = (ativo: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: 12.5, fontWeight: 700, minHeight: 38, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
    border: `1px solid ${ativo ? 'var(--ac-1)' : 'var(--bx-border)'}`,
    background: ativo ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)',
    color: ativo ? 'var(--ac-1)' : 'var(--bx-text-2)',
  })

  return (
    <>
      <style>{CSS}</style>
      <button
        ref={botaoRef}
        onClick={() => setAberto(v => !v)}
        aria-expanded={aberto}
        style={{ ...estilo, borderColor: 'rgba(var(--ac-1-rgb), 0.55)', background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)', fontWeight: 800 }}
      >
        <IconShare size={15} color="currentColor" />Copiar lista
      </button>

      {aberto && (
        <>
          <button className="cf-veu" aria-label="Fechar" onClick={fechar} />
          <div ref={caixaRef} className="cf-painel" role="dialog" aria-label="Lista de faltantes">
            <div className="cf-alca" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Lista de faltantes</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--bx-text-2)' }}>
                  {cartas.length} {cartas.length === 1 ? 'carta' : 'cartas'} da {titulo}, na ordem do número.
                </p>
              </div>
              <button onClick={fechar} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--bx-text-3)' }}>
                <IconClose size={16} color="currentColor" />
              </button>
            </div>

            <div>
              <span className="cf-rotulo">Formato</span>
              <div className="cf-chips">
                {FORMATOS.map(f => (
                  <button key={f.key} onClick={() => setFormato(f.key)} aria-pressed={formato === f.key} style={chip(formato === f.key)}>{f.label}</button>
                ))}
              </div>
            </div>

            <div>
              <span className="cf-rotulo">Incluir</span>
              <div className="cf-chips">
                <button onClick={() => setValor(v => !v)} aria-pressed={valor} style={chip(valor)}>Valor de mercado</button>
                <button onClick={() => setLink(v => !v)} aria-pressed={link} style={chip(link)}>Link da Bynx</button>
              </div>
            </div>

            <pre className="cf-previa">{texto}</pre>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={copiar} className="cf-btn cf-btn-prim">
                {copiado ? <><IconCheck size={15} color="currentColor" />Copiado</> : 'Copiar'}
              </button>
              <button onClick={compartilhar} className="cf-btn">Compartilhar</button>
            </div>

            {cartas.length > LIMITE && (
              <p className="cf-nota">Sai no máximo {LIMITE} cartas por vez, com o total no fim.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}

const CSS = `
.cf-veu{display:none}
.cf-painel{position:absolute;top:52px;right:0;z-index:40;width:min(400px, calc(100vw - 32px));
  background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-radius:18px;padding:16px;
  display:grid;gap:14px;box-shadow:0 30px 70px rgba(0,0,0,.65);text-align:left}
.cf-alca{display:none}
.cf-rotulo{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.cf-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.cf-previa{margin:0;background:var(--bx-bg);border:1px solid var(--bx-border);border-radius:12px;padding:11px 13px;
  font-family:'DM Mono',ui-monospace,monospace;font-size:12px;line-height:1.65;color:var(--bx-text-2);
  white-space:pre-wrap;max-height:190px;overflow:auto}
.cf-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:inherit;font-size:14px;font-weight:700;
  min-height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface-2);
  color:var(--bx-text);cursor:pointer}
.cf-btn-prim{background:var(--ac-grad);color:var(--bx-brand-ink);border:none;font-weight:800}
.cf-nota{margin:0;font-size:11.5px;color:var(--bx-text-3)}

@media(max-width:700px){
  .cf-veu{display:block;position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.5);border:none;padding:0}
  .cf-painel{position:fixed;z-index:61;inset:auto 0 0 0;width:auto;max-height:86vh;overflow:auto;
    border-radius:20px 20px 0 0;border-left:none;border-right:none;border-bottom:none;padding:12px 14px calc(16px + env(safe-area-inset-bottom))}
  .cf-alca{display:block;width:38px;height:4px;border-radius:99px;background:rgba(255,255,255,.22);margin:0 auto 2px}
  .cf-previa{max-height:34vh}
}
@media(prefers-reduced-motion:reduce){.cf-painel{transition:none}}
`
