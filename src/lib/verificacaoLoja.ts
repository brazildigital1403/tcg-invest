// Abre (ou reaproveita) a conversa de verificacao de uma loja.
//
// Vive aqui porque tem DOIS gatilhos e eles nao podem divergir:
//   1. automatico, na primeira aprovacao  (api/admin/lojas/[id]/approve)
//   2. manual, pelo botao do admin        (api/admin/lojas/[id]/verificacao)
//
// O manual existe por um motivo concreto: o automatico so pega loja NOVA. As
// que ja estavam aprovadas antes disso existir — a maioria — nunca receberiam
// o pedido, e several delas seguem sem o selo.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmailLojaVerificacao } from '@/lib/email'

export interface ResultadoVerificacao {
  ok: boolean
  ticketId?: string
  reaproveitou?: boolean
  emailEnviado?: boolean
  para?: string
  erro?: string
}

/** Texto do checklist. Espelha o e-mail — quem responde le este aqui. */
function mensagemInicial(nomeLoja: string): string {
  return (
    `Olá! Aqui é o Eduardo, fundador da Bynx.\n\n` +
    `Para liberar o Selo de Loja Validada da ${nomeLoja}, preciso confirmar alguns itens. ` +
    `É só anexar aqui nesta conversa:\n\n` +
    `• Cartão CNPJ da loja, com situação cadastral ativa (ou CCMEI, no caso de MEI)\n` +
    `• Documento do responsável pela conta (RG ou CNH)\n` +
    `• Um canal ativo de vendas (site, Instagram ou perfil em marketplace)\n` +
    `• Uma ou duas fotos da loja física ou do estoque\n\n` +
    `Uso essas informações apenas para a validação e não compartilho com terceiros. ` +
    `Assim que eu conferir, o selo é ativado no mesmo dia e os arquivos são apagados.\n\n` +
    `Um detalhe importante: dados bancários e fiscais para receber pagamentos não entram aqui — ` +
    `isso é feito de forma segura na hora de ativar o recebimento pela plataforma.`
  )
}

export async function abrirVerificacaoDeLoja(
  sb: SupabaseClient,
  loja: { id: string; nome: string; owner_user_id: string | null; verificacao_ticket_id?: string | null }
): Promise<ResultadoVerificacao> {
  if (!loja.owner_user_id) return { ok: false, erro: 'Loja sem dono vinculado' }

  const { data: donos } = await sb
    .from('users').select('email, name').eq('id', loja.owner_user_id).limit(1)
  const dono = donos?.[0]
  if (!dono?.email) return { ok: false, erro: 'Dono da loja sem e-mail' }

  // Se ja existe conversa, reaproveita em vez de abrir outra: duas threads
  // pro mesmo pedido confundem quem responde e espalham os anexos.
  let ticketId = loja.verificacao_ticket_id || null
  let reaproveitou = false

  if (ticketId) {
    const { data: existe } = await sb.from('tickets').select('id').eq('id', ticketId).limit(1)
    if (existe?.[0]) reaproveitou = true
    else ticketId = null   // referencia orfa (ticket apagado) — abre outra
  }

  if (!ticketId) {
    const { data: criados, error: tErr } = await sb
      .from('tickets')
      .insert({ user_id: loja.owner_user_id, subject: `Verificação da ${loja.nome}` })
      .select('id').limit(1)
    if (tErr || !criados?.[0]) return { ok: false, erro: tErr?.message || 'Falha ao criar a conversa' }
    ticketId = criados[0].id

    const { error: mErr } = await sb.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_type: 'admin',
      sender_id: null,
      content: mensagemInicial(loja.nome),
    })
    if (mErr) return { ok: false, erro: mErr.message }

    await sb.from('lojas').update({ verificacao_ticket_id: ticketId }).eq('id', loja.id)
  }

  // O e-mail vai mesmo quando a conversa e reaproveitada: e o lembrete de
  // quem nao respondeu, que e justamente o caso de quem ja tinha o pedido.
  const { error } = await sendEmailLojaVerificacao({
    to: dono.email,
    nomeUser: dono.name || '',
    nomeLoja: loja.nome,
    ticketId: ticketId!,
  })

  return {
    ok: true,
    ticketId: ticketId!,
    reaproveitou,
    emailEnviado: !error,
    para: dono.email,
  }
}
