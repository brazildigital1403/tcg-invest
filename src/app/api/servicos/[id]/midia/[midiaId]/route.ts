// GET /api/servicos/[id]/midia/[midiaId] -- link assinado CURTO para uma midia.
//
// O bucket e privado e nao tem policy: a unica forma de ver uma foto ou o
// video de abertura e pedir aqui, sendo o dono da solicitacao ou admin. O link
// vale 5 minutos e nunca e gravado em lugar nenhum.

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, carregarAutorizado, erro, BUCKET_SERVICOS } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; midiaId: string }> }) {
  try {
    const { id, midiaId } = await ctx.params
    const auth = await carregarAutorizado(req, id, { permitirAdmin: true })
    if (!auth.ok) return auth.resposta

    const sb = sbAdmin()
    const { data } = await sb.from('servico_midias').select('path, mime').eq('id', midiaId).eq('solicitacao_id', id).limit(1)
    const midia = data?.[0]
    if (!midia) return erro(404, 'Arquivo não encontrado')

    const { data: assinado, error } = await sb.storage.from(BUCKET_SERVICOS).createSignedUrl(midia.path, 300)
    if (error || !assinado) {
      console.error('[servicos/midia]', error?.message)
      return erro(500, 'Não conseguimos abrir o arquivo')
    }
    return NextResponse.json({ url: assinado.signedUrl, mime: midia.mime }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[servicos/midia]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
