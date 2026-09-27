// Monta o dado do relatorio de bancada a partir do banco. SO SERVIDOR.
//
// Quem chama ja conferiu que e admin. Aqui: status permitido, trava de saida
// recalculada sem olhar status, e o objeto limpo (RelatorioDados), sem nenhum
// dado de contato, id da Stripe, path do bucket ou nota crua de evento.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  numeroServico, OBJETIVOS, ROTULO_GRADUADORA, PRECOS, STATUS_SERVICO, STATUS_RELATORIO,
  lerFaixaNota, lerGraduadora, textoDoTermo, type FichaCondicao, type ServicoId,
} from '@/lib/servicos'
import { BUCKET_SERVICOS, pagamentosDoPedido, pendencias } from '@/lib/servicosServer'
import {
  NOTA_MARCO, NOTA_PRONTA, TITULO_TERMO,
  type RelatorioDados, type RelatorioFoto, type RelatorioLaudo, type RelatorioPagamento, type RelatorioProcedimento,
} from '@/lib/servicosRelatorio'

/** Tipos de midia que o papel mostra (so foto; video e PDF nao). */
const TIPOS_FOTO = [
  'entrada_difusa', 'entrada_canto', 'entrada_borda', 'entrada_angulo', 'entrada_rasante',
  'saida_difusa', 'saida_canto', 'saida_rasante',
]
const MIMES_FOTO = ['image/jpeg', 'image/png', 'image/webp']
/** Validade da URL assinada das fotos: a mesma do painel. O botao "Recarregar fotos" refaz o GET. */
const VALIDADE_FOTOS_S = 600

type Resultado =
  | { ok: true; dados: RelatorioDados }
  | { ok: false; status: number; erro: string; pendencias?: string[] }

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export async function montarRelatorio(sb: SupabaseClient, id: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, status: 404, erro: 'Solicitação não encontrada' }

  const { data: sols } = await sb.from('servico_solicitacoes')
    .select('id, numero, user_id, servico, prazo, status, objetivo, objetivo_outro, graduadora_alvo, valor_declarado_cents, orcamento_cents, seguro_cents, frete_volta_cents, total_cents, pagamento_metodo, pago_em, rastreio_ida, termo_versao, termo_aceito_em, proposta_termo_versao, proposta_enviada_em, proposta_aceita_em, created_at')
    .eq('id', id).limit(1)
  const sol = sols?.[0]
  if (!sol) return { ok: false, status: 404, erro: 'Solicitação não encontrada' }
  if (!(STATUS_RELATORIO as readonly string[]).includes(sol.status)) {
    return { ok: false, status: 409, erro: `O relatório sai a partir de "Pronta". Status atual: ${STATUS_SERVICO[sol.status] || sol.status}.` }
  }

  // Trava propria, recalculada sem olhar status (o GET do pedido so calcula a
  // de saida em bancada/descanso). Devolvida sem servico nao tem saida nem
  // laudo no papel, entao a trava de saida nao se aplica.
  if (sol.status !== 'devolvida_sem_servico') {
    const faltas = await pendencias(sb, id, sol.servico, 'saida')
    if (faltas.length) return { ok: false, status: 409, erro: 'Pendências de saída', pendencias: faltas }
  }

  const [{ data: us }, { data: itens }, { data: eventos }, { data: midias }, { data: procs }, pags] = await Promise.all([
    sb.from('users').select('name').eq('id', sol.user_id).limit(1),
    sb.from('servico_itens')
      .select('id, nome, custodia, aceito, recusa_motivo, queixas, obs, valor_declarado_cents, laudo, ficha_entrada, ficha_entrada_em, ficha_saida, ficha_saida_em')
      .eq('solicitacao_id', id).order('created_at'),
    sb.from('servico_eventos').select('status, created_at').eq('solicitacao_id', id).order('created_at'),
    sb.from('servico_midias').select('item_id, tipo, posicao, path, mime, created_at').eq('solicitacao_id', id).order('created_at'),
    sb.from('servico_procedimentos')
      .select('item_id, ordem, problema, procedimento, objetivo, resultado_esperado, risco, risco_descricao, alternativa, decisao, decidido_em')
      .eq('solicitacao_id', id).order('ordem'),
    pagamentosDoPedido(id),
  ])

  // Foto mais recente de cada slot (a refeita vale). Chave: item + tipo + posicao.
  const ultima = new Map<string, { item_id: string; tipo: string; posicao: string; path: string; created_at: string }>()
  for (const m of midias || []) {
    if (!m.item_id || !TIPOS_FOTO.includes(m.tipo) || !MIMES_FOTO.includes(m.mime)) continue
    ultima.set(`${m.item_id}:${m.tipo}:${m.posicao || ''}`, { item_id: m.item_id, tipo: m.tipo, posicao: m.posicao || '', path: m.path, created_at: m.created_at })
  }
  const paths = [...ultima.values()].map(m => m.path)
  const urlPor = new Map<string, string>()
  if (paths.length) {
    const { data: assinadas, error } = await sb.storage.from(BUCKET_SERVICOS).createSignedUrls(paths, VALIDADE_FOTOS_S)
    if (error) console.error('[servicos] relatorio: assinatura', error.message)
    for (const a of assinadas || []) if (a.path && a.signedUrl) urlPor.set(a.path, a.signedUrl)
  }

  // Marcos: primeira ocorrencia de cada status da lista branca.
  const marcos: Record<string, string> = {}
  for (const e of eventos || []) if (e.status in NOTA_MARCO && !marcos[e.status]) marcos[e.status] = e.created_at
  const linhaDoTempo = Object.entries(marcos)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([status, em]) => ({ status, rotulo: STATUS_SERVICO[status] || status, nota: status === 'pronta' ? NOTA_PRONTA[sol.servico] || NOTA_MARCO.pronta : NOTA_MARCO[status], em }))

  let descanso: RelatorioDados['descanso'] = null
  if (marcos.descansando) {
    const fim = (eventos || []).find(e => e.status === 'pronta' && e.created_at > marcos.descansando)?.created_at
    if (fim) descanso = { de: marcos.descansando, ate: fim, dias: Math.round((Date.parse(fim) - Date.parse(marcos.descansando)) / 86_400_000) }
  }

  const pagamentos: RelatorioPagamento[] = pags.length
    ? pags.map(p => ({
      etapa: p.etapa,
      valorCents: p.valor_cents,
      metodo: p.metodo === 'stripe' ? 'Cartão' : p.metodo ? 'Pix' : null,
      pagoEm: p.pago_em,
      reembolsadoCents: p.reembolsado_cents || 0,
      reembolsadoEm: p.reembolsado_em || null,
    }))
    // Pedido antigo, sem etapas: um pagamento so, pelo total.
    : sol.total_cents
      ? [{
        etapa: 'unico' as const, valorCents: sol.total_cents,
        metodo: sol.pagamento_metodo === 'stripe' ? 'Cartão' as const : sol.pagamento_metodo ? 'Pix' as const : null,
        pagoEm: sol.pago_em, reembolsadoCents: 0, reembolsadoEm: null,
      }]
      : []

  const termos: RelatorioDados['termos'] = []
  if (sol.termo_versao) {
    termos.push({ titulo: TITULO_TERMO[sol.termo_versao] || 'Termo aceito no orçamento', versao: sol.termo_versao, aceitoEm: sol.termo_aceito_em, itens: textoDoTermo(sol.termo_versao) })
  }
  if (sol.proposta_termo_versao && sol.servico !== 'pre_grading') {
    termos.push({ titulo: TITULO_TERMO[sol.proposta_termo_versao] || 'Termo da proposta de tratamento', versao: sol.proposta_termo_versao, aceitoEm: sol.proposta_aceita_em, itens: textoDoTermo(sol.proposta_termo_versao) })
  }

  const seguroPct = PRECOS?.seguroPct != null && sol.seguro_cents != null
    && sol.seguro_cents === Math.round(sol.valor_declarado_cents * PRECOS.seguroPct / 100) ? PRECOS.seguroPct : null
  const video = (midias || []).find(m => m.tipo === 'video_abertura')
  const objetivo = sol.objetivo === 'outro' ? texto(sol.objetivo_outro) : OBJETIVOS.find(o => o.id === sol.objetivo)?.rotulo || null

  const cartas = (itens || []).map(it => {
    const laudoBruto = (it.laudo && typeof it.laudo === 'object' ? it.laudo : null) as Record<string, unknown> | null
    const laudo: RelatorioLaudo | null = laudoBruto ? {
      centralizacaoFrente: texto(laudoBruto.centralizacao_frente),
      centralizacaoVerso: texto(laudoBruto.centralizacao_verso),
      cantos: texto(laudoBruto.cantos),
      bordas: texto(laudoBruto.bordas),
      superficie: texto(laudoBruto.superficie),
      faixa: lerFaixaNota(laudoBruto.faixa_nota),
      graduadora: lerGraduadora(laudoBruto.graduadora),
      proximoPasso: texto(laudoBruto.proximo_passo),
      caderno: texto(laudoBruto.caderno),
    } : null
    const fotos: RelatorioFoto[] = [...ultima.values()].filter(m => m.item_id === it.id)
      .map(m => ({ tipo: m.tipo, posicao: m.posicao, url: urlPor.get(m.path) || null, em: m.created_at }))
    const procedimentos: RelatorioProcedimento[] = (procs || []).filter(p => p.item_id === it.id).map(p => ({
      ordem: p.ordem, problema: p.problema, procedimento: p.procedimento, objetivo: p.objetivo,
      resultadoEsperado: p.resultado_esperado, risco: p.risco, riscoDescricao: p.risco_descricao,
      alternativa: p.alternativa, decisao: p.decisao, decididoEm: p.decidido_em,
    }))
    return {
      nome: it.nome,
      custodia: it.custodia,
      aceito: it.aceito !== false,
      recusaMotivo: it.aceito === false ? texto(it.recusa_motivo) : null,
      queixas: Array.isArray(it.queixas) ? it.queixas : [],
      obs: texto(it.obs),
      valorDeclaradoCents: it.valor_declarado_cents,
      fichaEntrada: (it.ficha_entrada || null) as FichaCondicao | null,
      fichaEntradaEm: it.ficha_entrada_em,
      fichaSaida: (it.ficha_saida || null) as FichaCondicao | null,
      fichaSaidaEm: it.ficha_saida_em,
      procedimentos,
      laudo,
      laudoAnexo: (midias || []).some(m => m.item_id === it.id && m.tipo === 'laudo'),
      fotos,
    }
  })

  const recusou = (procs || []).some(p => p.decisao === 'recusado')

  return {
    ok: true,
    dados: {
      emitidoEm: new Date().toISOString(),
      pedido: {
        numero: numeroServico(sol.numero),
        servico: sol.servico as ServicoId,
        status: sol.status,
        prazo: sol.prazo === 'expresso' ? 'expresso' : 'padrao',
        objetivo,
        graduadoraAlvo: sol.graduadora_alvo ? ROTULO_GRADUADORA[sol.graduadora_alvo] || sol.graduadora_alvo : null,
        cliente: texto(us?.[0]?.name) || 'Cliente Bynx',
        criadoEm: sol.created_at,
        valorDeclaradoCents: sol.valor_declarado_cents,
        orcamentoCents: sol.orcamento_cents,
        seguroCents: sol.seguro_cents,
        seguroPct,
        freteVoltaCents: sol.frete_volta_cents,
        totalCents: sol.total_cents,
        rastreioIda: texto(sol.rastreio_ida),
        videoAberturaEm: video?.created_at || null,
        propostaEnviadaEm: sol.proposta_enviada_em,
        propostaAceitaEm: sol.proposta_aceita_em,
        servicoConferido: recusou && !!marcos.cobranca_servico,
      },
      termos,
      pagamentos,
      linhaDoTempo,
      marcos,
      descanso,
      cartas,
    },
  }
}
