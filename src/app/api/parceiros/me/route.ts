// src/app/api/parceiros/me/route.ts
//
// Central do Parceiro — dados do parceiro logado.
// Leitura via client anon + JWT do user: a RLS garante que so vem o proprio
// dado (policies parceiros_self_read e filhas). Nenhum dado pessoal de
// assinante sai daqui — so data, plano e valores.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: parceiros, error: pErr } = await supabase
      .from('parceiros')
      .select('id, nome, cupom_code, desconto_pct, comissao_primeira_pct, comissao_primeira_cap_cents, comissao_renovacao_pct, recorrente_meses, ativo, criado_em')
      .limit(1)

    if (pErr) {
      console.error('[parceiros/me] erro lendo parceiro:', pErr.message)
      return NextResponse.json({ ok: false, error: 'db_error' }, { status: 500 })
    }
    const parceiro = parceiros?.[0]
    if (!parceiro) {
      return NextResponse.json({ ok: false, error: 'not_partner' }, { status: 404 })
    }

    // A soma e a contagem vem de query propria sem o cap de exibicao das 200
    // conversoes — senao o numero "a receber" subestima quando o ciclo cresce.
    const [pendentesRes, somaRes, fechamentosRes] = await Promise.all([
      supabase
        .from('parceiro_comissoes')
        .select('tipo, plano, valor_base_cents, comissao_cents, criado_em')
        .eq('parceiro_id', parceiro.id)
        .is('fechamento_id', null)
        .order('criado_em', { ascending: false })
        .limit(200),
      supabase
        .from('parceiro_comissoes')
        .select('tipo, comissao_cents')
        .eq('parceiro_id', parceiro.id)
        .is('fechamento_id', null),
      supabase
        .from('parceiro_fechamentos')
        .select('periodo_inicio, periodo_fim, total_comissao_cents, qtd_linhas, status, pago_em, criado_em')
        .eq('parceiro_id', parceiro.id)
        .order('criado_em', { ascending: false })
        .limit(24),
    ])

    const pendentes = pendentesRes.data || []
    const todas = somaRes.data || []
    const somaPendenteCents = todas.reduce((s, l) => s + Number(l.comissao_cents), 0)
    const assinantesCiclo = todas.filter(l => l.tipo === 'venda').length

    return NextResponse.json({
      ok: true,
      parceiro: {
        nome: parceiro.nome,
        cupom: parceiro.cupom_code,
        descontoPct: Number(parceiro.desconto_pct),
        comissaoPrimeiraPct: Number(parceiro.comissao_primeira_pct),
        capPrimeiraCents: parceiro.comissao_primeira_cap_cents != null ? Number(parceiro.comissao_primeira_cap_cents) : null,
        comissaoRenovacaoPct: Number(parceiro.comissao_renovacao_pct),
        recorrenteMeses: parceiro.recorrente_meses,
        ativo: parceiro.ativo,
        desde: parceiro.criado_em,
      },
      cicloAtual: {
        somaPendenteCents,
        assinantes: assinantesCiclo,
        conversoes: pendentes,
      },
      fechamentos: fechamentosRes.data || [],
    })
  } catch (err: any) {
    console.error('[parceiros/me] unexpected:', err?.message)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
