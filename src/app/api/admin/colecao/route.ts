// src/app/api/admin/colecao/route.ts
//
// Album do Club no /admin (21/11/2026). Mesmo padrao dos avisos: o admin e cookie de senha, sem
// conta no Supabase, entao a rota usa as funcoes *_interno pela chave de servico, com autor nulo
// ("Admin Bynx"). As regras ficam no banco; aqui so a forma dos dados e as datas (o campo
// datetime-local vem em horario de Brasilia e vira ISO).
//
// GET ?slug=                                              -> painel: edicoes + a escolhida com as 12 cartas
// POST multipart {id, numero, arte}                       -> sobe a arte da carta
// POST {acao:'edicao', id, dados}                         -> club_colecao_salvar_interno
// POST {acao:'estado', id, como, dados?}                  -> club_colecao_estado_interno (publicar | recolher | encerrar)
// POST {acao:'carta', id, numero, dados}                  -> club_carta_salvar_interno
// POST {acao:'previa', id, numeros, ids}                  -> club_colecao_previa_lote_interno
// POST {acao:'conceder', id, numeros, ids, origem, nota}  -> club_colecao_conceder_tokens_interno
// POST {acao:'desfazer', lote}                            -> club_colecao_desfazer_lote_interno
// POST {acao:'historico', id}                             -> club_colecao_historico_interno
// POST {acao:'pedidos', id}                               -> club_retiradas_admin_interno
// POST {acao:'pedido', numero, status, nota?}             -> club_retirada_status_interno

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { tratarGet, tratarPost } from './tratar'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })
  return tratarGet(req, sb)
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth
  const sb = getServiceSupabase()
  if (!sb) return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })
  return tratarPost(req, sb)
}
