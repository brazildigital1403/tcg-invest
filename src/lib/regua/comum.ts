/**
 * Contrato comum dos templates da regua de e-mail (E01..E20).
 *
 * Cada template vive em `src/lib/regua/templates/EXX.ts` e exporta um objeto
 * `TemplateRegua<D>`: recebe os dados JA prontos da pessoa (quem monta os
 * dados e o motor, nao o template) e devolve assunto, pre-header e HTML
 * completo, sempre via `layoutRegua` de `src/lib/email.ts`.
 *
 * Regras que valem para todos:
 * - voz da Bynx (remetente e assinatura "Bynx"; nada de Eduardo);
 * - dado da pessoa em TEXTO no HTML, nunca desenhado dentro da imagem;
 * - arte igual para todos e PNG/JPG fixo em /emails/regua/<id>/;
 * - montagem pessoal que precisa ser imagem usa `urlImagemPessoal`, que aponta
 *   para a rota de ImageResponse (token opaco, nenhum dado pessoal na URL).
 */
import type { CategoriaEmail, LinksRelacionamento, PromocaoEmail } from '@/lib/email'
import { URL_CANONICA } from '@/lib/email'

export type EmailMontado = {
  assunto: string
  preheader: string
  html: string
}

export type CtxRegua = {
  /** Descadastro e preferencias da pessoa; null em pre-visualizacao. */
  links: LinksRelacionamento | null
  /** Produtos ativos da vitrine 'email' (admin /admin/promocoes). */
  promocoes: PromocaoEmail[]
  /** Token opaco do envio, para a rota de imagem pessoal. */
  tokenImagem: string | null
}

export type TemplateRegua<D> = {
  id: string
  nome: string
  trilha: string
  categoria: Exclude<CategoriaEmail, 'transacional'>
  /** Dados de exemplo (persona ficticia com cartas e precos reais) para a pre-visualizacao. */
  exemplo: D
  montar: (dados: D, ctx: CtxRegua) => EmailMontado
}

/** URL publica de arte fixa da regua: /emails/regua/<id>/<arquivo>. */
export function urlArte(id: string, arquivo: string): string {
  return `${URL_CANONICA}/emails/regua/${id}/${arquivo}`
}

/**
 * URL da imagem pessoal gerada na abertura do e-mail (rota de ImageResponse).
 * Sem token (pre-visualizacao), devolve o modo exemplo da mesma rota.
 */
export function urlImagemPessoal(tipo: string, token: string | null): string {
  const q = token ? `t=${encodeURIComponent(token)}` : 'exemplo=1'
  return `${URL_CANONICA}/api/email/img/${encodeURIComponent(tipo)}?${q}`
}

/** "1249" | 1249 -> "R$ 1.249,00" */
export function brl(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ')
}
