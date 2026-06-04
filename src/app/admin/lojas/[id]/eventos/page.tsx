'use client'

import { CSSProperties } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import EventosManager from '@/components/lojas/EventosManager'

export default function AdminEventosLojaPage() {
  const params = useParams()
  const lojaId = String(params?.id || '')

  return (
    <div style={S.page}>
      <Link href="/admin/lojas" style={S.voltar}>← Voltar para Lojas</Link>
      <div style={S.gap} />
      <EventosManager
        lojaId={lojaId}
        admin
        mostrarNomeLoja
        titulo="Eventos"
        sub="Torneios, ligas, pré-lançamentos e encontros da loja."
      />
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 880, margin: '0 auto', padding: '32px 20px', color: '#f0f0f0' },
  voltar: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textDecoration: 'none' },
  gap: { height: 14 },
}
