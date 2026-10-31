import 'server-only'
import { cache } from 'react'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { montarIdentificacao, type Identificacao } from '@/lib/vendedorIdentificado'

/**
 * Le loja + dono e devolve o "Vendido por" (#470). Chave de servico porque o
 * CPF esta em `users`, que a RLS so libera para a propria linha.
 *
 * ★ `completo` SO depois de conferir que quem pede comprou daquele vendedor
 * (rota do pedido). Tela publica chama sem: o CPF sai daqui ja mascarado.
 *
 * Duas leituras por chave primaria, sem varredura. Falha devolve null -- a
 * tela fica sem o bloco, nunca sem a pagina.
 */
export const identificarVendedor = cache(async function identificarVendedor(
  lojaId: string | null | undefined,
  userId: string | null | undefined,
  completo = false,
): Promise<Identificacao | null> {
  const db = getServiceSupabase()
  if (!db) return null
  try {
    let cnpj: string | null = null
    let razaoSocial: string | null = null
    let dono = userId || null
    if (lojaId) {
      const { data: l } = await db.from('lojas').select('cnpj, razao_social, owner_user_id').eq('id', lojaId).maybeSingle()
      if (l) {
        cnpj = l.cnpj
        razaoSocial = l.razao_social
        dono = l.owner_user_id || dono
      }
    }
    let nomeDono: string | null = null
    let cpfDono: string | null = null
    if (dono && !(cnpj && razaoSocial)) {
      const { data: u } = await db.from('users').select('name, cpf').eq('id', dono).maybeSingle()
      nomeDono = u?.name ?? null
      cpfDono = u?.cpf ?? null
    }
    return montarIdentificacao({ cnpj, razaoSocial, nomeDono, cpfDono }, completo)
  } catch {
    return null
  }
})
