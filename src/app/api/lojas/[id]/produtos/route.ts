import { NextRequest, NextResponse } from 'next/server'
import { planoEfetivoLoja, LIMITE_FOTOS_PRODUTO } from '@/lib/planoLoja'
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
 * de cliente) — e aqui que validamos dono, tipo, preco, estoque e peso.
 *
 * Regra de acesso (decisao do Du): qualquer loja ATIVA pode cadastrar. O plano
 * ja limita naturalmente pelas FOTOS (basico 0 / pro 5 / premium 10) — sem foto
 * o produto nao vende, entao nao precisamos de outra regra por cima.
 *
 * `peso_g` (gramas) alimenta o frete calculado (Melhor Envio). Opcional: so
 * precisa quando a loja usa frete_modo='calculado'. A dimensao a Bynx estima
 * pelo tipo do produto.
 */

const SELECT_LOJA = 'id, owner_user_id, nome, status, plano, plano_expira_em'
const TIPOS = ['selado', 'pelucia', 'funko', 'fichario', 'acessorio'] as const

/**
 * ★ IDIOMA DO PRODUTO (02/10/2026, Quadro #447). A coluna existia no banco
 * desde sempre, com default 'pt', e NINGUEM escolhia: nem o formulario nem
 * esta rota tinham o campo, e nenhuma tela lia. Resultado: os 7 produtos
 * cadastrados estavam marcados como portugues, incluindo a Elite Trainer Box
 * "Pitch Black" da Mais Que Geek, que a foto do proprio anuncio mostra ser
 * INGLESA ("ELITE TRAINER BOX", "WARNING: CHOKING HAZARD").
 *
 * Importa porque o mesmo produto tem caixa diferente em cada idioma -- a ETB
 * inglesa mede 8,6 x 16,5 x 18,8 cm e a brasileira nao -- e e a medida que
 * decide o frete. Sem saber o idioma nao da para ter tabela de medida padrao.
 *
 * Os 9 sao os mesmos do `AddCardModal`, de proposito: um conjunto novo so
 * para produto seria mais uma lista para divergir.
 */
const IDIOMAS = ['pt', 'en', 'jp', 'es', 'fr', 'de', 'it', 'cn', 'kr'] as const

/**
 * ★ "SELADO" NAO E UM FORMATO, SAO OITO (02/10/2026). O tipo cobria Elite
 * Trainer Box, booster box de 36 pacotes, blister de 3, deck, lata e colecao
 * especial -- caixas que nao se parecem em nada --, e a Bynx estimava UMA
 * dimensao para todas (25x20x12): grande demais para a ETB, pequena demais
 * para a booster box.
 *
 * Com `idioma`, este campo e a chave da medida padrao que vem a seguir: a ETB
 * inglesa mede 8,6 x 16,5 x 18,8 cm e a brasileira nao.
 *
 * ★ SO EM `selado`. Pelucia, funko, fichario e acessorio nao tem formato de
 * fabrica -- cada um tem a sua caixa, e formato ali seria dado que ninguem le
 * e que mente na ficha. O banco tem o mesmo check.
 */
const FORMATOS = ['etb', 'booster_box', 'bundle', 'blister', 'deck', 'lata', 'colecao', 'pacote'] as const
type Formato = (typeof FORMATOS)[number]
const ehFormato = (v: unknown): v is Formato => FORMATOS.includes(v as Formato)
type Idioma = (typeof IDIOMAS)[number]
const ehIdioma = (v: unknown): v is Idioma => IDIOMAS.includes(v as Idioma)
const CAMPOS = 'id, tipo, nome, descricao, preco_cents, estoque, peso_g, largura_cm, altura_cm, comprimento_cm, idioma, formato, vendidos, fotos, ativo, created_at'

type Tipo = (typeof TIPOS)[number]
const ehTipo = (v: unknown): v is Tipo => TIPOS.includes(v as Tipo)

/** "850" | 850 | "" | null -> gramas (int) ou null. */
function pesoParaGramas(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const w = Number(v)
  return Number.isFinite(w) ? Math.round(w) : NaN
}

/** Medida em cm. Vazio vira null (= usar a estimativa por tipo). */
function cm(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : NaN
}

const DIMS = ['largura_cm', 'altura_cm', 'comprimento_cm'] as const

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
  if ('peso_g' in p && p.peso_g != null && p.peso_g !== '') {
    const w = pesoParaGramas(p.peso_g)
    if (w === null) return null
    if (!Number.isInteger(w) || w <= 0 || w > 30000) return 'Peso inválido. Use de 1 a 30000 g.'
  }
  // ★ TUDO OU NADA nas tres medidas. Com uma faltando, o volume declarado
  //   seria parte medida e parte estimada por tipo, e nao daria para saber
  //   qual das duas mandou no peso cubado -- que e o que o frete cobra.
  const informadas = DIMS.filter(k => k in p && p[k] != null && p[k] !== '')
  if (informadas.length > 0) {
    for (const k of informadas) {
      const n = cm(p[k])
      if (n === null || !Number.isInteger(n) || n < 1 || n > 100) {
        return 'Medida inválida. Use de 1 a 100 cm em cada lado.'
      }
    }
    if (informadas.length < DIMS.length) {
      return 'Informe as três medidas da embalagem, ou deixe as três em branco.'
    }
  }
  if ('idioma' in p && p.idioma != null && p.idioma !== '' && !ehIdioma(p.idioma)) {
    return 'Idioma inválido.'
  }
  if ('formato' in p && p.formato != null && p.formato !== '') {
    if (!ehFormato(p.formato)) return 'Formato inválido.'
    // Num PATCH parcial o tipo pode nem vir no corpo; ai quem decide e o banco,
    // que tem o mesmo check. Aqui so barramos o que da para ver daqui.
    if ('tipo' in p && p.tipo !== 'selado') {
      return 'O formato só existe em produto selado.'
    }
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
        peso_g: pesoParaGramas(body.peso_g),
        idioma: ehIdioma(body.idioma) ? body.idioma : 'pt',
        // Formato so sobrevive em selado -- o check do banco recusaria o resto.
        formato: body.tipo === 'selado' && ehFormato(body.formato) ? body.formato : null,
        largura_cm: cm(body.largura_cm),
        altura_cm: cm(body.altura_cm),
        comprimento_cm: cm(body.comprimento_cm),
        // Corte pelo plano da loja (antes era 10 pra todos). Ver src/lib/planoLoja.ts.
        fotos: Array.isArray(body.fotos) ? body.fotos.slice(0, LIMITE_FOTOS_PRODUTO[planoEfetivoLoja(loja as { plano: string; plano_expira_em: string | null })]) : [],
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
    if ('peso_g' in body) patch.peso_g = pesoParaGramas(body.peso_g)
    for (const k of DIMS) if (k in body) patch[k] = cm(body[k])
    if ('idioma' in body && ehIdioma(body.idioma)) patch.idioma = body.idioma
    // ★ Trocar o tipo para fora de `selado` TEM que limpar o formato, senao o
    //   check do banco recusa o update inteiro e o lojista leva um erro que
    //   nao sabe de onde veio.
    if ('tipo' in body && body.tipo !== 'selado') patch.formato = null
    else if ('formato' in body) patch.formato = ehFormato(body.formato) ? body.formato : null
    if ('ativo' in body) patch.ativo = !!body.ativo
    if ('fotos' in body && Array.isArray(body.fotos)) patch.fotos = body.fotos.slice(0, LIMITE_FOTOS_PRODUTO[planoEfetivoLoja(auth.loja as { plano: string; plano_expira_em: string | null })])

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
