'use client'

import { use as usePromise } from 'react'
import FormLoja, { LojaFormData } from '@/components/lojas/FormLoja'
import EventosManager from '@/components/lojas/EventosManager'
import { useLojaOwner, LojaEstadoFallback, SH, type LojaFull } from '../_shared'

export default function MinhaVitrinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, userId, loja, setLoja } = useLojaOwner(lojaId)

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  return (
    <div style={SH.page}>
      <header style={{ ...SH.head, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={SH.title}>Minha vitrine</h1>
          <p style={SH.subtitle}>Edite o que os clientes veem na sua página pública.</p>
        </div>
        {loja.slug && (
          <a href={`/lojas/${loja.slug}`} target="_blank" rel="noopener noreferrer" style={SH.btnSecondary}>
            Ver vitrine pública ↗
          </a>
        )}
      </header>

      <FormLoja
        userId={userId!}
        initialData={loja}
        isEditMode
        onSaved={(nova: LojaFormData) => setLoja({ ...(loja as LojaFull), ...nova })}
      />

      <EventosManager
        lojaId={loja.id}
        sub="Divulgue torneios, ligas e encontros na sua página pública."
        nota={loja.plano === 'premium' ? undefined : 'Eventos aparecem na sua página pública apenas no plano Premium — mas você já pode cadastrá-los para quando fizer o upgrade.'}
      />
    </div>
  )
}
