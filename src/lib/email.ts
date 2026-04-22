import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const LOGO = 'https://bynx.gg/logo_BYNX.png'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

// ── Layout base ───────────────────────────────────────────────────────────────

function baseLayout(content: string, preheader = '') {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>Bynx</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>td,th{font-family:Arial,sans-serif!important}v\:* {behavior:url(#default#VML)}o\:* {behavior:url(#default#VML)}</style>
  <![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    img{-ms-interpolation-mode:bicubic}
    body{margin:0!important;padding:0!important;background-color:#080a0f!important}
    @media only screen and (max-width:600px){.container{width:100%!important;padding:20px 12px!important}}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#080a0f;" bgcolor="#080a0f">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;">
    <tr>
      <td align="center" style="padding:40px 16px;background-color:#080a0f;" bgcolor="#080a0f">

        <!-- Inner container -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;background-color:#080a0f;" bgcolor="#080a0f">
              <img src="${LOGO}" alt="Bynx" height="36" width="auto" style="height:36px;width:auto;display:block;border:0;"/>
            </td>
          </tr>

          <!-- Card -->
          <!--[if mso]>
          <tr><td>
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" bgcolor="#0d0f14" style="background-color:#0d0f14;">
          <tr><td style="padding:40px 36px;font-family:Arial,sans-serif;background-color:#0d0f14;" bgcolor="#0d0f14">
          <![endif]-->
          <!--[if !mso]><!-->
          <tr>
            <td style="background-color:#0d0f14;border-radius:20px;padding:40px 36px;border:1px solid #1f2937;" bgcolor="#0d0f14">
          <!--<![endif]-->
              ${content}
          <!--[if mso]></td></tr></table></td></tr><![endif]-->
          <!--[if !mso]><!-->
            </td>
          </tr>
          <!--<![endif]-->

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;color:#4b5563;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;background-color:#080a0f;" bgcolor="#080a0f">
              © 2026 Bynx · Feito para colecionadores brasileiros de Pokémon TCG<br/>
              <a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">bynx.gg</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(label: string, href: string, color = '#f59e0b') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
    <tr>
      <td align="center" bgcolor="#f59e0b" style="background-color:#f59e0b;border-radius:12px;mso-padding-alt:0;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="25%" stroke="f" fillcolor="#f59e0b"><w:anchorlock/><center style="color:#000000;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
        <!--[if !mso]><!-->
        <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:12px;color:#000;font-weight:800;font-size:15px;text-decoration:none;white-space:nowrap;padding:14px 32px;font-family:Arial,sans-serif;">${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f0f0f0;letter-spacing:-0.03em;line-height:1.2;">${text}</h1>`
}

function p(text: string, style = '') {
  return `<p style="margin:12px 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;${style}">${text}</p>`
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;"><tr><td height="1" bgcolor="#1f2937" style="background-color:#1f2937;height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`
}

function badge(text: string, color: string, bg: string) {
  return `<p style="margin:0 0 8px;font-size:10px;font-weight:800;color:${color};letter-spacing:0.08em;text-transform:uppercase;font-family:Arial,sans-serif;">${text}</p>`
}

// ── 1. Email de boas-vindas ────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${h1(`Bem-vindo ao Bynx, ${firstName}! 🎉`)}
    ${p('Sua conta foi criada com sucesso. Você ganhou <strong style="color:#f59e0b;">7 dias de Pro grátis</strong> para explorar tudo que o Bynx tem a oferecer.')}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['📦 Importe suas cartas por link da LigaPokemon', '📊 Veja o valor real do seu fichário em tempo real', '📷 Escaneie cartas com IA (câmera ou foto)', '🛒 Compre e venda no Marketplace com segurança', '🗂️ Imprima separadores para organizar seu fichário'].map(f => `
        <tr><td style="padding:6px 0;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">${f}</p>
        </td></tr>`).join('')}
    </table>
    ${btn('Acessar minha conta', `${APP_URL}/minha-colecao`)}
    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Tem alguma dúvida? Nosso time está pronto para ajudar. 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Bem-vindo ao Bynx, ${firstName}! Seus 7 dias de Pro grátis começaram.`)

  return resend.emails.send({ from: FROM, to, subject: `Bem-vindo ao Bynx, ${firstName}! 🎉`, html })
}

// ── 2. Trial expirando — 5º dia ───────────────────────────────────────────────

export async function sendTrialExpiring5Email(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Pro Trial', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Seu trial Pro expira em 2 dias ⏰')}
    ${p(`${firstName}, você está usando o Bynx Pro há 5 dias. Faltam apenas <strong style="color:#ef4444;">2 dias</strong> para seu trial terminar.`)}
    ${p('Para não perder acesso ao patrimônio completo da sua coleção e todas as funcionalidades Pro, assine agora:')}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" bgcolor="#1a1c24" style="background-color:#1a1c24;border:1px solid #2d3748;border-radius:8px;padding:16px 12px;text-align:center;">
          <p style="margin:0 0 6px;font-size:10px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;">MENSAL</p>
          <p style="margin:0;font-size:26px;font-weight:900;color:#f59e0b;">R$29,90</p>
          <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">por mês</p>
        </td>
        <td width="4%"></td>
        <td width="48%" bgcolor="#1f1a0a" style="background-color:#1f1a0a;border:2px solid #78350f;border-radius:8px;padding:16px 12px;text-align:center;">
          <p style="margin:0 0 2px;font-size:10px;color:#9ca3af;font-weight:700;letter-spacing:0.06em;">ANUAL <span style="color:#f59e0b;">· 30% OFF</span></p>
          <p style="margin:0;font-size:26px;font-weight:900;color:#f59e0b;">R$249</p>
          <p style="margin:2px 0 0;font-size:11px;color:#6b7280;text-decoration:line-through;">R$358,80/ano</p>
          <p style="margin:2px 0 0;font-size:11px;color:#9ca3af;">R$20,75/mês</p>
        </td>
      </tr>
    </table>
    ${btn('Assinar Pro agora →', `${APP_URL}/minha-conta`)}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Precisa de ajuda? Manda uma Pokébola para a gente 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, 'Seu trial Pro expira em 2 dias. Assine para não perder acesso.')

  return resend.emails.send({ from: FROM, to, subject: '⏰ Seu trial Pro expira em 2 dias', html })
}

// ── 3. Trial expirando — 7º dia (último) ─────────────────────────────────────

export async function sendTrialExpiring7Email(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Último dia', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Hoje é o último dia do seu trial 🔔')}
    ${p(`${firstName}, seu período gratuito de 7 dias termina <strong style="color:#ef4444;">hoje</strong>.`)}
    ${p('A partir de amanhã, sua conta voltará ao plano Free (limite de cartas e sem perfil público). Assine agora para manter acesso completo:')}
    ${btn('Assinar Pro — R$29,90/mês', `${APP_URL}/minha-conta`)}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['✓ Cartas ilimitadas na sua coleção', '✓ Perfil público compartilhável', '✓ Anúncios ilimitados no Marketplace', '✓ Alertas de valorização', '✓ Separadores de Fichário inclusos'].map(f => `
        <tr><td style="padding:5px 0;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);">${f}</p>
        </td></tr>`).join('')}
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Precisa de ajuda? Manda uma Pokébola para a gente 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, 'Hoje é o último dia do seu Pro trial. Assine para manter acesso completo.')

  return resend.emails.send({ from: FROM, to, subject: '🔔 Último dia do seu trial Pro — assine agora', html })
}

// ── 4. Confirmação de compra ──────────────────────────────────────────────────

type PurchaseType = 'pro_mensal' | 'pro_anual' | 'separadores' | 'scan_basico' | 'scan_popular' | 'scan_colecionador'

const PURCHASE_INFO: Record<PurchaseType, { titulo: string; descricao: string; valor: string; icon: string; link: string; linkLabel: string }> = {
  pro_mensal:        { titulo: 'Plano Pro Mensal ativado!', descricao: 'Sua assinatura Pro mensal está ativa. Aproveite todas as funcionalidades sem limites.', valor: 'R$29,90/mês', icon: '⭐', link: `${APP_URL}/minha-colecao`, linkLabel: 'Ir para minha coleção →' },
  pro_anual:         { titulo: 'Plano Pro Anual ativado!', descricao: 'Sua assinatura Pro anual está ativa. 12 meses com acesso completo ao Bynx.', valor: 'R$249/ano', icon: '⭐', link: `${APP_URL}/minha-colecao`, linkLabel: 'Ir para minha coleção →' },
  separadores:       { titulo: 'Separadores desbloqueados!', descricao: 'Você tem acesso vitalício a todos os 1.025 separadores de fichário. Imprima e organize!', valor: 'R$14,90', icon: '🗂️', link: `${APP_URL}/separadores`, linkLabel: 'Acessar Separadores →' },
  scan_basico:       { titulo: '5 créditos de scan adicionados!', descricao: 'Seus créditos de scan foram adicionados. Use para escanear suas cartas com IA.', valor: 'R$5,90', icon: '📷', link: `${APP_URL}/minha-colecao`, linkLabel: 'Escanear cartas →' },
  scan_popular:      { titulo: '15 créditos de scan adicionados!', descricao: 'Seus créditos de scan foram adicionados. Use para escanear suas cartas com IA.', valor: 'R$14,90', icon: '📷', link: `${APP_URL}/minha-colecao`, linkLabel: 'Escanear cartas →' },
  scan_colecionador: { titulo: '40 créditos de scan adicionados!', descricao: 'Seus créditos de scan foram adicionados. Use para escanear suas cartas com IA.', valor: 'R$34,90', icon: '📷', link: `${APP_URL}/minha-colecao`, linkLabel: 'Escanear cartas →' },
}

export async function sendPurchaseConfirmationEmail(to: string, name: string, type: PurchaseType) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const info = PURCHASE_INFO[type]
  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;line-height:1;">${info.icon}</div>
    </div>
    ${h1(info.titulo)}
    ${p(`${firstName}, sua compra foi confirmada com sucesso!`)}
    ${p(info.descricao)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;">
      <tr>
        <td style="padding:14px 18px 6px;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">Produto</td>
        <td style="padding:14px 18px 6px;font-size:12px;color:#e5e7eb;text-align:right;font-weight:600;font-family:Arial,sans-serif;">${info.titulo.replace('!','')}</td>
      </tr>
      <tr>
        <td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:8px 18px 14px;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">Valor</td>
        <td style="padding:8px 18px 14px;font-size:16px;font-weight:900;color:#f59e0b;text-align:right;font-family:Arial,sans-serif;">${info.valor}</td>
      </tr>
    </table>
    ${btn(info.linkLabel, info.link)}
    <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Guarde este email como comprovante. Dúvidas? Manda uma Pokébola 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Compra confirmada: ${info.titulo}`)

  return resend.emails.send({ from: FROM, to, subject: `✅ ${info.titulo} — Bynx`, html })
}