/**
 * Carrinho da Bynx — mora no localStorage, agrupado POR VENDEDOR.
 *
 * POR QUE POR VENDEDOR: cada vendedor tem a propria conta Stripe Connect e o
 * proprio frete. Nao existe "pagar tudo junto" de 2 vendedores — seriam 2
 * cobrancas, 2 splits e 2 fretes. Entao o carrinho ja nasce separado e cada
 * vendedor fecha o proprio checkout.
 *
 * ★ ERA POR LOJA ATE 02/10/2026, e isso deixava de fora quem vende SEM loja.
 * A Barbara ativou o recebimento com 13 anuncios e nao conseguia vender duas
 * cartas juntas: o frete de uma carta de R$ 0,90 dela custava R$ 17,44, e a
 * unica saida do comprador era pagar esse frete de novo na segunda carta.
 * Hoje 70 dos 96 anuncios do mercado sao de pessoa fisica.
 *
 * ★ O AGRUPADOR E `vendedorId` (o `owner_user_id`), NAO `lojaId`. E o mesmo
 * recorte de `resolverRecebedor`: tendo loja ativa quem recebe e a conta DA
 * LOJA, senao a da pessoa. Nunca as duas -- isso seria a heranca de conta que
 * saiu em 4a0de6f. `lojaId` continua aqui porque PRODUTO vive em
 * `loja_produtos` e precisa dela; para carta de pessoa fisica ele e null.
 *
 * POR QUE LOCALSTORAGE: pra o visitante montar carrinho ANTES de ter conta. O
 * login so e pedido no "Finalizar". Carrinho no banco exigiria login pra
 * adicionar item — pior conversao.
 *
 * QUANTIDADE: so faz sentido pra PRODUTO (a carta e peca unica, 1 anuncio = 1
 * unidade). O campo e opcional e o `ler()` normaliza pra 1 — assim carrinho
 * gravado antes desta versao continua valendo em vez de ser descartado.
 *
 * ★ SO GUARDAMOS IDs ★
 * Nada de preco/nome aqui. Preco vem SEMPRE do servidor: se o cliente mandasse
 * o preco, daria pra editar o localStorage e comprar um Charizard por R$ 1.
 * Nome e imagem sao relidos junto — o anuncio pode ter sido editado ou vendido.
 */

// ★ v2: o formato do item mudou (`lojaId` obrigatorio -> `vendedorId`), e o
// navegador nao sabe resolver loja -> dono sozinho. Carrinho gravado na v1 e
// descartado em vez de migrado pela metade: ficar com item sem vendedor seria
// gravar um pedido sem saber de quem e a conta que recebe.
const CHAVE = 'bynx_carrinho_v2'
const EVENTO = 'bynx:carrinho'

export type TipoItem = 'carta' | 'produto'

export interface ItemCarrinho {
  /** id do anuncio (marketplace) ou do produto (loja_produtos) */
  id: string
  tipo: TipoItem
  /** `users.id` de quem vende. E por ele que o carrinho agrupa. */
  vendedorId: string
  /** `lojas.id` quando o item e de loja; null em anuncio de pessoa fisica. */
  lojaId: string | null
  /** Unidades. Sempre 1 pra carta. O servidor revalida contra o estoque. */
  qtd: number
  /** so pra exibir enquanto o servidor nao responde; NUNCA usado em conta */
  addedAt: number
}

type Carrinho = ItemCarrinho[]

function ler(): Carrinho {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CHAVE)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .filter(
        (i): i is ItemCarrinho =>
          !!i &&
          typeof i.id === 'string' &&
          (i.tipo === 'carta' || i.tipo === 'produto') &&
          // Sem `vendedorId` nao da pra saber de quem e a conta que recebe.
          typeof i.vendedorId === 'string' &&
          i.vendedorId.length > 0 &&
          // Produto SEMPRE tem loja; carta pode nao ter.
          (i.tipo !== 'produto' || typeof i.lojaId === 'string')
      )
      // Normaliza a quantidade: item gravado antes desta versao nao tem `qtd`,
      // e carta e sempre 1 unidade.
      .map(i => ({
        ...i,
        qtd: i.tipo === 'carta' ? 1 : Math.max(1, Math.min(Math.floor(Number(i.qtd)) || 1, 99)),
      }))
  } catch {
    return []
  }
}

function gravar(c: Carrinho) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CHAVE, JSON.stringify(c))
    // Avisa o badge do header e a pagina do carrinho na mesma aba
    // (o evento nativo `storage` so dispara em OUTRAS abas).
    window.dispatchEvent(new CustomEvent(EVENTO))
  } catch {
    /* quota cheia / modo privado: silencioso, o carrinho e conveniencia */
  }
}

export function obterCarrinho(): Carrinho {
  return ler()
}

/** Itens de um vendedor especifico. */
export function itensDoVendedor(vendedorId: string): Carrinho {
  return ler().filter(i => i.vendedorId === vendedorId)
}

/** Vendedores presentes no carrinho, na ordem em que apareceram. */
export function vendedoresNoCarrinho(): string[] {
  const vistos: string[] = []
  for (const i of ler()) if (!vistos.includes(i.vendedorId)) vistos.push(i.vendedorId)
  return vistos
}

export function estaNoCarrinho(id: string): boolean {
  return ler().some(i => i.id === id)
}

/**
 * Quantas unidades DESTE item ha no carrinho. 0 = nao esta.
 *
 * ★ DEVOLVE PRIMITIVO DE PROPOSITO. Quem consome e o `useSyncExternalStore`
 * do BotaoCarrinho, e ele compara o snapshot por identidade: devolver
 * `{ dentro, qtd }` criaria objeto novo a cada leitura e o React entraria em
 * loop ("The result of getSnapshot should be cached"). Um number carrega os
 * dois estados sem esse risco.
 */
export function qtdNoCarrinho(id: string): number {
  return ler().find(i => i.id === id)?.qtd ?? 0
}

/** Total de UNIDADES (nao de linhas): 1 produto com 3 unidades conta 3. */
export function contarItens(): number {
  return ler().reduce((s, i) => s + i.qtd, 0)
}

/**
 * Adiciona. Item que ja esta no carrinho NAO duplica linha -- por isso esta
 * funcao retorna cedo quando o id ja existe.
 *
 * ★ Quem aumenta a quantidade e `definirQtd`, nao esta. Desde 08/09 o stepper
 * vive na propria pagina do produto (padrao de mercado: quantidade e decisao
 * da PDP, nao do carrinho); chamar `adicionar` de novo pro "+" nao faria
 * nada, silenciosamente.
 */
export function adicionar(item: Omit<ItemCarrinho, 'addedAt' | 'qtd'> & { qtd?: number }): void {
  const c = ler()
  if (c.some(i => i.id === item.id)) return
  const qtd = item.tipo === 'carta' ? 1 : Math.max(1, Math.min(Math.floor(Number(item.qtd)) || 1, 99))
  gravar([...c, { ...item, qtd, addedAt: Date.now() }])
}

/**
 * Ajusta as unidades de um item. O TETO REAL e o estoque, e quem sabe dele e o
 * servidor -- aqui so limitamos a 99 pra nao gravar absurdo no localStorage. A
 * rota do carrinho revalida contra o estoque e corta o excesso.
 */
export function definirQtd(id: string, qtd: number): void {
  const n = Math.max(1, Math.min(Math.floor(Number(qtd)) || 1, 99))
  gravar(ler().map(i => (i.id === id && i.tipo !== 'carta' ? { ...i, qtd: n } : i)))
}

export function remover(id: string): void {
  gravar(ler().filter(i => i.id !== id))
}

/** Alterna e devolve o estado novo (pro botao da vitrine). */
export function alternar(item: Omit<ItemCarrinho, 'addedAt' | 'qtd'> & { qtd?: number }): boolean {
  if (estaNoCarrinho(item.id)) {
    remover(item.id)
    return false
  }
  adicionar(item)
  return true
}

/** Esvazia o vendedor inteiro — usado depois que o pedido dele e criado. */
export function limparVendedor(vendedorId: string): void {
  gravar(ler().filter(i => i.vendedorId !== vendedorId))
}

export function limparTudo(): void {
  gravar([])
}

/**
 * Assina mudancas do carrinho (mesma aba via CustomEvent, outras abas via
 * `storage`). Devolve a funcao de cleanup.
 */
export function assinarCarrinho(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const naStorage = (e: StorageEvent) => { if (e.key === CHAVE) cb() }
  window.addEventListener(EVENTO, cb)
  window.addEventListener('storage', naStorage)
  return () => {
    window.removeEventListener(EVENTO, cb)
    window.removeEventListener('storage', naStorage)
  }
}
