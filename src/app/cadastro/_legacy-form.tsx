'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const SURFACE = { background: '#0d0f14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '32px 28px' }

function calcIdade(nascimento: string): number {
  if (!nascimento) return -1
  const hoje = new Date()
  const nasc = new Date(nascimento)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

export default function Cadastro() {
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [cpf, setCpf]             = useState('')
  const [city, setCity]           = useState('')
  const [whatsapp, setWhatsapp]   = useState('')
  const [dataNasc, setDataNasc]   = useState('')
  const [termosAceito, setTermosAceito]     = useState(false)
  const [marketingAceito, setMarketingAceito] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [erro, setErro]           = useState('')

  const idade = calcIdade(dataNasc)
  const menorDe13  = dataNasc && idade < 13
  const entre13e17 = dataNasc && idade >= 13 && idade < 18

  function formatCpf(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 11)
    return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
             .replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
             .replace(/(\d{3})(\d{3})/, '$1.$2')
  }

  function formatPhone(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 11)
    return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
             .replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  async function handleCadastro() {
    setErro('')

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErro('Preencha nome, e-mail e senha.')
      return
    }
    if (!dataNasc) {
      setErro('Informe sua data de nascimento.')
      return
    }
    if (menorDe13) return // botão bloqueado
    if (!termosAceito) {
      setErro('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
      return
    }

    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({ email, password })

    if (authError) {
      setLoading(false)
      setErro(authError.message.includes('already registered')
        ? 'Este e-mail já está cadastrado.'
        : authError.message)
      return
    }

    const user = data.user
    if (!user) { setLoading(false); setErro('Erro ao criar usuário.'); return }

    const { error } = await supabase.from('users').insert([{
      id: user.id,
      name,
      email,
      cpf: cpf.replace(/\D/g, ''),
      city,
      whatsapp: whatsapp.replace(/\D/g, ''),
      data_nascimento: dataNasc,
      termos_aceitos_em: new Date().toISOString(),
      marketing_aceito: marketingAceito,
    }])

    setLoading(false)

    if (error) {
      setErro('Erro ao salvar dados. Tente novamente.')
      return
    }

    // S29: pega session pra Bearer token (welcome agora exige auth).
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      fetch('/api/email/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => {})
    }

    window.location.href = '/dashboard-financeiro'
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
    padding: '12px 14px', color: '#f0f0f0', fontSize: 14,
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, display: 'block',
  }

  const canSubmit = !menorDe13 && termosAceito && name && email && password && dataNasc

  return (
    <div style={{ minHeight: '100vh', background: '#080a0f', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>

      {/* Logo */}
      <Link href="/" style={{ marginBottom: 32, textDecoration: 'none' }}>
        <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 36, width: 'auto' }} />
      </Link>

      <div style={{ ...SURFACE, width: '100%', maxWidth: 480 }}>

        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 4 }}>Criar conta</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
          Grátis · 7 dias de Pro incluídos ⭐
        </p>

        {/* Bloqueio menor de 13 */}
        {menorDe13 && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>🔒</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Acesso não permitido</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              O Bynx não permite cadastro de menores de 13 anos, conforme a Lei Geral de Proteção de Dados (LGPD — Art. 14). Se você tem entre 13 e 17 anos, peça a um responsável legal para criar a conta.
            </p>
          </div>
        )}

        {/* Aviso 13-17 anos */}
        {entre13e17 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#f59e0b', lineHeight: 1.6 }}>
              ⚠️ <strong>Usuário menor de idade:</strong> ao prosseguir, você declara que possui autorização de um pai ou responsável legal para criar esta conta, conforme exigido pela LGPD.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome completo *</label>
            <input style={inputStyle} type="text" placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>E-mail *</label>
            <input style={inputStyle} type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Senha */}
          <div>
            <label style={labelStyle}>Senha *</label>
            <input style={inputStyle} type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {/* Data de nascimento */}
          <div>
            <label style={labelStyle}>Data de nascimento *</label>
            <input style={inputStyle} type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)} max={new Date().toISOString().split('T')[0]} />
          </div>

          {/* CPF */}
          <div>
            <label style={labelStyle}>CPF</label>
            <input style={inputStyle} type="text" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} />
          </div>

          {/* Cidade + WhatsApp */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Cidade</label>
              <input style={inputStyle} type="text" placeholder="São Paulo" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>WhatsApp</label>
              <input style={inputStyle} type="text" placeholder="(11) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(formatPhone(e.target.value))} />
            </div>
          </div>

          {/* Aceites */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* Termos — obrigatório */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={termosAceito}
                onChange={e => setTermosAceito(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#f59e0b', width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                Li e aceito os{' '}
                <a href="/termos" target="_blank" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Termos de Uso</a>
                {' '}e a{' '}
                <a href="/privacidade" target="_blank" style={{ color: '#f59e0b', textDecoration: 'underline' }}>Política de Privacidade</a>
                {' '}<span style={{ color: '#ef4444' }}>*</span>
              </span>
            </label>

            {/* Marketing — opcional */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={marketingAceito}
                onChange={e => setMarketingAceito(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#f59e0b', width: 16, height: 16, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Quero receber novidades, dicas de TCG e ofertas do Bynx por e-mail <span style={{ color: 'rgba(255,255,255,0.3)' }}>(opcional)</span>
              </span>
            </label>
          </div>

          {/* Erro */}
          {erro && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ fontSize: 13, color: '#ef4444' }}>⚠ {erro}</p>
            </div>
          )}

          {/* Botão */}
          <button
            onClick={handleCadastro}
            disabled={loading || !canSubmit}
            style={{
              width: '100%', background: canSubmit ? BRAND : 'rgba(255,255,255,0.08)',
              border: 'none', color: canSubmit ? '#000' : 'rgba(255,255,255,0.3)',
              padding: '14px', borderRadius: 12, fontWeight: 800, fontSize: 15,
              cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Criando conta...' : 'Criar conta grátis →'}
          </button>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            * campos obrigatórios
          </p>
        </div>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
        Já tem conta?{' '}
        <Link href="/" style={{ color: '#f59e0b', textDecoration: 'none' }}>Entrar →</Link>
      </p>
    </div>
  )
}