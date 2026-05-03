import { redirect } from 'next/navigation'

/**
 * Rota /cadastro — redirect server-side pra modal de signup da home.
 *
 * O Bynx unificou todo o fluxo de cadastro no modal rico da landing principal
 * (com escolha de plano). Esta rota fica preservada (não foi deletada) pra
 * que possa ser reutilizada no futuro como destino de campanhas, fluxos
 * especiais, ou redirects de SEO/legacy URLs.
 *
 * O arquivo legacy com o formulário longo está preservado em
 * `_legacy-form.tsx` (Next.js ignora arquivos prefixados com underscore,
 * então não vira rota mas o código fica acessível).
 *
 * Suporta query params:
 *   /cadastro                    → /?auth=signup
 *   /cadastro?next=/X            → /?auth=signup&next=/X
 *   /cadastro?plano=mensal       → /?auth=signup&plano=mensal (futuro)
 *
 * O redirect é HTTP 307 (temporary), preservando query string original.
 */
export default function CadastroPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  // Constrói destino com auth=signup + qualquer query param recebido
  const params = new URLSearchParams()
  params.set('auth', 'signup')

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'auth') continue // não duplica
    if (typeof value === 'string') params.set(key, value)
  }

  redirect(`/?${params.toString()}`)
}
