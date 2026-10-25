// src/app/api/criadores/cadastro/route.ts
//
// Cadastro em um passo do convite de grupo (/criadores). Molde da Presente
// (api/presente/cadastro): a conta nasce no servidor, ja confirmada, e o
// navegador troca o hash do link magico por sessao com verifyOtp.
//
// Por que confirmada sem link no e-mail (decisao do Du, 23/10/2026): a
// confirmacao era a etapa onde as tres ofertas pagas morreram. O risco de
// e-mail digitado errado fica coberto pelo teto do convite, pelo limite por IP
// e pelo Turnstile.
//
// Sem CPF e sem nascimento: so a declaracao de 13 anos ou mais. CPF so entra
// se a pessoa pedir a Parceria (recebimento).
//
// Turnstile: o segredo do captcha do site vive no Auth do Supabase, que o
// createUser nao usa. Com TURNSTILE_SECRET_KEY na Vercel, o token vira
// obrigatorio aqui; sem ela, o freio e o limite por IP + o teto do convite.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { senhaValida, SENHA_REGRA_MSG, ehErroDeRegraDeSenha } from '@/lib/senha'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'
import {
  buscarConviteGrupo, estadoDoConvite, normalizarCodigo, registrarEventoConvite, resgatarConviteGrupo, MENSAGEM_RESGATE,
} from '@/lib/convitesGrupo'

const limite = criarLimitador({ janelaMs: 10 * 60_000, max: 5 })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function captchaOk(token: unknown, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || !token) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body, signal: AbortSignal.timeout(5000),
    })
    const d = (await r.json().catch(() => ({}))) as { success?: boolean }
    return d.success === true
  } catch (e) {
    console.error('[criadores/cadastro] turnstile falhou:', e instanceof Error ? e.message : e)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = ipDaRequest(req)
    limite.gc()
    if (ip && limite.excedeu(ip)) {
      return NextResponse.json({ error: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { c, nome, email, senha, termos, idade13, marketing, captcha } = body as {
      c?: string; nome?: string; email?: string; senha?: string; termos?: boolean; idade13?: boolean; marketing?: boolean; captcha?: string
    }

    const convite = await buscarConviteGrupo(c)
    const estado = estadoDoConvite(convite)
    if (!convite || estado === 'invalido') {
      return NextResponse.json({ error: MENSAGEM_RESGATE.CONVITE_INVALIDO, code: 'CONVITE_INVALIDO' }, { status: 404 })
    }
    if (estado === 'encerrado') {
      return NextResponse.json({ error: MENSAGEM_RESGATE.CONVITE_ENCERRADO, code: 'CONVITE_ENCERRADO' }, { status: 410 })
    }
    await registrarEventoConvite(convite.id, 'envio')

    const nomeLimpo = (nome || '').replace(/\s+/g, ' ').trim()
    const emailLimpo = (email || '').trim().toLowerCase()
    if (nomeLimpo.length < 2) return NextResponse.json({ error: 'Informe seu nome.', campo: 'nome' }, { status: 400 })
    if (!EMAIL_RE.test(emailLimpo)) return NextResponse.json({ error: 'Informe um e-mail válido.', campo: 'email' }, { status: 400 })
    if (!senhaValida(senha || '')) return NextResponse.json({ error: SENHA_REGRA_MSG, campo: 'senha' }, { status: 400 })
    if (termos !== true) return NextResponse.json({ error: 'Aceite os Termos de Uso e a Política de Privacidade.', campo: 'termos' }, { status: 400 })
    if (idade13 !== true) return NextResponse.json({ error: 'A Bynx é para quem tem 13 anos ou mais.', campo: 'idade13' }, { status: 400 })
    if (!(await captchaOk(captcha, ip))) {
      return NextResponse.json({ error: 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.', code: 'CAPTCHA' }, { status: 400 })
    }

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Serviço indisponível. Tente de novo em instantes.' }, { status: 503 })

    const { data: criado, error: criarErr } = await sb.auth.admin.createUser({
      email: emailLimpo,
      password: senha!,
      email_confirm: true,
      user_metadata: {
        name: nomeLimpo,
        marketing_aceito: marketing === true,
        oferta: 'convite-grupo',
        signup_utm_source: 'convite',
        signup_utm_medium: 'grupo',
        signup_utm_campaign: convite.campanha,
        signup_landing_page: '/criadores',
      },
    })

    if (criarErr || !criado?.user) {
      const msg = criarErr?.message || ''
      if (/already|registered|exists/i.test(msg) || (criarErr as { code?: string } | null)?.code === 'email_exists') {
        return NextResponse.json({ error: 'Este e-mail já tem conta na Bynx. Entre com ele para ativar o seu ano.', code: 'JA_TEM_CONTA' }, { status: 409 })
      }
      if (ehErroDeRegraDeSenha(msg)) {
        return NextResponse.json({ error: 'Essa senha é muito comum. Escolha outra.', campo: 'senha' }, { status: 400 })
      }
      console.error('[criadores/cadastro] createUser falhou:', msg)
      await registrarEventoConvite(convite.id, 'erro')
      return NextResponse.json({ error: 'Não conseguimos criar sua conta. Tente de novo em instantes.' }, { status: 500 })
    }

    // Conta criada. Se o resgate perder a corrida do teto, a conta fica no
    // trial normal e a tela avisa -- nao se desfaz uma conta que a pessoa pediu.
    const resgate = await resgatarConviteGrupo(normalizarCodigo(c)!, criado.user.id, true)
    if (!resgate.ok) {
      console.error(`[criadores/cadastro] resgate recusado (${resgate.code}) para ${criado.user.id}`)
      await registrarEventoConvite(convite.id, 'erro')
    }

    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email: emailLimpo })
    const tokenHash = link?.properties?.hashed_token
    if (linkErr || !tokenHash) console.error('[criadores/cadastro] generateLink falhou:', linkErr?.message)

    return NextResponse.json({
      ok: true,
      resgatado: resgate.ok,
      proAte: resgate.ok ? resgate.proAte : null,
      aviso: resgate.ok ? null
        : resgate.code === 'CONVITE_ENCERRADO'
          ? 'As vagas acabaram segundos antes do seu cadastro. Sua conta foi criada no plano Grátis e você já pode usar a Bynx.'
          : MENSAGEM_RESGATE[resgate.code],
      tokenHash: tokenHash || null,
    })
  } catch (e) {
    console.error('[criadores/cadastro] CRITICAL:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Não conseguimos criar sua conta. Tente de novo em instantes.' }, { status: 500 })
  }
}
