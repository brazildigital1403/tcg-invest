'use client'

/**
 * src/app/metas/[id]/page.tsx
 *
 * A meta aberta (#368, passo 2): "voce tem X de Y", barra de CARTAS e barra de
 * VALOR ("53% das cartas, 42% do valor" diz que as caras ainda faltam), quanto
 * falta em reais e a grade com as abas Todas/Tenho/Faltam.
 *
 * Valor = bynx_valor_carta() no banco (menor preco, regra de 25/08). A tela
 * so soma o que veio -- nao recalcula preco.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import CardItem from '@/components/ui/CardItem'
import ModalLimiteCartas from '@/components/ui/ModalLimiteCartas'
import { useAppModal } from '@/components/ui/useAppModal'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconCheck, IconPlus, IconTrash } from '@/components/ui/Icons'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { track, trackFirstCardAdded } from '@/lib/analytics'
import { limiteCartasDoErro } from '@/lib/checkCardLimit'
import {
  brl, carregarMeta, pct, rotuloIdioma, tituloMeta, type CartaDaMeta, type Meta,
} from '@/lib/metas'

type Aba = 'todas' | 'tenho' | 'faltam'

const card: React.CSSProperties = {
  background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14,
}

function Barra({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--bx-text-2)', marginBottom: 5 }}>
        <span>{rotulo}</span><strong style={{ color: 'var(--bx-text)' }}>{valor}%</strong>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--bx-surface-3)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, valor)}%`, height: '100%', background: 'var(--ac-grad)', transition: 'width 0.2s ease' }} />
      </div>
    </div>
  )
}

export default function MetaPage() {
  const params = useParams()
  const router = useRouter()
  const id = (params?.id as string) || ''
  const { showAlert, showConfirm } = useAppModal()
  const { openLogin } = useAuthModal()

  const [loaded, setLoaded] = useState(false)
  const [naoAchou, setNaoAchou] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [plano, setPlano] = useState('anonimo')
  const [meta, setMeta] = useState<Meta | null>(null)
  const [cartas, setCartas] = useState<CartaDaMeta[]>([])
  const [nomeSet, setNomeSet] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('todas')
  const [adicionando, setAdicionando] = useState<string | null>(null)
  const [limite, setLimite] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    const r = await carregarMeta(id).catch(() => null)
    if (!r) { setNaoAchou(true); setLoaded(true); return null }
    setMeta(r.meta)
    setCartas(r.cartas)
    setLoaded(true)
    return r
  }, [id])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id ?? null
      if (!ativo) return
      setUserId(uid)
      if (!uid) { setNaoAchou(true); setLoaded(true); return }
      const [p, r] = await Promise.all([getUserPlan(uid), carregar()])
      if (!ativo) return
      setPlano(p.plano)
      if (!r) return
      if (r.meta.tipo === 'set') {
        const { data } = await supabase.from('pokemon_sets').select('name, name_pt').eq('id', r.meta.alvo).maybeSingle()
        if (ativo) setNomeSet((data as any)?.name_pt || (data as any)?.name || r.cartas[0]?.set_name || null)
      }
      track({ name: 'meta_aberta', properties: { tipo: r.meta.tipo, total: r.meta.total || 0, tenho: r.meta.tenho || 0, plano: p.plano } })
    })()
    return () => { ativo = false }
  }, [carregar])

  const resumo = useMemo(() => {
    const total = cartas.length
    const tenho = cartas.filter(c => c.tenho).length
    const vt = cartas.reduce((s, c) => s + c.valor, 0)
    const vtenho = cartas.reduce((s, c) => s + (c.tenho ? c.valor : 0), 0)
    return { total, tenho, vt, vtenho, falta: Math.max(0, vt - vtenho) }
  }, [cartas])

  const visiveis = useMemo(() => {
    if (aba === 'tenho') return cartas.filter(c => c.tenho)
    if (aba === 'faltam') return cartas.filter(c => !c.tenho)
    return cartas
  }, [cartas, aba])

  async function adicionar(c: CartaDaMeta) {
    if (!userId || !meta) return
    setAdicionando(c.card_id)
    const linha: Record<string, any> = {
      user_id: userId, pokemon_api_id: c.card_id, card_id: c.card_id,
      card_name: c.nome, card_image: c.image_small, set_name: c.set_name,
      rarity: c.raridade, variante: 'normal', quantity: 1,
    }
    if (meta.idioma) linha.idioma = meta.idioma
    const { error } = await supabase.from('user_cards').insert(linha)
    setAdicionando(null)

    if (error) {
      const lim = limiteCartasDoErro(error)
      if (lim !== null) {
        // O numero que decide a estrategia das Metas: Gratis batendo o limite
        // vindo de uma meta.
        track({ name: 'limite_cartas_atingido', properties: { origem: 'meta', limite: lim, plano } })
        setLimite(lim)
        return
      }
      if (error.code === '23505') {
        // A colecao guarda uma linha por carta (#370): quem ja tem a carta em
        // outro idioma nao consegue registrar a copia no idioma da meta.
        showAlert('Você já tem esta carta na coleção em outro idioma. Por enquanto a coleção guarda um idioma por carta.', 'warning')
        return
      }
      showAlert('Não foi possível adicionar a carta. Tente de novo.', 'error')
      return
    }

    trackFirstCardAdded(userId)
    track({ name: 'card_added_to_collection', properties: {
      card_id: c.card_id, set_id: c.set_id || '', quantity: 1, origem: 'meta', plano,
    } })
    const antes = meta.concluida_em
    const r = await carregar()
    if (r && !antes && r.meta.concluida_em) {
      track({ name: 'meta_concluida', properties: { tipo: r.meta.tipo, total: r.meta.total || 0, plano } })
    }
  }

  async function apagar() {
    if (!meta) return
    const ok = await showConfirm({ message: 'Apagar esta meta?', confirmLabel: 'Apagar meta', description: 'As cartas da sua coleção continuam lá. Só o acompanhamento some.' })
    if (!ok) return
    const { error } = await supabase.from('metas_colecao').delete().eq('id', meta.id)
    if (error) { showAlert('Não foi possível apagar a meta.', 'error'); return }
    router.push('/metas')
  }

  const titulo = meta ? tituloMeta(meta, nomeSet) : 'Meta'
  const idiomaTxt = meta ? rotuloIdioma(meta.idioma) : null

  const aba$ = (a: Aba, rotulo: string, n: number) => (
    <button key={a} onClick={() => setAba(a)} style={{
      font: 'inherit', fontSize: 14, fontWeight: 600, minHeight: 44, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${aba === a ? 'var(--ac-1)' : 'var(--bx-border)'}`,
      background: aba === a ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)',
      color: aba === a ? 'var(--ac-1)' : 'var(--bx-text-2)',
      transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    }}>
      {rotulo} <span style={{ opacity: 0.7, fontWeight: 500 }}>{n}</span>
    </button>
  )

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Coleção', href: '/minha-colecao' }, { name: 'Metas', href: '/metas' }, { name: titulo, href: `/metas/${id}` }]}
          titulo={titulo}
          descricao={meta
            ? `${meta.tipo === 'pokemon' ? 'Meta por Pokémon' : 'Meta por coleção'}${idiomaTxt ? ` · só conta carta em ${idiomaTxt.toLowerCase()}` : ''}`
            : 'Meta de coleção'}
          acao={meta ? (
            <button onClick={apagar} aria-label="Apagar meta" title="Apagar meta" style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconTrash size={18} color="var(--bx-text-2)" />
            </button>
          ) : undefined}
        />

        {!loaded && <div style={{ color: 'var(--bx-text-2)', fontSize: 15, padding: '40px 0' }}>Calculando sua meta…</div>}

        {loaded && !userId && (
          <div style={{ ...card, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Entre para ver sua meta</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px' }}>As metas ficam na sua conta.</p>
            <button onClick={() => openLogin({ next: `/metas/${id}` })} style={{ font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)' }}>
              Entrar
            </button>
          </div>
        )}

        {loaded && userId && naoAchou && (
          <div style={{ ...card, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Meta não encontrada</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px' }}>Ela pode ter sido apagada, ou você está em outra conta.</p>
            <button onClick={() => router.push('/metas')} style={{ font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)' }}>
              Ver minhas metas
            </button>
          </div>
        )}

        {loaded && meta && (
          <>
            <div className="bx-meta-resumo" style={{ ...card, padding: 18, marginBottom: 20 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>Você tem</div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
                    {resumo.tenho} <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--bx-text-2)' }}>de {resumo.total}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>Sua parte vale</div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{brl(resumo.vtenho)}</div>
                </div>
                {meta.concluida_em ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--bx-green)', fontWeight: 700, fontSize: 15 }}>
                    <IconCheck size={18} color="var(--bx-green)" /> Meta completa
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>Faltam</div>
                    <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, color: 'var(--ac-1)' }}>{brl(resumo.falta)}</div>
                    <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>para completar, pelo menor preço</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
                <Barra valor={pct(resumo.tenho, resumo.total)} rotulo="Cartas" />
                <Barra valor={pct(resumo.vtenho, resumo.vt)} rotulo="Valor" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {aba$('todas', 'Todas', resumo.total)}
              {aba$('tenho', 'Tenho', resumo.tenho)}
              {aba$('faltam', 'Faltam', resumo.total - resumo.tenho)}
            </div>

            {visiveis.length === 0 ? (
              <div style={{ ...card, padding: '30px 20px', textAlign: 'center', color: 'var(--bx-text-2)', fontSize: 14 }}>
                {aba === 'tenho' ? 'Você ainda não tem nenhuma carta desta meta.' : 'Nenhuma carta faltando. Meta completa.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 170px), 1fr))', gap: 12 }}>
                {visiveis.map(c => (
                  <div key={c.card_id} className={c.tenho ? undefined : 'bx-meta-falta'}>
                    <CardItem
                      mode="readonly"
                      hidePriceTable
                      card={{
                        id: c.card_id, name: c.nome, number: c.numero || undefined,
                        image_small: c.image_small || undefined, rarity: c.raridade || undefined,
                        set_name: c.set_name || undefined,
                        idioma: c.tenho ? (c.idiomas_tenho?.[0] || undefined) : undefined,
                        price: { preco_min: c.valor },
                      }}
                      footerSlot={c.tenho ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--bx-green)' }}>
                          <IconCheck size={13} color="var(--bx-green)" /> Na coleção
                        </span>
                      ) : (
                        <button onClick={() => adicionar(c)} disabled={adicionando === c.card_id}
                          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 44, borderRadius: 10, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.1)', color: 'var(--ac-1)', cursor: 'pointer' }}>
                          <IconPlus size={14} color="var(--ac-1)" /> {adicionando === c.card_id ? 'Adicionando…' : 'Tenho esta'}
                        </button>
                      )}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {limite !== null && (
          <ModalLimiteCartas
            limite={limite}
            onClose={() => setLimite(null)}
            onUpgrade={() => { window.location.href = '/planos' }}
          />
        )}

        <style>{`
          .bx-meta-falta img { filter: grayscale(1); opacity: 0.45; transition: filter 0.2s ease, opacity 0.2s ease; }
          .bx-meta-falta:hover img { filter: grayscale(0.4); opacity: 0.8; }
        `}</style>
      </div>
    </AppLayout>
  )
}
