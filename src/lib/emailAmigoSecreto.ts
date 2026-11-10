// src/lib/emailAmigoSecreto.ts
//
// E-mail "Sorteio realizado" do Amigo Secreto do Poke Creators Club (direcao
// "A pokebola abriu", topo V1, aprovado pelo Du em 09/11/2026). Sai para cada
// participante logo depois do clique em Sortear no /admin/amigo-secreto.
//
// Regras: NUNCA diz quem a pessoa tirou (surpresa e dado pessoal: o endereco
// so aparece na sala, com login). Sem emoji, sem contracao, sem data e horario
// do sorteio (o Du decide na hora com o time). Imagens em JPG no bynx.gg:
// webp nao abre no Outlook.

import { escapeHtml } from './email'

export const FROM_CLUB = 'Poké Creators Club | Bynx <noreply@bynx.gg>'
const SALA = 'https://bynx.gg/pokecreatorsclub/amigo-secreto/sala?utm_source=email&utm_medium=transacional&utm_campaign=amigo-secreto-sorteio'

const TZ = 'America/Sao_Paulo'
const ddmm = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(new Date(iso))
const hora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(':00', 'h').replace(':', 'h')

export type EdicaoSorteio = { postar_ate: string; revelacao_em: string; teto_cents: number }

/** Primeiro nome para a saudacao; sem nome, o @. */
export function primeiroNome(nome: string | null | undefined, instagram: string | null | undefined): string {
  const n = (nome || '').trim().split(/\s+/)[0]
  if (n) return n.charAt(0).toUpperCase() + n.slice(1)
  return instagram ? `@${instagram}` : 'Treinador'
}

export function renderEmailSorteio(args: { nome: string | null; instagram: string | null; edicao: EdicaoSorteio }): { subject: string; html: string } {
  const nomeTxt = primeiroNome(args.nome, args.instagram)
  const nome = escapeHtml(nomeTxt)
  const insta = args.instagram && args.nome ? ` <span style="color:#6b6c6f;">(@${escapeHtml(args.instagram)})</span>` : ''
  const rev = new Date(args.edicao.revelacao_em)
  const fimVideos = new Date(rev.getTime() + 6 * 86_400_000).toISOString()
  const teto = `R$ ${Math.round(args.edicao.teto_cents / 100)}`
  const chegarAte = ddmm(args.edicao.postar_ate)
  const revelacao = `${ddmm(args.edicao.revelacao_em)} · ${hora(args.edicao.revelacao_em)}`
  const videos = `${ddmm(args.edicao.revelacao_em).slice(0, 2)} a ${ddmm(fimVideos)}`
  const preheader = 'Tem um nome esperando por você na sala. Só você pode ver.'
  const sala = SALA
  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>A pokébola abriu</title>
<!--[if mso]><style>td,th,a,p,span,div{font-family:Arial,sans-serif!important}</style><![endif]-->
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=swap');
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0!important;padding:0!important;background-color:#080a0f!important;-webkit-text-size-adjust:100%}
table{mso-table-lspace:0;mso-table-rspace:0}
img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media only screen and (max-width:480px){
  .casca{padding:0!important}
  .cartao{border-radius:0!important;border-left:0!important;border-right:0!important}
  .px{padding-left:16px!important;padding-right:16px!important}
  .topo{padding:16px 16px 12px!important}
  .h1{font-size:28px!important;line-height:34px!important}
  .btn{display:block!important;padding-left:0!important;padding-right:0!important}
  .bola{padding-top:24px!important}
  .carta-td{display:block!important;width:100%!important;text-align:center!important;padding:0 0 16px!important}
  .carta-txt{display:block!important;width:100%!important;padding:0!important;text-align:center!important}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#080a0f;" bgcolor="#080a0f">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#080a0f;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#080a0f" style="background-color:#080a0f;">
<tr><td align="center" class="casca" style="padding:24px 12px;background-color:#080a0f;" bgcolor="#080a0f">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- Cabecalho: logo do Club + rotulo -->
  <tr><td class="topo" style="padding:0 4px 16px;background-color:#080a0f;" bgcolor="#080a0f">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="left" valign="middle">
        <a href="https://bynx.gg/pokecreatorsclub" target="_blank" style="text-decoration:none;">
          <img src="https://bynx.gg/amigo-secreto/poke-creators-club.png" width="120" height="60" alt="Poké Creators Club" style="display:block;width:120px;height:60px;border:0;color:#f0f0f0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:16px;font-weight:800;"/>
        </a>
      </td>
      <td align="right" valign="middle" style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;font-weight:700;letter-spacing:0.08em;color:#6b6c6f;text-transform:uppercase;">Amigo Secreto</td>
    </tr></table>
  </td></tr>

  <!-- Cartao -->
  <tr><td class="cartao" bgcolor="#0d0f14" style="background-color:#0d0f14;border:1px solid #202227;border-radius:18px;overflow:hidden;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td height="4" bgcolor="#f59e0b" style="height:4px;font-size:1px;line-height:4px;background-color:#f59e0b;background-image:linear-gradient(90deg,#f59e0b,#ef4444);">&nbsp;</td>
    </tr></table>

    <!-- HERO: imagem do topo (PNG 1200x600, mostrada a 600). Sem imagem: fundo escuro + texto alternativo. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" bgcolor="#0d0f14" style="padding:0;background-color:#0d0f14;"><img src="https://bynx.gg/emails/amigo-secreto/pokebola-aberta.jpg" width="600" alt="Uma pokébola entreaberta com luz dourada saindo de dentro" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;color:#c9cacc;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;text-align:center;"></td></tr>
    </table>

    <!-- Titulo + botao: antes de qualquer outra coisa -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" align="center" style="padding:20px 40px 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
        <h1 class="h1" style="margin:0 0 14px;font-size:34px;line-height:40px;font-weight:800;color:#f0f0f0;">O sorteio aconteceu.<br><span style="color:#f59e0b;">Seu amigo secreto já foi escolhido.</span></h1>
        <p style="margin:0 0 24px;font-size:17px;line-height:26px;color:#c9cacc;">${nome}${insta}, a pokébola abriu. Tem um nome lá dentro, e só você pode ver.</p>
      </td></tr>
      <tr><td class="px" align="center" style="padding:0 40px 10px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${sala}" style="height:56px;v-text-anchor:middle;width:300px;" arcsize="22%" stroke="f" fillcolor="#f59e0b">
        <w:anchorlock/><center style="color:#0a0a0a;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">Quero saber meu amigo</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a href="${sala}" target="_blank" class="btn" style="display:inline-block;padding:0 40px;height:56px;line-height:56px;min-width:220px;text-align:center;border-radius:12px;background-color:#f59e0b;background-image:linear-gradient(135deg,#f59e0b,#ef4444);color:#0a0a0a;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:800;text-decoration:none;box-shadow:0 8px 28px rgba(245,158,11,.35);">Quero saber meu amigo</a>
        <!--<![endif]-->
      </td></tr>
      <tr><td class="px" align="center" style="padding:6px 40px 32px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#8b8c90;">
        Entre com a sua conta da Bynx. Na sala estão o nome, o endereço, o @ e o desejo de quem você tirou.
      </td></tr>
    </table>

    <!-- divisor -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td class="px" style="padding:0 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#202227" style="height:1px;background-color:#202227;font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td>
    </tr></table>

    <!-- TRILHA DA JORNADA: 4 paradas -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:28px 40px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
        <p style="margin:0 0 4px;font-size:13px;line-height:20px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#6b6c6f;">A trilha da jornada</p>
        <p style="margin:0 0 20px;font-size:20px;line-height:28px;font-weight:800;color:#f0f0f0;">Quatro paradas até a revelação.</p>
      </td></tr>
      <tr><td class="px" style="padding:0 40px 8px;">

        <!-- parada 1 (atual) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" valign="top" align="center" style="width:36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="28" height="28" align="center" bgcolor="#f59e0b" style="width:28px;height:28px;border-radius:28px;background-color:#f59e0b;background-image:linear-gradient(135deg,#f59e0b,#ef4444);font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:28px;font-weight:800;color:#0a0a0a;">1</td></tr></table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="2" height="64" bgcolor="#f59e0b" style="width:2px;height:64px;background-color:#f59e0b;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
          </td>
          <td valign="top" style="padding:2px 0 18px 14px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:18px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#f59e0b;">Hoje · você está aqui</p>
            <p style="margin:2px 0 4px;font-size:17px;line-height:24px;font-weight:800;color:#f0f0f0;">A pokébola abriu</p>
            <p style="margin:0;font-size:15px;line-height:22px;color:#a1a2a4;">Descubra quem você tirou e escolha o presente. Até <b style="color:#f0f0f0;">${teto}</b>, frete à parte.</p>
          </td>
        </tr></table>

        <!-- parada 2 -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" valign="top" align="center" style="width:36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="24" height="24" align="center" bgcolor="#0d0f14" style="width:24px;height:24px;border:2px solid #f59e0b;border-radius:28px;background-color:#0d0f14;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:24px;font-weight:800;color:#f59e0b;">2</td></tr></table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="2" height="64" bgcolor="#3a3c41" style="width:2px;height:64px;background-color:#3a3c41;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
          </td>
          <td valign="top" style="padding:2px 0 18px 14px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:18px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#a1a2a4;">Até ${chegarAte}</p>
            <p style="margin:2px 0 4px;font-size:17px;line-height:24px;font-weight:800;color:#f0f0f0;">O presente chega</p>
            <p style="margin:0;font-size:15px;line-height:22px;color:#a1a2a4;">Despache com folga. O pacote precisa estar na mão do seu amigo até ${chegarAte}.</p>
          </td>
        </tr></table>

        <!-- parada 3 -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" valign="top" align="center" style="width:36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="24" height="24" align="center" bgcolor="#0d0f14" style="width:24px;height:24px;border:2px solid #f59e0b;border-radius:28px;background-color:#0d0f14;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:24px;font-weight:800;color:#f59e0b;">3</td></tr></table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="2" height="64" bgcolor="#3a3c41" style="width:2px;height:64px;background-color:#3a3c41;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
          </td>
          <td valign="top" style="padding:2px 0 18px 14px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:18px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#a1a2a4;">${revelacao}</p>
            <p style="margin:2px 0 4px;font-size:17px;line-height:24px;font-weight:800;color:#f0f0f0;">A revelação</p>
            <p style="margin:0;font-size:15px;line-height:22px;color:#a1a2a4;">Se os dois aceitarem, todo mundo descobre quem tirou quem.</p>
          </td>
        </tr></table>

        <!-- parada 4 -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="36" valign="top" align="center" style="width:36px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="24" height="24" align="center" bgcolor="#0d0f14" style="width:24px;height:24px;border:2px solid #f59e0b;border-radius:28px;background-color:#0d0f14;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:24px;font-weight:800;color:#f59e0b;">4</td></tr></table>
          </td>
          <td valign="top" style="padding:2px 0 8px 14px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
            <p style="margin:0;font-size:12px;line-height:18px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#a1a2a4;">${videos}</p>
            <p style="margin:2px 0 4px;font-size:17px;line-height:24px;font-weight:800;color:#f0f0f0;">Vídeos e collabs</p>
            <p style="margin:0;font-size:15px;line-height:22px;color:#a1a2a4;">Abra o presente com a câmera ligada e faça collab com quem tirou você.</p>
          </td>
        </tr></table>

      </td></tr>
    </table>

    <!-- REGRAS DE TREINADOR -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:20px 40px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#12151b" style="background-color:#12151b;border:1px solid #202227;border-radius:14px;">
          <tr><td style="padding:20px 22px 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 12px;font-size:13px;line-height:20px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#f59e0b;">Regras de treinador</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#c9cacc;"><b style="color:#f0f0f0;">Guarde segredo.</b> Pode contar que tirou alguém. Nunca quem.</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#c9cacc;"><b style="color:#f0f0f0;">Despachou?</b> Poste o código de rastreio na sala.</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:22px;color:#c9cacc;"><b style="color:#f0f0f0;">Chegou?</b> Avise na sala quando receber o seu.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>

    <!-- RECOMPENSA: carta do Club + convite ao print -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="px" style="padding:20px 40px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="carta-td" width="160" valign="middle" style="width:160px;padding-right:22px;">
            <img src="https://bynx.gg/emails/amigo-secreto/carta-amigo-secreto.jpg" width="160" height="240" alt="Carta do Amigo Secreto do Poké Creators Club" style="display:inline-block;width:160px;height:240px;border:0;border-radius:10px;color:#a1a2a4;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:14px;"/>
          </td>
          <td class="carta-txt" valign="middle" style="font-family:'DM Sans',Arial,Helvetica,sans-serif;">
            <p style="margin:0 0 8px;font-size:20px;line-height:28px;font-weight:800;color:#f0f0f0;">Printou? Pode postar.</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#a1a2a4;">Mostre a carta nos stories e marque o Club. A turma inteira está abrindo a mesma pokébola agora.</p>
            <p style="margin:0;font-size:15px;line-height:22px;"><a href="${sala}" target="_blank" style="color:#f59e0b;font-weight:800;text-decoration:underline;">Abrir a sala</a></p>
          </td>
        </tr></table>
      </td></tr>
    </table>

  </td></tr>

  <!-- Rodape -->
  <tr><td class="px" align="center" style="padding:28px 24px 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;background-color:#080a0f;" bgcolor="#080a0f">
    <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#6b6c6f;">Você recebeu este e-mail porque participa do Amigo Secreto do Poké Creators Club na Bynx.</p>
    <p style="margin:0;"><a href="https://bynx.gg" target="_blank" style="text-decoration:none;display:inline-block;color:#a1a2a4;font-size:14px;font-weight:800;">Bynx</a></p>
  </td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
  return { subject: `A pokébola abriu, ${nomeTxt.replace(/[\r\n]+/g, ' ')} — Bynx.gg`, html }
}
