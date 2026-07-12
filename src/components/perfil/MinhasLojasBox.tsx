'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type LojaResumo = {
  id: string
  slug: string | null
  nome: string
  logo_url: string | null
  plano: string | null
  verificada: boolean | null
  cidade: string | null
  estado: string | null
  especialidades: string[] | null
}

const PRIORIDADE_PLANO: Record<string, number> = { premium: 0, pro: 1, basico: 2 }

function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

function badgePlano(plano: string | null): { label: string; style: React.CSSProperties } | null {
  const p = (plano || '').toLowerCase()
  if (p === 'premium') return { label: 'Premium', style: { background: 'linear-gradient(135deg,#a855f7,#ec4899)', color: '#fff' } }
  if (p === 'pro') return { label: 'Pro', style: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' } }
  if (p === 'basico') return { label: 'Basico', style: { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' } }
  return null
}

export default function MinhasLojasBox({ ownerUserId, isOwner }: { ownerUserId: string; isOwner?: boolean }) {
  const [lojas, setLojas] = useState<LojaResumo[]>([])
  const [carregou, setCarregou] = useState(false)

  useEffect(() => {
    if (!ownerUserId) return
    let ativo = true
    ;(async () => {
      const { data } = await supabase
        .from('lojas')
        .select('id, slug, nome, logo_url, plano, verificada, cidade, estado, especialidades')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'ativa')
      if (!ativo) return
      const ordenadas = (data || []).slice().sort(
        (a: LojaResumo, b: LojaResumo) =>
          (PRIORIDADE_PLANO[(a.plano || '').toLowerCase()] ?? 9) - (PRIORIDADE_PLANO[(b.plano || '').toLowerCase()] ?? 9)
      )
      setLojas(ordenadas)
      setCarregou(true)
    })()
    return () => { ativo = false }
  }, [ownerUserId])

  if (!carregou || lojas.length === 0) return null

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          border: '1px solid rgba(168,85,247,0.18)',
          borderRadius: 16,
          padding: 22,
          background: 'linear-gradient(180deg, rgba(168,85,247,0.05), rgba(255,255,255,0.01))',
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M3 8l1.5-4h11L17 8M3 8v8a1 1 0 001 1h12a1 1 0 001-1V8M3 8h14M8 17v-4h4v4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
          Minhas Lojas
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lojas.map((loja) => {
            const badge = badgePlano(loja.plano)
            const premium = (loja.plano || '').toLowerCase() === 'premium'
            const esp = (loja.especialidades || []).slice(0, 3).join(' \u00b7 ')
            const local = [loja.cidade, loja.estado].filter(Boolean).join(', ')
            const href = loja.slug ? `/lojas/${loja.slug}` : '#'
            return (
              <Link
                key={loja.id}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: premium ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  textDecoration: 'none',
                  color: 'inherit',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.transform = '')}
              >
                {premium && (
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg,#a855f7,#ec4899)' }} />
                )}

                {/* logo */}
                {loja.logo_url ? (
                  <img
                    src={loja.logo_url}
                    alt={loja.nome}
                    style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 12,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 17,
                      color: '#fff',
                      background: 'linear-gradient(135deg,#1f2430,#12151c)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {iniciais(loja.nome)}
                  </div>
                )}

                {/* info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15.5, fontWeight: 700, color: '#f0f0f0' }}>{loja.nome}</span>
                    {loja.verificada && (
                      <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#3b82f6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.2 2.2L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                    )}
                    {badge && (
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 8px', borderRadius: 6, ...badge.style }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {local && (
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 15s5-4.5 5-8.5A5 5 0 003 6.5C3 10.5 8 15 8 15z" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="6.5" r="1.6" stroke="currentColor" strokeWidth="1.3" /></svg>
                      {local}
                    </div>
                  )}
                  {esp && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{esp}</div>}
                </div>

                <span style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', flexShrink: 0, whiteSpace: 'nowrap' }}>Ver loja &rarr;</span>
              </Link>
            )
          })}
        </div>

        {isOwner && (
          <Link href="/minha-loja" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 12.5, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
            Gerenciar minhas lojas
          </Link>
        )}
      </div>
    </div>
  )
}
