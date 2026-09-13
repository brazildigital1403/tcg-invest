import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Bynx <noreply@bynx.gg>'

// ─── Padrao de ASSUNTO (nao fugir disso) ────────────────────────────────────
//
// 1) Email pro USUARIO  ->  `Assunto — Bynx.gg`
//    O sufixo fixa o dominio na cabeca de quem le, sem depender do remetente
//    (que muitos clientes de email escondem ou truncam).
//    Nao repetir "Bynx" no meio do texto: "Bem-vindo a Bynx — Bynx.gg" fica bobo.
//
// 2) Email INTERNO / operacional  ->  `[Bynx Setor] Assunto`
//    Prefixo por setor pra filtrar/buscar na caixa: Suporte, Contato, Sync,
//    Alerta. Esses NAO levam o sufixo — sao pra dentro de casa.

/**
 * Assunto e CABECALHO, nao HTML — nao leva escape de HTML (senao o usuario
 * veria "&amp;" no titulo). O que ele nao pode ter e quebra de linha: o
 * assunto do ticket vem de campo livre com `slice(0, 200)` e nada impede um
 * \n. A API do Resend codifica, mas normalizar aqui e barato e fecha a porta.
 */
function limparAssunto(texto: string): string {
  return String(texto ?? '').replace(/[\r\n]+/g, ' ').trim()
}

/** Assunto pro usuario final: `Assunto — Bynx.gg` */
/**
 * O primeiro nome, apresentavel.
 *
 * ★ POR QUE (08/09/2026): o cadastro guarda o nome como a pessoa digitou, e
 * muita gente digita TUDO EM MAIUSCULA. O padrao antigo era so
 * `nome.split(' ')[0]`, entao saia "Ola, GABRIELA." em email transacional --
 * visto no painel de entrega, num email real. Estava nos 30 templates, nao
 * so num.
 *
 * ★ So normaliza quando a palavra INTEIRA esta em uma caixa so. Nome com
 * maiuscula no meio ("McCarthy", "DiCaprio") foi digitado assim de proposito
 * e passa intacto -- capitalizar tudo cegamente estragaria esses.
 */
function primeiroNome(nome: string | null | undefined, fallback: string): string {
  const bruto = String(nome || '').trim().split(/\s+/)[0] || ''
  if (!bruto) return fallback
  const so1caixa = bruto === bruto.toUpperCase() || bruto === bruto.toLowerCase()
  if (!so1caixa) return bruto
  return bruto.charAt(0).toLocaleUpperCase('pt-BR') + bruto.slice(1).toLocaleLowerCase('pt-BR')
}

function subjUser(texto: string): string {
  return `${limparAssunto(texto)} — Bynx.gg`
}

/** Assunto interno: `[Bynx Setor] Assunto` */
function subjInterno(setor: 'Suporte' | 'Contato' | 'Sync' | 'Alerta', texto: string): string {
  return `[Bynx ${setor}] ${limparAssunto(texto)}`
}
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

// ── Envio ─────────────────────────────────────────────────────────────────────
//
// ★ O SDK do Resend NAO LANCA em erro de API — ele devolve `{ data, error }`.
// Por isso todo `try/catch` e `.catch(console.error)` espalhado pelas rotas
// pegava so falha de REDE. E-mail rejeitado (endereco invalido, dominio nao
// verificado, rate limit, supressao) voltava em `error` e ninguem olhava:
// a Bynx nao tinha como saber que um e-mail nao chegou. Num negocio onde o
// e-mail entrega o Master Set, a confirmacao de pedido e a aprovacao de loja,
// falha silenciosa e o pior modo de falhar.
//
// Este helper existe pra isso: nenhum envio deve chamar `resend.emails.send`
// direto. Ele mantem a mesma forma de retorno, entao nenhum chamador quebra.
// ── Descadastro (so e-mail de RELACIONAMENTO) ───────────────────────────────
//
// Gmail e Yahoo exigem List-Unsubscribe + List-Unsubscribe-Post de quem manda
// volume (RFC 8058). Sem isso a entrega degrada sozinha com o tempo.
//
// ATENCAO: `{{{RESEND_UNSUBSCRIBE_URL}}}` NAO serve aqui. Aquela variavel e
// substituida so em BROADCAST (envio pra Audience). Neste arquivo tudo sai por
// `emails.send`, onde ela chegaria LITERAL na tela do usuario. Por isso a URL
// e nossa, com token proprio.
//
// Escopo e proposital: SO os 5 e-mails de relacionamento. Recibo, pedido,
// ticket, master set e loja NAO levam descadastro — ninguem pode optar por nao
// receber a confirmacao de uma compra que fez, e oferecer isso so cria o risco
// de a pessoa desligar o que ela precisa receber.

/**
 * ★ Host canonico, SEM www — obrigatorio no link de descadastro.
 *
 * `www.bynx.gg` responde 308 pra `bynx.gg`, e o um-clique do Gmail e um POST.
 * POST em cima de redirect e exatamente a armadilha que ja mordeu o webhook da
 * Stripe nesta casa: o cliente pode simplesmente nao seguir, e o descadastro
 * falha CALADO. Pior que nao ter: o provedor passa a ver um unsubscribe
 * quebrado, que e o que ele estava tentando garantir.
 *
 * Por isso nao uso APP_URL direto — ele pode vir com www do ambiente.
 * Medido em 27/07/2026: GET e POST em www devolvem 308.
 */
const URL_CANONICA = APP_URL.replace('://www.', '://')

function supabaseEmail() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

/**
 * Busca o estado de descadastro de um e-mail.
 * Em caso de erro devolve `optOut: false` e sem URL: preferimos mandar sem o
 * rodape a segurar um e-mail por causa de uma consulta que falhou.
 */
async function estadoDescadastro(email: string): Promise<{ optOut: boolean; url: string | null }> {
  try {
    const { data } = await supabaseEmail()
      .from('users')
      .select('email_optout_nurture, unsubscribe_token')
      .ilike('email', email)
      .limit(1)
    const u = data?.[0]
    if (!u) return { optOut: false, url: null }
    return {
      optOut: !!u.email_optout_nurture,
      url: u.unsubscribe_token ? `${URL_CANONICA}/api/email/descadastrar?t=${u.unsubscribe_token}` : null,
    }
  } catch (e: any) {
    console.warn('[email] nao consegui checar descadastro de', email, '-', e?.message)
    return { optOut: false, url: null }
  }
}

/** Rodape com o link, so pros e-mails de relacionamento. */
function rodapeDescadastro(url: string): string {
  return `<br/><br/>
      <span style="font-size:11px;line-height:1.6;color:#4b5563;">
        Você recebe este e-mail porque tem conta na Bynx.
        <a href="${url}" rel="noopener noreferrer nofollow" target="_blank" style="color:#8a8a8a;text-decoration:underline;">Descadastrar</a>.
      </span>`
}

/**
 * Envia e-mail de RELACIONAMENTO: respeita o opt-out, poe o rodape e os dois
 * headers que o Gmail/Yahoo pedem. Quem ja saiu da lista NAO recebe — e o
 * retorno diz isso, em vez de fingir que enviou.
 */
async function enviarNurture(params: {
  from: string; to: string; subject: string
  /** Recebe o rodape pra encaixar ANTES do fechamento do card. */
  montarHtml: (rodape: string) => string
}) {
  const { optOut, url } = await estadoDescadastro(params.to)
  if (optOut) {
    console.log(`[email] ${params.to} optou por nao receber relacionamento — "${params.subject}" nao enviado`)
    return { data: null, error: null, puloPorOptOut: true } as any
  }
  const html = params.montarHtml(url ? rodapeDescadastro(url) : '')
  return enviar({
    from: params.from, to: params.to, subject: params.subject, html,
    headers: url
      ? {
          'List-Unsubscribe': `<${url}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined,
  })
}

async function enviar(params: {
  from: string; to: string | string[]; subject: string; html: string
  headers?: Record<string, string>
}) {
  const res = await resend.emails.send(params)
  if (res.error) {
    const para = Array.isArray(params.to) ? params.to.join(', ') : params.to
    console.error(
      `[email] FALHA no envio para ${para} — "${params.subject}": ` +
      `${res.error.name ?? 'erro'}: ${res.error.message ?? JSON.stringify(res.error)}`
    )
  }
  return res
}

// ── Layout base ───────────────────────────────────────────────────────────────

function baseLayout(content: string, preheader = '', rodapeExtra = '') {
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
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}

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
              ${rodapeExtra}
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

/* ────────────────────────────────────────────────────────────────────────────
 * BLOCOS ILUSTRATIVOS  (12/09/2026)
 *
 * ★ Pedido do Du: "quero emails bem ilustrativos, nao apenas texto, porque
 * quase ninguem para para ler". Entao o email tem que DIZER pelo desenho o que
 * o texto diria pelo paragrafo -- quem so bate o olho precisa entender.
 *
 * ★ TUDO EM TABELA E ESTILO INLINE. Nao existe flex nem grid confiavel em
 * email: o Outlook renderiza com o motor do Word e o Gmail arranca o <style>.
 * Cor sempre em `bgcolor` ALEM do CSS, pela mesma razao.
 *
 * ★ SEM IMAGEM EXTERNA nova. Metade dos clientes bloqueia imagem por padrao --
 * um desenho feito de imagem some justamente pra quem nao le. Tudo aqui e
 * desenhado com celula, borda e cor, entao aparece sempre. A unica imagem
 * usada e a que a propria loja ja subiu.
 * ────────────────────────────────────────────────────────────────────────── */

/** Lista de passos com estado: o que ja foi e o que falta, de bater o olho. */
function checklist(itens: Array<{ feito: boolean; texto: string }>): string {
  const linha = (it: { feito: boolean; texto: string }) => {
    const cor = it.feito ? '#22c55e' : '#f59e0b'
    const marca = it.feito ? '&#10003;' : '&#9675;'
    const texto = it.feito
      ? `<span style="color:rgba(255,255,255,0.35);text-decoration:line-through;">${it.texto}</span>`
      : `<span style="color:#f0f0f0;font-weight:700;">${it.texto}</span>`
    return `<tr>
      <td width="30" valign="top" style="padding:9px 0;font-size:15px;color:${cor};${FONT}">${marca}</td>
      <td style="padding:9px 0;font-size:14px;line-height:1.5;${FONT}">${texto}</td>
    </tr>`
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    bgcolor="#12151c" style="background-color:#12151c;border:1px solid #1f2937;border-radius:12px;margin:18px 0;">
    <tr><td style="padding:8px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itens.map(linha).join('')}</table>
    </td></tr></table>`
}

/**
 * Vagas de foto: quantas o plano da e quantas estao usadas.
 * Quadrado tracejado e vazio le como "falta alguma coisa aqui" sem legenda.
 */
function vagasDeFoto(usadas: number, total: number): string {
  const cel = (i: number) => {
    const cheia = i < usadas
    return `<td width="${Math.floor(100 / total)}%" style="padding:0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        bgcolor="${cheia ? '#1f2937' : '#0d0f14'}"
        style="background-color:${cheia ? '#1f2937' : '#0d0f14'};border:${cheia ? '1px solid #2b3543' : '1px dashed #3a4454'};border-radius:8px;">
        <tr><td align="center" height="52" style="height:52px;font-size:19px;color:${cheia ? '#60a5fa' : '#3a4454'};${FONT}">${cheia ? '&#9632;' : '+'}</td></tr>
      </table></td>`
  }
  const celulas = Array.from({ length: total }, (_, i) => cel(i)).join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px;">
      <tr>${celulas}</tr>
    </table>
    <p style="margin:0 0 4px;font-size:11.5px;color:rgba(255,255,255,0.4);text-align:center;${FONT}">
      ${usadas} de ${total} fotos usadas</p>`
}

/**
 * O card como o comprador ve HOJE, e como ficaria. E a ilustracao mais direta
 * que existe pro Connect desligado: o botao muda, e a diferenca e a venda.
 */
function comparativoBotao(nomeItem: string, preco: string): string {
  const card = (rotulo: string, corRot: string, botao: string, corBtn: string, corTexto: string, opaco: boolean) => `
    <td width="50%" valign="top" style="padding:0 5px;">
      <p style="margin:0 0 7px;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${corRot};${FONT}">${rotulo}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#12151c"
        style="background-color:#12151c;border:1px solid ${opaco ? '#1f2937' : '#2b3543'};border-radius:12px;">
        <tr><td style="padding:13px 13px 11px;">
          <p style="margin:0 0 2px;font-size:12.5px;font-weight:700;color:${opaco ? 'rgba(255,255,255,0.45)' : '#f0f0f0'};${FONT}">${escapeHtml(nomeItem)}</p>
          <p style="margin:0 0 11px;font-size:14px;font-weight:800;color:${opaco ? 'rgba(255,255,255,0.35)' : '#22c55e'};${FONT}">${escapeHtml(preco)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${corBtn}" style="background-color:${corBtn};border-radius:8px;">
            <tr><td align="center" height="34" style="height:34px;font-size:12px;font-weight:800;color:${corTexto};${FONT}">${botao}</td></tr>
          </table>
        </td></tr>
      </table>
    </td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;"><tr>
      ${card('Hoje', 'rgba(255,255,255,0.35)', 'Tenho interesse', '#2b3543', 'rgba(255,255,255,0.6)', true)}
      ${card('Com recebimentos', '#22c55e', 'Comprar agora', '#22c55e', '#0d0f14', false)}
    </tr></table>`
}

/** Prateleira vazia: tres vagas tracejadas. Diz "nao tem nada aqui" sozinho. */
function prateleiraVazia(): string {
  const vaga = `<td width="33%" style="padding:0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0d0f14"
        style="background-color:#0d0f14;border:1px dashed #3a4454;border-radius:10px;">
        <tr><td align="center" height="78" style="height:78px;font-size:22px;color:#3a4454;${FONT}">+</td></tr>
      </table></td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 6px;">
      <tr>${vaga}${vaga}${vaga}</tr></table>
    <p style="margin:0;font-size:11.5px;color:rgba(255,255,255,0.4);text-align:center;${FONT}">
      é isso que o cliente encontra na sua página hoje</p>`
}

/**
 * A pagina da loja vista de longe: cabecalho com logo (ou o quadrado cinza) e
 * duas linhas de descricao. Mostra o "sem cara" em vez de descrever.
 */
function mockCabecalhoLoja(nome: string, logoUrl: string | null, temDescricao: boolean): string {
  const inicial = escapeHtml((nome || '?').trim().charAt(0).toUpperCase())
  const avatar = logoUrl
    ? `<img src="${logoUrl}" width="46" height="46" alt="" style="width:46px;height:46px;border-radius:10px;display:block;border:0;object-fit:cover;"/>`
    : `<table role="presentation" width="46" cellpadding="0" cellspacing="0" border="0" bgcolor="#2b3543" style="background-color:#2b3543;border-radius:10px;">
         <tr><td align="center" height="46" style="height:46px;width:46px;font-size:19px;font-weight:800;color:#5b6676;${FONT}">${inicial}</td></tr>
       </table>`
  const linhaFalsa = (largura: string, forte: boolean) =>
    `<table role="presentation" width="${largura}" cellpadding="0" cellspacing="0" border="0" bgcolor="${forte ? '#2b3543' : '#1c222c'}" style="background-color:${forte ? '#2b3543' : '#1c222c'};border-radius:3px;margin-bottom:6px;">
       <tr><td height="7" style="height:7px;font-size:1px;line-height:7px;">&nbsp;</td></tr></table>`
  const corpo = temDescricao
    ? linhaFalsa('100%', false) + linhaFalsa('72%', false)
    : `<p style="margin:6px 0 0;font-size:11.5px;color:#5b6676;font-style:italic;${FONT}">sem descrição</p>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#12151c"
      style="background-color:#12151c;border:1px solid #1f2937;border-radius:12px;margin:18px 0 6px;">
      <tr><td style="padding:16px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" width="46">${avatar}</td>
          <td width="14">&nbsp;</td>
          <td valign="middle">
            <p style="margin:0 0 3px;font-size:14px;font-weight:800;color:#f0f0f0;${FONT}">${escapeHtml(nome)}</p>
            ${corpo}
          </td>
        </tr></table>
      </td></tr></table>
    <p style="margin:0;font-size:11.5px;color:rgba(255,255,255,0.4);text-align:center;${FONT}">
      a sua página, como ela aparece agora</p>`
}

/** Numero grande com barra proporcional. Pro resumo do mes. */
function barraNumero(rotulo: string, valor: number, maximo: number, cor = '#60a5fa'): string {
  const pct = maximo > 0 ? Math.max(4, Math.round((valor / maximo) * 100)) : 4
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td style="padding:0 0 5px;font-size:12px;color:rgba(255,255,255,0.55);${FONT}">${rotulo}</td>
        <td align="right" style="padding:0 0 5px;font-size:22px;font-weight:800;color:#f0f0f0;${FONT}">${valor}</td>
      </tr>
      <tr><td colspan="2" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1c222c" style="background-color:#1c222c;border-radius:4px;">
          <tr><td width="${pct}%" bgcolor="${cor}" style="background-color:${cor};border-radius:4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="6" style="height:6px;font-size:1px;line-height:6px;">&nbsp;</td></tr></table>
          </td><td>&nbsp;</td></tr>
        </table>
      </td></tr>
    </table>`
}

function badge(text: string, color: string, bg: string) {
  return `<p style="margin:0 0 8px;font-size:10px;font-weight:800;color:${color};letter-spacing:0.08em;text-transform:uppercase;${FONT}">${text}</p>`
}

// ── 1. Email de boas-vindas ────────────────────────────────────────────────────

// ── Master Set desbloqueado (compra a-la-carte) ──────────────────────────────

export async function sendMasterSetUnlockedEmail(to: string, name: string, setName: string, setId: string) {
  const firstName = primeiroNome(name, 'Colecionador')
  const printUrl = addUtm(`${APP_URL}/master-sets/${setId}`, 'master-set-unlocked', 'cta-button')
  const html = baseLayout(`
    ${badge('Master Set liberado', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1(`Seu Master Set chegou, ${escapeHtml(firstName)}! 🗂️`)}
    ${p(`O <strong style="color:#f59e0b;">${escapeHtml(setName)}</strong> foi desbloqueado na sua conta. Agora é só abrir as folhas de fichário, marcar o que você já tem e imprimir pra completar o set.`)}
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

  return enviar({ from: FROM, to, subject: subjUser(`🗂️ Master Set liberado: ${setName}`), html })
}

export async function sendWelcomeEmail(to: string, name: string) {
  const firstName = primeiroNome(name, 'Colecionador')
  const montarHtml = (rodape: string) => baseLayout(`
    ${h1(`Bem-vindo à Bynx, ${escapeHtml(firstName)}! 🎉`)}
    ${p('Sua conta foi criada com sucesso. Você ganhou <strong style="color:#f59e0b;">7 dias de Pro grátis</strong> para explorar tudo que a Bynx tem a oferecer.')}
    ${divider()}
    <table width="100%" cellpadding="0" cellspacing="0">
      ${['📚 Catalogue suas cartas — busca por nome ou número', '📷 Scan IA — adicione cartas direto pela foto', '📊 Dashboard em BRL — menor preço, médio e máx em tempo real', '📈 Histórico de preços — veja a evolução do mercado', '🛒 Marketplace brasileiro — compre e venda com segurança', '🎁 Indique e Ganhe — recompensas mensais indicando amigos'].map(f => `
        <tr><td style="padding:6px 0;">
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">${f}</p>
        </td></tr>`).join('')}
    </table>
    ${btn('Acessar minha conta', addUtm(`${APP_URL}/minha-colecao`, 'welcome', 'cta-button'))}
    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Tem alguma dúvida? Dá uma olhada no nosso <a href="${addUtm(`${APP_URL}/faq`, 'welcome', 'link-faq')}" style="color:#f59e0b;text-decoration:none;">FAQ</a> ou fala com a gente em <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Bem-vindo à Bynx, ${firstName}! Seus 7 dias de Pro grátis começaram.`, rodape)

  return enviarNurture({ from: FROM, to, subject: subjUser(`Bem-vindo, ${firstName}! 🎉`), montarHtml })
}

// ── 2. Trial expirando — 5º dia ───────────────────────────────────────────────

export async function sendTrialExpiring5Email(to: string, name: string) {
  const firstName = primeiroNome(name, 'Colecionador')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Pro Trial', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Seu trial Pro expira em 2 dias ⏰')}
    ${p(`${escapeHtml(firstName)}, você ainda tem 2 dias para curtir tudo do Pro: importação ilimitada, scan com IA, marketplace, separadores e muito mais.`)}
    ${p('Depois de 7 dias, sua conta volta para o plano Free, mas tudo que você adicionou continua salvo.')}
    ${btn('Ver planos →', addUtm(`${APP_URL}/minha-conta`, 'trial-2d', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Quer continuar no Pro? <a href="${addUtm(`${APP_URL}/minha-conta`, 'trial-2d', 'link-veja-planos')}" style="color:#f59e0b;text-decoration:none;">Veja os planos aqui</a>.</p>
  `, `Seu trial Pro expira em 2 dias`, rodape)

  return enviarNurture({ from: FROM, to, subject: subjUser(`⏰ Seu teste Pro expira em 2 dias`), montarHtml })
}

// ── 3. Trial expirando — último dia ──────────────────────────────────────────

export async function sendTrialExpiring1Email(to: string, name: string) {
  const firstName = primeiroNome(name, 'Colecionador')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Último dia', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Hoje é o último dia do seu Pro trial 🚨')}
    ${p(`${escapeHtml(firstName)}, amanhã sua conta volta automaticamente para o plano Free. Você não perde nada que já adicionou — só os recursos Pro ficam bloqueados.`)}
    ${p('Continue no Pro para manter acesso a cartas ilimitadas, scan com IA e marketplace.')}
    ${btn('Continuar no Pro →', addUtm(`${APP_URL}/minha-conta`, 'trial-1d', 'cta-button'))}
  `, `Hoje é o último dia do seu Pro trial`, rodape)

  return enviarNurture({ from: FROM, to, subject: subjUser(`🚨 Último dia de Pro grátis`), montarHtml })
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
    ${p(`<strong style="color:#f0f0f0;">${escapeHtml(args.userName || 'Colecionador')}</strong> (${escapeHtml(args.userEmail)}) abriu o ticket "<em style="color:#f59e0b;">${escapeHtml(args.subject)}</em>".`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:12px 16px;font-size:11px;color:#9ca3af;${FONT}text-transform:uppercase;letter-spacing:0.08em;">Categoria · Prioridade</td></tr>
      <tr><td style="padding:0 16px 12px;font-size:13px;color:rgba(255,255,255,0.8);${FONT}">${args.category} · <strong style="color:#f59e0b;">${args.priority}</strong></td></tr>
      <tr><td colspan="2" bgcolor="#2d3748" style="background-color:#2d3748;height:1px;font-size:1px;line-height:1px;padding:0;">&nbsp;</td></tr>
      <tr><td style="padding:12px 16px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Ver no painel admin →', addUtm(`${APP_URL}/admin/tickets/${args.ticketId}`, 'ticket-new-admin', 'cta-button'))}
  `, `Novo ticket: ${args.subject}`)

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Suporte', `Novo ticket: ${args.subject}`), html })
}

// ── 5. SUPORTE — confirmação de ticket criado (para usuário) ─────────────────

export async function sendTicketCreatedUserEmail(args: {
  to: string
  userName?: string
  ticketId: string
  subject: string
}) {
  const firstName = primeiroNome(args.userName, 'Colecionador')
  const html = baseLayout(`
    ${badge('Ticket recebido', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Recebemos sua mensagem ✅')}
    ${p(`${escapeHtml(firstName)}, seu ticket "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>" foi criado e nossa equipe vai responder em breve.`)}
    ${p('Costumamos responder em até 24 horas úteis.')}
    ${btn('Ver meu ticket →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-created-user', 'cta-button'))}
  `, `Recebemos seu ticket: ${args.subject}`)

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Suporte', `Ticket recebido: ${args.subject}`), html })
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
    ${p(`<strong style="color:#f0f0f0;">${escapeHtml(args.userName || 'Colecionador')}</strong> (${escapeHtml(args.userEmail)}) respondeu em "<em style="color:#f59e0b;">${escapeHtml(args.subject)}</em>":`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Responder no painel →', addUtm(`${APP_URL}/admin/tickets/${args.ticketId}`, 'ticket-user-reply', 'cta-button'))}
  `, `Nova resposta: ${args.subject}`)

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Suporte', `Resposta: ${args.subject}`), html })
}

// ── 7. SUPORTE — resposta do admin (para o usuário) ──────────────────────────

export async function sendAdminReplyUserEmail(args: {
  to: string
  userName?: string
  ticketId: string
  subject: string
  message: string
}) {
  const firstName = primeiroNome(args.userName, 'Colecionador')
  const html = baseLayout(`
    ${badge('Resposta da Equipe', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Você tem uma nova resposta')}
    ${p(`${escapeHtml(firstName)}, nossa equipe respondeu seu ticket "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>":`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Ver conversa completa →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-admin-reply', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Para responder, basta abrir a conversa no botão acima. Você também pode responder este email, mas o caminho mais rápido é pelo app. 📬</p>
  `, `Resposta para seu ticket: ${args.subject}`)

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Suporte', args.subject), html })
}

// ── 7-bis. SUPORTE — conversa ABERTA pela equipe (para o usuário) ────────────
//
// Diferente do sendAdminReplyUserEmail: la a equipe RESPONDE algo que o
// usuario abriu. Aqui a equipe COMECA a conversa — caso tipico e pedir
// documento ou informacao pra validar uma loja. O texto precisa dizer por que
// a Bynx esta falando com a pessoa do nada, senao parece phishing.
//
// Usa subjInterno como o resto do fluxo de ticket, de proposito: assunto
// diferente parte a thread na caixa de quem responde.

export async function sendAdminNovaConversaEmail(args: {
  to: string
  userName?: string
  ticketId: string
  subject: string
  message: string
}) {
  const firstName = primeiroNome(args.userName, 'Colecionador')
  const html = baseLayout(`
    ${badge('Mensagem da Equipe', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1('A equipe da Bynx te enviou uma mensagem')}
    ${p(`${escapeHtml(firstName)}, abrimos uma conversa com você sobre "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>":`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid #2d3748;margin-top:16px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.message)}</td></tr>
    </table>
    ${btn('Responder →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-admin-nova', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Você está recebendo isso porque tem conta na Bynx e nossa equipe precisou falar com você. Responda pelo botão acima — a conversa fica registrada na sua conta. 📬</p>
  `, `A equipe da Bynx te enviou uma mensagem sobre ${args.subject}`)

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Suporte', args.subject), html })
}

// ── 7-ter. LOJAS — pedido de documentos pro Selo de Loja Validada ───────────
//
// Disparado quando o admin APROVA a loja. Aprovar poe a loja no ar; o SELO e
// outra coisa, e depende de conferir documento.
//
// ★ O texto original dizia "e so responder este e-mail com os arquivos". Nao
// da: o remetente e noreply@bynx.gg e a resposta — com o documento junto — se
// perde. Por isso a conversa vive num TICKET e o botao leva pra la, onde ha
// upload de arquivo em bucket privado.
//
// Assinado pelo Du em primeira pessoa de proposito: e um pedido de RG e CNPJ,
// e pedido de documento assinado por "a equipe" cheira a golpe.

export async function sendEmailLojaVerificacao(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  ticketId: string
}) {
  const primeiro = primeiroNome(args.nomeUser, 'tudo bem')
  const item = (t: string) => `<tr>
      <td valign="top" style="padding:0 10px 10px 0;font-size:14px;color:${B2B_LINK_COLOR};${FONT}">•</td>
      <td valign="top" style="padding:0 0 10px;font-size:14px;color:rgba(255,255,255,0.72);line-height:1.6;${FONT}">${t}</td>
    </tr>`

  const html = baseLayout(`
    ${badge('Verificação de loja', B2B_LINK_COLOR, 'rgba(96,165,250,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Falta pouco para o seu selo')}
    ${p(`Olá, ${escapeHtml(primeiro)}, tudo bem?`)}
    ${p('Aqui é o Eduardo, fundador da Bynx.')}
    ${p(`Que bom ter a <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> na plataforma. Para concluir a verificação e liberar o <strong style="color:#f0f0f0;">Selo de Loja Validada</strong> no seu perfil — o selo é o que sinaliza aos colecionadores que a sua loja é uma empresa real e confiável — preciso confirmar alguns itens:`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 4px;">
      ${item('Cartão CNPJ da loja, com situação cadastral ativa (ou CCMEI, no caso de MEI)')}
      ${item('Documento do responsável pela conta (RG ou CNH)')}
      ${item('Um canal ativo de vendas (site, Instagram ou perfil em marketplace)')}
      ${item('Uma ou duas fotos da loja física ou do estoque')}
    </table>

    ${p('Clique no botão abaixo e envie os arquivos por lá — é uma conversa privada entre você e eu, dentro da sua conta. Uso essas informações apenas para a validação e não compartilho com terceiros. Assim que eu conferir, o selo é ativado no mesmo dia e os arquivos são apagados.')}

    ${btnB2B('Enviar os documentos', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'loja-verificacao', 'cta-button'))}

    ${divider()}
    <p style="margin:0 0 12px;font-size:12.5px;color:rgba(255,255,255,0.45);line-height:1.65;${FONT}">
      <em>Um detalhe importante: dados bancários e fiscais para receber pagamentos não entram aqui. Isso é feito de forma segura no momento em que você ativar o recebimento pela plataforma.</em>
    </p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.55);line-height:1.7;${FONT}">
      Qualquer dúvida, é só me responder por lá que eu te ajudo.<br/><br/>
      Abraço,<br/>
      <strong style="color:#f0f0f0;">Eduardo</strong><br/>
      Fundador da Bynx<br/>
      <a href="${APP_URL}" style="color:${B2B_LINK_COLOR};text-decoration:none;">bynx.gg</a>
    </p>
  `, `${escapeHtml(args.nomeLoja)}: falta pouco para o Selo de Loja Validada`)

  return enviar({ from: FROM, to: args.to, subject: subjUser(`Verificação da ${args.nomeLoja}`), html })
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
  const firstName = primeiroNome(args.userName, 'Colecionador')
  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">${info.emoji}</div>
    </div>
    ${h1(`Ticket ${info.label.toLowerCase()}`)}
    ${p(`${escapeHtml(firstName)}, o status do seu ticket "<strong style="color:#f59e0b;">${escapeHtml(args.subject)}</strong>" foi atualizado para <strong style="color:${info.color};">${info.label}</strong>.`)}
    ${args.status === 'resolved' ? p('Se ainda tiver dúvidas ou o problema voltar, é só responder o ticket — ele reabre automaticamente.') : ''}
    ${btn('Ver ticket →', addUtm(`${APP_URL}/suporte/${args.ticketId}`, 'ticket-status-changed', 'cta-button'))}
  `, `Seu ticket agora está ${info.label.toLowerCase()}`)

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Suporte', `${info.label}: ${args.subject}`), html })
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAILS B2B — LOJAS
// Usam paleta azul-roxo: gradient `#60a5fa → #a855f7` (Pro) ou `#a855f7 → #ec4899` (Premium).
// Links de contato em azul `#60a5fa` em vez de laranja.
// ─────────────────────────────────────────────────────────────────────────────

// ── 9. LOJAS — loja aprovada (para o owner) ──────────────────────────────────

/**
 * ★ PASSO 1 DA REGUA DO LOJISTA (12/09/2026). Este email ja existia e ja era
 * bom -- o que faltava era dizer O QUE FAZER. A versao anterior fechava com
 * "aproveita pra colocar fotos e deixar tudo bonito", que e um convite vago
 * para uma tela que a pessoa nunca viu.
 *
 * Medido nas 10 lojas ativas: 9 sem nenhuma foto, 7 com a vitrine vazia, 7 que
 * nunca abriram os recebimentos. Ou seja, a loja media LE este email e nao faz
 * nenhuma das tres coisas. Agora sao tres passos numerados, na ordem em que
 * importam, e o trial vem com DATA em vez de "14 dias" -- a data e o unico
 * jeito de a pessoa saber quando, sem ter que contar.
 *
 * Nao virou um segundo email de boas-vindas de proposito: dois emails no mesmo
 * minuto e a regua fazendo spam de si mesma logo no primeiro passo.
 */
export async function sendEmailLojaAprovada(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  slug: string
  /** ISO de `lojas.plano_expira_em`. Sem ela o texto cai em "14 dias". */
  trialAte?: string | null
}) {
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const fimTrial = args.trialAte ? new Date(args.trialAte) : null
  const quandoTrial = fimTrial && Number.isFinite(fimTrial.getTime())
    ? fimTrial.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })
    : null
  const urlPublica = `${APP_URL}/lojas/${args.slug}`
  const urlEdicao  = `${APP_URL}/minha-loja`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">🎉</div>
    </div>
    ${h1('Sua loja foi aprovada!')}
    ${p(`${escapeHtml(firstName)}, boa notícia: <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi aprovada pela equipe da Bynx e já está no ar no Guia de Lojas.`)}
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
    ${p('<strong style="color:#60a5fa;">Faltam três coisas para ela vender:</strong>')}
    ${checklist([
      { feito: false, texto: 'Subir o logo e escrever a descrição' },
      { feito: false, texto: 'Colocar pelo menos um item à venda' },
      { feito: false, texto: 'Ativar os recebimentos, senão não há botão de comprar' },
    ])}
    ${divider()}
    ${p(`<strong style="color:#60a5fa;">⭐ O seu Pro começou agora</strong> e vai até <strong style="color:#f0f0f0;">${quandoTrial || 'daqui a 14 dias'}</strong>. Ele libera 5 fotos da loja, redes sociais e descrição sem limite.`)}
    ${p('Depois dessa data, você escolhe entre continuar no <strong style="color:#f0f0f0;">Pro (R$ 39/mês)</strong> ou seguir no <strong style="color:#f0f0f0;">Básico (grátis)</strong>. A loja continua no ar nos dois casos.')}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Qualquer dúvida, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:${B2B_LINK_COLOR};text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Sua loja ${args.nomeLoja} foi aprovada e já está no ar!`)

  return enviar({ from: FROM, to: args.to, subject: subjUser(`🎉 Sua loja foi aprovada!`), html })
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
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')

  const html = baseLayout(`
    ${badge('Loja suspensa', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Sua loja foi suspensa')}
    ${p(`${escapeHtml(firstName)}, precisamos te avisar que <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi suspensa temporariamente no Guia da Bynx.`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1c24" style="background-color:#1a1c24;border-radius:8px;border:1px solid rgba(239,68,68,0.3);margin-top:16px;">
      <tr><td style="padding:14px 18px 6px;font-size:11px;color:#ef4444;${FONT}text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Motivo</td></tr>
      <tr><td style="padding:0 18px 16px;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.6;${FONT}white-space:pre-wrap;">${escapeHtml(args.motivo)}</td></tr>
    </table>
    ${divider()}
    ${p('Enquanto suspensa, sua loja <strong style="color:#ef4444;">não aparece</strong> no guia público. Para contestar ou pedir a reativação, é só responder este email explicando o que mudou.')}
    ${p('Nossa equipe analisa todos os pedidos e responde em até 48 horas úteis.')}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">📬 <a href="mailto:suporte@bynx.gg" style="color:${B2B_LINK_COLOR};text-decoration:none;">suporte@bynx.gg</a></p>
  `, `Sua loja ${args.nomeLoja} foi suspensa na Bynx`)

  return enviar({ from: FROM, to: args.to, subject: subjUser(`Sua loja foi suspensa`), html })
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
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
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
    ? `${escapeHtml(firstName)}, ótima notícia: <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> agora está no plano <strong style="color:${cfgNovo.color};">${cfgNovo.label}</strong>! 🎉`
    : `${escapeHtml(firstName)}, queremos te avisar que o plano da sua loja <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi alterado de <strong style="color:${cfgAnterior.color};">${cfgAnterior.label}</strong> para <strong style="color:${cfgNovo.color};">${cfgNovo.label}</strong>.`

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

  // subjUser poe o sufixo "— Bynx.gg". Por isso o "na Bynx" sai do meio: a
  // convencao no topo do arquivo pede exatamente isso ("Bem-vindo a Bynx —
  // Bynx.gg" fica bobo).
  const subject = subjUser(isUpgrade
    ? `${cfgNovo.emoji} Sua loja agora é ${cfgNovo.label}`
    : `Plano da sua loja foi atualizado para ${cfgNovo.label}`)

  return enviar({ from: FROM, to: args.to, subject, html })
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

/**
 * Email dedicado das Paginas Lendarias — mostra A PAGINA COMPRADA (arte em
 * destaque via URL publica), o tema da cena e o passo a passo de uso.
 * paginaId '*' = Colecao Lendaria (pacote completo).
 */
export async function sendPaginaLendariaEmail(
  to: string,
  name: string,
  paginaId: string
) {
  const { getPaginaLendaria, PAGINAS_LENDARIAS } = await import('./paginas-lendarias')
  const firstName = primeiroNome(name, 'Colecionador')
  const pacote = paginaId === '*'
  const pagina = pacote ? null : getPaginaLendaria(paginaId)

  const arteUrl = (id: string) => `${APP_URL}/paginas-lendarias/${id}-lp.webp`

  const heroImg = pacote
    ? `
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${['moonbreon', 'eeveelutions', 'mega-charizard-x'].map(id => `
          <td align="center" style="padding:0 4px;">
            <img src="${arteUrl(id)}" width="140" alt="Página Lendária" style="width:140px;border-radius:10px;border:1px solid rgba(245,158,11,0.35);display:block;" />
          </td>`).join('')}
      </tr></table>
      <p style="margin:10px 0 0;font-size:12px;color:rgba(255,255,255,0.4);text-align:center;">...e mais ${PAGINAS_LENDARIAS.length - 3} páginas te esperando no fichário 🔥</p>`
    : `
      <img src="${arteUrl(paginaId)}" width="280" alt="Página Lendária ${escapeHtml(pagina?.nome || paginaId)}" style="width:280px;max-width:100%;border-radius:14px;border:1px solid rgba(245,158,11,0.4);display:block;margin:0 auto;" />
      <p style="margin:12px 0 0;font-size:15px;font-weight:700;color:#ffffff;text-align:center;">${escapeHtml(pagina?.nome || paginaId)}</p>
      ${pagina?.sub ? `<p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.45);text-align:center;">${escapeHtml(pagina.sub)}</p>` : ''}
`

  const titulo = pacote ? 'A Coleção Lendária é sua! 🌙' : `${escapeHtml(pagina?.nome || 'Sua página')} é sua! 🌙`
  const intro = pacote
    ? `${escapeHtml(firstName)}, todas as <strong style="color:#f59e0b;">${PAGINAS_LENDARIAS.length} Páginas Lendárias</strong> estão liberadas no seu fichário — incluindo as novas de cada trimestre, sem pagar mais nada.`
    : `${escapeHtml(firstName)}, sua página <strong style="color:#f59e0b;">${escapeHtml(pagina?.nome || paginaId)}</strong> está liberada no seu fichário. A arte da carta agora continua pela página inteira — olha ela aí embaixo. 👇`

  const passos = `
    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:rgba(255,255,255,0.85);">Seus próximos 3 minutos:</p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">📖 <strong style="color:rgba(255,255,255,0.8);">Folheie</strong> — abra o fichário e veja sua carta no cenário completo</p>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">🖨️ <strong style="color:rgba(255,255,255,0.8);">Imprima</strong> — botão "Imprimir A4": escala 100%, sem margens, papel couché fosco 180-230g. Recorte nas linhas e monte no fichário físico (bolso 63x88mm)</p>
    <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;">📱 <strong style="color:rgba(255,255,255,0.8);">Compartilhe</strong> — botão "Compartilhar" gera a imagem da página pronta pro Instagram</p>`

  const upsell = pacote ? '' : `
    ${divider()}
    <p style="margin:0;font-size:12.5px;color:rgba(255,255,255,0.5);line-height:1.6;text-align:center;">Gostou? A <strong style="color:#f59e0b;">Coleção Lendária</strong> libera as ${PAGINAS_LENDARIAS.length} páginas de uma vez por R$ 79,90 — avulsas custariam R$ ${(PAGINAS_LENDARIAS.length * 12.9).toFixed(2).replace('.', ',')}.</p>`

  const html = baseLayout(`
    ${badge(pacote ? 'Coleção Lendária' : 'Página Lendária', '#f59e0b', 'rgba(245,158,11,0.15)')}
    <div style="height:16px;"></div>
    ${h1(titulo)}
    ${p(intro)}
    <div style="height:18px;"></div>
    ${heroImg}
    <div style="height:6px;"></div>
    ${divider()}
    ${passos}
    ${btn('Abrir meu fichário', addUtm(`${APP_URL}/paginas-lendarias`, 'pagina-lendaria-unlocked', 'cta-button'))}
    ${upsell}
    ${divider()}
    <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">Compra única, vitalícia, com impressão ilimitada. Qualquer dúvida, é só responder este email. 📬 <a href="mailto:suporte@bynx.gg" style="color:#f59e0b;text-decoration:none;">suporte@bynx.gg</a></p>
  `, pacote ? 'Todas as Páginas Lendárias estão liberadas no seu fichário.' : `${pagina?.nome || 'Sua Página Lendária'} está liberada no seu fichário.`)

  return enviar({
    from: FROM,
    to,
    subject: subjUser(pacote ? '🌙 A Coleção Lendária é sua — todas as páginas liberadas!' : `🌙 ${pagina?.nome || 'Sua Página Lendária'} é sua — vem ver no fichário!`),
    html,
  })
}

export async function sendPurchaseConfirmationEmail(
  to: string,
  name: string,
  tipo: string
) {
  const firstName = primeiroNome(name, 'Colecionador')

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
    intro = `${escapeHtml(firstName)}, sua assinatura <strong style="color:#f59e0b;">Pro ${plano === 'anual' ? 'Anual' : 'Mensal'}</strong> foi ativada com sucesso. Obrigado por apoiar a Bynx!`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">📦 Cartas ilimitadas na sua coleção</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📷 Scan de cartas com IA · ilimitado</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🛒 Marketplace completo (compra e venda)</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🗂️ Separadores de fichário em PDF</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📊 Estatísticas e ranking exclusivos</p>
    `
    ctaLabel = 'Acessar minha conta'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = `Sua assinatura Pro ${plano === 'anual' ? 'Anual' : 'Mensal'} foi ativada.`
    subject = subjUser(`⭐ Bem-vindo ao Pro ${plano === 'anual' ? 'Anual' : 'Mensal'}!`)

  } else if (tipo === 'separadores') {
    badgeLabel = 'Separadores Desbloqueados'
    badgeColor = '#22c55e'
    badgeBg = 'rgba(34,197,94,0.15)'
    titulo = 'Separadores liberados! 🗂️'
    intro = `${escapeHtml(firstName)}, sua compra dos <strong style="color:#22c55e;">Separadores de Fichário</strong> foi confirmada e o recurso já está liberado na sua conta.`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">🎨 Layouts profissionais prontos pra imprimir</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📄 Geração em PDF de alta qualidade</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">♾️ Quantos separadores quiser, pra sempre</p>
    `
    ctaLabel = 'Acessar separadores'
    ctaHref = `${APP_URL}/separadores`
    preheader = 'Seus separadores de fichário já estão liberados.'
    subject = subjUser('🗂️ Seus separadores foram liberados!')

  } else if (tipo.startsWith('scan_')) {
    badgeLabel = 'Créditos Adicionados'
    badgeColor = '#60a5fa'
    badgeBg = 'rgba(96,165,250,0.15)'
    titulo = 'Créditos de scan adicionados! 📷'
    intro = `${escapeHtml(firstName)}, sua compra de créditos de scan foi confirmada e os créditos já estão disponíveis na sua conta.`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">📷 Cada scan reconhece uma carta automaticamente via IA</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">⚡ Use pela câmera ou enviando uma foto</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">♾️ Os créditos não expiram</p>
    `
    ctaLabel = 'Começar a escanear'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = 'Seus créditos de scan já estão disponíveis.'
    subject = subjUser('📷 Seus créditos de scan estão disponíveis!')

  } else if (tipo === 'plus') {
    badgeLabel = 'Plus Ativado'
    badgeColor = '#f59e0b'
    badgeBg = 'rgba(245,158,11,0.15)'
    titulo = 'Bem-vindo à Bynx Plus! ✨'
    intro = `${escapeHtml(firstName)}, sua assinatura <strong style="color:#f59e0b;">Plus</strong> foi ativada com sucesso. Obrigado por apoiar a Bynx!`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">📦 Até 500 cartas na sua coleção</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📊 Dashboard completo</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🛒 Marketplace ilimitado</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">🔍 Pokédex completa + pastas ilimitadas</p>
    `
    ctaLabel = 'Acessar minha conta'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = 'Sua assinatura Plus foi ativada.'
    subject = subjUser('✨ Bem-vindo ao Plus!')

  } else if (tipo === 'pagina_lendaria' || tipo === 'colecao_lendaria') {
    const pacote = tipo === 'colecao_lendaria'
    badgeLabel = pacote ? 'Coleção Lendária' : 'Página Lendária'
    badgeColor = '#f59e0b'
    badgeBg = 'rgba(245,158,11,0.15)'
    titulo = pacote ? 'Coleção Lendária desbloqueada! 🌙' : 'Página Lendária desbloqueada! 🌙'
    intro = pacote
      ? `${escapeHtml(firstName)}, sua compra da <strong style="color:#f59e0b;">Coleção Lendária</strong> foi confirmada. Todas as páginas com arte contínua — incluindo as novas de cada trimestre — já estão liberadas no seu fichário.`
      : `${escapeHtml(firstName)}, sua <strong style="color:#f59e0b;">Página Lendária</strong> foi confirmada e já está liberada no seu fichário.`
    detalhes = `
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);">🎨 A arte da carta se estende pela página inteira do fichário</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">📱 Compartilhe a página direto no seu Instagram</p>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.6);">♾️ Acesso vitalício, com a sua coleção já marcada</p>
    `
    ctaLabel = 'Abrir meu fichário'
    ctaHref = `${APP_URL}/paginas-lendarias`
    preheader = pacote ? 'Sua Coleção Lendária já está liberada.' : 'Sua Página Lendária já está liberada.'
    subject = subjUser(pacote ? '🌙 Sua Coleção Lendária está liberada!' : '🌙 Sua Página Lendária está liberada!')

  } else {
    // Fallback genérico — não deveria acontecer em produção, mas é seguro
    badgeLabel = 'Compra Confirmada'
    badgeColor = '#22c55e'
    badgeBg = 'rgba(34,197,94,0.15)'
    titulo = 'Compra confirmada! ✅'
    intro = `${escapeHtml(firstName)}, sua compra foi confirmada com sucesso.`
    detalhes = ''
    ctaLabel = 'Acessar minha conta'
    ctaHref = `${APP_URL}/minha-colecao`
    preheader = 'Sua compra foi confirmada.'
    subject = subjUser('✅ Sua compra foi confirmada')
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

  return enviar({ from: FROM, to, subject, html })
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
  const firstName = primeiroNome(args.name, 'Colecionador')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Indicação Ativada', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1(`Você ganhou ${args.pointsAwarded} pontos! 🎉`)}
    ${p(`${escapeHtml(firstName)}, alguém que você indicou completou o cadastro, confirmou o email e começou a usar a Bynx de verdade. Você ganhou <strong style="color:#22c55e;">+${args.pointsAwarded} pontos</strong>!`)}

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
  `, `Você ganhou ${args.pointsAwarded} pontos por indicar alguém!`, rodape)

  return enviarNurture({
    from: FROM,
    to: args.to,
    subject: subjUser(`🎉 +${args.pointsAwarded} pts! Sua indicação ativou`),
    montarHtml,
  })
}

// ── 15. INDIQUE E GANHE — referral engajada (virou Pro) ──────────────────────

export async function sendReferralEngagedEmail(args: {
  to: string
  name: string
  newBalance: number
}) {
  const firstName = primeiroNome(args.name, 'Colecionador')
  const POINTS = 200

  const montarHtml = (rodape: string) => baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">🚀</div>
    </div>
    ${h1('Sua indicação virou Pro!')}
    ${p(`${escapeHtml(firstName)}, BOA notícia em dose dupla: alguém que você indicou assinou a Bynx Pro. Você ganhou <strong style="color:#f59e0b;">+${POINTS} pontos</strong> de bônus!`)}

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
  `, `+${POINTS} pts! Sua indicação virou Pro na Bynx`, rodape)

  return enviarNurture({
    from: FROM,
    to: args.to,
    subject: subjUser(`🚀 +${POINTS} pts! Sua indicação virou Pro`),
    montarHtml,
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
  const firstName = primeiroNome(args.name, 'Colecionador')
  const html = baseLayout(`
    ${badge('Resgate Confirmado', '#22c55e', 'rgba(34,197,94,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Recompensa resgatada com sucesso! ✅')}
    ${p(`${escapeHtml(firstName)}, seu resgate de <strong style="color:#f0f0f0;">${escapeHtml(args.rewardTitle)}</strong> foi confirmado.`)}

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

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`✅ Resgate confirmado: ${args.rewardTitle}`),
    html,
  })
}

// ── PAGAMENTO — renovacao falhou (dunning, para usuario) ─────────────────────

export async function sendPaymentFailedEmail(to: string, name: string) {
  const firstName = primeiroNome(name, 'Colecionador')
  const html = baseLayout(`
    ${badge('Ação necessária', '#ef4444', 'rgba(239,68,68,0.15)')}
    <div style="height:16px;"></div>
    ${h1('Não conseguimos renovar seu Pro 💳')}
    ${p(`${escapeHtml(firstName)}, a cobrança da sua assinatura Bynx Pro foi recusada — geralmente é cartão expirado, sem saldo ou bloqueio do banco.`)}
    ${p('Fique tranquilo: seu acesso Pro continua ativo enquanto tentamos cobrar de novo nos próximos dias. Para não perder o acesso, atualize sua forma de pagamento.')}
    ${btn('Atualizar pagamento →', addUtm(`${APP_URL}/minha-conta`, 'payment-failed', 'cta-button'))}
    ${divider()}
    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Já atualizou? Pode ignorar este email — a próxima tentativa de cobrança resolve sozinha.</p>
  `, `Atualize seu pagamento para manter o Pro ativo`)

  return enviar({ from: FROM, to, subject: subjUser(`💳 Não conseguimos renovar seu Pro`), html })
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

  return enviar({ from: FROM, to: args.to, subject: subjInterno('Alerta', `Chargeback aberto (${valor})`), html })
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
  const first = primeiroNome(args.sellerName, 'colecionador')
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
  return enviar({ from: FROM, to: args.to, subject: subjUser(`🤝 Nova negociação: ${args.cardName}`), html })
}

export async function sendCartaEnviadaEmail(args: {
  to: string; buyerName: string; sellerName: string; cardName: string; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_carta_enviada')
  const first = primeiroNome(args.buyerName, 'colecionador')
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
  return enviar({ from: FROM, to: args.to, subject: subjUser(`📦 Carta enviada: ${args.cardName}`), html })
}

export async function sendNegociacaoConcluidaEmail(args: {
  to: string; sellerName: string; buyerName: string; cardName: string; price: number | null; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_concluida')
  const first = primeiroNome(args.sellerName, 'colecionador')
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
  return enviar({ from: FROM, to: args.to, subject: subjUser(`✅ Venda concluída: ${args.cardName}`), html })
}

/**
 * Aviso: faltam ~24h pra negociacao expirar.
 *
 * Segue o padrao dos outros quatro do marketplace -- badge ambar (o azul e o
 * acento da LOJA, nao do app), emoji no h1 e no assunto (email e a excecao
 * unica da regra de zero emoji), `addUtm` em vez de query montada a mao.
 */
/**
 * Trial Pro da loja termina em poucos dias.
 *
 * ★ Este e o email que o #170 pedia e que nunca existiu. O webhook nao trata
 * `trial_will_end` -- e nem precisaria: o trial da Bynx nao vive na Stripe, e
 * a coluna `lojas.plano_expira_em`. Quem dispara e o cron-loja-trial.
 *
 * Padrao dos emails de loja: badge ambar, emoji no h1 e no assunto, addUtm.
 */
export async function sendTrialLojaExpirandoEmail(args: {
  to: string; nome: string; loja: string; lojaId: string; dias: number
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/plano`, 'loja_trial_expirando', 'cta-button')
  const quando = args.dias === 1 ? 'amanha' : `em ${args.dias} dias`
  const html = baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('Seu Pro termina em breve ⏳')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`O período Pro da <b style="color:#f0f0f0;">${loja}</b> termina <b style="color:#f0f0f0;">${quando}</b>. Depois disso ela continua no ar, no plano Básico — mas a galeria de fotos e o selo Pro saem da sua página pública.`)}
    ${p('Se quiser manter tudo como está, é só assinar. Você não perde nada do que já cadastrou.')}
    ${btn('Ver os planos →', url)}
  `, `O Pro da ${args.loja} termina ${quando}`)
  return enviar({ from: FROM, to: args.to, subject: subjUser(`⏳ O Pro da ${args.loja} termina ${quando}`), html })
}

/**
 * O trial acabou e a loja caiu pro Basico. Mandado DEPOIS do rebaixamento, e
 * diz exatamente o que mudou na pagina -- some galeria e selo. Nao adianta
 * dizer "seu plano mudou" e deixar a pessoa descobrir na tela.
 */
export async function sendTrialLojaExpirouEmail(args: {
  to: string; nome: string; loja: string; lojaId: string
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/plano`, 'loja_trial_expirou', 'cta-button')
  const html = baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('Sua loja está no plano Básico 🔓')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`O período Pro da <b style="color:#f0f0f0;">${loja}</b> terminou. Ela <b style="color:#f0f0f0;">continua no ar</b> e vendendo — nada do que você cadastrou foi apagado.`)}
    ${p('O que saiu da sua página pública: a galeria de fotos e o selo Pro. Assinando, tudo volta na hora, com as mesmas fotos.')}
    ${btn('Voltar para o Pro →', url)}
  `, `O Pro da ${args.loja} terminou — a loja segue no ar, no Básico`)
  return enviar({ from: FROM, to: args.to, subject: subjUser(`Sua loja agora está no plano Básico`), html })
}

/**
 * A loja tem coisa no ar e NAO consegue receber: o Connect nunca foi aberto.
 *
 * ★ Por que existe (12/09/2026, #279). Medido: 9 das 12 lojas em
 * `stripe_connect_status = 'nao_iniciado'`, e duas ATIVAS com anuncio no ar --
 * ghostcg com 15, sc-cartas-tcg com 1. Os anuncios aparecem normalmente no
 * marketplace, mas sem botao de comprar: a venda escorre pro contato e a Bynx
 * nao ve nada disso. A faixa no painel (AvisoRecebimentos) resolve pra quem
 * entra; este email e pra quem nao entra ha meses.
 *
 * ★ O texto responde o que trava, nao o que a Bynx quer. Quanto custa (nada),
 * o que precisa ter na mao, pra onde vai o dinheiro e quem ve os dados -- as
 * mesmas quatro coisas da faixa, pra pessoa nao ler uma promessa no email e
 * outra na tela.
 */
export async function sendRecebimentosParadosEmail(args: {
  /** Quantos itens, ja escrito ("15 anuncios", "1 produto", "8 itens"). */
  quantos: string
  /** O total em numero. Sem ele o texto sai "1 anuncio... Eles aparecem". */
  total: number
  /** Um item real da loja, pro comparativo de botao nao ser gerico. */
  exemplo?: string | null
  exemploPreco?: string | null
  /** Qual aviso e este (1 = primeiro). A regua repete a cada 30 dias. */
  vez?: number
  to: string; nome: string; loja: string; lojaId: string
}) {
  const um = args.total === 1
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const quantos = escapeHtml(args.quantos)

  // ★ Do segundo aviso em diante o texto MUDA (decisao do Du, 12/09). O mesmo
  // email todo mes ensina a pessoa a ignorar -- e o caminho mais curto pro
  // descadastro. O lembrete nao repete o comparativo de botao, que ela ja viu:
  // mostra o que a loja JA tem pronto e que falta um item so.
  if ((args.vez ?? 1) >= 2) {
    const urlLembrete = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/pagamentos`, 'loja_connect_lembrete', 'cta-button')
    const montarLembrete = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('Falta um passo para a sua loja vender 🔌')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`Voltamos a escrever porque a <b style="color:#f0f0f0;">${loja}</b> continua do mesmo jeito: <b style="color:#f0f0f0;">${quantos}</b> à venda e nenhuma forma de o cliente comprar pela Bynx.`)}
    ${checklist([
      { feito: true, texto: `${quantos} ${um ? 'publicado' : 'publicados'}` },
      { feito: true, texto: 'Página no Guia de Lojas' },
      { feito: false, texto: 'Recebimentos ativados' },
    ])}
    ${p('É o único item que falta. São uns 3 minutos: CNPJ ou CPF e a conta bancária, preenchidos direto na Stripe. Não custa nada, e a Bynx nunca vê esses dados.')}
    ${btn('Ativar recebimentos →', urlLembrete)}${rodape}
  `, `${args.loja}: falta só ativar os recebimentos`)
    return enviarNurture({
      from: FROM, to: args.to,
      subject: subjUser(`A ${args.loja} continua sem botão de comprar`),
      montarHtml: montarLembrete,
    })
  }

  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/pagamentos`, 'loja_connect_parado', 'cta-button')
  // ★ enviarNurture e NAO enviar (corrigido 12/09, depois de eu ja ter
  // disparado 2 assim). Este email nao e transacional: ninguem pediu por ele,
  // ele existe porque a Bynx quer que a loja ative o Connect. Isso e
  // relacionamento, e relacionamento respeita o opt-out, leva o rodape de
  // descadastro e os dois cabecalhos do RFC 8058. Sem isso o Gmail passa a ver
  // um remetente que insiste sem saida -- o oposto do que a infra de
  // descadastro desta casa foi construida pra garantir.
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('Ninguém consegue comprar de você 🔌')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`A <b style="color:#f0f0f0;">${loja}</b> tem <b style="color:#f0f0f0;">${quantos}</b> à venda na Bynx. ${um ? 'Ele aparece' : 'Eles aparecem'} normalmente para quem visita — mas é este o botão que o cliente encontra:`)}
    ${comparativoBotao(args.exemplo || 'Carta à venda', args.exemploPreco || 'R$ 00,00')}
    ${p('Ativar não custa nada: você preenche CNPJ ou CPF e a conta bancária direto na Stripe, em uns 3 minutos. O dinheiro de cada venda cai nessa conta, e a Bynx nunca vê esses dados.')}
    ${btn('Ativar recebimentos →', url)}${rodape}
  `, `${args.loja}: ${args.quantos} à venda sem botão de comprar`)
  return enviarNurture({
    from: FROM, to: args.to,
    subject: subjUser(`🔌 ${args.quantos} da ${args.loja} sem botão de comprar`),
    montarHtml,
  })
}

/**
 * ── REGUA DO LOJISTA, passos 2 a 4 e 7, 9 e 10 ──────────────────────────────
 *
 * Todos NURTURE: ninguem pediu por eles, existem porque a Bynx quer que a loja
 * ande. Relacionamento respeita `email_optout_nurture`, leva o rodape de
 * descadastro e os cabecalhos do RFC 8058 -- por isso `enviarNurture` e nunca
 * `enviar`. Errei exatamente isso no primeiro email da regua e dois sairam sem
 * saida; nao repetir.
 *
 * Todos tem GATILHO DE ESTADO, nao de calendario: quem dispara (o
 * cron-regua-lojista) reconfere o buraco no momento do envio. Se a pessoa
 * tapou o buraco ontem, o email nao sai.
 */

/** PASSO 2 · a loja nao tem cara: sem logo, sem descricao ou sem rede. */
export async function sendLojaSemCaraEmail(args: {
  to: string; nome: string; loja: string; lojaId: string; falta: string[]
  /** Pro mock: se tiver logo, ele aparece; se nao, o quadrado cinza real. */
  logoUrl?: string | null
  temDescricao: boolean
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/vitrine`, 'regua_loja_sem_cara', 'cta-button')
  // Concordancia e junção natural ("o logo e as redes sociais"). O assunto era
  // fixo em "sem foto e sem descricao" qualquer que fosse o caso -- e foto nem
  // entra nessa checagem, que olha logo, descricao e redes.
  const juntar = (xs: string[]) => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
  const verbo = args.falta.length > 1 ? 'Faltam' : 'Falta'
  const lista = juntar(args.falta.map(f => `<strong style="color:#f0f0f0;">${escapeHtml(f)}</strong>`))
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('A sua página ainda está sem cara')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`${verbo} ${lista} na <b style="color:#f0f0f0;">${loja}</b>. É assim que ela aparece para quem chega:`)}
    ${mockCabecalhoLoja(args.loja, args.logoUrl || null, args.temDescricao)}
    ${p('É o passo mais rápido de todos e muda a página pública na hora — não precisa esperar aprovação de nada.')}
    ${btn('Editar minha vitrine →', url)}${rodape}
  `, `${verbo} ${juntar(args.falta)} na ${args.loja}`)
  return enviarNurture({ from: FROM, to: args.to, subject: subjUser(`${verbo} ${juntar(args.falta)} na página da ${args.loja}`), montarHtml })
}

/**
 * PASSO 3 · plano Pro ou Premium com ZERO foto.
 *
 * ★ O angulo e "voce ja tem, e nao esta usando", nao "assine". Medido: 9 das
 * 10 lojas ativas tem zero foto, e a galeria e justamente o que separa a
 * pagina delas da de uma loja no plano Basico. Elas estao testando exatamente
 * o que nao usam -- e quando o trial acabar nao vao sentir falta de nada.
 */
export async function sendLojaSemFotoEmail(args: {
  to: string; nome: string; loja: string; lojaId: string; limite: number
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/vitrine`, 'regua_loja_sem_foto', 'cta-button')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1(`Você tem ${args.limite} fotos sobrando 📷`)}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`O seu plano libera <b style="color:#f0f0f0;">${args.limite} fotos</b> da <b style="color:#f0f0f0;">${loja}</b> na página pública:`)}
    ${vagasDeFoto(0, args.limite)}
    ${p('A galeria é o que separa a sua página da de uma loja no plano Básico. Uma foto do balcão, da prateleira ou da vitrine já resolve — não precisa de produção.')}
    ${btn('Subir as fotos →', url)}${rodape}
  `, `${args.loja}: ${args.limite} fotos disponíveis e nenhuma no ar`)
  return enviarNurture({ from: FROM, to: args.to, subject: subjUser(`📷 ${args.limite} fotos sobrando no plano da ${args.loja}`), montarHtml })
}

/** PASSO 4 · vitrine vazia: nada a venda, nem carta nem produto. */
export async function sendLojaVitrineVaziaEmail(args: {
  to: string; nome: string; loja: string; lojaId: string
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/produtos`, 'regua_loja_vitrine_vazia', 'cta-button')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('A sua vitrine ainda está vazia')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`A <b style="color:#f0f0f0;">${loja}</b> está no ar e aparece no Guia de Lojas, mas não tem nada à venda:`)}
    ${prateleiraVazia()}
    ${p('Uma carta pelo Marketplace ou um selado pelo painel de produtos já colocam a loja em funcionamento. Um item só já muda a página.')}
    ${btn('Colocar o primeiro item →', url)}${rodape}
  `, `A vitrine da ${args.loja} está vazia`)
  return enviarNurture({ from: FROM, to: args.to, subject: subjUser(`A vitrine da ${args.loja} não tem nada à venda`), montarHtml })
}

/**
 * PASSO 7 · uma semana depois de cair pro Basico.
 *
 * ★ So sai pra quem TINHA o que perder. Mandar "voce perdeu a galeria" pra
 * loja que nunca subiu foto e confessar que o Pro nao fazia falta nenhuma.
 */
export async function sendLojaPerdeuProEmail(args: {
  to: string; nome: string; loja: string; lojaId: string; fotos: number
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/plano`, 'regua_loja_perdeu_pro', 'cta-button')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('As suas fotos saíram da página')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`Faz uma semana que a <b style="color:#f0f0f0;">${loja}</b> voltou para o plano Básico, e desde então ${args.fotos === 1 ? 'a sua foto saiu' : `as suas <b style="color:#f0f0f0;">${args.fotos} fotos</b> saíram`} da página pública.`)}
    ${vagasDeFoto(0, Math.max(args.fotos, 3))}
    ${p('Elas não foram apagadas: continuam guardadas e voltam no mesmo lugar no instante em que você assinar. A loja segue no ar e vendendo do mesmo jeito.')}
    ${btn('Voltar para o Pro →', url)}${rodape}
  `, `As fotos da ${args.loja} saíram da página pública`)
  return enviarNurture({ from: FROM, to: args.to, subject: subjUser(`As fotos da ${args.loja} saíram da página`), montarHtml })
}

/**
 * PASSO 9 · o resumo do mes.
 *
 * ★ E o unico email da regua que o lojista QUER receber, e por isso ele e o
 * que sustenta os outros: quem abre o resumo todo mes abre o resto. Vai pra
 * TODOS os planos de proposito -- o dado ja existe e hoje so o Premium o ve no
 * painel, entao mostrar o numero e o argumento mais honesto que existe pra
 * subir de plano.
 */
export async function sendLojaResumoMensalEmail(args: {
  to: string; nome: string; loja: string; lojaId: string; mes: string
  cliques: number; itens: number; pedidos: number; premium: boolean
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}/analytics`, 'regua_loja_resumo', 'cta-button')
  // Escala comum pras tres barras: comparar cliques com pedidos so significa
  // alguma coisa se as barras dividirem o mesmo maximo.
  const teto = Math.max(args.cliques, args.itens, args.pedidos, 1)
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1(`A ${loja} em ${escapeHtml(args.mes)}`)}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    <div style="margin:20px 0 6px;">
      ${barraNumero('Cliques nos seus contatos', args.cliques, teto, '#60a5fa')}
      ${barraNumero('Itens à venda hoje', args.itens, teto, '#a855f7')}
      ${barraNumero('Pedidos recebidos', args.pedidos, teto, '#22c55e')}
    </div>
    ${p(args.premium
        ? 'O detalhe por canal e por dia está no seu painel de analytics.'
        : 'No Premium você vê de onde vem cada clique, quais itens são mais vistos e o movimento dia a dia.')}
    ${btn('Ver o painel →', url)}${rodape}
  `, `${args.loja}: ${args.cliques} cliques e ${args.pedidos} pedidos em ${args.mes}`)
  return enviarNurture({ from: FROM, to: args.to, subject: subjUser(`A ${args.loja} em ${args.mes}`), montarHtml })
}

/**
 * PASSO 10 · reativacao, UMA vez, aos 60 dias parada.
 *
 * ★ Uma vez e so. Loja que nao responde a este vira lista fria e sai da regua:
 * insistir com quem nao volta nao recupera ninguem e queima o dominio de quem
 * ainda le. O texto diz a saida na primeira linha, de proposito.
 */
export async function sendLojaReativacaoEmail(args: {
  to: string; nome: string; loja: string; lojaId: string; dias: number
}) {
  const first = primeiroNome(args.nome, 'lojista')
  const loja = escapeHtml(args.loja || 'sua loja')
  const url = addUtm(`${APP_URL}/minha-loja/${args.lojaId}`, 'regua_loja_reativacao', 'cta-button')
  const montarHtml = (rodape: string) => baseLayout(`
    ${badge('Sua loja', '#f59e0b', '')}
    ${h1('Ainda faz sentido para você?')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`A <b style="color:#f0f0f0;">${loja}</b> está há <b style="color:#f0f0f0;">${args.dias} dias</b> sem movimento por aqui. Este é o único email que eu mando sobre isso — se não for a hora, é só ignorar que eu não insisto.`)}
    ${p('A loja continua no ar e nada do que você cadastrou foi apagado. Se quiser retomar, o painel está do mesmo jeito que você deixou.')}
    ${btn('Abrir minha loja →', url)}${rodape}
  `, `A ${args.loja} está parada há ${args.dias} dias`)
  return enviarNurture({ from: FROM, to: args.to, subject: subjUser(`A ${args.loja} está parada faz um tempo`), montarHtml })
}

export async function sendNegociacaoExpirandoEmail(args: {
  to: string; nome: string; cardName: string; price: number | null
  anuncioId: string; horasRestantes: number
}) {
  const url = convoUrl(args.anuncioId, 'mkt_negociacao_expirando')
  const first = primeiroNome(args.nome, 'colecionador')
  const carta = escapeHtml(args.cardName || 'a carta')
  const valor = args.price ? ` (${fmtBRLemail(args.price)})` : ''
  const html = baseLayout(`
    ${badge('Marketplace', '#f59e0b', '')}
    ${h1('Sua negociação está prestes a expirar ⏰')}
    ${p(`Olá, ${escapeHtml(first)}.`)}
    ${p(`A negociação de <b style="color:#f0f0f0;">${carta}</b>${valor} está sem resposta. Em <b style="color:#f0f0f0;">${args.horasRestantes}h</b> o anúncio volta para o marketplace e fica livre para qualquer pessoa.`)}
    ${p('Basta responder pelo chat da Bynx para o prazo reiniciar.')}
    ${btn('Responder agora →', url)}
  `, `Faltam ${args.horasRestantes}h na negociação de ${args.cardName}`)
  return enviar({ from: FROM, to: args.to, subject: subjUser(`⏰ Faltam ${args.horasRestantes}h: ${args.cardName}`), html })
}

/**
 * A negociacao ficou parada e o anuncio voltou pro marketplace.
 *
 * ★ DOIS TEXTOS, um por papel: pro vendedor e boa noticia (a carta voltou a
 * vender), pro comprador e perda (ele deixou de ter a reserva). Mandar o mesmo
 * texto pros dois seria dizer "seu anuncio voltou" pra quem nao tem anuncio.
 *
 * ★ Sino sozinho nao bastaria: o publico e majoritariamente mobile e nao abre
 * o app todo dia. Volume esperado e baixissimo -- 5 casos em 3 meses.
 *
 * O CTA leva ao ANUNCIO, nao a conversa (que e o destino dos outros quatro):
 * a negociacao acabou, e o que interessa agora e ver se a carta segue livre.
 */
export async function sendNegociacaoExpiradaEmail(args: {
  to: string; nome: string; papel: 'vendedor' | 'comprador'
  cardName: string; price: number | null; anuncioSlug: string; horas: number
}) {
  const first = primeiroNome(args.nome, 'colecionador')
  const carta = escapeHtml(args.cardName || 'a carta')
  const valor = args.price ? ` (${fmtBRLemail(args.price)})` : ''
  const url = addUtm(`${APP_URL}/anuncio/${args.anuncioSlug}`, 'mkt_negociacao_expirada', 'cta-button')
  const ehVendedor = args.papel === 'vendedor'

  const corpo = ehVendedor
    ? `${p(`Olá, ${escapeHtml(first)}.`)}
       ${p(`A negociação de <b style="color:#f0f0f0;">${carta}</b>${valor} ficou ${args.horas}h sem resposta, então liberamos seu anúncio — ele já está aparecendo de novo para todo mundo no marketplace.`)}
       ${p('Se vocês ainda estão combinando, é só a pessoa demonstrar interesse outra vez.')}`
    : `${p(`Olá, ${escapeHtml(first)}.`)}
       ${p(`A negociação de <b style="color:#f0f0f0;">${carta}</b>${valor} ficou ${args.horas}h parada, então o anúncio voltou para o marketplace e não está mais reservado para você.`)}
       ${p('Se ainda quiser a carta, é só demonstrar interesse de novo — mas agora ela está livre para qualquer um.')}`

  const html = baseLayout(`
    ${badge('Marketplace', '#f59e0b', '')}
    ${h1(ehVendedor ? 'Seu anúncio voltou ao marketplace 🔄' : 'A carta voltou a ficar disponível 🔄')}
    ${corpo}
    ${btn('Ver o anúncio →', url)}
  `, ehVendedor
      ? `${args.cardName} voltou a aparecer no marketplace`
      : `${args.cardName} não está mais reservada para você`)

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(ehVendedor
      ? `🔄 Seu anúncio voltou: ${args.cardName}`
      : `🔄 ${args.cardName} voltou a ficar disponível`),
    html,
  })
}

export async function sendMensagensNaoLidasEmail(args: {
  to: string; name: string; qtd: number; anuncioId: string
}) {
  const url = convoUrl(args.anuncioId, 'mkt_nao_lidas')
  const first = primeiroNome(args.name, 'colecionador')
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
  const subject = subjUser(plural ? `💬 ${args.qtd} mensagens não lidas` : '💬 Você tem uma mensagem não lida')
  return enviar({ from: FROM, to: args.to, subject, html })
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
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const url = `${APP_URL}/minha-loja/${args.lojaId}/pagamentos`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">🎉</div>
    </div>
    ${h1('Seus recebimentos estão ativos!')}
    ${p(`${escapeHtml(firstName)}, a Stripe aprovou o cadastro de <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong>. Sua loja já pode vender direto na Bynx — cartas, selados, acessórios e o que mais você tiver na vitrine.`)}
    ${p('O dinheiro das suas vendas cai na conta bancária que você cadastrou. A gente nunca toca nele — quem cuida disso é a Stripe.')}
    ${divider()}
    ${p('<strong style="color:#f0f0f0;">Como funciona:</strong>')}
    ${p('• O colecionador compra direto na sua vitrine, com Pix ou cartão')}
    ${p('• Você recebe o aviso do pedido e envia o produto')}
    ${p('• O valor cai na sua conta no prazo de repasse que você escolheu')}
    ${divider()}
    ${btnB2B('Ver meus pagamentos', addUtm(url, 'connect_ativo'), B2B_GRADIENT_PREMIUM, '#a855f7')}
  `, 'Sua loja já pode vender na Bynx')

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`🎉 ${args.nomeLoja}: seus recebimentos estão ativos!`),
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
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const url = `${APP_URL}/minha-loja/${args.lojaId}/pagamentos`
  const plural = args.qtdPendencias === 1 ? 'uma informação' : `${args.qtdPendencias} informações`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;line-height:1;">📋</div>
    </div>
    ${h1('Falta pouco para você vender na Bynx')}
    ${p(`${escapeHtml(firstName)}, a Stripe precisa de ${plural} a mais para liberar os recebimentos de <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong>.`)}
    ${p('É rapidinho e você continua exatamente de onde parou. Enquanto isso, sua loja segue no ar normalmente — só as vendas com pagamento pela Bynx que ficam esperando.')}
    ${divider()}
    ${btnB2B('Resolver agora', addUtm(url, 'connect_pendencia'), B2B_GRADIENT_PRO, '#8b5cf6')}
    ${p('<span style="color:rgba(255,255,255,0.4);font-size:13px;">Essas informações são exigidas pela Stripe, que processa os pagamentos com segurança. A Bynx não tem acesso aos seus dados bancários.</span>')}
  `, `A Stripe precisa de ${plural} para liberar seus recebimentos`)

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`📋 ${args.nomeLoja}: falta pouco para ativar seus recebimentos`),
    html,
  })
}

// ─── Venda on-site (marketplace com Stripe Connect) ─────────────────────────

/** Lojista: vendeu, precisa enviar. E o email mais importante do fluxo. */
export async function sendVendaLojistaEmail(args: {
  to: string
  nomeUser: string
  nomeLoja: string
  lojaId: string
  pedidoNumero: number | string
  itemNome: string
  liquidoBRL: string
  compradorNome: string
  endereco: string
  repassePrazo: number
}) {
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const url = `${APP_URL}/minha-loja/${args.lojaId}/pedidos`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;"><div style="font-size:48px;line-height:1;">💰</div></div>
    ${h1('Você vendeu!')}
    ${p(`${escapeHtml(firstName)}, <strong style="color:#f0f0f0;">${escapeHtml(args.itemNome)}</strong> foi vendido na sua vitrine da Bynx. O pagamento já está confirmado.`)}
    ${divider()}
    ${p(`<strong style="color:#f0f0f0;">Pedido #${args.pedidoNumero}</strong>`)}
    ${p(`Comprador: ${escapeHtml(args.compradorNome)}`)}
    ${p(`Entrega: ${escapeHtml(args.endereco)}`)}
    ${p(`Você recebe: <strong style="color:#22c55e;">${args.liquidoBRL}</strong> em até ${args.repassePrazo} dias`)}
    ${divider()}
    ${p('<strong style="color:#f0f0f0;">Agora é com você:</strong> envie o produto e marque o pedido como enviado (com o código de rastreio, se tiver). O comprador é avisado automaticamente.')}
    ${btnB2B('Ver o pedido', addUtm(url, 'venda_lojista'), B2B_GRADIENT_PREMIUM, '#a855f7')}
  `, `${args.itemNome} vendido — envie o produto`)

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`💰 Você vendeu: ${args.itemNome}`),
    html,
  })
}

/** Comprador: pagou, esta tudo certo, e agora e so esperar. */
export async function sendPedidoCompradorEmail(args: {
  to: string
  nomeUser: string
  pedidoId: string
  pedidoNumero: number | string
  itemNome: string
  nomeLoja: string
  totalBRL: string
}) {
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const url = `${APP_URL}/pedido/${args.pedidoId}`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;"><div style="font-size:48px;line-height:1;">✅</div></div>
    ${h1('Pagamento confirmado!')}
    ${p(`${escapeHtml(firstName)}, sua compra de <strong style="color:#f0f0f0;">${escapeHtml(args.itemNome)}</strong> na <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> foi confirmada.`)}
    ${divider()}
    ${p(`<strong style="color:#f0f0f0;">Pedido #${args.pedidoNumero}</strong>`)}
    ${p(`Total pago: <strong style="color:#f0f0f0;">${args.totalBRL}</strong>`)}
    ${divider()}
    ${p('A loja já foi avisada e vai preparar seu envio. Você recebe outro e-mail assim que ela despachar — e pode acompanhar tudo por aqui.')}
    ${btn('Acompanhar pedido', addUtm(url, 'pedido_comprador'))}
  `, `Pedido #${args.pedidoNumero} confirmado`)

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`✅ Pedido confirmado: ${args.itemNome}`),
    html,
  })
}

/** Comprador: a loja despachou. Fecha o ciclo da compra. */
export async function sendPedidoEnviadoEmail(args: {
  to: string
  nomeUser: string
  pedidoId: string
  pedidoNumero: number | string
  itemNome: string
  nomeLoja: string
  rastreio: string | null
}) {
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const url = `${APP_URL}/pedido/${args.pedidoId}`

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;"><div style="font-size:48px;line-height:1;">📦</div></div>
    ${h1('Seu pedido foi enviado!')}
    ${p(`${escapeHtml(firstName)}, a <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> despachou <strong style="color:#f0f0f0;">${escapeHtml(args.itemNome)}</strong>. Agora é só aguardar a entrega.`)}
    ${args.rastreio
      ? `${divider()}${p(`<strong style="color:#f0f0f0;">Código de rastreio</strong>`)}${p(`<span style="font-family:monospace;font-size:16px;color:#60a5fa;letter-spacing:0.05em;">${escapeHtml(args.rastreio)}</span>`)}`
      : ''}
    ${divider()}
    ${btn('Acompanhar pedido', addUtm(url, 'pedido_enviado'))}
  `, `${args.itemNome} está a caminho`)

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`📦 A caminho: ${args.itemNome}`),
    html,
  })
}


export async function sendReembolsoCompradorEmail(args: {
  to: string
  nomeUser: string
  pedidoId: string
  pedidoNumero: number | string
  itemNome: string
  nomeLoja: string
  valorCents: number
  motivo?: string | null
}) {
  const firstName = primeiroNome(args.nomeUser, 'Colecionador')
  const url = `${APP_URL}/pedido/${args.pedidoId}`
  const valor = (args.valorCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const html = baseLayout(`
    <div style="text-align:center;margin-bottom:20px;"><div style="font-size:48px;line-height:1;">↩️</div></div>
    ${h1('Seu pedido foi reembolsado')}
    ${p(`${escapeHtml(firstName)}, a <strong style="color:#f0f0f0;">${escapeHtml(args.nomeLoja)}</strong> cancelou o pedido de <strong style="color:#f0f0f0;">${escapeHtml(args.itemNome)}</strong> e o valor foi estornado.`)}
    ${divider()}
    ${p(`<strong style="color:#f0f0f0;">Valor reembolsado:</strong> <span style="color:#22c55e;font-weight:700;">${valor}</span>`)}
    ${args.motivo ? p(`<strong style="color:#f0f0f0;">Motivo informado pela loja:</strong> ${escapeHtml(args.motivo)}`) : ''}
    ${p('O estorno volta pro mesmo cartão em alguns dias úteis, no prazo do banco emissor.')}
    ${divider()}
    ${btn('Ver o pedido', addUtm(url, 'pedido_reembolsado'))}
  `, `Reembolso do pedido #${args.pedidoNumero}`)

  return enviar({
    from: FROM,
    to: args.to,
    subject: subjUser(`↩️ Reembolso: ${args.itemNome}`),
    html,
  })
}
