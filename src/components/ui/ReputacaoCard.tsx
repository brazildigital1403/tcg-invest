'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * Reputacao = avaliacoes RECEBIDAS por um usuario (avaliado_id = userId).
 * Usado em /minha-conta (proprio), /perfil/[id] (publico) e /lojas/[slug] (loja).
 * Le via RPC get_avaliacoes_usuario (SECURITY DEFINER; junta nome do avaliador +
 * carta/item + flag `verificada`). `verificada = true` quando a avaliacao veio de
 * um pedido real (compra pos-venda) — mostra o selo "Compra verificada".
 */

type Avaliacao = {
  id: string
  estrelas: number
  comentario: string | null
  papel: string
  created_at: string
  avaliador_id: string
  avaliador_nome: string
  card_name: string | null
  verificada?: boolean | null
}

const SURFACE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  fontFamily: "'DM Sans', system-ui, sans-serif",
}
const TITULO: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
  display: 'flex', alignItems: 'center', gap: 8,
}

function Estrelas({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, lineHeight: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill={i <= n ? '#f59e0b' : 'none'}>
          <path
            d="M10 2l2.4 5 5.4.5-4.1 3.7 1.2 5.3L10 14.9 5.1 16.2l1.2-5.3L2.2 7.5l5.4-.5L10 2z"
            stroke={i <= n ? '#f59e0b' : 'rgba(255,255,255,0.25)'}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  )
}

function fmtData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function ReputacaoCard({
  userId,
  titulo = 'Reputação',
  esconderSeVazio = false,
}: {
  userId: string
  titulo?: string
  esconderSeVazio?: boolean
}) {
  const [avs, setAvs] = useState<Avaliacao[] | null>(null)

  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      const { data } = await supabase.rpc('get_avaliacoes_usuario', { p_user_id: userId })
      if (active) setAvs((data as Avaliacao[]) || [])
    })()
    return () => {
      active = false
    }
  }, [userId])

  if (avs === null) return null // carregando: nao pisca
  if (avs.length === 0 && esconderSeVazio) return null

  const total = avs.length
  const media = total ? avs.reduce((s, a) => s + (a.estrelas || 0), 0) / total : 0

  return (
    <div style={{ ...SURFACE, padding: 20, marginBottom: 24 }}>
      <p style={TITULO}>
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path d="M10 2l2.4 5 5.4.5-4.1 3.7 1.2 5.3L10 14.9 5.1 16.2l1.2-5.3L2.2 7.5l5.4-.5L10 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        {titulo}
      </p>

      {total === 0 ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          Ainda sem avaliações. Conclua negociações no marketplace para receber as primeiras.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: '#f0f0f0', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {media.toFixed(1).replace('.', ',')}
            </span>
            <div>
              <Estrelas n={Math.round(media)} size={17} />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {total} avaliaç{total > 1 ? 'ões' : 'ão'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {avs.map((a) => (
              <div key={a.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#f0f0f0' }}>
                    {(a.avaliador_nome || 'Usuário').trim()}
                  </span>
                  <Estrelas n={a.estrelas} />
                </div>
                {a.comentario && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: 5 }}>
                    {a.comentario}
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                  {a.verificada ? (
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ Compra verificada</span>
                  ) : (
                    a.papel === 'comprador' ? 'Avaliou como comprador' : 'Avaliou como vendedor'
                  )}
                  {a.card_name ? ` · ${a.card_name}` : ''} · {fmtData(a.created_at)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
