'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CentralLeilao } from '@/lib/leilaoAdmin'
import CentralLeilaoView from './CentralLeilaoView'
import { AdminPage, AdminVazio } from '@/components/admin/AdminPage'

// Central do leilao no Admin: a operacao inteira em uma tela, so leitura.
// Atualiza a cada 30 s com a aba visivel. Sem resposta, mantem o ultimo retrato
// e avisa ha quanto tempo esta sem atualizar.

const INTERVALO_MS = 30_000

export default function AdminLeiloesPage() {
  const [dados, setDados] = useState<CentralLeilao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const emVoo = useRef(false)

  const carregar = useCallback(async () => {
    if (emVoo.current) return
    emVoo.current = true
    try {
      const r = await fetch('/api/admin/leiloes', { cache: 'no-store' })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j) throw new Error(j?.error || 'Erro ao carregar.')
      setDados(j as CentralLeilao)
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      emVoo.current = false
    }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(() => { if (!document.hidden) carregar() }, INTERVALO_MS)
    const aoVoltar = () => { if (!document.hidden) carregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', aoVoltar) }
  }, [carregar])

  return (
    <AdminPage titulo="Leilões" subtitulo="A operação inteira em uma tela, só leitura. Atualiza a cada 30 segundos com a aba aberta." largura="media">
      {erro && (
        <div role="alert" style={{ padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.09)', color: '#f0f0f0', fontSize: 13, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{dados ? 'Sem atualização: o que aparece abaixo pode estar velho.' : erro}</span>
          <button type="button" onClick={carregar} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Tentar de novo</button>
        </div>
      )}
      {dados ? <CentralLeilaoView dados={dados} /> : !erro && <AdminVazio>Carregando...</AdminVazio>}
    </AdminPage>
  )
}
