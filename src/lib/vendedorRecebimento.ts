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
 * ★ A CONTA PASSA A VIVER NO USUARIO, E A DA LOJA CONTINUA VALENDO. O
 * resolvedor usa a conta da loja quando ela tem uma, e a do dono quando nao
 * tem. Foi a pergunta do Du que derrubou o plano anterior (mover tudo para o
 * usuario): assim as 3 lojas que ja movimentam dinheiro nao sao tocadas, quem
 * anuncia hoje e abre loja amanha nao refaz cadastro, e a segunda loja do
 * mesmo dono herda a mesma conta. O dia em que uma loja precisar de CNPJ
 * proprio, basta criar a conta DELA -- o ponteiro ja e o campo que existe.
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
  /** true quando a loja esta usando a conta do dono, nao uma propria. */
  contaHerdada: boolean
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

  // A conta da pessoa e o piso: a da loja so entra por cima quando existe.
  const contaPessoa = user.stripe_connect_account_id || null
  const contaLoja = loja?.stripe_connect_account_id || null
  const usaDaLoja = !!contaLoja

  const conta = usaDaLoja ? contaLoja : contaPessoa
  const status = usaDaLoja ? loja!.stripe_connect_status : user.stripe_connect_status
  const charges = usaDaLoja ? !!loja!.connect_charges_enabled : !!user.connect_charges_enabled

  if (loja) {
    return {
      tipo: 'loja',
      lojaId: loja.id,
      ownerUserId: vendedorUserId,
      nome: loja.nome,
      slug: loja.slug,
      logoUrl: loja.logo_url,
      verificada: !!loja.verificada,
      connectAccountId: conta,
      connectStatus: String(status || 'nao_iniciado'),
      chargesEnabled: charges,
      contaHerdada: !usaDaLoja && !!contaPessoa,
      // O prazo de repasse e do dono da conta que vai receber.
      repassePrazo: normalizarPrazo(usaDaLoja ? loja.repasse_prazo : user.repasse_prazo),
      freteModo: loja.frete_modo === 'calculado' ? 'calculado' : 'fixo',
      freteCents: Math.max(0, loja.frete_cents || 0),
      freteGratisAcimaCents: loja.frete_gratis_acima_cents ?? null,
      // A loja sem CEP cai no CEP do dono: e de la que a carta sai de qualquer jeito.
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
    contaHerdada: false,
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
