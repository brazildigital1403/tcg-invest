'use client'

import { CSSProperties, useCallback, useSyncExternalStore } from 'react'
import { alternar, qtdNoCarrinho, assinarCarrinho, type TipoItem } from '@/lib/carrinho'
import { IconPlus, IconCheck } from '@/components/ui/Icons'

/**
 * O "+" que poe um item na sacola sem sair da tela (25/11/2026).
 *
 * ★ POR QUE EXISTE. Juntar cartas de um vendedor exigia abrir o anuncio de
 * cada uma, adicionar e voltar -- e na vitrine da loja e no perfil o botao
 * principal ainda ia direto ao checkout de UM item, que e o caminho de
 * compras e fretes separados. Este botao alterna: tocar poe, tocar de novo
 * tira. Nunca abre checkout.
 *
 * Tres formas, o mesmo gesto:
 *   - `mini`:  circulo no canto da foto (grade "Mais deste vendedor")
 *   - `linha`: quadrado de 44 na linha da folha
 *   - `largo`: botao de largura cheia nos cards da vitrine e do perfil
 *
 * ★ ALVO DE TOQUE DE 44 NAS TRES. No `mini` o circulo visivel tem 32 px
 * (maior cobriria a carta), mas o botao clicavel e 44x44 em volta dele.
 */
export default function BotaoMais({
  id,
  tipo,
  vendedorId,
  lojaId = null,
  nome,
  forma,
  style,
}: {
  id: string
  tipo: TipoItem
  /** `users.id` de quem vende -- o agrupador da sacola. */
  vendedorId: string
  /** Obrigatoria para produto; a sacola descarta produto sem loja. */
  lojaId?: string | null
  /** Para o leitor de tela: "Adicionar Zorua ao carrinho". */
  nome: string
  forma: 'mini' | 'linha' | 'largo'
  style?: CSSProperties
}) {
  // Estado externo (localStorage + evento), no mesmo padrao do BotaoCarrinho:
  // snapshot NUMBER, e 0 no servidor -- o HTML nasce sempre com "+".
  const snap = useCallback(() => qtdNoCarrinho(id), [id])
  const qtd = useSyncExternalStore(assinarCarrinho, snap, () => 0)
  const na = qtd > 0

  // Produto sem loja nao entra na sacola (e descartado na leitura). Melhor nao
  // oferecer o botao do que gravar um item que some.
  if (tipo === 'produto' && !lojaId) return null

  const rotulo = na ? `Tirar ${nome} do carrinho` : `Adicionar ${nome} ao carrinho`
  const clicar = (e: React.MouseEvent) => {
    // Na grade o botao mora DENTRO da area do card, que e um link: sem isto o
    // toque no "+" tambem abriria o anuncio.
    e.preventDefault()
    e.stopPropagation()
    alternar({ id, tipo, vendedorId, lojaId })
  }

  if (forma === 'largo') {
    return (
      <button
        type="button"
        onClick={clicar}
        aria-pressed={na}
        aria-label={rotulo}
        className={na ? 'bx-mais-largo bx-mais-on' : 'bx-ctx-comprador bx-mais-largo'}
        style={{ ...S.largo, ...(na ? S.largoOn : S.largoOff), ...style }}
      >
        {na ? <IconCheck size={14} color="currentColor" /> : <IconPlus size={14} color="currentColor" />}
        {na ? 'Na sacola' : 'Adicionar'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={clicar}
      aria-pressed={na}
      aria-label={rotulo}
      title={na ? 'No carrinho. Toque para tirar.' : 'Adicionar ao carrinho'}
      className="bx-mais"
      style={{ ...(forma === 'mini' ? S.alvoMini : S.alvoLinha), ...style }}
    >
      <span style={{
        ...(forma === 'mini' ? S.circulo : S.quadrado),
        ...(forma === 'mini' ? (na ? S.on : S.off) : (na ? S.onLinha : S.offLinha)),
      }}>
        {na ? <IconCheck size={forma === 'mini' ? 15 : 17} color="currentColor" /> : <IconPlus size={forma === 'mini' ? 15 : 17} color="currentColor" />}
      </span>
    </button>
  )
}

const S: Record<string, CSSProperties> = {
  alvoMini: {
    width: 44, height: 44, padding: 0, border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  alvoLinha: {
    width: 44, height: 44, padding: 0, border: 'none', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  circulo: {
    width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.45)',
  },
  quadrado: {
    width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  // Fora: fundo escuro translucido -- no `mini` fica sobre a arte da carta.
  off: { background: 'rgba(8,10,15,0.82)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)' },
  on: { background: 'var(--bx-green)', border: '1px solid transparent', color: 'var(--bx-brand-ink)' },
  // Na linha da folha o "na sacola" e suave: 8 linhas verdes solidas numa
  // tela so gritariam mais que o preco.
  offLinha: { background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)' },
  onLinha: { background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.5)', color: 'var(--bx-green)' },
  largo: {
    width: '100%', minHeight: 44, borderRadius: 10, boxSizing: 'border-box', padding: '0 10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  },
  largoOff: { background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', border: 'none' },
  largoOn: {
    background: 'rgba(34,197,94,0.12)', color: 'var(--bx-green)',
    border: '1px solid rgba(34,197,94,0.5)',
  },
}
