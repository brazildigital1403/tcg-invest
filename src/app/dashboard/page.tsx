'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        window.location.href = '/login'
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
    window.location.href = '/login'
  }

  return (
    <div className="p-10">
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-4 py-2 rounded mb-5"
      >
        Sair
      </button>
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <p className="mt-4">Email: {user?.email}</p>

      {profile && (
        <>
          <p>Nome: {profile.name}</p>
          <p>Cidade: {profile.city}</p>
          <p>WhatsApp: {profile.whatsapp}</p>
        </>
      )}
    </div>
  )
}