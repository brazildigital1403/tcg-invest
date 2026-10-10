/**
 * E02 · Boas-vindas: a fila do Scan IA (Ativacao). Mockup aprovado:
 * _Regua/mockups/E02-boas-vindas-scan/email.html.
 *
 * Gatilho: cadastro confirmado. Substitui o sendWelcomeEmail atual.
 *
 * ARTE
 * - Hero `e02/hero-fila.jpg` (600x340) = FIXA, igual para todos: a fila do
 *   Scan IA com Mew ex (R$ 34,00), Pikachu Crown Zenith (R$ 149,90), Charizard
 *   ex 151 (R$ 2.030,00) e a carta de costas "a sua: R$ ?". Os precos sao
 *   EXEMPLO (nao sao da pessoa) e estao desenhados na arte; o H1, o alt e o
 *   assunto repetem os mesmos valores. Se o menor preco mudar, regerar a arte
 *   (mockups/E02-boas-vindas-scan/assets/hero-fila.html) e trocar PRECOS juntos.
 *
 * Deep link: /minha-colecao?scan=1 abre o Scan IA direto (src/lib/deepLink.ts).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { FONT, esc, hero, h1, kicker, linha, link, p, reais, reaisTxt } from './blocos-a'

const CAMPANHA = 'e02'
/** Cartas por foto do Scan IA. */
const CARTAS_POR_FOTO = 8
/** Precos de exemplo desenhados na arte (menor preco do Mercado Brasileiro em 07/10). */
const PRECOS = { mew: 34, pikachu: 149.9, charizard: 2030 }

export type DadosE02 = {
  /** Primeiro nome; vazio = textos sem nome. */
  nome: string
  /** Fotos de Scan IA do teste do Pro (cota). */
  fotosTotal: number
  /** Fotos ainda livres no envio. */
  fotosLivres: number
  /** Fim do teste do Pro, "dd/mm". */
  fimTeste: string
  /** Dias de Pro do teste (rotulo do cabecalho). */
  diasTeste: number
}

function montar(d: DadosE02, ctx: CtxRegua) {
  const nome = d.nome.trim()
  const faixa = `${reaisTxt(PRECOS.mew)} ou ${reaisTxt(PRECOS.charizard)}`
  const assunto = nome ? `${nome}, a sua vale ${faixa}?` : `A sua vale ${faixa}?`
  const preheader = `${d.fotosTotal} fotos de Scan IA liberadas até ${d.fimTeste}. Até ${CARTAS_POR_FOTO} cartas por foto, com o preço de cada uma.`
  const hrefScan = (c: string) => link('/minha-colecao?scan=1', CAMPANHA, c)

  const barras = Array.from({ length: d.fotosTotal }, (_, i) => {
    const acesa = i < d.fotosLivres
    const pad = i === 0 ? '0 3px 0 0' : i === d.fotosTotal - 1 ? '0 0 0 3px' : '0 3px'
    const cor = acesa
      ? 'background-color:#f59e0b;background-image:linear-gradient(135deg,#f59e0b,#ef4444);'
      : 'background-color:#2f3135;'
    return `<td width="${Math.floor(100 / d.fotosTotal)}%" style="padding:${pad};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="10" bgcolor="${acesa ? '#f59e0b' : '#2f3135'}" style="height:10px;font-size:1px;line-height:10px;border-radius:999px;${cor}">&nbsp;</td></tr></table></td>`
  }).join('')

  const conteudo = [
    hero({
      src: urlArte('e02', 'hero-fila.jpg'),
      alt: `O Scan IA lendo uma fileira de cartas: Mew ex ${reaisTxt(PRECOS.mew)}, Pikachu ${reaisTxt(PRECOS.pikachu)}, Charizard ex ${reaisTxt(PRECOS.charizard)} e a próxima, a sua: R$ ?`,
      href: hrefScan('hero'),
      largura: 600,
      altura: 340,
    }),
    linha(`
        ${kicker(nome ? `Boas-vindas, ${esc(nome)}` : 'Boas-vindas à Bynx', '#f59e0b', '0 0 4px')}
        ${h1(`Tem carta de ${reais(PRECOS.mew)} e tem de ${reais(PRECOS.charizard)}. E&nbsp;a&nbsp;sua?`, '0')}`, '18px 32px 0'),
    linha(`
        ${btnRegua('Descobrir quanto vale a minha', hrefScan('cta'))}
        ${p(`Uma foto das suas, até ${CARTAS_POR_FOTO} por vez, mostra o preço de cada uma no Mercado Brasileiro. A maioria vale poucos reais; a graça é achar a que não&nbsp;vale.`, 'margin:14px 0 0;font-size:16px;line-height:24px;color:#a3a4a6;')}
        ${p(`Sem cartas por perto? Procure a que você mais queria quando era criança: <a href="${esc(link('/busca', CAMPANHA, 'busca-infancia'))}" target="_blank" style="color:#f0f0f0;font-weight:700;text-decoration:underline;white-space:nowrap;">buscar uma&nbsp;carta</a>.`, 'margin:12px 0 0;font-size:15px;line-height:22px;color:#a3a4a6;')}`, '16px 32px 0'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #2f3135;border-radius:16px;">
          <tr><td style="padding:16px 18px;${FONT}">
            ${kicker('Seu Pro de teste', '#f59e0b', '0 0 4px')}
            <p style="margin:0 0 14px;font-size:18px;line-height:25px;font-weight:800;color:#f0f0f0;">${d.fotosTotal} fotos de Scan IA = até ${d.fotosTotal * CARTAS_POR_FOTO} cartas com&nbsp;preço.</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${barras}</tr></table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="left" style="padding:8px 0 0;${FONT}font-size:14px;line-height:18px;font-weight:800;color:#f0f0f0;">${d.fotosLivres} de ${d.fotosTotal} fotos livres</td>
              <td align="right" style="padding:8px 0 0;${FONT}font-size:14px;line-height:18px;font-weight:800;color:#f59e0b;">até ${esc(d.fimTeste)}</td>
            </tr></table>
            ${p('Depois, a conta segue no Grátis, sem cobrança e sem Scan&nbsp;IA.', 'margin:14px 0 0;font-size:14px;line-height:20px;color:#a8a8aa;')}
          </td></tr>
        </table>`, '24px 32px 0'),
    linha(p('Funciona no navegador, sem instalar nada. Se a IA errar alguma carta, responda este e-mail com a foto: nós conferimos e corrigimos para&nbsp;você.'), '20px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: `${d.diasTeste} dias de Pro ativos`,
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E02: TemplateRegua<DadosE02> = {
  id: 'E02',
  nome: 'Boas-vindas: a fila do Scan IA',
  trilha: 'Ativação',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Rafael, cadastro em 07/10, teste ate 14/10.
  exemplo: { nome: 'Rafael', fotosTotal: 10, fotosLivres: 10, fimTeste: '14/10', diasTeste: 7 },
  montar,
}
