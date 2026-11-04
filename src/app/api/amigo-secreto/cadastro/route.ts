// src/app/api/amigo-secreto/cadastro/route.ts
//
// Cadastro em um passo do Amigo Secreto (/amigo-secreto). Molde de
// api/criadores/cadastro: a conta nasce no servidor, ja confirmada, e o
// navegador troca o hash do link magico por sessao com verifyOtp. A conta e
// uma conta Bynx comum (vira lead); o @ do Instagram, o endereco e o desejo
// entram depois, na sala, pelas funcoes amigo_secreto_*.
//
// Sem declaracao de idade (decisao do Du, 04/11/2026): so o aceite dos Termos.
// Turnstile: com TURNSTILE_SECRET_KEY na Vercel o token vira obrigatorio;
// sem ela, o freio e o limite por IP.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { senhaValida, SENHA_REGRA_MSG, ehErroDeRegraDeSenha } from '@/lib/senha'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'
import { AMIGO_SECRETO_SLUG } from '@/lib/amigoSecreto'

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
    console.error('[amigo-secreto/cadastro] turnstile falhou:', e instanceof Error ? e.message : e)
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
    const { nome, email, senha, termos, captcha } = body as {
      nome?: string; email?: string; senha?: string; termos?: boolean; captcha?: string
    }

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Serviço indisponível. Tente de novo em instantes.' }, { status: 503 })

    // Inscricoes fechadas: nem cria a conta.
    const { data: edicao } = await sb.rpc('amigo_secreto_edicao_publica', { p_slug: AMIGO_SECRETO_SLUG })
    const e = edicao as { estado?: string; inscricoes_ate?: string } | null
    if (!e || e.estado !== 'inscricoes' || (e.inscricoes_ate && Date.parse(e.inscricoes_ate) < Date.now())) {
      return NextResponse.json({ error: 'As inscrições encerraram.', code: 'ENCERRADO' }, { status: 410 })
    }

    const nomeLimpo = (nome || '').replace(/\s+/g, ' ').trim()
    const emailLimpo = (email || '').trim().toLowerCase()
    if (nomeLimpo.length < 2) return NextResponse.json({ error: 'Informe seu nome completo.', campo: 'nome' }, { status: 400 })
    if (!EMAIL_RE.test(emailLimpo)) return NextResponse.json({ error: 'Informe um e-mail válido.', campo: 'email' }, { status: 400 })
    if (!senhaValida(senha || '')) return NextResponse.json({ error: SENHA_REGRA_MSG, campo: 'senha' }, { status: 400 })
    if (termos !== true) return NextResponse.json({ error: 'Aceite os Termos de Uso e a Política de Privacidade.', campo: 'termos' }, { status: 400 })
    if (!(await captchaOk(captcha, ip))) {
      return NextResponse.json({ error: 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.', code: 'CAPTCHA' }, { status: 400 })
    }

    const { data: criado, error: criarErr } = await sb.auth.admin.createUser({
      email: emailLimpo,
      password: senha!,
      email_confirm: true,
      user_metadata: {
        name: nomeLimpo,
        marketing_aceito: true,
        oferta: 'amigo-secreto',
        signup_utm_source: 'whatsapp',
        signup_utm_medium: 'grupo',
        signup_utm_campaign: AMIGO_SECRETO_SLUG,
        signup_landing_page: '/amigo-secreto',
      },
    })

    if (criarErr || !criado?.user) {
      const msg = criarErr?.message || ''
      if (/already|registered|exists/i.test(msg) || (criarErr as { code?: string } | null)?.code === 'email_exists') {
        return NextResponse.json({ error: 'Este e-mail já tem conta na Bynx. Entre com ele para abrir a sala.', code: 'JA_TEM_CONTA' }, { status: 409 })
      }
      if (ehErroDeRegraDeSenha(msg)) {
        return NextResponse.json({ error: 'Essa senha é muito comum. Escolha outra.', campo: 'senha' }, { status: 400 })
      }
      console.error('[amigo-secreto/cadastro] createUser falhou:', msg)
      return NextResponse.json({ error: 'Não conseguimos criar sua conta. Tente de novo em instantes.' }, { status: 500 })
    }

    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email: emailLimpo })
    const tokenHash = link?.properties?.hashed_token
    if (linkErr || !tokenHash) console.error('[amigo-secreto/cadastro] generateLink falhou:', linkErr?.message)

    return NextResponse.json({ ok: true, tokenHash: tokenHash || null })
  } catch (e) {
    console.error('[amigo-secreto/cadastro] CRITICAL:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Não conseguimos criar sua conta. Tente de novo em instantes.' }, { status: 500 })
  }
}
