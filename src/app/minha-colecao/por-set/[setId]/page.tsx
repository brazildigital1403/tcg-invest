'use client'

/**
 * /minha-colecao/por-set/[setId]: a tela de ticar um set inteiro (quadros 04
 * a 13 do wireframe de 09/11/2026). Dentro do AppLayout, sem padding proprio.
 *
 * Carrega por `colecao_set_cartas` (cartas do set + pilhas do usuario numa
 * chamada), grava por `colecao_adicionar_lote` e desfaz por
 * `colecao_desfazer_lote`. A grade, a barra, as folhas e o toast sao o
 * GradeTique; aqui vive so o cabecalho fixo, os filtros e os estados da tela.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/ui/AppLayout'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconBox, IconCheck, IconClose, IconSearch, IconWarning } from '@/components/ui/Icons'
import GradeTique, {
  AjusteCarta, CartaTique, ChipPadraoLote, ItemLote, PADRAO_INICIAL, PadraoLote, PlanoTique, ResultadoLote,
} from '@/components/colecao/GradeTique'
import { btnPrim, btnSec } from '@/components/colecao/TiqueBase'
import { fmtBRL } from '@/components/colecao/tiqueComum'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit } from '@/lib/checkCardLimit'
import { track, trackFirstCardAdded } from '@/lib/analytics'

type SetInfo = {
  id: string
  name: string
  name_pt: string | null
  series?: string | null
  total?: number | null
  printed_total?: number | null
  logo_url: string | null
  release_date?: string | null
}

type RespostaSet = {
  set: SetInfo | null
  total: number
  tenho: number
  valor_total: number
  valor_tenho: number
  cartas: CartaTique[]
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return isNaN(n) ? 0 : n
}

/** Normaliza o jsonb da funcao para o contrato do componente. */
function paraResposta(raw: unknown): RespostaSet {
  const r = (raw || {}) as Record<string, unknown>
  const cartas = Array.isArray(r.cartas) ? (r.cartas as Record<string, unknown>[]) : []
  return {
    set: (r.set as SetInfo | null) || null,
    total: num(r.total),
    tenho: num(r.tenho),
    valor_total: num(r.valor_total),
    valor_tenho: num(r.valor_tenho),
    cartas: cartas.map(c => ({
      card_id: String(c.card_id),
      nome: String(c.nome || ''),
      numero: c.numero == null ? null : String(c.numero),
      set_id: c.set_id == null ? null : String(c.set_id),
      set_name: c.set_name == null ? null : String(c.set_name),
      image_small: c.image_small == null ? null : String(c.image_small),
      raridade: c.raridade == null ? null : String(c.raridade),
      valor: num(c.valor),
      precos: (c.precos as CartaTique['precos']) || {},
      pilhas: Array.isArray(c.pilhas) ? (c.pilhas as CartaTique['pilhas']) : [],
    })),
  }
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca por nome ou numero: "158" acha "158" e "158/207"; "pika" acha Pikachu. */
function casaBusca(c: CartaTique, q: string): boolean {
  const termo = semAcento(q.trim())
  if (!termo) return true
  if (semAcento(c.nome).includes(termo)) return true
  const n = (c.numero || '').toLowerCase()
  if (!n) return false
  if (n.includes(termo)) return true
  const a = parseInt(n, 10)
  const b = parseInt(termo, 10)
  return !isNaN(a) && !isNaN(b) && a === b
}

export default function PorSetPage() {
  const params = useParams()
  const router = useRouter()
  const setId = (params?.setId as string) || ''
  const { openLogin } = useAuthModal()
  const rotaAtual = `/minha-colecao/por-set/${setId}`

  // undefined = ainda nao sabemos; null = deslogado.
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [setInfo, setSetInfo] = useState<SetInfo | null>(null)
  const [dados, setDados] = useState<RespostaSet | null>(null)
  const [erroCarga, setErroCarga] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [plano, setPlano] = useState<PlanoTique>({ limite: -1, totalAtual: 0 })
  const [selecao, setSelecao] = useState<Map<string, AjusteCarta>>(() => new Map())
  const [padrao, setPadrao] = useState<PadraoLote>(PADRAO_INICIAL)
  const [soFaltam, setSoFaltam] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [busca, setBusca] = useState('')
  const [topo, setTopo] = useState(60)
  const [tentativa, setTentativa] = useState(0)
  const buscaRef = useRef<HTMLInputElement | null>(null)
  const loginPedido = useRef(false)

  // ── Sessao ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let ativo = true
    supabase.auth.getUser().then(({ data }) => { if (ativo) setUserId(data.user?.id ?? null) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sessao) => {
      if (ativo) setUserId(sessao?.user?.id ?? null)
    })
    return () => { ativo = false; sub.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (userId !== null || loginPedido.current) return
    loginPedido.current = true
    openLogin({ next: rotaAtual })
  }, [userId, openLogin, rotaAtual])

  // ── Cabecalho ja nomeado enquanto a grade carrega (quadro 10) ──────────────
  useEffect(() => {
    if (!setId) return
    let ativo = true
    supabase.from('pokemon_sets').select('id, name, name_pt, series, total, printed_total, logo_url, release_date').eq('id', setId).maybeSingle()
      .then(({ data }) => { if (ativo && data) setSetInfo(prev => prev || (data as SetInfo)) })
    return () => { ativo = false }
  }, [setId])

  // ── Carga ──────────────────────────────────────────────────────────────────
  const carregar = useCallback(async (): Promise<boolean> => {
    const { data, error } = await supabase.rpc('colecao_set_cartas', { p_set_id: setId })
    if (error) throw error
    const r = paraResposta(data)
    setDados(r)
    if (r.set) setSetInfo(r.set)
    return true
  }, [setId])

  useEffect(() => {
    if (!userId || !setId) return
    let ativo = true
    ;(async () => {
      const [carga, limite] = await Promise.allSettled([carregar(), checkCardLimit(userId)])
      if (!ativo) return
      if (carga.status === 'rejected') setErroCarga(true)
      if (limite.status === 'fulfilled') {
        setPlano({ limite: Number.isFinite(limite.value.limite) ? limite.value.limite : -1, totalAtual: limite.value.total })
      }
    })()
    return () => { ativo = false }
  }, [userId, setId, carregar, tentativa])

  // Recarrega depois de salvar ou desfazer. Falha aqui nao apaga o que esta
  // na tela: o otimismo do componente segue valendo.
  const recarregar = useCallback(async () => {
    try { await carregar() } catch { /* mantem a tela como esta */ }
  }, [carregar])

  // ── Altura do .tcg-header do AppLayout para o sticky ───────────────────────
  // useLayoutEffect: com useEffect o primeiro quadro pintava o sticky 9 px fora.
  // So o .tcg-header: o .tcg-switchbar (quem tem loja) NAO e sticky, rola
  // embora. Somar a altura dele deixava um vao de ~45 px entre o header e o
  // cabecalho do set, com as cartas aparecendo por ali (10/11/2026).
  useLayoutEffect(() => {
    const medir = () => {
      setTopo(document.querySelector<HTMLElement>('.tcg-header')?.offsetHeight || 0)
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  const nomeSet = setInfo?.name_pt || setInfo?.name || ''
  useEffect(() => {
    if (nomeSet) document.title = `Marcar ${nomeSet} | Bynx`
  }, [nomeSet])

  useEffect(() => { if (buscaAberta) buscaRef.current?.focus() }, [buscaAberta])

  // ── Derivados ──────────────────────────────────────────────────────────────
  const total = dados?.total ?? setInfo?.total ?? setInfo?.printed_total ?? 0
  const tenho = dados?.tenho ?? 0
  const pct = total > 0 ? Math.min(100, Math.round((tenho / total) * 100)) : 0
  const completo = total > 0 && tenho >= total
  const faltam = Math.max(0, total - tenho)

  const visiveis = useMemo(() => {
    if (!dados) return []
    let lista = dados.cartas
    if (soFaltam) lista = lista.filter(c => c.pilhas.length === 0)
    if (busca.trim()) lista = lista.filter(c => casaBusca(c, busca))
    return lista
  }, [dados, soFaltam, busca])

  // ── Salvar / desfazer ──────────────────────────────────────────────────────
  async function onSalvar(itens: ItemLote[]): Promise<ResultadoLote | null> {
    setErroSalvar(null)
    const { data, error } = await supabase.rpc('colecao_adicionar_lote', { p_itens: itens, p_origem: 'set' })
    const r = (data || null) as (ResultadoLote & { ok?: boolean; erro?: string }) | null
    if (error || !r || r.ok === false) {
      setErroSalvar('Nada entrou e a sua seleção continua como estava. Toque em Adicionar de novo quando quiser tentar.')
      return null
    }
    return {
      entraram: r.entraram || [],
      somadas: r.somadas || [],
      recusadas: r.recusadas || [],
      ignorados: r.ignorados || [],
      limite: num(r.limite),
      total_agora: num(r.total_agora),
    }
  }

  async function onDesfazer(r: ResultadoLote) {
    const { error } = await supabase.rpc('colecao_desfazer_lote', {
      p_ids: r.entraram.map(e => e.id),
      p_somadas: r.somadas.map(s => ({ id: s.id, quantity: s.quantity })),
    })
    if (error) throw error
    setPlano(p => ({ ...p, totalAtual: Math.max(0, p.totalAtual - r.entraram.length) }))
    await recarregar()
  }

  function onSalvo(r: ResultadoLote) {
    // Mesmos sinais da Pokedex e das Metas: cada carta gravada conta, e a
    // primeira carta da conta dispara o marco.
    const planoNome = plano.limite === -1 ? 'ilimitado' : 'free'
    r.entraram.forEach(e => track({ name: 'card_added_to_collection', properties: { card_id: e.card_id, set_id: setId, quantity: e.quantity, origem: 'set', plano: planoNome } }))
    if (userId && r.entraram.length > 0) trackFirstCardAdded(userId)
    // O filtro se desliga sozinho para a pessoa ver o que entrou (quadro 09).
    setSoFaltam(false)
    setPlano(p => ({ ...p, totalAtual: r.total_agora > 0 ? r.total_agora : p.totalAtual + r.entraram.length }))
    void recarregar()
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const carregando = userId !== null && userId !== undefined && !dados && !erroCarga
  const chip = (on: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px', borderRadius: 999,
    font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${on ? 'rgba(var(--ac-1-rgb), 0.5)' : 'var(--bx-border-2)'}`,
    background: on ? 'rgba(var(--ac-1-rgb), 0.12)' : 'var(--bx-surface-2)',
    color: on ? 'var(--bx-text)' : 'var(--bx-text-2)',
    transition: 'background 0.15s ease, border-color 0.15s ease',
  })
  const bloco: React.CSSProperties = { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16 }

  const vagasTexto = plano.limite > 0 ? `${plano.totalAtual} de ${plano.limite} vagas do plano` : null

  return (
    <AppLayout>
      <div style={{ color: 'var(--bx-text)' }}>
        {/* ── Cabecalho fixo ──────────────────────────────────────────────── */}
        <header className="bx-tq-topo" style={{ position: 'sticky', top: topo, zIndex: 30, background: 'var(--bx-bg)', borderBottom: '1px solid var(--bx-border)' }}>
          <div className="bx-tq-topo-linha1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 48, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {setInfo?.logo_url ? (
                <img src={setInfo.logo_url} alt="" style={{ maxWidth: 48, maxHeight: 30, objectFit: 'contain' }} />
              ) : (
                <IconBox size={20} color="var(--bx-text-3)" />
              )}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nomeSet || <span className="bx-tq-esq" style={{ display: 'inline-block', width: 160, height: 16, borderRadius: 6, background: 'var(--bx-surface-2)' }} />}
              </h1>
              {vagasTexto && <span className="bx-tq-vagas" style={{ display: 'none', fontSize: 12, color: 'var(--bx-text-3)' }}>{vagasTexto}</span>}
            </div>
            <button type="button" onClick={() => router.push('/minha-colecao')} style={{ ...btnSec, padding: '0 14px', fontSize: 13 }}>Concluir</button>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 800 }} aria-live="polite">
                {dados ? `${tenho} de ${total} na coleção` : total > 0 ? `${total} cartas` : ' '}
              </span>
              {dados && dados.valor_tenho > 0 && (
                <span style={{ fontSize: 12, color: 'var(--bx-text-2)' }}>{fmtBRL(dados.valor_tenho)} · Mercado Brasileiro</span>
              )}
            </div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progresso do set" style={{ height: 6, marginTop: 6, borderRadius: 99, background: 'var(--bx-surface-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: completo ? 'var(--bx-green)' : 'var(--ac-grad)', transition: 'width 0.2s ease' }} />
            </div>
          </div>

          <div className="bx-tq-controles" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setSoFaltam(v => !v)} aria-pressed={soFaltam} style={chip(soFaltam)} disabled={!dados}>
              {soFaltam && <IconCheck size={14} color="var(--ac-1)" />}
              Só as que faltam
            </button>
            <ChipPadraoLote padrao={padrao} onPadraoChange={setPadrao} selecao={selecao} />
            <button
              type="button"
              onClick={() => { if (buscaAberta) { setBusca(''); setBuscaAberta(false) } else setBuscaAberta(true) }}
              aria-label={buscaAberta ? 'Fechar a busca' : 'Buscar carta por nome ou número'}
              aria-expanded={buscaAberta}
              style={{ ...chip(buscaAberta), width: 44, padding: 0, justifyContent: 'center', marginLeft: 'auto' }}
              disabled={!dados}
            >
              {buscaAberta ? <IconClose size={16} color="var(--bx-text)" /> : <IconSearch size={16} color="var(--bx-text-2)" />}
            </button>
            {buscaAberta && (
              <input
                ref={buscaRef}
                type="search"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Nome ou número"
                aria-label="Nome ou número da carta"
                enterKeyHint="search"
                style={{ flex: '1 1 100%', minHeight: 44, font: 'inherit', fontSize: 16, padding: '0 14px', borderRadius: 12, border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface)', color: 'var(--bx-text)', outline: 'none' }}
              />
            )}
            {!buscaAberta && (
              <span className="bx-tq-dica" style={{ flex: '1 1 100%', fontSize: 12, color: 'var(--bx-text-3)', lineHeight: 1.4 }}>
                Toque ou clique para marcar. O ícone na carta ajusta variante, idioma ou quantidade.
              </span>
            )}
          </div>
        </header>

        {/* ── Estados ────────────────────────────────────────────────────── */}
        {userId === null && (
          <div style={{ ...bloco, padding: '34px 22px', textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Entre para marcar as que você tem</div>
            <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 18px' }}>As cartas que você marcar ficam salvas na sua coleção.</p>
            <button type="button" onClick={() => openLogin({ next: rotaAtual })} style={btnPrim}>Entrar</button>
          </div>
        )}

        {(carregando || userId === undefined) && (
          <div aria-busy="true" style={{ marginTop: 16 }}>
            <span className="bx-sr" aria-live="polite">Carregando as cartas do set e a sua coleção</span>
            <div className="bx-tq-esq-grade">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="bx-tq-esq" style={{ ...bloco, aspectRatio: '245 / 400', borderRadius: 18 }} />)}
            </div>
          </div>
        )}

        {userId && erroCarga && !dados && (
          <div role="alert" style={{ ...bloco, padding: '24px 20px', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', borderColor: 'rgba(239,68,68,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800 }}><IconWarning size={18} color="var(--bx-red)" />Não deu para carregar o set</div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.5 }}>Nada foi perdido. Se você já tinha marcado alguma carta, ela continua marcada.</p>
            <button type="button" style={btnPrim} onClick={() => { setErroCarga(false); setTentativa(t => t + 1) }}>Tentar de novo</button>
          </div>
        )}

        {erroSalvar && (
          <div role="alert" style={{ ...bloco, padding: '14px 16px', marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-start', borderColor: 'rgba(239,68,68,0.4)' }}>
            <IconWarning size={18} color="var(--bx-red)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Não deu para salvar agora</div>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5 }}>{erroSalvar}</p>
            </div>
            <button type="button" onClick={() => setErroSalvar(null)} style={{ ...btnSec, padding: '0 12px', fontSize: 13 }}>Depois</button>
          </div>
        )}

        {dados && dados.cartas.length === 0 && (
          <Vazio
            titulo="Este set ainda não tem cartas na Bynx"
            texto="Assim que ele for catalogado, você marca as suas por aqui."
            acoes={<Link href="/pokedex" style={btnSec}>Escolher outro set</Link>}
          />
        )}

        {dados && dados.cartas.length > 0 && visiveis.length === 0 && busca.trim() && (
          <Vazio
            titulo={`Nenhuma carta com "${busca.trim()}" neste set`}
            texto={total > 0 ? `O set vai até ${total}; confira o número ou o nome.` : 'Confira o número ou o nome.'}
            acoes={<button type="button" style={btnSec} onClick={() => { setBusca(''); buscaRef.current?.focus() }}>Limpar busca</button>}
          />
        )}

        {dados && dados.cartas.length > 0 && visiveis.length === 0 && !busca.trim() && soFaltam && (
          <Vazio
            titulo="Não falta nenhuma"
            texto={`Você tem as ${total} cartas de ${nomeSet}. Desligue o filtro para ver todas e somar cópias com o "+".`}
            acoes={<>
              <button type="button" style={btnPrim} onClick={() => setSoFaltam(false)}>Ver todas as {total}</button>
              <Link href={`/metas?nova=set:${encodeURIComponent(setId)}`} style={btnSec}>Criar meta do set</Link>
            </>}
          />
        )}

        {/* ── Grade ──────────────────────────────────────────────────────── */}
        {dados && visiveis.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {soFaltam && faltam > 0 && (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--bx-text-3)' }}>
                {visiveis.length === 1 ? 'Falta 1 carta' : `Faltam ${visiveis.length} cartas`}{busca.trim() ? ' na busca' : ''}
              </p>
            )}
            <GradeTique
              cartas={visiveis}
              selecao={selecao}
              onSelecaoChange={setSelecao}
              padrao={padrao}
              onPadraoChange={setPadrao}
              plano={plano}
              modo="set"
              onSalvar={onSalvar}
              onDesfazer={onDesfazer}
              onSalvo={onSalvo}
            />
          </div>
        )}

        <style>{`
          .bx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
          /* O cabecalho e a barra sangram ate a borda: o .tcg-content da 16/24 px e eles devolvem por dentro. */
          .bx-tq-topo { margin: -16px -16px 0; padding: 12px 16px; }
          .bx-tq-barra { bottom: calc(58px + env(safe-area-inset-bottom, 0px)) !important; margin-left: -16px !important; margin-right: -16px !important; }
          /* No celular o cabecalho fixo ja toma 46% da tela (auditoria de 09/11): a dica sai. */
          .bx-tq-dica { display: none; }
          .bx-tq-esq-grade { display: grid; gap: 8px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .bx-tq-esq { animation: bxTqPulso 1.2s ease-in-out infinite alternate; }
          @keyframes bxTqPulso { from { opacity: .55 } to { opacity: 1 } }
          @media (min-width: 769px) {
            .bx-tq-topo { margin: -24px -24px 0; padding: 14px 24px; }
            .bx-tq-barra { bottom: 0 !important; margin-left: 0 !important; margin-right: 0 !important; }
            .bx-tq-vagas { display: block !important; }
            .bx-tq-dica { display: inline; flex: 1 1 auto !important; text-align: right; }
            .bx-tq-esq-grade { gap: 12px; grid-template-columns: repeat(7, minmax(0, 1fr)); }
          }
          @media (prefers-reduced-motion: reduce) { .bx-tq-esq { animation: none; opacity: .7; } }
        `}</style>
      </div>
    </AppLayout>
  )
}

function Vazio({ titulo, texto, acoes }: { titulo: string; texto: string; acoes: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bx-surface)', border: '1px dashed var(--bx-border-2)', borderRadius: 16, padding: '32px 20px', marginTop: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{titulo}</div>
      <p style={{ margin: '0 auto 18px', maxWidth: 420, fontSize: 14, color: 'var(--bx-text-2)', lineHeight: 1.5 }}>{texto}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>{acoes}</div>
    </div>
  )
}
