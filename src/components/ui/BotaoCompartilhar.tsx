'use client'

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react'
import { IconShare, IconLink, IconCheck, IconWhatsApp, IconFacebook } from '@/components/ui/Icons'

/**
 * Compartilhar — usado na pagina de PRODUTO e na pagina da LOJA.
 *
 * ★ DOIS CAMINHOS, e o mobile ganha o melhor. Onde existe `navigator.share`
 * (praticamente todo celular), abre a folha NATIVA do sistema: o usuario manda
 * pro app que ele realmente usa, inclusive os que nao tem URL de share (Stories,
 * Telegram, AirDrop). O publico da Bynx e majoritariamente mobile, entao esse e
 * o caminho principal — o painel proprio e o fallback de desktop.
 *
 * ★ Instagram fica de fora de proposito: nao existe URL de compartilhamento pra
 * feed nem stories. Botao que nao funciona e pior que botao ausente — no
 * celular o Instagram aparece sozinho na folha nativa.
 *
 * `navigator.share` e `clipboard` exigem contexto seguro (https ou localhost) e
 * podem ser negados pelo usuario: os dois caminhos degradam sem quebrar.
 */
export default function BotaoCompartilhar({
  url,
  titulo,
  texto,
  compacto = false,
}: {
  /** Caminho absoluto do site, ex `/produto/x`. Vira URL completa aqui. */
  url: string
  titulo: string
  texto?: string
  /** Só o ícone, sem rótulo — pro cabeçalho da loja. */
  compacto?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const caixaRef = useRef<HTMLDivElement>(null)

  // ★ A capacidade e checada NO CLIQUE, nao no render. Guardar isso em estado
  // exigiria um `useEffect` (o `navigator` nao existe no servidor e checar no
  // primeiro render quebraria a hidratacao) — e setState dentro de efeito e
  // exatamente o que a regra `react-hooks/set-state-in-effect` barra. No clique
  // a informacao e a mesma e o componente fica sem efeito nenhum.
  const temShareNativo = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const urlCheia = typeof window !== 'undefined' ? `${window.location.origin}${url}` : `https://bynx.gg${url}`

  const fechar = useCallback(() => setAberto(false), [])

  useEffect(() => {
    if (!aberto) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') fechar() }
    function onClick(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) fechar()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [aberto, fechar])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlCheia)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Clipboard negado (permissao ou contexto inseguro): seleciona pro
      // usuario copiar na mao, em vez de nao fazer nada.
      const el = document.createElement('input')
      el.value = urlCheia
      document.body.appendChild(el)
      el.select()
      try { document.execCommand('copy'); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch {}
      document.body.removeChild(el)
    }
  }

  async function clicar() {
    if (temShareNativo()) {
      try {
        await navigator.share({ title: titulo, text: texto || titulo, url: urlCheia })
      } catch {
        // Usuario cancelou a folha nativa: nao e erro, nao faz nada.
      }
      return
    }
    setAberto(v => !v)
  }

  const msg = encodeURIComponent(`${texto || titulo} — ${urlCheia}`)

  return (
    <div style={S.wrap} ref={caixaRef}>
      <style>{`
        .bx-share-btn{transition:background .15s ease, border-color .15s ease}
        .bx-share-btn:hover{background:var(--bx-surface-3);border-color:var(--bx-border-2)}
        .bx-share-item{transition:background .15s ease}
        .bx-share-item:hover{background:var(--bx-surface-2)}
        @media (prefers-reduced-motion: reduce){
          .bx-share-btn,.bx-share-item{transition:none}
        }
      `}</style>

      <button
        type="button"
        onClick={clicar}
        className="bx-share-btn"
        style={compacto ? S.btnCompacto : S.btn}
        aria-label={`Compartilhar ${titulo}`}
        aria-expanded={aberto}
      >
        <IconShare size={compacto ? 17 : 16} color="currentColor" />
        {!compacto && <span>Compartilhar</span>}
      </button>

      {aberto && (
        <div style={S.painel} role="menu">
          <a
            className="bx-share-item"
            style={S.item}
            role="menuitem"
            href={`https://wa.me/?text=${msg}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={fechar}
          >
            <IconWhatsApp size={17} color="var(--bx-text-2)" /> WhatsApp
          </a>
          <a
            className="bx-share-item"
            style={S.item}
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlCheia)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={fechar}
          >
            <IconFacebook size={17} color="var(--bx-text-2)" /> Facebook
          </a>
          <a
            className="bx-share-item"
            style={S.item}
            role="menuitem"
            href={`https://x.com/intent/tweet?text=${msg}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={fechar}
          >
            <IconX /> X
          </a>
          <button type="button" className="bx-share-item" style={{ ...S.item, ...S.itemBtn }} role="menuitem" onClick={copiar}>
            {copiado
              ? <><IconCheck size={17} color="var(--bx-green)" /> <span style={{ color: 'var(--bx-green)' }}>Link copiado</span></>
              : <><IconLink size={17} color="var(--bx-text-2)" /> Copiar link</>}
          </button>
        </div>
      )}
    </div>
  )
}

/** X (Twitter) — nao existe no Icons.tsx; SVG inline no mesmo estilo. */
const IconX = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--bx-text-2)' }} aria-hidden="true">
    <path d="M4 4l16 16M20 4L4 20" />
  </svg>
)

const S: Record<string, CSSProperties> = {
  wrap: { position: 'relative', display: 'inline-flex' },
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    minHeight: 44, padding: '0 16px', borderRadius: 10,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text-2)', fontWeight: 700, fontSize: 13.5,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnCompacto: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 44, flex: 'none', borderRadius: 10,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text-2)', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
  },
  painel: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40,
    minWidth: 190, padding: 6, borderRadius: 12,
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)',
    boxShadow: 'var(--bx-shadow)', display: 'flex', flexDirection: 'column',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 9,
    minHeight: 44, padding: '0 12px', borderRadius: 8,
    color: 'var(--bx-text-2)', fontSize: 13.5, fontWeight: 600,
    textDecoration: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  itemBtn: { background: 'transparent', border: 'none', fontFamily: 'inherit', textAlign: 'left', width: '100%' },
}
