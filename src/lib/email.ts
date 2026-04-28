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
    ${p(`${firstName}, você ainda tem 2 dias para curtir tudo do Pro: importação ilimitada, scan com IA, marketplace, separadores e muito mais.`)}
    ${p('Depois de 7 dias, sua conta volta para o plano Free, mas tudo que você adicionou continua salvo.')}
    ${btn('Ver planos →', `${APP_URL}/plano`)}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Quer continuar no Pro? <a href="${APP_URL}/plano" style="color:#f59e0b;text-decoration:none;">Veja os planos aqui</a>.</p>
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
    ${p('Continue no Pro para manter acesso a importação por link, scan com IA e marketplace.')}
    ${btn('Continuar no Pro →', `${APP_URL}/plano`)}
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
      <tr><td style="padding:12px 16px;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">Categoria · Prioridade</td></tr>
      <tr><td style="padding:0 16px 12px;font-size:13px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;">${args.category} · <strong style="color:#f59e0b;">${args.priority}</strong></td></tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;font-family:Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Ver no painel admin →', `${APP_URL}/admin/tickets/${args.ticketId}`)}
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
    ${btn('Ver meu ticket →', `${APP_URL}/suporte/${args.ticketId}`)}
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
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;font-family:Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Responder no painel →', `${APP_URL}/admin/tickets/${args.ticketId}`)}
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
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;font-family:Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Ver conversa completa →', `${APP_URL}/suporte/${args.ticketId}`)}
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
    ${btn('Ver ticket →', `${APP_URL}/suporte/${args.ticketId}`)}
  `, `Seu ticket agora está ${info.label.toLowerCase()}`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `[Bynx Suporte] ${info.label}: ${args.subject}`, html })
}

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
    ${p(`${firstName}, boa notícia: <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi aprovada pela equipe do Bynx e já está no ar no Guia de Lojas.`)}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;">
      <tr><td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">Página pública</td></tr>
      <tr><td style="padding:0 18px 12px;font-size:13px;font-family:Arial,sans-serif;"><a href="${urlPublica}" style="color:#f59e0b;text-decoration:none;word-break:break-all;">${urlPublica}</a></td></tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 18px 6px;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">Painel de edição</td></tr>
      <tr><td style="padding:0 18px 14px;font-size:13px;font-family:Arial,sans-serif;"><a href="${urlEdicao}" style="color:#f59e0b;text-decoration:none;">${urlEdicao}</a></td></tr>
    </table>
    ${btn('Abrir minha loja →', urlEdicao)}
    ${divider()}
    ${p('<strong style="color:#f59e0b;">⭐ Seu trial Pro de 14 dias começou agora.</strong> Aproveita pra colocar fotos, redes sociais e deixar tudo bonito antes dos clientes chegarem.')}
    ${p('Depois dos 14 dias, você escolhe se quer continuar no <strong style="color:#f0f0f0;">Pro (R$ 39/mês)</strong> ou voltar pro <strong style="color:#f0f0f0;">Básico (grátis)</strong>.')}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Qualquer dúvida, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Sua loja ${args.nomeLoja} foi aprovada e já está no ar!`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `🎉 Sua loja foi aprovada no Bynx!`, html })
}

// ── 10. LOJAS — loja suspensa (para o owner) ─────────────────────────────────

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
    ${p(`${firstName}, precisamos te avisar que <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi suspensa temporariamente no Guia do Bynx.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid rgba(239,68,68,0.3);margin-top:16px;">
      <tr><td style="padding:14px 18px 6px;font-size:11px;color:#ef4444;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Motivo</td></tr>
      <tr><td style="padding:0 18px 16px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;font-family:Arial,sans-serif;white-space:pre-wrap;">${escapeHtml(args.motivo)}</td></tr>
    </table>
    ${divider()}
    ${p('Enquanto suspensa, sua loja <strong style="color:#ef4444;">não aparece</strong> no guia público. Para contestar ou pedir a reativação, é só responder este email explicando o que mudou.')}
    ${p('Nossa equipe analisa todos os pedidos e responde em até 48 horas úteis.')}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Sua loja ${args.nomeLoja} foi suspensa no Bynx`)

  return resend.emails.send({ from: FROM, to: args.to, subject: `Sua loja foi suspensa no Bynx`, html })
}

// ── 11. LOJAS — plano alterado pelo admin (para o owner) ─────────────────────

const PLANO_INFO: Record<string, { label: string; color: string; descricao: string; emoji: string }> = {
  basico: {
    label: 'Básico',
    color: 'rgba(255,255,255,0.7)',
    emoji: '📋',
    descricao: 'Listagem gratuita no Guia. Você pode fazer upgrade a qualquer momento para desbloquear fotos, redes sociais e mais visibilidade.',
  },
  pro: {
    label: 'Pro',
    color: '#60a5fa',
    emoji: '⭐',
    descricao: 'Até 5 fotos, redes sociais, especialidades ilimitadas e destaque acima do Básico no Guia.',
  },
  premium: {
    label: 'Premium',
    color: '#f59e0b',
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

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid ${cfgNovo.color}33;margin-top:16px;">
      <tr>
        <td style="padding:14px 18px 6px;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">
          Plano atual
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 12px;font-size:18px;font-weight:800;color:${cfgNovo.color};font-family:Arial,sans-serif;">
          ${cfgNovo.label}
        </td>
      </tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:12px 18px 6px;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">
          Validade
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 14px;font-size:14px;color:rgba(255,255,255,0.8);font-family:Arial,sans-serif;">
          ${args.planoNovo === 'basico'
            ? 'Sem expiração'
            : `Válido até <strong style="color:#f0f0f0;">${fmtDataExpiracao(args.expiraEm)}</strong>`
          }
        </td>
      </tr>
    </table>

    ${p(`<strong style="color:#f0f0f0;">O que isso significa:</strong> ${cfgNovo.descricao}`)}

    ${btn('Acessar minha loja →', urlEdicao)}

    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Qualquer dúvida sobre essa mudança, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, isUpgrade
    ? `Sua loja ${args.nomeLoja} foi promovida para ${cfgNovo.label}!`
    : `Plano da loja ${args.nomeLoja} foi atualizado para ${cfgNovo.label}`)

  const subject = isUpgrade
    ? `${cfgNovo.emoji} Sua loja agora é ${cfgNovo.label} no Bynx!`
    : `Plano da sua loja foi atualizado para ${cfgNovo.label}`

  return resend.emails.send({ from: FROM, to: args.to, subject, html })
}

// ── Helper: escapa HTML em mensagens de usuário ──────────────────────────────

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  )
}
