// Servidor do servico de bancada (restauracao / pre-grading). SO SERVIDOR:
// usa a service role, nunca importar em 'use client'.
//
// As tabelas servico_* nascem fechadas (F7): authenticated so le a propria
// solicitacao, e toda escrita passa por aqui, depois de conferir o dono e se a
// transicao de status e valida. As fotos vivem no bucket PRIVADO
// servico-midias; o cliente sobe direto por URL assinada (o arquivo nao passa
// pelo lambda de 4,5 MB) e depois confirma, e so entao a midia e registrada.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { requireAdmin } from '@/lib/admin-auth'
import {
  numeroServico, brl, SERVICOS, PRAZOS, GUIA_EMBALAGEM, linkRastreio,
  ESCALA, PILARES, CAMPOS_LAUDO, FOTOS_SAIDA, type FichaCondicao,
} from '@/lib/servicos'
import { sendServicoClienteEmail, sendServicoProntaEmail, SERVICO_PRONTA_DETALHE, type ServicoProntaItem } from '@/lib/email'

export const BUCKET_SERVICOS = 'servico-midias'
export const FOTO_MAX_BYTES = 10 * 1024 * 1024
export const FOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp']
export const SLOTS = ['frente', 'verso', 'rasante', 'cantos'] as const
export type Slot = (typeof SLOTS)[number]
export const SLOTS_OBRIGATORIOS: Slot[] = ['frente', 'verso']

export const TIPO_POR_SLOT: Record<Slot, string> = {
  frente: 'cliente_frente',
  verso: 'cliente_verso',
  rasante: 'cliente_extra',
  cantos: 'cliente_extra',
}

/** Termo de ciencia de risco vigente. Trocar a versao quando o texto mudar. */
export const TERMO_VERSAO_ATUAL = 'v1-2026-09'

export function numeroSolicitacao(n: number | string) {
  return numeroServico(Number(n))
}

export function erro(status: number, mensagem: string) {
  return NextResponse.json({ error: mensagem }, { status })
}

export function sbAdmin(): SupabaseClient {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('Supabase service role nao configurada')
  return sb
}

export async function usuarioDoToken(req: NextRequest): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: { user } } = await sb.auth.getUser(token)
  return user
}

export interface Solicitacao {
  id: string
  numero: number
  user_id: string
  servico: string
  status: string
}

/**
 * Carrega a solicitacao e confere quem pede. Dono sempre passa; admin passa
 * so onde `permitirAdmin` for true (leitura de midia).
 */
export async function carregarAutorizado(
  req: NextRequest,
  id: string,
  { permitirAdmin = false }: { permitirAdmin?: boolean } = {},
): Promise<{ ok: true; sol: Solicitacao; user: User | null; admin: boolean } | { ok: false; resposta: NextResponse }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, resposta: erro(404, 'Solicitação não encontrada') }

  const { data } = await sbAdmin()
    .from('servico_solicitacoes')
    .select('id, numero, user_id, servico, status')
    .eq('id', id)
    .limit(1)
  const sol = data?.[0] as Solicitacao | undefined
  if (!sol) return { ok: false, resposta: erro(404, 'Solicitação não encontrada') }

  const user = await usuarioDoToken(req)
  if (user && user.id === sol.user_id) return { ok: true, sol, user, admin: false }

  if (permitirAdmin && !(await requireAdmin(req))) return { ok: true, sol, user, admin: true }

  return { ok: false, resposta: erro(user ? 403 : 401, user ? 'Sem permissão' : 'Não autorizado') }
}

export async function registrarEvento(solicitacaoId: string, status: string, nota?: string) {
  const { error } = await sbAdmin().from('servico_eventos').insert({ solicitacao_id: solicitacaoId, status, nota: nota ?? null })
  if (error) console.error('[servicos] evento', status, error.message)
}

/** Caminho no bucket. Nunca usa nome vindo do cliente. */
export function caminhoFoto(solicitacaoId: string, itemId: string, slot: Slot, mime: string) {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp'
  return `${solicitacaoId}/${itemId}/${slot}-${crypto.randomUUID()}.${ext}`
}

export async function urlDeUpload(path: string) {
  const { data, error } = await sbAdmin().storage.from(BUCKET_SERVICOS).createSignedUploadUrl(path)
  if (error || !data) throw new Error(error?.message || 'sem url de upload')
  return { path: data.path, token: data.token }
}

// ── E-mails ao cliente (F11) ────────────────────────────────────────────────
// Um por transicao. Quem chama e a rota que ACABOU de fazer a transicao (o
// update filtra pelo status atual), entao cada e-mail sai uma vez. Falha de
// envio nunca derruba a rota: loga e segue.

export type EtapaEmail = 'recebido' | 'orcado' | 'recusado_bynx' | 'aceito' | 'liberado_envio' | 'cobrar_servico' | 'servico_pago' | 'recebida' | 'proposta' | 'pronta' | 'enviada'

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'
const reais = (c: number | null | undefined) => `R$ ${brl((c || 0) / 100)}`

/** Endereco de recebimento: so no servidor (env), nunca no repositorio publico. */
export function enderecoRecebimento(): string | null {
  const e = process.env.SERVICOS_ENDERECO?.trim()
  return e ? e.replace(/\\n/g, '\n') : null
}

// ── Pagamento por etapa (fatia 3) ───────────────────────────────────────────
// sinal    no aceite: seguro + frete de volta (a Bynx gasta com ou sem servico)
// servico  na aprovacao da proposta, antes da bancada: servico (+ expresso)
// integral pre-grading sozinho: tudo no aceite (nao tem proposta)
// Decisao do Du, 27/09/2026, seguindo o painel de pagamento.

export type EtapaPagamento = 'sinal' | 'servico' | 'integral'
export const ROTULO_ETAPA: Record<EtapaPagamento, string> = { sinal: 'Sinal', servico: 'Serviço', integral: 'Pagamento' }

/** Chave Pix de recebimento: so no servidor (env), como o endereco. */
export function pixRecebimento(): { chave: string; nome: string | null } | null {
  const chave = process.env.SERVICOS_PIX_CHAVE?.trim()
  return chave ? { chave, nome: process.env.SERVICOS_PIX_NOME?.trim() || null } : null
}

export interface LinhaPagamento {
  id: string; etapa: EtapaPagamento; valor_cents: number; metodo: string | null; pago_em: string | null
}

/** Quanto cobrar em cada etapa, a partir do orcamento. */
export function etapasDoOrcamento(sol: { servico: string; orcamento_cents: number | null; seguro_cents: number | null; frete_volta_cents: number | null; total_cents: number | null }) {
  if (sol.servico === 'pre_grading') {
    return (sol.total_cents || 0) > 0 ? [{ etapa: 'integral' as const, valor_cents: sol.total_cents! }] : []
  }
  const sinal = (sol.seguro_cents || 0) + (sol.frete_volta_cents || 0)
  const out: { etapa: EtapaPagamento; valor_cents: number }[] = []
  if (sinal > 0) out.push({ etapa: 'sinal', valor_cents: sinal })
  if ((sol.orcamento_cents || 0) > 0) out.push({ etapa: 'servico', valor_cents: sol.orcamento_cents! })
  return out
}

/**
 * Cria/atualiza as linhas de pagamento a partir do orcamento (chamado ao orcar e
 * ao reorcar). So mexe em etapa ainda NAO paga: o que ja foi pago nunca muda.
 */
export async function sincronizarPagamentos(solicitacaoId: string) {
  const sb = sbAdmin()
  const { data: sols } = await sb.from('servico_solicitacoes')
    .select('servico, orcamento_cents, seguro_cents, frete_volta_cents, total_cents').eq('id', solicitacaoId).limit(1)
  const sol = sols?.[0]
  if (!sol) return
  const alvo = etapasDoOrcamento(sol)
  const { data: atuais } = await sb.from('servico_pagamentos').select('id, etapa, pago_em').eq('solicitacao_id', solicitacaoId)
  for (const a of atuais || []) {
    if (!a.pago_em && !alvo.some(x => x.etapa === a.etapa)) await sb.from('servico_pagamentos').delete().eq('id', a.id).is('pago_em', null)
  }
  for (const x of alvo) {
    const existe = (atuais || []).find(a => a.etapa === x.etapa)
    if (!existe) await sb.from('servico_pagamentos').insert({ solicitacao_id: solicitacaoId, etapa: x.etapa, valor_cents: x.valor_cents })
    else if (!existe.pago_em) await sb.from('servico_pagamentos').update({ valor_cents: x.valor_cents }).eq('id', existe.id).is('pago_em', null)
  }
}

export async function pagamentosDoPedido(solicitacaoId: string): Promise<LinhaPagamento[]> {
  const { data } = await sbAdmin().from('servico_pagamentos')
    .select('id, etapa, valor_cents, metodo, pago_em').eq('solicitacao_id', solicitacaoId)
  const ordem: EtapaPagamento[] = ['integral', 'sinal', 'servico']
  return ((data || []) as LinhaPagamento[]).sort((a, b) => ordem.indexOf(a.etapa) - ordem.indexOf(b.etapa))
}

/** A etapa que o cliente deve pagar AGORA (ou null). */
export function etapaDevida(status: string, propostaAceita: boolean, linhas: LinhaPagamento[]): LinhaPagamento | null {
  const aberta = (e: EtapaPagamento) => linhas.find(l => l.etapa === e && !l.pago_em) || null
  if (status === 'aceito' || status === 'recebida') return aberta('integral') || aberta('sinal')
  if (status === 'proposta' && propostaAceita) return aberta('servico')
  return null
}

/** Etapa paga libera o envio da carta (endereco)? */
export function envioLiberado(linhas: LinhaPagamento[]) {
  if (!linhas.length) return true // pedido antigo, sem etapas: mantem o comportamento anterior
  const primeira = linhas.find(l => l.etapa === 'integral' || l.etapa === 'sinal')
  return !primeira || !!primeira.pago_em
}

/**
 * Confirma o pagamento de UMA etapa, so na transicao (pago_em is null). Quando
 * a ultima etapa fecha, grava o pago_em do pedido ("tudo pago"), que e o que a
 * trava do envio de volta le. Devolve false se a etapa ja estava paga.
 */
export async function confirmarPagamento(solicitacaoId: string, etapa: EtapaPagamento, metodo: 'pix_manual' | 'stripe', extra: Record<string, unknown> = {}) {
  const sb = sbAdmin()
  const agora = new Date().toISOString()
  const { data: marcou, error } = await sb.from('servico_pagamentos')
    .update({ metodo, pago_em: agora, ...extra })
    .eq('solicitacao_id', solicitacaoId).eq('etapa', etapa).is('pago_em', null).select('id')
  if (error) throw new Error(error.message)
  if (!marcou?.length) return { ok: false as const, tudoPago: false }
  const linhas = await pagamentosDoPedido(solicitacaoId)
  const tudoPago = linhas.length > 0 && linhas.every(l => l.pago_em)
  if (tudoPago) {
    await sb.from('servico_solicitacoes').update({ pago_em: agora, pagamento_metodo: metodo }).eq('id', solicitacaoId).is('pago_em', null)
  }
  return { ok: true as const, tudoPago }
}

function blocoPix(valor: number, numero: string) {
  const pix = pixRecebimento()
  return pix
    ? `Pix de ${reais(valor)}\nChave: ${pix.chave}${pix.nome ? `\nFavorecido: ${pix.nome}` : ''}\nNa descrição do Pix, escreva: ${numero}`
    : `Valor: ${reais(valor)}\nA chave Pix chega por e-mail ou WhatsApp. Na descrição do Pix, escreva: ${numero}`
}

export async function notificarCliente(solicitacaoId: string, etapa: EtapaEmail) {
  try {
    const sb = sbAdmin()
    const { data: sols } = await sb.from('servico_solicitacoes')
      .select('id, numero, user_id, servico, orcamento_cents, seguro_cents, frete_volta_cents, total_cents, orcamento_obs, rastreio_volta')
      .eq('id', solicitacaoId).limit(1)
    const sol = sols?.[0]
    if (!sol) return
    const [{ data: us }, { data: itens }] = await Promise.all([
      sb.from('users').select('name, email').eq('id', sol.user_id).limit(1),
      sb.from('servico_itens').select('nome, aceito, recusa_motivo, custodia').eq('solicitacao_id', solicitacaoId).order('created_at'),
    ])
    const u = us?.[0]
    if (!u?.email) return

    const numero = numeroServico(sol.numero)
    const servico = SERVICOS.find(x => x.id === sol.servico)?.nome || 'Serviço'
    const link = `${APP}/servico/${sol.id}`
    const cta = { rotulo: 'Ver o pedido', href: link }
    const aceitas = (itens || []).filter(i => i.aceito !== false)
    const recusadas = (itens || []).filter(i => i.aceito === false)
    const base = { to: u.email, nome: u.name }

    if (etapa === 'recebido') {
      await sendServicoClienteEmail({
        ...base, assunto: `Recebemos o seu pedido ${numero}`, selo: servico, titulo: `Pedido ${numero} recebido`,
        paragrafos: [
          `As fotos de ${(itens || []).length === 1 ? 'sua carta chegaram' : `suas ${(itens || []).length} cartas chegaram`}. Agora a Bynx analisa cada uma e monta o orçamento${PRAZOS.orcamento ? `, em até ${PRAZOS.orcamento}` : ''}.`,
          'Não envie a carta ainda. O endereço aparece depois que você aprovar o orçamento.',
        ],
        cta,
      })
    } else if (etapa === 'orcado') {
      await sendServicoClienteEmail({
        ...base, assunto: `Orçamento do pedido ${numero}`, selo: 'Orçamento pronto', titulo: `Seu orçamento: ${reais(sol.total_cents)}`,
        paragrafos: [
          `Analisamos as fotos. ${aceitas.length === 1 ? 'Uma carta pode' : `${aceitas.length} cartas podem`} ser tratada${aceitas.length === 1 ? '' : 's'}${recusadas.length ? `, e ${recusadas.length === 1 ? 'uma ficou' : `${recusadas.length} ficaram`} de fora (o motivo está no pedido)` : ''}.`,
          'Para seguir, abra o pedido, leia o termo e aprove. Você paga agora só o sinal (seguro e frete de volta); o serviço é cobrado depois que a carta chegar e você aprovar a proposta de tratamento.',
        ],
        linhas: [
          { rotulo: 'Serviço', valor: reais(sol.orcamento_cents) },
          ...(sol.seguro_cents ? [{ rotulo: 'Seguro', valor: reais(sol.seguro_cents) }] : []),
          ...(sol.frete_volta_cents ? [{ rotulo: 'Frete de volta', valor: reais(sol.frete_volta_cents) }] : []),
          { rotulo: 'Total', valor: reais(sol.total_cents) },
        ],
        destaque: sol.orcamento_obs || undefined,
        cta: { rotulo: 'Ver e aprovar o orçamento', href: link },
      })
    } else if (etapa === 'recusado_bynx') {
      await sendServicoClienteEmail({
        ...base, assunto: `Sobre o seu pedido ${numero}`, selo: servico, titulo: 'Desta vez a resposta é não',
        paragrafos: [
          'Analisamos as fotos com cuidado e nenhuma das cartas pode ser tratada sem uma intervenção que a tornaria ingraduável, como tinta, cola ou corte.',
          'Preferimos dizer isso agora, antes de você enviar qualquer coisa. O motivo de cada carta está no pedido.',
        ],
        cta,
      })
    } else if (etapa === 'aceito' || etapa === 'liberado_envio') {
      const linhas = await pagamentosDoPedido(solicitacaoId)
      const devida = etapa === 'aceito' ? etapaDevida('aceito', false, linhas) : null
      if (devida) {
        await sendServicoClienteEmail({
          ...base, assunto: `Orçamento aprovado: pedido ${numero}`, selo: 'Orçamento aprovado',
          titulo: devida.etapa === 'sinal' ? `Falta o sinal de ${reais(devida.valor_cents)}` : `Falta o pagamento de ${reais(devida.valor_cents)}`,
          paragrafos: [
            devida.etapa === 'sinal'
              ? 'O sinal cobre o seguro e o frete de volta da sua carta. O valor do serviço só é cobrado depois, quando você aprovar a proposta de tratamento.'
              : 'Assim que o pagamento cair, liberamos o endereço de envio.',
            'Depois do Pix, a Bynx confirma o pagamento e o endereço de envio aparece na página do pedido e no seu e-mail.',
          ],
          destaque: blocoPix(devida.valor_cents, numero),
          cta: { rotulo: 'Ver o pedido', href: link },
        })
        return
      }
      const endereco = enderecoRecebimento()
      await sendServicoClienteEmail({
        ...base, assunto: `Como enviar a carta do pedido ${numero}`, selo: etapa === 'liberado_envio' ? 'Pagamento confirmado' : 'Orçamento aprovado', titulo: 'Agora é só enviar',
        paragrafos: [
          endereco ? 'Envie para o endereço abaixo e escreva o número do pedido do lado de fora do pacote.' : 'O endereço de envio chega em seguida, por e-mail ou WhatsApp.',
          ...GUIA_EMBALAGEM,
          'A abertura do pacote é filmada na chegada.',
        ],
        destaque: endereco ? `${endereco}\nPedido ${numero}` : undefined,
        cta: { rotulo: 'Informar o rastreio', href: link },
      })
    } else if (etapa === 'cobrar_servico') {
      const linhas = await pagamentosDoPedido(solicitacaoId)
      const devida = linhas.find(l => l.etapa === 'servico' && !l.pago_em)
      if (!devida) return
      await sendServicoClienteEmail({
        ...base, assunto: `Pagamento do serviço: pedido ${numero}`, selo: 'Proposta aprovada', titulo: `Falta o serviço: ${reais(devida.valor_cents)}`,
        paragrafos: [
          'Recebemos a sua decisão sobre a proposta de tratamento.',
          'Com o pagamento do serviço, a carta vai para a bancada e o prazo começa a contar.',
        ],
        destaque: blocoPix(devida.valor_cents, numero),
        cta: { rotulo: 'Ver o pedido', href: link },
      })
    } else if (etapa === 'servico_pago') {
      await sendServicoClienteEmail({
        ...base, assunto: `Pagamento confirmado: pedido ${numero}`, selo: 'Pagamento confirmado', titulo: 'Sua carta vai para a bancada',
        paragrafos: [
          'O pagamento do serviço foi confirmado. A partir de agora a sua carta está na fila da bancada e o prazo começou a contar.',
          'Você acompanha cada etapa na página do pedido.',
        ],
        cta,
      })
    } else if (etapa === 'recebida') {
      await sendServicoClienteEmail({
        ...base, assunto: `Sua carta chegou: pedido ${numero}`, selo: 'Carta recebida', titulo: 'Sua carta chegou na bancada',
        paragrafos: [
          'O pacote foi aberto em vídeo e cada carta ganhou um número de custódia. Agora ela passa pela ficha de condição e pelas fotos de entrada, e em seguida você recebe a proposta de tratamento para aprovar.',
        ],
        linhas: aceitas.filter(i => i.custodia).map(i => ({ rotulo: i.nome, valor: i.custodia as string })),
        cta,
      })
    } else if (etapa === 'proposta') {
      await sendServicoClienteEmail({
        ...base, assunto: `Proposta de tratamento: pedido ${numero}`, selo: 'Sua aprovação', titulo: 'A proposta de tratamento está pronta',
        paragrafos: [
          'Registramos a condição de cada carta na chegada, com fotos de frente, verso, cantos e bordas.',
          'Para cada carta, a proposta mostra o que foi encontrado, o que fazer, o resultado esperado, o risco e a alternativa de não mexer. Você aprova ou recusa cada procedimento.',
          `Nada começa sem a sua decisão. O prazo${PRAZOS.padraoDiasUteis ? ` de ${PRAZOS.padraoDiasUteis} dias úteis` : ''} conta a partir dela.`,
        ],
        cta: { rotulo: 'Ver e decidir a proposta', href: link },
      })
    } else if (etapa === 'pronta') {
      await enviarEmailPronta(sb, solicitacaoId, { ...base, numero, servico, link })
    } else if (etapa === 'enviada') {
      await sendServicoClienteEmail({
        ...base, assunto: `Sua carta foi enviada: pedido ${numero}`, selo: 'A caminho', titulo: 'Sua carta está a caminho',
        paragrafos: ['A carta foi postada em embalagem lacrada, com valor declarado.'],
        linhas: sol.rastreio_volta ? [{ rotulo: 'Rastreio', valor: sol.rastreio_volta }] : undefined,
        cta: sol.rastreio_volta
          ? { rotulo: `Rastrear em ${linkRastreio(sol.rastreio_volta).onde}`, href: linkRastreio(sol.rastreio_volta).href }
          : cta,
      })
    }
  } catch (e) {
    console.error('[servicos] email cliente', etapa, e instanceof Error ? e.message : e)
  }
}

// ── E-mail "Carta pronta" ────────────────────────────────────────────────────
//
// Monta o e-mail ilustrado (antes e depois, galeria, condicao, procedimentos,
// laudo). As fotos saem do bucket PRIVADO por link assinado de longa duracao:
// e-mail fica na caixa por meses, e link de 10 min (o da pagina) morreria
// antes da pessoa abrir. Expirado, a imagem some e sobra o `alt`; as fotos
// continuam na pagina do pedido, com link novo a cada visita.

/** Validade dos links assinados das fotos do e-mail "pronta". */
export const VALIDADE_FOTOS_EMAIL_DIAS = 30

/**
 * O fluxo de pagamento ainda nao foi decidido. Enquanto for false, o e-mail
 * mostra "Ver o resultado completo" mesmo com pedido nao pago. Ligar quando a
 * pagina do pedido tiver o botao de pagar: dai o CTA vira "Pagar R$ X e
 * liberar o envio" (total_cents, so se pago_em for nulo).
 */
const PRONTA_COBRA_NO_EMAIL = false

const ROTULO_ESCALA = new Map<string, string>(ESCALA.map(e => [e.id, e.rotulo]))
const ORDEM_ESCALA = new Map<string, number>(ESCALA.map((e, i) => [e.id, i]))
const LAUDO_NO_EMAIL = ['faixa_nota', 'graduadora', 'centralizacao_frente', 'centralizacao_verso', 'proximo_passo'] as const

/**
 * Imagem publica do catalogo. `servico_itens.card_id` guarda o SLUG (o
 * formulario grava o slug), mas aceita o id tambem, igual a pagina /carta.
 * Consulta pontual pelos indices unicos (slug e pkey), nunca varredura.
 */
async function imagemDoCatalogo(sb: SupabaseClient, cardId: string | null): Promise<string | null> {
  if (!cardId) return null
  try {
    const pega = (r: { data: { image_large: string | null; image_small: string | null }[] | null }) =>
      r.data?.[0] ? r.data[0].image_large || r.data[0].image_small || null : null
    const porSlug = pega(await sb.from('pokemon_cards').select('image_large, image_small').eq('slug', cardId).limit(1))
    if (porSlug) return porSlug
    return pega(await sb.from('pokemon_cards').select('image_large, image_small').eq('id', cardId).limit(1))
  } catch {
    return null
  }
}

function condicaoDoItem(entrada: FichaCondicao | null, saida: FichaCondicao | null): ServicoProntaItem['condicao'] {
  if (!entrada && !saida) return []
  const linhas: NonNullable<ServicoProntaItem['condicao']> = []
  for (const lado of ['frente', 'verso'] as const) {
    for (const p of PILARES) {
      const a = entrada?.[lado]?.[p.id] || null
      const b = saida?.[lado]?.[p.id] || null
      if (!a && !b) continue
      linhas.push({
        lado: lado === 'frente' ? 'Frente' : 'Verso',
        pilar: p.rotulo,
        chegada: a ? ROTULO_ESCALA.get(a) || null : null,
        saida: b ? ROTULO_ESCALA.get(b) || null : null,
        melhorou: !!(a && b && (ORDEM_ESCALA.get(b) ?? 99) < (ORDEM_ESCALA.get(a) ?? 99)),
      })
    }
  }
  return linhas
}

async function enviarEmailPronta(
  sb: SupabaseClient,
  solicitacaoId: string,
  ctx: { to: string; nome?: string | null; numero: string; servico: string; link: string },
) {
  const [{ data: sols }, { data: itens }, { data: midias }, { data: procs }] = await Promise.all([
    sb.from('servico_solicitacoes').select('total_cents, pago_em').eq('id', solicitacaoId).limit(1),
    sb.from('servico_itens').select('id, nome, card_id, custodia, aceito, laudo, ficha_entrada, ficha_saida')
      .eq('solicitacao_id', solicitacaoId).order('created_at'),
    sb.from('servico_midias').select('item_id, tipo, posicao, path')
      .eq('solicitacao_id', solicitacaoId).in('tipo', ['entrada_difusa', 'saida_difusa', 'saida_canto']).order('created_at'),
    sb.from('servico_procedimentos').select('item_id, ordem, problema, procedimento')
      .eq('solicitacao_id', solicitacaoId).eq('decisao', 'aprovado').order('ordem'),
  ])
  const sol = sols?.[0]
  const aceitas = (itens || []).filter(i => i.aceito !== false)
  if (!aceitas.length) return
  const detalhe = aceitas.slice(0, SERVICO_PRONTA_DETALHE)

  // Ultima midia de cada slot (se o admin refez a foto, vale a mais nova).
  const midiaPor = new Map<string, string>()
  for (const m of midias || []) midiaPor.set(`${m.item_id}:${m.tipo}:${m.posicao || ''}`, m.path)

  // Galeria: protocolo de saida, sem a frente difusa (ela ja esta no depois).
  const slotsGaleria = FOTOS_SAIDA.filter(s => !(s.tipo === 'saida_difusa' && s.posicao === 'frente'))
  const plano = detalhe.map(it => {
    const antes = midiaPor.get(`${it.id}:entrada_difusa:frente`) || null
    const depois = midiaPor.get(`${it.id}:saida_difusa:frente`) || null
    const galeria = slotsGaleria
      .map(s => ({ path: midiaPor.get(`${it.id}:${s.tipo}:${s.posicao}`), legenda: s.rotulo }))
      .filter((g): g is { path: string; legenda: string } => !!g.path)
      .slice(0, 4)
    return { it, antes, depois, galeria }
  })

  // Um so pedido de assinatura para tudo o que vai no e-mail.
  const paths = plano.flatMap(x => [x.antes, x.depois, ...x.galeria.map(g => g.path)]).filter((v): v is string => !!v)
  const urlPor = new Map<string, string>()
  if (paths.length) {
    const { data: assinadas, error } = await sb.storage.from(BUCKET_SERVICOS)
      .createSignedUrls(paths, VALIDADE_FOTOS_EMAIL_DIAS * 24 * 60 * 60)
    if (error) console.error('[servicos] email pronta: assinatura', error.message)
    for (const a of assinadas || []) if (a.path && a.signedUrl) urlPor.set(a.path, a.signedUrl)
  }
  const url = (path: string | null) => (path ? urlPor.get(path) || null : null)

  const imagens = await Promise.all(detalhe.map(it => imagemDoCatalogo(sb, it.card_id)))

  const itensEmail: ServicoProntaItem[] = aceitas.map((it, i) => {
    const x = plano[i]
    if (!x) return { nome: it.nome, custodia: it.custodia }
    const laudo = (it.laudo && typeof it.laudo === 'object' ? it.laudo : {}) as Record<string, unknown>
    return {
      nome: it.nome,
      custodia: it.custodia,
      imagemCatalogo: imagens[i],
      fotoAntes: url(x.antes),
      fotoDepois: url(x.depois),
      galeria: x.galeria.map(g => ({ url: url(g.path), legenda: g.legenda }))
        .filter((g): g is { url: string; legenda: string } => !!g.url),
      condicao: condicaoDoItem(it.ficha_entrada as FichaCondicao | null, it.ficha_saida as FichaCondicao | null),
      procedimentos: (procs || []).filter(pr => pr.item_id === it.id)
        .map(pr => ({ feito: pr.procedimento, motivo: pr.problema })),
      laudo: LAUDO_NO_EMAIL
        .map(k => ({ rotulo: CAMPOS_LAUDO.find(c => c.k === k)?.rotulo || k, valor: typeof laudo[k] === 'string' ? (laudo[k] as string).trim() : '' }))
        .filter(l => l.valor),
    }
  })

  const cobrar = PRONTA_COBRA_NO_EMAIL && sol && !sol.pago_em && (sol.total_cents || 0) > 0
  await sendServicoProntaEmail({
    to: ctx.to,
    nome: ctx.nome,
    numero: ctx.numero,
    servico: ctx.servico,
    pedidoUrl: ctx.link,
    valorAPagarCents: cobrar ? sol.total_cents : null,
    validadeFotosDias: VALIDADE_FOTOS_EMAIL_DIAS,
    itens: itensEmail,
  })
}

/** Aviso interno ao admin (ex.: cliente decidiu a proposta). Nunca derruba a rota. */
export async function notificarAdmin(solicitacaoId: string, titulo: string, paragrafos: string[]) {
  const destino = process.env.ADMIN_EMAIL
  if (!destino) return
  try {
    const { data } = await sbAdmin().from('servico_solicitacoes').select('id, numero').eq('id', solicitacaoId).limit(1)
    const sol = data?.[0]
    if (!sol) return
    await sendServicoClienteEmail({
      to: destino, nome: 'Edu', assunto: `[Serviços] ${titulo} ${numeroServico(sol.numero)}`, selo: 'Painel',
      titulo: `${titulo} ${numeroServico(sol.numero)}`, paragrafos,
      cta: { rotulo: 'Abrir no painel', href: `${APP}/admin/servicos/${sol.id}` },
    })
  } catch (e) {
    console.error('[servicos] email admin', e instanceof Error ? e.message : e)
  }
}
