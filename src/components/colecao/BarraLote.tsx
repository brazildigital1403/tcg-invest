'use client'

/**
 * Barra fixa do lote (quadros 03a, 05 e 08). `position: sticky; bottom: 0`
 * dentro do conteiner que rola; quem monta a tela decide o conteiner e, se
 * houver bottom nav por cima, ajusta `bottom` pela classe `bx-tq-barra`.
 */

import { ReactNode } from 'react'
import Link from 'next/link'
import { IconPlus } from '@/components/ui/Icons'
import { IconCadeado, btnPrim, btnSec } from './TiqueBase'
import { Vagas, fmtBRL } from './tiqueComum'

export default function BarraLote({ modo, n, nesteResultado, valor, vagas, salvando, onVerLote, onSalvar, rodape }: {
  modo: 'busca' | 'set'
  n: number
  /** Quantas das marcadas estao no resultado atual (so modo busca). */
  nesteResultado: number
  valor: number
  vagas: Vagas
  salvando: boolean
  onVerLote: () => void
  onSalvar: () => void
  rodape?: ReactNode
}) {
  const corVagas = vagas.travado ? 'var(--bx-red)' : vagas.alerta === 'perto' ? 'var(--bx-amber)' : 'var(--bx-text-3)'
  const textoVagas = vagas.travado
    ? `Vagas: ${vagas.limite} de ${vagas.limite}. As outras cartas ficaram travadas.`
    : vagas.alerta === 'perto'
      ? `Vagas: ${vagas.usadasDepois} de ${vagas.limite} depois de salvar · faltam ${vagas.restantes}`
      : `Vagas: ${vagas.usadasDepois} de ${vagas.limite} depois de salvar${vagas.somam > 0 ? ' · o + não gasta vaga' : ''}`

  return (
    <div
      className="bx-tq-barra"
      role="region"
      aria-label="Lote selecionado"
      style={{ position: 'sticky', bottom: 0, zIndex: 20, margin: '12px 0 0', padding: '10px 16px calc(14px + env(safe-area-inset-bottom, 0px))', background: 'var(--bx-bg-elev)', borderTop: `1px solid ${vagas.travado ? 'rgba(239,68,68,0.45)' : vagas.alerta === 'perto' ? 'rgba(var(--ac-1-rgb), 0.5)' : 'var(--bx-border-2)'}`, boxShadow: '0 -12px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.2s ease' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 15 }}>
          {n} {n === 1 ? 'selecionada' : 'selecionadas'}
          {modo === 'busca' && (
            <span style={{ fontWeight: 400, color: 'var(--bx-text-2)', fontSize: 13 }}>
              {' · '}{nesteResultado === 0 ? 'nenhuma deste resultado' : `${nesteResultado} neste resultado`}
            </span>
          )}
        </b>
        {valor > 0 && <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>+ {fmtBRL(valor)} na coleção</span>}
      </div>

      {!vagas.semLimite && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: corVagas, flexWrap: 'wrap', transition: 'color 0.2s ease' }}>
          {vagas.travado && <IconCadeado size={14} color="var(--bx-red)" />}
          <span style={{ flex: 1, minWidth: 0 }}>{textoVagas}</span>
          {vagas.alerta !== 'ok' && (
            <Link href="/planos" prefetch={false} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 700, textDecoration: 'underline', color: 'var(--bx-text)', padding: '0 4px' }}>Ver planos</Link>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {modo === 'busca' && (
          <button type="button" style={{ ...btnSec, flex: 1 }} onClick={onVerLote} disabled={salvando}>Ver as {n}</button>
        )}
        <button type="button" style={{ ...btnPrim, flex: modo === 'busca' ? 1.6 : 1, opacity: salvando ? 0.7 : 1, cursor: salvando ? 'default' : 'pointer' }} onClick={onSalvar} disabled={salvando} aria-busy={salvando}>
          {salvando ? `Gravando ${n} de ${n}` : <><IconPlus size={16} color="currentColor" />Adicionar {n} à coleção</>}
        </button>
      </div>

      {rodape}
    </div>
  )
}
