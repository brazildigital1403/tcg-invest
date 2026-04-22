import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const LOGO = 'https://bynx.gg/logo_BYNX.png'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

// ── Layout base ───────────────────────────────────────────────────────────────

function baseLayout(content: string, preheader = '') {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Bynx</title>
  <!--[if mso]><style>td{font-family:Arial,sans-serif}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#080a0f;font-family:'Segoe UI',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080a0f;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <img src="${LOGO}" alt="Bynx" height="36" style="height:36px;width:auto;"/>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#0d0f14;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px 36px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:28px;text-align:center;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.6;">
          © 2026 Bynx · Feito para colecionadores brasileiros de Pokémon TCG<br/>
          <a href="${APP_URL}" style="color:rgba(255,255,255,0.4);text-decoration:none;">bynx.gg</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(label: string, href: string, color = '#f59e0b') {
  return `<table cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
    <tr><td style="background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:12px;">
      <a href="${href}" style="display:block;padding:14px 32px;color:#000;font-weight:800;font-size:15px;text-decoration:none;white-space:nowrap;">${label}</a>
    </td></tr>
  </table>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f0f0f0;letter-spacing:-0.03em;line-height:1.2;">${text}</h1>`
}

function p(text: string, style = '') {
  return `<p style="margin:12px 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;${style}">${text}</p>`
}

function divider() {
  return `<div style="height:1px;background:rgba(255,255,255,0.08);margin:28px 0;"></div>`
}

function badge(text: string, color: string, bg: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:0.06em;text-transform:uppercase;">${text}</span>`
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
    ${p('Qualquer dúvida, responda este email ou fale no nosso WhatsApp.', 'font-size:12px;color:rgba(255,255,255,0.35);')}
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
        <td width="48%" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.4);">MENSAL</p>
          <p style="margin:0;font-size:28px;font-weight:900;background:linear-gradient(135deg,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">R$29,90</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">por mês</p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:14px;padding:20px;text-align:center;position:relative;">
          <p style="margin:0 0 4px;font-size:11px;color:rgba(255,255,255,0.4);">ANUAL <span style="color:#f59e0b;">·2 MESES GRÁTIS</span></p>
          <p style="margin:0;font-size:28px;font-weight:900;background:linear-gradient(135deg,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">R$249</p>
          <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.3);">R$20,75/mês</p>
        </td>
      </tr>
    </table>
    ${btn('Assinar Pro agora →', `${APP_URL}/minha-conta`)}
    ${p('Se ainda não tem certeza, continue explorando — você tem mais 2 dias grátis!', 'font-size:12px;color:rgba(255,255,255,0.35);margin-top:20px;')}
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
    ${p('Dúvidas? Responda este email. 🙂', 'font-size:12px;color:rgba(255,255,255,0.35);margin-top:20px;')}
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
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px 20px;">
      <tr>
        <td style="font-size:13px;color:rgba(255,255,255,0.4);">Produto</td>
        <td style="font-size:13px;color:#f0f0f0;text-align:right;font-weight:600;">${info.titulo.replace('!','')}</td>
      </tr>
      <tr><td colspan="2" style="height:8px;"></td></tr>
      <tr>
        <td style="font-size:13px;color:rgba(255,255,255,0.4);">Valor</td>
        <td style="font-size:15px;font-weight:800;background:linear-gradient(135deg,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-align:right;">${info.valor}</td>
      </tr>
    </table>
    ${btn(info.linkLabel, info.link)}
    ${p('Guarde este email como comprovante. Dúvidas? Responda aqui.', 'font-size:12px;color:rgba(255,255,255,0.35);margin-top:20px;')}
  `, `Compra confirmada: ${info.titulo}`)

  return resend.emails.send({ from: FROM, to, subject: `✅ ${info.titulo} — Bynx`, html })
}