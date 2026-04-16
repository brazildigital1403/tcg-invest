'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import { useAppModal } from '@/components/ui/useAppModal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatarWhatsApp(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

function iniciais(name: string) {
  const parts = name?.trim().split(' ').filter(Boolean) || []
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatarData(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

const SURFACE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '24px 28px',
  marginBottom: 16,
}

const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '12px 16px',
  color: '#f0f0f0',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  transition: 'border-color 0.2s',
}

const INPUT_DISABLED: React.CSSProperties = {
  ...INPUT,
  background: 'rgba(255,255,255,0.02)',
  color: 'rgba(255,255,255,0.3)',
  cursor: 'not-allowed',
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 6,
  display: 'block',
}

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MinhaConta() {
  const router = useRouter()
  const { showAlert, showConfirm } = useAppModal()

  const [user, setUser] = useState<any>(null)
  const isPro = false // TODO: checar plano
  const [userData, setUserData] = useState<any>(null)
  const [cardCount, setCardCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Campos editáveis
  const [name, setName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [city, setCity] = useState('')

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { router.push('/'); return }

      setUser(authData.user)

      // Busca dados da tabela users
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (profile) {
        setUserData(profile)
        setName(profile.name || '')
        setWhatsapp(profile.whatsapp || '')
        setCity(profile.city || '')
      }

      // Contagem de cartas
      const { count } = await supabase
        .from('user_cards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)

      setCardCount(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  // ── Salvar dados pessoais ───────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim() || name.trim().split(' ').filter(Boolean).length < 2) {
      showAlert('Informe nome e sobrenome.', 'error')
      return
    }
    const wDigits = whatsapp.replace(/\D/g, '')
    if (wDigits.length < 10) {
      showAlert('WhatsApp incompleto. Informe DDD + número.', 'error')
      return
    }
    if (!city.trim()) {
      showAlert('Informe sua cidade.', 'error')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({ name, whatsapp, city })
      .eq('id', user.id)

    setSaving(false)

    if (error) {
      showAlert('Erro ao salvar. Tente novamente.', 'error')
    } else {
      setUserData((prev: any) => ({ ...prev, name, whatsapp, city }))
      showAlert('Dados atualizados com sucesso!', 'success')
    }
  }

  // ── Alterar senha ──────────────────────────────────────────────────────────

  async function handleChangePassword() {
    const confirmed = await showConfirm({
      message: 'Enviaremos um link de alteração de senha para o seu e-mail cadastrado.',
      confirmLabel: 'Enviar link',
      cancelLabel: 'Cancelar',
    })
    if (!confirmed) return

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      showAlert('Erro ao enviar e-mail. Tente novamente.', 'error')
    } else {
      showAlert(`Link de alteração enviado para ${user.email}. Verifique sua caixa de entrada.`, 'success')
    }
  }

  // ── Sair ───────────────────────────────────────────────────────────────────

  async function handleLogout() {
    const confirmed = await showConfirm({
      message: 'Deseja encerrar sua sessão?',
      confirmLabel: 'Sair',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!confirmed) return
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'rgba(255,255,255,0.3)', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 32 }}>👤</div>
          <p style={{ fontSize: 14 }}>Carregando perfil...</p>
        </div>
      </AppLayout>
    )
  }

  const planoFree = true // futuro: checar assinatura real
  const LIMITE_FREE = 6 // plano Free

  return (
    <AppLayout>
      <div style={{ maxWidth: 700, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        {/* ── PERFIL ── */}
        <div style={{ ...SURFACE, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#000', letterSpacing: '-0.02em',
          }}>
            {iniciais(userData?.name || user?.email || '')}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {userData?.name || 'Colecionador'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
              {user?.email}
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                📅 Membro desde {formatarData(user?.created_at)}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                📍 {userData?.city || '—'}
              </span>
            </div>
          </div>

          {/* Badge plano + link perfil */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{
              padding: '6px 14px', borderRadius: 100,
              background: planoFree ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${planoFree ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.3)'}`,
              fontSize: 12, fontWeight: 700,
              color: planoFree ? 'rgba(255,255,255,0.4)' : '#f59e0b',
            }}>
              {planoFree ? 'Plano Free' : 'Plano Pro ✦'}
            </div>
            <button
              onClick={() => {
                if (planoFree) { showAlert('O Perfil Público é exclusivo do plano Pro. Faça upgrade para compartilhar sua coleção! 🚀', 'warning'); return }
                const url = `${window.location.origin}/perfil/${user?.id}`
                navigator.clipboard?.writeText(url)
                  .then(() => showAlert('Link do perfil copiado! 🔗', 'success'))
                  .catch(() => showAlert(url, 'info'))
              }}
              title={planoFree ? 'Disponível no plano Pro 🚀' : ''}
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${planoFree ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)'}`, color: planoFree ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: planoFree ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              🔒 {planoFree ? 'Perfil Público (Pro)' : '🔗 Compartilhar perfil'}
            </button>
          </div>
        </div>

        {/* ── DADOS PESSOAIS ── */}
        <div style={SURFACE}>
          <p style={SECTION_TITLE}>✏️ Dados pessoais</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Nome */}
            <div>
              <label style={LABEL}>Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={INPUT}
                onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {/* Cidade + WhatsApp */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Cidade</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={INPUT}
                  onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div>
                <label style={LABEL}>WhatsApp</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={e => setWhatsapp(formatarWhatsApp(e.target.value))}
                  style={INPUT}
                  onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* E-mail (readonly) */}
            <div>
              <label style={LABEL}>E-mail <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— não editável</span></label>
              <input type="email" value={user?.email || ''} disabled style={INPUT_DISABLED} />
            </div>

            {/* CPF (readonly) */}
            <div>
              <label style={LABEL}>CPF <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— dado fiscal, não editável</span></label>
              <input type="text" value={userData?.cpf || '—'} disabled style={INPUT_DISABLED} />
            </div>

            {/* Botão salvar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none', color: '#000',
                  padding: '12px 28px', borderRadius: 10,
                  fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {saving ? (
                  <>
                    <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    Salvando...
                  </>
                ) : 'Salvar alterações →'}
              </button>
            </div>
          </div>
        </div>

        {/* ── SEGURANÇA ── */}
        <div style={SURFACE}>
          <p style={SECTION_TITLE}>🔑 Segurança</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, color: '#f0f0f0', marginBottom: 4 }}>Senha da conta</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                Enviaremos um link de alteração para <span style={{ color: 'rgba(255,255,255,0.55)' }}>{user?.email}</span>
              </p>
            </div>
            <button
              onClick={handleChangePassword}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#f0f0f0',
                padding: '10px 20px', borderRadius: 10,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Alterar senha
            </button>
          </div>
        </div>

        {/* ── ASSINATURA ── */}
        <div style={SURFACE}>
          <p style={SECTION_TITLE}>💳 Assinatura</p>

          {planoFree ? (
            <>
              {/* Plano atual + barra de uso */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Plano Free</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Gratuito · sem data de expiração</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>Cartas</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: cardCount >= LIMITE_FREE ? '#ef4444' : '#f59e0b' }}>
                      {cardCount}<span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>/{LIMITE_FREE}</span>
                    </p>
                  </div>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((cardCount / LIMITE_FREE) * 100, 100)}%`,
                    background: cardCount >= LIMITE_FREE ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#f59e0b,#ef4444)',
                    borderRadius: 100, transition: 'width 0.5s ease',
                  }} />
                </div>
                {cardCount >= LIMITE_FREE && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>⚠ Limite atingido — faça upgrade para continuar</p>
                )}
              </div>

              {/* Limitações do Free */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>O que está incluído no Free</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { txt: '6 cartas na coleção', ok: true },
                    { txt: '3 anúncios no Marketplace', ok: true },
                    { txt: 'Pokédex completa', ok: true },
                    { txt: 'Dashboard financeiro', ok: true },
                    { txt: 'Cartas ilimitadas', ok: false },
                    { txt: 'Perfil público', ok: false },
                    { txt: 'Exportar CSV', ok: false },
                    { txt: 'Anúncios ilimitados', ok: false },
                  ].map(f => (
                    <p key={f.txt} style={{ fontSize: 12, color: f.ok ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: f.ok ? '#22c55e' : '#ef4444', fontSize: 10 }}>{f.ok ? '✓' : '✕'}</span> {f.txt}
                    </p>
                  ))}
                </div>
              </div>

              {/* Cards de upgrade — Mensal e Anual lado a lado */}
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Fazer upgrade para Pro</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                {/* Pro Mensal */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '18px 16px' }}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Pro Mensal</p>
                  <p style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 19,90</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>por mês · cancele quando quiser</p>
                  <button
                    onClick={() => showAlert('Pagamentos em breve! Entraremos em contato. 🚀', 'info')}
                    style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Assinar Pro →
                  </button>
                </div>

                {/* Pro Anual — destaque */}
                <div style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(239,68,68,0.06))', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '18px 16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', color: '#000', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
                    2 MESES GRÁTIS
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Pro Anual</p>
                  <p style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 179</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>por ano · R$ 14,91/mês</p>
                  <button
                    onClick={() => showAlert('Pagamentos em breve! Entraremos em contato. 🚀', 'info')}
                    style={{ width: '100%', background: 'linear-gradient(135deg,#f59e0b,#ef4444)', border: 'none', color: '#000', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Assinar Anual →
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Plano Pro ativo */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>⭐</span>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>Plano Pro ativo</p>
                    <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>ATIVO</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Cartas ilimitadas · Anúncios ilimitados · Perfil público</p>
                </div>
                <button
                  style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '9px 18px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => showAlert('Para cancelar sua assinatura, entre em contato pelo WhatsApp cadastrado.', 'info')}
                >
                  Cancelar plano
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── ZONA DE PERIGO ── */}
        <div style={{ ...SURFACE, border: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.03)' }}>
          <p style={{ ...SECTION_TITLE, color: 'rgba(239,68,68,0.6)' }}>⚠ Zona de perigo</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 14, color: '#f0f0f0', marginBottom: 4 }}>Encerrar sessão</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Você será redirecionado para a página inicial.</p>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
            >
              Sair da conta
            </button>
          </div>
        </div>

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </AppLayout>
  )
}