/**
 * Pecas de HTML compartilhadas pelos templates E01..E10 da regua.
 *
 * Tudo aqui e HTML de e-mail: tabelas, CSS inline, hex (cliente de e-mail nao
 * le var()). O layout (cabecalho, cartao, assinatura, Selecao Bynx e rodape)
 * continua sendo o `layoutRegua` de `src/lib/email.ts`; estas pecas montam so
 * o MIOLO do cartao.
 *
 * Regra de seguranca: todo dado dinamico passa por `esc` (texto) ou `attr`
 * (atributo) antes de entrar no HTML.
 */
import { URL_CANONICA, utmRegua } from '@/lib/email'
import { brl } from '@/lib/regua/comum'

export const FONT = "font-family:'DM Sans',Helvetica,Arial,sans-serif;"

/** Escapa texto para HTML. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/** Escapa valor de atributo (href, src, alt). */
export const attr = esc

/** 1249 -> "R$&nbsp;1.249,00" (HTML, nao quebra entre o R$ e o numero). */
export function reais(valor: number): string {
  // Funcao como substituto: em string, "$&" seria o padrao de troca do replace.
  return esc(brl(Math.abs(valor))).replace('R$ ', () => 'R$&nbsp;')
}

/** Valor com sinal: "+R$&nbsp;510,90" ou "&minus;R$&nbsp;57,95". */
export function reaisSinal(valor: number): string {
  return `${valor < 0 ? '&minus;' : '+'}${reais(valor)}`
}

/** Mesmo valor em texto puro (assunto, pre-header, alt): "R$ 1.249,00". */
export function reaisTxt(valor: number): string {
  return brl(Math.abs(valor))
}

/** 61.6 -> "61,6" (sem sinal, sem %). */
export function num(valor: number, casas = 1): string {
  return Math.abs(valor).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** "1 carta" / "11 cartas". */
export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`
}

/** Link interno da regua com utm (cru: passar por `attr` ao por no href). */
export function link(caminho: string, campanha: string, conteudo: string): string {
  const base = /^https?:\/\//.test(caminho) ? caminho : `${URL_CANONICA}${caminho.startsWith('/') ? '' : '/'}${caminho}`
  return utmRegua(base, campanha, conteudo)
}

/** /carta/<slug ou id>. A rota aceita os dois (id responde 308 para o slug). */
export function caminhoCarta(slug: string): string {
  return `/carta/${encodeURIComponent(slug)}`
}

const HOSTS_CARTA = ['images.pokemontcg.io', 'images.scrydex.com']

/**
 * Imagem de carta so de fonte permitida: pokemontcg.io, scrydex, storage da
 * Bynx ou arte da propria Bynx. Qualquer outra origem vira '' (o template cai
 * no fundo com alt). Barra repositorio de fornecedor por construcao.
 */
export function imagemCarta(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return ''
    if (HOSTS_CARTA.includes(u.hostname)) return u.toString()
    if (u.hostname === 'hvkcwfcvizrvhkerupfc.supabase.co' && u.pathname.startsWith('/storage/')) return u.toString()
    if (u.origin === new URL(URL_CANONICA).origin && u.pathname.startsWith('/emails/')) return u.toString()
    return ''
  } catch {
    return ''
  }
}

/**
 * Ajustes do celular deste template. O `<style>` do `layoutRegua` cobre o
 * comum; isto acrescenta so classes proprias. Sem ele o e-mail continua certo
 * (vale o layout de desktop).
 */
export function estiloCelular(css: string): string {
  return `<style>@media only screen and (max-width:480px){${css}}</style>`
}

/** Linha do miolo: tabela de largura total com uma celula `.px`. */
export function linha(conteudo: string, padding: string, extra = ''): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="px${extra ? ` ${extra}` : ''}" style="padding:${padding};${FONT}">${conteudo}</td>
    </tr></table>`
}

/** Hero de largura total do cartao, com link. */
export function hero(args: { src: string; alt: string; href: string; largura: number; altura: number; fundo?: string }): string {
  const fundo = args.fundo ?? '#0d0f14'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${fundo}" style="background-color:${fundo};font-size:0;line-height:0;">
        <a href="${attr(args.href)}" target="_blank" style="text-decoration:none;"><img src="${attr(args.src)}" width="${args.largura}" height="${args.altura}" alt="${attr(args.alt)}" style="display:block;width:100%;max-width:${args.largura}px;height:auto;border:0;color:#f0f0f0;${FONT}font-size:16px;font-weight:700;line-height:24px;background-color:#191b20;"/></a>
      </td>
    </tr></table>`
}

/** Sobretitulo em caixa alta (ambar por padrao). */
export function kicker(texto: string, cor = '#f59e0b', margem = '0 0 6px', espaco = '0.08em'): string {
  return `<p style="margin:${margem};font-size:14px;line-height:20px;font-weight:800;letter-spacing:${espaco};text-transform:uppercase;color:${cor};">${texto}</p>`
}

/** H1 do e-mail (o `.h1` do layout reduz no celular). */
export function h1(html: string, margem = '0 0 8px'): string {
  return `<h1 class="h1" style="margin:${margem};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.02em;color:#f0f0f0;">${html}</h1>`
}

/** Paragrafo de apoio. */
export function p(html: string, estilo = 'margin:0;font-size:16px;line-height:24px;color:#a3a4a6;'): string {
  return `<p style="${estilo}">${html}</p>`
}

/** Divisoria de 1px. */
export function divisoria(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#202227" style="height:1px;font-size:1px;line-height:1px;background-color:#202227;">&nbsp;</td></tr></table>`
}

/**
 * Botao de COMPRA (fluxo do comprador): roxo -> rosa. O botao do app
 * (ambar -> vermelho) e o `btnRegua` de email.ts. Um botao cheio por e-mail.
 */
export function btnCompra(label: string, href: string, opts: { texto?: '#0a0a0a' | '#ffffff'; tamanho?: number; bloco?: boolean } = {}): string {
  const h = attr(href)
  const cor = opts.texto ?? '#0a0a0a'
  const tam = opts.tamanho ?? 16
  const disp = opts.bloco ? 'display:block;padding:0 24px;' : 'display:inline-block;padding:0 36px;min-width:208px;'
  return `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="23%" stroke="f" fillcolor="#a855f7">
        <w:anchorlock/><center style="color:${cor};font-family:Arial,sans-serif;font-size:${tam}px;font-weight:bold;">${esc(label)}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${h}" target="_blank" class="btn${cor === '#0a0a0a' ? ' tinta' : ''}" style="${disp}height:52px;line-height:52px;text-align:center;border-radius:12px;background-color:#a855f7;background-image:linear-gradient(135deg,#a855f7,#ec4899);color:${cor};${FONT}font-size:${tam}px;font-weight:800;text-decoration:none;mso-hide:all;">${esc(label)}</a>
        <!--<![endif]-->`
}
