/**
 * E04 · D3: sua Pokedex e a primeira meta (Ativacao). Mockup aprovado:
 * _Regua/mockups/E04-pokedex-primeira-meta/email.html. A variante "0 cartas"
 * (email-0cartas.html) NAO esta aqui.
 *
 * Gatilho: 72h apos o cadastro, uma vez, so para quem ainda nao tem meta.
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e04-proxima`, 600x372
 *   (render 2x = 1200x744, JPG). Desenho de referencia:
 *   mockups/E04-pokedex-primeira-meta/assets/hero-proxima.html.
 *   A rota desenha, com os dados do token:
 *   - no alto a esquerda, em caixa alta ambar "SEU <set>" e embaixo, em cinza,
 *     "voce tem <N>";
 *   - uma fileira de 3 bolsos da pasta (556x258, fundo #191b20, raio 16): as
 *     2 cartas da pessoa no set (imagem da carta, _hires) com o selo redondo de
 *     check (gradiente ambar->vermelho, check preto desenhado) e, no 3o bolso
 *     tracejado, a carta que falta em cinza a 42% com o rotulo "falta" / "<nome>";
 *   - acima da carta que mais subiu, uma etiqueta escura com borda verde ligada
 *     ao bolso por um traco: "triangulo 61,6%" verde, "em 7 dias" e o menor preco
 *     "R$ 160,00".
 *   Tudo isso tambem esta em texto vivo no H1 e no paragrafo.
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { esc, estiloCelular, hero, h1, linha, link, num, p, reais, reaisTxt } from './blocos-a'

const CAMPANHA = 'e04'

export type DadosE04 = {
  nome: string
  /** Nome curto do set sugerido como meta (ex.: "151"). */
  set: string
  /** Cartas que a pessoa ja tem nesse set (nome). */
  tem: string[]
  /** Valor somado das cartas que ela tem no set (menor preco). */
  valorNoSet: number
  /** A carta do set que mais subiu em 7 dias. */
  destaque: { nome: string; pct: number; preco: number }
  /** A carta mais procurada do set que ainda falta. */
  falta: { nome: string }
}

function montar(d: DadosE04, ctx: CtxRegua) {
  const pct = num(d.destaque.pct)
  const assunto = `O ${d.destaque.nome} do seu ${d.set} subiu ${pct}% em 7 dias`
  const preheader = `O ${d.falta.nome} do mesmo set ainda falta na sua coleção. Veja quanto o seu ${d.set} vale hoje.`
  const href = (c: string) => link('/metas', CAMPANHA, c)

  const juntas = d.tem.length === 2
    ? `Seu ${esc(d.tem[0])} e seu ${esc(d.tem[1])} já valem`
    : d.tem.length === 1
      ? `Seu ${esc(d.tem[0])} já vale`
      : `As suas ${d.tem.length} cartas do ${esc(d.set)} já valem`
  const sufixo = d.tem.length === 1 ? '' : d.tem.length === 2 ? ' juntos' : ' juntas'

  const listaTem = d.tem.length === 2 ? `o ${d.tem[0]} e o ${d.tem[1]}` : d.tem.join(', ')
  const alt = `Seu ${d.set}: você tem ${listaTem}. O ${d.destaque.nome} subiu ${pct}% em 7 dias e está a ${reaisTxt(d.destaque.preco)}. No bolso ao lado, falta o ${d.falta.nome}.`

  const conteudo = [
    estiloCelular('.e04-pt{padding-top:16px!important}'),
    hero({ src: urlImagemPessoal('e04-proxima', ctx.tokenImagem), alt, href: href('hero'), largura: 600, altura: 372 }),
    linha(`
        ${h1(`${esc(d.nome)}, o ${esc(d.destaque.nome)} do seu ${esc(d.set)} subiu ${pct}% em <span style="white-space:nowrap;">7 dias.</span>`, '0 0 10px')}
        ${p(`${juntas} <span style="white-space:nowrap;color:#f0f0f0;font-weight:700;">${reais(d.valorNoSet)}</span>${sufixo}. Acompanhe o seu ${esc(d.set)} e veja, logo no topo, as cartas mais valiosas do set.`, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;')}`, '24px 32px 0', 'e04-pt'),
    linha(`
        ${btnRegua(esc(`Ver quanto vale o meu ${d.set}`), href('cta'))}
        ${p('A meta é liberada em todos os planos, inclusive no Grátis. Preços: menor valor do Mercado Brasileiro hoje.', 'margin:12px 0 0;font-size:14px;line-height:21px;color:#a3a4a6;')}`, '22px 32px 0'),
    linha(p(`Qual carta do ${esc(d.set)} você mais quer? É só responder este <span style="white-space:nowrap;">e-mail</span>: nós lemos todas as respostas.`, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;'), '32px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    assinatura: true,
    promocao: blocoPromocao('destaque', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E04: TemplateRegua<DadosE04> = {
  id: 'E04',
  nome: 'D3: sua Pokédex e a primeira meta',
  trilha: 'Ativação',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Rafael, 9 cartas no D1, 2 do 151.
  exemplo: {
    nome: 'Rafael',
    set: '151',
    tem: ['Mew ex', 'Omanyte'],
    valorNoSet: 194,
    destaque: { nome: 'Omanyte', pct: 61.6, preco: 160 },
    falta: { nome: 'Charizard ex' },
  },
  montar,
}
