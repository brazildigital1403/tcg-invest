'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        window.location.href = '/'
        return
      }

      setUser(data.user)

      // Buscar dados na tabela users
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      setProfile(profileData)
    }

    loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <AppLayout total={0}>
      <div className="p-6">
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg mb-5 hover:opacity-90"
        >
          Sair
        </button>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>

        <p className="mt-4 text-gray-400">Email: {user?.email}</p>

        {profile && (
          <>
            <p className="text-gray-400">Nome: {profile.name}</p>
            <p className="text-gray-400">Cidade: {profile.city}</p>
            <p className="text-gray-400">WhatsApp: {profile.whatsapp}</p>
          </>
        )}
      </div>
    </AppLayout>
  )
}