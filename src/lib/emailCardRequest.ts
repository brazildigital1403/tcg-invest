import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'
const LOGO = 'https://bynx.gg/logo_BYNX.png'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  )
}

function brl(v: number): string {
  return v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function shell(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#080a0f;" bgcolor="#080a0f">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
<tr><td align="center" style="padding-bottom:32px;"><img src="${LOGO}" alt="Bynx" height="36" style="height:36px;width:auto;display:block;border:0;"/></td></tr>
<tr><td style="background-color:#0d0f14;border-radius:20px;padding:40px 36px;border:1px solid #1f2937;" bgcolor="#0d0f14">
${content}
</td></tr>
<tr><td align="center" style="padding-top:28px;color:#4b5563;font-size:12px;line-height:1.6;font-family:Arial,sans-serif;">
Bynx · Tudo que você precisa, em um só lugar!<br/>
<a href="${APP_URL}" style="color:#6b7280;text-decoration:none;">bynx.gg</a> · <a href="mailto:suporte@bynx.gg" style="color:#6b7280;text-decoration:none;">suporte@bynx.gg</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}

function btn(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;"><tr>
<td align="center" bgcolor="#f59e0b" style="background-color:#f59e0b;border-radius:12px;">
<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);border-radius:12px;color:#000;font-weight:800;font-size:15px;text-decoration:none;padding:14px 32px;font-family:Arial,sans-serif;">${label}</a>
</td></tr></table>`
}

export async function sendCardRequestResolvedEmail(args: {
  to: string
  name: string
  tipo: 'faltando' | 'erro' | string
  nome?: string | null
  numero?: string | null
  colecao?: string | null
  cardId?: string | null
  erroTipo?: string | null
}) {
  const firstName = (args.name || '').split(' ')[0] || 'Colecionador'
  const isErro = args.tipo === 'erro'
  const cartaLabel = [args.nome || '', args.numero ? `(${args.numero})` : '', args.colecao ? `· ${args.colecao}` : '']
    .filter(Boolean).join(' ').trim()
  const href = args.cardId ? `${APP_URL}/carta/${encodeURIComponent(args.cardId)}` : `${APP_URL}/minha-colecao`

  const titulo = isErro ? 'Corrigimos a carta que você reportou' : 'A carta que você pediu já está na Bynx'
  const intro = isErro
    ? `${escapeHtml(firstName)}, obrigado por avisar. Revisamos e corrigimos ${args.erroTipo ? `o(a) <strong style="color:#f59e0b;">${escapeHtml(args.erroTipo)}</strong> d` : ''}a carta que você apontou.`
    : `${escapeHtml(firstName)}, boa notícia: a carta que você pediu foi catalogada e já aparece na busca da Bynx.`

  const content = `
<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#22c55e;letter-spacing:0.04em;font-family:Arial,sans-serif;">${isErro ? 'Carta corrigida' : 'Carta adicionada'}</p>
<h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#f0f0f0;letter-spacing:-0.03em;line-height:1.2;font-family:Arial,sans-serif;">${titulo}</h1>
<p style="margin:12px 0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;font-family:Arial,sans-serif;">${intro}</p>
${cartaLabel ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:8px;"><tr><td style="padding:14px 18px;font-size:14px;color:rgba(255,255,255,0.85);font-family:Arial,sans-serif;">${escapeHtml(cartaLabel)}</td></tr></table>` : ''}
${btn(isErro ? 'Ver a carta' : 'Ver na Bynx', href)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr><td height="1" bgcolor="#1f2937" style="height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;font-family:Arial,sans-serif;">Obrigado por ajudar a deixar o catálogo da Bynx.gg cada vez mais completo. Dúvidas? <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
`
  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject: isErro ? 'Corrigimos sua carta na Bynx' : 'Sua carta foi adicionada à Bynx',
    html: shell(content, isErro ? 'Corrigimos a carta que você reportou.' : 'A carta que você pediu já está na Bynx.'),
  })
}

export async function sendCardRequestBatchEmail(args: {
  to: string
  name: string
  cartas: { nome: string; set?: string | null; idioma?: string | null; preco?: number | null }[]
}) {
  const firstName = (args.name || '').split(' ')[0] || 'Colecionador'
  const n = args.cartas.length
  const plural = n > 1
  const total = args.cartas.reduce((s, c) => s + (c.preco && c.preco > 0 ? c.preco : 0), 0)

  const rows = args.cartas.map(c => {
    const sub = [c.set, c.idioma].filter(Boolean).map(x => escapeHtml(String(x))).join(' · ')
    const precoTxt = (c.preco != null && c.preco > 0)
      ? `<span style="color:rgba(255,255,255,0.4);font-size:11px;">a partir de</span><br/><span style="color:#f59e0b;font-weight:700;font-size:15px;">R$ ${brl(c.preco)}</span>`
      : `<span style="color:rgba(255,255,255,0.35);font-size:13px;">sob consulta</span>`
    return `<tr>
<td style="padding:12px 0;border-bottom:1px solid #1f2937;font-family:Arial,sans-serif;vertical-align:top;">
<span style="color:#f0f0f0;font-size:15px;font-weight:700;">${escapeHtml(c.nome)}</span>${sub ? `<br/><span style="color:rgba(255,255,255,0.45);font-size:13px;">${sub}</span>` : ''}
</td>
<td align="right" style="padding:12px 0;border-bottom:1px solid #1f2937;font-family:Arial,sans-serif;white-space:nowrap;vertical-align:top;">${precoTxt}</td>
</tr>`
  }).join('')

  const totalRow = total > 0
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:14px 0 0;font-family:Arial,sans-serif;font-size:14px;color:rgba(255,255,255,0.6);">${n} carta${plural ? 's' : ''} adicionada${plural ? 's' : ''}</td>
<td align="right" style="padding:14px 0 0;font-family:Arial,sans-serif;font-size:16px;font-weight:700;color:#f0f0f0;white-space:nowrap;">R$ ${brl(total)}</td>
</tr></table>`
    : ''

  const content = `
<p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:0.04em;font-family:Arial,sans-serif;">a pedido seu</p>
<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#f0f0f0;letter-spacing:-0.02em;line-height:1.25;font-family:Arial,sans-serif;">${n} carta${plural ? 's' : ''} que você pediu ${plural ? 'já estão' : 'já está'} na Bynx</h1>
<p style="margin:12px 0 20px;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.7;font-family:Arial,sans-serif;">Olá, ${escapeHtml(firstName)}! Boas notícias: adicionamos ao catálogo Bynx.gg ${plural ? `as ${n} cartas` : 'a carta'} que você solicitou. ${plural ? 'Já estão disponíveis' : 'Já está disponível'} para adicionar a sua coleção, com o preço em reais atualizado.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
${totalRow}
${btn('Ver minhas cartas na Bynx', `${APP_URL}/minha-colecao`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;"><tr><td height="1" bgcolor="#1f2937" style="height:1px;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;font-family:Arial,sans-serif;">Obrigado por nos ajudar a deixar o catálogo da Bynx.gg mais completo. Dúvidas? <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
`
  const subject = plural ? `Adicionamos as ${n} cartas que você pediu` : 'Adicionamos a carta que você pediu'
  return resend.emails.send({
    from: FROM,
    to: args.to,
    subject,
    html: shell(content, plural ? `${n} cartas novas no catálogo, com preço em reais.` : 'Sua carta já está na Bynx, com preço em reais.'),
  })
}
