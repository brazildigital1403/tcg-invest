'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLojaOwner, LojaEstadoFallback, SH, LOJA_HOME, TrilhaLoja } from '../_shared'
import { IconCalendar, IconChevronRight, IconClock, IconPlus } from '@/components/ui/Icons'
import { horarioBrasilia } from '@/lib/leilao'
import { STATUS_RODADA, chamarPainel, type RodadaResumo } from './_rodada'

/**
 * Lista das rodadas ao vivo da loja, agrupadas por status. "Nova rodada" cria
 * um rascunho e abre o editor.
 */

const GRUPOS: Array<{ status: string; titulo: string }> = [
  { status: 'ao_vivo', titulo: 'Ao vivo' },
  { status: 'agendada', titulo: 'Agendadas' },
  { status: 'rascunho', titulo: 'Rascunhos' },
  { status: 'encerrada', titulo: 'Encerradas' },
  { status: 'cancelada', titulo: 'Canceladas' },
]

export default function ListaRodadas({ lojaId }: { lojaId: string }) {
  const router = useRouter()
  const { estado, loja } = useLojaOwner(lojaId)
  const [rodadas, setRodadas] = useState<RodadaResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const j = await chamarPainel<{ rodadas: RodadaResumo[] }>(`/api/lojas/${lojaId}/leiloes`)
      setRodadas(j.rodadas || [])
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  async function novaRodada() {
    setCriando(true)
    setErro(null)
    try {
      const j = await chamarPainel<{ rodada: RodadaResumo }>(`/api/lojas/${lojaId}/leiloes`, {
        method: 'POST',
        body: JSON.stringify({ titulo: 'Rodada ao vivo' }),
      })
      router.push(`/minha-loja/${lojaId}/leiloes/${j.rodada.id}`)
    } catch (e) {
      setErro((e as Error).message)
      setCriando(false)
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const base = `/minha-loja/${lojaId}/leiloes`
  const botaoNova = (
    <button onClick={novaRodada} disabled={criando} style={{ ...S.btnPrim, opacity: criando ? 0.6 : 1 }}>
      <IconPlus size={16} /> {criando ? 'Criando…' : 'Nova rodada'}
    </button>
  )

  return (
    <div style={SH.page}>
      <TrilhaLoja items={[LOJA_HOME, { name: loja.nome, href: `/minha-loja/${lojaId}` }, { name: 'Leilões', href: base }]} />
      <header style={S.head}>
        <div style={{ minWidth: 0 }}>
          <h1 style={SH.title}>Leilões</h1>
          <p style={SH.subtitle}>
            Monte uma rodada ao vivo: você transmite, o público dá lance na Bynx e cada lote dura de 30 a 90 segundos.
          </p>
        </div>
        {rodadas.length > 0 && <div style={S.headAcao}>{botaoNova}</div>}
      </header>

      {erro && <div style={S.erro} role="alert">{erro}</div>}

      {carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'var(--bx-text-3)' }}>Carregando…</div>
      ) : rodadas.length === 0 ? (
        <div style={{ ...SH.card, textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ color: 'var(--bx-text-3)', display: 'flex', justifyContent: 'center' }}>
            <IconClock size={34} strokeWidth={1.2} />
          </div>
          <h2 style={S.h2}>Nenhuma rodada ainda</h2>
          <p style={S.txt}>
            Crie a primeira rodada, adicione os lotes com as fotos reais de cada carta e agende o horário da sua live.
          </p>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>{botaoNova}</div>
        </div>
      ) : (
        GRUPOS.map(g => {
          const lista = rodadas.filter(r => r.status === g.status)
          if (lista.length === 0) return null
          return (
            <section key={g.status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={SH.cardH3}>{g.titulo} · {lista.length}</h2>
              {lista.map(r => {
                const st = STATUS_RODADA[r.status] ?? STATUS_RODADA.rascunho
                const n = r.lotes ?? 0
                return (
                  <Link key={r.id} href={`${base}/${r.id}`} className="lj-rodada" style={S.item}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={S.itemTit}>{r.titulo || `Rodada #${r.numero}`}</div>
                      <div style={S.itemSub}>
                        <span style={{ ...S.pill, color: st.cor, borderColor: 'var(--bx-border-2)' }}>{st.label}</span>
                        <span>{n === 1 ? '1 lote' : `${n} lotes`}</span>
                        {r.inicia_em && (
                          <span style={S.quando}><IconCalendar size={13} /> {horarioBrasilia(r.inicia_em)}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: 'var(--bx-text-3)', display: 'flex' }}><IconChevronRight size={18} /></span>
                  </Link>
                )
              })}
            </section>
          )
        })
      )}
      <style>{`
        .lj-rodada { transition: background 0.15s ease, border-color 0.15s ease; }
        .lj-rodada:hover { background: var(--bx-surface-2) !important; border-color: var(--bx-border-2) !important; }
        .lj-rodada:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
      `}</style>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  head: { display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 4 },
  headAcao: { flexShrink: 0 },
  btnPrim: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box',
    background: 'var(--ac-grad)', color: '#fff', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
    border: 0, cursor: 'pointer',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, boxSizing: 'border-box', padding: '12px 14px',
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12,
    color: 'var(--bx-text)', textDecoration: 'none',
  },
  itemTit: { fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemSub: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5, fontSize: 12.5, color: 'var(--bx-text-3)' },
  pill: { fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, border: '1px solid', background: 'var(--bx-surface-2)' },
  quando: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  h2: { fontSize: 16, fontWeight: 800, margin: '10px 0 6px', color: 'var(--bx-text)' },
  txt: { fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },
  erro: {
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--bx-red)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
  },
}
