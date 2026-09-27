'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import CardItem from '@/components/ui/CardItem'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { IconCheck, IconClock, IconPlay } from '@/components/ui/Icons'
import LanceAoVivo from '@/components/leilao/LanceAoVivo'
import TransmissaoRodada from '@/components/leilao/TransmissaoRodada'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { supabase } from '@/lib/supabaseClient'
import { formatarBRL, formatarTempoRestante, horarioBrasilia, type EstadoLote, type LotePublico } from '@/lib/leilao'
import { embedYoutube, idVideoYoutube, urlLote, urlPagar } from '@/lib/leilao-urls'
import {
  intervaloPollRodada,
  loteQueFechou,
  resultadoLoteRodada,
  resultadoRecente,
  separarLotesRodada,
  tituloRodada,
  type EstadoRodada,
  type StatusRodada,
} from '@/lib/leilao-rodada'

/**
 * Ilha ao vivo da pagina da rodada: status e contagem, o lote no ar (com o
 * lance ali mesmo, pela LanceAoVivo), a fila e os encerrados.
 *
 * POLLING de /api/leiloes/rodada/[numero]/estado (publica, igual para todos):
 * 3s ao vivo, 2s nos ultimos 15s do lote, 30s agendada (3s a partir de 30s
 * antes do inicio), parado encerrada ou cancelada. Aba oculta nao busca; ao voltar, busca na hora. Cada busca tem
 * timeout de 10s (AbortController) e ate 2 novas tentativas curtas.
 * Resposta com `versao` menor que a ja vista e descartada.
 *
 * TROCA DE LOTE: o lote novo aparece NA HORA, com o relogio correndo (a
 * LanceAoVivo remonta pelo `key` do lote, com o relogio do servidor). O
 * resultado do que fechou vira uma faixa acima dele por RESULTADO_MS ("Lote 3
 * encerrado: arrematado por R$ X" / "sem lances"). Se a rodada encerrou no
 * mesmo ciclo, a secao continua na tela so com a faixa do ultimo lote. Aba
 * que volta do fundo so mostra resultado com menos de 10s (relogio do
 * servidor): resultado velho nao pisca como se fosse agora.
 *
 * ARREMATE: quando fecha um lote em que a pessoa logada deu lance (a
 * LanceAoVivo avisa por `aoParticipar`), a ilha consulta a rota do lote com o
 * token. Se ela venceu e o lote esta aguardando pagamento, fica uma faixa
 * persistente com o prazo e o botao de pagar.
 *
 * VISUAL (casca do Bynx Leiloes, mockup aprovado em 27/09/2026): topo com a
 * loja e "Assistir", tira de progresso (um segmento por lote), palco com a
 * foto grande do lote no ar, lance e anel (LanceAoVivo variante "rodada"),
 * faixa de resultado abaixo do Mercado Brasileiro e a fila de miniaturas.
 *
 * TRANSMISSAO: link de VIDEO do YouTube vira player youtube-nocookie
 * clique-para-carregar; no celular fica recolhido acima do palco (o
 * "Assistir" abre e fecha), no desktop (>= 1024px) em coluna ao lado. Link de
 * canal, Instagram ou outro: so o botao, que abre o link.
 */

export interface LojaDaRodada {
  slug: string
  nome: string | null
  logoUrl: string | null
  verificada: boolean
}

interface Arremate {
  id: string
  cardName: string
  precoCents: number | null
  pagarAte: string | null
  slug: string
}

async function tokenAtual(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

const TIMEOUT_MS = 10_000
const TENTATIVAS = 3
const ESPERA_TENTATIVA_MS = 1_000
const RESULTADO_MS = 4_000

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
  loja,
  compartilhar,
}: {
  estadoInicial: EstadoRodada
  urlRodada: string
  loja: LojaDaRodada | null
  /** Botao de compartilhar (montado no servidor), no topo ao lado do Assistir. */
  compartilhar?: ReactNode
}) {
  const [estado, setEstado] = useState<EstadoRodada>(estadoInicial)
  const baseInicial = Date.parse(estadoInicial.server_now)
  const offsetRef = useRef(0)
  const [agora, setAgora] = useState<number>(Number.isFinite(baseInicial) ? baseInicial : 0)
  const versaoRef = useRef(estadoInicial.versao)

  const inicial = separarLotesRodada(estadoInicial.lotes)
  /** Lote no ar na ultima leitura aplicada (para detectar o fechamento). */
  const ativoIdRef = useRef<string | null>(inicial.ativo?.id ?? null)
  /** Lote que acabou de fechar, em faixa acima do proximo por RESULTADO_MS. */
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

  // ── Arremate de quem esta logado ────────────────────────────────────────
  /** Lotes em que a pessoa tem lance (avisado pela LanceAoVivo). */
  const participadosRef = useRef<Set<string>>(new Set())
  const aoParticipar = useCallback((id: string) => {
    participadosRef.current.add(id)
  }, [])
  const [arremates, setArremates] = useState<Arremate[]>([])
  const vivoRef = useRef(true)
  useEffect(() => {
    vivoRef.current = true
    return () => {
      vivoRef.current = false
    }
  }, [])

  const conferirArremate = useCallback(async (l: LotePublico) => {
    const token = await tokenAtual()
    if (!token) return
    for (let i = 0; i < TENTATIVAS && vivoRef.current; i++) {
      try {
        const r = await fetch(`/api/leiloes/${l.id}/estado`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.status === 404 || r.status === 401) return
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as Partial<EstadoLote>
        if (!vivoRef.current) return
        if (j.voceLidera === true && j.lote?.status === 'aguardando_pagamento') {
          const lote = j.lote
          setArremates(atual =>
            atual.some(a => a.id === lote.id)
              ? atual
              : [
                  ...atual,
                  {
                    id: lote.id,
                    cardName: lote.cardName,
                    precoCents: lote.precoAtualCents,
                    pagarAte: typeof j.pagarAte === 'string' ? j.pagarAte : null,
                    slug: lote.slug,
                  },
                ]
          )
        }
        return
      } catch {
        if (i < TENTATIVAS - 1) await esperar(ESPERA_TENTATIVA_MS * (i + 1))
      }
    }
  }, [])

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
        // Resultado velho (aba voltando do fundo) nao vira faixa.
        if (resultadoRecente(fechou.encerradoEm, s)) {
          setResultado(fechou)
          if (resultadoTimer.current) clearTimeout(resultadoTimer.current)
          resultadoTimer.current = setTimeout(() => setResultado(null), RESULTADO_MS)
        }
        // Arremate conta mesmo fora da janela: a faixa de pagar e persistente.
        if (participadosRef.current.has(fechou.id)) conferirArremate(fechou)
      }
      ativoIdRef.current = ativo?.id ?? null
      // O lote novo monta agora: relogio do servidor deste instante.
      if (ativo) setServerNowAtivo(new Date(Date.now() + offsetRef.current).toISOString())
    }
    setEstado(novo)
  }, [conferirArremate])

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
            // A CDN guarda esta resposta por 1s: o `Age` diz ha quanto tempo o
            // server_now foi gerado. Soma para o relogio nao ficar atrasado.
            const idadeSeg = Number(r.headers.get('age'))
            if (j?.server_now && Number.isFinite(idadeSeg) && idadeSeg > 0 && idadeSeg < 30) {
              j.server_now = new Date(Date.parse(j.server_now) + idadeSeg * 1000).toISOString()
            }
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
      return intervaloPollRodada(e.rodada.status, ativo?.terminaEm, Date.now() + offsetRef.current, e.rodada.iniciaEm)
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

  // ── Transmissao ─────────────────────────────────────────────────────────
  const [videoAberto, setVideoAberto] = useState(false)
  const [tocando, setTocando] = useState(false)

  // ── Derivados ───────────────────────────────────────────────────────────
  const { rodada } = estado
  const { ativo, proximos, encerrados } = separarLotesRodada(estado.lotes)
  const visiveis = estado.lotes.filter(l => l.status !== 'cancelado')
  const total = visiveis.length
  const ini = rodada.iniciaEm ? Date.parse(rodada.iniciaEm) : NaN
  const faltaMs = Number.isFinite(ini) ? ini - agora : NaN
  const aoVivo = rodada.status === 'ao_vivo'
  const arrematados = encerrados.filter(l => resultadoLoteRodada(l)?.tipo === 'arrematado').length
  const res = resultado ? resultadoLoteRodada(resultado) : null
  // "Arrematado por R$ X" -> "arrematado por R$ X" depois dos dois pontos.
  const resTexto = res ? res.texto.charAt(0).toLowerCase() + res.texto.slice(1) : ''
  const titulo = tituloRodada(rodada)
  const lojaNome = loja ? loja.nome ?? loja.slug : null

  const link = rodada.linkTransmissao
  const mostrarTransmissao = !!link && (rodada.status === 'agendada' || aoVivo)
  const videoId = mostrarTransmissao ? idVideoYoutube(link) : null
  const embed = mostrarTransmissao ? embedYoutube(link) : null
  const temPlayer = !!videoId && !!embed

  // Posicao do lote no ar na rodada (1-based, sem os cancelados).
  const posAtivo = ativo ? visiveis.findIndex(l => l.id === ativo.id) + 1 : 0
  const fotoAtivo = ativo ? ativo.fotos[0] || ativo.cardImage : null

  const faixaResultado = resultado && res ? (
    <div role="status" className="rd-resultado" style={{ ...S.resultado, ...(res.tipo === 'arrematado' ? S.resultadoOk : null) }}>
      <span style={S.resultadoTexto}>
        {res.tipo === 'arrematado' && <IconCheck size={14} />}
        <span>
          {resultado.ordem != null ? `Lote ${resultado.ordem} encerrado` : 'Lote encerrado'}: {resTexto}
        </span>
      </span>
      {!ativo && (
        <span style={S.resultadoNome}>
          {resultado.cardName}
          {proximos.length > 0 && aoVivo ? ' · Próximo lote em instantes.' : ' · Este foi o último lote.'}
        </span>
      )}
    </div>
  ) : null

  return (
    <div className="rd-raiz">
      <style>{`
        .rd-raiz { display: flex; flex-direction: column; gap: 14px; }
        .rd-lote { display: block; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; }
        .rd-lote:hover { transform: translateY(-2px); }
        .rd-lote:focus-visible, .rd-link:focus-visible, .rd-mini:focus-visible, .rd-btn:focus-visible, .rd-video-capa:focus-visible {
          outline: 2px solid var(--ac-1); outline-offset: 2px;
        }
        .rd-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (min-width: 640px) { .rd-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; } }
        .rd-btn { transition: background 0.15s ease, border-color 0.15s ease; }
        .rd-btn:hover { background: var(--bx-surface-3); border-color: var(--bx-border-2); }
        /* Duas colunas so com player e a partir de 1024px: lote a esquerda, live a direita. */
        .rd-cols { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); align-items: start; }
        .rd-principal { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .rd-video { min-width: 0; }
        .rd-video-fechado { display: none; }
        @media (min-width: 1024px) {
          .rd-cols.rd-com-video { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; }
          .rd-com-video .rd-video { order: 2; position: sticky; top: 72px; }
          .rd-com-video .rd-video-fechado { display: block; }
          .rd-assistir-mobile { display: none !important; }
        }
        /* Palco: a foto do lote e o centro da tela. */
        .rd-palco { height: 250px; }
        @media (min-width: 640px) { .rd-palco { height: 340px; } }
        .rd-resultado { animation: rd-entra 0.2s ease; }
        .rd-pagar { transition: filter 0.15s ease; }
        .rd-pagar:hover { filter: brightness(1.08); }
        .rd-pagar:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .rd-fila { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .rd-fila::-webkit-scrollbar { display: none; }
        .rd-mini { transition: border-color 0.15s ease; }
        .rd-mini:hover { border-color: var(--bx-border-2); }
        .rd-ponto { animation: rd-pulsa 1.2s ease-in-out infinite; }
        @keyframes rd-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes rd-pulsa { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @media (prefers-reduced-motion: reduce) {
          .rd-lote, .rd-lote:hover { transition: none; transform: none; }
          .rd-resultado, .rd-ponto { animation: none; }
        }
      `}</style>

      {/* ─── Topo: loja, titulo, Assistir ─── */}
      <div style={S.topo}>
        {loja ? (
          <Link href={`/lojas/${loja.slug}`} prefetch={false} className="rd-link" style={S.lojaLogoLink} aria-label={`Loja ${lojaNome}`}>
            {loja.logoUrl ? (
              <Image src={loja.logoUrl} alt="" width={36} height={36} sizes="36px" style={S.lojaLogo} />
            ) : (
              <span style={{ ...S.lojaLogo, ...S.lojaLogoVazia }}>{(lojaNome ?? '?').charAt(0).toUpperCase()}</span>
            )}
          </Link>
        ) : null}
        <div style={S.topoTexto}>
          {loja && (
            <Link href={`/lojas/${loja.slug}`} prefetch={false} className="rd-link" style={S.lojaNome}>
              <span style={S.cortar}>{lojaNome}</span>
              {loja.verificada && <SeloVerificado />}
            </Link>
          )}
          <h1 style={S.h1}>
            Rodada {rodada.numero}
            {rodada.titulo ? <span style={S.h1Fraco}> · {titulo}</span> : null}
          </h1>
        </div>
        {mostrarTransmissao && (temPlayer ? (
          <button
            type="button"
            className="rd-btn rd-assistir-mobile"
            style={S.btnTopo}
            aria-expanded={videoAberto}
            onClick={() => {
              if (videoAberto) {
                // Recolher PARA o video: player escondido tocando seria audio sem tela.
                setVideoAberto(false)
                setTocando(false)
              } else {
                setVideoAberto(true)
                setTocando(true)
              }
            }}
          >
            <IconPlay size={14} />
            {videoAberto ? 'Fechar' : 'Assistir'}
          </button>
        ) : (
          <a href={link as string} target="_blank" rel="noopener noreferrer nofollow" className="rd-btn" style={S.btnTopo}>
            <IconPlay size={14} />
            Assistir
          </a>
        ))}
        {compartilhar && <div style={S.compartilhar}>{compartilhar}</div>}
      </div>
      {rodada.descricao && <p style={S.desc}>{rodada.descricao}</p>}

      <div className={`rd-cols${temPlayer ? ' rd-com-video' : ''}`}>
        {temPlayer && (
          <div className={`rd-video${videoAberto ? '' : ' rd-video-fechado'}`}>
            <TransmissaoRodada
              videoId={videoId as string}
              embedUrl={embed as string}
              titulo={titulo}
              tocando={tocando}
              aoTocar={() => setTocando(true)}
            />
          </div>
        )}

        <div className="rd-principal">
            {/* ─── Situacao (fora do ar) ─── */}
            {!aoVivo && (
              <section aria-label="Situação da rodada" style={S.statusBloco}>
                <div style={S.linhaStatus}>
                  <span style={{ ...S.pill, ...(rodada.status === 'agendada' ? S.pillAgendada : null) }}>
                    {ROTULO_RODADA[rodada.status]}
                  </span>
                  {rodada.status === 'agendada' && Number.isFinite(faltaMs) && (
                    <span style={S.relogio}>
                      <IconClock size={16} />
                      <span>{faltaMs > 0 ? `Começa em ${formatarTempoRestante(faltaMs)}` : 'Começando...'}</span>
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
            )}

            {/* ─── Arremates de quem esta logado (persistente) ─── */}
            {arremates.map(a => (
              <div key={a.id} role="status" style={S.arremate}>
                <p style={S.arremateTexto}>
                  <IconCheck size={18} />
                  <span>
                    Você arrematou <strong>{a.cardName}</strong>
                    {a.precoCents != null ? ` por ${formatarBRL(a.precoCents)}` : ''}.
                    {a.pagarAte ? ` Pague até ${horarioBrasilia(a.pagarAte)}.` : ' Conclua o pagamento pela Bynx.'}
                  </span>
                </p>
                <Link href={urlPagar(a.slug)} prefetch={false} className="rd-pagar bx-ctx-comprador" style={S.arrematePagar}>
                  Pagar agora
                </Link>
              </div>
            ))}

            {/* ─── Tira de progresso: um segmento por lote ─── */}
            {aoVivo && total > 0 && (
              <div
                role="img"
                aria-label={ativo ? `Lote ${posAtivo} de ${total}` : `${encerrados.filter(l => l.status !== 'cancelado').length} de ${total} lotes encerrados`}
                style={S.tira}
              >
                {visiveis.map(l => (
                  <i
                    key={l.id}
                    style={{
                      ...S.seg,
                      background: l.status === 'ativo' ? 'var(--ac-grad)' : l.status === 'agendado' ? 'var(--bx-border)' : 'var(--bx-text-3)',
                    }}
                  />
                ))}
              </div>
            )}

            {/* ─── Palco: o lote no ar ─── */}
            {aoVivo && ativo ? (
              <>
                <Link href={urlLote(ativo.slug)} prefetch={false} className="rd-palco rd-link" style={S.palco} aria-label={`Ver o lote ${ativo.cardName}`}>
                  {fotoAtivo ? (
                    <Image
                      src={fotoAtivo}
                      alt={ativo.cardName}
                      width={245}
                      height={342}
                      priority
                      sizes="(max-width: 640px) 60vw, 256px"
                      style={S.palcoImg}
                    />
                  ) : (
                    <span style={S.palcoSem}>Sem foto</span>
                  )}
                  <span style={{ ...S.palcoSelo, left: 10 }}>Lote {posAtivo} de {total}</span>
                  <span style={{ ...S.palcoSelo, ...S.palcoVivo, right: 10 }}>
                    <span className="rd-ponto" aria-hidden style={S.ponto} />
                    AO VIVO
                  </span>
                </Link>
                <Link href={urlLote(ativo.slug)} prefetch={false} className="rd-link" style={S.nomeAtivo}>
                  <span>
                    {ativo.cardName}
                    {ativo.cardNumero ? ` ${ativo.cardNumero}` : ''}
                    {[ativo.setNome, ativo.condicao].filter(Boolean).length > 0 && (
                      <span style={S.metaAtivo}> · {[ativo.setNome, ativo.condicao].filter(Boolean).join(' · ')}</span>
                    )}
                  </span>
                </Link>
                <LanceAoVivo
                  key={ativo.id}
                  variante="rodada"
                  loteInicial={ativo}
                  loteExterno={ativo}
                  pollingExterno
                  serverNow={serverNowAtivo}
                  referenciaMercadoCents={estado.referenciaMercadoCents ?? null}
                  urlLote={urlLote(ativo.slug)}
                  urlLogin={urlRodada}
                  aoParticipar={aoParticipar}
                  aposMercado={faixaResultado}
                />
              </>
            ) : aoVivo ? (
              <>
                {faixaResultado}
                {!resultado && (
                  <div role="status" style={S.aguardando}>
                    {proximos.length > 0 ? 'Preparando o próximo lote...' : 'Fechando a rodada...'}
                  </div>
                )}
              </>
            ) : (
              faixaResultado
            )}

            {/* ─── Proximos: fila de miniaturas na live, grade na agendada ─── */}
            {proximos.length > 0 && aoVivo && (
              <section aria-labelledby="rd-proximos" style={S.secao}>
                <h2 id="rd-proximos" style={S.rot}>Próximos</h2>
                <div className="rd-fila">
                  {proximos.map(l => {
                    const img = l.fotos[0] || l.cardImage
                    const pos = visiveis.findIndex(x => x.id === l.id) + 1
                    return (
                      <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="rd-mini" style={S.mini} aria-label={`Lote ${pos}: ${l.cardName}`}>
                        {img ? (
                          <Image src={img} alt="" width={245} height={342} sizes="64px" style={S.miniImg} />
                        ) : (
                          <span style={S.miniSem} />
                        )}
                        <span style={S.miniNum}>{pos}</span>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
            {proximos.length > 0 && !aoVivo && (
              <section aria-labelledby="rd-proximos" style={S.secao}>
                <h2 id="rd-proximos" style={S.h2}>
                  {rodada.status === 'agendada' ? 'Lotes da rodada' : 'Próximos lotes'} · {proximos.length}
                </h2>
                <div className="rd-grid">
                  {proximos.map(l => (
                    <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="rd-lote">
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
                <h2 id="rd-encerrados" style={aoVivo ? S.rot : S.h2}>Encerrados · {encerrados.length}</h2>
                <div className="rd-grid">
                  {encerrados.map(l => {
                    const r = resultadoLoteRodada(l)
                    return (
                      <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="rd-lote">
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
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  topo: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  lojaLogoLink: { flexShrink: 0, display: 'flex', minHeight: 44, alignItems: 'center', borderRadius: 10 },
  lojaLogo: { width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 },
  lojaLogoVazia: {
    display: 'grid', placeItems: 'center', background: 'var(--bx-surface-3)', color: 'var(--bx-text)',
    fontWeight: 800, fontSize: 14,
  },
  topoTexto: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  lojaNome: {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--bx-text)',
    textDecoration: 'none', minWidth: 0, borderRadius: 6,
  },
  cortar: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  h1: {
    margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--bx-text-3)', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  h1Fraco: { fontWeight: 500 },
  btnTopo: {
    flexShrink: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px',
    borderRadius: 999, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer',
  },
  compartilhar: { flexShrink: 0 },
  desc: { fontSize: 13, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' },
  statusBloco: {
    display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 12,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
  },
  linhaStatus: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  pill: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
    background: 'var(--bx-surface-2)', color: 'var(--bx-text-2)',
    // Longhands: pillAgendada troca so a cor (shorthand + borderColor gera aviso do React).
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)',
  },
  pillAgendada: { background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)', borderColor: 'var(--ac-1)' },
  relogio: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 800, color: 'var(--bx-text)',
    fontVariantNumeric: 'tabular-nums',
  },
  horaAbs: { fontSize: 13, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5 },
  tira: { display: 'flex', gap: 3 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  palco: {
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16,
    border: '1px solid var(--bx-border)', textDecoration: 'none', color: 'inherit', overflow: 'hidden',
    background: 'radial-gradient(110% 80% at 50% 25%, rgba(var(--ac-1-rgb), 0.16), transparent 62%), var(--bx-bg-elev)',
  },
  palcoImg: { height: '90%', width: 'auto', maxWidth: '80%', objectFit: 'contain', borderRadius: 10, boxShadow: 'var(--bx-shadow)' },
  palcoSem: { fontSize: 13, color: 'var(--bx-text-3)' },
  palcoSelo: {
    position: 'absolute', top: 10, height: 26, padding: '0 9px', borderRadius: 999, display: 'inline-flex',
    alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--bx-text)', background: 'var(--bx-scrim)',
    border: '1px solid var(--bx-border-2)', fontVariantNumeric: 'tabular-nums',
  },
  palcoVivo: { color: 'var(--ac-2)', borderColor: 'var(--ac-2)', fontWeight: 800, letterSpacing: '0.06em' },
  ponto: { width: 7, height: 7, borderRadius: 999, background: 'var(--ac-2)' },
  nomeAtivo: {
    fontSize: 16, fontWeight: 700, color: 'var(--bx-text)', textDecoration: 'none', lineHeight: 1.35,
    overflowWrap: 'anywhere', minHeight: 44, display: 'flex', alignItems: 'center', borderRadius: 6,
  },
  metaAtivo: { fontWeight: 500, color: 'var(--bx-text-3)' },
  secao: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  h2: { fontSize: 17, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  rot: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: 0,
  },
  resultado: {
    display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 11px', borderRadius: 10,
    background: 'var(--bx-surface)', color: 'var(--bx-text-2)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border-2)',
  },
  resultadoOk: { color: 'var(--bx-green)', borderColor: 'var(--bx-green)', background: 'color-mix(in srgb, var(--bx-green) 8%, transparent)' },
  resultadoNome: { fontSize: 12.5, color: 'var(--bx-text-2)', fontWeight: 500, overflowWrap: 'anywhere' },
  resultadoTexto: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
  },
  arremate: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    padding: '12px 14px', borderRadius: 12, background: 'var(--bx-surface)', border: '1px solid var(--bx-green)',
  },
  arremateTexto: {
    display: 'flex', alignItems: 'flex-start', gap: 8, margin: 0, flex: '1 1 220px', minWidth: 0,
    fontSize: 14, lineHeight: 1.5, color: 'var(--bx-text)', overflowWrap: 'anywhere',
  },
  arrematePagar: {
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px',
    borderRadius: 10, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontSize: 14, fontWeight: 800,
    textDecoration: 'none', flexShrink: 0,
  },
  aguardando: {
    minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16,
    borderRadius: 12, background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
    color: 'var(--bx-text-2)', fontSize: 14, fontWeight: 600,
  },
  mini: {
    position: 'relative', flex: '0 0 56px', width: 56, borderRadius: 8, overflow: 'hidden',
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', minHeight: 44,
  },
  miniImg: { width: '100%', height: 'auto', display: 'block' },
  miniSem: { display: 'block', width: '100%', aspectRatio: '245 / 342' },
  miniNum: {
    position: 'absolute', left: 3, top: 3, fontSize: 10, fontWeight: 800, color: 'var(--bx-text)',
    background: 'var(--bx-scrim)', borderRadius: 5, padding: '0 4px', fontVariantNumeric: 'tabular-nums',
  },
  badge: {
    fontSize: 12, fontWeight: 800, color: 'var(--bx-text)', background: 'var(--bx-bg-elev)',
    border: '1px solid var(--bx-border-2)', padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
  },
  rodape: { display: 'flex', flexDirection: 'column', gap: 2 },
  rodapeForte: { fontSize: 12, fontWeight: 700, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums' },
  rodapeFraco: { fontSize: 11, fontWeight: 600, color: 'var(--bx-text-3)' },
}
