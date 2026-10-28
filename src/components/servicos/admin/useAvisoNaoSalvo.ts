'use client'

// Aviso de alteracao nao salva no pedido de servico do admin. No #S-0006
// (26/10/2026) a ficha de entrada e a proposta foram preenchidas, o Du abriu o
// "Medir centralizacao" pelo link e as duas sumiram sem aviso: nada tinha sido
// salvo. Cada formulario registra se esta sujo; enquanto houver algum, fechar a
// aba ou seguir um link da pagina pede confirmacao (um aviso so, mesmo com
// varios formularios sujos).

import { useEffect, useRef } from 'react'

const sujos = new Set<symbol>()
let instalado = false
const TEXTO = 'Há alterações não salvas nesta página (ficha, proposta ou laudo). Sair mesmo assim?'

function antesDeSair(e: BeforeUnloadEvent) {
  e.preventDefault()
  e.returnValue = ''
}

// Fase de captura no document: roda antes do onClick do <Link> do Next, e o
// preventDefault faz o Link desistir da navegacao.
function aoClicar(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return
  if (!window.confirm(TEXTO)) { e.preventDefault(); e.stopPropagation() }
}

function sincronizar() {
  if (sujos.size && !instalado) {
    window.addEventListener('beforeunload', antesDeSair)
    document.addEventListener('click', aoClicar, true)
    instalado = true
  } else if (!sujos.size && instalado) {
    window.removeEventListener('beforeunload', antesDeSair)
    document.removeEventListener('click', aoClicar, true)
    instalado = false
  }
}

export function useAvisoNaoSalvo(sujo: boolean) {
  const id = useRef<symbol | null>(null)
  useEffect(() => {
    if (!id.current) id.current = Symbol('form')
    const k = id.current
    if (sujo) sujos.add(k)
    else sujos.delete(k)
    sincronizar()
    return () => { sujos.delete(k); sincronizar() }
  }, [sujo])
}
