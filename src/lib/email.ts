import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const LOGO = 'https://bynx.gg/logo_BYNX.png'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

// ─────────────────────────────────────────────────────────────────────────────
//  Layout base — compatível com Outlook (desktop/web), Gmail, Apple Mail, iOS
// ─────────────────────────────────────────────────────────────────────────────
//
//  Princípios aplicados:
//  • Tabelas + bgcolor em vez de <div> com `background`
//  • Conditional comments <!--[if mso]> para VML (botões, etc)
//  • Todas as cores em hex sólido (Outlook ignora rgba/linear-gradient)
//  • mso-line-height-rule: exactly para evitar espaçamento quebrado
//  • Gradientes visuais: fallback de cor sólida ANTES da declaração de gradiente
//
//  Equivalências hex usadas (rgba sobre fundo #0d0f14 do card):
//   rgba(255,255,255,0.03) → #13151a        (input/price card bg)
//   rgba(255,255,255,0.08) → #1e2026        (borders / divider)
//   rgba(255,255,255,0.25) → #404040        (footer)
//   rgba(255,255,255,0.35) → #595959        (legenda pequena)
//   rgba(255,255,255,0.4)  → #666666        (label)
//   rgba(255,255,255,0.55) → #8c8c8c        (texto feature list)
//   rgba(255,255,255,0.6)  → #999999        (texto padrão)
//   rgba(245,158,11,0.15)  → #3a2a0a        (pill Pro Trial)
//   rgba(245,158,11,0.08)  → #251c0e        (card Anual)
//   rgba(239,68,68,0.15)   → #3a1414        (pill Último Dia)
//   rgba(245,158,11,0.3)   → #f59e0b        (border sólido laranja)
// ─────────────────────────────────────────────────────────────────────────────

function baseLayout(content: string, preheader = '') {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Bynx</title>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <style>
    table, td, div, p, a, h1, h2, span { font-family: 'Segoe UI', Arial, sans-serif !important; }
    table { border-collapse: collapse !important; }
  </style>
  <![endif]-->
  <style>
    /* Reset básico pra clients modernos */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a { text-decoration: none; }
  </style>
</head>
<body style="margin:0;padding:0;background:#080a0f;font-family:'Segoe UI',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#080a0f;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background:#080a0f;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${LOGO}" alt="Bynx" height="36" style="height:36px;width:auto;display:inline-block;border:0;outline:none;text-decoration:none;"/>
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td bgcolor="#0d0f14" style="background:#0d0f14;border-radius:20px;padding:40px 36px;border:1px solid #1e2026;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;text-align:center;color:#404040;font-size:12px;line-height:1.6;font-family:'Segoe UI',Arial,sans-serif;">
              © 2026 Bynx · Feito para colecionadores brasileiros de Pokémon TCG<br/>
              <a href="${APP_URL}" style="color:#666666;text-decoration:none;">bynx.gg</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers — todos Outlook-safe
// ─────────────────────────────────────────────────────────────────────────────

// Botão "bulletproof" — VML pra Outlook + <a> pra todo o resto
function btn(label: string, href: string) {
  // VML exige largura fixa — calcula com base no tamanho do label
  const width = Math.max(240, label.length * 11 + 60)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 0;">
    <tr>
      <td align="center" bgcolor="#f59e0b" style="background-color:#f59e0b;border-radius:12px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="25%" stroke="f" fillcolor="#f59e0b">
          <w:anchorlock/>
          <center style="color:#000000;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${href}" style="display:inline-block;padding:14px 32px;font-family:'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:800;color:#000000;text-decoration:none;background-color:#f59e0b;background-image:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:12px;mso-hide:all;">${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f0f0f0;letter-spacing:-0.03em;line-height:1.2;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;">${text}</h1>`
}

function p(text: string, style = '') {
  return `<p style="margin:12px 0;font-size:14px;color:#999999;line-height:1.7;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;${style}">${text}</p>`
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr><td height="1" bgcolor="#1e2026" style="background:#1e2026;line-height:1px;font-size:1px;height:1px;">&nbsp;</td></tr>
  </table>`
}

// Pill badge — tabela com bgcolor (Outlook ignora rgba)
// Parâmetros: text, cor do texto em hex, cor de fundo em hex sólido
function badge(text: string, color: string, bgHex: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;">
    <tr>
      <td bgcolor="${bgHex}" style="background:${bgHex};border-radius:100px;padding:6px 14px;">
        <span style="font-family:'Segoe UI',Arial,sans-serif;font-size:11px;font-weight:800;color:${color};letter-spacing:0.08em;text-transform:uppercase;">${text}</span>
      </td>
    </tr>
  </table>`
}

// Texto com efeito de gradiente laranja→vermelho
// Outlook vê cor sólida (#f59e0b) — clients modernos veem gradiente
function gradientText(text: string, fontSize = 15) {
  return `<span style="color:#f59e0b;font-weight:800;font-size:${fontSize}px;background:linear-gradient(135deg,#f59e0b,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${text}</span>`
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. Email de boas-vindas
// ─────────────────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const features = [
    '📦 Importe suas cartas por link da LigaPokemon',
    '📊 Veja o valor real do seu fichário em tempo real',
    '📷 Escaneie cartas com IA (câmera ou foto)',
    '🛒 Compre e venda no Marketplace com segurança',
    '🗂️ Imprima separadores para organizar seu fichário',
  ]

  const html = baseLayout(`
    ${h1(`Bem-vindo ao Bynx, ${firstName}! 🎉`)}
    ${p(`Sua conta foi criada com sucesso. Você ganhou <strong style="color:#f59e0b;">7 dias de Pro grátis</strong> para explorar tudo que o Bynx tem a oferecer.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${features.map(f => `
      <tr>
        <td style="padding:6px 0;">
          <p style="margin:0;font-size:13px;color:#999999;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:1.6;">${f}</p>
        </td>
      </tr>`).join('')}
    </table>
    ${btn('Acessar minha conta', `${APP_URL}/minha-colecao`)}
    ${divider()}
    ${p('Qualquer dúvida, responda este email ou fale no nosso WhatsApp.', 'font-size:12px;color:#595959;')}
  `, `Bem-vindo ao Bynx, ${firstName}! Seus 7 dias de Pro grátis começaram.`)

  return resend.emails.send({
    from: FROM,
    to,
    subject: `Bem-vindo ao Bynx, ${firstName}! 🎉`,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. Trial expirando — 5º dia
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTrialExpiring5Email(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Pro Trial', '#f59e0b', '#3a2a0a')}
    <div style="height:16px;line-height:16px;font-size:16px;">&nbsp;</div>
    ${h1('Seu trial Pro expira em 2 dias ⏰')}
    ${p(`${firstName}, você está usando o Bynx Pro há 5 dias. Faltam apenas <strong style="color:#ef4444;">2 dias</strong> para seu trial terminar.`)}
    ${p('Para não perder acesso ao patrimônio completo da sua coleção e todas as funcionalidades Pro, assine agora:')}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <!-- Card Mensal -->
        <td width="48%" bgcolor="#13151a" align="center" style="background:#13151a;border:1px solid #1e2026;border-radius:14px;padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#666666;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:0.06em;">MENSAL</p>
          <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;">${gradientText('R$29,90', 28)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#4d4d4d;font-family:'Segoe UI',Arial,sans-serif;">por mês</p>
        </td>
        <td width="4%" style="font-size:1px;line-height:1px;">&nbsp;</td>
        <!-- Card Anual (destaque) -->
        <td width="48%" bgcolor="#251c0e" align="center" style="background:#251c0e;border:1px solid #f59e0b;border-radius:14px;padding:20px;text-align:center;">
          <p style="margin:0 0 4px;font-size:11px;color:#666666;font-family:'Segoe UI',Arial,sans-serif;letter-spacing:0.06em;">ANUAL <span style="color:#f59e0b;">·2 MESES GRÁTIS</span></p>
          <p style="margin:0;font-family:'Segoe UI',Arial,sans-serif;">${gradientText('R$249', 28)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#4d4d4d;font-family:'Segoe UI',Arial,sans-serif;">R$20,75/mês</p>
        </td>
      </tr>
    </table>
    ${btn('Assinar Pro agora →', `${APP_URL}/minha-conta`)}
    ${p('Se ainda não tem certeza, continue explorando — você tem mais 2 dias grátis!', 'font-size:12px;color:#595959;margin-top:20px;')}
  `, 'Seu trial Pro expira em 2 dias. Assine para não perder acesso.')

  return resend.emails.send({
    from: FROM,
    to,
    subject: '⏰ Seu trial Pro expira em 2 dias',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. Trial expirando — 7º dia (último)
// ─────────────────────────────────────────────────────────────────────────────

export async function sendTrialExpiring7Email(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const benefits = [
    '✓ Cartas ilimitadas na sua coleção',
    '✓ Perfil público compartilhável',
    '✓ Anúncios ilimitados no Marketplace',
    '✓ Alertas de valorização',
    '✓ Separadores de Fichário inclusos',
  ]

  const html = baseLayout(`
    ${badge('Último dia', '#ef4444', '#3a1414')}
    <div style="height:16px;line-height:16px;font-size:16px;">&nbsp;</div>
    ${h1('Hoje é o último dia do seu trial 🔔')}
    ${p(`${firstName}, seu período gratuito de 7 dias termina <strong style="color:#ef4444;">hoje</strong>.`)}
    ${p('A partir de amanhã, sua conta voltará ao plano Free (limite de cartas e sem perfil público). Assine agora para manter acesso completo:')}
    ${btn('Assinar Pro — R$29,90/mês', `${APP_URL}/minha-conta`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${benefits.map(f => `
      <tr>
        <td style="padding:5px 0;">
          <p style="margin:0;font-size:13px;color:#8c8c8c;font-family:'Segoe UI',Arial,sans-serif;mso-line-height-rule:exactly;line-height:1.6;">${f}</p>
        </td>
      </tr>`).join('')}
    </table>
    ${p('Dúvidas? Responda este email. 🙂', 'font-size:12px;color:#595959;margin-top:20px;')}
  `, 'Hoje é o último dia do seu Pro trial. Assine para manter acesso completo.')

  return resend.emails.send({
    from: FROM,
    to,
    subject: '🔔 Último dia do seu trial Pro — assine agora',
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. Confirmação de compra
// ─────────────────────────────────────────────────────────────────────────────

type PurchaseType =
  | 'pro_mensal'
  | 'pro_anual'
  | 'separadores'
  | 'scan_basico'
  | 'scan_popular'
  | 'scan_colecionador'

const PURCHASE_INFO: Record<
  PurchaseType,
  { titulo: string; descricao: string; valor: string; icon: string; link: string; linkLabel: string }
> = {
  pro_mensal: {
    titulo: 'Plano Pro Mensal ativado!',
    descricao: 'Sua assinatura Pro mensal está ativa. Aproveite todas as funcionalidades sem limites.',
    valor: 'R$29,90/mês',
    icon: '⭐',
    link: `${APP_URL}/minha-colecao`,
    linkLabel: 'Ir para minha coleção →',
  },
  pro_anual: {
    titulo: 'Plano Pro Anual ativado!',
    descricao: 'Sua assinatura Pro anual está ativa. 12 meses com acesso completo ao Bynx.',
    valor: 'R$249/ano',
    icon: '⭐',
    link: `${APP_URL}/minha-colecao`,
    linkLabel: 'Ir para minha coleção →',
  },
  separadores: {
    titulo: 'Separadores desbloqueados!',
    descricao: 'Você tem acesso vitalício a todos os 1.025 separadores de fichário. Imprima e organize!',
    valor: 'R$14,90',
    icon: '🗂️',
    link: `${APP_URL}/separadores`,
    linkLabel: 'Acessar Separadores →',
  },
  scan_basico: {
    titulo: '5 créditos de scan adicionados!',
    descricao: 'Seus créditos de scan foram adicionados. Use para escanear suas cartas com IA.',
    valor: 'R$5,90',
    icon: '📷',
    link: `${APP_URL}/minha-colecao`,
    linkLabel: 'Escanear cartas →',
  },
  scan_popular: {
    titulo: '15 créditos de scan adicionados!',
    descricao: 'Seus créditos de scan foram adicionados. Use para escanear suas cartas com IA.',
    valor: 'R$14,90',
    icon: '📷',
    link: `${APP_URL}/minha-colecao`,
    linkLabel: 'Escanear cartas →',
  },
  scan_colecionador: {
    titulo: '40 créditos de scan adicionados!',
    descricao: 'Seus créditos de scan foram adicionados. Use para escanear suas cartas com IA.',
    valor: 'R$34,90',
    icon: '📷',
    link: `${APP_URL}/minha-colecao`,
    linkLabel: 'Escanear cartas →',
  },
}

export async function sendPurchaseConfirmationEmail(
  to: string,
  name: string,
  type: PurchaseType,
) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const info = PURCHASE_INFO[type]

  const html = baseLayout(`
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <div style="font-size:48px;line-height:1;">${info.icon}</div>
        </td>
      </tr>
    </table>
    ${h1(info.titulo)}
    ${p(`${firstName}, sua compra foi confirmada com sucesso!`)}
    ${p(info.descricao)}
    ${divider()}
    <!-- Box Produto/Valor -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#13151a" style="background:#13151a;border-radius:12px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;color:#666666;font-family:'Segoe UI',Arial,sans-serif;">Produto</td>
              <td align="right" style="font-size:13px;color:#f0f0f0;text-align:right;font-weight:600;font-family:'Segoe UI',Arial,sans-serif;">${info.titulo.replace('!', '')}</td>
            </tr>
            <tr><td colspan="2" style="height:8px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
            <tr>
              <td style="font-size:13px;color:#666666;font-family:'Segoe UI',Arial,sans-serif;">Valor</td>
              <td align="right" style="text-align:right;font-family:'Segoe UI',Arial,sans-serif;">${gradientText(info.valor, 15)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${btn(info.linkLabel, info.link)}
    ${p('Guarde este email como comprovante. Dúvidas? Responda aqui.', 'font-size:12px;color:#595959;margin-top:20px;')}
  `, `Compra confirmada: ${info.titulo}`)

  return resend.emails.send({
    from: FROM,
    to,
    subject: `✅ ${info.titulo} — Bynx`,
    html,
  })
}