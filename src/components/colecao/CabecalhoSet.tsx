'use client'

import { useState } from 'react'
import { IconBox, IconChevronDown } from '@/components/ui/Icons'

/**
 * Cabecalho de um grupo de set na Colecao: logo, quantas cartas do set a
 * pessoa tem, barra de completude e o valor do que ela tem naquele set.
 *
 * ★ Por que existe (#313, 12/09/2026). A Colecao era uma grade corrida sem
 * nenhuma nocao de set; o progresso so aparecia no perfil publico. O TCG
 * Vision usa a completude como regua principal da colecao -- e a leitura de
 * fichario. Medido na base: metade dos usuarios tem ate 3 sets e 10% tem 23
 * ou mais (o maior, 131). Por isso agrupar em blocos que abrem e fecham, e
 * nao uma secao de progresso em cima da grade: quem tem 100 sets nao chegaria
 * nas cartas no primeiro view.
 *
 * O visual da barra segue o do perfil (PerfilClient): azul abaixo de 50%,
 * marca da casa a partir de 50%, verde ao completar.
 */
export default function CabecalhoSet(props: {
  nome: string
  logoUrl?: string | null
  symbolUrl?: string | null
  /** Cartas distintas do set na colecao inteira (nao conta copia repetida). */
  coletadas: number
  /** Total do set. Nulo quando o set nao tem total cadastrado (promos). */
  total: number | null
  /** Valor ja formatado das cartas deste set, ou nulo sem preco. */
  valor: string | null
  /** Com filtro ativo: quantas cartas do set passaram no filtro. */
  resultados?: number | null
  aberto: boolean
  onToggle: () => void
}) {
  const [logoFalhou, setLogoFalhou] = useState(false)
  const { coletadas, total } = props
  const pct = total ? Math.min(100, Math.round((coletadas / total) * 100)) : null
  const faltam = total ? Math.max(0, total - coletadas) : 0
  const completo = pct === 100

  const detalhe = [
    props.resultados != null ? `${props.resultados} ${props.resultados === 1 ? 'carta' : 'cartas'} no filtro` : null,
    props.valor ? `${props.valor} neste set` : null,
    total ? (faltam > 0 ? `faltam ${faltam}` : 'set completo') : 'set sem total cadastrado',
  ].filter(Boolean).join(' · ')

  const mostrarLogo = !!props.logoUrl && !logoFalhou

  return (
    <button
      type="button"
      onClick={props.onToggle}
      aria-expanded={props.aberto}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        background: 'var(--bx-surface-2)', color: 'var(--bx-text)', fontFamily: 'inherit',
        border: `1px solid ${props.aberto ? 'rgba(245,158,11,0.3)' : 'var(--bx-border)'}`,
        borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
    >
      <span style={{ width: 52, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mostrarLogo ? (
          <img
            src={props.logoUrl!} alt="" loading="lazy" decoding="async"
            onError={() => setLogoFalhou(true)}
            style={{ maxWidth: 52, maxHeight: 30, objectFit: 'contain' }}
          />
        ) : props.symbolUrl ? (
          <img src={props.symbolUrl} alt="" loading="lazy" decoding="async" style={{ width: 24, height: 24, objectFit: 'contain', opacity: 0.8 }} />
        ) : (
          <IconBox size={20} color="var(--bx-text-3)" />
        )}
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.nome}</span>
          <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: completo ? 'var(--bx-green)' : 'var(--bx-amber)' }}>
            {coletadas}{total ? `/${total}` : ''}
            {pct !== null && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--bx-text-3)', marginLeft: 4 }}>{pct}%</span>}
          </span>
        </span>

        {pct !== null && (
          <span style={{ display: 'block', height: 6, marginTop: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
            <span style={{
              display: 'block', height: '100%', width: `${pct}%`, borderRadius: 99,
              background: completo ? 'var(--bx-green)' : pct >= 50 ? 'var(--bx-brand)' : 'var(--bx-blue)',
            }} />
          </span>
        )}

        <span style={{ display: 'block', fontSize: 11, color: 'var(--bx-text-3)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {detalhe}
        </span>
      </span>

      <span style={{ flexShrink: 0, display: 'flex', transform: props.aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
        <IconChevronDown size={16} color="var(--bx-text-3)" />
      </span>
    </button>
  )
}
