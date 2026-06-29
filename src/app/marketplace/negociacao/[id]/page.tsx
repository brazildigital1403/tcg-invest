/**
 * src/app/marketplace/negociacao/[id]/page.tsx
 *
 * A conversa agora vive no ChatDock (inbox unificado, global). Esta rota antiga
 * vira um redirect: links/sino antigos abrem o dock na conversa certa via
 * ?conversa=<id> no /marketplace.
 */
import { redirect } from 'next/navigation'

export default async function NegociacaoRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/marketplace?conversa=${id}`)
}
