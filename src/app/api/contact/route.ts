import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { criarLimitador, ipDaRequest } from '@/lib/rateLimit'

/**
 * POST /api/contact — formulario de contato comercial (ContactModal).
 *
 * Rota PUBLICA e sem auth: qualquer visitante manda. Isso a torna alvo obvio, e
 * por isso ela tem quatro travas que nao sao decorativas:
 *
 * 1. ★ ESCAPE DE HTML nos campos do usuario. Este endpoint monta um e-mail HTML
 *    que sai de noreply@bynx.gg — dominio com SPF/DKIM validos. Interpolar
 *    `nome`/`mensagem` crus deixava qualquer um injetar <a href> de phishing num
 *    e-mail que chega ASSINADO pela Bynx. Era o furo mais grave da rota.
 * 2. ★ O ROTULO DA CATEGORIA E DERIVADO AQUI, nao aceito do cliente. Antes o
 *    front mandava `categoryLabel` e ele ia direto pro assunto — dava pra forjar
 *    "[Bynx Contato] URGENTE PAGAMENTO — ...".
 * 3. Teto de tamanho por campo (nao havia limite nenhum).
 * 4. Rate limit por IP: cada POST manda e-mail de verdade, ou seja, custa cota
 *    da Resend e enche a caixa do Du.
 */

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const TO = process.env.ADMIN_EMAIL || 'eduardo@brazildigital.ag'

// 5 envios por IP a cada 10 min. Folgado pra quem erra e reenvia, apertado pra script.
const limitador = criarLimitador({ janelaMs: 10 * 60_000, max: 5 })

/**
 * Rotulo por categoria — espelha CATEGORIAS do ContactModal.tsx.
 * Chave desconhecida cai em 400: melhor recusar do que mandar e-mail sem contexto.
 */
const ROTULOS: Record<string, string> = {
  parceria: 'Parceria',
  loja: 'Quero minha loja na Bynx',
  imprensa: 'Imprensa & Mídia',
  sugestao: 'Sugestão de funcionalidade',
  duvida: 'Dúvida geral',
  investidor: 'Investidor',
}

const MAX_NOME = 120
const MAX_EMAIL = 254 // RFC 5321
const MAX_MENSAGEM = 5000

/** Neutraliza HTML antes de interpolar no corpo do e-mail. */
function escaparHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Assunto e header: quebra de linha aqui e vetor de injecao de header. */
function limparLinha(v: string, max: number): string {
  return v.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

export async function POST(req: NextRequest) {
  try {
    const ip = ipDaRequest(req)
    if (ip) {
      limitador.gc()
      if (limitador.excedeu(ip)) {
        return NextResponse.json(
          { error: 'Você já enviou várias mensagens. Aguarde alguns minutos.' },
          { status: 429 }
        )
      }
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })
    }

    const category = String(body.category ?? '')
    const categoryLabel = ROTULOS[category]
    if (!categoryLabel) {
      return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
    }

    const nome = limparLinha(String(body.nome ?? ''), MAX_NOME)
    const email = limparLinha(String(body.email ?? ''), MAX_EMAIL)
    const mensagem = String(body.mensagem ?? '').slice(0, MAX_MENSAGEM).trim()

    if (!nome || !email || !mensagem) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }
    if (!emailValido(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    // Escape ANTES do \n -> <br/>, senao a propria tag viraria &lt;br/&gt;.
    const nomeEsc = escaparHtml(nome)
    const emailEsc = escaparHtml(email)
    const labelEsc = escaparHtml(categoryLabel)
    const mensagemEsc = escaparHtml(mensagem).replace(/\n/g, '<br/>')

    const subject = `[Bynx Contato] ${categoryLabel} — ${nome}`

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#080a0f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#080a0f">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0">

        <tr><td align="center" style="padding-bottom:28px;">
          <img src="https://bynx.gg/logo_BYNX.png" alt="Bynx" height="32" style="height:32px;"/>
        </td></tr>

        <tr><td bgcolor="#0d0f14" style="background:#0d0f14;border-radius:16px;border:1px solid #1f2937;padding:36px 32px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#f59e0b;letter-spacing:0.08em;text-transform:uppercase;">✦ Novo contato comercial</p>
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:900;color:#f0f0f0;">${labelEsc}</h1>

          <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background:#1a1c24;border-radius:10px;border:1px solid #2d3748;margin-bottom:24px;">
            <tr>
              <td style="padding:12px 16px 8px;font-size:12px;color:#9ca3af;">Nome</td>
              <td style="padding:12px 16px 8px;font-size:13px;color:#f0f0f0;font-weight:600;text-align:right;">${nomeEsc}</td>
            </tr>
            <tr><td colspan="2" bgcolor="#2d3748" style="background:#2d3748;height:1px;padding:0;font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:8px 16px;font-size:12px;color:#9ca3af;">E-mail</td>
              <td style="padding:8px 16px;font-size:13px;color:#f59e0b;text-align:right;">${emailEsc}</td>
            </tr>
            <tr><td colspan="2" bgcolor="#2d3748" style="background:#2d3748;height:1px;padding:0;font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:8px 16px 12px;font-size:12px;color:#9ca3af;">Categoria</td>
              <td style="padding:8px 16px 12px;font-size:13px;color:#f0f0f0;text-align:right;">${labelEsc}</td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Mensagem</p>
          <div bgcolor="#1a1c24" style="background:#1a1c24;border:1px solid #2d3748;border-radius:10px;padding:16px;">
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.7;">${mensagemEsc}</p>
          </div>

          <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
            <tr><td bgcolor="#f59e0b" style="background:#f59e0b;border-radius:10px;">
              <a href="mailto:${emailEsc}" style="display:block;padding:12px 28px;color:#000;font-weight:800;font-size:14px;text-decoration:none;">
                Responder para ${nomeEsc} →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td align="center" style="padding-top:24px;color:#4b5563;font-size:12px;">
          © 2026 Bynx · <a href="https://bynx.gg" style="color:#6b7280;text-decoration:none;">bynx.gg</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject,
      html,
    })

    console.log(`[contact] ${category} de <${email}>`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    // Nao devolver err.message: vazava detalhe interno (host, stack) pro cliente.
    console.error('[contact]', (err as Error)?.message)
    return NextResponse.json({ error: 'Não consegui enviar sua mensagem agora.' }, { status: 500 })
  }
}
