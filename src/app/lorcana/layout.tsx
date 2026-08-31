import { notFound } from 'next/navigation'
import { LORCANA_ENABLED } from '@/lib/flags'

// Casca do contexto Lorcana. Duas responsabilidades:
// 1. Gate: sem a flag (producao ate a F8), toda /lorcana/* e 404 — nenhuma
//    query roda, nenhuma superficie de crawl nasce.
// 2. Acento: .bx-game-lorcana sobrescreve os tokens --ac-* (teal->azul);
//    todo componente tokenizado herda sozinho, mesmo mecanismo da loja.
export default function LorcanaLayout({ children }: { children: React.ReactNode }) {
  if (!LORCANA_ENABLED) notFound()
  return <div className="bx-game-lorcana">{children}</div>
}
