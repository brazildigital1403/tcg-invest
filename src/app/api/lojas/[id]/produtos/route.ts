import { NextRequest, NextResponse } from 'next/server'
import { autenticarOwnerOuAdmin } from '@/lib/lojas-auth'

/**
 * Produtos gerais da loja (o que nao e carta do catalogo).
 *
 * GET    /api/lojas/[id]/produtos            -> lista TUDO (inclusive esgotado/inativo)
 * POST   /api/lojas/[id]/produtos            -> cria
 * PATCH  /api/lojas/[id]/produtos            -> { produto_id, ...campos } edita
 * DELETE /api/lojas/[id]/produtos?produto_id -> remove
 *
 * Auth: owner da loja OU admin. Escrita so por aqui (a tabela nao aceita write
 * de cliente) — e aqui que validamos dono, tipo, preco e estoque.
 *
 * Regra de acesso (decisao do Du): qualquer loja ATIVA pode cadastrar. O plano
 * ja limita naturalmente pelas FOTOS (basico 0 / pro 5 / premium 10) — sem foto
 * o produto nao vende, entao nao precisamos de outra regra por cima.
 */

const SELECT_LOJA = 'id, owner_user_id, nome, status'
const TIPOS = ['selado', 'pelucia', 'funko', 'fichario', 'acessorio'] as const
const CAMPOS = 'id, tipo, nome, descricao, preco_cents, estoque, vendidos, fotos, ativo, created_at'

type Tipo = (typeof TIPOS)[number]
const ehTipo = (v: unknown): v is Tipo => TIPOS.includes(v as Tipo)

/** Valida os campos comuns de create/update. Devolve erro (string) ou null. */
function validar(p: Record<string, unknown>, parcial: boolean): string | null {
  if (!parcial || 'tipo' in p) {
    if (!ehTipo(p.tipo)) return 'Escolha um tipo de produto válido.'
  }
  if (!parcial || 'nome' in p) {
    const n = String(p.nome ?? '').trim()
    if (n.length < 2 || n.length > 120) return 'O nome precisa ter entre 2 e 120 caracteres.'
  }
  if (!parcial || 'preco_cents' in p) {
    const v = Number(p.preco_cents)
    if (!Number.isInteger(v) || v <= 0 || v > 5000000) return 'Preço inválido. Use de R$ 0,01 a R$ 50.000,00.'
  }
  if (!parcial || 'estoque' in p) {
    const e = Number(p.estoque)
    if (!Number.isInteger(e) || e < 0 || e > 9999) return 'Estoque inválido. Use de 0 a 9999.'
  }
  if ('descricao' in p && p.descricao != null && String(p.descricao).length > 1000) {
    return 'Descrição muito longa (máx. 1000 caracteres).'
  }
  return null
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT_LOJA)
    if ('error' in auth) return auth.error
    const { sb } = auth

    const { data, error } = await sb
      .from('loja_produtos')
      .select(CAMPOS)
      .eq('loja_id', lojaId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[produtos GET]', error.message)
      return NextResponse.json({ error: 'Erro ao carregar produtos.' }, { status: 500 })
    }

    const produtos = data || []
    return NextResponse.json({
      produtos,
      resumo: {
        total: produtos.length,
        a_venda: produtos.filter(p => p.ativo && p.estoque > 0).length,
        esgotados: produtos.filter(p => p.estoque === 0).length,
        vendidos: produtos.reduce((s, p) => s + (p.vendidos || 0), 0),
      },
    })
  } catch (err) {
    console.error('[produtos GET] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT_LOJA)
    if ('error' in auth) return auth.error
    const { loja, sb } = auth

    if (loja.status !== 'ativa') {
      return NextResponse.json({ error: 'Sua loja precisa estar ativa para cadastrar produtos.' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 })

    const erro = validar(body, false)
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })

    const { data, error } = await sb
      .from('loja_produtos')
      .insert({
        loja_id: lojaId,
        tipo: body.tipo,
        nome: String(body.nome).trim(),
        descricao: body.descricao ? String(body.descricao).trim() : null,
        preco_cents: Number(body.preco_cents),
        estoque: Number(body.estoque),
        fotos: Array.isArray(body.fotos) ? body.fotos.slice(0, 10) : [],
      })
      .select(CAMPOS)
      .single()

    if (error) {
      console.error('[produtos POST]', error.message)
      return NextResponse.json({ error: 'Erro ao criar o produto.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, produto: data })
  } catch (err) {
    console.error('[produtos POST] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT_LOJA)
    if ('error' in auth) return auth.error
    const { sb } = auth

    const body = await req.json().catch(() => null)
    const produtoId = body?.produto_id
    if (!produtoId) return NextResponse.json({ error: 'Produto não informado.' }, { status: 400 })

    const erro = validar(body, true)
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('tipo' in body) patch.tipo = body.tipo
    if ('nome' in body) patch.nome = String(body.nome).trim()
    if ('descricao' in body) patch.descricao = body.descricao ? String(body.descricao).trim() : null
    if ('preco_cents' in body) patch.preco_cents = Number(body.preco_cents)
    if ('estoque' in body) patch.estoque = Number(body.estoque)
    if ('ativo' in body) patch.ativo = !!body.ativo
    if ('fotos' in body && Array.isArray(body.fotos)) patch.fotos = body.fotos.slice(0, 10)

    // `.eq('loja_id')` e o que impede um lojista de editar produto de outro.
    const { data, error } = await sb
      .from('loja_produtos')
      .update(patch)
      .eq('id', produtoId)
      .eq('loja_id', lojaId)
      .select(CAMPOS)
      .single()

    if (error || !data) {
      console.error('[produtos PATCH]', error?.message)
      return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, produto: data })
  } catch (err) {
    console.error('[produtos PATCH] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: lojaId } = await ctx.params
    const auth = await autenticarOwnerOuAdmin(req, lojaId, SELECT_LOJA)
    if ('error' in auth) return auth.error
    const { sb } = auth

    const produtoId = new URL(req.url).searchParams.get('produto_id')
    if (!produtoId) return NextResponse.json({ error: 'Produto não informado.' }, { status: 400 })

    // Pedidos ficam intactos: `produto_id` e ON DELETE SET NULL e o pedido
    // guarda o snapshot do item (nome/imagem/preco). Historico preservado.
    const { error } = await sb.from('loja_produtos').delete().eq('id', produtoId).eq('loja_id', lojaId)
    if (error) {
      console.error('[produtos DELETE]', error.message)
      return NextResponse.json({ error: 'Erro ao remover o produto.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[produtos DELETE] erro:', (err as Error)?.message)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
