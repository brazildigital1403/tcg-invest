'use client'

import { CSSProperties, useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { alternar, estaNoCarrinho, assinarCarrinho, type TipoItem } from '@/lib/carrinho'
import { IconPlus, IconCheck } from '@/components/ui/Icons'

/**
 * "Adicionar ao carrinho" da pagina de produto.
 *
 * O carrinho mora no localStorage e nao exige login (o login so entra no
 * "Finalizar"), entao este botao funciona pra visitante — que e justamente
 * quem a gente nao quer mandar pra tela de cadastro antes de ter interesse.
 *
 * ★ Renderiza o estado neutro ate o primeiro efeito rodar. Ler localStorage no
 * primeiro render quebraria a hidratacao: o servidor nao tem como saber o que
 * tem no carrinho do visitante.
 */
export default function BotaoCarrinho({
  id,
  tipo,
  lojaId,
}: {
  id: string
  tipo: TipoItem
  lojaId: string
}) {
  // Estado EXTERNO (localStorage + evento): useSyncExternalStore le sem efeito
  // e sem setState em cascata. O snapshot do servidor e `false`, entao o
  // primeiro render casa com o HTML — o servidor nao tem como saber o que ha
  // no carrinho do visitante.
  const snapshot = useCallback(() => estaNoCarrinho(id), [id])
  const dentro = useSyncExternalStore(assinarCarrinho, snapshot, () => false)

  if (dentro) {
    return (
      <div style={S.linha}>
        <span style={S.ok}>
          <IconCheck size={15} color="var(--bx-green)" /> No carrinho
        </span>
        <button type="button" onClick={() => { alternar({ id, tipo, lojaId }) }} style={S.tirar}>
          Tirar
        </button>
        <Link href="/carrinho" style={S.ver}>Ver carrinho</Link>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => { alternar({ id, tipo, lojaId }) }}
      className="bx-cart-add"
      style={S.btn}
    >
      <IconPlus size={16} color="currentColor" />
      Adicionar ao carrinho
    </button>
  )
}

const S: Record<string, CSSProperties> = {
  btn: {
    width: '100%', minHeight: 46, marginTop: 9, borderRadius: 11,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text)', fontWeight: 700, fontSize: 13.5,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  linha: {
    display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, flexWrap: 'wrap',
    minHeight: 46,
  },
  ok: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 13, fontWeight: 700, color: 'var(--bx-green)',
  },
  tirar: {
    minHeight: 44, padding: '0 12px', borderRadius: 9,
    background: 'transparent', border: '1px solid var(--bx-border-2)',
    color: 'var(--bx-text-3)', fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  ver: {
    marginLeft: 'auto', minHeight: 44, display: 'inline-flex', alignItems: 'center',
    fontSize: 13, fontWeight: 700, color: 'var(--ac-1)', textDecoration: 'none',
  },
}
