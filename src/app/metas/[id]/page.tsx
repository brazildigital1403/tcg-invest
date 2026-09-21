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
import Link from 'next/link'
import Image from 'next/image'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import CardItem from '@/components/ui/CardItem'
import ModalLimiteCartas from '@/components/ui/ModalLimiteCartas'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import { useAppModal } from '@/components/ui/useAppModal'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconBell, IconCarrinho, IconChat, IconCheck, IconPlus, IconTrash } from '@/components/ui/Icons'
import { adicionar as adicionarAoCarrinho, estaNoCarrinho } from '@/lib/carrinho'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { track, trackFirstCardAdded } from '@/lib/analytics'
import { limiteCartasDoErro } from '@/lib/checkCardLimit'
import {
  brl, buscarOfertasDaMeta, carregarMeta, pct, rotuloIdioma, tituloMeta,
  type CartaDaMeta, type Meta, type OfertaMeta,
} from '@/lib/metas'

type Aba = 'todas' | 'tenho' | 'faltam' | 'avenda'

/** Grupo da aba "A venda": um vendedor e as cartas da meta que ele tem. */
type GrupoVendedor = {
  chave: string
  vendedor: string
  lojaId: string | null
  compraDireta: boolean
  itens: { carta: CartaDaMeta; oferta: OfertaMeta }[]
  soma: number
}

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
  const { showAlert, showConfirm, showPrompt } = useAppModal()
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
  // null = ainda nao buscou ou falhou (o bloco some); [] = ninguem vende
  const [ofertas, setOfertas] = useState<OfertaMeta[] | null>(null)
  const [noCarrinho, setNoCarrinho] = useState<Set<string>>(new Set())
  const [orcamento, setOrcamento] = useState<number>(100)
  // Radar: teto por carta, guardado na watchlist (target_price). undefined =
  // carta fora da watchlist; null = acompanha sem teto.
  const [tetos, setTetos] = useState<Map<string, number | null>>(new Map())

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
      const [p, r, w] = await Promise.all([
        getUserPlan(uid), carregar(),
        supabase.from('watchlist').select('card_id, target_price').eq('user_id', uid),
      ])
      if (!ativo) return
      setPlano(p.plano)
      setTetos(new Map((w.data || []).map((x: { card_id: string; target_price: number | null }) =>
        [x.card_id, x.target_price == null ? null : Number(x.target_price)])))
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

  // Busca as ofertas das cartas que faltam. A chave muda quando uma carta
  // entra na colecao, e a carta que entrou sai da lista.
  const chaveFaltam = useMemo(() => cartas.filter(c => !c.tenho).map(c => c.card_id).join(','), [cartas])
  useEffect(() => {
    if (!loaded || !meta) return
    let ativo = true
    const ids = chaveFaltam ? chaveFaltam.split(',') : []
    buscarOfertasDaMeta(ids).then(o => {
      if (!ativo) return
      setOfertas(o)
      if (o) setNoCarrinho(new Set(o.filter(x => estaNoCarrinho(x.id)).map(x => x.id)))
    })
    return () => { ativo = false }
  }, [chaveFaltam, loaded, meta])

  // A oferta mais barata de cada carta que falta (o banco ja ordena por preco).
  // Meta com idioma so aceita oferta naquele idioma (passo 6). Anuncio criado
  // antes de 21/09 pode estar como 'pt' sem ser -- o idioma nao era gravado (#372).
  const melhorOferta = useMemo(() => {
    const m = new Map<string, OfertaMeta>()
    for (const o of ofertas || []) {
      if (meta?.idioma && o.idioma !== meta.idioma) continue
      if (!m.has(o.card_id)) m.set(o.card_id, o)
    }
    return m
  }, [ofertas, meta])

  const aVenda = useMemo(() => {
    const itens = cartas.filter(c => !c.tenho && melhorOferta.has(c.card_id))
      .map(c => ({ carta: c, oferta: melhorOferta.get(c.card_id)! }))
    const soma = itens.reduce((s, i) => s + i.oferta.preco, 0)
    const grupos = new Map<string, GrupoVendedor>()
    for (const i of itens) {
      const chave = i.oferta.lojaId || `v:${i.oferta.vendedor}`
      const g = grupos.get(chave) || { chave, vendedor: i.oferta.vendedor, lojaId: i.oferta.lojaId, compraDireta: i.oferta.compraDireta, itens: [], soma: 0 }
      g.itens.push(i); g.soma += i.oferta.preco
      grupos.set(chave, g)
    }
    // Compra direta primeiro (fecha no site), depois quem tem mais cartas da meta.
    const lista = [...grupos.values()].sort((a, b) =>
      Number(b.compraDireta) - Number(a.compraDireta) || b.itens.length - a.itens.length || a.soma - b.soma)
    return { itens, soma, grupos: lista }
  }, [cartas, melhorOferta])

  // Orcamento guiado v0 (#368, passo 4): as faltantes a venda do menor preco
  // para o maior, acumulando ate o valor escolhido. Guloso de proposito --
  // maximiza CARTAS, que e o que a barra mostra. Nao otimiza frete: o aviso
  // abaixo da lista diz que o carrinho fecha por loja.
  const plano$ = useMemo(() => {
    const ordenadas = [...aVenda.itens].sort((a, b) => a.oferta.preco - b.oferta.preco)
    const escolhidas: typeof ordenadas = []
    let gasto = 0
    for (const i of ordenadas) {
      if (gasto + i.oferta.preco > orcamento) break
      escolhidas.push(i); gasto += i.oferta.preco
    }
    const valorGanho = escolhidas.reduce((s, i) => s + i.carta.valor, 0)
    return {
      escolhidas, gasto,
      deCartas: pct(resumo.tenho, resumo.total),
      paraCartas: pct(resumo.tenho + escolhidas.length, resumo.total),
      deValor: pct(resumo.vtenho, resumo.vt),
      paraValor: pct(resumo.vtenho + valorGanho, resumo.vt),
      maisBarata: ordenadas[0]?.oferta.preco ?? 0,
    }
  }, [aVenda.itens, orcamento, resumo])

  function colocarNoCarrinho(g: GrupoVendedor) {
    if (!g.lojaId) return
    for (const i of g.itens) {
      if (!estaNoCarrinho(i.oferta.id)) adicionarAoCarrinho({ id: i.oferta.id, tipo: 'carta', lojaId: g.lojaId })
    }
    setNoCarrinho(prev => new Set([...prev, ...g.itens.map(i => i.oferta.id)]))
  }

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

  async function definirTeto(c: CartaDaMeta) {
    if (!userId) return
    const atual = tetos.get(c.card_id)
    const v = await showPrompt({
      message: `Avisar quando ${c.nome} aparecer por até quanto?`,
      placeholder: 'Ex.: 50',
      defaultValue: atual != null ? String(atual).replace('.', ',') : '',
      hint: 'Em reais. Deixe em branco para ser avisado em qualquer preço.',
    })
    if (v === null) return
    const limpo = v.trim().replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const teto = limpo ? Number(limpo) : null
    if (teto !== null && (!Number.isFinite(teto) || teto <= 0)) { showAlert('Digite um valor em reais, como 50 ou 49,90.', 'warning'); return }
    const { error } = await supabase.from('watchlist').upsert(
      { user_id: userId, card_id: c.card_id, target_price: teto, target_type: teto === null ? null : 'max' },
      { onConflict: 'user_id,card_id' },
    )
    if (error) { showAlert('Não foi possível salvar o aviso.', 'error'); return }
    setTetos(prev => new Map(prev).set(c.card_id, teto))
    showAlert(teto === null
      ? `Pronto. O sino avisa quando ${c.nome} aparecer à venda.`
      : `Pronto. O sino avisa quando ${c.nome} aparecer por até ${brl(teto)}.`, 'success')
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

        {loaded && meta && meta.concluida_em && (() => {
          // Card de meta completa (#368, passo 7). O compartilhamento aponta
          // para a /colecionadores: a pagina da meta e privada e noindex, e
          // quem recebe o link precisa cair onde as Metas sao explicadas.
          const dias = Math.max(1, Math.round((new Date(meta.concluida_em).getTime() - new Date(meta.created_at).getTime()) / 86400000))
          const artes = cartas.filter(c => c.image_small).sort((a, b) => b.valor - a.valor).slice(0, 5)
          const texto = `Completei a meta ${titulo}${idiomaTxt ? ` em ${idiomaTxt.toLowerCase()}` : ''} na Bynx: ${resumo.total} de ${resumo.total} cartas, valendo ${brl(resumo.vt)} hoje.`
          return (
            <div style={{ ...card, padding: 20, marginBottom: 20, background: 'var(--bx-hero-wash), var(--bx-surface)', borderColor: 'rgba(var(--ac-1-rgb), 0.35)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)', marginBottom: 6 }}>Meta completa</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>{titulo}{idiomaTxt ? ` em ${idiomaTxt.toLowerCase()}` : ''}</div>
              {artes.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  {artes.map((c, i) => (
                    <Image key={c.card_id} src={c.image_small!} alt={c.nome} width={64} height={89} sizes="64px"
                      style={{ width: 64, height: 89, objectFit: 'contain', borderRadius: 6, marginLeft: i ? -18 : 0, transform: `rotate(${(i - (artes.length - 1) / 2) * 6}deg)`, boxShadow: 'var(--bx-shadow)' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 16 }}>
                <div><div style={{ fontSize: 22, fontWeight: 800 }}>{resumo.total}</div><div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>cartas</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 800 }}>{brl(resumo.vt)}</div><div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>valor hoje</div></div>
                <div><div style={{ fontSize: 22, fontWeight: 800 }}>{dias} {dias === 1 ? 'dia' : 'dias'}</div><div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>de caçada</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <BotaoCompartilhar url="/colecionadores" titulo={`Meta completa: ${titulo}`} texto={texto} />
              </div>
            </div>
          )
        })()}

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
              {!meta.concluida_em && (
                <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: '14px 0 0', lineHeight: 1.5 }}>
                  Radar ligado: o sino avisa quando uma carta que falta aparece à venda. Toque no sino da carta para definir um preço máximo.
                </p>
              )}
              {aVenda.itens.length > 0 && (
                <button onClick={() => setAba('avenda')} style={{ marginTop: 16, width: '100%', textAlign: 'left', font: 'inherit', fontSize: 14, lineHeight: 1.5, minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(var(--ac-1-rgb), 0.3)', background: 'rgba(var(--ac-1-rgb), 0.08)', color: 'var(--bx-text)', cursor: 'pointer' }}>
                  <strong style={{ color: 'var(--ac-1)' }}>{brl(aVenda.soma)}</strong> disso está à venda agora na Bynx: {aVenda.itens.length} {aVenda.itens.length === 1 ? 'carta' : 'cartas'}, {aVenda.grupos.length === 1 ? 'de 1 vendedor' : `de ${aVenda.grupos.length} vendedores`}.
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {aba$('todas', 'Todas', resumo.total)}
              {aba$('tenho', 'Tenho', resumo.tenho)}
              {aba$('faltam', 'Faltam', resumo.total - resumo.tenho)}
              {aVenda.itens.length > 0 && aba$('avenda', 'À venda', aVenda.itens.length)}
            </div>

            {aba === 'avenda' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ ...card, padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Quanto você quer gastar?</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {[20, 50, 100, 300].map(v => (
                      <button key={v} onClick={() => setOrcamento(v)} style={{
                        font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
                        border: `1px solid ${orcamento === v ? 'var(--ac-1)' : 'var(--bx-border)'}`,
                        background: orcamento === v ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)',
                        color: orcamento === v ? 'var(--ac-1)' : 'var(--bx-text-2)',
                        transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
                      }}>{brl(v)}</button>
                    ))}
                  </div>
                  {plano$.escolhidas.length === 0 ? (
                    <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: 0 }}>
                      A carta mais barata à venda custa {brl(plano$.maisBarata)}. Escolha um valor maior.
                    </p>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 10px', lineHeight: 1.6 }}>
                        Com <strong style={{ color: 'var(--bx-text)' }}>{brl(orcamento)}</strong> você leva {plano$.escolhidas.length} {plano$.escolhidas.length === 1 ? 'carta' : 'cartas'} por {brl(plano$.gasto)}: as cartas vão de <strong style={{ color: 'var(--bx-text)' }}>{plano$.deCartas}%</strong> para <strong style={{ color: 'var(--ac-1)' }}>{plano$.paraCartas}%</strong>, e o valor, de {plano$.deValor}% para {plano$.paraValor}%.
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {plano$.escolhidas.map(({ carta: c, oferta: o }) => (
                          <Link key={o.id} href={o.href} style={{ fontSize: 13, padding: '6px 12px', minHeight: 44, display: 'inline-flex', alignItems: 'center', borderRadius: 999, border: '1px solid var(--bx-border)', background: 'var(--bx-surface-2)', color: 'var(--bx-text)', textDecoration: 'none' }}>
                            {c.nome}{c.numero ? ` ${c.numero}` : ''} · {brl(o.preco)}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {aVenda.grupos.map(g => {
                  const todasNoCarrinho = g.itens.every(i => noCarrinho.has(i.oferta.id))
                  return (
                    <div key={g.chave} style={{ ...card, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{g.vendedor}</div>
                          <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>
                            {g.compraDireta ? 'Loja · compra direta' : 'Colecionador · negociar no chat'}
                            {' · '}{g.itens.length} {g.itens.length === 1 ? 'carta' : 'cartas'} · {brl(g.soma)}
                          </div>
                        </div>
                        {g.compraDireta && g.lojaId && g.itens.length > 1 && (
                          todasNoCarrinho ? (
                            <Link href="/carrinho" className="bx-ctx-comprador" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--ac-1)', color: 'var(--ac-1)', textDecoration: 'none' }}>
                              <IconCheck size={15} color="var(--ac-1)" /> No carrinho · ver
                            </Link>
                          ) : (
                            <button onClick={() => colocarNoCarrinho(g)} className="bx-ctx-comprador" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', cursor: 'pointer' }}>
                              <IconCarrinho size={15} /> Colocar as {g.itens.length} no carrinho
                            </button>
                          )
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {g.itens.map(({ carta: c, oferta: o }) => (
                          <Link key={o.id} href={o.href} className="bx-meta-oferta" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', minHeight: 44, borderTop: '1px solid var(--bx-border)', textDecoration: 'none', color: 'inherit' }}>
                            {c.image_small && <Image src={c.image_small} alt={c.nome} width={40} height={56} sizes="40px" style={{ width: 40, height: 56, objectFit: 'contain', borderRadius: 4, flex: '0 0 auto' }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                              <div style={{ fontSize: 12, color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {[c.numero, c.set_name].filter(Boolean).join(' · ')}{o.badges.length ? ` · ${o.badges.join(' · ')}` : ''}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                              <div style={{ fontSize: 15, fontWeight: 800 }}>{brl(o.preco)}</div>
                              <div style={{ fontSize: 11, color: 'var(--bx-text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                {o.compraDireta ? <><IconCarrinho size={11} /> comprar</> : <><IconChat size={11} /> negociar</>}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: 0 }}>
                  O carrinho da Bynx fecha uma loja por vez: um pagamento e um frete por loja. Com colecionador, vocês combinam pelo chat.
                </p>
              </div>
            ) : visiveis.length === 0 ? (
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
                      badge={!c.tenho && melhorOferta.has(c.card_id) ? (
                        <div style={{ background: 'var(--ac-grad)', borderRadius: 8, padding: '4px 7px', fontSize: 11, fontWeight: 800, color: 'var(--bx-brand-ink)' }}>À venda</div>
                      ) : undefined}
                      footerSlot={c.tenho ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--bx-green)' }}>
                          <IconCheck size={13} color="var(--bx-green)" /> Na coleção
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {melhorOferta.has(c.card_id) && (
                            <Link href={melhorOferta.get(c.card_id)!.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)' }}>
                              À venda por {brl(melhorOferta.get(c.card_id)!.preco)}
                            </Link>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => adicionar(c)} disabled={adicionando === c.card_id}
                              style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 44, borderRadius: 10, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.1)', color: 'var(--ac-1)', cursor: 'pointer' }}>
                              <IconPlus size={14} color="var(--ac-1)" /> {adicionando === c.card_id ? 'Adicionando…' : 'Tenho esta'}
                            </button>
                            <button onClick={() => definirTeto(c)}
                              aria-label={tetos.has(c.card_id) ? 'Editar aviso de preço' : 'Avisar quando aparecer à venda'}
                              title={tetos.get(c.card_id) != null ? `Aviso até ${brl(tetos.get(c.card_id)!)}` : tetos.has(c.card_id) ? 'Aviso em qualquer preço' : 'Avisar quando aparecer à venda'}
                              style={{ width: 44, height: 44, flex: '0 0 auto', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: `1px solid ${tetos.has(c.card_id) ? 'var(--ac-1)' : 'var(--bx-border)'}`,
                                background: tetos.has(c.card_id) ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)' }}>
                              <IconBell size={16} color={tetos.has(c.card_id) ? 'var(--ac-1)' : 'var(--bx-text-2)'} />
                            </button>
                          </div>
                        </div>
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
          .bx-meta-oferta { transition: background 0.15s ease; border-radius: 8px; }
          .bx-meta-oferta:hover { background: var(--bx-surface-2); }
        `}</style>
      </div>
    </AppLayout>
  )
}
