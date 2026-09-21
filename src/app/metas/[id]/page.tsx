'use client'

/**
 * src/app/metas/[id]/page.tsx
 *
 * A meta aberta (#368). Redesenhada em 21/09/2026 a partir do mockup aprovado
 * pelo Du (canvas "Metas: nova experiencia"), depois de 6 frentes de analise.
 *
 * O que a tela precisa fazer, em ordem:
 *  1. Dizer o que e (titulo com contexto: "Colecao 151", "Todas as cartas de
 *     Charizard") e ONDE a pessoa esta: anel duplo cartas/valor + uma FRASE
 *     que le os dois numeros ("97% do valor com R$ 399 faltando" parecia erro).
 *  2. Dizer o que fazer agora: UM botao principal, que muda com o estado
 *     (ha oferta -> ver a venda; senao -> marcar as que ja tem).
 *  3. Enaltecer o que so a Bynx faz: "A venda agora" e o Radar em blocos
 *     proprios, o orcamento guiado e o card de meta completa.
 *
 * Valor = bynx_valor_carta() no banco (menor preco, regra de 25/08). A tela so
 * soma o que veio. Carta sem preco entra como zero e a tela DIZ quantas sao.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { IconBell, IconCarrinho, IconChat, IconCheck, IconPlus, IconSearch, IconTarget, IconTrendingUp, IconArrowRight, IconTrash, IconClose } from '@/components/ui/Icons'
import LequeCartas, { type CartaLeque } from '@/components/metas/LequeCartas'
import AnelMeta, { LegendaAnel } from '@/components/metas/AnelMeta'
import { supabase } from '@/lib/supabaseClient'
import { getUserPlan } from '@/lib/isPro'
import { track, trackFirstCardAdded } from '@/lib/analytics'
import { checkCardLimit, limiteCartasDoErro } from '@/lib/checkCardLimit'
import { adicionar as adicionarAoCarrinho, estaNoCarrinho } from '@/lib/carrinho'
import {
  IDIOMAS_META, brl, buscarOfertasDaMeta, carregarMeta, criarMeta, fraseLeitura, pct, rotuloIdioma, tituloMeta,
  type CartaDaMeta, type Meta, type OfertaMeta,
} from '@/lib/metas'

type Aba = 'faltam' | 'tenho' | 'avenda'
type GrupoVendedor = {
  chave: string; vendedor: string; lojaId: string | null; compraDireta: boolean
  itens: { carta: CartaDaMeta; oferta: OfertaMeta }[]; soma: number
}
type Toast = { texto: string; desfazer?: () => void }

const POR_PAGINA = 60
const bloco: React.CSSProperties = { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 18 }
const kicker: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)' }
const btnPrim: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: 'inherit', fontSize: 14, fontWeight: 800, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', textDecoration: 'none' }
const btnSec: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 16px', borderRadius: 12, border: '1px solid var(--bx-border)', cursor: 'pointer', background: 'var(--bx-surface-2)', color: 'var(--bx-text)', textDecoration: 'none' }
const icone = (tam = 40): React.CSSProperties => ({ width: tam, height: tam, borderRadius: 12, background: 'rgba(var(--ac-1-rgb), 0.12)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })

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
  const [setInfo, setSetInfo] = useState<{ nome: string | null; serie: string | null; ano: string | null }>({ nome: null, serie: null, ano: null })
  const [aba, setAba] = useState<Aba>('faltam')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [ofertas, setOfertas] = useState<OfertaMeta[] | null>(null)
  const [noCarrinho, setNoCarrinho] = useState<Set<string>>(new Set())
  const [orcamento, setOrcamento] = useState<number>(100)
  const [tetos, setTetos] = useState<Map<string, number | null>>(new Map())
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set())
  const [recentes, setRecentes] = useState<Set<string>>(new Set())
  const [marcando, setMarcando] = useState(false)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [usoPlano, setUsoPlano] = useState<{ total: number; limite: number } | null>(null)
  const [limite, setLimite] = useState<number | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [porque, setPorque] = useState(false)
  const [menu, setMenu] = useState(false)
  const [trocandoIdioma, setTrocandoIdioma] = useState(false)
  const [dicaVista, setDicaVista] = useState(true)
  const gradeRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mostrarToast = useCallback((t: Toast) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }, [])

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
      if (!uid) { setLoaded(true); return }
      const [p, r, w] = await Promise.all([
        getUserPlan(uid), carregar(),
        supabase.from('watchlist').select('card_id, target_price').eq('user_id', uid),
      ])
      if (!ativo) return
      setPlano(p.plano)
      setTetos(new Map((w.data || []).map((x: { card_id: string; target_price: number | null }) =>
        [x.card_id, x.target_price == null ? null : Number(x.target_price)])))
      try { setDicaVista(localStorage.getItem('bx-metas-dica-jatenho') === '1') } catch { setDicaVista(false) }
      if (!r) return
      if (r.meta.concluida_em) setAba('tenho')
      if (r.meta.tipo === 'set') {
        const { data } = await supabase.from('pokemon_sets').select('name, name_pt, series, release_date').eq('id', r.meta.alvo).maybeSingle()
        const d = data as { name?: string; name_pt?: string | null; series?: string | null; release_date?: string | null } | null
        if (ativo) setSetInfo({ nome: d?.name_pt || d?.name || r.cartas[0]?.set_name || null, serie: d?.series || null, ano: d?.release_date?.slice(0, 4) || null })
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
    const semPreco = cartas.filter(c => !c.tenho && !(c.valor > 0)).length
    return { total, tenho, vt, vtenho, falta: Math.max(0, vt - vtenho), semPreco }
  }, [cartas])

  // ── A venda agora ────────────────────────────────────────────────────────
  const chaveFaltam = useMemo(() => cartas.filter(c => !c.tenho).map(c => c.card_id).join(','), [cartas])
  useEffect(() => {
    if (!loaded || !meta) return
    let ativo = true
    buscarOfertasDaMeta(chaveFaltam ? chaveFaltam.split(',') : []).then(o => {
      if (!ativo) return
      setOfertas(o)
      if (o) setNoCarrinho(new Set(o.filter(x => estaNoCarrinho(x.id)).map(x => x.id)))
    })
    return () => { ativo = false }
  }, [chaveFaltam, loaded, meta])

  // Meta com idioma so aceita oferta naquele idioma. Anuncio criado antes de
  // 21/09 pode estar como 'pt' sem ser -- o idioma nao era gravado (#372).
  const melhorOferta = useMemo(() => {
    const m = new Map<string, OfertaMeta>()
    for (const o of ofertas || []) {
      if (meta?.idioma && o.idioma !== meta.idioma) continue
      if (!m.has(o.card_id)) m.set(o.card_id, o)
    }
    return m
  }, [ofertas, meta])

  const aVenda = useMemo(() => {
    const itens = cartas.filter(c => !c.tenho && melhorOferta.has(c.card_id)).map(c => ({ carta: c, oferta: melhorOferta.get(c.card_id)! }))
    const soma = itens.reduce((s, i) => s + i.oferta.preco, 0)
    const grupos = new Map<string, GrupoVendedor>()
    for (const i of itens) {
      const chave = i.oferta.lojaId || `v:${i.oferta.vendedor}`
      const g = grupos.get(chave) || { chave, vendedor: i.oferta.vendedor, lojaId: i.oferta.lojaId, compraDireta: i.oferta.compraDireta, itens: [], soma: 0 }
      g.itens.push(i); g.soma += i.oferta.preco
      grupos.set(chave, g)
    }
    const lista = [...grupos.values()].sort((a, b) =>
      Number(b.compraDireta) - Number(a.compraDireta) || b.itens.length - a.itens.length || a.soma - b.soma)
    return { itens: [...itens].sort((a, b) => a.oferta.preco - b.oferta.preco), soma, grupos: lista }
  }, [cartas, melhorOferta])

  // Orcamento guiado: das faltantes a venda, da mais barata para a mais cara,
  // ate o valor escolhido. Guloso de proposito: maximiza CARTAS.
  const plano$ = useMemo(() => {
    const escolhidas: typeof aVenda.itens = []
    let gasto = 0
    for (const i of aVenda.itens) {
      if (gasto + i.oferta.preco > orcamento) break
      escolhidas.push(i); gasto += i.oferta.preco
    }
    return { escolhidas, gasto, valorGanho: escolhidas.reduce((s, i) => s + i.carta.valor, 0), maisBarata: aVenda.itens[0]?.oferta.preco ?? 0 }
  }, [aVenda, orcamento])

  function colocarNoCarrinho(g: GrupoVendedor) {
    if (!g.lojaId) return
    for (const i of g.itens) if (!estaNoCarrinho(i.oferta.id)) adicionarAoCarrinho({ id: i.oferta.id, tipo: 'carta', lojaId: g.lojaId })
    setNoCarrinho(prev => new Set([...prev, ...g.itens.map(i => i.oferta.id)]))
  }

  // ── Grade ────────────────────────────────────────────────────────────────
  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    // A carta marcada agora FICA em "Faltam" (com check) ate trocar de aba:
    // sumir debaixo do dedo fazia a de baixo subir e o proximo toque errar.
    const base = aba === 'tenho' ? cartas.filter(c => c.tenho) : cartas.filter(c => !c.tenho || recentes.has(c.card_id))
    return q ? base.filter(c => c.nome.toLowerCase().includes(q) || (c.numero || '').toLowerCase() === q) : base
  }, [cartas, aba, busca, recentes])

  function trocarAba(a: Aba) {
    setAba(a); setPagina(1); setRecentes(new Set())
    if (a !== 'faltam') { setMarcando(false); setSelecionadas(new Set()) }
  }
  function irPara(a: Aba) {
    trocarAba(a)
    // scrollIntoView suave era cancelado pelo re-render da troca de aba (a
    // pagina andava 28px). Rolar a janela depois do render resolve.
    setTimeout(() => {
      const el = gradeRef.current
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' })
    }, 60)
  }

  async function iniciarMarcacao() {
    irPara('faltam')
    setMarcando(true)
    setSelecionadas(new Set())
    if (userId) {
      const { total, limite: lim } = await checkCardLimit(userId)
      setUsoPlano(Number.isFinite(lim) ? { total, limite: lim } : null)
    }
  }

  function linhaColecao(c: CartaDaMeta): Record<string, unknown> {
    const l: Record<string, unknown> = {
      user_id: userId, pokemon_api_id: c.card_id, card_id: c.card_id,
      card_name: c.nome, card_image: c.image_small, set_name: c.set_name,
      rarity: c.raridade, variante: 'normal', quantity: 1,
    }
    if (meta?.idioma) l.idioma = meta.idioma
    return l
  }

  function registrarAdicao(c: CartaDaMeta) {
    track({ name: 'card_added_to_collection', properties: { card_id: c.card_id, set_id: c.set_id || '', quantity: 1, origem: 'meta', plano } })
  }

  async function checarConclusao(antes: string | null | undefined) {
    const r = await carregar()
    if (r && !antes && r.meta.concluida_em) {
      track({ name: 'meta_concluida', properties: { tipo: r.meta.tipo, total: r.meta.total || 0, plano } })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    return r
  }

  // "Ja tenho" de uma carta. O botao fica travado ate a meta recarregar: o
  // segundo toque batia no indice unico e mostrava "voce ja tem em outro
  // idioma" -- falso (auditoria mobile 21/09).
  async function jaTenho(c: CartaDaMeta) {
    if (!userId || !meta || ocupadas.has(c.card_id)) return
    setOcupadas(prev => new Set(prev).add(c.card_id))
    const { data, error } = await supabase.from('user_cards').insert(linhaColecao(c)).select('id').single()
    if (error) {
      setOcupadas(prev => { const n = new Set(prev); n.delete(c.card_id); return n })
      const lim = limiteCartasDoErro(error)
      if (lim !== null) {
        track({ name: 'limite_cartas_atingido', properties: { origem: 'meta', limite: lim, plano } })
        setLimite(lim); return
      }
      if (error.code === '23505') {
        showAlert(meta.idioma
          ? 'Esta carta já está na sua coleção em outro idioma. Por enquanto, a coleção guarda um idioma por carta.'
          : 'Esta carta já está na sua coleção.', 'warning')
        await carregar(); return
      }
      showAlert('Não conseguimos adicionar a carta. Tente de novo.', 'error'); return
    }
    trackFirstCardAdded(userId)
    registrarAdicao(c)
    setRecentes(prev => new Set(prev).add(c.card_id))
    const antes = meta.concluida_em
    const r = await checarConclusao(antes)
    setOcupadas(prev => { const n = new Set(prev); n.delete(c.card_id); return n })
    const novoId = (data as { id: string } | null)?.id
    mostrarToast({
      texto: `${c.nome} entrou na sua coleção. Agora são ${r?.meta.tenho ?? resumo.tenho + 1} de ${r?.meta.total ?? resumo.total}.`,
      desfazer: novoId ? async () => {
        setToast(null)
        await supabase.from('user_cards').delete().eq('id', novoId)
        setRecentes(prev => { const n = new Set(prev); n.delete(c.card_id); return n })
        await carregar()
      } : undefined,
    })
  }

  // Marcar varias: insere em sequencia (o limite do plano vale por linha no
  // banco) e recarrega UMA vez no fim.
  async function adicionarSelecionadas() {
    if (!userId || !meta || selecionadas.size === 0) return
    const escolha = cartas.filter(c => selecionadas.has(c.card_id) && !c.tenho)
    setOcupadas(new Set(escolha.map(c => c.card_id)))
    let entraram = 0
    let limiteBatido: number | null = null
    for (const c of escolha) {
      const { error } = await supabase.from('user_cards').insert(linhaColecao(c))
      if (error) {
        const lim = limiteCartasDoErro(error)
        if (lim !== null) { limiteBatido = lim; break }
        continue
      }
      entraram++; registrarAdicao(c)
    }
    if (entraram > 0) trackFirstCardAdded(userId)
    setMarcando(false); setSelecionadas(new Set())
    setRecentes(new Set(escolha.slice(0, entraram).map(c => c.card_id)))
    await checarConclusao(meta.concluida_em)
    setOcupadas(new Set())
    if (limiteBatido !== null) {
      track({ name: 'limite_cartas_atingido', properties: { origem: 'meta', limite: limiteBatido, plano } })
      mostrarToast({ texto: `Entraram ${entraram} de ${escolha.length}. Sua coleção chegou ao limite do plano.` })
      setLimite(limiteBatido)
    } else {
      mostrarToast({ texto: `${entraram} ${entraram === 1 ? 'carta entrou' : 'cartas entraram'} na sua coleção e na meta.` })
    }
  }

  function alternarSelecao(cid: string) {
    setSelecionadas(prev => { const n = new Set(prev); if (n.has(cid)) n.delete(cid); else n.add(cid); return n })
  }

  async function definirTeto(c: CartaDaMeta) {
    if (!userId) return
    const atual = tetos.get(c.card_id)
    const v = await showPrompt({
      message: `Até quanto você pagaria por ${c.nome}?`,
      placeholder: 'Ex.: 50',
      defaultValue: atual != null ? String(atual).replace('.', ',') : '',
      hint: 'Em reais. Você só recebe aviso de anúncio até esse valor. Deixe em branco para receber de qualquer preço.',
      inputMode: 'decimal',
      permitirVazio: true,
    })
    if (v === null) return
    const limpo = v.trim().replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
    const teto = limpo ? Number(limpo) : null
    if (teto !== null && (!Number.isFinite(teto) || teto <= 0)) { showAlert('Digite um valor em reais, como 50 ou 49,90.', 'warning'); return }
    const { error } = await supabase.from('watchlist').upsert(
      { user_id: userId, card_id: c.card_id, target_price: teto, target_type: teto === null ? null : 'max' },
      { onConflict: 'user_id,card_id' },
    )
    if (error) { showAlert('Não conseguimos salvar o aviso. Tente de novo.', 'error'); return }
    setTetos(prev => new Map(prev).set(c.card_id, teto))
    mostrarToast({ texto: teto === null ? `Pronto. Você recebe aviso quando ${c.nome} aparecer à venda, em qualquer preço.` : `Pronto. Você só recebe aviso de ${c.nome} por até ${brl(teto)}.` })
  }

  async function outroValor() {
    const v = await showPrompt({ message: 'Quanto você quer gastar nesta meta?', placeholder: 'Ex.: 200', hint: 'Em reais.', inputMode: 'decimal' })
    if (!v) return
    const n = Number(v.replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
    if (Number.isFinite(n) && n > 0) setOrcamento(n)
  }

  async function mudarIdioma(novo: string | null) {
    if (!meta || novo === meta.idioma) { setTrocandoIdioma(false); return }
    try {
      const novoId = await criarMeta(meta.tipo, meta.alvo, novo)
      if (novoId !== meta.id) await supabase.from('metas_colecao').delete().eq('id', meta.id)
      track({ name: 'meta_criada', properties: { tipo: meta.tipo, alvo: meta.alvo, idioma: novo, plano, origem: 'idioma' } })
      router.replace(`/metas/${novoId}`)
    } catch {
      showAlert('Não conseguimos trocar o idioma agora. Tente de novo.', 'error')
    }
  }

  async function apagar() {
    if (!meta) return
    setMenu(false)
    const ok = await showConfirm({ message: `Apagar a meta ${titulo}?`, confirmLabel: 'Apagar meta', danger: true, description: 'Suas cartas continuam na coleção. Somem só o acompanhamento e o radar desta meta.' })
    if (!ok) return
    const { error } = await supabase.from('metas_colecao').delete().eq('id', meta.id)
    if (error) { showAlert('Não conseguimos apagar a meta. Tente de novo.', 'error'); return }
    router.push('/metas')
  }

  function fecharDica() {
    setDicaVista(true)
    try { localStorage.setItem('bx-metas-dica-jatenho', '1') } catch {}
  }

  const titulo = meta ? tituloMeta(meta.tipo, meta.alvo, setInfo.nome) : 'Meta'
  const idiomaTxt = meta ? rotuloIdioma(meta.idioma) : null
  const faltamN = resumo.total - resumo.tenho
  const pc = pct(resumo.tenho, resumo.total), pv = pct(resumo.vtenho, resumo.vt)
  const frase = fraseLeitura(resumo, brl)
  const capa: CartaLeque[] = useMemo(() => [...cartas].filter(c => c.image_small).sort((a, b) => b.valor - a.valor).slice(0, 5)
    .map(c => ({ image: c.image_small, nome: c.nome, tem: c.tenho })), [cartas])
  const capaTodasTem = capa.length > 0 && capa.every(c => c.tem)
  const tetosNaMeta = cartas.filter(c => !c.tenho && tetos.get(c.card_id) != null).length
  const descricao = meta
    ? [meta.tipo === 'pokemon' ? 'Meta de Pokémon · todas as coleções' : ['Meta de coleção', setInfo.serie, setInfo.ano].filter(Boolean).join(' · '),
       idiomaTxt ? `só cartas em ${idiomaTxt.toLowerCase()}` : 'qualquer idioma'].join(' · ')
    : 'Meta de coleção'
  const pagina$ = visiveis.slice(0, pagina * POR_PAGINA)

  const chip = (ativo: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: 14, fontWeight: 700, minHeight: 44, padding: '0 14px', borderRadius: 999, cursor: 'pointer',
    border: `1px solid ${ativo ? 'var(--ac-1)' : 'var(--bx-border)'}`,
    background: ativo ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)',
    color: ativo ? 'var(--ac-1)' : 'var(--bx-text-2)',
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  })
  const segBtn = (a: Aba, rotulo: string, n: number, comprador = false) => (
    <button key={a} onClick={() => trocarAba(a)} className={comprador ? 'bx-ctx-comprador' : undefined} aria-pressed={aba === a} style={{
      font: 'inherit', minHeight: 40, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700,
      background: aba === a ? 'var(--bx-surface-3)' : 'transparent', color: aba === a ? 'var(--bx-text)' : 'var(--bx-text-3)',
      transition: 'background 0.15s ease, color 0.15s ease',
    }}>
      {comprador && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ac-1)' }} />}
      {rotulo} <span style={{ fontSize: 11, color: 'var(--bx-text-3)' }}>{n}</span>
    </button>
  )

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 0 60px' }}>
        <PageHeader
          trilha={[INICIO, { name: 'Coleção', href: '/minha-colecao' }, { name: 'Metas', href: '/metas' }, { name: titulo, href: `/metas/${id}` }]}
          titulo={titulo}
          selo={
            <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(var(--ac-1-rgb), 0.13)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <IconTarget size={17} color="var(--ac-1)" />
            </span>
          }
          descricao={descricao}
          acao={meta ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenu(v => !v)} aria-label="Mais opções da meta" aria-expanded={menu}
                style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--bx-border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bx-text-2)', fontSize: 20, lineHeight: 1 }}>
                <span aria-hidden="true" style={{ marginTop: -8 }}>…</span>
              </button>
              {menu && (
                <div style={{ position: 'absolute', right: 0, top: 50, zIndex: 20, minWidth: 220, background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', borderRadius: 12, boxShadow: 'var(--bx-shadow)', padding: 6 }}>
                  <button onClick={() => { setMenu(false); setTrocandoIdioma(true) }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, font: 'inherit', fontSize: 14, minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--bx-text)', cursor: 'pointer' }}>Mudar idioma da meta</button>
                  <button onClick={apagar} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, font: 'inherit', fontSize: 14, minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--bx-red)', cursor: 'pointer' }}><IconTrash size={16} color="var(--bx-red)" />Apagar meta</button>
                </div>
              )}
            </div>
          ) : undefined}
        />

        {trocandoIdioma && meta && (
          <div style={{ ...bloco, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>Vale carta de qual idioma?</div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--bx-text-2)' }}>Só entram na conta as cartas neste idioma. Se não faz diferença, deixe &ldquo;Qualquer idioma&rdquo;.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {IDIOMAS_META.map(i => <button key={i.label} style={chip(meta.idioma === i.key)} onClick={() => mudarIdioma(i.key)}>{i.label}</button>)}
              <button style={{ ...chip(false), border: 'none', background: 'transparent' }} onClick={() => setTrocandoIdioma(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {!loaded && (
          <div aria-busy="true">
            <span className="bx-sr" aria-live="polite">Cruzando a meta com a sua coleção…</span>
            <div className="bx-meta-esq" style={{ ...bloco, borderRadius: 20, height: 340, marginBottom: 16 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 170px), 1fr))', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bx-meta-esq" style={{ ...bloco, aspectRatio: '63 / 100' }} />)}
            </div>
          </div>
        )}

        {loaded && !userId && (
          <div style={{ ...bloco, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Entre para ver sua meta</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px' }}>Suas metas ficam salvas na sua conta.</p>
            <button onClick={() => openLogin({ next: `/metas/${id}` })} style={btnPrim}>Entrar</button>
          </div>
        )}

        {loaded && userId && naoAchou && (
          <div style={{ ...bloco, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Meta não encontrada</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px' }}>Ela pode ter sido apagada, ou você entrou com outra conta.</p>
            <button onClick={() => router.push('/metas')} style={btnPrim}>Ver minhas metas</button>
          </div>
        )}

        {loaded && meta && (
          <>
            {/* ── Heroi ───────────────────────────────────────────────── */}
            {meta.concluida_em ? (() => {
              const dias = Math.max(1, Math.round((new Date(meta.concluida_em).getTime() - new Date(meta.created_at).getTime()) / 86400000))
              // Sem o valor em reais: o texto e publico, e anunciar quanto vale
              // a colecao de alguem nao e conquista, e exposicao.
              const texto = `Completei a ${titulo}${idiomaTxt ? ` em ${idiomaTxt.toLowerCase()}` : ''}: ${resumo.total} de ${resumo.total} cartas, em ${dias} ${dias === 1 ? 'dia' : 'dias'} de caçada. Acompanhei tudo pelas Metas da Bynx.`
              return (
                <div style={{ borderRadius: 20, border: '1px solid rgba(var(--ac-1-rgb), 0.45)', background: 'radial-gradient(420px 280px at 50% 0%, rgba(var(--ac-1-rgb), 0.22), transparent 70%), var(--bx-surface)', padding: '26px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{ ...kicker, color: 'var(--bx-green)' }}>Meta completa</div>
                  <div style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 900, letterSpacing: '-0.03em' }}>{titulo}{idiomaTxt ? ` em ${idiomaTxt.toLowerCase()}` : ''}</div>
                  <LequeCartas tamanho="lg" cartas={capa} prioridade />
                  <div style={{ fontSize: 14, color: 'var(--bx-text-2)' }}>Você completou todas as cartas. Isso é para poucos.</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, width: '100%', maxWidth: 480 }}>
                    {[[String(resumo.total), 'cartas'], [brl(resumo.vt), 'valor hoje'], [`${dias}`, dias === 1 ? 'dia de caçada' : 'dias de caçada']].map(([a, b]) => (
                      <div key={b} style={{ background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border)', borderRadius: 12, padding: '10px 4px' }}>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{a}</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)' }}>{b}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <BotaoCompartilhar url="/colecionadores" titulo={`Completei a ${titulo}`} texto={texto} />
                    <Link href="/metas" style={btnSec}>Qual é a próxima? Criar outra meta</Link>
                  </div>
                </div>
              )
            })() : (
              <div className="bx-meta-hero" style={{ background: 'var(--bx-hero-wash), var(--bx-surface)', border: '1px solid rgba(var(--ac-1-rgb), 0.28)', borderRadius: 20, boxShadow: '0 18px 50px -22px rgba(var(--ac-1-rgb), 0.4)', overflow: 'hidden', marginBottom: 16 }}>
                <div className="bx-meta-capa" style={{ background: 'var(--bx-hero-wash), var(--bx-surface-2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '18px 16px 14px' }}>
                  <div className="bx-meta-leque-lg"><LequeCartas tamanho="lg" cartas={capa} prioridade /></div>
                  <div className="bx-meta-leque-md"><LequeCartas tamanho="md" cartas={capa} prioridade /></div>
                  {capa.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)', textAlign: 'center' }}>
                    As {capa.length} cartas mais valiosas da meta.{capaTodasTem ? ' Você já tem todas.' : ''}
                  </div>}
                </div>
                <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={kicker}>Seu progresso</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="bx-anel-lg"><AnelMeta cartas={pc} valor={pv} tamanho={120} /></div>
                    <div className="bx-anel-md"><AnelMeta cartas={pc} valor={pv} tamanho={88} /></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                      <div style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1 }}>
                        {resumo.tenho} <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--bx-text-2)', letterSpacing: 0 }}>de {resumo.total} cartas</span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>Suas cartas valem {brl(resumo.vtenho)}</div>
                      <LegendaAnel cartas={pc} valor={pv} />
                    </div>
                  </div>
                  <div style={{ height: 1, background: 'var(--bx-border)' }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--bx-text-3)' }}>Para completar</div>
                    <div className="bx-meta-grad" style={{ fontSize: 'clamp(26px, 4vw, 34px)', fontWeight: 900, letterSpacing: '-0.035em' }}>{brl(resumo.falta)}</div>
                    <div style={{ fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.5 }}>
                      somando o menor preço de cada carta que falta{resumo.semPreco > 0 ? ` · ${resumo.semPreco} ${resumo.semPreco === 1 ? 'carta sem preço fica' : 'cartas sem preço ficam'} fora da conta` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)' }}>
                    <span style={{ ...icone(32), borderRadius: 10, border: 'none' }}><IconTrendingUp size={16} color="var(--ac-1)" /></span>
                    <div style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>
                      <b style={{ color: 'var(--bx-text)' }}>{frase.forte}</b> {frase.resto}{' '}
                      <button onClick={() => setPorque(v => !v)} aria-expanded={porque} style={{ font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--ac-1)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>Por que dois números?</button>
                      {porque && <span style={{ display: 'block', marginTop: 8 }}>O anel de fora conta quantas cartas você tem. O de dentro soma quanto elas valem pelo menor preço: se você já tem as mais caras, o valor sobe na frente.</span>}
                    </div>
                  </div>
                  <div className="bx-meta-acoes" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {aVenda.itens.length > 0 ? (
                      <>
                        <button onClick={() => irPara('avenda')} className="bx-ctx-comprador bx-meta-cta" style={btnPrim}><IconCarrinho size={16} color="currentColor" />Ver {aVenda.itens.length === 1 ? 'a 1 à venda' : `as ${aVenda.itens.length} à venda`} agora</button>
                        <button onClick={iniciarMarcacao} style={btnSec}><IconCheck size={15} color="currentColor" />Marcar as que já tenho</button>
                      </>
                    ) : faltamN > 0 && (
                      <>
                        <button onClick={iniciarMarcacao} className="bx-meta-cta" style={btnPrim}><IconCheck size={16} color="currentColor" />Marcar as que já tenho</button>
                        <button onClick={() => irPara('faltam')} style={btnSec}>Ver as {faltamN} que faltam</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── A venda agora + Radar ───────────────────────────────── */}
            {!meta.concluida_em && (
              <div className="bx-meta-faixas" style={{ marginBottom: 8 }}>
                {aVenda.itens.length > 0 && (
                  <div className="bx-ctx-comprador" style={{ ...bloco, padding: 16, background: 'linear-gradient(180deg, rgba(var(--ac-1-rgb), 0.08), transparent), var(--bx-surface)', borderColor: 'rgba(var(--ac-1-rgb), 0.3)', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={kicker}>À venda agora na Bynx</div>
                        <div style={{ fontSize: 16, fontWeight: 800, margin: '4px 0 2px' }}>{aVenda.itens.length} {aVenda.itens.length === 1 ? 'carta que falta' : 'cartas que faltam'}, {aVenda.grupos.length === 1 ? 'de 1 vendedor' : `de ${aVenda.grupos.length} vendedores`}</div>
                        <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>Somando {brl(aVenda.soma)}</div>
                      </div>
                      <button onClick={() => irPara('avenda')} style={{ font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 44, padding: '0 4px', border: 'none', background: 'none', color: 'var(--ac-1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todas <IconArrowRight size={14} color="var(--ac-1)" /></button>
                    </div>
                    <div className="bx-meta-trilho" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', marginTop: 12, paddingBottom: 4 }}>
                      {aVenda.itens.map(({ carta: c, oferta: o }) => (
                        <Link key={o.id} href={o.href} prefetch={false} style={{ width: 76, flexShrink: 0, scrollSnapAlign: 'start', textDecoration: 'none', color: 'inherit' }}>
                          <div style={{ position: 'relative', aspectRatio: '63 / 88', borderRadius: 6, overflow: 'hidden', background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)' }}>
                            {c.image_small && <Image src={c.image_small} alt={c.nome} fill sizes="76px" style={{ objectFit: 'contain' }} />}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, marginTop: 6 }}>{brl(o.preco)}</div>
                          <div style={{ fontSize: 11, color: 'var(--bx-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.vendedor.split(' ')[0]}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ ...bloco, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={icone(40)}><IconBell size={18} color="var(--ac-1)" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={kicker}>Radar</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--bx-green)' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bx-green)' }} />Ligado · vigiando {faltamN} {faltamN === 1 ? 'carta' : 'cartas'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>
                      {aVenda.itens.length === 0 ? 'Nenhuma carta que falta está à venda agora. ' : ''}Quando alguém anunciar uma delas na Bynx, o sino avisa. Quer pagar no máximo um valor? Toque no sino da carta.
                      {tetosNaMeta > 0 && <b style={{ color: 'var(--bx-text)' }}> {tetosNaMeta} {tetosNaMeta === 1 ? 'carta tem' : 'cartas têm'} preço máximo.</b>}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── As cartas ───────────────────────────────────────────── */}
            <div ref={gradeRef} style={{ scrollMarginTop: 72 }} />
            <h2 style={{ margin: '24px 0 12px', fontSize: 17, fontWeight: 800 }}>As cartas da meta</h2>
            <div className="bx-meta-abas" style={{ position: 'sticky', top: 69, zIndex: 30, background: 'var(--bx-bg)', padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div role="group" aria-label="Filtrar cartas" className="bx-meta-seg" style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', gap: 2, maxWidth: '100%', overflowX: 'auto' }}>
                {segBtn('faltam', 'Faltam', faltamN)}
                {segBtn('tenho', 'Tenho', resumo.tenho)}
                {aVenda.itens.length > 0 && segBtn('avenda', 'À venda', aVenda.itens.length, true)}
              </div>
              {aba !== 'avenda' && (
                <label style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
                  <span style={{ position: 'absolute', left: 12, top: 14, pointerEvents: 'none' }}><IconSearch size={15} color="var(--bx-text-3)" /></span>
                  <span className="bx-sr">Buscar na meta</span>
                  <input value={busca} onChange={e => { setBusca(e.target.value); setPagina(1) }} placeholder="Buscar na meta"
                    style={{ width: '100%', boxSizing: 'border-box', fontSize: 16, minHeight: 44, padding: '8px 12px 8px 34px', borderRadius: 12, border: '1px solid var(--bx-border)', background: 'var(--bx-bg-elev)', color: 'var(--bx-text)', outline: 'none' }} />
                </label>
              )}
              {aba === 'faltam' && faltamN > 0 && !marcando && (
                <button onClick={iniciarMarcacao} style={btnSec}><IconCheck size={15} color="currentColor" />Marcar várias</button>
              )}
              {marcando && (
                <button onClick={() => { setMarcando(false); setSelecionadas(new Set()) }} style={btnSec}>Cancelar</button>
              )}
            </div>

            {aba === 'avenda' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                <div style={{ ...bloco, padding: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Quanto você quer gastar nesta meta?</div>
                  <p style={{ margin: '2px 0 12px', fontSize: 13, color: 'var(--bx-text-2)' }}>A Bynx escolhe as cartas mais baratas à venda, para você avançar o máximo possível.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, maxWidth: 480 }}>
                    {[50, 100, 300].map(v => <button key={v} style={{ ...chip(orcamento === v), padding: 0 }} onClick={() => setOrcamento(v)}>R$ {v}</button>)}
                    <button style={{ ...chip(![50, 100, 300].includes(orcamento)), padding: 0 }} onClick={outroValor}>{[50, 100, 300].includes(orcamento) ? 'Outro' : brl(orcamento)}</button>
                  </div>
                  {plano$.escolhidas.length === 0 ? (
                    <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--bx-text-2)' }}>Com esse valor ainda não dá: a carta mais barata à venda sai por {brl(plano$.maisBarata)}.</p>
                  ) : (
                    <>
                      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: 'color-mix(in srgb, var(--bx-green) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-green) 25%, transparent)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--bx-text-3)' }}>{resumo.tenho}</span>
                        <IconArrowRight size={16} color="var(--bx-green)" />
                        <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--bx-green)' }}>{resumo.tenho + plano$.escolhidas.length}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--bx-text-3)' }}>de {resumo.total} cartas</span>
                      </div>
                      <p style={{ margin: '10px 0 6px', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>
                        <b style={{ color: 'var(--bx-text)' }}>Com {brl(orcamento)}, você leva {plano$.escolhidas.length} {plano$.escolhidas.length === 1 ? 'carta' : 'cartas'} por {brl(plano$.gasto)}.</b> Suas cartas passam a valer {brl(resumo.vtenho + plano$.valorGanho)}.
                      </p>
                      <div>
                        {plano$.escolhidas.map(({ carta: c, oferta: o }) => (
                          <Link key={o.id} href={o.href} prefetch={false} className="bx-meta-linha" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', minHeight: 44, borderTop: '1px solid var(--bx-border)', textDecoration: 'none', color: 'inherit' }}>
                            {c.image_small && <Image src={c.image_small} alt={c.nome} width={34} height={47} sizes="34px" style={{ width: 34, height: 47, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }} />}
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[c.numero, c.set_name].filter(Boolean).join(' · ')} · {o.vendedor}</span>
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 800 }}>{brl(o.preco)}</span>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <h3 style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 800 }}>Quem vende as cartas que faltam</h3>
                {aVenda.grupos.map(g => {
                  const todasNoCarrinho = g.itens.every(i => noCarrinho.has(i.oferta.id))
                  return (
                    <div key={g.chave} className="bx-ctx-comprador" style={{ ...bloco, padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                          <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bx-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {g.compraDireta ? <IconCarrinho size={17} color="var(--ac-1)" /> : <IconChat size={17} color="var(--ac-1)" />}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800 }}>{g.vendedor}</div>
                            <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>
                              {g.compraDireta ? 'Loja · compra na Bynx' : g.lojaId ? 'Loja · combina pelo chat' : 'Colecionador · combina pelo chat'}
                              {' · '}{g.itens.length} {g.itens.length === 1 ? 'carta' : 'cartas'} · {brl(g.soma)}
                            </div>
                          </div>
                        </div>
                        {g.compraDireta && g.lojaId && (
                          todasNoCarrinho ? (
                            <Link href="/carrinho" style={{ ...btnSec, borderColor: 'var(--ac-1)', color: 'var(--ac-1)' }}><IconCheck size={15} color="var(--ac-1)" />No carrinho. Ver carrinho</Link>
                          ) : (
                            <button onClick={() => colocarNoCarrinho(g)} style={btnPrim}><IconCarrinho size={15} color="currentColor" />{g.itens.length === 1 ? 'Colocar no carrinho' : `Colocar as ${g.itens.length} no carrinho`}</button>
                          )
                        )}
                      </div>
                      {g.itens.map(({ carta: c, oferta: o }) => (
                        <Link key={o.id} href={o.href} prefetch={false} className="bx-meta-linha" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px', minHeight: 44, borderTop: '1px solid var(--bx-border)', textDecoration: 'none', color: 'inherit' }}>
                          {c.image_small && <Image src={c.image_small} alt={c.nome} width={40} height={56} sizes="40px" style={{ width: 40, height: 56, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }} />}
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                            <span style={{ display: 'block', fontSize: 12, color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[c.numero, c.set_name].filter(Boolean).join(' · ')}{o.badges.length ? ` · ${o.badges.join(' · ')}` : ''}</span>
                          </span>
                          <span style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{brl(o.preco)}</span>
                            <span style={{ fontSize: 11, color: 'var(--bx-text-3)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {o.compraDireta ? <><IconCarrinho size={11} />Comprar</> : <><IconChat size={11} />Negociar</>}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )
                })}
                <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: 0 }}>Cada loja é um pedido separado, com pagamento e frete próprios. Com colecionador, vocês combinam tudo pelo chat.</p>
              </div>
            ) : (
              <>
                {aba === 'faltam' && !dicaVista && faltamN > 0 && !marcando && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, border: '1px dashed rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.05)', margin: '8px 0 12px', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5 }}>
                    <span style={{ flex: 1 }}>Já tem alguma destas? Toque em <b style={{ color: 'var(--bx-text)' }}>Já tenho</b> e ela entra na sua coleção e na meta ao mesmo tempo. Tem muitas? Use <b style={{ color: 'var(--bx-text)' }}>Marcar várias</b>.</span>
                    <button onClick={fecharDica} aria-label="Fechar dica" style={{ width: 44, height: 44, margin: '-10px -8px -10px 0', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconClose size={14} color="var(--bx-text-3)" /></button>
                  </div>
                )}
                {marcando && (
                  <p style={{ margin: '8px 0 12px', fontSize: 13, color: 'var(--bx-text-2)' }}>Toque em todas as cartas que você já tem. No fim, elas entram de uma vez na sua coleção e na meta.</p>
                )}
                {visiveis.length === 0 ? (
                  <div style={{ ...bloco, padding: '30px 20px', textAlign: 'center', color: 'var(--bx-text-2)', fontSize: 14, marginTop: 8 }}>
                    {busca.trim() ? `Nada com "${busca.trim()}" nesta meta.` : aba === 'tenho' ? 'Nenhuma carta desta meta na sua coleção ainda. Já tem alguma? Vá em Faltam e toque em "Já tenho".' : 'Nenhuma carta faltando. Meta completa.'}
                  </div>
                ) : (
                  <div className="bx-meta-grade" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(46%, 170px), 1fr))', gap: 12, marginTop: 4 }}>
                    {pagina$.map(c => {
                      const sel = selecionadas.has(c.card_id)
                      const oferta = melhorOferta.get(c.card_id)
                      const ocupada = ocupadas.has(c.card_id)
                      const cartaItem = (
                        <CardItem
                          mode="readonly"
                          hidePriceTable
                          ocultarIdioma={!c.tenho}
                          card={{
                            id: c.card_id, name: c.nome, number: c.numero || undefined,
                            image_small: c.image_small || undefined, rarity: c.raridade || undefined,
                            set_name: c.set_name || undefined,
                            idioma: c.tenho ? (c.idiomas_tenho?.[0] || undefined) : undefined,
                            price: { preco_min: c.valor },
                          }}
                          badge={!c.tenho && oferta ? (
                            <div className="bx-ctx-comprador" style={{ background: 'var(--ac-grad)', borderRadius: 8, padding: '4px 7px', fontSize: 11, fontWeight: 800, color: 'var(--bx-brand-ink)' }}>À venda</div>
                          ) : undefined}
                          footerSlot={marcando ? undefined : c.tenho ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--bx-green)' }}>
                              <IconCheck size={13} color="var(--bx-green)" /> {recentes.has(c.card_id) ? 'Entrou na coleção' : 'Na coleção'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {oferta && (
                                <Link href={oferta.href} prefetch={false} className="bx-ctx-comprador" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44, borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', background: 'rgba(var(--ac-1-rgb), 0.1)', border: '1px solid rgba(var(--ac-1-rgb), 0.3)', color: 'var(--bx-text)' }}>
                                  {oferta.compraDireta ? 'Comprar' : 'Negociar'} · {brl(oferta.preco)}
                                </Link>
                              )}
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => jaTenho(c)} disabled={ocupada}
                                  style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, font: 'inherit', fontSize: 13, fontWeight: 700, minHeight: 44, padding: '0 6px', borderRadius: 10, border: '1px solid rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.1)', color: 'var(--ac-1)', cursor: ocupada ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: ocupada ? 0.6 : 1 }}>
                                  {ocupada ? '…' : <><IconPlus size={13} color="var(--ac-1)" />Já tenho</>}
                                </button>
                                <button onClick={() => definirTeto(c)}
                                  aria-label={tetos.get(c.card_id) != null ? `Aviso até ${brl(tetos.get(c.card_id)!)}. Toque para mudar.` : 'Definir preço máximo do aviso'}
                                  title={tetos.get(c.card_id) != null ? `Aviso até ${brl(tetos.get(c.card_id)!)}` : 'Definir preço máximo do aviso'}
                                  style={{ width: 44, height: 44, flex: '0 0 auto', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `1px solid ${tetos.get(c.card_id) != null ? 'var(--ac-1)' : 'var(--bx-border)'}`,
                                    background: tetos.get(c.card_id) != null ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface)' }}>
                                  <IconBell size={16} color={tetos.get(c.card_id) != null ? 'var(--ac-1)' : 'var(--bx-text-2)'} />
                                </button>
                              </div>
                            </div>
                          )}
                        />
                      )
                      return marcando && !c.tenho ? (
                        <button key={c.card_id} onClick={() => alternarSelecao(c.card_id)} aria-pressed={sel} aria-label={`${sel ? 'Desmarcar' : 'Marcar'} ${c.nome}`}
                          className={sel ? undefined : 'bx-meta-falta'}
                          style={{ position: 'relative', padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', borderRadius: 18, font: 'inherit', color: 'inherit', boxShadow: sel ? '0 0 0 2px var(--ac-1)' : 'none', transition: 'box-shadow 0.15s ease' }}>
                          {cartaItem}
                          <span style={{ position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: sel ? 'var(--ac-1)' : 'rgba(0,0,0,0.55)', border: `1.5px solid ${sel ? 'var(--ac-1)' : 'rgba(255,255,255,0.5)'}` }}>
                            {sel && <IconCheck size={14} color="var(--bx-brand-ink)" />}
                          </span>
                        </button>
                      ) : (
                        <div key={c.card_id} className={c.tenho ? undefined : 'bx-meta-falta'}>{cartaItem}</div>
                      )
                    })}
                  </div>
                )}
                {visiveis.length > pagina$.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                    <button onClick={() => setPagina(p => p + 1)} style={btnSec}>Mostrar mais {Math.min(POR_PAGINA, visiveis.length - pagina$.length)} de {visiveis.length - pagina$.length}</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Barra de "marcar varias" ─────────────────────────────── */}
        {marcando && (
          <div className="bx-meta-barra" style={{ position: 'fixed', left: 0, right: 0, zIndex: 150, padding: '12px 16px', background: 'var(--bx-bg-elev)', borderTop: '1px solid var(--bx-border-2)', boxShadow: '0 -12px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{selecionadas.size} {selecionadas.size === 1 ? 'selecionada' : 'selecionadas'}</div>
                {usoPlano && <div style={{ fontSize: 12, color: 'var(--bx-text-3)' }}>Seu plano: {usoPlano.total} de {usoPlano.limite} cartas usadas</div>}
              </div>
              <button onClick={adicionarSelecionadas} disabled={selecionadas.size === 0 || ocupadas.size > 0}
                style={{ ...btnPrim, flex: '1 1 200px', opacity: selecionadas.size === 0 ? 0.5 : 1, cursor: selecionadas.size === 0 ? 'default' : 'pointer' }}>
                <IconPlus size={16} color="currentColor" />{ocupadas.size > 0 ? 'Adicionando…' : `Adicionar ${selecionadas.size || ''} à coleção`}
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div role="status" className="bx-meta-toast" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 160, width: 'min(520px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 16px', borderRadius: 14, background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', boxShadow: 'var(--bx-shadow)', fontSize: 13.5, lineHeight: 1.45 }}>
            <IconCheck size={16} color="var(--bx-green)" />
            <span style={{ flex: 1 }}>{toast.texto}</span>
            {toast.desfazer && <button onClick={toast.desfazer} style={{ font: 'inherit', fontSize: 13, fontWeight: 800, minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 10, background: 'var(--bx-surface-3)', color: 'var(--bx-text)', cursor: 'pointer' }}>Desfazer</button>}
          </div>
        )}

        {limite !== null && (
          <ModalLimiteCartas limite={limite} onClose={() => setLimite(null)} onUpgrade={() => { window.location.href = '/planos' }} />
        )}

        <style>{`
          .bx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
          .bx-meta-grad { background: var(--ac-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
          .bx-meta-hero { display: grid; grid-template-columns: minmax(0, 1fr); }
          .bx-meta-capa { min-height: 150px; border-bottom: 1px solid var(--bx-border); }
          .bx-meta-leque-lg, .bx-anel-lg { display: none; }
          .bx-meta-acoes > * { flex: 1 1 100%; }
          .bx-meta-faixas { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
          .bx-meta-trilho { scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); }
          .bx-meta-trilho::-webkit-scrollbar { display: none; }
          .bx-meta-seg { scrollbar-width: none; }
          .bx-meta-barra { bottom: calc(58px + env(safe-area-inset-bottom, 0px)); }
          .bx-meta-toast { bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
          @media (min-width: 769px) {
            .bx-meta-barra { bottom: 0; }
            .bx-meta-toast { bottom: 24px; }
          }
          @media (min-width: 900px) {
            .bx-meta-hero { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
            .bx-meta-capa { order: 2; border-bottom: none; border-left: 1px solid var(--bx-border); justify-content: center !important; }
            .bx-meta-leque-lg, .bx-anel-lg { display: block; }
            .bx-meta-leque-md, .bx-anel-md { display: none; }
            .bx-meta-acoes > * { flex: 0 0 auto; }
            .bx-meta-faixas { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); }
            .bx-meta-faixas > :only-child { grid-column: 1 / -1; }
          }
          .bx-meta-falta img { filter: grayscale(1); opacity: 0.45; transition: filter 0.2s ease, opacity 0.2s ease; }
          @media (hover: hover) { .bx-meta-falta:hover img { filter: grayscale(0.4); opacity: 0.8; } }
          .bx-meta-cta { transition: transform 0.15s ease, box-shadow 0.15s ease; }
          .bx-meta-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
          .bx-meta-linha { transition: background 0.15s ease; border-radius: 8px; }
          .bx-meta-linha:hover { background: var(--bx-surface-2); }
          .bx-meta-esq { animation: bxMetaPulso 1.2s ease-in-out infinite alternate; }
          @keyframes bxMetaPulso { from { opacity: .55 } to { opacity: 1 } }
          @media (prefers-reduced-motion: reduce) {
            .bx-meta-cta:hover { transform: none; }
            .bx-meta-esq { animation: none; opacity: .7; }
          }
        `}</style>
      </div>
    </AppLayout>
  )
}
