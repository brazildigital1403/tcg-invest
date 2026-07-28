import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/admin/lojas/[id]/toggle-verified
// Alterna flag `verificada`. Não envia email (mudança silenciosa).

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    // Busca valor atual
    const { data: lojas } = await sb
      .from('lojas')
      .select('id, verificada, verificacao_ticket_id')
      .eq('id', id)
      .limit(1)
    if (!lojas?.[0]) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    const novoValor = !lojas[0].verificada

    const { data: updated, error } = await sb
      .from('lojas')
      .update({
        verificada: novoValor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .limit(1)

    if (error) {
      console.error('[admin/lojas/[id]/toggle-verified]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ─── Verificou: apaga os documentos ────────────────────────────────
    //
    // O e-mail promete "uso essas informacoes apenas para a validacao". Isso
    // so e verdade se os arquivos SUMIREM depois — RG e CNH de terceiro
    // parados no servidor sao passivo, nao ativo.
    //
    // Some o ARQUIVO; a conversa fica, como registro de que a verificacao
    // aconteceu e do que foi pedido.
    //
    // Roda depois do update: se falhar, a loja ja esta verificada e o erro
    // aparece no log. O contrario — segurar a verificacao porque a limpeza
    // falhou — seria pior.
    let anexosApagados = 0
    if (novoValor && lojas[0].verificacao_ticket_id) {
      try {
        const ticketId = lojas[0].verificacao_ticket_id
        const { data: anexos } = await sb
          .from('ticket_anexos').select('id, path').eq('ticket_id', ticketId)

        if (anexos?.length) {
          const { error: rmErr } = await sb.storage
            .from('ticket-anexos').remove(anexos.map(a => a.path))
          if (rmErr) throw new Error(`storage: ${rmErr.message}`)

          await sb.from('ticket_anexos').delete().eq('ticket_id', ticketId)
          anexosApagados = anexos.length

          await sb.from('ticket_messages').insert({
            ticket_id: ticketId,
            sender_type: 'admin',
            sender_id: null,
            content:
              'Verificação concluída — o Selo de Loja Validada já está ativo no seu perfil. ' +
              `Como combinado, os ${anexos.length} arquivo(s) que você enviou foram apagados dos nossos servidores.`,
          })
        }
      } catch (e: any) {
        console.error('[admin/lojas/toggle-verified] CRITICAL: nao consegui apagar os anexos da verificacao:', e?.message)
      }
    }

    return NextResponse.json({ loja: updated?.[0], verificada: novoValor, anexosApagados })
  } catch (err: any) {
    console.error('[admin/lojas/[id]/toggle-verified POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
