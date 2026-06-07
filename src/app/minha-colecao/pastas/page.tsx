'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'

const LIMITE_PASTAS_FREE = 1

const fmtBRL = (v: any) => {
  const num = Number(v)
  if (!num || num <= 0) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

type Pasta = {
  id: string
  nome: string
  descricao: string | null
  imagem_url: string | null
  publico: boolean
  destaque: boolean
  locked: boolean
  view_mode: string
  ordem: number
  created_at: string
  updated_at: string
  qtd_cartas: number
  patrimonio: number
  carta_mais_cara_nome: string | null
  carta_mais_cara_valor: number
}

export default function PastasIndex() {
  const { showAlert, showPrompt } = useAppModal()
  const [pastas, setPastas] = useState<Pasta[]>([])
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) { window.location.href = '/login'; return }
      setUserId(userData.user.id)

      const { isPro: pro, isTrial: trial } = await getUserPlan(userData.user.id)
      setIsPro(pro || trial)

      const { data, error } = await supabase.rpc('minhas_pastas')
      if (error) {
        console.error('[pastas] minhas_pastas error:', error.message)
        setPastas([])
      } else {
        setPastas((data || []).map((p: any) => ({
          ...p,
          qtd_cartas: Number(p.qtd_cartas) || 0,
          patrimonio: Number(p.patrimonio) || 0,
          carta_mais_cara_valor: Number(p.carta_mais_cara_valor) || 0,
        })))
      }
    } catch (err: any) {
      console.error('[pastas] load error:', err?.message || err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const ativas = pastas.filter(p => !p.locked)

  async function handleCreate() {
    if (!userId || creating) return
    if (!isPro && ativas.length >= LIMITE_PASTAS_FREE) {
      showAlert('No plano Free voce pode ter 1 Pasta. Faca upgrade para o Pro e tenha pastas ilimitadas.', 'warning')
      return
    }
    const nome = await showPrompt({ message: 'Nome da nova Pasta', placeholder: 'Ex: Charizards, Base Set, Favoritas...' })
    if (!nome) return
    const nomeTrim = nome.trim()
    if (nomeTrim.length < 1 || nomeTrim.length > 60) {
      showAlert('O nome precisa ter entre 1 e 60 caracteres.', 'error'); return
    }
    setCreating(true)
    const { data, error } = await supabase
      .from('pastas')
      .insert({ user_id: userId, nome: nomeTrim })
      .select('id')
      .single()
    setCreating(false)
    if (error || !data) { showAlert('Erro ao criar a Pasta. Tente novamente.', 'error'); return }
    window.location.href = `/minha-colecao/pastas/${data.id}`
  }

  if (loading) {
    return <AppLayout><div className="p-6">Carregando pastas...</div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="p-6">

        {/* Voltar */}
        <Link href="/minha-colecao" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', marginBottom: 16 }}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Minha Coleção
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>Pastas</h1>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {isPro ? `${pastas.length} pasta${pastas.length !== 1 ? 's' : ''}` : `${ativas.length}/${LIMITE_PASTAS_FREE} pasta${ativas.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: creating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(245,158,11,0.2)', opacity: creating ? 0.7 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Criar Pasta
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
          Organize suas cartas em grupos. As cartas continuam na sua coleção — uma carta pode estar em várias pastas.
        </p>

        {/* Vazio */}
        {pastas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🗂️</p>
            <p style={{ fontSize: 16 }}>Você ainda não tem pastas.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Crie uma pasta e adicione cartas da sua coleção.</p>
          </div>
        )}

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {pastas.map((p) => (
            <Link
              key={p.id}
              href={`/minha-colecao/pastas/${p.id}`}
              style={{ textDecoration: 'none', color: 'inherit', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s' }}
            >
              {/* Capa */}
              <div style={{ height: 120, background: p.imagem_url ? `center/cover no-repeat url(${p.imagem_url})` : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {!p.imagem_url && (
                  <span style={{ fontSize: 40, fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>
                    {p.nome.charAt(0).toUpperCase()}
                  </span>
                )}
                {p.locked && (
                  <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                    🔒 Travada
                  </span>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {p.qtd_cartas} carta{p.qtd_cartas !== 1 ? 's' : ''}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                  {fmtBRL(p.patrimonio) ? (
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#60a5fa', letterSpacing: '-0.02em' }}>{fmtBRL(p.patrimonio)}</p>
                  ) : (
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)' }}>Sem valor estimado</p>
                  )}
                  {p.carta_mais_cara_nome && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      Topo: {p.carta_mais_cara_nome.replace(/\s*\([^)]*\)/, '')}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}