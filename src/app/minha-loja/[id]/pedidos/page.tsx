'use client'

import { use as usePromise, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useLojaOwner, LojaEstadoFallback, SH, LOJA_HOME, TrilhaLoja } from '../_shared'
import { fmtBRL } from '@/lib/comissao'
import {
  IconBox, IconCheck, IconTruck, IconShield, IconClock, IconWarning, IconSearch, IconFilter, IconChevronDown,
  IconCopy, IconLocation, IconEye, IconPhone, IconPokeball, IconClose,
} from '@/components/ui/Icons'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { MOTIVOS, exigeFotoEnvio, fmtPrazo } from '@/lib/leilao-reclamacao'
import { classificarCaso, ocorrenciaDoPedido, diasDesde, faltam, type Aba, type Caso } from '@/lib/painelPedidos'
import OcorrenciaLoja, { type Recl } from './OcorrenciaLoja'
import FotosEnvio from './FotosEnvio'

/**
 * /minha-loja/[id]/pedidos — onde o lojista despacha as vendas.
 *
 * ★ REDESENHO (11/10, mockup aprovado pelo Du depois da auditoria de UX e UI).
 *   Antes: duas listas que nao se cruzavam (reclamacoes num bloco solto em
 *   cima, pedidos embaixo), sem filtro, e nada dizia de quem era a vez.
 *   Agora:
 *     - um card por pedido; a reclamacao/desistencia ABERTA entra no card;
 *     - abas por responsavel: Sua vez / Comprador / Bynx / Concluidos
 *       (regra pura em lib/painelPedidos.ts, com autoteste);
 *     - faixa "quem: o que ate quando" em todo card; um botao principal so
 *       na vez da loja; prazo ambar a menos de 24 h e vermelho vencido;
 *     - busca por numero ou carta, chips de tipo, ordem por prazo ou recentes;
 *     - detalhe recolhido (endereco, envio, reclamacao, desistencia) e o
 *       cancelamento longe do botao principal.
 *   Tokens da loja (acento azul -> roxo herdado do layout), sem hex cravado.
 */

interface Pedido {
  id: string
  numero: number
  status: string
  item_nome: string
  item_imagem: string | null
  valor_item_cents: number
  liquido_loja_cents: number
  total_comprador_cents: number
  metodo: string
  repasse_prazo: number
  endereco: Record<string, string | null> | null
  rastreio: string | null
  created_at: string
  pago_em: string | null
  enviado_em: string | null
  entregue_em: string | null
  leilao_id?: string | null
  cancelado_por?: string | null
  valor_reembolsado_cents?: number | null
}

/** Aviso na propria tela, logo abaixo das abas (no lugar do modal). */
interface Aviso { texto: string; irPara?: Aba }

type Filtro = 'todos' | 'venda' | 'leilao' | 'reclamacao' | 'desistencia'
interface Linha { p: Pedido; r: Recl | null; c: Caso }

const ABAS: { k: Aba; l: string; secao: string; vazio: string }[] = [
  { k: 'sua_vez', l: 'Sua vez', secao: 'Precisa de você agora', vazio: 'Nada esperando por você agora.' },
  { k: 'comprador', l: 'Comprador', secao: 'Aguardando o comprador · nada a fazer agora', vazio: 'Nenhum pedido esperando o comprador.' },
  { k: 'bynx', l: 'Bynx', secao: 'Com a Bynx · nada a fazer agora', vazio: 'Nada em análise pela Bynx.' },
  { k: 'concluidos', l: 'Concluídos', secao: 'Concluídos', vazio: 'Nenhum pedido concluído ainda.' },
]
const FILTROS: { k: Filtro; l: string; leilao?: boolean }[] = [
  { k: 'todos', l: 'Todos' },
  { k: 'venda', l: 'Venda direta' },
  { k: 'leilao', l: 'Leilão', leilao: true },
  { k: 'reclamacao', l: 'Com reclamação', leilao: true },
  { k: 'desistencia', l: 'Desistência', leilao: true },
]

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtDia(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MES[d.getMonth()]}`
}
/** "hoje às 23:59" quando o prazo e hoje (Brasilia); senao "14/10 às 23:59". */
function fmtQuando(d: Date | null, agora: number): string {
  if (!d) return ''
  const dia = (t: number) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(t))
  const txt = fmtPrazo(d)
  return dia(d.getTime()) === dia(agora) ? txt.replace(/^\d{2}\/\d{2}/, 'hoje') : txt
}
function enderecoTexto(end: Record<string, string | null>): string {
  const l2 = end.linha2 ? `, ${end.linha2}` : ''
  return [end.nome, `${end.linha1 || ''}${l2}`, [end.cidade, end.estado].filter(Boolean).join(' - '), end.cep, end.telefone]
    .filter(Boolean).join('\n')
}

export default function LojaPedidosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, loja } = useLojaOwner(lojaId)

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [recls, setRecls] = useState<Recl[]>([])
  const [resumo, setResumo] = useState<{ vendas?: number; faturado_cents: number } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<'prazo' | 'recentes'>('prazo')
  const [aberto, setAberto] = useState<string | null>(null)
  const [envioAberto, setEnvioAberto] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [aviso, setAviso] = useState<Aviso | null>(null)

  // Some sozinho em 8 s; o x fecha antes.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 8000)
    return () => clearTimeout(t)
  }, [aviso])

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const t = await token()
      const h = { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' as const }
      const [rp, rr] = await Promise.all([
        fetch(`/api/lojas/${lojaId}/pedidos`, h),
        LEILAO_ATIVO ? fetch(`/api/lojas/${lojaId}/reclamacoes`, h) : Promise.resolve(null),
      ])
      const j = await rp.json()
      if (!rp.ok) throw new Error(j?.error || 'Falha ao carregar')
      setPedidos(j.pedidos || [])
      setResumo(j.resumo || null)
      if (rr && rr.ok) {
        const jr = await rr.json().catch(() => ({}))
        setRecls(jr.reclamacoes || [])
      }
      setAgora(Date.now())
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId, token])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  // Um caso por pedido: a ocorrencia aberta (ou a mais recente) entra no card.
  const linhas: Linha[] = useMemo(() => {
    const porPedido = new Map<string, Recl[]>()
    for (const r of recls) porPedido.set(r.pedido_id, [...(porPedido.get(r.pedido_id) || []), r])
    return pedidos.map(p => {
      const r = ocorrenciaDoPedido(porPedido.get(p.id) || [])
      return { p, r, c: classificarCaso(p, r, agora) }
    })
  }, [pedidos, recls, agora])

  const contagem = useMemo(() => {
    const n: Record<Aba, number> = { sua_vez: 0, comprador: 0, bynx: 0, concluidos: 0 }
    for (const l of linhas) n[l.c.aba]++
    return n
  }, [linhas])

  // Aba inicial: onde ha algo a fazer; senao a primeira com conteudo.
  const abaAtual: Aba = aba ?? (['sua_vez', 'comprador', 'bynx', 'concluidos'] as Aba[]).find(k => contagem[k] > 0) ?? 'sua_vez'
  const meta = ABAS.find(a => a.k === abaAtual)!

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase().replace(/^#/, '')
    return linhas
      .filter(l => l.c.aba === abaAtual)
      .filter(l => filtro === 'todos'
        || (filtro === 'venda' && l.c.tipo === 'venda')
        || (filtro === 'leilao' && l.c.tipo === 'leilao')
        || (filtro === 'reclamacao' && l.c.ocorrencia === 'reclamacao')
        || (filtro === 'desistencia' && l.c.ocorrencia === 'desistencia'))
      .filter(l => !q || String(l.p.numero) === q || l.p.item_nome.toLowerCase().includes(q))
      .sort((a, b) => abaAtual === 'concluidos' || ordem === 'recentes'
        ? String(b.p.created_at).localeCompare(String(a.p.created_at))
        : a.c.ordem - b.c.ordem)
  }, [linhas, abaAtual, filtro, busca, ordem])

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const abrir = (id: string, envio = false) => {
    setAberto(id)
    setEnvioAberto(envio ? id : null)
  }

  return (
    <div style={SH.page}>
      <style>{CSS}</style>
      <TrilhaLoja items={[LOJA_HOME, { name: loja.nome, href: `/minha-loja/${lojaId}` }, { name: 'Pedidos', href: `/minha-loja/${lojaId}/pedidos` }]} />
      <header className="lp-head">
        <h1 style={SH.title}>Pedidos</h1>
        {resumo && (resumo.vendas ?? 0) > 0 && (
          <p className="lp-resumo">Líquido: {fmtBRL(resumo.faturado_cents)} em {resumo.vendas} {resumo.vendas === 1 ? 'venda' : 'vendas'}</p>
        )}
      </header>

      {erro && <div className="lp-erro">{erro}</div>}

      {carregando && !pedidos.length ? (
        <div className="lp-vazio">Carregando…</div>
      ) : pedidos.length === 0 ? (
        <div className="lp-vazio">
          <span className="lp-vazio-ic"><IconBox size={28} color="var(--bx-text-3)" /></span>
          <b>Nenhuma venda ainda</b>
          <span>Quando alguém comprar na sua vitrine, o pedido aparece aqui com o endereço de entrega e quanto você vai receber.</span>
        </div>
      ) : (
        <>
          <div className="lp-fixo">
            <nav className="lp-abas" aria-label="Seções dos pedidos">
              {ABAS.map(a => (
                <button key={a.k} type="button" className={`lp-aba${abaAtual === a.k ? ' lp-aba-on' : ''}`}
                  aria-current={abaAtual === a.k ? 'page' : undefined}
                  onClick={() => { setAba(a.k); setAberto(null); setOrdem(a.k === 'concluidos' ? 'recentes' : 'prazo') }}>
                  {a.l}
                  {a.k !== 'concluidos' && contagem[a.k] > 0 && (
                    <span className={`lp-cont${a.k === 'sua_vez' ? ' lp-cont-hot' : ''}`}>{contagem[a.k]}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {aviso && (
            <div className="lp-aviso" role="status">
              <span className="lp-aviso-ic"><IconCheck size={16} color="var(--bx-green)" /></span>
              <span className="lp-aviso-txt">{aviso.texto}</span>
              {aviso.irPara && aviso.irPara !== abaAtual && (
                <button type="button" className="lp-aviso-ir" onClick={() => { setAba(aviso.irPara!); setAviso(null) }}>
                  Ver em {ABAS.find(a => a.k === aviso.irPara)?.l}
                </button>
              )}
              <button type="button" className="lp-aviso-x" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
                <IconClose size={16} color="currentColor" />
              </button>
            </div>
          )}

          <div className="lp-busca">
            <label className="lp-campo">
              <IconSearch size={18} color="var(--bx-text-3)" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por número ou carta"
                inputMode="search" aria-label="Buscar pedido" />
            </label>
            <button type="button" className="lp-ordem" onClick={() => setOrdem(o => (o === 'prazo' ? 'recentes' : 'prazo'))}
              aria-label={ordem === 'prazo' ? 'Ordenado por prazo. Trocar para mais recentes' : 'Ordenado por mais recentes. Trocar para prazo'}
              disabled={abaAtual === 'concluidos'}>
              <IconFilter size={18} color="currentColor" />
            </button>
          </div>

          <div className="lp-chips" role="group" aria-label="Filtrar por tipo">
            {FILTROS.filter(f => LEILAO_ATIVO || !f.leilao).map(f => (
              <button key={f.k} type="button" className={`lp-chip${filtro === f.k ? ' lp-chip-on' : ''}`} aria-pressed={filtro === f.k} onClick={() => setFiltro(f.k)}>
                {f.l}
              </button>
            ))}
          </div>

          <div className="lp-secao">
            {meta.secao} · {abaAtual === 'concluidos' || ordem === 'recentes' ? 'mais recentes primeiro' : 'prazo mais próximo primeiro'}
          </div>

          {visiveis.length === 0 ? (
            <div className="lp-vazio">
              <span className="lp-vazio-ic"><IconCheck size={26} color="var(--bx-text-3)" /></span>
              <span>{busca || filtro !== 'todos' ? 'Nenhum pedido com esse filtro.' : meta.vazio}</span>
            </div>
          ) : (
            visiveis.map(l => (
              <CardPedido key={l.p.id} l={l} lojaId={lojaId} agora={agora}
                aberto={aberto === l.p.id} envioAberto={envioAberto === l.p.id}
                onAbrir={abrir} onFechar={() => { setAberto(null); setEnvioAberto(null) }}
                onMudou={carregar} token={token} avisar={setAviso} />
            ))
          )}
        </>
      )}
    </div>
  )
}

// ─── Card ───────────────────────────────────────────────────────────────────

function Faixa({ l, agora }: { l: Linha; agora: number }) {
  const { c, p, r } = l
  const voce = c.quem === 'voce'
  const vencido = c.urgencia === 'vencido'
  const quando = fmtQuando(c.prazo, agora)
  const prazoCls = vencido ? 'lp-red' : c.urgencia === 'hoje' ? 'lp-amber' : ''
  const Ic = vencido ? IconWarning
    : c.urgencia === 'hoje' ? IconClock
    : c.acao === 'enviar' || c.acao === 'postar' ? IconBox
    : c.acao === 'conferir' ? IconEye
    : c.acao === 'responder' || c.quem === 'bynx' ? IconShield
    : c.quem === 'concluido' ? IconCheck
    : IconTruck
  const icCor = vencido ? 'var(--bx-red)' : c.urgencia === 'hoje' ? 'var(--bx-amber)' : voce ? 'var(--ac-1)' : c.acao === 'entregue' ? 'var(--bx-green)' : 'var(--bx-text-3)'

  let quem = ''
  let txt: React.ReactNode = null
  let dir: React.ReactNode = null
  switch (c.acao) {
    case 'enviar':
      quem = 'Você'
      txt = c.prazo ? <>enviar até <span className={prazoCls}>{quando}</span></> : 'enviar'
      dir = c.prazo ? (vencido ? null : faltam(c.prazo, agora)) : (() => { const d = diasDesde(p.pago_em || p.created_at, agora); return d === null ? null : d === 0 ? 'pago hoje' : `pago há ${d} ${d === 1 ? 'dia' : 'dias'}` })()
      break
    case 'responder': quem = 'Você'; txt = <>responder até <span className={prazoCls}>{quando}</span></>; break
    case 'conferir': quem = 'Você'; txt = <>conferir até <span className={prazoCls}>{quando}</span></>; break
    case 'confirmar_recebimento': quem = 'Comprador'; txt = 'confirmar recebimento'; break
    case 'postar': quem = 'Comprador'; txt = <>postar a carta até {quando}</>; break
    case 'a_caminho': quem = 'Correios'; txt = 'devolução a caminho'; dir = r?.devolucao_rastreio || null; break
    case 'decidir':
      quem = 'Bynx'
      txt = r?.status === 'aguardando_loja' ? <>decide · <span className="lp-red">você não respondeu no prazo</span></> : <>decide até {quando}</>
      break
    case 'devolucao_bynx': quem = 'Bynx'; txt = 'combinando a devolução com o comprador'; break
    case 'estorno': quem = 'Bynx'; txt = p.status === 'cancelando' ? 'processando o estorno' : 'estorno automático em andamento'; break
    case 'entregue': quem = 'Concluído'; txt = <>líquido de {fmtBRL(p.liquido_loja_cents)}</>; break
    case 'reembolsado':
      quem = 'Estornado'
      txt = <>{fmtBRL(p.valor_reembolsado_cents || p.total_comprador_cents)} ao comprador</>
      dir = p.cancelado_por === 'loja' ? 'você cancelou' : p.cancelado_por === 'comprador' ? 'o comprador desistiu' : p.cancelado_por === 'bynx' ? 'decisão da Bynx' : null
      break
    default: quem = 'Cancelado'; txt = 'pedido cancelado'
  }

  return (
    <div className={`lp-faixa${voce ? ' lp-faixa-voce' : ''}${vencido ? ' lp-faixa-venc' : ''}`}>
      <Ic size={15} color={icCor} />
      <span className="lp-faixa-txt"><b>{quem}:</b> {txt}</span>
      {dir && <span className="lp-faixa-dir">{dir}</span>}
    </div>
  )
}

function seloOcorrencia(l: Linha): string | null {
  const { r, c } = l
  if (!r) return null
  const aberta = ['aguardando_loja', 'em_analise', 'aguardando_devolucao'].includes(r.status)
  if (c.ocorrencia === 'desistencia') {
    if (!aberta) return 'Desistência encerrada'
    if (r.contestada_em) return 'Desistência · você contestou'
    if (r.devolucao_entregue_em) return 'Desistência · devolução chegou'
    return 'Desistência'
  }
  return aberta ? `Reclamação: ${MOTIVOS[r.motivo].toLowerCase()}` : 'Reclamação encerrada'
}

function notaDoCaso(l: Linha): string | null {
  const { c } = l
  if (c.acao === 'conferir') return 'Sem conferência até lá, o estorno sai sozinho.'
  if (c.acao === 'postar') return 'Se não postar, a desistência expira e a venda continua valendo.'
  if (c.acao === 'confirmar_recebimento' && c.fechaEm) return `Se ele não confirmar, o pedido fecha sozinho em ${fmtPrazo(c.fechaEm).split(' ')[0]}.`
  if (c.acao === 'decidir' && l.r?.status === 'aguardando_loja') return 'Sem resposta da loja, a decisão fica a favor do comprador.'
  return null
}

function CardPedido({ l, lojaId, agora, aberto, envioAberto, onAbrir, onFechar, onMudou, token, avisar }: {
  l: Linha
  lojaId: string
  agora: number
  aberto: boolean
  envioAberto: boolean
  onAbrir: (id: string, envio?: boolean) => void
  onFechar: () => void
  onMudou: () => void
  token: () => Promise<string>
  avisar: (a: Aviso) => void
}) {
  const { p, r, c } = l
  const [rastreio, setRastreio] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [enviando, setEnviando] = useState(false)
  const [cancelAberto, setCancelAberto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  // Erro fica no proprio card, junto do botao que falhou.
  const [erro, setErro] = useState<string | null>(null)

  const pedeFoto = LEILAO_ATIVO && exigeFotoEnvio({ ehLeilao: !!p.leilao_id, valor_item_cents: p.valor_item_cents })
  const podeConfirmarEnvio = rastreio.trim().length >= 8 && (!pedeFoto || fotos.length >= 2) && !enviando
  const selo = seloOcorrencia(l)
  const nota = notaDoCaso(l)
  const ocorrenciaVisivel = !!r && (c.ocorrencia === 'desistencia' || c.ocorrencia === 'reclamacao')

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/lojas/${lojaId}/pedidos`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: p.id, ...body }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j?.error || 'Não foi possível concluir.')
  }

  async function confirmarEnvio() {
    setEnviando(true); setErro(null)
    try {
      await patch({ acao: 'enviar', rastreio: rastreio.trim(), fotos })
      avisar({ texto: `Pedido #${p.numero} marcado como enviado. O comprador já foi avisado.`, irPara: 'comprador' })
      onFechar()
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar() {
    setCancelando(true); setErro(null)
    try {
      await patch({ acao: 'cancelar', motivo: motivo.trim() || null })
      avisar({ texto: `Pedido #${p.numero} cancelado e reembolsado. O comprador já foi avisado.`, irPara: 'concluidos' })
      onFechar()
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCancelando(false)
    }
  }

  function copiar() {
    if (!p.endereco) return
    navigator.clipboard?.writeText(enderecoTexto(p.endereco)).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 1500)
    }).catch(() => {})
  }

  const rotuloBotao = c.botao === 'enviar' ? 'Marcar como enviado'
    : c.botao === 'responder' ? 'Responder reclamação'
    : c.botao === 'conferir' ? 'Conferir devolução'
    : c.botao === 'conferir_cedo' ? 'A carta já chegou? Conferir agora'
    : null
  const end = p.endereco

  return (
    <div className={`lp-card${aberto ? ' lp-card-aberto' : ''}`}>
      <button type="button" className="lp-topo" onClick={() => (aberto ? onFechar() : onAbrir(p.id))} aria-expanded={aberto}>
        <span className="lp-thumb">
          {p.item_imagem
            ? <Image src={p.item_imagem} alt="" width={40} height={56} sizes="40px" style={{ objectFit: 'contain', borderRadius: 6 }} />
            : <IconPokeball size={18} color="var(--bx-text-3)" />}
        </span>
        <span className="lp-id">
          <span className="lp-nome">{p.item_nome}</span>
          <span className="lp-sub">#{p.numero} · {c.tipo === 'leilao' ? 'Leilão' : 'Venda direta'} · {fmtDia(p.created_at)}</span>
        </span>
        <span className="lp-valor">{fmtBRL(p.liquido_loja_cents)}</span>
      </button>

      {selo && (
        <span className="lp-selo"><IconShield size={12} color="currentColor" />{selo}</span>
      )}
      <Faixa l={l} agora={agora} />
      {nota && <span className="lp-nota">{nota}</span>}

      {rotuloBotao && !aberto && (
        <button type="button" className={c.botao === 'conferir_cedo' ? 'lp-bt lp-bt-sec' : 'lp-bt lp-bt-pri'}
          onClick={() => onAbrir(p.id, c.botao === 'enviar')}>
          {rotuloBotao}
        </button>
      )}

      {aberto && (
        <div className="lp-det">
          {/* A enviar: endereco, envio, cancelamento */}
          {p.status === 'pago' && (
            <>
              {end?.linha1 && (
                <div className="lp-end">
                  <IconLocation size={18} color="var(--bx-text-3)" />
                  <div className="lp-end-txt">
                    {end.nome && <b>{end.nome}</b>}
                    <span>{end.linha1}{end.linha2 ? `, ${end.linha2}` : ''} · {[end.cidade, end.estado].filter(Boolean).join(' - ')}{end.cep ? ` · ${end.cep}` : ''}</span>
                    {end.telefone && <span className="lp-tel"><IconPhone size={12} color="var(--bx-text-3)" />{end.telefone}</span>}
                  </div>
                  <button type="button" className="lp-copiar" aria-label="Copiar endereço" onClick={copiar}>
                    {copiado ? <IconCheck size={16} color="var(--bx-green)" /> : <IconCopy size={16} color="currentColor" />}
                  </button>
                </div>
              )}
              {envioAberto ? (
                <div className="lp-form">
                  {pedeFoto && <FotosEnvio pedidoId={p.id} onChange={setFotos} />}
                  <label className="lp-rot" htmlFor={`rastreio-${p.id}`}>Código de rastreio</label>
                  <div className="lp-campo">
                    <IconTruck size={17} color="var(--bx-text-3)" />
                    <input id={`rastreio-${p.id}`} value={rastreio} onChange={e => setRastreio(e.target.value)}
                      placeholder="Código dos Correios ou do Melhor Envio" autoComplete="off" />
                  </div>
                  {erro && <div className="lp-erro-card" role="alert">{erro}</div>}
                  <button type="button" className="lp-bt lp-bt-pri" disabled={!podeConfirmarEnvio} onClick={confirmarEnvio}>
                    {enviando ? 'Salvando…' : 'Confirmar envio'}
                  </button>
                </div>
              ) : (
                <button type="button" className="lp-bt lp-bt-pri" onClick={() => onAbrir(p.id, true)}>Marcar como enviado</button>
              )}
              {cancelAberto ? (
                <div className="lp-cancel">
                  <span>Isso reembolsa o comprador integralmente e não pode ser desfeito.</span>
                  {erro && <div className="lp-erro-card" role="alert">{erro}</div>}
                  <input className="lp-input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (opcional, o comprador vê)" aria-label="Motivo do cancelamento" />
                  <button type="button" className="lp-bt lp-bt-perigo" disabled={cancelando} onClick={cancelar}>{cancelando ? 'Reembolsando…' : 'Confirmar cancelamento'}</button>
                  <button type="button" className="lp-bt lp-bt-ghost" disabled={cancelando} onClick={() => setCancelAberto(false)}>Voltar</button>
                </div>
              ) : (
                <button type="button" className="lp-link-perigo" onClick={() => setCancelAberto(true)}>Não vou conseguir enviar: cancelar e reembolsar</button>
              )}
            </>
          )}

          {p.rastreio && p.status !== 'pago' && (
            <div className="lp-par"><IconTruck size={15} color="var(--bx-text-3)" /><span>Rastreio do envio</span><b>{p.rastreio}</b></div>
          )}
          {p.enviado_em && <div className="lp-par"><span>Enviado</span><b>{fmtDia(p.enviado_em)}</b></div>}
          {p.entregue_em && <div className="lp-par"><span>Entregue</span><b>{fmtDia(p.entregue_em)}</b></div>}

          {ocorrenciaVisivel && r && <OcorrenciaLoja r={r} lojaId={lojaId} onMudou={onMudou} />}

          <button type="button" className="lp-fechar" onClick={onFechar}>
            Fechar detalhes <span className="lp-gira"><IconChevronDown size={14} color="currentColor" /></span>
          </button>
        </div>
      )}
    </div>
  )
}

const CSS = `
.lp-head{display:grid;gap:4px;margin-bottom:2px}
.lp-resumo{margin:0;font-size:12px;color:var(--bx-text-3)}
.lp-erro{background:color-mix(in srgb,var(--bx-red) 8%,transparent);border:1px solid color-mix(in srgb,var(--bx-red) 25%,transparent);color:var(--bx-red);border-radius:10px;padding:10px 14px;font-size:13px}
.lp-fixo{position:sticky;top:0;z-index:5;background:var(--bx-bg);padding:6px 0;margin:-6px 0}
.lp-abas{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.lp-abas::-webkit-scrollbar{display:none}
.lp-aba{flex-shrink:0;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border);background:var(--bx-surface);color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.lp-aba-on{border-color:rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.12);color:var(--bx-text)}
.lp-cont{min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:var(--bx-surface-3);font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center}
.lp-cont-hot{background:var(--ac-grad);color:var(--bx-brand-ink)}
.lp-aviso{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;border-radius:12px;background:color-mix(in srgb,var(--bx-green) 8%,var(--bx-surface));border:1px solid color-mix(in srgb,var(--bx-green) 35%,transparent);animation:lp-entra .2s ease}
.lp-aviso-ic{width:28px;height:28px;border-radius:999px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bx-green) 14%,transparent)}
.lp-aviso-txt{flex:1;min-width:0;font-size:13px;line-height:1.45;color:var(--bx-text)}
.lp-aviso-ir{min-height:44px;padding:0 10px;border:none;background:transparent;color:var(--ac-1);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap}
.lp-aviso-x{width:44px;height:44px;flex-shrink:0;border:none;background:transparent;color:var(--bx-text-3);display:flex;align-items:center;justify-content:center;cursor:pointer}
.lp-erro-card{font-size:12.5px;line-height:1.5;color:var(--bx-red);padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--bx-red) 8%,transparent)}
@keyframes lp-entra{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.lp-aviso{animation:none}}
.lp-busca{display:flex;gap:8px}
.lp-campo{flex:1;min-width:0;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;background:var(--bx-surface-2);border:1px solid var(--bx-border);transition:border-color .15s ease}
.lp-campo:focus-within{border-color:var(--bx-border-2)}
.lp-campo input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:var(--bx-text);font:inherit;font-size:16px}
.lp-ordem{width:44px;height:44px;flex-shrink:0;border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface);color:var(--bx-text-2);display:flex;align-items:center;justify-content:center;cursor:pointer}
.lp-ordem:disabled{opacity:.4;cursor:default}
.lp-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:4px 0;margin:-4px 0}
.lp-chips::-webkit-scrollbar{display:none}
.lp-chip{position:relative;flex-shrink:0;height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border);background:var(--bx-surface);color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.lp-chip::after{content:'';position:absolute;inset:-4px 0}
.lp-chip-on{border-color:rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.12);color:var(--bx-text)}
.lp-secao{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3);margin-top:4px}
.lp-vazio{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:32px 16px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border);font-size:13px;line-height:1.5;color:var(--bx-text-3)}
.lp-vazio b{font-size:15px;color:var(--bx-text)}
.lp-vazio-ic{width:56px;height:56px;border-radius:999px;background:var(--bx-surface-2);display:flex;align-items:center;justify-content:center}
.lp-card{border-radius:12px;padding:14px;background:var(--bx-surface);border:1px solid var(--bx-border);display:flex;flex-direction:column;gap:10px;color:var(--bx-text);transition:border-color .15s ease,background .15s ease}
.lp-card-aberto{background:var(--bx-surface-2);border-color:var(--bx-border-2)}
.lp-topo{display:flex;gap:12px;align-items:center;background:none;border:none;padding:0;margin:0;color:inherit;font:inherit;text-align:left;cursor:pointer;min-height:56px}
.lp-thumb{width:40px;height:56px;border-radius:6px;background:var(--bx-surface-2);flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.lp-id{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.lp-nome{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lp-sub{font-size:12px;color:var(--bx-text-3)}
.lp-valor{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.lp-selo{align-self:flex-start;min-height:24px;padding:0 10px;border-radius:999px;background:var(--bx-surface-2);font-size:11.5px;font-weight:700;color:var(--bx-text-2);display:inline-flex;align-items:center;gap:6px}
.lp-faixa{min-height:32px;padding:6px 10px;box-sizing:border-box;border-radius:8px;background:var(--bx-surface-2);border:1px solid var(--bx-border);display:flex;align-items:center;gap:8px;font-size:12.5px;line-height:1.4;color:var(--bx-text-2)}
.lp-faixa svg{flex-shrink:0}
.lp-faixa b{color:var(--bx-text)}
.lp-faixa-voce{background:rgba(var(--ac-1-rgb),.10);border-color:rgba(var(--ac-1-rgb),.35);color:var(--bx-text)}
.lp-faixa-venc{background:color-mix(in srgb,var(--bx-red) 8%,transparent);border-color:color-mix(in srgb,var(--bx-red) 30%,transparent)}
.lp-faixa-txt{flex:1;min-width:0}
.lp-faixa-dir{color:var(--bx-text-3);white-space:nowrap;letter-spacing:.02em}
.lp-amber{color:var(--bx-amber);font-weight:700}
.lp-red{color:var(--bx-red);font-weight:700}
.lp-nota{font-size:12px;line-height:1.5;color:var(--bx-text-3);margin-top:-2px}
.lp-bt{min-height:44px;width:100%;padding:0 16px;border-radius:10px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;transition:opacity .15s ease,background .15s ease}
.lp-bt:disabled{opacity:.55;cursor:not-allowed}
.lp-bt-pri{border:none;background:var(--ac-grad);color:var(--bx-brand-ink)}
.lp-bt-sec{border:1px solid rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.08);color:var(--bx-text);font-size:13px;font-weight:700}
.lp-bt-perigo{border:none;background:var(--bx-red);color:#fff;font-size:13.5px}
.lp-bt-ghost{border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font-size:13px;font-weight:700}
.lp-det{display:grid;gap:12px;padding-top:12px;border-top:1px solid var(--bx-border)}
.lp-end{display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.lp-end svg{flex-shrink:0}
.lp-end-txt{flex:1;min-width:0;display:grid;gap:2px;font-size:13px;line-height:1.45}
.lp-end-txt span{color:var(--bx-text-2);overflow-wrap:anywhere}
.lp-tel{display:inline-flex;align-items:center;gap:5px}
.lp-copiar{width:44px;height:44px;flex-shrink:0;border-radius:10px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text-2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s ease}
.lp-copiar:hover{background:var(--bx-surface-3)}
.lp-form{display:grid;gap:8px}
.lp-rot{font-size:12.5px;font-weight:700;color:var(--bx-text-2)}
.lp-input{width:100%;box-sizing:border-box;min-height:44px;background:var(--bx-surface-2);border:1px solid var(--bx-border);border-radius:10px;padding:10px 12px;color:var(--bx-text);font:inherit;font-size:16px;outline:none}
.lp-cancel{display:grid;gap:8px;padding:12px;border-radius:12px;background:color-mix(in srgb,var(--bx-red) 6%,transparent);border:1px solid color-mix(in srgb,var(--bx-red) 22%,transparent);font-size:12.5px;line-height:1.5;color:var(--bx-text-2)}
.lp-link-perigo{min-height:44px;border:none;background:transparent;color:var(--bx-red);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.lp-par{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--bx-text-2)}
.lp-par b{margin-left:auto;color:var(--bx-text);letter-spacing:.02em}
.lp-fechar{min-height:44px;border:none;background:transparent;color:var(--bx-text-3);font:inherit;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}
.lp-gira{display:inline-flex;transform:rotate(180deg)}
@media (prefers-reduced-motion:reduce){.lp-aba,.lp-chip,.lp-card,.lp-bt,.lp-campo,.lp-copiar{transition:none}}
`
