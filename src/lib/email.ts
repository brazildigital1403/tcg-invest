import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const LOGO = 'https://bynx.gg/logo_BYNX.png'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'
const FONT = "font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"

// ── Helper: adiciona UTM params em links de email ────────────────────────────
// Padrao: ?utm_source=email&utm_medium=<nurture|transactional>&utm_campaign=<X>&utm_content=<Y>
// Uso: addUtm(`${APP_URL}/minha-conta`, 'trial-2d', 'cta-button')

const UTM_NURTURE_CAMPAIGNS = new Set([
  'welcome', 'trial-2d', 'trial-1d', 'referral-activated', 'referral-engaged',
])

function addUtm(href: string, campaign: string, content?: string): string {
  try {
    const url = new URL(href)
    const medium = UTM_NURTURE_CAMPAIGNS.has(campaign) ? 'nurture' : 'transactional'
    url.searchParams.set('utm_source', 'email')
    url.searchParams.set('utm_medium', medium)
    url.searchParams.set('utm_campaign', campaign)
    if (content) url.searchParams.set('utm_content', content)
    return url.toString()
  } catch {
    return href  // fallback se URL invalida
  }
}


// ── Paletas ──────────────────────────────────────────────────────────────────
//
// Cores oficiais por contexto:
// - B2C (app principal — usuário Pro, Scan, Separadores, Trials, Tickets):
//     gradient laranja-vermelho '#f59e0b → #ef4444'
// - B2B (Loja — aprovação, suspensão, mudança de plano, ativação assinatura):
//     gradient base azul-roxo '#60a5fa → #a855f7' (Pro)
//     gradient premium '#a855f7 → #ec4899'
//
// Cores de link em emails B2B usam azul `#60a5fa` em vez de laranja.

const B2B_GRADIENT_PRO     = 'linear-gradient(135deg,#60a5fa,#a855f7)'
const B2B_GRADIENT_PREMIUM = 'linear-gradient(135deg,#a855f7,#ec4899)'
const B2B_LINK_COLOR       = '#60a5fa'

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
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');
    body,table,td,a,h1,p{${FONT}}
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
          <tr><td style="padding:40px 36px;${FONT}background-color:#0d0f14;" bgcolor="#0d0f14">
          <![endif]-->
          <!--[if !mso]><!-->
          <tr>
            <td style="background-color:#0d0f14;border-radius:20px;padding:40px 36px;border:1px solid #1f2937;${FONT}" bgcolor="#0d0f14">
          <!--<![endif]-->
              ${content}
          <!--[if mso]></td></tr></table></td></tr><![endif]-->
          <!--[if !mso]><!-->
            </td>
          </tr>
          <!--<![endif]-->

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:28px;color:#4b5563;font-size:12px;line-height:1.6;${FONT}background-color:#080a0f;" bgcolor="#080a0f">
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

// ── Botão B2C (laranja-vermelho) — app principal ─────────────────────────────

function btn(label: string, href: string, color = '#f59e0b') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
    <tr>
      <td align="center" bgcolor="#f59e0b" style="background-color:#f59e0b;border-radius:12px;mso-padding-alt:0;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="25%" stroke="f" fillcolor="#f59e0b"><w:anchorlock/><center style="color:#000000;${FONT}font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
        <!--[if !mso]><!-->
        <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:12px;color:#000;font-weight:800;font-size:15px;text-decoration:none;white-space:nowrap;padding:14px 32px;${FONT}">${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

// ── Botão B2B (gradiente customizável) — emails de Loja ──────────────────────
//
// Uso:
//   btnB2B('Acessar minha loja', '...')                          → gradiente Pro azul→roxo (default)
//   btnB2B('Acessar minha loja', '...', B2B_GRADIENT_PREMIUM)    → gradiente Premium roxo→pink
//   btnB2B('Acessar minha loja', '...', 'linear-gradient(...)')  → custom gradient
//
// MSO fallback: cor sólida do meio do gradient (#a855f7 default, #c027b9 premium).

function btnB2B(label: string, href: string, gradient: string = B2B_GRADIENT_PRO, msoSolidColor: string = '#8b5cf6') {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
    <tr>
      <td align="center" bgcolor="${msoSolidColor}" style="background-color:${msoSolidColor};border-radius:12px;mso-padding-alt:0;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="25%" stroke="f" fillcolor="${msoSolidColor}"><w:anchorlock/><center style="color:#ffffff;${FONT}font-size:15px;font-weight:bold;">${label}</center></v:roundrect><![endif]-->
        <!--[if !mso]><!-->
        <a href="${href}" style="display:inline-block;background:${gradient};border-radius:12px;color:#fff;font-weight:800;font-size:15px;text-decoration:none;white-space:nowrap;padding:14px 32px;${FONT}">${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#f0f0f0;letter-spacing:-0.03em;line-height:1.2;${FONT}">${text}</h1>`
}

function p(text: string, style = '') {
  return `<p style="margin:12px 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;${FONT}${style}">${text}</p>`
}

function divider() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;"><tr><td height="1" bgcolor="#1f2937" style="background-color:#1f2937;height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>`
}

function badge(text: string, color: string, bg: string) {
  return `<p style="margin:0 0 8px;font-size:10px;font-weight:800;color:${color};letter-spacing:0.08em;text-transform:uppercase;${FONT}">${text}</p>`
}

// ── 1. Email de boas-vindas ────────────────────────────────────────────────────

// ── Master Set desbloqueado (compra a-la-carte) ──────────────────────────────

export async function sendMasterSetUnlockedEmail(to: string, name: string, setName: string, setId: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const printUrl = addUtm(`${APP_URL}/master-sets/${setId}`, 'master-set-unlocked', 'cta-button')
  const html = baseLayout(`
    ${badge('Master Set liberado', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1(`Seu Master Set chegou, ${firstName}! 🗂️`)}
    ${p(`O <strong style="color:#f59e0b;">${setName}</strong> foi desbloqueado na sua conta. Agora é só abrir as folhas de fichário, marcar o que você já tem e imprimir pra completar o set.`)}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['🗂️ Folhas de 9 bolsos no tamanho exato da carta', '✅ Cartas que você já tem aparecem marcadas', '🖨️ Modo imagem ou econômico (número + nome)', '🔎 Filtro "só o que falta" pra focar nos buracos'].map(f => `
        <tr><td style="padding:6px 0;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">${f}</p>
        </td></tr>`).join('')}
    </table>
    ${btn('Abrir e imprimir →', printUrl)}
    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Acesso vitalício — esse Master Set fica liberado na sua conta pra sempre. Dúvidas? Fala com a gente em <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Seu Master Set ${setName} foi desbloqueado — imprima as folhas de fichário.`)

  return resend.emails.send({ from: FROM, to, subject: `🗂️ Master Set liberado: ${setName}`, html })
}

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${h1(`Bem-vindo à Bynx, ${firstName}! 🎉`)}
    ${p('Sua conta foi criada com sucesso. Você ganhou <strong style="color:#f59e0b;">7 dias de Pro grátis</strong> para explorar tudo que a Bynx tem a oferecer.')}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['📚 Catalogue suas cartas — busca por nome ou número', '📷 Scan IA — adicione cartas direto pela foto', '📊 Dashboard em BRL — min, médio e máx em tempo real', '📈 Histórico de preços — veja a evolução do mercado', '🛒 Marketplace brasileiro — compre e venda com segurança', '🎁 Indique e Ganhe — recompensas mensais indicando amigos'].map(f => `
        <tr><td style="padding:6px 0;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">${f}</p>
        </td></tr>`).join('')}
    </table>
    ${btn('Acessar minha conta', addUtm(`${APP_URL}/minha-colecao`, 'welcome', 'cta-button'))}
    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Tem alguma dúvida? Dá uma olhada no nosso <a href="${addUtm(`${APP_URL}/faq`, 'welcome', 'link-faq')}" style="color:#f59e0b;text-decoration:none;">FAQ</a> ou fala com a gente em <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Bem-vindo à Bynx, ${firstName}! Seus 7 dias de Pro grátis começaram.`)

  return resend.emails.send({ from: FROM, to, subject: `Bem-vindo à Bynx, ${firstName}! 🎉`, html })
}

// ── 2. Trial expirando — 5º dia ───────────────────────────────────────────────

export async function sendTrialExpiring5Email(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Pro Trial', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Seu trial Pro expira em 2 dias ⏰')}
    ${p(`${firstName}, você ainda tem 2 dias para curtir tudo do Pro: importação ilimitada, scan com IA, marketplace, separadores e muito mais.`)}
    ${p('Depois de 7 dias, sua conta volta para o plano Free, mas tudo que você adicionou continua salvo.')}
    ${btn('Ver planos →', addUtm(`${APP_URL}/minha-conta`, 'trial-2d', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Quer continuar no Pro? <a href="${addUtm(`${APP_URL}/minha-conta`, 'trial-2d', 'link-veja-planos')}" style="color:#f59e0b;text-decoration:none;">Veja os planos aqui</a>.</p>
  `, `Seu trial Pro expira em 2 dias`)

  return resend.emails.send({ from: FROM, to, subject: `⏰ Seu trial Pro expira em 2 dias`, html })
}

// ── 3. Trial expirando — último dia ──────────────────────────────────────────

export async function sendTrialExpiring1Email(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Último dia', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Hoje é o último dia do seu Pro trial 🚨')}
    ${p(`${firstName}, amanhã sua conta volta automaticamente para o plano Free. Você não perde nada que já adicionou — só os recursos Pro ficam bloqueados.`)}
    ${p('Continue no Pro para manter acesso a cartas ilimitadas, scan com IA e marketplace.')}
    ${btn('Continuar no Pro →', addUtm(`${APP_URL}/minha-conta`, 'trial-1d', 'cta-button'))}
  `, `Hoje é o último dia do seu Pro trial`)

  return resend.emails.send({ from: FROM, to, subject: `🚨 Último dia de Pro grátis`, html })
}

// ── 4. SUPORTE — novo ticket criado (para admin) ──────────────────────────────

export async function sendNewTicketAdminEmail(args: {
  to: string
  userEmail: string
  userName?: string
  ticketId: string
  subject: string
  category: string
  priority: string
  message: string
}) {
  const html = baseLayout(`
    ${badge('Novo Ticket', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Um novo ticket foi aberto')}
    ${p(`<strong style="color:#f0f0f0;">${args.userName || 'Colecionador'}</strong> (${args.userEmail}) abriu o ticket "<em style="color:#f59e0b;">${escapeHtml(args.subject)}</em>".`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:12px 16px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">Categoria · Prioridade</td></tr>
      <tr><td style="padding:0 16px 12px;font-size:13px;color:rgba(255,255,255,0.8);${FONT}">${args.category} · <strong style="color:#f59e0b;">${args.priority}</strong></td></tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Ver no painel admin →', addUtm(`${APP_URL}/admin/tickets/${args.ticketId}`, 'ticket-new-admin', 'cta-button'))}
  `, `Novo ticket: ${args.subject}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Suporte Bynx] Novo ticket: ${args.subject}`, html })
}

// ── 5. SUPORTE — confirmação de ticket criado (para usuário) ─────────────────

export async function sendTicketCreatedUserEmail(args: {
  to: string
  userName?: string
  ticketId: string
  subject: string
}) {
  const firstName = args.userName?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Ticket recebido', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Recebemos sua mensagem ✅')}
    ${p(`${firstName}, seu ticket "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>" foi criado e nossa equipe vai responder em breve.`)}
    ${p('Costumamos responder em até 24 horas úteis.')}
    ${btn('Ver meu ticket →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-created-user', 'cta-button'))}
  `, `Recebemos seu ticket: ${args.subject}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Bynx Suporte] Ticket recebido: ${args.subject}`, html })
}

// ── 6. SUPORTE — resposta do usuário (para admin) ────────────────────────────

export async function sendUserReplyAdminEmail(args: {
  to: string
  userEmail: string
  userName?: string
  ticketId: string
  subject: string
  message: string
}) {
  const html = baseLayout(`
    ${badge('Nova Resposta', '#60a5fa', 'rgba(96,165,250,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Nova resposta em ticket')}
    ${p(`<strong style="color:#f0f0f0;">${args.userName || 'Colecionador'}</strong> (${args.userEmail}) respondeu em "<em style="color:#f59e0b;">${escapeHtml(args.subject)}</em>":`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Responder no painel →', addUtm(`${APP_URL}/admin/tickets/${args.ticketId}`, 'ticket-user-reply', 'cta-button'))}
  `, `Nova resposta: ${args.subject}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Suporte Bynx] Resposta: ${args.subject}`, html })
}

// ── 7. SUPORTE — resposta do admin (para o usuário) ──────────────────────────

export async function sendAdminReplyUserEmail(args: {
  to: string
  userName?: string
  ticketId: string
  subject: string
  message: string
}) {
  const firstName = args.userName?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Resposta da Equipe', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Você tem uma nova resposta')}
    ${p(`${firstName}, nossa equipe respondeu seu ticket "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>":`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Ver conversa completa →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-admin-reply', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Para responder, basta abrir a conversa no botão acima. Você também pode responder este email, mas o caminho mais rápido é pelo app. 📬</p>
  `, `Resposta para seu ticket: ${args.subject}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Bynx Suporte] ${args.subject}`, html })
}

// ── 8. SUPORTE — mudança de status (para o usuário) ──────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string; emoji: string }> = {
  open:        { label: 'Aberto',       color: '#f59e0b', emoji: '📬' },
  in_progress: { label: 'Em andamento', color: '#60a5fa', emoji: '⚙️' },
  resolved:    { label: 'Resolvido',    color: '#22c55e', emoji: '✅' },
  closed:      { label: 'Fechado',      color: '#64748b', emoji: '📪' },
}

export async function sendTicketStatusChangedEmail(args: {
  to: string
  userName?: string
  ticketId: string
  subject: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
}) {
  const info = STATUS_LABEL[args.status] || STATUS_LABEL.open
  const firstName = args.userName?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">${info.emoji}</div>
    </div>
    ${h1(`Ticket ${info.label.toLowerCase()}`)}
    ${p(`${firstName}, o status do seu ticket "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>" foi atualizado para <strong style="color:${info.color};">${info.label}</strong>.`)}
    ${args.status === 'resolved' ? p('Se ainda tiver dúvidas ou o problema voltar, é só responder o ticket — ele reabre automaticamente.') : ''}
    ${btn('Ver ticket →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-status-changed', 'cta-button'))}
  `, `Seu ticket agora está ${info.label.toLowerCase()}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Bynx Suporte] ${info.label}: ${args.subject}`, html })
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAILS B2B — LOJAS
// Usam paleta azul-roxo: gradient `#60a5fa → #a855f7` (Pro) ou `#a855f7 → #ec4899` (Premium).
// Links de contato em azul `#60a5fa` em vez de laranja.
// ─────────────────────────────────────────────────────────────────────────────

// ── 9. LOJAS — loja aprovada (para o owner) ──────────────────────────────────

export async function sendEmailLojaAprovada(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  slug: string
}) {
  const firstName = args.nomeUser?.split(' ')[0] || 'Colecionador'
  const urlPublica = `${APP_URL}/lojas/${args.slug}`
  const urlEdicao  = `${APP_URL}/minha-loja`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">🎉</div>
    </div>
    ${h1('Sua loja foi aprovada!')}
    ${p(`${firstName}, boa notícia: <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi aprovada pela equipe da Bynx e já está no ar no Guia de Lojas.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;">
      <tr><td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">Página pública</td></tr>
      <tr><td style="padding:0 18px 12px;font-size:13px;${FONT}"><a href="${addUtm(urlPublica, 'loja-approved', 'link-publica')}" style="color:${B2B_LINK_COLOR};text-decoration:none;word-break:break-all;">${urlPublica}</a></td></tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">Painel de edição</td></tr>
      <tr><td style="padding:0 18px 14px;font-size:13px;${FONT}"><a href="${addUtm(urlEdicao, 'loja-approved', 'link-edicao')}" style="color:${B2B_LINK_COLOR};text-decoration:none;">${urlEdicao}</a></td></tr>
    </table>
    ${btnB2B('Abrir minha loja →', addUtm(urlEdicao, 'loja-approved', 'cta-button'))}
    ${divider()}
    ${p('<strong style="color:#60a5fa;">⭐ Seu trial Pro de 14 dias começou agora.</strong> Aproveita pra colocar fotos, redes sociais e deixar tudo bonito antes dos clientes chegarem.')}
    ${p('Depois dos 14 dias, você escolhe se quer continuar no <strong style="color:#f0f0f0;">Pro (R$ 39/mês)</strong> ou voltar pro <strong style="color:#f0f0f0;">Básico (grátis)</strong>.')}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Qualquer dúvida, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:${B2B_LINK_COLOR};text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Sua loja ${args.nomeLoja} foi aprovada e já está no ar!`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `🎉 Sua loja foi aprovada na Bynx!`, html })
}

// ── 10. LOJAS — loja suspensa (para o owner) ─────────────────────────────────
//
// Mantém vermelho como cor de alerta (universal). Só os links de contato
// usam azul B2B em vez de laranja, pra coerência com o restante dos emails de loja.

export async function sendEmailLojaSuspensa(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  motivo: string
}) {
  const firstName = args.nomeUser?.split(' ')[0] || 'Colecionador'

  const html = baseLayout(`
    ${badge('Loja suspensa', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Sua loja foi suspensa')}
    ${p(`${firstName}, precisamos te avisar que <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi suspensa temporariamente no Guia da Bynx.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid rgba(239,68,68,0.3);margin-top:16px;">
      <tr><td style="padding:14px 18px 6px;font-size:11px;color:#ef4444;${FONT}text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Motivo</td></tr>
      <tr><td style="padding:0 18px 16px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.motivo)}</td></tr>
    </table>
    ${divider()}
    ${p('Enquanto suspensa, sua loja <strong style="color:#ef4444;">não aparece</strong> no guia público. Para contestar ou pedir a reativação, é só responder este email explicando o que mudou.')}
    ${p('Nossa equipe analisa todos os pedidos e responde em até 48 horas úteis.')}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">📬 <a href="mailto:suporte@bynx.gg" style="color:${B2B_LINK_COLOR};text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Sua loja ${args.nomeLoja} foi suspensa na Bynx`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `Sua loja foi suspensa na Bynx`, html })
}

// ── 11. LOJAS — plano alterado (para o owner) ────────────────────────────────
//
// Disparado por:
//   - Admin via /api/admin/lojas/[id]/plano (concessão manual)
//   - Webhook Stripe via checkout.session.completed (assinatura comprada)
//
// Cores agora são B2B-coerentes:
//   - Pro:     `#60a5fa` (azul) — gradient `#60a5fa → #a855f7`
//   - Premium: `#a855f7` (roxo) — gradient `#a855f7 → #ec4899`
//   - Básico:  cinza neutro

const PLANO_INFO: Record<string, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  gradient: string
  msoSolid: string
  descricao: string
  emoji: string
}> = {
  basico: {
    label: 'Básico',
    color: 'rgba(255,255,255,0.7)',
    bgColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
    gradient: 'linear-gradient(135deg,#9ca3af,#6b7280)',
    msoSolid: '#6b7280',
    emoji: '📋',
    descricao: 'Listagem gratuita no Guia. Você pode fazer upgrade a qualquer momento para desbloquear fotos, redes sociais e mais visibilidade.',
  },
  pro: {
    label: 'Pro',
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.10)',
    borderColor: 'rgba(96,165,250,0.30)',
    gradient: B2B_GRADIENT_PRO,
    msoSolid: '#7c83f8',
    emoji: '⭐',
    descricao: 'Até 5 fotos, redes sociais, especialidades ilimitadas e destaque acima do Básico no Guia.',
  },
  premium: {
    label: 'Premium',
    color: '#a855f7',
    bgColor: 'rgba(168,85,247,0.10)',
    borderColor: 'rgba(168,85,247,0.30)',
    gradient: B2B_GRADIENT_PREMIUM,
    msoSolid: '#c47ce0',
    emoji: '👑',
    descricao: 'Até 10 fotos, eventos e torneios, analytics e rotação no topo da listagem.',
  },
}

function fmtDataExpiracao(iso: string | null | undefined): string {
  if (!iso) return 'sem expiração (permanente)'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export async function sendEmailLojaPlanoAlterado(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  slug: string
  planoAnterior: 'basico' | 'pro' | 'premium'
  planoNovo: 'basico' | 'pro' | 'premium'
  expiraEm: string | null  // ISO date string ou null para permanente
}) {
  const firstName = args.nomeUser?.split(' ')[0] || 'Colecionador'
  const cfgNovo = PLANO_INFO[args.planoNovo]
  const cfgAnterior = PLANO_INFO[args.planoAnterior]
  const urlEdicao = `${APP_URL}/minha-loja`

  // Detectar se é upgrade ou downgrade pra ajustar o tom
  const ordemPlanos: Record<string, number> = { basico: 0, pro: 1, premium: 2 }
  const isUpgrade = ordemPlanos[args.planoNovo] > ordemPlanos[args.planoAnterior]

  const titulo = isUpgrade
    ? `Sua loja foi promovida para ${cfgNovo.label}!`
    : `Plano da sua loja foi atualizado`

  const introducao = isUpgrade
    ? `${firstName}, ótima notícia: <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> agora está no plano <strong style="color:${cfgNovo.color};">${cfgNovo.label}</strong>! 🎉`
    : `${firstName}, queremos te avisar que o plano da sua loja <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi alterado de <strong style="color:${cfgAnterior.color};">${cfgAnterior.label}</strong> para <strong style="color:${cfgNovo.color};">${cfgNovo.label}</strong>.`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">${cfgNovo.emoji}</div>
    </div>
    ${h1(titulo)}
    ${p(introducao)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid ${cfgNovo.borderColor};margin-top:16px;">
      <tr>
        <td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Plano atual
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 12px;font-size:18px;font-weight:800;color:${cfgNovo.color};${FONT}">
          ${cfgNovo.label}
        </td>
      </tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:12px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Validade
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 14px;font-size:14px;color:rgba(255,255,255,0.8);${FONT}">
          ${args.planoNovo === 'basico'
            ? 'Sem expiração'
            : `Válido até <strong style="color:#f0f0f0;">${fmtDataExpiracao(args.expiraEm)}</strong>`
          }
        </td>
      </tr>
    </table>

    ${p(`<strong style="color:#f0f0f0;">O que isso significa:</strong> ${cfgNovo.descricao}`)}

    ${btnB2B('Acessar minha loja →', addUtm(urlEdicao, 'loja-plano-changed', 'cta-button'), cfgNovo.gradient, cfgNovo.msoSolid)}

    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Qualquer dúvida sobre essa mudança, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:${B2B_LINK_COLOR};text-decoration:none;">suporte@bynx.gg</a></p>
  `, isUpgrade
    ? `Sua loja ${args.nomeLoja} foi promovida para ${cfgNovo.label}!`
    : `Plano da loja ${args.nomeLoja} foi atualizado para ${cfgNovo.label}`)

  const subject = isUpgrade
    ? `${cfgNovo.emoji} Sua loja agora é ${cfgNovo.label} na Bynx!`
    : `Plano da sua loja foi atualizado para ${cfgNovo.label}`

  return resend.emails.send({ from: FROM, to: args.to, subject, html })
}

// ── 12. PURCHASE — confirmação de compra (após webhook Stripe) ───────────────
//
// Mantém paleta B2C (laranja-vermelho): cobre fluxos B2C apenas:
//   - 'pro_mensal'   → assinatura Pro mensal ativada
//   - 'pro_anual'    → assinatura Pro anual ativada
//   - 'separadores'  → pacote de separadores PDF desbloqueado
//   - 'scan_*'       → qualquer pacote de créditos de scan
//
// Fluxos B2B (Lojista) NÃO chamam essa função — usam sendEmailLojaPlanoAlterado.

export async function sendPurchaseConfirmationEmail(
  to: string,
  name: string,
  tipo: string
) {
  const firstName = name?.split(' ')[0] || 'Colecionador'

  let badgeLabel: string
  let badgeColor: string
  let badgeBg: string
  let titulo: string
  let intro: string
  let detalhes: string
  let ctaLabel: string
  let ctaHref: string
  let preheader: string
  let subject: string

  if (tipo === 'pro_mensal' || tipo === 'pro_anual') {
    const plano = tipo === 'pro_anual' ? 'anual' : 'mensal'
    badgeLabel = 'Pro Ativado'
    badgeColor = '#f59e0b'
    badgeBg = 'rgba(245,158,11,0.15)'
    titulo = `Bem-vindo à Bynx Pro ${plano === 'anual' ? 'Anual' : 'Mensal'}! ⭐`
    intro = `${firstName}, sua assinatura <strong style="color:#f59e0b;">Pro ${plano === 'anual' ? 'Anual' : 'Mensal'}</strong> foi ativada com sucesso. Obrigado por apoiar a Bynx!`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">📦 Cartas ilimitadas na sua coleção</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📷 Scan de cartas com IA</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🛒 Marketplace completo (compra e venda)</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🗂️ Separadores de fichário em PDF</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📊 Estatísticas e ranking exclusivos</p>
    `
    ctaLabel = 'Acessar minha conta'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = `Sua assinatura Pro ${plano === 'anual' ? 'Anual' : 'Mensal'} foi ativada.`
    subject = `⭐ Bem-vindo à Bynx Pro ${plano === 'anual' ? 'Anual' : 'Mensal'}!`

  } else if (tipo === 'separadores') {
    badgeLabel = 'Separadores Desbloqueados'
    badgeColor = '#22c55e'
    badgeBg = 'rgba(34,197,94,0.15)'
    titulo = 'Separadores liberados! 🗂️'
    intro = `${firstName}, sua compra dos <strong style="color:#22c55e;">Separadores de Fichário</strong> foi confirmada e o recurso já está liberado na sua conta.`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">🎨 Layouts profissionais prontos pra imprimir</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📄 Geração em PDF de alta qualidade</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">♾️ Quantos separadores quiser, pra sempre</p>
    `
    ctaLabel = 'Acessar separadores'
    ctaHref = `${APP_URL}/separadores`
    preheader = 'Seus separadores de fichário já estão liberados.'
    subject = '🗂️ Seus separadores foram liberados na Bynx!'

  } else if (tipo.startsWith('scan_')) {
    badgeLabel = 'Créditos Adicionados'
    badgeColor = '#60a5fa'
    badgeBg = 'rgba(96,165,250,0.15)'
    titulo = 'Créditos de scan adicionados! 📷'
    intro = `${firstName}, sua compra de créditos de scan foi confirmada e os créditos já estão disponíveis na sua conta.`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">📷 Cada scan reconhece uma carta automaticamente via IA</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">⚡ Use pela câmera ou enviando uma foto</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">♾️ Os créditos não expiram</p>
    `
    ctaLabel = 'Começar a escanear'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = 'Seus créditos de scan já estão disponíveis.'
    subject = '📷 Seus créditos de scan estão disponíveis!'

  } else if (tipo === 'plus') {
    badgeLabel = 'Plus Ativado'
    badgeColor = '#f59e0b'
    badgeBg = 'rgba(245,158,11,0.15)'
    titulo = 'Bem-vindo à Bynx Plus! ✨'
    intro = `${firstName}, sua assinatura <strong style="color:#f59e0b;">Plus</strong> foi ativada com sucesso. Obrigado por apoiar a Bynx!`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">📦 Até 500 cartas na sua coleção</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📊 Dashboard completo</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🛒 Marketplace ilimitado</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🔍 Pokédex completa + pastas ilimitadas</p>
    `
    ctaLabel = 'Acessar minha conta'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = 'Sua assinatura Plus foi ativada.'
    subject = '✨ Bem-vindo à Bynx Plus!'

  } else {
    // Fallback genérico — não deveria acontecer em produção, mas é seguro
    badgeLabel = 'Compra Confirmada'
    badgeColor = '#22c55e'
    badgeBg = 'rgba(34,197,94,0.15)'
    titulo = 'Compra confirmada! ✅'
    intro = `${firstName}, sua compra foi confirmada com sucesso.`
    detalhes = ''
    ctaLabel = 'Acessar minha conta'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = 'Sua compra foi confirmada.'
    subject = '✅ Sua compra foi confirmada na Bynx'
  }

  const html = baseLayout(`
    ${badge(badgeLabel, badgeColor, badgeBg)}
    <div style="height:16px;"></div>
    ${h1(titulo)}
    ${p(intro)}
    ${detalhes ? `${divider()}<table width="100%" cellpadding="0" cellspacing="0"><tr><td>${detalhes}</td></tr></table>` : ''}
    ${btn(ctaLabel, addUtm(ctaHref, `purchase-${tipo}`, 'cta-button'))}
    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Qualquer dúvida, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, preheader)

  return resend.emails.send({ from: FROM, to, subject, html })
}

// ── 13. TRIAL — alias de sendTrialExpiring1Email ─────────────────────────────

/**
 * Alias semântico. O cron-trial-emails chama esta função quando `daysLeft === 1`
 * (último dia do trial de 7 dias). É exatamente o mesmo email que o
 * `sendTrialExpiring1Email` envia ("1 dia restante" = "7º dia do trial" = último dia).
 *
 * Mantido como wrapper pra não duplicar HTML e garantir que ambos os nomes
 * usados no codebase funcionem.
 */
export async function sendTrialExpiring7Email(to: string, name: string) {
  return sendTrialExpiring1Email(to, name)
}

// ── Helper: escapa HTML em mensagens de usuário ──────────────────────────────

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SNIPPET INDIQUE E GANHE — adicionar AO FINAL do email.ts existente.
// Mantém código existente intacto. Reusa baseLayout, btn, h1, p, divider, badge.
// ═══════════════════════════════════════════════════════════════════════════

// ── 14. INDIQUE E GANHE — referral ativada (pro indicador) ───────────────────

export async function sendReferralActivatedEmail(args: {
  to: string
  name: string
  pointsAwarded: number
  newBalance: number
}) {
  const firstName = args.name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Indicação Ativada', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1(`Você ganhou ${args.pointsAwarded} pontos! 🎉`)}
    ${p(`${firstName}, alguém que você indicou completou o cadastro, confirmou o email e começou a usar a Bynx de verdade. Você ganhou <strong style="color:#22c55e;">+${args.pointsAwarded} pontos</strong>!`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid rgba(34,197,94,0.25);margin-top:16px;">
      <tr>
        <td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Saldo de pontos
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 14px;font-size:24px;font-weight:800;color:#22c55e;${FONT}">
          ${args.newBalance.toLocaleString('pt-BR')} pts
        </td>
      </tr>
    </table>

    ${p('Use seus pontos pra desbloquear dias de Pro, créditos de scan, separadores em PDF e prêmios físicos no marketplace de recompensas.')}

    ${btn('Ver minhas recompensas →', addUtm(`${APP_URL}/recompensas`, 'referral-activated', 'cta-button'))}

    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
      Continue indicando: cada nova indicação ativada vale ainda mais pontos, até o cap de 100 pts. Se ela virar Pro, você ganha <strong style="color:#f59e0b;">+200 pts extras</strong>! 🔥
    </p>
  `, `Você ganhou ${args.pointsAwarded} pontos por indicar alguém!`)

  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject: `🎉 +${args.pointsAwarded} pts! Sua indicação ativou na Bynx`,
    html,
  })
}

// ── 15. INDIQUE E GANHE — referral engajada (virou Pro) ──────────────────────

export async function sendReferralEngagedEmail(args: {
  to: string
  name: string
  newBalance: number
}) {
  const firstName = args.name?.split(' ')[0] || 'Colecionador'
  const POINTS = 200

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">🚀</div>
    </div>
    ${h1('Sua indicação virou Pro!')}
    ${p(`${firstName}, BOA notícia em dose dupla: alguém que você indicou assinou a Bynx Pro. Você ganhou <strong style="color:#f59e0b;">+${POINTS} pontos</strong> de bônus!`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid rgba(245,158,11,0.3);margin-top:16px;">
      <tr>
        <td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Bônus por engajamento
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 12px;font-size:24px;font-weight:800;color:#f59e0b;${FONT}">
          +${POINTS} pts
        </td>
      </tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:12px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Saldo total
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 14px;font-size:18px;font-weight:800;color:#f0f0f0;${FONT}">
          ${args.newBalance.toLocaleString('pt-BR')} pts
        </td>
      </tr>
    </table>

    ${btn('Ver recompensas disponíveis →', addUtm(`${APP_URL}/recompensas`, 'referral-engaged', 'cta-button'))}

    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
      Top 3 do mês ganham <strong style="color:#f59e0b;">prêmios físicos exclusivos</strong>. Continua na sua jornada — quem sabe esse mês não é o seu? 🏆
    </p>
  `, `+${POINTS} pts! Sua indicação virou Pro na Bynx`)

  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject: `🚀 +${POINTS} pts! Sua indicação virou Pro`,
    html,
  })
}

// ── 16. INDIQUE E GANHE — confirmação de resgate ─────────────────────────────

export async function sendRedemptionConfirmedEmail(args: {
  to: string
  name: string
  rewardTitle: string
  costPoints: number
  newBalance: number
  redemptionId: string
  fulfillmentInstructions?: string
}) {
  const firstName = args.name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Resgate Confirmado', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Recompensa resgatada com sucesso! ✅')}
    ${p(`${firstName}, seu resgate de <strong style="color:#f0f0f0;">${escapeHtml(args.rewardTitle)}</strong> foi confirmado.`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr>
        <td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Pontos gastos
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 12px;font-size:18px;font-weight:800;color:#ef4444;${FONT}">
          -${args.costPoints.toLocaleString('pt-BR')} pts
        </td>
      </tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:12px 18px 6px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">
          Saldo restante
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 14px;font-size:18px;font-weight:800;color:#22c55e;${FONT}">
          ${args.newBalance.toLocaleString('pt-BR')} pts
        </td>
      </tr>
    </table>

    ${args.fulfillmentInstructions ? p(args.fulfillmentInstructions) : p('Sua recompensa já está ativa na sua conta. Aproveite! 🎴')}

    ${btn('Acessar minha conta', addUtm(`${APP_URL}/minha-colecao`, 'redemption-confirmed', 'cta-button'))}

    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
      Código do resgate: <code style="color:#9ca3af;font-family:'SF Mono',Monaco,monospace;">${args.redemptionId.slice(0, 8)}</code> · Qualquer dúvida, é só responder este email. 📬
    </p>
  `, `Resgate confirmado: ${args.rewardTitle}`)

  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject: `✅ Resgate confirmado: ${args.rewardTitle}`,
    html,
  })
}

// ── PAGAMENTO — renovacao falhou (dunning, para usuario) ─────────────────────

export async function sendPaymentFailedEmail(to: string, name: string) {
  const firstName = name?.split(' ')[0] || 'Colecionador'
  const html = baseLayout(`
    ${badge('Ação necessária', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Não conseguimos renovar seu Pro 💳')}
    ${p(`${firstName}, a cobrança da sua assinatura Bynx Pro foi recusada — geralmente é cartão expirado, sem saldo ou bloqueio do banco.`)}
    ${p('Fique tranquilo: seu acesso Pro continua ativo enquanto tentamos cobrar de novo nos próximos dias. Para não perder o acesso, atualize sua forma de pagamento.')}
    ${btn('Atualizar pagamento →', addUtm(`${APP_URL}/minha-conta`, 'payment-failed', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Já atualizou? Pode ignorar este email — a próxima tentativa de cobrança resolve sozinha.</p>
  `, `Atualize seu pagamento para manter o Pro ativo`)

  return resend.emails.send({ from: FROM, to, subject: `💳 Não conseguimos renovar seu Bynx Pro`, html })
}

// ── PAGAMENTO — chargeback aberto (alerta para admin) ────────────────────────

export async function sendDisputeAdminEmail(args: {
  to: string
  charge: string
  reason: string
  amount: number
  currency: string
  status: string
  customer?: string | null
}) {
  const valor = (args.amount / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: (args.currency || 'brl').toUpperCase(),
  })
  const html = baseLayout(`
    ${badge('Chargeback', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Disputa aberta no Stripe ⚠️')}
    ${p('Um cliente abriu uma disputa (chargeback) junto ao banco. Responda o quanto antes no Stripe para não perder o valor mais a multa de disputa.')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:12px 16px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">Valor · Motivo · Status</td></tr>
      <tr><td style="padding:0 16px 12px;font-size:14px;color:rgba(255,255,255,0.85);${FONT}"><strong style="color:#f59e0b;">${valor}</strong> · ${escapeHtml(args.reason)} · ${escapeHtml(args.status)}</td></tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;font-size:12px;color:rgba(255,255,255,0.6);${FONT}">charge ${escapeHtml(args.charge)}${args.customer ? ` · customer ${escapeHtml(args.customer)}` : ''}</td></tr>
    </table>
    ${btn('Abrir disputas no Stripe →', 'https://dashboard.stripe.com/disputes')}
  `, `Chargeback aberto: ${valor}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Bynx] ALERTA: chargeback aberto (${valor})`, html })
}


// ── Marketplace: marcos da negociacao + nao lidas ────────────────────────────

function fmtBRLemail(v: number | null | undefined): string {
  const n = Number(v || 0)
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function convoUrl(anuncioId: string, campaign: string): string {
  return addUtm(`${APP_URL}/marketplace?conversa=${anuncioId}`, campaign)
}

export async function sendNovaNegociacaoEmail(args: {
  to: string; sellerName: string; buyerName: string; cardName: string; price: number | null; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_nova_negociacao')
  const first = (args.sellerName || '').split(' ')[0] || 'colecionador'
  const comprador = escapeHtml(args.buyerName || 'Um comprador')
  const carta = escapeHtml(args.cardName || 'sua carta')
  const html = baseLayout(`
    ${badge('Marketplace', '#f59e0b', '')}
    ${h1('Alguém quer sua carta! 🤝')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`<b style="color:#f0f0f0;">${comprador}</b> demonstrou interesse em <b style="color:#f0f0f0;">${carta}</b>${args.price ? ` (${fmtBRLemail(args.price)})` : ''} e abriu uma negociação com você.`)}
    ${p('Responda pelo chat da Bynx para combinar valor, condição e envio — tudo dentro da plataforma.')}
    ${btn('Abrir conversa →', url)}
  `, `${args.buyerName || 'Um comprador'} quer ${args.cardName}`)
  return resend.emails.send({ from: FROM, to: args.to, subject: `🤝 Nova negociação: ${args.cardName}`, html })
}

export async function sendCartaEnviadaEmail(args: {
  to: string; buyerName: string; sellerName: string; cardName: string; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_carta_enviada')
  const first = (args.buyerName || '').split(' ')[0] || 'colecionador'
  const vendedor = escapeHtml(args.sellerName || 'O vendedor')
  const carta = escapeHtml(args.cardName || 'a carta')
  const html = baseLayout(`
    ${badge('Marketplace', '#f59e0b', '')}
    ${h1('Sua carta foi enviada! 📦')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`<b style="color:#f0f0f0;">${vendedor}</b> confirmou o envio de <b style="color:#f0f0f0;">${carta}</b>.`)}
    ${p('Quando a carta chegar, confirme o recebimento pelo chat para concluir a negociação e adicioná-la à sua coleção.')}
    ${btn('Acompanhar negociação →', url)}
  `, `${args.sellerName || 'O vendedor'} enviou ${args.cardName}`)
  return resend.emails.send({ from: FROM, to: args.to, subject: `📦 Carta enviada: ${args.cardName}`, html })
}

export async function sendNegociacaoConcluidaEmail(args: {
  to: string; sellerName: string; buyerName: string; cardName: string; price: number | null; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_concluida')
  const first = (args.sellerName || '').split(' ')[0] || 'colecionador'
  const comprador = escapeHtml(args.buyerName || 'O comprador')
  const carta = escapeHtml(args.cardName || 'a carta')
  const html = baseLayout(`
    ${badge('Marketplace', '#22c55e', '')}
    ${h1('Venda concluída! ✅')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`<b style="color:#f0f0f0;">${comprador}</b> confirmou o recebimento de <b style="color:#f0f0f0;">${carta}</b>${args.price ? ` (${fmtBRLemail(args.price)})` : ''}. Negociação concluída com sucesso!`)}
    ${p('Que tal avaliar o comprador? Avaliações ajudam toda a comunidade a negociar com mais confiança.')}
    ${btn('Avaliar comprador →', url)}
  `, `Venda concluída: ${args.cardName}`)
  return resend.emails.send({ from: FROM, to: args.to, subject: `✅ Venda concluída: ${args.cardName}`, html })
}

export async function sendMensagensNaoLidasEmail(args: {
  to: string; name: string; qtd: number; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_nao_lidas')
  const first = (args.name || '').split(' ')[0] || 'colecionador'
  const plural = args.qtd > 1
  const titulo = plural ? `Você tem ${args.qtd} mensagens não lidas 💬` : 'Você tem uma mensagem não lida 💬'
  const corpo = plural
    ? `Há <b style="color:#f0f0f0;">${args.qtd} mensagens</b> te esperando no chat do marketplace da Bynx.`
    : 'Há uma mensagem te esperando no chat do marketplace da Bynx.'
  const html = baseLayout(`
    ${badge('Marketplace', '#f59e0b', '')}
    ${h1(titulo)}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`${corpo} Não deixe seu comprador ou vendedor no vácuo!`)}
    ${btn('Ver conversas →', url)}
  `, plural ? `${args.qtd} mensagens não lidas na Bynx` : 'Você tem uma mensagem não lida')
  const subject = plural ? `💬 ${args.qtd} mensagens não lidas na Bynx` : '💬 Você tem uma mensagem não lida na Bynx'
  return resend.emails.send({ from: FROM, to: args.to, subject, html })
}

// ─── Stripe Connect (vendas on-site) ────────────────────────────────────────

/**
 * Recebimentos liberados: a loja ja pode vender na Bynx.
 * Disparado pelo webhook account.updated quando a conta vira `ativo`.
 */
export async function sendConnectAtivoEmail(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  lojaId: string
}) {
  const firstName = args.nomeUser?.split(' ')[0] || 'Colecionador'
  const url = `${APP_URL}/minha-loja/${args.lojaId}/pagamentos`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">🎉</div>
    </div>
    ${h1('Seus recebimentos estão ativos!')}
    ${p(`${firstName}, a Stripe aprovou o cadastro de <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong>. Sua loja já pode vender direto na Bynx.`)}
    ${p('O dinheiro das suas vendas cai na conta bancária que você cadastrou. A gente nunca toca nele — quem cuida disso é a Stripe.')}
    ${divider()}
    ${p('<strong style="color:#f0f0f0;">Como funciona:</strong>')}
    ${p('• O colecionador compra sua carta aqui mesmo, com Pix ou cartão')}
    ${p('• Você recebe um aviso e envia a carta')}
    ${p('• O valor cai na sua conta no prazo de repasse que você escolheu')}
    ${divider()}
    ${btnB2B('Ver meus pagamentos', addUtm(url, 'connect_ativo'), B2B_GRADIENT_PREMIUM, '#a855f7')}
  `, 'Sua loja já pode vender na Bynx')

  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject: `🎉 ${args.nomeLoja}: seus recebimentos estão ativos!`,
    html,
  })
}

/**
 * A Stripe pediu mais alguma informacao pra liberar os recebimentos.
 * Disparado quando a conta fica `restrito` COM pendencia real (currently_due /
 * past_due). Nunca disparar em `em_analise` — la nao ha nada a fazer, e o
 * email so geraria ansiedade e um clique que nao resolve nada.
 */
export async function sendConnectPendenciaEmail(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  lojaId: string
  qtdPendencias: number
}) {
  const firstName = args.nomeUser?.split(' ')[0] || 'Colecionador'
  const url = `${APP_URL}/minha-loja/${args.lojaId}/pagamentos`
  const plural = args.qtdPendencias === 1 ? 'uma informação' : `${args.qtdPendencias} informações`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">📋</div>
    </div>
    ${h1('Falta pouco para você vender na Bynx')}
    ${p(`${firstName}, a Stripe precisa de ${plural} a mais para liberar os recebimentos de <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong>.`)}
    ${p('É rapidinho e você continua exatamente de onde parou. Enquanto isso, sua loja segue no ar normalmente — só as vendas com pagamento pela Bynx que ficam esperando.')}
    ${divider()}
    ${btnB2B('Resolver agora', addUtm(url, 'connect_pendencia'), B2B_GRADIENT_PRO, '#8b5cf6')}
    ${p('<span style="color:rgba(255,255,255,0.4);font-size:13px;">Essas informações são exigidas pela Stripe, que processa os pagamentos com segurança. A Bynx não tem acesso aos seus dados bancários.</span>')}
  `, `A Stripe precisa de ${plural} para liberar seus recebimentos`)

  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject: `📋 ${args.nomeLoja}: falta pouco para ativar seus recebimentos`,
    html,
  })
}
