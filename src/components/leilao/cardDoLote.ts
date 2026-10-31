import type { CardItemData } from '@/components/ui/CardItem'
import { GRADUADORA_MAP } from '@/lib/graduadoras'
import type { LotePublico } from '@/lib/leilao'

/**
 * Lote do leilao -> formato que o CardItem entende.
 *
 * A graduadora vem como texto livre do vendedor ("PSA", "psa"); o CardItem
 * indexa `GRADUADORA_MAP` pelo slug minusculo. Graduadora fora do catalogo
 * fica sem slab (melhor sem selo do que com cor errada).
 */
export function cardDoLote(l: LotePublico): CardItemData {
  const gradSlug = (l.graduadora ?? '').trim().toLowerCase()
  const graduada = !!gradSlug && !!GRADUADORA_MAP[gradSlug]
  const notaNum = l.nota != null ? Number(String(l.nota).replace(',', '.')) : NaN
  return {
    id: l.id,
    card_name: l.cardName,
    card_id: l.cardNumero ?? undefined,
    // Foto real do vendedor primeiro: e a carta que o comprador vai receber.
    card_image: l.fotos[0] || l.cardImage || undefined,
    set_name: l.setNome ?? undefined,
    idioma: l.idioma ?? undefined,
    graduada,
    graduadora: graduada ? gradSlug : null,
    nota: graduada && Number.isFinite(notaNum) ? notaNum : null,
  }
}

/** "PSA 10", ou vazio. Para titulo e metadata. */
export function rotuloGraduacao(l: Pick<LotePublico, 'graduadora' | 'nota'>): string {
  if (!l.graduadora) return ''
  const g = GRADUADORA_MAP[l.graduadora.trim().toLowerCase()]
  return [g?.curto ?? l.graduadora.trim(), l.nota].filter(Boolean).join(' ')
}
