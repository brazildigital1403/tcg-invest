// Descadastro de e-mail de RELACIONAMENTO (nurture).
//
// Dois metodos, de proposito:
//   POST  -> e o que o Gmail/Yahoo chamam sozinhos quando a pessoa clica em
//            "Cancelar inscricao" na propria interface da caixa (RFC 8058,
//            List-Unsubscribe-Post: List-Unsubscribe=One-Click). Responde 200
//            e pronto — ninguem le a resposta.
//   GET   -> e a pessoa clicando no link do rodape. Devolve uma pagina de
//            confirmacao, porque um 200 vazio parece que nao funcionou.
//
// Rota PUBLICA: quem clica esta no cliente de e-mail, sem sessao. A protecao
// e o token — uuid aleatorio por usuario, unico, nao derivado de segredo.
// Nao ha o que enumerar e nao ha chave nova pra guardar.
//
// NAO desliga e-mail transacional (recibo, pedido, ticket, master set, loja).
// Ninguem pode optar por nao receber a confirmacao de uma compra que fez.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/** Marca o opt-out. Idempotente: clicar duas vezes da o mesmo resultado. */
async function descadastrar(token: string): Promise<'ok' | 'invalido' | 'erro'> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return 'invalido'
  const sb = supabaseAdmin()

  const { data, error } = await sb
    .from('users')
    .update({ email_optout_nurture: true })
    .eq('unsubscribe_token', token)
    .select('id')

  if (error) {
    console.error('[email/descadastrar]', error.message)
    return 'erro'
  }
  return data && data.length > 0 ? 'ok' : 'invalido'
}

// ─── POST: um clique, chamado pela caixa de e-mail (RFC 8058) ───────────────
export async function POST(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('t') || ''
  const r = await descadastrar(token)
  // A caixa nao mostra essa resposta. Mesmo token invalido responde 200: dar
  // 404 aqui so faria o provedor marcar o link como quebrado.
  return NextResponse.json({ ok: r === 'ok' }, { status: 200 })
}

// ─── GET: pessoa clicou no link do rodape ───────────────────────────────────
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('t') || ''
  const r = await descadastrar(token)

  const titulo = r === 'ok' ? 'Pronto, você saiu da lista' : 'Não conseguimos confirmar'
  const texto = r === 'ok'
    ? 'Você não vai mais receber nossos e-mails de novidade e lembrete. Recibo de compra, pedido do Mercado e resposta de suporte continuam chegando — esses são sobre coisas que você fez na conta.'
    : 'Esse link parece inválido ou expirado. Se quiser sair da lista, responda qualquer e-mail nosso que a gente resolve.'

  return new NextResponse(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Descadastro — Bynx.gg</title>
<style>
  body{margin:0;background:#080a0f;color:#f0f0f0;font-family:'DM Sans',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
       display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .c{max-width:440px;background:#0d0f14;border:1px solid #1f2937;border-radius:20px;padding:36px 30px;text-align:center}
  h1{font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0 0 10px}
  p{font-size:14px;line-height:1.7;color:rgba(255,255,255,.6);margin:0 0 22px}
  a{display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#000;font-weight:800;
    font-size:14px;text-decoration:none;padding:12px 26px;border-radius:11px}
</style></head><body>
<div class="c">
  <h1>${titulo}</h1>
  <p>${texto}</p>
  <a href="https://bynx.gg">Voltar para a Bynx</a>
</div></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
  )
}
