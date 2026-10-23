// src/app/api/criadores/parceria/route.ts
//
// "Quero ser parceiro da Bynx": marca o pedido no resgate do convite, com o @.
// So registra. O cupom e a comissao saem quando o Du aprova em
// /admin/parceiros (cria na Stripe LIVE) -- nada automatico.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { usuarioDoToken } from '@/lib/convitesGrupo'
import { sendPedidoParceriaEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const user = await usuarioDoToken(req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Entre na sua conta para pedir a parceria.' }, { status: 401 })

  const { instagram } = (await req.json().catch(() => ({}))) as { instagram?: string }
  const ig = (instagram || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').toLowerCase()
  if (!/^[a-z0-9._]{1,30}$/.test(ig)) return NextResponse.json({ error: 'Informe o seu @ do Instagram.', campo: 'instagram' }, { status: 400 })

  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível. Tente de novo em instantes.' }, { status: 503 })

  // O e-mail de confirmacao (com a apresentacao) sai so no PRIMEIRO pedido:
  // reenviar o @ atualiza o registro sem mandar outro e-mail.
  const { data: antes } = await sb.from('convite_grupo_resgates').select('quer_parceria').eq('user_id', user.id).limit(1)
  const primeiroPedido = !!antes?.[0] && !antes[0].quer_parceria

  const { data, error } = await sb
    .from('convite_grupo_resgates')
    .update({ quer_parceria: true, instagram: ig, parceria_pedida_em: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('id')
  if (error) {
    console.error('[criadores/parceria]', error.message)
    return NextResponse.json({ error: 'Não conseguimos registrar agora. Tente de novo em instantes.' }, { status: 500 })
  }
  if (!data?.length) {
    return NextResponse.json({ error: 'Ative o seu ano de Pro primeiro. A parceria vem logo depois.', code: 'SEM_RESGATE' }, { status: 409 })
  }
  if (primeiroPedido && user.email) {
    const { data: u } = await sb.from('users').select('name').eq('id', user.id).limit(1)
    try {
      await sendPedidoParceriaEmail({ to: user.email, nome: u?.[0]?.name, instagram: ig, userId: user.id })
    } catch (e) {
      console.error('[criadores/parceria] e-mail de confirmacao falhou:', e instanceof Error ? e.message : e)
    }
  }
  return NextResponse.json({ ok: true })
}
