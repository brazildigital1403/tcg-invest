import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarPrazo } from '@/lib/comissao'

/**
 * Quem recebe o dinheiro de uma venda -- a loja ou a pessoa.
 *
 * ★ POR QUE EXISTE (24/09/2026, Quadro #389). O checkout sempre partiu da
 * tabela `lojas`: sem loja ativa com Connect, o botao "Comprar" nao existe. Só
 * que 70 dos 100 anuncios ativos sao de PESSOA FISICA sem loja -- 18
 * vendedores, R$ 27.877 parados. Para eles nao havia caminho nenhum: nem
 * ruim, nem lento. Nenhum.
 *
 * ★ CADA LADO COM A SUA CONTA, SEM HERANCA (decisao do Du: "loja sempre tem
 * conta propria, assim deixamos a Bynx mais profissional"). A conta passou a
 * poder viver no USUARIO, e a da loja continua existindo -- mas uma nunca
 * cobre a outra:
 *
 *     anuncio de LOJA   -> so a conta DA LOJA
 *     anuncio de PESSOA -> so a conta DA PESSOA
 *
 * ★ POR QUE A HERANCA SAIU (01/10/2026). Entre 24/09 e hoje o resolvedor usava
 * a conta do dono quando a loja nao tinha uma propria, e o comentario que
 * estava aqui vendia isso como vantagem ("a segunda loja do mesmo dono herda a
 * mesma conta"). Era exatamente o que o Du recusou depois, e a implementacao
 * ficou contradizendo a decisao por uma semana. Nunca disparou -- zero usuarios
 * tinham conta pessoal nesse periodo, e as 4 lojas com Connect tem conta
 * propria --, entao tirar nao muda nada hoje. O que ela faria no primeiro caso
 * real: quem ativasse o recebimento pessoal e depois abrisse loja veria a loja
 * cobrando pela conta PESSOAL dele, calado, sem nunca ter pedido isso.
 *
 * ★ O CUSTO ACEITO: loja sem Connect proprio nao vende, mesmo que o dono
 * receba como pessoa. E o comportamento correto -- o CNPJ que fatura precisa
 * ser o de quem aparece na nota -- e tambem o que ja acontecia na pratica.
 * Quem abrir loja ativa o Connect dela: a tela de Pagamentos existe para
 * isso, e o `AvisoRecebimentos` cobra o lojista desde 12/09.
 *
 * ★ O FRETE SAI DE ONDE A CARTA ESTA. Loja envia da loja (CEP e modo dela);
 * pessoa envia de casa, e ai o modo e sempre CALCULADO -- pessoa fisica nao
 * tem painel de frete fixo, e cravar um valor unico para o Brasil inteiro
 * erra nos dois sentidos. Por isso o CEP da pessoa e requisito para vender, e
 * nao um detalhe de cadastro.
 */

export type TipoRecebedor = 'loja' | 'pessoa'

export type Recebedor = {
  tipo: TipoRecebedor
  /** Null quando quem vende e a pessoa, sem loja. E o que vai em `pedidos.loja_id`. */
  lojaId: string | null
  ownerUserId: string
  /** Como aparece para o comprador (nome da loja ou da pessoa). */
  nome: string
  slug: string | null
  logoUrl: string | null
  verificada: boolean
  connectAccountId: string | null
  connectStatus: string
  chargesEnabled: boolean
  repassePrazo: number
  freteModo: 'fixo' | 'calculado'
  freteCents: number
  freteGratisAcimaCents: number | null
  /** So digitos, 8 caracteres, ou null quando nao da para cotar frete. */
  cepOrigem: string | null
}

function cepLimpo(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length === 8 ? d : null
}

// ★ O SELECT PRECISA SER LITERAL: o supabase-js le a string em tempo de tipo
// para inferir a linha. Montada por concatenacao, ela vira `string` e a linha
// inteira colapsa em `GenericStringError` -- o erro aparece so na primeira
// propriedade lida, longe daqui.

/**
 * Monta o recebedor de um vendedor. Precisa de um client com SERVICE ROLE: le
 * colunas de `users` que a RLS nao expoe ao navegador, de proposito.
 *
 * Devolve null so quando o usuario nao existe -- o que e erro de dado, nao
 * caso de uso.
 */
export async function resolverRecebedor(
  db: SupabaseClient,
  vendedorUserId: string
): Promise<Recebedor | null> {
  const [{ data: lojas }, { data: users }] = await Promise.all([
    db
      .from('lojas')
      .select('id, nome, slug, logo_url, verificada, status, owner_user_id, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, repasse_prazo, frete_cents, frete_gratis_acima_cents, frete_modo, cep')
      .eq('owner_user_id', vendedorUserId)
      .eq('status', 'ativa')
      // Duas lojas do mesmo dono: a mais antiga e a que responde pelos anuncios
      // dele, que nao apontam para loja nenhuma.
      .order('created_at', { ascending: true })
      .limit(1),
    db.from('users').select('id, name, username, cep, stripe_connect_account_id, stripe_connect_status, connect_charges_enabled, repasse_prazo').eq('id', vendedorUserId).limit(1),
  ])

  const user = users?.[0]
  if (!user) return null

  const loja = lojas?.[0] || null

  // Sem cruzamento: a loja le a conta dela, a pessoa le a dela. Ver o cabecalho.
  const contaPessoa = user.stripe_connect_account_id || null

  if (loja) {
    return {
      tipo: 'loja',
      lojaId: loja.id,
      ownerUserId: vendedorUserId,
      nome: loja.nome,
      slug: loja.slug,
      logoUrl: loja.logo_url,
      verificada: !!loja.verificada,
      connectAccountId: loja.stripe_connect_account_id || null,
      connectStatus: String(loja.stripe_connect_status || 'nao_iniciado'),
      chargesEnabled: !!loja.connect_charges_enabled,
      // O prazo e o da LOJA, porque e a conta dela que recebe.
      repassePrazo: normalizarPrazo(loja.repasse_prazo),
      freteModo: loja.frete_modo === 'calculado' ? 'calculado' : 'fixo',
      freteCents: Math.max(0, loja.frete_cents || 0),
      freteGratisAcimaCents: loja.frete_gratis_acima_cents ?? null,
      // ★ ESTE fallback FICA, e nao contradiz o de cima: ele e de FRETE, nao
      // de conta. O CEP diz de onde a carta sai fisicamente, e sai da casa do
      // dono de qualquer jeito. Dinheiro e endereco sao perguntas separadas.
      cepOrigem: cepLimpo(loja.cep) || cepLimpo(user.cep),
    }
  }

  return {
    tipo: 'pessoa',
    lojaId: null,
    ownerUserId: vendedorUserId,
    nome: user.name || user.username || 'Vendedor',
    slug: user.username || null,
    logoUrl: null,
    verificada: false,
    connectAccountId: contaPessoa,
    connectStatus: String(user.stripe_connect_status || 'nao_iniciado'),
    chargesEnabled: !!user.connect_charges_enabled,
    repassePrazo: normalizarPrazo(user.repasse_prazo),
    // Sem painel de frete: quem vende de casa cota pelo CEP, sempre.
    freteModo: 'calculado',
    freteCents: 0,
    freteGratisAcimaCents: null,
    cepOrigem: cepLimpo(user.cep),
  }
}

/** O vendedor pode receber por dentro da Bynx agora? */
export function podeReceber(r: Recebedor | null): boolean {
  return !!r && !!r.connectAccountId && r.chargesEnabled
}

/**
 * A frase que o comprador ve quando o botao nao pode existir. Fala do
 * VENDEDOR, nao de "loja" -- 70 dos 100 anuncios nao tem loja nenhuma, e
 * mandar essa pessoa "ativar os recebimentos da loja" e pedir o impossivel.
 */
export function motivoSemCompra(r: Recebedor | null): string {
  if (!r || !r.connectAccountId) {
    return 'Esse vendedor ainda não recebe pagamento pela Bynx. Use "Tenho interesse" para negociar.'
  }
  if (!r.chargesEnabled) {
    return 'Esse vendedor está terminando de ativar os recebimentos. Tente de novo em breve.'
  }
  if (!r.cepOrigem) {
    return 'Esse vendedor ainda não informou o CEP de envio. Use "Tenho interesse" para negociar.'
  }
  return 'Não é possível comprar esse anúncio agora.'
}
