'use client'

import { useEffect } from 'react'
import { registrarSinal, origemDaNavegacao } from '@/lib/sinais'

/**
 * SinalCartaVista — marca "carta acessada". Nao renderiza nada.
 *
 * ★ O GATE DE HUMANIDADE NAO USA setTimeout DE PROPOSITO. O renderizador do
 * Google encurta timers, entao "espera 4s" nao e gate nenhum pra ele. Aqui a
 * condicao necessaria e um GESTO REAL (scroll, toque, clique ou tecla) que
 * aconteca depois de 2,5s de pagina aberta e com a aba visivel NO INSTANTE
 * do disparo -- e isso que o WRS nao produz.
 *
 * Montar aqui, e nao no Server Component da pagina, e a decisao inteira do
 * desenho: /carta/[id] tem revalidate longo, entao da 2a visita ate expirar
 * a pagina sai do CDN sem executar server-side. Contar la mediria "quantas
 * vezes o cache esfriou" -- que com ~66,9k paginas contra ~318 usuarios e,
 * na pratica, a cadencia de recrawl do Google.
 */
export default function SinalCartaVista({
  cardId,
  tipo,
}: {
  cardId: string
  tipo: 'view_pub' | 'view_app'
}) {
  useEffect(() => {
    if (!cardId) return

    const t0 = performance.now()
    const ac = new AbortController()
    let disparado = false

    function tentar() {
      if (disparado) return
      if (document.visibilityState !== 'visible') return
      if (performance.now() - t0 < 2500) return
      disparado = true
      ac.abort() // solta os listeners na hora
      registrarSinal(tipo, cardId, origemDaNavegacao())
    }

    // passive: o publico e majoritariamente mobile e listener de touch
    // nao-passivo trava scroll.
    const opt: AddEventListenerOptions = { passive: true, signal: ac.signal }
    window.addEventListener('scroll', tentar, opt)
    window.addEventListener('pointerdown', tentar, opt)
    window.addEventListener('touchstart', tentar, opt)
    window.addEventListener('keydown', tentar, opt)

    return () => ac.abort()
    // cardId na dep reinicia o relogio quando a carta muda -- e o que impede
    // folhear a Pokedex pela seta de creditar dezenas de cartas atravessadas.
  }, [cardId, tipo])

  return null
}
