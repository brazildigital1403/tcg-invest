'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconCheck, IconLink } from '@/components/ui/Icons'
import { urlRodada } from '@/lib/leilao-urls'
import { SH } from '../../_shared'

/**
 * "Link para divulgar": a URL publica da rodada (/leiloes/rodada/[numero])
 * com botao de copiar. A loja cola na bio, no story e no chat da live.
 *
 * Copiar: `navigator.clipboard` (exige contexto seguro e pode ser negado);
 * sem ele, cai no textarea + execCommand('copy'); se nem isso der, seleciona
 * o campo para a pessoa copiar na mao.
 */

function copiarPorTextarea(texto: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function LinkDivulgar({ numero }: { numero: number }) {
  const caminho = urlRodada(numero)
  const origem = typeof window !== 'undefined' ? window.location.origin : 'https://bynx.gg'
  const url = `${origem}${caminho}`
  const [copiado, setCopiado] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const campoRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function copiar() {
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) ok = copiarPorTextarea(url)
    if (!ok) {
      setFalhou(true)
      campoRef.current?.select()
      return
    }
    setFalhou(false)
    setCopiado(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <section style={{ ...SH.card, ...S.card }} aria-labelledby="rd-divulgar">
      <h2 id="rd-divulgar" style={{ ...SH.cardH3, marginBottom: 0 }}>Link para divulgar</h2>
      <p style={S.hint}>
        Cole na bio, nos stories e no chat da live. Quem abrir acompanha os lotes e dá lance por esta página.
      </p>
      <div style={S.linha}>
        <input
          ref={campoRef}
          readOnly
          value={url}
          aria-label="Link público da rodada"
          onFocus={e => e.currentTarget.select()}
          style={S.campo}
        />
        <button type="button" onClick={copiar} style={S.btn} aria-live="polite">
          {copiado ? <IconCheck size={16} /> : <IconLink size={16} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {falhou && <p style={S.falha}>Não foi possível copiar sozinho. O link ficou selecionado: copie pelo menu do aparelho.</p>}
      <a href={caminho} target="_blank" rel="noopener noreferrer" style={S.abrir}>Abrir a página pública</a>
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  card: { display: 'flex', flexDirection: 'column', gap: 10 },
  hint: { fontSize: 13, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.45 },
  linha: { display: 'flex', gap: 8, alignItems: 'stretch' },
  campo: {
    flex: 1, minWidth: 0, minHeight: 44, boxSizing: 'border-box', background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)', borderRadius: 9, padding: '10px 12px', fontSize: 16,
    color: 'var(--bx-text)', outline: 'none', fontFamily: 'inherit',
  },
  btn: {
    flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44,
    minWidth: 104, padding: '0 14px', borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit',
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontSize: 14, fontWeight: 700,
  },
  falha: { fontSize: 12, color: 'var(--bx-amber)', margin: 0, lineHeight: 1.45 },
  abrir: {
    alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 13, fontWeight: 700,
    color: 'var(--ac-1)', textDecoration: 'none',
  },
}
