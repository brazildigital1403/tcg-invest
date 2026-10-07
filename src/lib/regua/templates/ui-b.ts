/**
 * Pecas comuns do lote B da regua (E11..E20). So monta HTML: nao le banco,
 * nao envia nada. O esqueleto (cabecalho, cartao, Selecao Bynx, rodape) e
 * sempre o `layoutRegua` de src/lib/email.ts; aqui ficam so os blocos que se
 * repetem entre os templates deste lote.
 */
import { escapeHtml } from '@/lib/email'
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

/** Escape de HTML para TODO dado dinamico (o mesmo `escapeHtml` de email.ts). */
export const esc = escapeHtml

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
