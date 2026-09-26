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
import { numeroServico, brl, SERVICOS, PRAZOS, GUIA_EMBALAGEM, linkRastreio } from '@/lib/servicos'
import { sendServicoClienteEmail } from '@/lib/email'

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

export type EtapaEmail = 'recebido' | 'orcado' | 'recusado_bynx' | 'aceito' | 'recebida' | 'pronta' | 'enviada'

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://bynx.gg'
const reais = (c: number | null | undefined) => `R$ ${brl((c || 0) / 100)}`

/** Endereco de recebimento: so no servidor (env), nunca no repositorio publico. */
export function enderecoRecebimento(): string | null {
  const e = process.env.SERVICOS_ENDERECO?.trim()
  return e ? e.replace(/\\n/g, '\n') : null
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
          'Para seguir, abra o pedido, leia o termo e aprove. Só então aparece o endereço de envio.',
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
    } else if (etapa === 'aceito') {
      const endereco = enderecoRecebimento()
      await sendServicoClienteEmail({
        ...base, assunto: `Como enviar a carta do pedido ${numero}`, selo: 'Orçamento aprovado', titulo: 'Agora é só enviar',
        paragrafos: [
          endereco ? 'Envie para o endereço abaixo e escreva o número do pedido do lado de fora do pacote.' : 'O endereço de envio chega em seguida, por e-mail ou WhatsApp.',
          ...GUIA_EMBALAGEM,
          'A abertura do pacote é filmada na chegada.',
        ],
        destaque: endereco ? `${endereco}\nPedido ${numero}` : undefined,
        cta: { rotulo: 'Informar o rastreio', href: link },
      })
    } else if (etapa === 'recebida') {
      await sendServicoClienteEmail({
        ...base, assunto: `Sua carta chegou: pedido ${numero}`, selo: 'Carta recebida', titulo: 'Sua carta chegou na bancada',
        paragrafos: [
          'O pacote foi aberto em vídeo e cada carta ganhou um número de custódia. As fotos de entrada ficam no pedido.',
        ],
        linhas: aceitas.filter(i => i.custodia).map(i => ({ rotulo: i.nome, valor: i.custodia as string })),
        cta,
      })
    } else if (etapa === 'pronta') {
      await sendServicoClienteEmail({
        ...base, assunto: `Sua carta está pronta: pedido ${numero}`, selo: 'Pronta', titulo: 'Trabalho concluído',
        paragrafos: [
          'A carta saiu da bancada. As fotos de saída, na mesma luz da entrada, e o laudo estão no pedido.',
          'Ela segue para a embalagem e o envio. Você recebe o rastreio assim que for postada.',
        ],
        cta,
      })
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
