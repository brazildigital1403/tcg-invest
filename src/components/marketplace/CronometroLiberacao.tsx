'use client'

import { useEffect, useState } from 'react'
import { IconClock } from '@/components/ui/Icons'
import { HORAS_ATE_LIBERAR, HORAS_RETA_FINAL } from '@/lib/marketplaceStatus'

/**
 * Quanto falta pra um anuncio travado voltar pro marketplace.
 *
 * ★ POR QUE ELE APARECE EM VEZ DE SUMIR (08/09/2026). Ate hoje o anuncio em
 * negociacao DESAPARECIA da vitrine da loja e do bloco de ofertas da carta
 * (as duas filtram `status = 'disponivel'`). A loja parecia ter menos estoque
 * do que tem, e a pagina da carta escondia uma oferta que vai voltar.
 *
 * A decisao do Du foi o contrario de esconder: a carta fica a vista, com o
 * tempo restante, justamente pra dar motivo de voltar depois das 72h. E o
 * padrao que o mercado usa quando o prazo e curto -- eBay e OLX deixam o item
 * vendavel durante a negociacao; quem TIRA do ar usa prazo longo (Vinted 5
 * dias, Cardmarket 7). Prazo curto + exclusividade total, que era o nosso
 * caso, ninguem faz.
 *
 * ★ A ARTE NAO E ACINZENTADA. A carta e o que atrai; quem comunica o
 * travamento e esta faixa, nao a cor da imagem.
 */

type Variante = 'faixa' | 'inline' | 'painel'

function partes(msRestante: number) {
  const t = Math.max(0, Math.floor(msRestante / 1000))
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, total: t }
}

function rotulo(ms: number, variante: Variante) {
  const { h, m, s } = partes(ms)
  if (variante === 'painel') {
    return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
  }
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export default function CronometroLiberacao({
  liberaEm,
  variante = 'faixa',
}: {
  /** ISO devolvido por `liberaEm()` do lib de status. */
  liberaEm: string
  variante?: Variante
}) {
  const alvo = new Date(liberaEm).getTime()
  const [restante, setRestante] = useState(() => alvo - Date.now())

  useEffect(() => {
    // ★ Segundo a segundo so na variante `painel`, que mostra segundos. Nas
    // outras o texto muda de minuto em minuto -- um timer de 1s ali seria
    // 60x mais re-render pra pintar o mesmo pixel.
    const passo = variante === 'painel' ? 1000 : 30_000
    const id = setInterval(() => setRestante(alvo - Date.now()), passo)
    return () => clearInterval(id)
  }, [alvo, variante])

  // Passou da hora e a varredura ainda nao rodou (ela roda de 6 em 6h). Dizer
  // "0h 00min" seria mentira parada; "a qualquer momento" e o que e verdade.
  // ★ O texto tem que se sustentar SOZINHO nas duas pontas. A primeira versao
  //   punha "pra liberar" fixo do lado de fora, e num anuncio ja vencido saia
  //   "a qualquer momento pra liberar" -- emendado, sem sentido. O verbo
  //   entrou pra dentro do componente, que e quem sabe se venceu.
  const vencido = restante <= 0
  const retaFinal = !vencido && restante <= HORAS_RETA_FINAL * 3600_000
  const cor = retaFinal || vencido ? 'var(--bx-amber)' : 'var(--bx-blue)'
  const texto = vencido ? 'a qualquer momento' : rotulo(restante, variante)

  if (variante === 'inline') {
    return (
      <span
        suppressHydrationWarning
        title={`Volta pro marketplace em ${new Date(liberaEm).toLocaleString('pt-BR')}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 10.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          color: cor, background: retaFinal || vencido ? 'rgba(245,158,11,0.10)' : 'rgba(96,165,250,0.10)',
          border: `1px solid ${retaFinal || vencido ? 'rgba(245,158,11,0.28)' : 'rgba(96,165,250,0.28)'}`,
          borderRadius: 5, padding: '1px 6px',
        }}
      >
        <IconClock size={11} color={cor} />
        {vencido ? 'libera a qualquer momento' : `libera em ${texto}`}
      </span>
    )
  }

  if (variante === 'painel') {
    const decorrido = Math.min(1, Math.max(0, 1 - restante / (HORAS_ATE_LIBERAR * 3600_000)))
    return (
      <div style={{ border: `1px solid ${retaFinal || vencido ? 'rgba(245,158,11,0.30)' : 'rgba(96,165,250,0.30)'}`, background: retaFinal || vencido ? 'rgba(245,158,11,0.06)' : 'rgba(96,165,250,0.06)', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: cor }}>
          <IconClock size={15} color={cor} />
          {vencido ? 'Liberando' : retaFinal ? 'Libera hoje' : 'Em negociação'}
        </div>
        <div suppressHydrationWarning style={{ fontFamily: 'var(--font-mono, ui-monospace), monospace', fontSize: 34, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', margin: '8px 0 2px', color: 'var(--bx-text)' }}>
          {texto}
        </div>
        <p style={{ fontSize: 13, color: 'var(--bx-text-2)', maxWidth: '56ch' }}>
          Esta carta está reservada pra outro comprador. Se a negociação não andar,
          ela volta pro marketplace automaticamente e fica livre pra qualquer um —
          inclusive você. Cada mensagem trocada reinicia as {HORAS_ATE_LIBERAR}h.
        </p>
        <div style={{ height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.07)', margin: '14px 0 4px', overflow: 'hidden' }}>
          <i suppressHydrationWarning style={{ display: 'block', height: '100%', borderRadius: 100, background: cor, width: `${(decorrido * 100).toFixed(1)}%`, transition: 'width 0.2s ease' }} />
        </div>
      </div>
    )
  }

  // `faixa`: sobre a arte da carta, no card.
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3,
      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
      background: 'linear-gradient(to top, rgba(4,6,10,0.94), rgba(4,6,10,0.72) 70%, transparent)',
      backdropFilter: 'blur(3px)',
    }}>
      <IconClock size={14} color={cor} />
      <span suppressHydrationWarning style={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: cor }}>
        {texto}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--bx-text-3)', marginLeft: 'auto', fontWeight: 600 }}>
        {vencido ? 'liberando' : 'pra liberar'}
      </span>
    </div>
  )
}
