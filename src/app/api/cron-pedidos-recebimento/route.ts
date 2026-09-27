import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import {
  acaoRecebimento, somarDias, fmtPrazo, DIAS_FECHAMENTO_AUTO, DIAS_AVISO_RECEBIMENTO, DIAS_RECLAMAR,
} from '@/lib/leilao-reclamacao'
import { sbServico, sino } from '@/lib/reclamacaoServer'
import { enviarLoteEmails, renderRecebimentoAvisoEmail, type EmailLoteItem } from '@/lib/email'

/**
 * GET /api/cron-pedidos-recebimento  (cron, 1x por hora basta)
 *
 * Protecao Bynx, SO pedidos de LEILAO (pedidos.leilao_id ou item com
 * leilao_id). Marketplace e produto nao sao tocados.
 *
 *   - enviado ha 21 dias, sem confirmacao e SEM reclamacao aberta -> 'entregue'
 *     com recebido_automatico = true. O trigger da migration 20260928140000
 *     grava prazo_reclamacao_ate = entregue_em + 7 dias.
 *   - enviado ha 14 dias, sem aviso ainda -> sino + e-mail "Confirme ou nos
 *     conte se houve problema" e marca aviso_recebimento_em.
 *
 * IDEMPOTENTE: cada update filtra pelo estado de origem (compare-and-set):
 *   fechar -> .eq('status','enviado').eq('reclamacao_aberta', false). Reclamacao
 *             aberta entre a leitura e o update (a RPC trava a linha do pedido)
 *             faz o update pegar 0 linhas: o pedido fica aberto.
 *   avisar -> .is('aviso_recebimento_em', null): marca ANTES de enviar. Duas
 *             execucoes juntas nao mandam dois avisos; se o envio falhar, o
 *             aviso nao se repete (sino gravado ja cobre).
 * LOTE de 100 pedidos por execucao, mais antigos primeiro; para de processar
 * aos ~20s (o que sobrar fica para a proxima hora).
 *
 * `?dry=1`: so le e devolve o plano, sem gravar nem enviar.
 * Auth: Bearer ${CRON_SECRET}, comparado em tempo constante.
 *
 * ── COMO REGISTRAR O CRON (decisao do Du; NAO registrado aqui) ─────────────
 * Depois de aplicar 20260928140000_pedido_reclamacoes.sql e ligar
 * NEXT_PUBLIC_LEILAO_ATIVO, em vercel.json:
 *
 *     { "path": "/api/cron-pedidos-recebimento", "schedule": "17 * * * *" }
 *
 * (minuto 17 de cada hora, fora do pico dos outros crons). A Vercel manda o
 * Authorization: Bearer do CRON_SECRET sozinha. Rollback: remover a entrada --
 * nada fica pela metade, o proximo ciclo so nao acontece.
 */

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const ORCAMENTO_MS = 20_000
const LIMITE = 100
const DIA_MS = 24 * 60 * 60 * 1000

function segredoConfere(recebido: string | null, segredo: string): boolean {
  if (!recebido) return false
  const a = createHash('sha256').update(recebido).digest()
  const b = createHash('sha256').update(`Bearer ${segredo}`).digest()
  return timingSafeEqual(a, b)
}

type Ped = {
  id: string; numero: number; status: string; loja_id: string; vendedor_user_id: string; comprador_user_id: string
  item_nome: string; leilao_id: string | null; enviado_em: string | null; reclamacao_aberta: boolean; aviso_recebimento_em: string | null
}

export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || !segredoConfere(req.headers.get('authorization'), segredo)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!LEILAO_ATIVO) return NextResponse.json({ ok: true, desligado: true })

  const inicio = Date.now()
  const semTempo = () => Date.now() - inicio > ORCAMENTO_MS
  const dry = req.nextUrl.searchParams.get('dry') === '1'

  try {
    const sb = sbServico()
    const agora = Date.now()
    const corte = new Date(agora - DIAS_AVISO_RECEBIMENTO * DIA_MS).toISOString()

    const { data, error } = await sb
      .from('pedidos')
      .select('id, numero, status, loja_id, vendedor_user_id, comprador_user_id, item_nome, leilao_id, enviado_em, reclamacao_aberta, aviso_recebimento_em')
      .eq('status', 'enviado')
      .eq('reclamacao_aberta', false)
      .lte('enviado_em', corte)
      .order('enviado_em', { ascending: true })
      .limit(LIMITE)
    if (error) throw new Error(`pedidos: ${error.message}`)
    const peds = (data || []) as Ped[]

    // Leilao pelo atalho ou pelo item (carrinho).
    const semAtalho = peds.filter(p => !p.leilao_id).map(p => p.id)
    const comItem = new Set<string>()
    if (semAtalho.length) {
      const { data: itens } = await sb.from('pedido_itens').select('pedido_id').in('pedido_id', semAtalho).not('leilao_id', 'is', null)
      for (const i of itens || []) comItem.add(i.pedido_id as string)
    }

    const plano = peds
      .map(p => ({ p, acao: acaoRecebimento({ ...p, ehLeilao: !!p.leilao_id || comItem.has(p.id) }, agora) }))
      .filter((x): x is { p: Ped; acao: 'fechar' | 'avisar' } => x.acao !== null)

    if (dry) {
      return NextResponse.json({ ok: true, dry: true, plano: plano.map(x => ({ pedido: x.p.numero, acao: x.acao })) })
    }

    let fechados = 0
    let avisados = 0
    const emails: EmailLoteItem[] = []
    const lojas = new Map<string, string>()
    const nomeLoja = async (id: string) => {
      if (!lojas.has(id)) {
        const { data: l } = await sb.from('lojas').select('nome').eq('id', id).limit(1)
        lojas.set(id, (l?.[0]?.nome as string) || 'a loja')
      }
      return lojas.get(id)!
    }

    for (const { p, acao } of plano) {
      if (semTempo()) break
      const agoraIso = new Date().toISOString()

      if (acao === 'fechar') {
        const { data: mexeu, error: e } = await sb
          .from('pedidos')
          .update({ status: 'entregue', entregue_em: agoraIso, recebido_automatico: true, updated_at: agoraIso })
          .eq('id', p.id)
          .eq('status', 'enviado')
          .eq('reclamacao_aberta', false)
          .select('id')
        if (e) { console.error(`[cron-recebimento] fechar ${p.numero}:`, e.message); continue }
        if (!mexeu?.length) continue
        fechados++
        const prazo = fmtPrazo(somarDias(agoraIso, DIAS_RECLAMAR))
        await sino(sb, p.comprador_user_id, 'Pedido marcado como entregue',
          `Passaram ${DIAS_FECHAMENTO_AUTO} dias desde o envio do pedido #${p.numero}. Se houve algum problema, conte até ${prazo}.`, `/pedido/${p.id}`)
        await sino(sb, p.vendedor_user_id, 'Pedido concluído',
          `O pedido #${p.numero} foi marcado como entregue ${DIAS_FECHAMENTO_AUTO} dias depois do envio.`, `/minha-loja/${p.loja_id}/pedidos`)
        continue
      }

      // avisar
      const { data: marcou, error: e } = await sb
        .from('pedidos')
        .update({ aviso_recebimento_em: agoraIso })
        .eq('id', p.id)
        .eq('status', 'enviado')
        .is('aviso_recebimento_em', null)
        .select('id')
      if (e) { console.error(`[cron-recebimento] avisar ${p.numero}:`, e.message); continue }
      if (!marcou?.length) continue
      avisados++
      const fecha = fmtPrazo(somarDias(p.enviado_em!, DIAS_FECHAMENTO_AUTO))
      await sino(sb, p.comprador_user_id, 'Seu pedido chegou?',
        `Confirme o recebimento do pedido #${p.numero} ou nos conte se houve problema.`, `/pedido/${p.id}`)
      const { data: u } = await sb.from('users').select('email, name').eq('id', p.comprador_user_id).limit(1)
      if (u?.[0]?.email) {
        const r = renderRecebimentoAvisoEmail({
          to: u[0].email as string, nome: (u[0].name as string) || null, pedidoId: p.id, pedidoNumero: p.numero,
          itemNome: p.item_nome, lojaNome: await nomeLoja(p.loja_id), lojaId: p.loja_id, fechaEm: fecha,
        })
        emails.push({ ...r, chave: `recebimento-aviso-${p.id}` } as EmailLoteItem)
      }
    }

    let emailsOk = 0
    if (emails.length) {
      const res = await enviarLoteEmails(emails)
      emailsOk = res.filter(r => r.ok).length
      if (emailsOk < emails.length) console.error(`[cron-recebimento] ${emails.length - emailsOk} e-mail(s) de aviso falharam`)
    }

    return NextResponse.json({ ok: true, candidatos: plano.length, fechados, avisados, emails: emailsOk, ms: Date.now() - inicio })
  } catch (err) {
    console.error('[cron-recebimento] erro:', (err as Error)?.message)
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 })
  }
}
