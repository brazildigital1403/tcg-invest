// src/app/api/presente/cadastro/route.ts
//
// Cadastro em um passo da campanha Presente.
//
// Por que a conta nasce com o e-mail JA confirmado: a pessoa so chega aqui
// pelo link pessoal que recebeu naquele e-mail. Abrir o link ja prova que a
// caixa e dela. Pedir outra confirmacao era exatamente o passo onde a oferta da
// TCG CON morreu (59 visitas, 0 cadastro).
//
// O e-mail vem do convite e nao pode ser trocado aqui. Quem quiser outro
// e-mail usa o cadastro normal do site, que confirma.
//
// A sessao nao sai de signInWithPassword (o login do site tem captcha, que o
// servidor nao resolve): o servidor gera um link magico sem enviar e-mail e
// devolve o hash, e o navegador troca o hash por sessao com verifyOtp.
//
// Nada disso cria conta sem a pessoa pedir: exige senha criada por ela, 18+ e
// aceite dos Termos na hora.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { buscarConvite, carimbarConvite } from '@/lib/campanhaConvites'
import { OFERTA_PRESENTE, ofertaPresenteAtiva } from '@/lib/ofertaPresente'

function senhaForte(s: string): boolean {
  return s.length >= 8 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s)
}

function idade(isoData: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoData)
  if (!m) return -1
  const nasc = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(nasc.getTime())) return -1
  const hoje = new Date()
  let anos = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) anos--
  return anos
}

export async function POST(req: NextRequest) {
  try {
    if (!ofertaPresenteAtiva()) {
      return NextResponse.json({ error: 'O presente encerrou.', code: 'OFERTA_ENCERRADA' }, { status: 410 })
    }

    const body = await req.json().catch(() => ({}))
    const { t, nome, senha, nascimento, termos, marketing } = body as {
      t?: string; nome?: string; senha?: string; nascimento?: string; termos?: boolean; marketing?: boolean
    }

    const convite = await buscarConvite(t)
    if (!convite) {
      return NextResponse.json({ error: 'Este presente é pessoal. Abra pelo link do seu e-mail.', code: 'CONVITE_INVALIDO' }, { status: 404 })
    }

    const nomeLimpo = (nome || '').replace(/\s+/g, ' ').trim()
    if (nomeLimpo.length < 2) return NextResponse.json({ error: 'Informe seu nome.', campo: 'nome' }, { status: 400 })
    if (!senhaForte(senha || '')) {
      return NextResponse.json({ error: 'Use 8 ou mais caracteres com maiúscula, minúscula, número e símbolo.', campo: 'senha' }, { status: 400 })
    }
    const anos = idade(nascimento || '')
    if (anos < 0 || anos > 120) return NextResponse.json({ error: 'Informe sua data de nascimento.', campo: 'nascimento' }, { status: 400 })
    if (anos < 18) {
      return NextResponse.json({ error: 'A assinatura é só para maiores de 18 anos. Peça para um responsável assinar.', campo: 'nascimento' }, { status: 400 })
    }
    if (termos !== true) return NextResponse.json({ error: 'Aceite os Termos de Uso e a Política de Privacidade.', campo: 'termos' }, { status: 400 })

    const sb = getServiceSupabase()
    if (!sb) return NextResponse.json({ error: 'Serviço indisponível. Tente de novo em instantes.' }, { status: 503 })

    const { data: criado, error: criarErr } = await sb.auth.admin.createUser({
      email: convite.email,
      password: senha!,
      email_confirm: true,
      user_metadata: {
        name: nomeLimpo,
        data_nascimento: nascimento,
        marketing_aceito: marketing === true,
        oferta: OFERTA_PRESENTE.id,
        signup_utm_source: 'email',
        signup_utm_medium: 'convite',
        signup_utm_campaign: convite.campanha,
      },
    })

    if (criarErr || !criado?.user) {
      const msg = criarErr?.message || ''
      if (/already|registered|exists/i.test(msg) || (criarErr as any)?.code === 'email_exists') {
        return NextResponse.json({ error: 'Este e-mail já tem conta na Bynx. Entre para usar seu presente.', code: 'JA_TEM_CONTA' }, { status: 409 })
      }
      if (/weak|pwned|leaked|easy to guess/i.test(msg)) {
        return NextResponse.json({ error: 'Essa senha é muito comum. Escolha outra.', campo: 'senha' }, { status: 400 })
      }
      console.error('[presente/cadastro] createUser falhou:', msg)
      return NextResponse.json({ error: 'Não conseguimos criar sua conta. Tente de novo em instantes.' }, { status: 500 })
    }

    await carimbarConvite(convite.id, 'cadastro_em', { user_id: criado.user.id })

    const { data: link, error: linkErr } = await sb.auth.admin.generateLink({ type: 'magiclink', email: convite.email })
    const tokenHash = link?.properties?.hashed_token
    if (linkErr || !tokenHash) {
      // Conta existe; a pessoa entra pelo login normal e segue pro pagamento.
      console.error('[presente/cadastro] generateLink falhou:', linkErr?.message)
      return NextResponse.json({ ok: true, entrar: true })
    }

    return NextResponse.json({ ok: true, tokenHash })
  } catch (e: any) {
    console.error('[presente/cadastro] CRITICAL:', e?.message)
    return NextResponse.json({ error: 'Não conseguimos criar sua conta. Tente de novo em instantes.' }, { status: 500 })
  }
}
