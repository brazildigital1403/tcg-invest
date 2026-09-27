'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatarBRL } from '@/lib/leilao'
import { idsNovos, inicialApelido, tempoDesde, type LancePublico } from '@/lib/leilao-rodada'

/**
 * "Lances ao vivo" do lote no ar. Os dados chegam no polling da rodada (os
 * ultimos 8 da view `leilao_lances_publico`, apelido mascarado): este
 * componente nao busca nada.
 *
 * Linha que chegou nesta leitura entra com destaque de 0.2s (sem animacao com
 * prefers-reduced-motion). A de cima (o lance que vale agora) fica no acento.
 * No celular mostra 3 linhas e "Ver mais"; no desktop, todas.
 *
 * Quem usa monta com `key` do lote: lote novo comeca sem memoria de ids (nada
 * pisca na troca) e com a lista recolhida.
 */
export default function FeedLances({
  loteId,
  lances,
  nLances,
  lanceInicialCents,
  agoraMs,
}: {
  loteId: string
  lances: LancePublico[]
  /** Total de lances do lote (o feed so traz os ultimos). */
  nLances: number
  lanceInicialCents: number
  /** Relogio do servidor (ja corrigido), para o "ha 12s". */
  agoraMs: number
}) {
  // Linhas novas desta leitura. Lote novo zera a memoria (sem destaque na troca).
  const vistosRef = useRef<{ lote: string; ids: Set<number> } | null>(null)
  const [novos, setNovos] = useState<Set<number>>(new Set())
  const [aberto, setAberto] = useState(false)
  const chave = lances.map(l => l.id).join(',')

  useEffect(() => {
    const ant = vistosRef.current && vistosRef.current.lote === loteId ? vistosRef.current.ids : null
    const n = idsNovos(ant, lances)
    vistosRef.current = { lote: loteId, ids: new Set(lances.map(l => l.id)) }
    if (n.size === 0) return
    setNovos(n)
    const t = setTimeout(() => setNovos(new Set()), 600)
    return () => clearTimeout(t)
    // `chave` resume a lista: so reage quando os ids mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, loteId])

  const total = Math.max(nLances, lances.length)

  return (
    <section aria-labelledby="fl-titulo" style={S.caixa}>
      <style>{`
        .fl-linha { transition: background 0.2s ease; }
        .fl-nova { animation: fl-entra 0.2s ease; background: rgba(var(--ac-1-rgb), 0.10); }
        @keyframes fl-entra { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .fl-mais { transition: background 0.15s ease; }
        .fl-mais:hover { background: var(--bx-surface-2); }
        .fl-mais:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .fl-mais { display: none; }
        @media (max-width: 1023px) {
          .fl-lista:not(.fl-aberto) .fl-linha:nth-child(n+4) { display: none; }
          .fl-mais { display: flex; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fl-nova { animation: none; }
          .fl-linha { transition: none; }
        }
      `}</style>
      <div style={S.cab}>
        <h2 id="fl-titulo" style={S.h2}>Lances ao vivo</h2>
        {total > 0 && <span style={S.total}>{total === 1 ? '1 lance' : `${total} lances`}</span>}
      </div>

      {lances.length === 0 ? (
        <p style={S.vazio}>Seja o primeiro lance · inicial {formatarBRL(lanceInicialCents)}</p>
      ) : (
        <>
          <ol className={`fl-lista${aberto ? ' fl-aberto' : ''}`} style={S.lista}>
            {lances.map((l, i) => (
              <li
                key={l.id}
                className={`fl-linha${novos.has(l.id) ? ' fl-nova' : ''}`}
                style={{ ...S.linha, ...(i === 0 ? S.linhaTopo : null), ...(i === lances.length - 1 ? S.linhaUltima : null) }}
              >
                <span aria-hidden style={S.av}>{inicialApelido(l.apelido)}</span>
                <span style={S.apelido}>{l.apelido}</span>
                {l.automatico && <span style={S.auto}>automático</span>}
                <span style={S.valor}>{formatarBRL(l.valorCents)}</span>
                <span style={S.tempo}>{tempoDesde(l.createdAt, agoraMs)}</span>
              </li>
            ))}
          </ol>
          {lances.length > 3 && (
            <button type="button" className="fl-mais" style={S.mais} aria-expanded={aberto} onClick={() => setAberto(v => !v)}>
              {aberto ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  caixa: {
    display: 'flex', flexDirection: 'column', gap: 2, padding: 14, borderRadius: 16,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', minWidth: 0,
  },
  cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  h2: { margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--bx-text)' },
  total: { fontSize: 12, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  vazio: { margin: 0, padding: '8px 0', fontSize: 13, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  linha: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderRadius: 6, minWidth: 0,
    borderBottom: '1px solid var(--bx-border)', fontSize: 13, color: 'var(--bx-text-2)',
  },
  linhaTopo: { color: 'var(--ac-1)' },
  linhaUltima: { borderBottom: 'none' },
  av: {
    width: 22, height: 22, flex: '0 0 22px', borderRadius: '50%', background: 'var(--bx-surface-3)',
    display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: 'var(--bx-text-2)',
  },
  apelido: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  auto: {
    flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--bx-text-3)', border: '1px solid var(--bx-border-2)',
    borderRadius: 999, padding: '0 6px', lineHeight: '16px',
  },
  valor: { marginLeft: 'auto', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  tempo: { width: 40, flexShrink: 0, textAlign: 'right', fontSize: 11, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  mais: {
    marginTop: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10,
    background: 'transparent', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
}
