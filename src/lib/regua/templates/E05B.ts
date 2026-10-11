/**
 * E05B · D6: fim do teste, para quem tem 0 cartas (Ativacao). Mockup aprovado:
 * _Regua/mockups/E05B-fim-do-trial-zero-cartas/email.html (v3, 11/10/2026).
 *
 * Gatilho: o mesmo do E05 (trial acaba em 12h a 36h, uma vez por pessoa), com a
 * colecao em 0 cartas. Antes, esse caso caia no aviso antigo (sendTrialExpiring7Email,
 * assunto com emoji); agora sai o E05B. Categoria 'colecao', mesma janela de
 * dedup do E05 (E05, E05B e trial-expiring1 em 10 dias).
 *
 * O E05 principal mostra a carta que subiu e o valor da colecao; com 0 cartas
 * nada disso existe. O gancho vira o que a pessoa ainda pode fazer de graca
 * ate amanha: as fotos do Scan IA que sobram, cada uma lendo ate 8 cartas.
 * Nenhuma frase diz que a colecao esta vazia nem que ela nao usou o Scan.
 *
 * ARTE (FIXA, igual para todos): `e05b/hero.jpg` (600x230), 8 cartas reais na
 * mesa sob o visor do Scan IA; o unico texto na arte e o chip "SCAN IA · 1 FOTO".
 * O painel de resultado ("8 cartas lidas em 1 foto") e HTML vivo, com uma tela
 * de EXEMPLO igual para todos (CARTAS_EXEMPLO): 2 precos nomeados + a soma das 8.
 * Nao e dado da pessoa; envelhece aqui no template, nao na imagem.
 * Icone do quadro "Scan IA pausa": o mesmo arquivo do E05 (`e05/icone-scan.png`).
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { FONT, attr, esc, estiloCelular, hero, linha, link, p, plural, reais } from './blocos-a'

const CAMPANHA = 'e05b'
const CARTAS_POR_FOTO = 8
/** Fotos de Scan IA do teste (COTA_TRIAL do motor). */
const FOTOS_DO_TESTE = 10

/**
 * Tela de exemplo do painel (menor preco do Mercado Brasileiro em 07/10/2026):
 * 8 cartas lidas em uma foto, 2 nomeadas, soma das 8. Igual para todo mundo.
 */
const CARTAS_EXEMPLO = {
  total: 8,
  nomeadas: [
    { nome: 'Giratina V', preco: 1299.9 },
    { nome: 'Blastoise', preco: 289.9 },
  ],
  soma: 2187.6,
}

export type DadosE05B = {
  /** Primeiro nome; '' abre o H1 sem nome. */
  nome: string
  /** Fim do teste em "dd/mm" (motivo do rodape). */
  fimTeste: string
  /** Hora do fim do teste amanha, ex.: "14h". */
  horaFim: string
  /** Dia do teste no envio (rotulo do cabecalho). */
  diaTeste: number
  /** Fotos do Scan IA que ainda sobram das 10 do teste (0 = todas usadas). */
  fotosLivres: number
  /** Plano Plus: scans por mes e preco mensal. */
  plus: { scans: number; preco: number }
}

function montar(d: DadosE05B, ctx: CtxRegua) {
  const n = Math.max(0, Math.min(FOTOS_DO_TESTE, Math.floor(d.fotosLivres)))
  const todas = n === FOTOS_DO_TESTE
  const cartas = n * CARTAS_POR_FOTO
  const forte = (html: string) => `<b style="color:#f0f0f0;">${html}</b>`

  // Assunto sem nome: o gancho ocupa os 40 primeiros caracteres do corte do Gmail.
  const assunto = n > 0
    ? `${plural(n, 'foto', 'fotos')} do Scan IA de graça até amanhã, ${d.horaFim}`
    : `Seu teste do Pro acaba amanhã, às ${d.horaFim}`
  const preheader = n > 0
    ? `Nada é apagado: cada foto lê até ${CARTAS_POR_FOTO} cartas e mostra o preço de cada uma, na hora.`
    : 'Nada é apagado: a Pokédex mostra o preço de cada carta, em todos os planos.'

  const hrefScan = (c: string) => link('/minha-colecao?scan=1', CAMPANHA, c)
  const hrefPokedex = link('/pokedex', CAMPANHA, 'pokedex')
  const titulo = `${d.nome ? `${esc(d.nome)}, seu` : 'Seu'} teste acaba amanhã, às&nbsp;${esc(d.horaFim)}.`

  // Paragrafo do H1, botao e frase do que o toque da, conforme as fotos que sobram.
  let abertura: string
  let cta: string
  let hrefCta: string
  let toque: string
  if (todas) {
    abertura = `Até lá, o Scan IA segue liberado: ${forte(`${n} fotos`)}, cada uma lendo ${forte(`até ${CARTAS_POR_FOTO}&nbsp;cartas`)}.`
    cta = 'Ver o preço de cada carta'
    hrefCta = hrefScan('cta')
    toque = `As ${n} fotos leem ${forte(`até ${cartas}&nbsp;cartas`)}, de graça. Cada uma entra na sua coleção já com o preço do dia, e o preço segue atualizando.`
  } else if (n > 0) {
    const restam = n === 1 ? 'a foto que resta' : `as ${n} fotos que restam`
    abertura = `Até lá, o Scan IA segue liberado: ${forte(restam)} ${n === 1 ? 'lê' : 'leem'} ${forte(`até ${CARTAS_POR_FOTO}&nbsp;cartas`)} cada.`
    cta = 'Ver o preço de cada carta'
    hrefCta = hrefScan('cta')
    toque = `${n === 1 ? 'A foto que resta lê' : `As ${n} fotos que restam leem`} ${forte(`até ${cartas}&nbsp;cartas`)}, de graça. Cada uma entra na sua coleção já com o preço do dia, e o preço segue atualizando.`
  } else {
    abertura = `As ${FOTOS_DO_TESTE} fotos do Scan IA do teste já foram usadas. Até lá, a Pokédex segue mostrando ${forte('o preço de cada carta')}, em todos os planos.`
    cta = 'Ver o preço na Pokédex'
    hrefCta = hrefPokedex
    toque = `Cada carta marcada como ${forte('Já tenho')} entra na sua coleção já com o preço do dia, e o preço segue atualizando.`
  }

  const celulaExemplo = (c: { nome: string; preco: number }, i: number) =>
    `<td width="50%"${i === 0 ? ' class="painel-cel"' : ''} valign="top" style="width:50%;padding:${i === 0 ? '4px 12px 4px 0' : '4px 0'};${FONT}">
              <div style="font-size:15px;line-height:22px;color:#a3a4a6;">${esc(c.nome)}</div>
              <div style="font-size:17px;line-height:24px;font-weight:800;color:#f0f0f0;white-space:nowrap;">${reais(c.preco)}</div>
            </td>`

  // Painel do resultado, em HTML vivo e largura total (aparece mesmo com imagem bloqueada).
  const painel = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;">
      <tr><td class="painel" bgcolor="#191b20" style="padding:18px 32px 16px;background-color:#191b20;border-top:1px solid #202227;border-bottom:1px solid #202227;${FONT}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding:0;${FONT}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding:0 12px;height:34px;line-height:30px;border:2px solid #22c55e;border-radius:999px;background-color:#123221;color:#22c55e;${FONT}font-size:15px;font-weight:800;letter-spacing:0.02em;white-space:nowrap;" bgcolor="#123221">${CARTAS_EXEMPLO.total} cartas lidas em 1 foto</td>
            </tr></table>
          </td>
          <td align="right" valign="middle" style="padding:0 0 0 8px;${FONT}font-size:14px;line-height:20px;color:#a3a4a6;white-space:nowrap;">Exemplo de uma foto</td>
        </tr></table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
          <tr>
            ${CARTAS_EXEMPLO.nomeadas.map(celulaExemplo).join('\n            ')}
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
          <tr>
            <td valign="middle" style="padding:12px 12px 0 0;border-top:1px solid #202227;${FONT}font-size:16px;line-height:24px;color:#a3a4a6;">Mais ${CARTAS_EXEMPLO.total - CARTAS_EXEMPLO.nomeadas.length} cartas. ${forte(`As ${CARTAS_EXEMPLO.total} somam`)}</td>
            <td align="right" valign="middle" style="padding:12px 0 0;border-top:1px solid #202227;${FONT}font-size:20px;line-height:24px;font-weight:800;color:#22c55e;white-space:nowrap;">${reais(CARTAS_EXEMPLO.soma)}</td>
          </tr>
        </table>
      </td></tr>
    </table>`

  const conteudo = [
    estiloCelular('.h1{font-size:26px!important;line-height:32px!important}.e05b-titulo{padding-top:22px!important}.painel{padding:16px 16px 14px!important}.painel-cel{padding-right:8px!important}.linha{padding-left:14px!important;padding-right:14px!important}'),
    hero({
      src: urlArte('e05b', 'hero.jpg'),
      alt: `Tela de exemplo: ${CARTAS_EXEMPLO.total} cartas espalhadas na mesa, lidas pelo Scan IA em uma foto só.`,
      href: n > 0 ? hrefScan('hero') : link('/pokedex', CAMPANHA, 'hero'),
      largura: 600,
      altura: 230,
    }),
    painel,
    linha(`
        <h1 class="h1" style="margin:0 0 14px;font-size:32px;line-height:38px;font-weight:800;letter-spacing:-0.02em;color:#f0f0f0;">${titulo}</h1>
        ${p(abertura, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;')}`, '26px 32px 0', 'e05b-titulo'),
    linha(btnRegua(esc(cta), hrefCta), '22px 32px 0'),
    linha(p(`Sem carta por perto? Veja quanto valem Charizard, Blastoise e Pikachu <a href="${attr(hrefPokedex)}" target="_blank" style="color:#f0f0f0;text-decoration:underline;font-weight:700;">na Pokédex</a> e marque ${forte('Já tenho')} nas suas.`, 'margin:0;font-size:15px;line-height:23px;color:#a3a4a6;'), '16px 32px 0'),
    linha(p(`${toque} Depois das ${forte(`${esc(d.horaFim)} de amanhã`)}, cada carta nova entra digitada, uma por&nbsp;uma.`, 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;'), '28px 32px 0'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">
          <tr><td class="linha" style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="48" valign="top" style="width:48px;"><img src="${attr(urlArte('e05', 'icone-scan.png'))}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;background-color:#191b20;"/></td>
              <td valign="middle" style="padding-left:14px;${FONT}font-size:16px;line-height:24px;color:#a3a4a6;">${forte('No plano Grátis, o Scan IA pausa.')} Para seguir por foto, o Plus tem ${d.plus.scans} scans por mês, por <span style="white-space:nowrap;">${reais(d.plus.preco)}</span>.</td>
            </tr></table>
          </td></tr>
        </table>`, '24px 32px 0'),
    linha(p('Ficou com dúvida? É só responder este <span style="white-space:nowrap;">e-mail</span>, que a gente lê cada resposta.', 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;'), '24px 32px 0'),
  ].join('\n')

  // Meia linha do que fica no Gratis, depois do logo da assinatura (sem P.S., sem link).
  const meiaLinha = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;"><tr>
          <td style="border-top:1px solid #202227;padding-top:16px;${FONT}font-size:15px;line-height:23px;color:#a3a4a6;">Nada é apagado no Grátis: tudo o que entrar até amanhã fica com você, com as pastas e o preço de cada&nbsp;carta.</td>
        </tr></table>`

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: `Teste do Pro · dia ${d.diaTeste}`,
    assinatura: true,
    psDepoisDoLogo: meiaLinha,
    motivo: `Você recebe porque criou sua conta na Bynx e está no teste do Pro até ${d.fimTeste}. Este é o único aviso sobre o fim do teste.`,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E05B: TemplateRegua<DadosE05B> = {
  id: 'E05B',
  nome: 'D6: fim do teste (0 cartas)',
  trilha: 'Ativação',
  categoria: 'colecao',
  // Sem persona (teste do Pro no D6, 0 cartas): nenhuma persona canonica e cadastro sem carta.
  exemplo: {
    nome: '',
    fimTeste: '12/10',
    horaFim: '14h',
    diaTeste: 6,
    fotosLivres: 10,
    plus: { scans: 100, preco: 14.9 },
  },
  montar,
}

/** Exemplos extras da previa: sobraram poucas fotos, e nenhuma (caminho da Pokedex). */
export const EXEMPLOS_EXTRAS: Record<string, DadosE05B> = {
  'poucas-fotos': { ...E05B.exemplo, nome: 'Ana', fotosLivres: 3 },
  'sem-foto': { ...E05B.exemplo, nome: 'Ana', fotosLivres: 0 },
}
