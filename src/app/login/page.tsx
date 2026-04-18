'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginRedirect() {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession()
      if (data.session?.user) {
        router.replace('/dashboard-financeiro')
      } else {
        router.replace('/')
      }
    }
    check()
  }, [])

  return null
}