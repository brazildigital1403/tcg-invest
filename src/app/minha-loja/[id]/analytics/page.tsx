'use client'

import { use as usePromise } from 'react'
import AnalyticsCard from '@/components/lojas/AnalyticsCard'
import { useLojaOwner, LojaEstadoFallback, SH } from '../_shared'

export default function LojaAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, loja } = useLojaOwner(lojaId)

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  return (
    <div style={SH.page}>
      <header style={SH.head}>
        <h1 style={SH.title}>Analytics</h1>
        <p style={SH.subtitle}>Contatos, visitas e canais da sua loja.</p>
      </header>
      <AnalyticsCard lojaId={loja.id} plano={loja.plano || 'basico'} />
    </div>
  )
}
