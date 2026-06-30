import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminToken } from '@/lib/admin-auth'

// Apenas informa se a sessao admin (cookie httpOnly) esta ativa.
// Usado pela UI (WorldSwitcher) para decidir exibir a aba "Admin".
// Nao expoe nenhum dado sensivel — so um booleano.
export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const isAdmin = await verifyAdminToken(token)
  return NextResponse.json({ isAdmin }, { headers: { 'Cache-Control': 'no-store' } })
}
