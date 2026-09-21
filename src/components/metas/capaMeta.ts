/**
 * Capa da meta na lista: as artes gravadas no aparelho quando a pessoa abre a
 * meta (a lista le so o retrato numerico da tabela, sem cartas -- recalcular
 * por meta a cada visita custaria uma varredura por meta). Conveniencia de
 * visualizacao: some sem prejuizo em aba anonima ou com o armazenamento
 * bloqueado, e a lista cai no anel sozinho.
 */
import type { CartaLeque } from '@/components/metas/LequeCartas'

const chave = (id: string) => `bx-meta-capa-${id}`

export function lerCapa(id: string): CartaLeque[] | null {
  try {
    const raw = localStorage.getItem(chave(id))
    if (!raw) return null
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as CartaLeque[]).slice(0, 5) : null
  } catch { return null }
}

export function gravarCapa(id: string, cartas: CartaLeque[]) {
  try { localStorage.setItem(chave(id), JSON.stringify(cartas.slice(0, 5))) } catch {}
}
