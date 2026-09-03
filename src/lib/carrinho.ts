/**
 * Carrinho da Bynx — mora no localStorage, agrupado POR LOJA.
 *
 * POR QUE POR LOJA: cada loja tem a propria conta Stripe Connect e o proprio
 * frete. Nao existe "pagar tudo junto" de 2 lojas — seriam 2 cobrancas, 2
 * splits e 2 fretes. Entao o carrinho ja nasce separado e cada loja fecha o
 * proprio checkout.
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

const CHAVE = 'bynx_carrinho_v1'
const EVENTO = 'bynx:carrinho'

export type TipoItem = 'carta' | 'produto'

export interface ItemCarrinho {
  /** id do anuncio (marketplace) ou do produto (loja_produtos) */
  id: string
  tipo: TipoItem
  lojaId: string
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
          !!i && typeof i.id === 'string' && (i.tipo === 'carta' || i.tipo === 'produto') && typeof i.lojaId === 'string'
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

/** Itens de uma loja especifica. */
export function itensDaLoja(lojaId: string): Carrinho {
  return ler().filter(i => i.lojaId === lojaId)
}

/** Lojas presentes no carrinho, na ordem em que apareceram. */
export function lojasNoCarrinho(): string[] {
  const vistos: string[] = []
  for (const i of ler()) if (!vistos.includes(i.lojaId)) vistos.push(i.lojaId)
  return vistos
}

export function estaNoCarrinho(id: string): boolean {
  return ler().some(i => i.id === id)
}

/** Total de UNIDADES (nao de linhas): 1 produto com 3 unidades conta 3. */
export function contarItens(): number {
  return ler().reduce((s, i) => s + i.qtd, 0)
}

/**
 * Adiciona. Item que ja esta no carrinho nao duplica linha: a quantidade se
 * ajusta na PAGINA do carrinho, nao clicando N vezes no botao da vitrine (o
 * botao de la vira "No carrinho" justamente pra deixar isso claro).
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

/** Esvazia a loja inteira — usado depois que o pedido dela e criado. */
export function limparLoja(lojaId: string): void {
  gravar(ler().filter(i => i.lojaId !== lojaId))
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
