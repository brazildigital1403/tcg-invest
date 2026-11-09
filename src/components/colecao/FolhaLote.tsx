'use client'

/**
 * "Seu lote" (quadro 03g): tudo que foi marcado em qualquer busca. A mesma
 * lista (`ListaLote`) serve o painel lateral do desktop (quadro 03f).
 */

import Image from 'next/image'
import { IconClose } from '@/components/ui/Icons'
import { Folha, IconAjuste, Pilula, btnPrim, btnSec, btnIcone, dica } from './TiqueBase'
import { CartaTique, ItemLote, PadraoLote, Vagas, numeroESet, pilulaDe } from './tiqueComum'

export type LinhaLote = { card_id: string; carta?: CartaTique; item: ItemLote }

export function ListaLote({ linhas, padrao, onAjustar, onRemover }: {
  linhas: LinhaLote[]
  padrao: PadraoLote
  onAjustar: (cardId: string) => void
  onRemover: (cardId: string) => void
}) {
  if (linhas.length === 0) {
    return <div style={{ ...dica, padding: '14px 0', textAlign: 'center' }}>Nenhuma carta marcada ainda.</div>
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: '0 12px', background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12 }}>
      {linhas.map((l, i) => {
        const nome = l.carta?.nome || 'Carta'
        const pilula = pilulaDe(l.item, padrao)
        return (
          <li key={l.card_id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, borderBottom: i < linhas.length - 1 ? '1px solid var(--bx-border)' : 'none' }}>
            <div style={{ width: 34, flex: 'none', aspectRatio: '245 / 342', borderRadius: 4, overflow: 'hidden', background: 'var(--bx-surface-2)' }}>
              {l.carta?.image_small && <Image src={l.carta.image_small} alt="" width={245} height={342} sizes="34px" style={{ width: '100%', height: 'auto', display: 'block' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</div>
              <div style={{ fontSize: 11.5, color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.carta ? numeroESet(l.carta) : 'De uma busca anterior'}</div>
            </div>
            {pilula && <Pilula texto={pilula} />}
            <button type="button" aria-label={`Ajustar ${nome}`} onClick={() => onAjustar(l.card_id)} style={btnIcone}><IconAjuste size={18} /></button>
            <button type="button" aria-label={`Tirar ${nome} do lote`} onClick={() => onRemover(l.card_id)} style={{ ...btnIcone, marginRight: -8 }}><IconClose size={16} /></button>
          </li>
        )
      })}
    </ul>
  )
}

export default function FolhaLote({ linhas, padrao, vagas, salvando, onAjustar, onRemover, onLimpar, onSalvar, onFechar }: {
  linhas: LinhaLote[]
  padrao: PadraoLote
  vagas: Vagas
  salvando: boolean
  onAjustar: (cardId: string) => void
  onRemover: (cardId: string) => void
  onLimpar: () => void
  onSalvar: () => void
  onFechar: () => void
}) {
  const n = linhas.length
  return (
    <Folha
      titulo={`Seu lote · ${n} ${n === 1 ? 'carta' : 'cartas'}`}
      subtitulo="Tudo que você marcou até agora, em qualquer busca. Nada entra na coleção até você adicionar."
      onFechar={onFechar}
      rodape={
        <>
          {!vagas.semLimite && (
            <div style={{ fontSize: 12, color: vagas.travado ? 'var(--bx-red)' : vagas.alerta === 'perto' ? 'var(--bx-amber)' : 'var(--bx-text-3)' }}>
              Vagas: {vagas.usadasDepois} de {vagas.limite} depois de salvar
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...btnSec, flex: 1 }} onClick={onLimpar} disabled={n === 0 || salvando}>Limpar seleção</button>
            <button type="button" style={{ ...btnPrim, flex: 1.5, opacity: n === 0 || salvando ? 0.6 : 1 }} onClick={onSalvar} disabled={n === 0 || salvando}>
              {salvando ? 'Gravando…' : `Adicionar ${n} à coleção`}
            </button>
          </div>
        </>
      }
    >
      <ListaLote linhas={linhas} padrao={padrao} onAjustar={onAjustar} onRemover={onRemover} />
      {n > 0 && <span style={dica}>O ícone ajusta variante, idioma e quantidade. O X tira do lote, e a carta volta ao tique vazio no resultado.</span>}
    </Folha>
  )
}
