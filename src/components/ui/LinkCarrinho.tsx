'use client'

import { CSSProperties, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { contarItens, assinarCarrinho } from '@/lib/carrinho'
import { IconCarrinho } from '@/components/ui/Icons'

/**
 * Atalho pro carrinho no header publico, com contador.
 *
 * ★ So aparece quando ha item. Um icone de carrinho sempre vazio no topo de um
 * site que ainda esta comecando a vender diz "aqui nao tem nada" toda vez que
 * a pagina carrega. Some sozinho quando o carrinho esvazia.
 *
 * Renderiza null ate montar: contagem vem do localStorage e nao existe no
 * servidor (quebraria a hidratacao).
 */
export default function LinkCarrinho({ style }: { style?: CSSProperties }) {
  // useSyncExternalStore em vez de useEffect+useState: o carrinho e estado
  // EXTERNO (localStorage + evento). O snapshot do servidor e 0, entao o
  // primeiro render casa com o HTML e nao ha erro de hidratacao.
  const n = useSyncExternalStore(assinarCarrinho, contarItens, () => 0)

  // ★ O ICONE FICA SEMPRE (08/09/2026). Antes havia `if (n === 0) return null`
  //   e o carrinho DESAPARECIA do header quando vazio -- o usuario perdia o
  //   ponto de referencia justamente quando ainda nao comprou nada. Decisao do
  //   Du: atalho de estado nao pisca.
  //
  //   O que aquele `return null` evitava por ACIDENTE era o descasamento de
  //   hidratacao: o snapshot do servidor e sempre 0, entao com badge fixo o
  //   HTML sairia sem numero e o cliente pintaria um. Por isso o badge e que e
  //   condicional agora, nao o link -- o icone sai igual nos dois lados e so o
  //   badge aparece depois, quando ha item de verdade.
  return (
    <Link
      href="/carrinho"
      style={{ ...S.btn, ...style }}
      aria-label={n === 0 ? 'Carrinho vazio' : `Carrinho com ${n} ${n === 1 ? 'unidade' : 'unidades'}`}
    >
      <IconCarrinho size={19} color="currentColor" />
      {n > 0 && <span style={S.badge}>{n}</span>}
    </Link>
  )
}

const S: Record<string, CSSProperties> = {
  btn: {
    position: 'relative', width: 44, height: 44, flex: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, color: 'var(--bx-text-2)', textDecoration: 'none',
  },
  badge: {
    position: 'absolute', top: 4, right: 3,
    minWidth: 17, height: 17, padding: '0 4px', borderRadius: 100,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
    fontSize: 10.5, fontWeight: 800, lineHeight: '17px', textAlign: 'center',
  },
}
