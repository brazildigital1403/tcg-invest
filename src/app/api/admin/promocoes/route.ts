// src/app/api/admin/promocoes/route.ts
//
// Admin: promocoes de afiliado (ml_afiliado_produtos + cabecalho em
// ml_afiliado_links), por vitrine (`chave`).
//
// GET  -> tudo (tabela de dezenas de linhas: a tela filtra em memoria) + os
//         cabecalhos das vitrines.
// POST -> cria. `vitrines: string[]` vira UMA linha por vitrine, cada uma no
//         fim da fila da sua chave. Recusa se a URL ja esta na vitrine.
//
// Escrita so com service key. Sem excluir na v1: desligar (`ativo`) resolve e
// preserva o historico.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { chaveValida, nomeVitrine } from '@/lib/promocoes'
import {
  COLUNAS_PRODUTO, proximaOrdem, revalidarChaves, supabaseAdmin, urlJaNaVitrine, validarCampos,
} from '@/lib/promocoesServer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const sb = supabaseAdmin()
    const [produtos, links] = await Promise.all([
      sb.from('ml_afiliado_produtos').select(COLUNAS_PRODUTO)
        .order('chave', { ascending: true })
        .order('ordem', { ascending: true })
        .order('id', { ascending: true }),
      sb.from('ml_afiliado_links').select('chave, url, titulo, subtitulo, ativo'),
    ])
    if (produtos.error) throw new Error(produtos.error.message)
    if (links.error) throw new Error(links.error.message)
    return NextResponse.json({ produtos: produtos.data || [], links: links.data || [] })
  } catch (err) {
    console.error('[admin/promocoes] erro listando:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro ao listar promoções' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdmin(req)
  if (unauth) return unauth

  try {
    const body = await req.json().catch(() => ({}))
    const v = validarCampos(body)
    if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 })

    const vitrines: string[] = Array.isArray(body.vitrines)
      ? [...new Set((body.vitrines as unknown[]).filter(chaveValida))]
      : []
    if (vitrines.length === 0) {
      return NextResponse.json({ error: 'Marque ao menos uma vitrine.' }, { status: 400 })
    }

    let ordemPedida: number | null = null
    if (body.ordem !== undefined && body.ordem !== null && body.ordem !== '') {
      const n = Number(body.ordem)
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: 'A ordem precisa ser um número inteiro a partir de 0.' }, { status: 400 })
      }
      ordemPedida = n
    }
    const ativo = body.ativo !== false

    const sb = supabaseAdmin()
    const url = v.campos.url!

    // Recusa ANTES de gravar qualquer linha: ou entra em todas, ou em nenhuma.
    for (const chave of vitrines) {
      if (await urlJaNaVitrine(sb, chave, url)) {
        return NextResponse.json({ error: `Já está na vitrine ${nomeVitrine(chave)}.` }, { status: 409 })
      }
    }

    const agora = new Date().toISOString()
    const linhas = []
    for (const chave of vitrines) {
      linhas.push({
        chave,
        url,
        imagem_url: v.campos.imagem_url!,
        titulo: v.campos.titulo!,
        preco: v.campos.preco!,
        ordem: ordemPedida ?? await proximaOrdem(sb, chave),
        ativo,
        ml_id: null,
        link_manual: true,
        produto_codigo: null,
        last_seen_at: agora,
        updated_at: agora,
      })
    }

    const { data, error } = await sb.from('ml_afiliado_produtos').insert(linhas).select(COLUNAS_PRODUTO)
    if (error) {
      console.error('[admin/promocoes] erro criando:', error.message)
      return NextResponse.json({ error: 'Erro ao salvar a promoção' }, { status: 500 })
    }

    const cache = revalidarChaves(vitrines)
    return NextResponse.json({ ok: true, produtos: data, cache })
  } catch (err) {
    console.error('[admin/promocoes] unexpected:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
