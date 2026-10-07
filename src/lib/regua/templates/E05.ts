/**
 * E05 · D6: seu teste acaba amanha, as 14h (Ativacao). Mockup aprovado:
 * _Regua/mockups/E05-fim-do-trial/email.html.
 *
 * Gatilho: 1 dia antes do fim do trial, uma vez por pessoa. Substitui os 2
 * e-mails do cron-trial-emails (D5 e D7). So faz sentido com 1+ foto livre.
 *
 * ARTE
 * - Hero = IMAGEM PESSOAL (rota de ImageResponse), tipo `e05-trial`, 600x260
 *   (render 2x = 1200x520, JPG). Desenho de referencia:
 *   mockups/E05-fim-do-trial/assets/hero.html. A rota desenha:
 *   - a esquerda, em leque, a carta da pessoa que mais subiu desde que entrou
 *     (imagem da carta, na frente, levemente girada) com 2 cartas dela atras;
 *     embaixo, a etiqueta com borda verde "triangulo 78,8%" / "desde que entrou";
 *   - a direita, FIXO: a pilha de cartas presa por elastico sob o visor do Scan
 *     IA (cantoneiras ambar, pilula "SCAN IA"). Pode ser um PNG de fundo da rota.
 *   O numero da etiqueta tambem esta em texto vivo no paragrafo.
 * - Icone do quadro "Scan IA pausa" `e05/icone-scan.png` (48x48) = FIXO.
 */
import { btnRegua, blocoPromocao, layoutRegua } from '@/lib/email'
import { urlArte, urlImagemPessoal, type CtxRegua, type TemplateRegua } from '@/lib/regua/comum'
import { FONT, esc, h1, hero, linha, link, num, p, plural, reais } from './blocos-a'

const CAMPANHA = 'e05'
const CARTAS_POR_FOTO = 8

export type DadosE05 = {
  nome: string
  /** Hora do fim do teste amanha, ex.: "14h". */
  horaFim: string
  /** Dia do teste no envio (rotulo do cabecalho). */
  diaTeste: number
  fotosRestantes: number
  totalCartas: number
  valorColecao: number
  /** Variacao da colecao em 7 dias, em %, ex.: 4.45 */
  pct7d: number
  /** A carta que mais subiu desde que entrou por foto. */
  destaque: { nome: string; precoEntrada: number; precoAgora: number; pct: number }
  /** Plano Plus: scans por mes e preco mensal. */
  plus: { scans: number; preco: number }
}

function montar(d: DadosE05, ctx: CtxRegua) {
  const n = d.fotosRestantes
  const fotos = n === 1 ? 'A foto que resta' : `As ${n} fotos que restam`
  const le = n === 1 ? 'lê' : 'leem'
  const assunto = `${d.nome}, seu teste do Pro acaba amanhã, às ${d.horaFim}`
  const preheader = `${fotos} ${le} até ${n * CARTAS_POR_FOTO} cartas. Depois das ${d.horaFim} de amanhã, cada carta nova entra digitada.`
  const cta = n === 1 ? 'Usar a foto que resta' : `Usar as ${n} fotos que restam`

  const sobe = d.pct7d >= 0
  const variacao = `<b style="color:${sobe ? '#22c55e' : '#ef4444'};white-space:nowrap;">${num(d.pct7d, 2)}% ${sobe ? 'a mais' : 'a menos'}</b>`
  const de = d.destaque

  const conteudo = [
    hero({
      src: urlImagemPessoal('e05-trial', ctx.tokenImagem),
      alt: `A sua ${de.nome}, que subiu ${num(de.pct)}% desde que entrou na coleção. Ao lado, uma pilha de cartas presa por um elástico, sob o visor do Scan IA.`,
      href: link('/minha-colecao', CAMPANHA, 'hero'),
      largura: 600,
      altura: 260,
    }),
    linha(`
        ${h1(`${esc(d.nome)}, seu teste acaba amanhã, às&nbsp;${esc(d.horaFim)}.`, '0 0 10px')}
        ${p(`A ${esc(de.nome)} entrou por foto, valendo <span style="white-space:nowrap;">${reais(de.precoEntrada)}</span>. Hoje vale <b style="color:#f0f0f0;white-space:nowrap;">${reais(de.precoAgora)}</b>, e as suas ${plural(d.totalCartas, 'carta', 'cartas')} somam <b style="color:#f0f0f0;white-space:nowrap;">${reais(d.valorColecao)}</b>, ${variacao} que há 7&nbsp;dias.`)}`, '24px 32px 0'),
    linha(btnRegua(esc(cta), link('/minha-colecao?scan=1', CAMPANHA, 'cta')), '18px 32px 0'),
    linha(p(`${fotos} ${le} <b style="color:#f0f0f0;">até ${n * CARTAS_POR_FOTO}&nbsp;cartas</b>. Carta que fica na gaveta não entra nesse valor, e depois das <b style="color:#f0f0f0;">${esc(d.horaFim)} de amanhã</b> cada carta nova entra digitada, uma por&nbsp;uma.`), '20px 32px 0'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#191b20" style="background-color:#191b20;border:1px solid #202227;border-radius:16px;">
          <tr><td style="padding:16px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
              <td width="48" valign="top" style="width:48px;"><img src="${esc(urlArte('e05', 'icone-scan.png'))}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;background-color:#191b20;"/></td>
              <td valign="middle" style="padding-left:14px;${FONT}font-size:16px;line-height:23px;color:#a3a4a6;"><b style="color:#f0f0f0;">No plano Grátis, o Scan IA pausa.</b> Para seguir por foto, o Plus tem ${d.plus.scans} scans por mês, por <span style="white-space:nowrap;">${reais(d.plus.preco)}</span>.</td>
            </tr></table>
          </td></tr>
        </table>`, '24px 32px 0'),
    linha(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-top:1px solid #202227;padding-top:16px;${FONT}font-size:14px;line-height:21px;color:#a3a4a6;">No Grátis, ficam com você as ${plural(d.totalCartas, 'carta', 'cartas')}, as pastas e o preço de cada&nbsp;uma.</td>
        </tr></table>`, '20px 32px 0'),
    linha(p('Ficou com dúvida? É só responder este e-mail, que a gente lê cada resposta.', 'margin:0;font-size:16px;line-height:25px;color:#a3a4a6;'), '16px 32px 0'),
  ].join('\n')

  const html = layoutRegua({
    conteudo,
    campanha: CAMPANHA,
    categoria: 'colecao',
    links: ctx.links,
    preheader,
    rotulo: `Teste do Pro · dia ${d.diaTeste}`,
    assinatura: true,
    promocao: blocoPromocao('dupla', ctx.promocoes),
  })
  return { assunto, preheader, html }
}

export const E05: TemplateRegua<DadosE05> = {
  id: 'E05',
  nome: 'D6: seu teste acaba amanhã',
  trilha: 'Ativação',
  categoria: 'colecao',
  // PERSONA DE EXEMPLO (direcao/PERSONAS.md): Rafael no D6, 14 cartas, R$ 1.669,28.
  exemplo: {
    nome: 'Rafael',
    horaFim: '14h',
    diaTeste: 6,
    fotosRestantes: 2,
    totalCartas: 14,
    valorColecao: 1669.28,
    pct7d: 4.45,
    destaque: { nome: 'Durant ex', precoEntrada: 69.9, precoAgora: 125, pct: 78.8 },
    plus: { scans: 100, preco: 14.9 },
  },
  montar,
}
