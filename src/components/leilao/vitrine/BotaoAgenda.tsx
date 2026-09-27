'use client'

import { useCallback } from 'react'
import { IconCalendar } from '@/components/ui/Icons'
import { urlRodada } from '@/lib/leilao-urls'
import { gerarIcsRodada, nomeArquivoIcs } from '@/lib/leilao-vitrine'

/**
 * "Adicionar à agenda": gera o .ics da rodada NO APARELHO e baixa. Sem banco,
 * sem rota, sem login. O link do evento e a pagina publica da rodada.
 */
export default function BotaoAgenda({
  numero,
  titulo,
  iniciaEm,
  descricao,
  variante = 'link',
}: {
  numero: number
  titulo: string
  iniciaEm: string
  descricao?: string | null
  variante?: 'link' | 'caixa'
}) {
  const baixar = useCallback(() => {
    const url = `${window.location.origin}${urlRodada(numero)}`
    const ics = gerarIcsRodada({ numero, titulo, iniciaEm, url, descricao, agoraMs: Date.now() })
    if (!ics) return
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = nomeArquivoIcs(numero)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }, [numero, titulo, iniciaEm, descricao])

  return (
    <button
      type="button"
      onClick={baixar}
      className={variante === 'caixa' ? 'vt-agendar vt-agendar-caixa' : 'vt-agendar'}
      aria-label={`Adicionar à agenda: ${titulo}`}
    >
      <IconCalendar size={15} />
      Adicionar à agenda
    </button>
  )
}
