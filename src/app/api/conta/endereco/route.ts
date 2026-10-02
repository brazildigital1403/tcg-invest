// POST /api/conta/endereco -- o proprio usuario salva o endereco (Minha Conta).
//
// Por que rota de servidor e nao update direto do navegador: a tabela users so
// concede UPDATE ao authenticated em colunas escolhidas (nome, cidade,
// whatsapp...), e o endereco nao esta entre elas. Em vez de abrir grant de
// coluna, a escrita passa por aqui: Bearer do proprio usuario, validacao e
// update com a chave de servico, so na linha dele.
//
// O CEP e o que mais importa: frete de venda e a volta dos servicos cotam por
// ele. Formato gravado: 00000-000, o mesmo do cadastro.

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const erro = (status: number, msg: string) => NextResponse.json({ error: msg }, { status })

export async function POST(req: NextRequest) {
  const db = getServiceSupabase()
  if (!db) return erro(500, 'Configuração ausente')
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return erro(401, 'Entre na sua conta.')
  const { data: authData } = await db.auth.getUser(token)
  const user = authData?.user
  if (!user) return erro(401, 'Entre na sua conta.')

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return erro(400, 'Dados inválidos')

  const cepDig = String(body.cep || '').replace(/\D/g, '')
  if (cepDig.length !== 8) return erro(400, 'CEP inválido.')
  const logradouro = txt(body.logradouro, 200)
  const numero = txt(body.numero, 20)
  const complemento = txt(body.complemento, 120)
  const bairro = txt(body.bairro, 120)
  const city = txt(body.city, 120)
  const uf = txt(body.uf, 2).toUpperCase()
  if (!logradouro) return erro(400, 'Informe a rua.')
  if (!numero) return erro(400, 'Informe o número (ou "s/n").')
  if (!bairro) return erro(400, 'Informe o bairro.')
  if (!city) return erro(400, 'Informe a cidade.')
  if (!UFS.includes(uf)) return erro(400, 'Informe o estado (UF).')

  const dados = {
    cep: `${cepDig.slice(0, 5)}-${cepDig.slice(5)}`,
    logradouro, numero, complemento: complemento || null, bairro, city, uf,
  }
  const { error } = await db.from('users').update(dados).eq('id', user.id)
  if (error) {
    console.error('[conta/endereco]', error.message)
    return erro(500, 'Não foi possível salvar agora.')
  }
  return NextResponse.json({ ok: true, endereco: dados })
}
