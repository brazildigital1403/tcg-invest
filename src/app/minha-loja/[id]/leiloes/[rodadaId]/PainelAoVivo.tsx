'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IconArrowRight, IconClock, IconPlay } from '@/components/ui/Icons'
import { formatarBRL, formatarTempoRestante, horarioBrasilia } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'
import {
  JANELA_FINAL_MS, ROTULO_RESULTADO, intervaloPolling, resultadoDoLote, totaisRodada, type TomResultado,
} from '@/lib/leilao-painel'
import { SH } from '../../_shared'
import { chamarPainel } from '../_rodada'

/** Cada busca do painel aborta sozinha depois disso. */
const TIMEOUT_BUSCA_MS = 10_000
/** Rodada encerrada: releitura enquanto a aba esta visivel. */
const POLL_ENCERRADA_MS = 60_000

/**
 * Painel "Ao vivo" + "Resultado" da rodada, no editor da loja.
 *
 * - Ao vivo (rodada ao_vivo): lote no ar (foto, preço, lances, líder
 *   mascarado, contagem e horário de fim), a fila dos próximos e os links
 *   (página pública do lote e transmissão).
 * - Resultado (ao vivo e encerrada): um item por lote fechado, com o status do
 *   arremate/pedido, e os totais arrematado e pago.
 *
 * Polling de GET /api/lojas/[id]/leiloes/[rodadaId]/ao-vivo: 5s, 2s nos
 * últimos 30s do lote no ar; rodada encerrada, 60s. Parado com a aba oculta
 * (volta na hora ao aparecer). Cada busca aborta em 10s (e no desmonte); se
 * falhar, a tela mostra há quanto tempo está sem atualização e segue tentando.
 * O relógio da contagem usa o `server_now` da resposta (deslocamento sobre o
 * relógio do aparelho).
 */

interface PedidoLote { id: string; numero: number; status: string }

interface LoteAoVivo {
  id: string
  codigo: string
  slug: string
  ordem: number
  card_name: string
  card_numero: string | null
  set_nome: string | null
  card_image: string | null
  fotos: string[] | null
  lance_inicial_cents: number
  preco_atual_cents: number | null
  n_lances: number
  duracao_seg: number
  inicia_em: string | null
  termina_em: string | null
  status: string
  encerrado_em: string | null
  pagar_ate: string | null
  lider_apelido: string | null
  pedido: PedidoLote | null
}

interface RespostaAoVivo {
  server_now: string
  rodada: { id: string; numero: number; titulo: string | null; status: string; inicia_em: string | null; link_transmissao: string | null }
  lotes: LoteAoVivo[]
}

const COR_TOM: Record<TomResultado, string> = {
  vivo: 'var(--bx-red)',
  ok: 'var(--bx-green)',
  alerta: 'var(--bx-amber)',
  perigo: 'var(--bx-red)',
  neutro: 'var(--bx-text-3)',
}

const FECHADOS = new Set(['aguardando_pagamento', 'vendido', 'calote', 'sem_lances', 'cancelado'])

function fotoDe(l: LoteAoVivo): string | null {
  return (Array.isArray(l.fotos) && l.fotos[0]) || l.card_image || null
}

export default function PainelAoVivo({
  lojaId, rodadaId, statusRodada, onStatusRodada,
}: {
  lojaId: string
  rodadaId: string
  statusRodada: string
  /** A rodada mudou de status no servidor (ex.: último lote fechou). */
  onStatusRodada: (status: string) => void
}) {
  const [dados, setDados] = useState<RespostaAoVivo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  /** Hora (relogio do servidor) da ultima resposta boa. */
  const [ultimoOk, setUltimoOk] = useState<number | null>(null)
  /** Relogio do SERVIDOR: Date.now() + deslocamento da ultima resposta. */
  const [agora, setAgora] = useState(() => Date.now())
  const deslocamento = useRef(0)
  const emVoo = useRef(false)
  const avisado = useRef(statusRodada)
  const onStatusRef = useRef(onStatusRodada)
  useEffect(() => { onStatusRef.current = onStatusRodada }, [onStatusRodada])

  const aoVivo = statusRodada === 'ao_vivo'

  // Encerrar a rodada ao vivo (#416, opcao a): o lote no ar termina no tempo
  // dele; os proximos sao cancelados. Confirmacao dentro do painel.
  const [encerrar, setEncerrar] = useState<'fechado' | 'confirmando' | 'enviando'>('fechado')
  const [msgEncerrar, setMsgEncerrar] = useState<string | null>(null)
  async function confirmarEncerrar() {
    setEncerrar('enviando'); setMsgEncerrar(null)
    try {
      const j = await chamarPainel<{ resultado?: { cancelados?: number; lote_ativo_termina?: boolean } }>(
        `/api/lojas/${lojaId}/leiloes/${rodadaId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'encerrar' }) },
      )
      const n = j.resultado?.cancelados ?? 0
      setMsgEncerrar(`${n} ${n === 1 ? 'lote cancelado' : 'lotes cancelados'}.${j.resultado?.lote_ativo_termina ? ' O lote no ar termina no tempo dele.' : ' Rodada encerrada.'}`)
      setEncerrar('fechado')
    } catch (e) {
      setMsgEncerrar((e as Error).message || 'Não foi possível encerrar. Tente de novo.')
      setEncerrar('confirmando')
    }
  }

  /** Uma busca; abortada por `signal` (desmonte) nao mexe no estado. */
  const buscar = useCallback(async (signal: AbortSignal): Promise<RespostaAoVivo | null> => {
    const t0 = Date.now()
    try {
      const j = await chamarPainel<RespostaAoVivo>(
        `/api/lojas/${lojaId}/leiloes/${rodadaId}/ao-vivo`,
        { cache: 'no-store', signal },
        { timeoutMs: TIMEOUT_BUSCA_MS },
      )
      const t1 = Date.now()
      const srv = Date.parse(j.server_now)
      if (Number.isFinite(srv)) deslocamento.current = srv - (t0 + t1) / 2
      const agoraSrv = Date.now() + deslocamento.current
      setDados(j)
      setErro(null)
      setUltimoOk(agoraSrv)
      setAgora(agoraSrv)
      return j
    } catch (e) {
      if (signal.aborted) return null
      setErro((e as Error).message || 'Não foi possível atualizar.')
      setAgora(Date.now() + deslocamento.current)
      return null
    }
  }, [lojaId, rodadaId])

  // Polling: 5s / 2s no fim do lote, 60s com a rodada encerrada; pausa com a
  // aba oculta e busca na hora ao voltar.
  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let ctrl: AbortController | null = null
    const limpar = () => { if (timer) { clearTimeout(timer); timer = null } }

    const ciclo = async () => {
      limpar()
      if (!vivo || emVoo.current) return
      emVoo.current = true
      const meu = new AbortController()
      ctrl = meu
      let j: RespostaAoVivo | null = null
      try {
        j = await buscar(meu.signal)
      } finally {
        emVoo.current = false
        if (ctrl === meu) ctrl = null
      }
      if (!vivo || document.hidden) return
      const ativo = j?.lotes.find(l => l.status === 'ativo')
      limpar()
      timer = setTimeout(ciclo, aoVivo
        ? intervaloPolling(ativo?.termina_em ?? null, Date.now() + deslocamento.current)
        : POLL_ENCERRADA_MS)
    }

    ciclo()
    const onVis = () => { if (document.hidden) limpar(); else ciclo() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      vivo = false
      limpar()
      ctrl?.abort()
      emVoo.current = false
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [aoVivo, buscar])

  // Relógio: contagem com a rodada no ar, e o "sem atualização há Xs" com falha.
  const tique = aoVivo || erro !== null
  useEffect(() => {
    if (!tique) return
    const t = setInterval(() => { if (!document.hidden) setAgora(Date.now() + deslocamento.current) }, 1000)
    return () => clearInterval(t)
  }, [tique])

  // Status mudou no servidor: o editor recarrega a rodada (uma vez por status).
  useEffect(() => {
    const s = dados?.rodada.status
    if (s && s !== statusRodada && s !== avisado.current) {
      avisado.current = s
      onStatusRef.current(s)
    }
  }, [dados, statusRodada])

  if (!dados) {
    return (
      <section style={SH.card}>
        <h2 style={SH.cardH3}>{aoVivo ? 'Ao vivo' : 'Resultado'}</h2>
        <p style={S.suave}>{erro ? `${erro} Tentando de novo.` : 'Carregando…'}</p>
      </section>
    )
  }

  // `agora` ja vem no relogio do servidor (deslocamento aplicado ao gravar).
  const agoraSrv = agora
  const { lotes, rodada } = dados
  const total = lotes.length
  const ativo = lotes.find(l => l.status === 'ativo') ?? null
  const fila = lotes.filter(l => l.status === 'agendado' || l.status === 'rascunho')
  const fechados = lotes.filter(l => FECHADOS.has(l.status))
  const totais = totaisRodada(lotes)
  const semAtualizacao = erro !== null && ultimoOk !== null
    ? (
      <p style={S.faixa}>
        Sem atualização há {Math.max(0, Math.round((agoraSrv - ultimoOk) / 1000))}s. Tentando de novo.
      </p>
    )
    : null

  return (
    <>
      {aoVivo && (
        <section style={SH.card}>
          <div style={S.topo}>
            <h2 style={{ ...SH.cardH3, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={S.ponto} aria-hidden /> Ao vivo
            </h2>
            {rodada.link_transmissao && (
              <a href={rodada.link_transmissao} target="_blank" rel="noopener noreferrer" style={S.linkChip}>
                <IconPlay size={14} /> Transmissão
              </a>
            )}
          </div>

          {semAtualizacao}

          {ativo ? (
            <LoteNoAr lote={ativo} total={total} agoraSrv={agoraSrv} />
          ) : (
            <p style={S.suave}>
              {fila.length > 0 ? 'Preparando o próximo lote…' : 'Fechando o último lote…'}
            </p>
          )}

          <h3 style={S.subtitulo}>Próximos · {fila.length}</h3>
          {fila.length === 0 ? (
            <p style={S.suave}>Nenhum lote na fila.</p>
          ) : (
            <ol style={S.lista}>
              {fila.map(l => (
                <li key={l.id} style={S.linha}>
                  <span style={S.num}>{l.ordem}</span>
                  <Miniatura lote={l} />
                  <div style={S.textoLinha}>
                    <span style={S.nome}>{l.card_name}</span>
                    <span style={S.detalhe}>Inicial {formatarBRL(l.lance_inicial_cents)} · {l.duracao_seg}s</span>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div style={S.encerrar}>
            {encerrar === 'fechado' ? (
              <button type="button" style={S.btPerigo} onClick={() => { setEncerrar('confirmando'); setMsgEncerrar(null) }}>
                Encerrar a rodada agora
              </button>
            ) : (
              <div style={S.confirma} role="alertdialog" aria-label="Encerrar a rodada">
                <p style={{ margin: 0 }}>
                  O lote no ar termina no tempo dele, com o vencedor que tiver. {fila.length > 0
                    ? `Os ${fila.length} ${fila.length === 1 ? 'lote seguinte é cancelado' : 'lotes seguintes são cancelados'}; para leiloar essas cartas, cadastre de novo numa próxima rodada.`
                    : 'Não há lotes na fila.'}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={S.btPerigo} disabled={encerrar === 'enviando'} onClick={confirmarEncerrar}>
                    {encerrar === 'enviando' ? 'Encerrando…' : 'Confirmar encerramento'}
                  </button>
                  <button type="button" style={S.btNeutro} disabled={encerrar === 'enviando'} onClick={() => setEncerrar('fechado')}>Voltar</button>
                </div>
              </div>
            )}
            {msgEncerrar && <p style={S.suave} role="status">{msgEncerrar}</p>}
          </div>
        </section>
      )}

      <section style={SH.card}>
        <h2 style={SH.cardH3}>Resultado</h2>
        {!aoVivo && semAtualizacao}
        <div style={S.totais}>
          <div style={S.total}>
            <span style={S.totalRot}>Total arrematado</span>
            <strong style={S.totalVal}>{formatarBRL(totais.arrematadoCents)}</strong>
            <span style={S.detalhe}>{totais.nArrematados} {totais.nArrematados === 1 ? 'lote' : 'lotes'}</span>
          </div>
          <div style={S.total}>
            <span style={S.totalRot}>Total pago</span>
            <strong style={{ ...S.totalVal, color: 'var(--bx-green)' }}>{formatarBRL(totais.pagoCents)}</strong>
            <span style={S.detalhe}>{totais.nPagos} {totais.nPagos === 1 ? 'lote' : 'lotes'}</span>
          </div>
        </div>
        <p style={S.nota}>Valores dos arremates, sem frete.</p>

        {fechados.length === 0 ? (
          <p style={S.suave}>Nenhum lote encerrado ainda.</p>
        ) : (
          <ol style={S.lista}>
            {fechados.map(l => {
              const res = resultadoDoLote(l.status, l.pedido?.status)
              const rot = ROTULO_RESULTADO[res]
              const arrematado = ['aguardando_pagamento', 'vendido', 'calote'].includes(l.status) && l.preco_atual_cents != null
              const linkPedido = l.pedido && l.pedido.status !== 'aguardando_pagamento'
              return (
                <li key={l.id} style={S.linha}>
                  <span style={S.num}>{l.ordem}</span>
                  <Miniatura lote={l} />
                  <div style={S.textoLinha}>
                    <span style={S.nome}>{l.card_name}</span>
                    <span style={{ ...S.pill, color: COR_TOM[rot.tom] }}>{rot.label}</span>
                    {arrematado && (
                      <span style={S.detalhe}>
                        Arrematado por <strong style={S.forte}>{formatarBRL(l.preco_atual_cents!)}</strong>
                        {l.lider_apelido ? ` · ${l.lider_apelido}` : ''}
                      </span>
                    )}
                    {res === 'aguardando_pagamento' && l.pagar_ate && (
                      <span style={S.detalhe}>Prazo: {horarioBrasilia(l.pagar_ate)}</span>
                    )}
                    {linkPedido && (
                      <Link href={`/minha-loja/${lojaId}/pedidos`} style={S.linkPedido}>
                        Pedido #{l.pedido!.numero} <IconArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </>
  )
}

function Miniatura({ lote }: { lote: LoteAoVivo }) {
  const src = fotoDe(lote)
  return (
    <div style={S.mini}>
      {src && <Image src={src} alt={lote.card_name} fill sizes="40px" style={{ objectFit: 'cover' }} />}
    </div>
  )
}

function LoteNoAr({ lote, total, agoraSrv }: { lote: LoteAoVivo; total: number; agoraSrv: number }) {
  const fim = lote.termina_em ? Date.parse(lote.termina_em) : NaN
  const restante = Number.isFinite(fim) ? fim - agoraSrv : NaN
  const final = Number.isFinite(restante) && restante <= JANELA_FINAL_MS
  const src = fotoDe(lote)
  const comLance = lote.n_lances > 0 && lote.preco_atual_cents != null
  const preco = comLance ? lote.preco_atual_cents! : lote.lance_inicial_cents
  // Leitor de tela: so preco e lider (a contagem muda todo segundo e nao entra).
  const anuncio = `${comLance ? 'Lance atual' : 'Lance inicial'} ${formatarBRL(preco)}`
    + (lote.lider_apelido ? `, líder ${lote.lider_apelido}` : '')

  return (
    <div style={S.noAr}>
      <span style={S.somenteLeitor} aria-live="polite" aria-atomic="true">{anuncio}</span>
      <div style={S.noArTopo}>
        <div style={S.foto}>
          {src && <Image src={src} alt={lote.card_name} fill sizes="96px" style={{ objectFit: 'cover' }} />}
        </div>
        <div style={S.noArInfo}>
          <span style={S.detalhe}>Lote {lote.ordem} de {total}</span>
          <span style={{ ...S.nome, fontSize: 15 }}>
            {lote.card_name}{lote.card_numero ? ` ${lote.card_numero}` : ''}
          </span>
          <span style={S.totalRot}>{comLance ? 'Lance atual' : 'Lance inicial'}</span>
          <strong style={S.preco}>{formatarBRL(preco)}</strong>
          <span style={S.detalhe}>
            {lote.n_lances} {lote.n_lances === 1 ? 'lance' : 'lances'}
            {lote.lider_apelido ? ` · Líder ${lote.lider_apelido}` : ''}
          </span>
        </div>
      </div>

      <div style={S.relogio}>
        <IconClock size={16} color={final ? 'var(--bx-red)' : 'var(--bx-text-2)'} />
        <strong style={{ ...S.contagem, color: final ? 'var(--bx-red)' : 'var(--bx-text)' }}>
          {Number.isFinite(restante) ? (restante > 0 ? formatarTempoRestante(restante) : 'Encerrando…') : '--:--'}
        </strong>
        {lote.termina_em && <span style={S.detalhe}>Fim {horarioBrasilia(lote.termina_em)}</span>}
      </div>

      <Link href={urlLote(lote.slug)} target="_blank" rel="noopener noreferrer" style={S.btnGhost}>
        Abrir página pública do lote <IconArrowRight size={16} />
      </Link>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  encerrar: { marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bx-border)', display: 'flex', flexDirection: 'column', gap: 10 },
  confirma: { display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, color: 'var(--bx-text-2)', background: 'color-mix(in srgb, var(--bx-red) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-red) 30%, transparent)' },
  btPerigo: { minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--bx-red) 45%, transparent)', background: 'color-mix(in srgb, var(--bx-red) 8%, transparent)', color: 'var(--bx-red)', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' },
  btNeutro: { minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--bx-border)', background: 'transparent', color: 'var(--bx-text)', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  ponto: { width: 8, height: 8, borderRadius: 999, background: 'var(--bx-red)', display: 'inline-block' },
  linkChip: {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px', boxSizing: 'border-box',
    borderRadius: 10, border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
    color: 'var(--bx-text)', fontSize: 13, fontWeight: 700, textDecoration: 'none',
  },
  suave: { fontSize: 13, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.45 },
  faixa: {
    fontSize: 12, color: 'var(--bx-text-2)', margin: '0 0 10px', padding: '6px 10px', borderRadius: 8,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', fontVariantNumeric: 'tabular-nums',
  },
  somenteLeitor: {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
    clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
  },
  noAr: { display: 'flex', flexDirection: 'column', gap: 12 },
  noArTopo: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  foto: {
    position: 'relative', width: 96, aspectRatio: '63 / 88', flexShrink: 0, borderRadius: 8, overflow: 'hidden',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
  },
  noArInfo: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  preco: { fontSize: 24, fontWeight: 800, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 },
  relogio: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '10px 12px',
  },
  contagem: { fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums', transition: 'color 0.2s ease' },
  subtitulo: { fontSize: 12, fontWeight: 800, color: 'var(--bx-text-2)', margin: '18px 0 8px' },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' },
  linha: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
    borderTop: '1px solid var(--bx-border)',
  },
  num: {
    minWidth: 22, fontSize: 12, fontWeight: 800, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums', paddingTop: 2,
  },
  mini: {
    position: 'relative', width: 40, aspectRatio: '63 / 88', flexShrink: 0, borderRadius: 5, overflow: 'hidden',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
  },
  textoLinha: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0, flex: 1 },
  nome: { fontSize: 13, fontWeight: 700, color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  detalhe: { fontSize: 12, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 },
  forte: { color: 'var(--bx-text)', fontWeight: 800 },
  pill: {
    fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
    border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
  },
  linkPedido: {
    display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, fontSize: 13, fontWeight: 700,
    color: 'var(--ac-1)', textDecoration: 'none',
  },
  totais: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 },
  total: {
    display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '10px 12px',
  },
  totalRot: { fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  totalVal: { fontSize: 17, fontWeight: 800, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' },
  nota: { fontSize: 11, color: 'var(--bx-text-3)', margin: '8px 0 6px' },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box', width: '100%',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
  },
}
