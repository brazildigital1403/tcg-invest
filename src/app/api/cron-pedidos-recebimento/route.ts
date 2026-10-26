import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import {
  acaoRecebimento, acaoDevolucao, somarDias, fmtPrazo, DIAS_FECHAMENTO_AUTO, DIAS_AVISO_RECEBIMENTO, DIAS_RECLAMAR,
} from '@/lib/leilao-reclamacao'
import { sbServico, sino, carregarPedido, concluirDevolucao, emailSeguro, contato, nomeDaLoja } from '@/lib/reclamacaoServer'
import { emitirEtiquetaReversa, sincronizarEtiqueta, cancelarEtiqueta } from '@/lib/etiquetaReversaServer'
import { MAX_TENTATIVAS_ETIQUETA } from '@/lib/etiquetaReversa'
import { enviarLoteEmails, renderRecebimentoAvisoEmail, renderArrependimentoEmail, type EmailLoteItem } from '@/lib/email'

/**
 * GET /api/cron-pedidos-recebimento  (cron, 1x por hora basta)
 *
 * Protecao Bynx, SO pedidos de LEILAO (pedidos.leilao_id ou item com
 * leilao_id). Marketplace e produto nao sao tocados.
 *
 *   - enviado ha DIAS_FECHAMENTO_AUTO dias, sem confirmacao e SEM reclamacao aberta -> 'entregue'
 *     com recebido_automatico = true. O trigger da migration 20260928140000
 *     grava prazo_reclamacao_ate = entregue_em + DIAS_RECLAMAR dias.
 *   - enviado ha DIAS_AVISO_RECEBIMENTO dias, sem aviso ainda -> sino + e-mail "Confirme ou nos
 *     conte se houve problema" e marca aviso_recebimento_em.
 *   - DESISTENCIA (arrependimento, 20260928170000), regra em acaoDevolucao:
 *     nao postou ate postar_ate -> expira sem estorno (resolver improcedente,
 *     valor 0); entregue na loja e contestar_ate passou sem contestacao ->
 *     estorno integral (concluirDevolucao, Stripe antes do banco, chave
 *     'arrependimento-<rid>': o retry da proxima hora reaproveita o refund).
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
 * ★ FILTRO DE LEILAO NO BANCO, nao em memoria. Antes o lote de 100 vinha de
 *   TODOS os pedidos 'enviado' e o filtro de leilao era depois: 100 pedidos de
 *   marketplace parados ha mais de DIAS_AVISO_RECEBIMENTO dias ocupavam o lote inteiro para sempre
 *   e nenhum leilao era processado. Agora sao duas leituras ja filtradas
 *   (atalho pedidos.leilao_id, e pedido_itens!inner com leilao_id para o
 *   carrinho) e o candidato ja avisado que ainda nao fecha fica de fora.
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

// DECISAO DO DU: maxDuration. 30s com orcamento interno de 20s; mudar so com ele.
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

    const corteFechar = new Date(agora - DIAS_FECHAMENTO_AUTO * DIA_MS).toISOString()
    const COLS = 'id, numero, status, loja_id, vendedor_user_id, comprador_user_id, item_nome, leilao_id, enviado_em, reclamacao_aberta, aviso_recebimento_em'
    // Candidato = ainda nao avisado (>= DIAS_AVISO_RECEBIMENTO) OU ja no ponto de fechar (>= DIAS_FECHAMENTO_AUTO).
    const pendente = `aviso_recebimento_em.is.null,enviado_em.lte."${corteFechar}"`

    // Leilao pelo atalho (pedidos.leilao_id)...
    const qAtalho = sb
      .from('pedidos')
      .select(COLS)
      .eq('status', 'enviado')
      .eq('reclamacao_aberta', false)
      .not('leilao_id', 'is', null)
      .lte('enviado_em', corte)
      .or(pendente)
      .order('enviado_em', { ascending: true })
      .limit(LIMITE)
    // ...ou so pelo item (carrinho): inner join em pedido_itens com lote.
    const qItem = sb
      .from('pedidos')
      .select(`${COLS}, pedido_itens!inner(leilao_id)`)
      .eq('status', 'enviado')
      .eq('reclamacao_aberta', false)
      .is('leilao_id', null)
      .not('pedido_itens.leilao_id', 'is', null)
      .lte('enviado_em', corte)
      .or(pendente)
      .order('enviado_em', { ascending: true })
      .limit(LIMITE)
    const [rA, rI] = await Promise.all([qAtalho, qItem])
    if (rA.error) throw new Error(`pedidos (atalho): ${rA.error.message}`)
    if (rI.error) throw new Error(`pedidos (item): ${rI.error.message}`)
    const vistos = new Set<string>()
    const peds = ([...(rA.data || []), ...(rI.data || [])] as unknown as Ped[])
      .filter(p => (vistos.has(p.id) ? false : (vistos.add(p.id), true)))
      .sort((a, b) => String(a.enviado_em).localeCompare(String(b.enviado_em)))
      .slice(0, LIMITE)

    const plano = peds
      .map(p => ({ p, acao: acaoRecebimento({ ...p, ehLeilao: true }, agora) }))
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

    // ── Desistencias (arrependimento) ──
    // Poucas linhas (so abertas, indice parcial pedido_reclamacoes_devolucao_idx).
    let expiradas = 0
    let estornadas = 0
    let etiquetas = 0
    let rastreios = 0
    if (!semTempo()) {
      const { data: devs, error: dErr } = await sb
        .from('pedido_reclamacoes')
        .select('id, pedido_id, loja_id, vendedor_user_id, comprador_user_id, motivo, status, postar_ate, devolucao_postada_em, devolucao_entregue_em, contestar_ate, contestada_em, etiqueta_status, etiqueta_tentativas, updated_at')
        .eq('status', 'aguardando_devolucao')
        .eq('motivo', 'arrependimento')
        .order('created_at', { ascending: true })
        .limit(LIMITE)
      if (dErr) console.error('[cron-recebimento] desistencias:', dErr.message)
      for (const d of devs || []) {
        if (semTempo()) break
        // Etiqueta reversa (#500): repete a que nao saiu (teto de tentativas,
        // e so 5 min depois da ultima mexida para nao correr com a rota) e
        // sincroniza o rastreio das prontas (postado / entregue na loja).
        if (!dry && !d.devolucao_postada_em && (d.etiqueta_status === 'gerando' || d.etiqueta_status === 'falhou')
            && (d.etiqueta_tentativas ?? 0) < MAX_TENTATIVAS_ETIQUETA
            && agora - new Date(d.updated_at as string).getTime() > 5 * 60_000) {
          const r = await emitirEtiquetaReversa(sb, d.id as string)
          if (r.ok) etiquetas++
          continue
        }
        if (!dry && d.etiqueta_status === 'pronta' && !d.devolucao_entregue_em) {
          const s = await sincronizarEtiqueta(sb, d.id as string)
          if (s === 'postado' || s === 'entregue') rastreios++
          if (s !== 'nada') continue
        }
        const acao = acaoDevolucao(d, agora)
        if (!acao || dry) continue
        const pedido = await carregarPedido(sb, d.pedido_id as string)
        if (!pedido) continue
        const loja = await nomeLoja(d.loja_id as string)
        const base = { pedidoId: pedido.id, pedidoNumero: pedido.numero, itemNome: pedido.item_nome, lojaNome: loja, lojaId: d.loja_id as string }
        const lojista = (await nomeDaLoja(sb, d.loja_id as string)).owner || (d.vendedor_user_id as string)

        if (acao === 'expirar') {
          const { error: e } = await sb.rpc('pedido_reclamacao_resolver', {
            p_reclamacao: d.id, p_status: 'improcedente', p_decisao: 'improcedente', p_valor_cents: 0,
            p_refund: null, p_por: 'automatico', p_nota: 'A devolução não foi postada no prazo.',
          })
          if (e) { console.error(`[cron-recebimento] expirar desistencia ${pedido.numero}:`, e.message); continue }
          expiradas++
          // Etiqueta reversa nao usada: cancela no Melhor Envio para o valor
          // voltar a carteira da Bynx (#500). Falha so vai para o log.
          if (d.etiqueta_status === 'pronta') {
            await cancelarEtiqueta(sb, d.id as string, `Desistencia do pedido ${pedido.numero} expirou sem postagem`)
          }
          const prazo = fmtPrazo(d.postar_ate as string)
          await sino(sb, d.comprador_user_id as string, 'A desistência expirou',
            `A devolução do pedido #${pedido.numero} não foi postada até ${prazo}. A compra continua valendo.`, `/pedido/${pedido.id}`)
          await sino(sb, lojista, 'Desistência expirada',
            `O comprador não postou a devolução do pedido #${pedido.numero}. A venda continua valendo.`, `/minha-loja/${d.loja_id}/pedidos`)
          const cc = await contato(sb, d.comprador_user_id as string)
          if (cc.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cc.email, nome: cc.nome, papel: 'comprador', etapa: 'expirado', prazo }))
          continue
        }

        // estornar
        const r = await concluirDevolucao(sb, d.id as string, pedido, 'automatico')
        if (!r.ok) { console.error(`[cron-recebimento] estorno desistencia ${pedido.numero}: ${r.erro}`); continue }
        if (r.resultado === 'ja_resolvida') continue
        estornadas++
        await sino(sb, d.comprador_user_id as string, 'Devolução concluída',
          `A devolução do pedido #${pedido.numero} foi concluída e o valor foi estornado.`, `/pedido/${pedido.id}`)
        await sino(sb, lojista, 'Devolução concluída',
          `Sem contestação no prazo, o pedido #${pedido.numero} foi estornado ao comprador.`, `/minha-loja/${d.loja_id}/pedidos`)
        const cc = await contato(sb, d.comprador_user_id as string)
        if (cc.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cc.email, nome: cc.nome, papel: 'comprador', etapa: 'estornado', valorCents: r.valorCents }))
        const cl = await contato(sb, lojista)
        if (cl.email) await emailSeguro(renderArrependimentoEmail({ ...base, to: cl.email, nome: cl.nome, papel: 'loja', etapa: 'estornado' }))
      }
    }

    let emailsOk = 0
    if (emails.length) {
      const res = await enviarLoteEmails(emails)
      emailsOk = res.filter(r => r.ok).length
      if (emailsOk < emails.length) console.error(`[cron-recebimento] ${emails.length - emailsOk} e-mail(s) de aviso falharam`)
    }

    return NextResponse.json({ ok: true, candidatos: plano.length, fechados, avisados, emails: emailsOk, expiradas, estornadas, etiquetas, rastreios, ms: Date.now() - inicio })
  } catch (err) {
    console.error('[cron-recebimento] erro:', (err as Error)?.message)
    return NextResponse.json({ ok: false, error: 'Erro interno.' }, { status: 500 })
  }
}
