/**
 * E04B · D3: Pokedex e primeira meta, para quem tem 0 cartas (Ativacao).
 * Mockup aprovado: _Regua/mockups/E04B-pokedex-zero-cartas/email.html (v3,
 * "uma foto, tres precos").
 *
 * Gatilho: o mesmo do E04 (72h a 96h do cadastro, uma vez, sem meta), com a
 * colecao em 0 cartas. Categoria 'colecao', fora do teto. Nada de nome nem de
 * colecao: o gancho e o mesmo Pokemon em tres precos reais.
 *
 * ARTE (FIXA, igual para todos): `e04b/hero-scan.jpg` (600x330), o podio dos
 * tres Pikachus lido pelo Scan IA. Os precos tambem estao desenhados na arte
 * (decisao do mockup); o texto vivo traz o menor preco do dia. Se algum dos
 * tres mudar, a arte precisa ser re-renderizada (mockups/E04B.../assets/hero-scan.html).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { attr, estiloCelular, h1, hero, linha, link, p, reais, reaisTxt } from './blocos-a'

const CAMPANHA = 'e04b'

export type DadosE04B = {
  /** Menor preco do dia das tres cartas da arte (base1-58, swsh12pt5-160, sv8-238). */
  precos: { base1999: number; crownZenith: number; surgingSparks: number }
  /** Fim do teste do Pro em "dd/mm"; null = fora do teste (a frase sai). */
  fimTeste: string | null
}

function montar(d: DadosE04B, ctx: CtxRegua) {
  const pr = d.precos
  const assunto = `${reaisTxt(pr.base1999)} ou ${reaisTxt(pr.surgingSparks)}? Uma foto responde`
  const preheader = 'O Scan IA lê várias cartas de uma foto só e mostra o preço de cada uma, em reais, na hora.'
  const hrefScan = (c: string) => link('/minha-colecao?scan=1', CAMPANHA, c)
  const forte = (v: number, cor = '#f0f0f0', peso = 700) => `<b style="color:${cor};font-weight:${peso};white-space:nowrap;">${reais(v)}</b>`

  const conteudo = [
    estiloCelular('.e04b-pt{padding-top:16px!important}'),
    hero({
      src: urlArte('e04b', 'hero-scan.jpg'),
      alt: `O Scan IA lendo três cartas do Pikachu em uma foto só: a de 1999 a ${reaisTxt(pr.base1999)}, a do Crown Zenith a ${reaisTxt(pr.crownZenith)} e o Pikachu ex do Surging Sparks a ${reaisTxt(pr.surgingSparks)}.`,
      href: hrefScan('hero'),
      largura: 600,
      altura: 330,
    }),
    linha(`
        ${h1('Uma foto, três preços', '0 0 10px')}
        ${p(`O Pikachu de 1999 está a ${forte(pr.base1999)}, o do Crown Zenith a ${forte(pr.crownZenith)} e o ex do Surging Sparks a ${forte(pr.surgingSparks, '#f59e0b', 800)} (menor preço do Mercado Brasileiro). O Scan IA lê várias cartas de uma foto só e mostra o preço de cada uma na hora.${d.fimTeste ? ` <b style="color:#f0f0f0;font-weight:700;">No seu teste do Pro, ele está liberado até ${d.fimTeste}.</b>` : ''}`, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;')}`, '24px 32px 0', 'e04b-pt'),
    linha(`
        ${btnRegua('Ver o preço na hora', hrefScan('cta'))}
        ${p(`Sem carta por perto? <a href="${attr(link('/pokedex?p=pikachu', CAMPANHA, 'pokedex'))}" target="_blank" style="color:#f0f0f0;font-weight:700;text-decoration:underline;">Veja os três na Pokédex</a>: ela mostra o preço de cada carta de qualquer Pokémon, em todos os planos, inclusive no&nbsp;Grátis.`, 'margin:12px 0 0;font-size:14px;line-height:21px;color:#a3a4a6;')}`, '20px 32px 0'),
    linha(p('Qual Pokémon você mais quer ter na coleção? É só responder este <span style="white-space:nowrap;">e-mail</span>: nós lemos todas as respostas.', 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;'), '32px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    assinatura: true,
    respiroAssinatura: 12,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E04B: TemplateRegua<DadosE04B> = {
  id: 'E04B',
  nome: 'D3: uma foto, três preços (0 cartas)',
  trilha: 'Ativação',
  categoria: 'colecao',
  // Sem persona (cadastro novo, 0 cartas). Menor preco de 07/10; teste do Pro ate 14/10 (cadastro em 07/10).
  exemplo: {
    precos: { base1999: 26.9, crownZenith: 149.9, surgingSparks: 2000 },
    fimTeste: '14/10',
  },
  montar,
}
