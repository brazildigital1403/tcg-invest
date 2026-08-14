'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface RankingRow {
  userId: string
  nome: string
  valor: number
  legenda: string
}

const FONT = "'DM Sans', system-ui, sans-serif"
const TABS = [
  { key: 'maior', label: 'Maior coleção', unidade: 'cartas' },
  { key: 'completo', label: 'Mais completo', unidade: 'no melhor set' },
] as const

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase() || '?'
}

function fmtValor(n: number, tab: 'maior' | 'completo') {
  return tab === 'completo' ? `${n}%` : new Intl.NumberFormat('pt-BR').format(n)
}

export default function DestaqueClient({ maiorColecao, maisCompleto }: { maiorColecao: RankingRow[]; maisCompleto: RankingRow[] }) {
  const [tab, setTab] = useState<'maior' | 'completo'>('maior')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const lista = tab === 'maior' ? maiorColecao : maisCompleto
  const unidade = TABS.find(t => t.key === tab)!.unidade
  const top5 = lista.slice(0, 5)
  const minhaPos = useMemo(() => userId ? lista.findIndex(r => r.userId === userId) : -1, [lista, userId])

  if (lista.length === 0) {
    return (
      <div style={{ fontFamily: FONT, color: '#f0f0f0', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '40px 26px', textAlign: 'center', marginTop: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Ainda não há dados suficientes pra montar o ranking.</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: FONT, color: '#f0f0f0', marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 4, marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: FONT,
            background: tab === t.key ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: tab === t.key ? '#f0f0f0' : 'rgba(255,255,255,0.5)',
            boxShadow: tab === t.key ? 'inset 0 0 0 1px rgba(255,255,255,0.12)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {top5.map((r, i) => {
          const top3 = i < 3
          return (
            <div key={r.userId} style={{
              display: 'grid', gridTemplateColumns: '28px 40px 1fr auto', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
              background: top3 ? 'linear-gradient(90deg, rgba(245,158,11,0.09), rgba(245,158,11,0.02))' : 'rgba(255,255,255,0.03)',
              boxShadow: top3 ? 'inset 0 0 0 1px rgba(245,158,11,0.18)' : 'none',
            }}>
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 700, fontSize: 13, textAlign: 'center', color: top3 ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}>{i + 1}</div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: top3 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: top3 ? '#1a0e00' : 'rgba(255,255,255,0.5)' }}>{iniciais(r.nome)}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}{r.userId === userId ? ' (você)' : ''}</p>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', margin: '1px 0 0' }}>{r.legenda}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{fmtValor(r.valor, tab)}</p>
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{unidade}</p>
              </div>
            </div>
          )
        })}

        {minhaPos >= 5 && (
          <>
            <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', padding: '2px 0' }}>⋯</div>
            <div style={{
              display: 'grid', gridTemplateColumns: '28px 40px 1fr auto', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)',
            }}>
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 700, fontSize: 13, textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>{minhaPos + 1}</div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#f0f0f0' }}>{iniciais(lista[minhaPos].nome)}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Você</p>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', margin: '1px 0 0' }}>{lista[minhaPos].legenda}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 14, fontWeight: 700, margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{fmtValor(lista[minhaPos].valor, tab)}</p>
                <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{unidade}</p>
              </div>
            </div>
          </>
        )}

        {userId && minhaPos === -1 && (
          <p style={{ textAlign: 'center', fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 10 }}>
            Você ainda não aparece aqui — adicione cartas à coleção ou deixe seu perfil público em <a href="/minha-conta" style={{ color: '#f59e0b' }}>Minha Conta</a>.
          </p>
        )}
      </div>
    </div>
  )
}
