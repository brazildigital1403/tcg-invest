'use client'

import { CSSProperties, useCallback, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { alternar, definirQtd, qtdNoCarrinho, contarItens, assinarCarrinho, type TipoItem } from '@/lib/carrinho'
import { IconPlus, IconMinus, IconCheck, IconTrash, IconArrowRight } from '@/components/ui/Icons'

/**
 * Carrinho da pagina de detalhe (produto e carta).
 *
 * O carrinho mora no localStorage e nao exige login (o login so entra no
 * "Finalizar"), entao funciona pra visitante -- que e justamente quem a gente
 * nao quer mandar pra tela de cadastro antes de ter interesse.
 *
 * ★ REDESENHADO EM 08/09/2026. O estado "ja esta no carrinho" era uma LINHA
 * com tres hierarquias soltas: um rotulo verde nao-clicavel, um botao
 * "Tirar" (acao destrutiva, a unica com cara de botao) e um link "Ver
 * carrinho" jogado no canto por `marginLeft: auto` -- com 112px de vazio
 * entre os dois em 375px, e 149px em 1440. Alinhar nao e agrupar: nada dizia
 * que as tres coisas eram o mesmo assunto, e a acao destrutiva tinha mais
 * peso que a de avancar.
 *
 * Agora e UMA caixa com duas faixas, no padrao que Amazon, Mercado Livre,
 * Shopee e Magalu usam nesse estado:
 *   1. confirmacao + QUANTIDADE (o botao vira o controle, no mesmo lugar)
 *   2. "Ver carrinho" ocupando a linha inteira, com a contagem
 *
 * ★ A QUANTIDADE PASSOU A VIVER AQUI. Antes so dava pra ajustar dentro de
 * /carrinho -- o inverso do padrao: quantidade e decisao da pagina do
 * produto, nao do carrinho. Na CARTA nao existe: peca unica e sempre 1, e
 * ali o mesmo espaco mostra so a lixeira. E uma prop, nao um componente novo.
 */
export default function BotaoCarrinho({
  id,
  tipo,
  lojaId,
  estoque = 1,
}: {
  id: string
  tipo: TipoItem
  lojaId: string
  /** Teto do "+". A carta ignora (sempre 1). O servidor revalida no checkout. */
  estoque?: number
}) {
  // Estado EXTERNO (localStorage + evento): `useSyncExternalStore` le sem
  // efeito e sem setState em cascata. O snapshot e NUMBER (0 = fora) e nao
  // objeto -- ver `qtdNoCarrinho`. Snapshot do servidor e 0, entao o primeiro
  // render casa com o HTML: o servidor nao sabe o que ha no carrinho de quem
  // esta visitando.
  const snapQtd = useCallback(() => qtdNoCarrinho(id), [id])
  const qtd = useSyncExternalStore(assinarCarrinho, snapQtd, () => 0)

  const snapTotal = useCallback(() => contarItens(), [])
  const total = useSyncExternalStore(assinarCarrinho, snapTotal, () => 0)

  const podeQtd = tipo !== 'carta'
  const noTeto = qtd >= Math.max(1, estoque)

  if (qtd === 0) {
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

  return (
    // `.bx-ctx-comprador`: sem ela o `var(--ac-1)` daqui resolvia pro AMBAR do
    // app e brigava com o gradiente roxo-rosa do "Comprar agora" logo acima --
    // dois acentos a 9px de distancia. A /produto ja tinha corrigido isso no
    // preco; este componente ficou de fora.
    <div className="bx-ctx-comprador bx-cart-box" style={S.box}>
      <div style={S.faixa1}>
        <span style={S.ok}>
          <IconCheck size={16} color="var(--bx-green)" />
          No carrinho
        </span>

        <div style={S.stepper}>
          <button
            type="button"
            className="bx-cart-step"
            onClick={() => { podeQtd && qtd > 1 ? definirQtd(id, qtd - 1) : alternar({ id, tipo, lojaId }) }}
            aria-label={podeQtd && qtd > 1 ? 'Diminuir quantidade' : 'Remover do carrinho'}
            style={S.step}
          >
            {/* Lixeira no lugar do "-" quando cair pra zero: e o padrao de
                iFood, Shopee e Amazon Fresh, e evita a acao destrutiva solta
                num botao proprio. */}
            {podeQtd && qtd > 1
              ? <IconMinus size={14} color="var(--bx-text-2)" />
              : <IconTrash size={15} color="var(--bx-text-2)" />}
          </button>

          {podeQtd && (
            <>
              <span style={S.num} aria-live="polite">{qtd}</span>
              <button
                type="button"
                className="bx-cart-step"
                onClick={() => { if (!noTeto) definirQtd(id, qtd + 1) }}
                disabled={noTeto}
                aria-label="Aumentar quantidade"
                style={{ ...S.step, opacity: noTeto ? 0.35 : 1, cursor: noTeto ? 'not-allowed' : 'pointer' }}
              >
                <IconPlus size={14} color="var(--bx-text-2)" />
              </button>
            </>
          )}
        </div>
      </div>

      <Link href="/carrinho" className="bx-cart-ver" style={S.faixa2}>
        <span style={S.verTxt}>
          Ver carrinho
          <span style={S.contagem}>{total} {total === 1 ? 'item' : 'itens'}</span>
        </span>
        <IconArrowRight size={16} color="var(--ac-1)" />
      </Link>
    </div>
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
  box: {
    width: '100%', marginTop: 9, borderRadius: 12, overflow: 'hidden',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
  },
  faixa1: {
    minHeight: 52, padding: '4px 4px 4px 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  // Texto em `--bx-text` e nao no verde: o icone ja carrega o sinal, e verde
  // em texto de 13,5px ficava numa terceira cor na mesma faixa.
  ok: { display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: 'var(--bx-text)' },
  stepper: {
    display: 'inline-flex', alignItems: 'center', flex: 'none',
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)',
    borderRadius: 10, overflow: 'hidden',
  },
  step: {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    padding: 0,
  },
  num: {
    minWidth: 32, textAlign: 'center', fontSize: 14, fontWeight: 800,
    fontVariantNumeric: 'tabular-nums', color: 'var(--bx-text)',
    borderLeft: '1px solid var(--bx-border)', borderRight: '1px solid var(--bx-border)',
    lineHeight: '44px',
  },
  faixa2: {
    minHeight: 48, padding: '0 12px', borderTop: '1px solid var(--bx-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    textDecoration: 'none', color: 'inherit',
  },
  verTxt: { display: 'inline-flex', alignItems: 'baseline', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--bx-text)' },
  contagem: { fontSize: 12, fontWeight: 600, color: 'var(--bx-text-2)' },
}
