'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AppLayout({ children, total }) {
  const pathname = usePathname()

  const menu = [
    { name: 'Início', href: '/dashboard-financeiro' },
    { name: 'Pokedex', href: '/pokedex' },
    { name: 'Minha coleção', href: '/minha-colecao' },
    { name: 'Dashboard', href: '/dashboard-financeiro' },
    { name: 'Marketplace', href: '/marketplace' },
    { name: 'Minha Conta', href: '/dashboard' },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* SIDEBAR */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 p-4">
        <Link href="/dashboard-financeiro">
          <h1 className="text-xl font-bold mb-6 cursor-pointer">TCG Manager</h1>
        </Link>

        <nav className="flex flex-col gap-2">
          {menu.map((item) => {
            const active = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <header className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-gray-900">
          <Link href="/dashboard-financeiro">
            <p className="font-semibold cursor-pointer">Dashboard</p>
          </Link>

          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-400">Patrimônio</p>
              <p className="font-bold text-green-400">
                {total ? `R$ ${Number(total).toFixed(2)}` : 'R$ 0,00'}
              </p>
            </div>

            <Link href="/minha-conta" className="text-sm text-gray-300 hover:text-white">
              Minha Conta
            </Link>

            <button
              onClick={handleLogout}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Sair
            </button>
          </div>
        </header>

        {/* PAGE */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
