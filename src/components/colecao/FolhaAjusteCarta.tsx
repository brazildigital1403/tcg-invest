'use client'

/**
 * Folha "Ajustar esta carta" (quadros 03b e 07): imagem grande, preco do
 * Mercado Brasileiro por variante, variante (riscada quando a carta nao
 * existe nela), idioma, quantidade. Abre so pelo icone de ajuste.
 */

import { useState } from 'react'
import Image from 'next/image'
import { IconCheck } from '@/components/ui/Icons'
import { Folha, Segmentos, ChipsIdioma, Contador, btnPrim, btnLink, rotulo, dica } from './TiqueBase'
import {
  AjusteCarta, CartaTique, PadraoLote, VARIANTES, IDIOMAS_PRINCIPAIS, IDIOMAS_OUTROS,
  fmtBRL, numeroESet, resolverItem, temAlgumPreco, temPrecoVariante, totalTenho, precoUnitario, rotuloVariante,
} from './tiqueComum'

export default function FolhaAjusteCarta({ carta, ajuste, padrao, onAplicar, onUsarComoPadrao, onFechar }: {
  carta: CartaTique
  /** Ajuste atual da carta (vazio quando ainda nao marcada ou seguindo o padrao). */
  ajuste: AjusteCarta
  padrao: PadraoLote
  onAplicar: (ajuste: AjusteCarta) => void
  /** Promove variante + idioma para o padrao do lote; a quantidade fica so nesta carta. */
  onUsarComoPadrao: (padrao: PadraoLote, quantity: number) => void
  onFechar: () => void
}) {
  const inicial = resolverItem(carta.card_id, ajuste, padrao, carta)
  const [variante, setVariante] = useState(inicial.variante)
  const [idioma, setIdioma] = useState(inicial.idioma)
  const [quantity, setQuantity] = useState(inicial.quantity)

  const tenho = totalTenho(carta)
  const temPreco = temAlgumPreco(carta)
  // Promo e Pokeball so aparecem quando a carta tem preco nelas: sao raras e
  // encheriam o segmento de risco.
  const opcoes = VARIANTES
    .filter(v => ['normal', 'reverse', 'foil'].includes(v.key) || temPrecoVariante(carta, v.key))
    .map(v => ({ key: v.key, label: v.label, riscado: temPreco && !temPrecoVariante(carta, v.key) }))
  const linhaPreco = VARIANTES
    .filter(v => temPrecoVariante(carta, v.key))
    .map(v => `${rotuloVariante(v.key)} ${fmtBRL(precoUnitario(carta, v.key))}`)
    .join(' · ')

  return (
    <Folha
      titulo="Ajustar esta carta"
      onFechar={onFechar}
      rodape={
        <>
          <button type="button" style={btnPrim} onClick={() => onAplicar({ variante, idioma, quantity })}>Aplicar só nesta carta</button>
          <button type="button" style={{ ...btnLink, alignSelf: 'center' }} onClick={() => onUsarComoPadrao({ variante, idioma }, quantity)}>Usar isto como padrão do lote</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 112, flex: 'none', borderRadius: 8, overflow: 'hidden', boxShadow: '0 0 0 2px var(--ac-1)', background: 'var(--bx-surface)', aspectRatio: '245 / 342' }}>
          {carta.image_small ? (
            <Image src={carta.image_small} alt={carta.nome} width={245} height={342} sizes="112px" style={{ width: '100%', height: 'auto', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bx-text-faint)' }}>Sem imagem</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>{carta.nome}</div>
          <div style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>{[numeroESet(carta), carta.raridade].filter(Boolean).join(' · ')}</div>
          {tenho > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--bx-green)' }}>
              <IconCheck size={13} color="var(--bx-green)" /> Você tem {tenho}
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--ac-1)', fontWeight: 600, lineHeight: 1.4 }}>
            {linhaPreco ? `${linhaPreco} · Mercado Brasileiro` : 'Sem preço no Mercado Brasileiro'}
          </div>
          {linhaPreco && <div style={dica}>Preço da variante escolhida, só como referência.</div>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>Variante</span>
        <Segmentos opcoes={opcoes} valor={variante} onChange={setVariante} rotuloGrupo="Variante" />
        {opcoes.some(o => o.riscado) && <span style={dica}>Riscado: esta carta não existe nessa variante.</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>Idioma</span>
        <ChipsIdioma valor={idioma} onChange={setIdioma} principais={IDIOMAS_PRINCIPAIS} outros={IDIOMAS_OUTROS} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>{tenho > 0 ? 'Somar' : 'Quantidade'}</span>
        <Contador valor={quantity} onChange={setQuantity} rotuloGrupo={tenho > 0 ? 'Quantas cópias somar' : 'Quantidade'} />
        <span style={dica}>
          {tenho > 0
            ? `Quantas cópias somar às ${tenho} que você já tem. Mesma variante e idioma entram na pilha que existe e não gastam vaga.`
            : 'Cópias da mesma carta, variante e idioma contam uma vaga só.'}
        </span>
      </div>
    </Folha>
  )
}
