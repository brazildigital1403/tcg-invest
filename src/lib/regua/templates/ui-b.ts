/**
 * Pecas comuns do lote B da regua (E11..E20). So monta HTML: nao le banco,
 * nao envia nada. O esqueleto (cabecalho, cartao, Selecao Bynx, rodape) e
 * sempre o `layoutRegua` de src/lib/email.ts; aqui ficam so os blocos que se
 * repetem entre os templates deste lote.
 */
import { URL_CANONICA, motivoRecebimento, type CategoriaEmail } from '@/lib/email'
import { brl } from '@/lib/regua/comum'

export const FONT = "font-family:'DM Sans',Helvetica,Arial,sans-serif;"

/** Cores achatadas da regua (cliente de e-mail nao le var() nem rgba no Outlook). */
export const COR = {
  texto: '#f0f0f0',
  texto2: '#a3a4a6',
  ambar: '#f59e0b',
  verde: '#22c55e',
  vermelho: '#ef4444',
  rosa: '#ec4899',
  surface2: '#191b20',
  borda: '#202227',
  borda2: '#2f3135',
  elevado: '#0d0f14',
  fundo: '#080a0f',
  tinta: '#0a0a0a',
} as const

/** Escape de HTML para TODO dado dinamico (nome, carta, set, loja...). */
export function esc(v: string | number | null | undefined): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/** URL dentro de atributo (href/src): `&` vira `&amp;`, aspas escapadas. */
export function attr(href: string): string {
  return String(href ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '%3C').replace(/>/g, '%3E')
}

/** R$ com centavos, ja escapado e sem quebra entre "R$" e o numero. */
export function rs(v: number): string {
  return esc(brl(v)).replace(/\s/g, '&nbsp;')
}

/** R$ sem os centavos quando o valor e inteiro ("R$ 1.350"). Para texto puro (assunto). */
export function brlCurto(v: number): string {
  return Number.isInteger(v)
    ? `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
    : brl(v)
}

/** 79.04 -> "79,0%"; casas = 0 -> "79%". */
export function pct(v: number, casas = 1): string {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

/** Tabela de linha unica com uma celula `.px` (o padrao de bloco do corpo). */
export function linha(conteudo: string, padding: string, classe = ''): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px${classe ? ` ${classe}` : ''}" style="padding:${padding};${FONT}">
        ${conteudo}
      </td></tr>
    </table>`
}

/**
 * Logo no lugar de "Bynx" em linha propria, IGUAL ao da assinatura do
 * layoutRegua. Usado quando o mockup aprovado tem algo DEPOIS da assinatura
 * (P.S.), o que o `assinatura: true` do layout nao permite.
 */
export function logoAssinatura(margem = '0'): string {
  return `<p style="margin:${margem};"><a href="${URL_CANONICA}" target="_blank" style="text-decoration:none;display:inline-block;"><img src="${URL_CANONICA}/emails/regua/logo-bynx.png" width="85" height="32" alt="Bynx" style="display:block;width:85px;height:32px;border:0;color:#f0f0f0;${FONT}font-size:16px;font-weight:800;"/></a></p>`
}

/** Botao de COMPRA (fluxo do comprador): roxo -> rosa, texto claro. */
export function btnCompra(label: string, href: string, opts: { escurecer?: boolean; fonte?: number; largura?: number } = {}): string {
  const h = attr(href)
  const fonte = opts.fonte ?? 18
  const fill = opts.escurecer ? '#8544c3' : '#a855f7'
  const grad = opts.escurecer
    ? 'linear-gradient(rgba(10,10,10,.22),rgba(10,10,10,.22)),linear-gradient(135deg,#a855f7,#ec4899)'
    : 'linear-gradient(135deg,#a855f7,#ec4899)'
  return `<!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h}" style="height:52px;v-text-anchor:middle;width:${opts.largura ?? 360}px;" arcsize="23%" stroke="f" fillcolor="${fill}">
        <w:anchorlock/><center style="color:#f0f0f0;font-family:Arial,sans-serif;font-size:${fonte}px;font-weight:bold;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${h}" target="_blank" class="btn" style="display:inline-block;padding:0 32px;height:52px;line-height:52px;min-width:208px;text-align:center;border-radius:12px;background-color:${fill};background-image:${grad};color:#f0f0f0;${FONT}font-size:${fonte}px;font-weight:800;text-decoration:none;mso-hide:all;">${label}</a>
        <!--<![endif]-->`
}

/**
 * Acrescenta regras ao <style> do <head> do documento do layoutRegua (os
 * ajustes de celular proprios de cada template). Sem o marcador, devolve o
 * HTML como veio: o e-mail continua legivel, so sem o ajuste fino.
 */
export function comCss(html: string, css: string): string {
  const marca = '</style>\n</head>'
  const i = html.lastIndexOf(marca)
  if (i < 0) return html
  return `${html.slice(0, i)}${css}\n${html.slice(i)}`
}

/**
 * Ajusta o rodape de relacionamento do layoutRegua para o texto aprovado no
 * mockup: troca o motivo do recebimento e acrescenta linhas antes/depois dele.
 * Texto puro (sera escapado). Sem o motivo padrao no HTML, nada muda.
 */
export function ajustarRodape(
  html: string,
  categoria: Exclude<CategoriaEmail, 'transacional'>,
  opts: { antes?: string[]; motivo?: string; depois?: string[] },
): string {
  const padrao = esc(motivoRecebimento(categoria))
  const fim = html.lastIndexOf(`${padrao}</p>`)
  if (fim < 0) return html
  const ini = html.lastIndexOf('<p ', fim)
  if (ini < 0) return html
  const fecha = fim + padrao.length + '</p>'.length
  const estiloP = html.slice(ini, html.indexOf('>', ini) + 1)
  const extra = (linhas?: string[]) =>
    (linhas || []).map((t) => `${estiloP}${esc(t)}</p>`).join('\n    ')
  const motivo = `${estiloP}${opts.motivo ? esc(opts.motivo) : padrao}</p>`
  return `${html.slice(0, ini)}${extra(opts.antes)}${opts.antes?.length ? '\n    ' : ''}${motivo}${opts.depois?.length ? '\n    ' : ''}${extra(opts.depois)}${html.slice(fecha)}`
}
