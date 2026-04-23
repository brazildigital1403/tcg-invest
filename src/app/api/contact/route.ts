import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const TO = process.env.ADMIN_EMAIL || 'eduardo@brazildigital.ag'

export async function POST(req: NextRequest) {
  try {
    const { category, categoryLabel, nome, email, mensagem } = await req.json()

    if (!nome || !email || !mensagem || !category) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

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
          <h1 style="margin:0 0 24px;font-size:22px;font-weight:900;color:#f0f0f0;">${categoryLabel}</h1>

          <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background:#1a1c24;border-radius:10px;border:1px solid #2d3748;margin-bottom:24px;">
            <tr>
              <td style="padding:12px 16px 8px;font-size:12px;color:#9ca3af;">Nome</td>
              <td style="padding:12px 16px 8px;font-size:13px;color:#f0f0f0;font-weight:600;text-align:right;">${nome}</td>
            </tr>
            <tr><td colspan="2" bgcolor="#2d3748" style="background:#2d3748;height:1px;padding:0;font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:8px 16px;font-size:12px;color:#9ca3af;">E-mail</td>
              <td style="padding:8px 16px;font-size:13px;color:#f59e0b;text-align:right;">${email}</td>
            </tr>
            <tr><td colspan="2" bgcolor="#2d3748" style="background:#2d3748;height:1px;padding:0;font-size:0;">&nbsp;</td></tr>
            <tr>
              <td style="padding:8px 16px 12px;font-size:12px;color:#9ca3af;">Categoria</td>
              <td style="padding:8px 16px 12px;font-size:13px;color:#f0f0f0;text-align:right;">${categoryLabel}</td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;">Mensagem</p>
          <div bgcolor="#1a1c24" style="background:#1a1c24;border:1px solid #2d3748;border-radius:10px;padding:16px;">
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.7;">${mensagem.replace(/\n/g, '<br/>')}</p>
          </div>

          <table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
            <tr><td bgcolor="#f59e0b" style="background:#f59e0b;border-radius:10px;">
              <a href="mailto:${email}" style="display:block;padding:12px 28px;color:#000;font-weight:800;font-size:14px;text-decoration:none;">
                Responder para ${nome} →
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

    console.log(`[contact] ${categoryLabel} de ${nome} <${email}>`)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[contact]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}