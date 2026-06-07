'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'
import PastaFormModal from '@/components/pastas/PastaFormModal'

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
  const { showAlert } = useAppModal()
  const [pastas, setPastas] = useState<Pasta[]>([])
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [openCreate, setOpenCreate] = useState(false)

  async function load() {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) { window.location.href = '/login'; return }
      setUserId(userData.user.id)

      const { isPro: pro, isTrial: trial } = await getUserPlan(userData.user.id)
      setIsPro(pro || trial)

      // S40: normaliza travas conforme plano (PRO destrava tudo; Free mantem 1 ativa = mais antiga)
      await supabase.rpc('sync_pastas_lock')

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
  const freeAtLimit = !isPro && ativas.length >= LIMITE_PASTAS_FREE
  const lockedPastas = pastas.filter(p => p.locked)
  const showGhost = freeAtLimit && lockedPastas.length === 0

  async function handleSetAtiva(pastaId: string) {
    const { data, error } = await supabase.rpc('set_pasta_ativa', { p_pasta_id: pastaId })
    if (error || !data) { showAlert('Nao foi possivel ativar essa pasta. Tente novamente.', 'error'); return }
    await load()
  }

  function handleCreateClick() {
    if (!userId) return
    if (!isPro && ativas.length >= LIMITE_PASTAS_FREE) {
      showAlert('No plano Free voce pode ter 1 Pasta. Faca upgrade para o Pro e tenha pastas ilimitadas.', 'warning')
      return
    }
    setOpenCreate(true)
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
            onClick={handleCreateClick}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', border: 'none', color: '#000', padding: '11px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', boxShadow: '0 0 20px rgba(245,158,11,0.2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">{freeAtLimit
              ? <><rect x="4" y="9" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>
              : <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>}</svg>
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
            p.locked ? (
              <div key={p.id} style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', flexDirection: 'column' }}>
                {/* conteudo real, esmaecido */}
                <div style={{ filter: 'blur(2px)', opacity: 0.5, pointerEvents: 'none', userSelect: 'none', display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ height: 120, background: p.imagem_url ? `center/cover no-repeat url(${p.imagem_url})` : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!p.imagem_url && <span style={{ fontSize: 40, fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>{p.nome.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div style={{ padding: 14 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{p.qtd_cartas} carta{p.qtd_cartas !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {/* overlay travado */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, textAlign: 'center', background: 'rgba(8,10,15,0.55)' }}>
                  <div style={{ fontSize: 26 }}>🔒</div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', margin: 0 }}>Pasta travada</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.4, maxWidth: 200 }}>No Free só 1 pasta fica ativa. Torne esta a ativa ou destrave todas com o Pro.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, width: '100%', maxWidth: 200 }}>
                    <button onClick={() => handleSetAtiva(p.id)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#f0f0f0', padding: '8px 12px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Tornar ativa</button>
                    <Link href="/minha-conta" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', padding: '8px 12px', borderRadius: 9, fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>Fazer upgrade →</Link>
                  </div>
                </div>
              </div>
            ) : (
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
            )
          ))}

          {/* Card-fantasma da 2a pasta (gostinho de PRO) — mesmo padrao do Analytics */}
          {showGhost && (
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px dashed rgba(245,158,11,0.35)', minHeight: 248, display: 'flex', flexDirection: 'column' }}>
              {/* preview borrado */}
              <div style={{ filter: 'blur(4px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ height: 120, background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(239,68,68,0.18))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>P</span>
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700 }}>Sua próxima pasta</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>0 cartas</p>
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#60a5fa' }}>R$ 0,00</p>
                  </div>
                </div>
              </div>
              {/* overlay CTA */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ background: 'rgba(13,15,20,0.95)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '20px 18px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', margin: 0, marginBottom: 6 }}>Pastas ilimitadas no Pro</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45, margin: 0, marginBottom: 14 }}>O plano Free tem 1 pasta. Desbloqueie quantas quiser com o Pro.</p>
                  <Link href="/minha-conta" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#000', padding: '9px 18px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 800 }}>Fazer upgrade →</Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {openCreate && userId && (
        <PastaFormModal
          userId={userId}
          mode="create"
          onClose={() => setOpenCreate(false)}
          onSaved={(newId) => { window.location.href = `/minha-colecao/pastas/${newId}` }}
        />
      )}
    </AppLayout>
  )
}