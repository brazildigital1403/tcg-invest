import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailLojaAprovada, sendEmailLojaVerificacao } from '@/lib/email'
import { requireAdmin } from '@/lib/admin-auth'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

// POST /api/admin/lojas/[id]/approve
// Aprova loja pendente ou suspensa → ativa
// Envia email APENAS na primeira aprovação (aprovada_data nulo antes)

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const unauth = await requireAdmin(req)
    if (unauth) return unauth

    const { id } = await ctx.params
    const sb = supabaseAdmin()

    // 1) Busca loja
    const { data: lojas, error: lErr } = await sb
      .from('lojas')
      .select('id, nome, slug, status, owner_user_id, aprovada_data, verificada, verificacao_ticket_id')
      .eq('id', id)
      .limit(1)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
    if (!lojas?.[0]) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 })

    const loja = lojas[0]

    // 2) Valida transição
    if (loja.status === 'ativa') {
      return NextResponse.json({ error: 'Loja já está ativa' }, { status: 400 })
    }
    if (loja.status === 'inativa') {
      return NextResponse.json({
        error: 'Loja está inativa — o owner precisa reativar antes via /api/lojas/[id]'
      }, { status: 400 })
    }

    const primeiraAprovacao = !loja.aprovada_data

    // 3) Atualiza loja
    const patch: any = {
      status: 'ativa',
      suspensao_motivo: null,
      suspensao_data: null,
      suspenso_por: null,
      updated_at: new Date().toISOString(),
    }
    if (primeiraAprovacao) {
      patch.aprovada_data = new Date().toISOString()
    }

    const { data: updated, error: uErr } = await sb
      .from('lojas')
      .update(patch)
      .eq('id', id)
      .select()
      .limit(1)
    if (uErr) {
      console.error('[admin/lojas/[id]/approve] update failed:', uErr.message)
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    // 4) Envia email apenas na primeira aprovação (não spammar reativações)
    if (primeiraAprovacao && loja.owner_user_id) {
      try {
        const { data: owner } = await sb
          .from('users')
          .select('email, name')
          .eq('id', loja.owner_user_id)
          .limit(1)
        if (owner?.[0]?.email) {
          await sendEmailLojaAprovada({
            to:        owner[0].email,
            nomeUser:  owner[0].name || 'colecionador',
            nomeLoja:  loja.nome,
            slug:      loja.slug,
          })
        }
      } catch (e: any) {
        // Loga mas não falha a request — aprovação vale mais que o email
        console.error('[admin/lojas/[id]/approve] email failed:', e?.message)
      }

      // ─── Verificação: abre a conversa que pede os documentos ────────────
      //
      // Aprovar poe a loja no ar. O SELO de Loja Validada e outra coisa, e
      // depende de conferir CNPJ e documento do responsavel. Ate agora nao
      // havia canal nenhum pra pedir isso.
      //
      // Vira um TICKET, nao um e-mail solto: o remetente e noreply@, entao
      // "responda com os arquivos" nao entregaria nada. No ticket ha upload
      // em bucket privado, e a conversa fica registrada na conta da pessoa.
      //
      // Nao repete se a loja JA e verificada nem se ja existe a conversa.
      if (!loja.verificada && !loja.verificacao_ticket_id) {
        try {
          const { data: owner } = await sb
            .from('users').select('email, name').eq('id', loja.owner_user_id).limit(1)
          const dono = owner?.[0]

          if (dono?.email) {
            const { data: criados, error: tErr } = await sb
              .from('tickets')
              .insert({ user_id: loja.owner_user_id, subject: `Verificação da ${loja.nome}` })
              .select('id')
              .limit(1)

            if (tErr || !criados?.[0]) throw new Error(tErr?.message || 'falha ao criar ticket')
            const ticketId = criados[0].id

            await sb.from('ticket_messages').insert({
              ticket_id: ticketId,
              sender_type: 'admin',
              sender_id: null,
              content:
                `Olá! Aqui é o Eduardo, fundador da Bynx.\n\n` +
                `Para liberar o Selo de Loja Validada da ${loja.nome}, preciso confirmar alguns itens. ` +
                `É só anexar aqui nesta conversa:\n\n` +
                `• Cartão CNPJ da loja, com situação cadastral ativa (ou CCMEI, no caso de MEI)\n` +
                `• Documento do responsável pela conta (RG ou CNH)\n` +
                `• Um canal ativo de vendas (site, Instagram ou perfil em marketplace)\n` +
                `• Uma ou duas fotos da loja física ou do estoque\n\n` +
                `Uso essas informações apenas para a validação e não compartilho com terceiros. ` +
                `Assim que eu conferir, o selo é ativado no mesmo dia e os arquivos são apagados.\n\n` +
                `Um detalhe importante: dados bancários e fiscais para receber pagamentos não entram aqui — ` +
                `isso é feito de forma segura na hora de ativar o recebimento pela plataforma.`,
            })

            await sb.from('lojas').update({ verificacao_ticket_id: ticketId }).eq('id', id)

            await sendEmailLojaVerificacao({
              to: dono.email,
              nomeUser: dono.name || '',
              nomeLoja: loja.nome,
              ticketId,
            })
          }
        } catch (e: any) {
          // Nao derruba a aprovacao: a loja ja esta no ar, e a verificacao
          // pode ser pedida depois pelo botao "Falar com dono".
          console.error('[admin/lojas/[id]/approve] verificacao falhou:', e?.message)
        }
      }
    }

    return NextResponse.json({ loja: updated?.[0], primeiraAprovacao })
  } catch (err: any) {
    console.error('[admin/lojas/[id]/approve POST]', err?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
