'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Cadastro() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cpf, setCpf] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCadastro() {
  setLoading(true)

  if (!name || !email || !password) {
    alert('Preencha os campos obrigatórios')
    setLoading(false)
    return
  }

  // 1. Criar usuário no AUTH
  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError) {
    setLoading(false)

    if (authError.message.includes('User already registered')) {
      alert('Email já cadastrado')
    } else {
      alert(authError.message)
    }

    console.log(authError)
    return
  }

  const user = data.user

  if (!user) {
    setLoading(false)
    alert('Erro ao criar usuário')
    return
  }

  // 2. Salvar dados adicionais
  const { error } = await supabase.from('users').insert([
    {
      id: user?.id,
      name,
      email,
      cpf,
      city,
      whatsapp,
    },
  ])

  setLoading(false)

  if (error) {
    alert('Erro ao salvar dados')
    console.log(error)
  } else {
    // Envia email de boas-vindas em background
    fetch('/api/email/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => {}) // silently fail

    alert('Usuário cadastrado com sucesso!')
    window.location.href = '/dashboard'
  }
}

  return (
    <div className="p-10 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-5">Cadastro</h1>

      <input
        placeholder="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <input
        placeholder="Senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full mb-2"
        />

      <input
        placeholder="CPF"
        value={cpf}
        onChange={(e) => setCpf(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <input
        placeholder="Cidade"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <input
        placeholder="WhatsApp"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      <button
        onClick={handleCadastro}
        disabled={loading}
        className="bg-blue-600 text-white p-2 w-full rounded"
      >
        {loading ? 'Cadastrando...' : 'Cadastrar'}
      </button>
    </div>
  )
}