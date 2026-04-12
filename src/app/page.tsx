'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'


export default function Home() {
  const aboutRef = useRef<HTMLDivElement>(null)
  const howRef = useRef<HTMLDivElement>(null)
  const pricingRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  const [stats, setStats] = useState({
    cards: 500,
    users: 120,
    value: 50000,
  })

  const [user, setUser] = useState<any>(null)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isLogin, setIsLogin] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // futura integração com banco
  useEffect(() => {
    async function getUser() {
      const { data } = await supabase.auth.getSession()

      if (data.session?.user) {
        setUser(data.session.user)
      }
    }

    getUser()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const scrollTo = (ref: any) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleAuth() {
    if (!email || !password || (!isLogin && (!name || !cpf || !city || !whatsapp))) {
      alert('Preencha todos os campos')
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        setShowAuthModal(false)
        router.push('/dashboard-financeiro')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              cpf,
              city,
              whatsapp,
            },
          },
        })

        if (error) throw error

        // salvar na tabela users
        if (data.user) {
          const { error: userError } = await supabase.from('users').insert({
            id: data.user.id,
            email,
            name,
            cpf,
            city,
            whatsapp,
          })

          if (userError) throw userError
        }

        // sucesso
        alert('Conta criada com sucesso!')
        setIsLogin(true)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-black text-white min-h-screen">

      {/* HEADER */}
      <header className="fixed top-0 left-0 w-full bg-black/80 backdrop-blur-md z-50 border-b border-gray-800">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4">
          <h1 className="font-bold text-lg">TCG APP</h1>

          <nav className="flex items-center gap-6 text-sm">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Início</button>
            <button onClick={() => scrollTo(aboutRef)}>Sobre</button>
            <button onClick={() => scrollTo(howRef)}>Como funciona</button>
            <button onClick={() => scrollTo(pricingRef)}>Planos</button>

            {user ? (
              <button
                onClick={() => router.push('/dashboard-financeiro')}
                className="bg-green-600 px-4 py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-purple-600 px-4 py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Entrar
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="h-screen flex flex-col justify-center items-center text-center px-6 bg-gradient-to-b from-black via-gray-900 to-black">
        <h2 className="text-4xl md:text-6xl font-bold mb-6 animate-fadeIn">
          Gerencie suas cartas como um profissional
        </h2>

        <p className="text-gray-400 max-w-xl mb-8 animate-fadeIn delay-200">
          Organize sua coleção, acompanhe preços em tempo real e negocie suas cartas em um só lugar.
        </p>

        <div className="flex gap-4 animate-fadeIn delay-300">
          <button
            onClick={() => router.push('/login')}
            className="bg-purple-600 px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Começar agora
          </button>
          <button
            onClick={() => scrollTo(howRef)}
            className="border border-gray-700 px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            Ver como funciona
          </button>
        </div>

        <div className="mt-16 w-full max-w-4xl">
          <div className="bg-gray-900 border border-purple-700/40 rounded-xl p-6 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-blue-600/10 blur-2xl opacity-70" />

            <div className="relative z-10">
              <div className="flex justify-between mb-4">
                <span className="text-sm text-gray-400">Dashboard</span>
                <span className="text-sm text-green-400">+12.4%</span>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-black p-4 rounded-lg">
                  <p className="text-gray-400 text-xs">Total</p>
                  <p className="font-bold">R$ 2.540</p>
                </div>

                <div className="bg-black p-4 rounded-lg">
                  <p className="text-gray-400 text-xs">Cartas</p>
                  <p className="font-bold">128</p>
                </div>

                <div className="bg-black p-4 rounded-lg">
                  <p className="text-gray-400 text-xs">Valorização</p>
                  <p className="font-bold text-green-400">+18%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-12 px-6 text-center border-t border-gray-800">
        <p className="text-gray-400 text-sm mb-6">
          Utilizado por colecionadores em todo o Brasil
        </p>

        <div className="flex flex-wrap justify-center items-center gap-8 text-gray-500 text-sm">
          <span className="opacity-70">+{stats.cards} cartas cadastradas</span>
          <span className="opacity-70">+{stats.users} usuários ativos</span>
          <span className="opacity-70">+R$ {stats.value.toLocaleString()} em coleções</span>
        </div>
      </section>

      {/* LOGOS */}
      <section className="py-12 px-6 text-center">
        <p className="text-gray-500 text-sm mb-6">Utilizado por colecionadores de</p>

        <div className="flex flex-wrap justify-center items-center gap-10 opacity-70">
          <span className="text-lg font-semibold">Pokémon TCG</span>
          <span className="text-lg font-semibold">Yu-Gi-Oh!</span>
          <span className="text-lg font-semibold">Magic</span>
          <span className="text-lg font-semibold">One Piece</span>
        </div>
      </section>

      {/* SOBRE */}
      <section ref={aboutRef} className="py-24 px-6 max-w-4xl mx-auto text-center">
        <h3 className="text-3xl font-bold mb-6">Sobre</h3>
        <p className="text-gray-400">
          Criamos uma plataforma para quem leva coleção a sério. Aqui você acompanha o valor das suas cartas,
          organiza tudo em um só lugar e ainda pode comprar e vender com facilidade.
        </p>
      </section>

      {/* COMO FUNCIONA */}
      <section ref={howRef} className="py-24 px-6 bg-gray-900">
        <div className="max-w-5xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-12">Como funciona</h3>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 border border-gray-800 rounded-xl">
              <h4 className="font-semibold mb-2">Adicione sua coleção</h4>
              <p className="text-gray-400 text-sm">Importe suas cartas rapidamente por link</p>
            </div>

            <div className="p-6 border border-gray-800 rounded-xl">
              <h4 className="font-semibold mb-2">Acompanhe os preços</h4>
              <p className="text-gray-400 text-sm">Veja a valorização em tempo real</p>
            </div>

            <div className="p-6 border border-gray-800 rounded-xl">
              <h4 className="font-semibold mb-2">Compre e venda</h4>
              <p className="text-gray-400 text-sm">Negocie direto no marketplace</p>
            </div>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section ref={pricingRef} className="py-24 px-6 text-center">
        <h3 className="text-3xl font-bold mb-10">Plano</h3>

        <div className="max-w-md mx-auto border border-gray-800 rounded-xl p-8">
          <h4 className="text-xl font-semibold mb-2">Plano Completo</h4>
          <p className="text-4xl font-bold mb-4">R$ 19,90<span className="text-sm">/mês</span></p>

          <ul className="text-gray-400 text-sm mb-6 space-y-2">
            <li>Gestão completa da coleção</li>
            <li>Atualização de preços</li>
            <li>Marketplace</li>
            <li>Dashboard financeiro</li>
          </ul>

          <button
            onClick={() => router.push('/login')}
            className="w-full bg-purple-600 py-3 rounded-lg font-semibold hover:opacity-90"
          >
            Começar agora
          </button>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 text-center bg-gradient-to-b from-black to-gray-900">
        <h3 className="text-3xl font-bold mb-4">
          Organize sua coleção de verdade
        </h3>

        <button
          onClick={() => router.push('/login')}
          className="bg-purple-600 px-8 py-4 rounded-lg font-semibold hover:opacity-90"
        >
          Começar agora
        </button>
      </section>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 w-full max-w-md relative">

            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-6 text-center">
              {isLogin ? 'Entrar' : 'Criar conta'}
            </h2>

            <div className="space-y-4">
              {!isLogin && (
                <>
                  <input
                    type="text"
                    placeholder="Nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700"
                  />

                  <input
                    type="text"
                    placeholder="CPF"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700"
                  />

                  <input
                    type="text"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700"
                  />

                  <input
                    type="text"
                    placeholder="WhatsApp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700"
                  />
                </>
              )}

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 rounded-lg bg-black border border-gray-700"
              />

              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg bg-black border border-gray-700"
              />

              <button
                onClick={handleAuth}
                disabled={loading}
                className="w-full bg-purple-600 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Cadastrar'}
              </button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-400">
              {isLogin ? 'Não tem conta?' : 'Já tem conta?'}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-purple-500"
              >
                {isLogin ? 'Criar conta' : 'Entrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-fadeIn {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeIn 0.8s ease forwards;
        }

        .delay-200 {
          animation-delay: 0.2s;
        }

        .delay-300 {
          animation-delay: 0.3s;
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}