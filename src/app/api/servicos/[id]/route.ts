// GET /api/servicos/[id] -- o pedido visto pelo DONO (pagina /servico/[id]).
//
// Tudo que ele precisa acompanhar: orcamento, cartas (com motivo de recusa,
// custodia e laudo), linha do tempo e midias com link assinado de 10 min.
// O endereco de recebimento so vem depois do aceite e enquanto a carta nao
// chegou -- e vem do ambiente do servidor, nunca do repositorio.

import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin, carregarAutorizado, erro, enderecoRecebimento, BUCKET_SERVICOS } from '@/lib/servicosServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const auth = await carregarAutorizado(req, id)
    if (!auth.ok) return auth.resposta

    const sb = sbAdmin()
    const [{ data: sols }, { data: itens }, { data: eventos }, { data: midias }, { data: procs }] = await Promise.all([
      sb.from('servico_solicitacoes').select(
        'id, numero, servico, prazo, status, valor_declarado_cents, orcamento_cents, seguro_cents, frete_volta_cents, total_cents, orcamento_obs, orcado_em, pago_em, termo_aceito_em, rastreio_ida, rastreio_volta, created_at, objetivo, objetivo_outro, graduadora_alvo, proposta_enviada_em, proposta_aceita_em',
      ).eq('id', id).limit(1),
      sb.from('servico_itens').select('id, nome, card_id, queixas, obs, valor_declarado_cents, custodia, aceito, recusa_motivo, laudo, ficha_entrada, ficha_saida').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_eventos').select('id, status, nota, created_at').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_midias').select('id, item_id, tipo, posicao, mime, path').eq('solicitacao_id', id).order('created_at'),
      sb.from('servico_procedimentos').select('id, item_id, ordem, problema, procedimento, objetivo, resultado_esperado, risco, risco_descricao, alternativa, decisao, decidido_em').eq('solicitacao_id', id).order('ordem'),
    ])
    const sol = sols?.[0]
    if (!sol) return erro(404, 'Solicitação não encontrada')

    const paths = (midias || []).map(m => m.path)
    const { data: assinadas } = paths.length
      ? await sb.storage.from(BUCKET_SERVICOS).createSignedUrls(paths, 600)
      : { data: [] as { path: string | null; signedUrl: string }[] }
    const urlPor = new Map((assinadas || []).map(a => [a.path, a.signedUrl]))

    return NextResponse.json({
      solicitacao: sol,
      itens: itens || [],
      eventos: eventos || [],
      midias: (midias || []).map(({ path, ...m }) => ({ ...m, url: urlPor.get(path) || null })),
      // A proposta so aparece para o cliente depois de enviada (rascunho do painel fica oculto).
      procedimentos: sol.proposta_enviada_em ? procs || [] : [],
      endereco: sol.status === 'aceito' ? enderecoRecebimento() : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[servicos/id GET]', e instanceof Error ? e.message : e)
    return erro(500, 'Erro interno')
  }
}
