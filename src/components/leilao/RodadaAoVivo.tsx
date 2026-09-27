'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { IconCheck, IconClock } from '@/components/ui/Icons'
import LanceAoVivo from '@/components/leilao/LanceAoVivo'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { formatarBRL, formatarTempoRestante, horarioBrasilia, type LotePublico } from '@/lib/leilao'
import {
  intervaloPollRodada,
  loteQueFechou,
  resultadoLoteRodada,
  separarLotesRodada,
  type EstadoRodada,
  type StatusRodada,
} from '@/lib/leilao-rodada'

/**
 * Ilha ao vivo da pagina da rodada: status e contagem, o lote no ar (com o
 * lance ali mesmo, pela LanceAoVivo), a fila e os encerrados.
 *
 * POLLING de /api/leiloes/rodada/[numero]/estado (publica, igual para todos):
 * 3s ao vivo, 2s nos ultimos 15s do lote, 30s agendada, parado encerrada ou
 * cancelada. Aba oculta nao busca; ao voltar, busca na hora. Cada busca tem
 * timeout de 10s (AbortController) e ate 2 novas tentativas curtas.
 * Resposta com `versao` menor que a ja vista e descartada.
 *
 * TROCA DE LOTE: quando o lote no ar fecha, a pagina mostra por 3s o
 * resultado ("Arrematado por R$ X" / "Sem lances") e so entao o proximo.
 * A LanceAoVivo remonta pelo `key` do lote, com o relogio do servidor.
 */

const TIMEOUT_MS = 10_000
const TENTATIVAS = 3
const ESPERA_TENTATIVA_MS = 1_000
const RESULTADO_MS = 3_000

const ROTULO_RODADA: Record<StatusRodada, string> = {
  rascunho: 'Em preparação',
  agendada: 'Agendada',
  ao_vivo: 'Ao vivo',
  encerrada: 'Encerrada',
  cancelada: 'Cancelada',
}

function esperar(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export default function RodadaAoVivo({
  estadoInicial,
  urlRodada,
}: {
  estadoInicial: EstadoRodada
  urlRodada: string
}) {
  const [estado, setEstado] = useState<EstadoRodada>(estadoInicial)
  const baseInicial = Date.parse(estadoInicial.server_now)
  const offsetRef = useRef(0)
  const [agora, setAgora] = useState<number>(Number.isFinite(baseInicial) ? baseInicial : 0)
  const versaoRef = useRef(estadoInicial.versao)

  const inicial = separarLotesRodada(estadoInicial.lotes)
  /** Lote no ar na ultima leitura aplicada (para detectar o fechamento). */
  const ativoIdRef = useRef<string | null>(inicial.ativo?.id ?? null)
  /** Lote que acabou de fechar, mostrado por RESULTADO_MS antes do proximo. */
  const [resultado, setResultado] = useState<LotePublico | null>(null)
  /** Relogio do servidor no momento em que o lote no ar apareceu (fixo por lote). */
  const [serverNowAtivo, setServerNowAtivo] = useState(estadoInicial.server_now)

  // ── Relogio ──────────────────────────────────────────────────────────────
  useEffect(() => {
    offsetRef.current = Number.isFinite(baseInicial) ? baseInicial - Date.now() : 0
    const tick = () => setAgora(Date.now() + offsetRef.current)
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [baseInicial])

  // ── Aplicar leitura ─────────────────────────────────────────────────────
  const resultadoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const aplicar = useCallback((novo: EstadoRodada, enviadoEm: number) => {
    const s = Date.parse(novo.server_now)
    if (Number.isFinite(s)) offsetRef.current = s - (enviadoEm + (Date.now() - enviadoEm) / 2)
    if (novo.versao < versaoRef.current) return
    versaoRef.current = novo.versao

    const { ativo } = separarLotesRodada(novo.lotes)
    const anterior = ativoIdRef.current
    if ((ativo?.id ?? null) !== anterior) {
      const fechou = loteQueFechou(anterior, novo.lotes)
      if (fechou) {
        setResultado(fechou)
        if (resultadoTimer.current) clearTimeout(resultadoTimer.current)
        resultadoTimer.current = setTimeout(() => {
          setResultado(null)
          // O proximo lote monta agora: relogio do servidor deste instante.
          setServerNowAtivo(new Date(Date.now() + offsetRef.current).toISOString())
        }, RESULTADO_MS)
      }
      ativoIdRef.current = ativo?.id ?? null
      if (ativo) setServerNowAtivo(new Date(Date.now() + offsetRef.current).toISOString())
    }
    setEstado(novo)
  }, [])

  useEffect(() => () => {
    if (resultadoTimer.current) clearTimeout(resultadoTimer.current)
  }, [])

  // ── Polling ─────────────────────────────────────────────────────────────
  const estadoRef = useRef(estado)
  useEffect(() => {
    estadoRef.current = estado
  }, [estado])

  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let emCurso: AbortController | null = null
    let buscando = false
    const numero = estadoInicial.rodada.numero

    const buscar = async () => {
      if (buscando) return
      buscando = true
      try {
        for (let i = 0; i < TENTATIVAS && vivo; i++) {
          const ctrl = new AbortController()
          emCurso = ctrl
          const corte = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
          const enviadoEm = Date.now()
          try {
            const r = await fetch(`/api/leiloes/rodada/${numero}/estado`, { cache: 'no-store', signal: ctrl.signal })
            // 404: a rodada saiu do ar. Nada a tentar de novo.
            if (r.status === 404) return
            if (!r.ok) throw new Error(String(r.status))
            const j = (await r.json()) as EstadoRodada
            if (vivo && j?.rodada && Array.isArray(j.lotes)) aplicar(j, enviadoEm)
            return
          } catch {
            if (!vivo) return
            if (i < TENTATIVAS - 1) await esperar(ESPERA_TENTATIVA_MS * (i + 1))
          } finally {
            clearTimeout(corte)
            emCurso = null
          }
        }
      } finally {
        buscando = false
      }
    }

    const proximoIntervalo = () => {
      const e = estadoRef.current
      const { ativo } = separarLotesRodada(e.lotes)
      return intervaloPollRodada(e.rodada.status, ativo?.terminaEm, Date.now() + offsetRef.current)
    }

    const agendar = () => {
      if (timer) clearTimeout(timer)
      timer = undefined
      if (!vivo || document.hidden) return
      const ms = proximoIntervalo()
      if (ms == null) return
      timer = setTimeout(volta, ms)
    }

    const volta = async () => {
      timer = undefined
      if (!vivo || document.hidden) return
      await buscar()
      agendar()
    }

    const aoMudarVisibilidade = () => {
      if (document.hidden) {
        if (timer) clearTimeout(timer)
        timer = undefined
        return
      }
      if (proximoIntervalo() == null) return
      volta()
    }

    // Primeira leitura logo depois de montar (o HTML pode ter chegado
    // atrasado), exceto em rodada que ja nao muda (encerrada, cancelada).
    if (proximoIntervalo() != null) volta()
    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      vivo = false
      if (timer) clearTimeout(timer)
      emCurso?.abort()
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
  }, [estadoInicial.rodada.numero, aplicar])

  // ── Derivados ───────────────────────────────────────────────────────────
  const { rodada } = estado
  const { ativo, proximos, encerrados } = separarLotesRodada(estado.lotes)
  const total = estado.lotes.filter(l => l.status !== 'cancelado').length
  const ini = rodada.iniciaEm ? Date.parse(rodada.iniciaEm) : NaN
  const faltaMs = Number.isFinite(ini) ? ini - agora : NaN
  const aoVivo = rodada.status === 'ao_vivo'
  const arrematados = encerrados.filter(l => resultadoLoteRodada(l)?.tipo === 'arrematado').length
  const res = resultado ? resultadoLoteRodada(resultado) : null

  return (
    <div style={S.coluna} className={aoVivo && ativo && !resultado ? 'rd-com-cta' : undefined}>
      <style>{`
        .rd-lote { display: block; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; }
        .rd-lote:hover { transform: translateY(-2px); }
        .rd-lote:focus-visible, .rd-link:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .rd-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (min-width: 640px) { .rd-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; } }
        .rd-destaque { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
        .rd-topo-lote { display: grid; gap: 12px; grid-template-columns: 112px minmax(0, 1fr); align-items: start; }
        @media (min-width: 900px) {
          .rd-destaque { grid-template-columns: 260px minmax(0, 1fr); gap: 24px; align-items: start; }
          .rd-topo-lote { grid-template-columns: minmax(0, 1fr); }
        }
        /* CTA de lance fixo no celular: folga no fim para ele nao cobrir o ultimo bloco. */
        @media (max-width: 768px) { .rd-com-cta { padding-bottom: 80px; } }
        .rd-resultado { animation: rd-entra 0.2s ease; }
        @keyframes rd-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .rd-lote, .rd-lote:hover { transition: none; transform: none; }
          .rd-resultado { animation: none; }
        }
      `}</style>

      {/* ─── Status da rodada ─── */}
      <section aria-label="Situação da rodada" style={S.statusBloco}>
        <div style={S.linhaStatus}>
          <span style={{ ...S.pill, ...(aoVivo ? S.pillVivo : rodada.status === 'agendada' ? S.pillAgendada : null) }}>
            {aoVivo && <span aria-hidden style={S.ponto} />}
            {ROTULO_RODADA[rodada.status]}
          </span>
          {rodada.status === 'agendada' && Number.isFinite(faltaMs) && (
            <span style={S.relogio}>
              <IconClock size={16} />
              <span>{faltaMs > 0 ? `Começa em ${formatarTempoRestante(faltaMs)}` : 'Começando...'}</span>
            </span>
          )}
          {aoVivo && total > 0 && (
            <span style={S.contagem}>
              {encerrados.length} de {total} {total === 1 ? 'lote encerrado' : 'lotes encerrados'}
            </span>
          )}
        </div>
        {rodada.status === 'agendada' && rodada.iniciaEm && (
          <p style={S.horaAbs}>Início em {horarioBrasilia(rodada.iniciaEm)}</p>
        )}
        {rodada.status === 'encerrada' && (
          <p style={S.horaAbs}>
            {arrematados === 0
              ? 'Rodada encerrada. Nenhum lote foi arrematado.'
              : `Rodada encerrada. ${arrematados} ${arrematados === 1 ? 'lote arrematado' : 'lotes arrematados'}.`}
          </p>
        )}
        {rodada.status === 'cancelada' && <p style={S.horaAbs}>Esta rodada foi cancelada pela loja.</p>}
      </section>

      {/* ─── No ar ─── */}
      {aoVivo && (
        <section aria-labelledby="rd-no-ar" style={S.secao}>
          <h2 id="rd-no-ar" style={S.h2}>No ar agora</h2>

          {resultado && res ? (
            <div role="status" className="rd-resultado" style={S.resultado}>
              <span style={S.resultadoRotulo}>
                {resultado.ordem != null ? `Lote ${resultado.ordem} encerrado` : 'Lote encerrado'}
              </span>
              <span style={S.resultadoNome}>{resultado.cardName}</span>
              <span style={{ ...S.resultadoTexto, color: res.tipo === 'arrematado' ? 'var(--bx-green)' : 'var(--bx-text-2)' }}>
                {res.tipo === 'arrematado' && <IconCheck size={20} />}
                {res.texto}
              </span>
              <span style={S.resultadoProx}>
                {proximos.length > 0 || ativo ? 'Próximo lote em instantes.' : 'Este foi o último lote.'}
              </span>
            </div>
          ) : ativo ? (
            <div className="rd-destaque">
              <div className="rd-topo-lote">
                <Link href={`/leiloes/${ativo.slug}`} prefetch={false} className="rd-lote" aria-label={`Ver o lote ${ativo.cardName}`}>
                  <CardItem card={cardDoLote(ativo)} mode="readonly" hidePriceTable ocultarSemPreco />
                </Link>
                <div style={S.infoAtivo} className="rd-info-ativo">
                  <span style={S.ordem}>
                    {ativo.ordem != null ? `Lote ${ativo.ordem} de ${total}` : 'Lote no ar'}
                  </span>
                  <Link href={`/leiloes/${ativo.slug}`} prefetch={false} className="rd-link" style={S.nomeAtivo}>
                    {ativo.cardName}
                  </Link>
                  {[ativo.setNome, ativo.condicao].filter(Boolean).length > 0 && (
                    <span style={S.metaAtivo}>{[ativo.setNome, ativo.condicao].filter(Boolean).join(' · ')}</span>
                  )}
                </div>
              </div>
              <LanceAoVivo
                key={ativo.id}
                loteInicial={ativo}
                loteExterno={ativo}
                pollingExterno
                serverNow={serverNowAtivo}
                referenciaMercadoCents={null}
                urlLote={`/leiloes/${ativo.slug}`}
                urlLogin={urlRodada}
              />
            </div>
          ) : (
            <div role="status" style={S.aguardando}>
              {proximos.length > 0 ? 'Preparando o próximo lote...' : 'Fechando a rodada...'}
            </div>
          )}
        </section>
      )}

      {/* ─── Fila ─── */}
      {proximos.length > 0 && (
        <section aria-labelledby="rd-proximos" style={S.secao}>
          <h2 id="rd-proximos" style={S.h2}>
            {rodada.status === 'agendada' ? 'Lotes da rodada' : 'Próximos lotes'} · {proximos.length}
          </h2>
          <div className="rd-grid">
            {proximos.map(l => (
              <Link key={l.id} href={`/leiloes/${l.slug}`} prefetch={false} className="rd-lote">
                <CardItem
                  card={cardDoLote(l)}
                  mode="readonly"
                  hidePriceTable
                  ocultarSemPreco
                  badge={l.ordem != null ? <span style={S.badge}>{l.ordem}</span> : undefined}
                  footerSlot={
                    <div style={S.rodape}>
                      <span style={S.rodapeForte}>Inicial {formatarBRL(l.lanceInicialCents)}</span>
                      <span style={S.rodapeFraco}>{l.duracaoSeg}s de lances</span>
                    </div>
                  }
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Encerrados ─── */}
      {encerrados.length > 0 && (
        <section aria-labelledby="rd-encerrados" style={S.secao}>
          <h2 id="rd-encerrados" style={S.h2}>Encerrados · {encerrados.length}</h2>
          <div className="rd-grid">
            {encerrados.map(l => {
              const r = resultadoLoteRodada(l)
              return (
                <Link key={l.id} href={`/leiloes/${l.slug}`} prefetch={false} className="rd-lote">
                  <CardItem
                    card={cardDoLote(l)}
                    mode="readonly"
                    hidePriceTable
                    ocultarSemPreco
                    badge={l.ordem != null ? <span style={S.badge}>{l.ordem}</span> : undefined}
                    footerSlot={
                      <div style={S.rodape}>
                        <span style={{ ...S.rodapeForte, color: r?.tipo === 'arrematado' ? 'var(--bx-green)' : 'var(--bx-text-3)' }}>
                          {r?.texto ?? 'Encerrado'}
                        </span>
                      </div>
                    }
                  />
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  coluna: { display: 'flex', flexDirection: 'column', gap: 20 },
  statusBloco: {
    display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 12,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
  },
  linhaStatus: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
    background: 'var(--bx-surface-2)', color: 'var(--bx-text-2)', border: '1px solid var(--bx-border)',
  },
  pillVivo: { color: 'var(--bx-red)', borderColor: 'var(--bx-red)' },
  pillAgendada: { background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)', borderColor: 'var(--ac-1)' },
  ponto: { width: 8, height: 8, borderRadius: 999, background: 'var(--bx-red)' },
  relogio: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 800, color: 'var(--bx-text)',
    fontVariantNumeric: 'tabular-nums',
  },
  contagem: { fontSize: 13, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  horaAbs: { fontSize: 13, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5 },
  secao: { display: 'flex', flexDirection: 'column', gap: 12 },
  h2: { fontSize: 17, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  infoAtivo: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  ordem: { fontSize: 12, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  nomeAtivo: {
    fontSize: 18, fontWeight: 700, color: 'var(--bx-text)', textDecoration: 'none', lineHeight: 1.3,
    overflowWrap: 'anywhere', minHeight: 44, display: 'flex', alignItems: 'center',
  },
  metaAtivo: { fontSize: 13, color: 'var(--bx-text-2)' },
  resultado: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6,
    padding: '28px 16px', borderRadius: 14, background: 'var(--bx-surface)', border: '1px solid var(--bx-border-2)',
  },
  resultadoRotulo: { fontSize: 12, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  resultadoNome: { fontSize: 16, fontWeight: 700, color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  resultadoTexto: {
    display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 24, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
  },
  resultadoProx: { fontSize: 13, color: 'var(--bx-text-3)' },
  aguardando: {
    minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16,
    borderRadius: 12, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    color: 'var(--bx-text-2)', fontSize: 14, fontWeight: 600,
  },
  badge: {
    fontSize: 12, fontWeight: 800, color: 'var(--bx-text)', background: 'var(--bx-bg-elev)',
    border: '1px solid var(--bx-border-2)', padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
  },
  rodape: { display: 'flex', flexDirection: 'column', gap: 2 },
  rodapeForte: { fontSize: 12, fontWeight: 700, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums' },
  rodapeFraco: { fontSize: 11, fontWeight: 600, color: 'var(--bx-text-3)' },
}
