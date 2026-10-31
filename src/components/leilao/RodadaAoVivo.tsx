'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import CardItem from '@/components/ui/CardItem'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { IconCheck, IconClock, IconPlay, IconStarFilled } from '@/components/ui/Icons'
import LanceAoVivo from '@/components/leilao/LanceAoVivo'
import TransmissaoRodada from '@/components/leilao/TransmissaoRodada'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import FeedLances from '@/components/leilao/rodada/FeedLances'
import FilaProximos from '@/components/leilao/rodada/FilaProximos'
import CartaoLojaRodada from '@/components/leilao/rodada/CartaoLojaRodada'
import RegrasRodada from '@/components/leilao/rodada/RegrasRodada'
import ResultadosRodada from '@/components/leilao/rodada/ResultadosRodada'
import BlocoLojista from '@/components/leilao/rodada/BlocoLojista'
import LogoLoja from '@/components/leilao/rodada/LogoLoja'
import BotaoAgenda from '@/components/leilao/vitrine/BotaoAgenda'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import type { LojaDaRodada, ReputacaoDaRodada } from '@/components/leilao/rodada/tipos'
import { supabase } from '@/lib/supabaseClient'
import { formatarBRL, formatarTempoRestante, horarioBrasilia, type EstadoLote, type LotePublico } from '@/lib/leilao'
import { embedYoutube, idVideoYoutube, urlLote, urlPagar } from '@/lib/leilao-urls'
import {
  intervaloPollRodada,
  loteQueFechou,
  resultadoLoteRodada,
  resultadoRecente,
  separarLotesRodada,
  textoAvaliacao,
  type EstadoRodada,
  type LancePublico,
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
 * VISUAL (mockup v2 da rodada, aprovado pelo Du): topo com a loja em
 * destaque, reputacao real e o h1 "Leilao {Loja} · Rodada N"; tira de
 * progresso e "Lote X de Y · N participantes". Desktop (>= 1024px) em 3
 * colunas 5/4/3:
 *   1. transmissao (YouTube) + proximos lotes. Sem YouTube, o palco vem para ca.
 *   2. palco + nome + lance/anel/Mercado Brasileiro/atalhos (LanceAoVivo).
 *   3. lances ao vivo (feed), cartao da loja e regras da rodada.
 * Celular: tudo empilhado, com o lote no ar primeiro (palco, lance, feed) e
 * depois fila, loja e regras; o CTA fica fixo no fim da tela. Fora do ar
 * (agendada, encerrada, cancelada): coluna principal + loja e regras ao lado.
 * No fim: resultados desta rodada (CardItem) e a chamada para lojas.
 *
 * FEED: os ultimos 8 lances do lote no ar chegam no mesmo polling (campo
 * `lances`). Leitura sem o campo (falha complementar no servidor) mantem o
 * feed que ja estava na tela, se for do mesmo lote.
 *
 * TRANSMISSAO: link de VIDEO do YouTube vira player youtube-nocookie
 * clique-para-carregar; no celular fica recolhido no topo (o "Assistir" abre
 * e fecha), no desktop na coluna 1. Link de canal, Instagram ou outro: so o
 * botao, que abre o link.
 */

export type { LojaDaRodada } from '@/components/leilao/rodada/tipos'

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
  reputacao = null,
  referenciasFila = {},
  compartilhar,
}: {
  estadoInicial: EstadoRodada
  urlRodada: string
  loja: LojaDaRodada | null
  /** Avaliacao e rodadas reais da loja (lidas no servidor). null = sem dado. */
  reputacao?: ReputacaoDaRodada | null
  /** Mercado Brasileiro de hoje (menor preco) por lote da fila, lido no servidor. */
  referenciasFila?: Record<string, number>
  /** Botao de compartilhar (montado no servidor), no topo ao lado do Assistir. */
  compartilhar?: ReactNode
}) {
  const [estado, setEstado] = useState<EstadoRodada>(estadoInicial)
  // #416 (opcao a): quem chega deslogado pelo link da loja ve o convite para
  // entrar ANTES do lote abrir. undefined = ainda lendo a sessao (nao pisca).
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const { openLogin } = useAuthModal()
  useEffect(() => {
    let vivo = true
    supabase.auth.getSession().then(({ data }) => { if (vivo) setLogado(!!data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [])
  /** Feed do lote no ar. Separado do estado: leitura sem `lances` nao apaga o que ja estava. */
  const [feed, setFeed] = useState<{ loteId: string | null; lances: LancePublico[] }>({
    loteId: estadoInicial.lancesLoteId ?? null,
    lances: estadoInicial.lances ?? [],
  })
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
    if (Array.isArray(novo.lances)) {
      setFeed({ loteId: novo.lancesLoteId ?? null, lances: novo.lances })
    } else if (!ativo) {
      setFeed({ loteId: null, lances: [] })
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
  const lojaNome = loja ? loja.nome ?? loja.slug : null
  const titulo = rodada.titulo?.trim() || null
  // h1: "Leilão {Loja} · Rodada N" (+ o titulo da loja, quando tem).
  const h1 = [lojaNome ? `Leilão ${lojaNome}` : 'Leilão', `Rodada ${rodada.numero}`, titulo].filter(Boolean).join(' · ')
  const avaliacao = reputacao ? textoAvaliacao(reputacao.media, reputacao.total) : null
  const nRodadas = reputacao?.rodadas ?? null

  const link = rodada.linkTransmissao
  const mostrarTransmissao = !!link && (rodada.status === 'agendada' || aoVivo)
  const videoId = mostrarTransmissao ? idVideoYoutube(link) : null
  const embed = mostrarTransmissao ? embedYoutube(link) : null
  const temPlayer = !!videoId && !!embed

  const posicao = (id: string) => visiveis.findIndex(l => l.id === id) + 1
  // Posicao do lote no ar na rodada (1-based, sem os cancelados).
  const posAtivo = ativo ? posicao(ativo.id) : 0
  const fotoAtivo = ativo ? ativo.fotos[0] || ativo.cardImage : null
  const metaAtivo = ativo ? [ativo.setNome, ativo.condicao, ativo.idioma?.toUpperCase()].filter(Boolean).join(' · ') : ''
  const lancesAtivo = ativo && feed.loteId === ativo.id ? feed.lances : []
  const encerradosVisiveis = encerrados.filter(l => l.status !== 'cancelado').length

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

  const video = temPlayer ? (
    <div className={`rd-video${videoAberto ? '' : ' rd-video-fechado'}`}>
      <TransmissaoRodada
        videoId={videoId as string}
        embedUrl={embed as string}
        titulo={h1}
        tocando={tocando}
        aoTocar={() => {
          // Tocou na capa (so visivel no desktop): marca o video como aberto
          // tambem. Se o layout cair para o celular, o player continua
          // visivel em vez de tocar escondido.
          setVideoAberto(true)
          setTocando(true)
        }}
      />
    </div>
  ) : null

  const palco = aoVivo && ativo ? (
    <Link
      href={urlLote(ativo.slug)}
      prefetch={false}
      className={`rd-palco rd-link${temPlayer ? '' : ' rd-palco-grande'}`}
      style={S.palco}
      aria-label={`Ver o lote ${ativo.cardName}`}
    >
      {fotoAtivo ? (
        <Image
          src={fotoAtivo}
          alt={ativo.cardName}
          width={245}
          height={342}
          priority
          sizes="(max-width: 640px) 60vw, 300px"
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
  ) : null

  const blocoLance = aoVivo ? (
    ativo ? (
      <div className="rd-lance" style={S.pilha}>
        <Link href={urlLote(ativo.slug)} prefetch={false} className="rd-link" style={S.nomeAtivo}>
          <span>
            {ativo.cardName}
            {ativo.cardNumero ? ` ${ativo.cardNumero}` : ''}
            {metaAtivo && <span style={S.metaAtivo}> · {metaAtivo}</span>}
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
      </div>
    ) : (
      <div className="rd-lance" style={S.pilha}>
        {faixaResultado}
        {!resultado && (
          <div role="status" style={S.aguardando}>
            {proximos.length > 0 ? 'Preparando o próximo lote...' : 'Fechando a rodada...'}
          </div>
        )}
      </div>
    )
  ) : null

  const lateral = (
    <>
      {aoVivo && ativo && (
        <div className="rd-feed">
          <FeedLances
            key={ativo.id}
            loteId={ativo.id}
            lances={lancesAtivo}
            nLances={ativo.nLances}
            lanceInicialCents={ativo.lanceInicialCents}
            agoraMs={agora}
          />
        </div>
      )}
      {loja && (
        <div className="rd-loja">
          <CartaoLojaRodada loja={loja} reputacao={reputacao} />
        </div>
      )}
      <div className="rd-regras">
        <RegrasRodada ativo={aoVivo ? ativo : null} />
      </div>
    </>
  )

  return (
    <div className="rd-raiz">
      <style>{`
        .rd-raiz { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .rd-lote { display: block; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; }
        .rd-lote:hover { transform: translateY(-2px); }
        .rd-lote:focus-visible, .rd-link:focus-visible, .rd-btn:focus-visible, .rd-video-capa:focus-visible,
        .fp-it:focus-visible, .rdc-btn:focus-visible, .bl-cta:focus-visible {
          outline: 2px solid var(--ac-1); outline-offset: 2px;
        }
        .rd-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (min-width: 640px) { .rd-grid { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; } }
        .rd-btn, .rdc-btn, .fp-it { transition: background 0.15s ease, border-color 0.15s ease; }
        .rd-btn:hover, .rdc-btn:hover { background: var(--bx-surface-3); border-color: var(--bx-border-2); }
        .fp-it:hover { border-color: var(--bx-border-2); }
        .bl-cta { transition: filter 0.15s ease; }
        .bl-cta:hover { filter: brightness(1.08); }
        .rd-so-desk { display: none; }

        /* Celular: colunas somem (display: contents) e a ordem vem do "order":
           lote no ar primeiro, depois feed, fila, loja e regras. */
        .rd-r3 { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .rd-col { display: contents; }
        .rd-video { order: 1; min-width: 0; }
        .rd-video-fechado { display: none; }
        .rd-palco { order: 2; }
        .rd-lance { order: 3; }
        .rd-feed { order: 4; }
        .rd-fila { order: 5; }
        .rd-principal { order: 3; }
        .rd-loja { order: 6; }
        .rd-regras { order: 7; }
        .rd-palco { height: 250px; }
        @media (min-width: 640px) { .rd-palco { height: 340px; } }

        @media (min-width: 1024px) {
          .rd-so-desk { display: inline-flex; }
          .rd-assistir-mobile { display: none !important; }
          .rd-r3 { display: grid; gap: 20px; align-items: start; grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 3fr); }
          .rd-r3.rd-fora { grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); }
          .rd-col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
          .rd-video-fechado { display: block; }
          .rd-palco-grande { height: 440px; }
        }
        .rd-resultado { animation: rd-entra 0.2s ease; }
        .rd-pagar { transition: filter 0.15s ease; }
        .rd-pagar:hover { filter: brightness(1.08); }
        .rd-pagar:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .rd-ponto { animation: rd-pulsa 1.2s ease-in-out infinite; }
        @keyframes rd-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes rd-pulsa { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @media (prefers-reduced-motion: reduce) {
          .rd-lote, .rd-lote:hover { transition: none; transform: none; }
          .rd-resultado, .rd-ponto { animation: none; }
        }
      `}</style>

      {/* ─── Topo: a loja em destaque; o h1 e "Leilão {Loja} · Rodada N" ───
          O nome da loja e um link comum, fora da hierarquia de titulos. O h1
          identifica esta URL (a loja tem varias rodadas). */}
      <div style={S.topo}>
        {loja ? (
          <Link href={`/lojas/${loja.slug}`} prefetch={false} className="rd-link" style={S.lojaLogoLink} aria-label={`Loja ${lojaNome}`}>
            <LogoLoja nome={lojaNome ?? '?'} logoUrl={loja.logoUrl} tam={44} />
          </Link>
        ) : null}
        <div style={S.topoTexto}>
          {loja && (
            <Link href={`/lojas/${loja.slug}`} prefetch={false} className="rd-link" style={S.lojaNome}>
              <span style={S.cortar}>{lojaNome}</span>
              {loja.verificada && (
                <span style={S.verif}>
                  <SeloVerificado size={13} />
                  <span aria-hidden>Verificada</span>
                </span>
              )}
            </Link>
          )}
          <h1 style={S.h1}>{h1}</h1>
        </div>
        {loja && (
          <span className="rd-so-desk" style={S.estrelas}>
            {avaliacao ? <IconStarFilled size={13} style={{ color: 'var(--bx-amber)' }} /> : null}
            {avaliacao ?? 'Loja nova na Bynx'}
            {nRodadas != null && nRodadas > 0 ? ` · ${nRodadas} ${nRodadas === 1 ? 'rodada' : 'rodadas'}` : ''}
          </span>
        )}
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
        <div style={S.tiraBloco}>
          <div
            role="img"
            aria-label={ativo ? `Lote ${posAtivo} de ${total}` : `${encerradosVisiveis} de ${total} lotes encerrados`}
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
          <span style={S.tiraTexto}>
            {ativo ? `Lote ${posAtivo} de ${total}` : `${encerradosVisiveis} de ${total} lotes encerrados`}
            {ativo && ativo.nParticipantes > 0
              ? ` · ${ativo.nParticipantes} ${ativo.nParticipantes === 1 ? 'participante' : 'participantes'}`
              : ''}
          </span>
        </div>
      )}

      {aoVivo ? (
        <div className={`rd-r3${temPlayer ? ' rd-com-video' : ''}`}>
          <div className="rd-col">
            {video}
            {!temPlayer && palco}
            {proximos.length > 0 && (
              <div className="rd-fila">
                <FilaProximos proximos={proximos} posicao={posicao} referencias={referenciasFila} />
              </div>
            )}
          </div>
          <div className="rd-col">
            {temPlayer && palco}
            {blocoLance}
          </div>
          <div className="rd-col">{lateral}</div>
        </div>
      ) : (
        <div className="rd-r3 rd-fora">
          <div className="rd-col">
            <div className="rd-principal" style={S.pilha}>
              {/* ─── Situacao (fora do ar) ─── */}
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
                {/* #416 (opcao a): salvar o horario e entrar antes do lote abrir. */}
                {rodada.status === 'agendada' && rodada.iniciaEm && (
                  <BotaoAgenda numero={rodada.numero} titulo={h1} iniciaEm={rodada.iniciaEm} descricao={rodada.descricao ?? null} estilo={S.btAgenda} />
                )}
                {rodada.status === 'agendada' && logado === false && (
                  <div style={S.convite}>
                    <p style={S.horaAbs}>Para dar lance você precisa de uma conta na Bynx. Leva 1 minuto.</p>
                    <button type="button" style={S.btEntrar} onClick={() => openLogin({ next: urlRodada })}>Entrar ou criar conta</button>
                  </div>
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
              {faixaResultado}
              {video}

              {/* ─── Lotes da rodada (agendada) ─── */}
              {proximos.length > 0 && (
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
                              {referenciasFila[l.id] ? (
                                <span style={S.rodapeFraco}>Mercado hoje a partir de {formatarBRL(referenciasFila[l.id])}</span>
                              ) : null}
                            </div>
                          }
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
          <div className="rd-col">{lateral}</div>
        </div>
      )}

      {/* ─── Resultados desta rodada ─── */}
      <ResultadosRodada encerrados={encerrados} total={total} posicao={posicao} />

      {/* ─── Para lojas ─── */}
      <BlocoLojista />
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  topo: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  lojaLogoLink: { flexShrink: 0, display: 'flex', minHeight: 44, alignItems: 'center', borderRadius: 10 },
  topoTexto: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  lojaNome: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: 'var(--bx-text)',
    textDecoration: 'none', minWidth: 0, borderRadius: 6, minHeight: 26,
  },
  verif: { display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--bx-blue)' },
  cortar: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  // h1 semantico, visualmente discreto (a loja e quem se destaca no topo).
  h1: {
    margin: 0, fontSize: 12.5, fontWeight: 500, color: 'var(--bx-text-3)', lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  estrelas: {
    flexShrink: 0, alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums',
  },
  btnTopo: {
    flexShrink: 0, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px',
    borderRadius: 999, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', cursor: 'pointer',
  },
  compartilhar: { flexShrink: 0 },
  desc: { fontSize: 13, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' },
  pilha: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
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
  btAgenda: { minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)', color: 'var(--bx-text)', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 },
  convite: { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 12, borderTop: '1px solid var(--bx-border)' },
  btEntrar: { minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none', background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', font: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', alignSelf: 'flex-start' },
  tiraBloco: { display: 'flex', flexDirection: 'column', gap: 6 },
  tira: { display: 'flex', gap: 4 },
  seg: { flex: 1, height: 5, borderRadius: 3 },
  tiraTexto: { fontSize: 12, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  palco: {
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16,
    border: '1px solid var(--bx-border)', textDecoration: 'none', color: 'inherit', overflow: 'hidden',
    background: 'radial-gradient(110% 80% at 50% 25%, rgba(var(--ac-1-rgb), 0.16), transparent 62%), var(--bx-bg-elev)',
  },
  palcoImg: { height: '88%', width: 'auto', maxWidth: '80%', objectFit: 'contain', borderRadius: 10, boxShadow: 'var(--bx-shadow)' },
  palcoSem: { fontSize: 13, color: 'var(--bx-text-3)' },
  palcoSelo: {
    position: 'absolute', top: 10, height: 26, padding: '0 9px', borderRadius: 999, display: 'inline-flex',
    alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--bx-text)', background: 'var(--bx-scrim)',
    border: '1px solid var(--bx-border-2)', fontVariantNumeric: 'tabular-nums',
  },
  palcoVivo: { color: 'var(--ac-2)', borderColor: 'var(--ac-2)', fontWeight: 800, letterSpacing: '0.06em' },
  ponto: { width: 7, height: 7, borderRadius: 999, background: 'var(--ac-2)' },
  nomeAtivo: {
    fontSize: 17, fontWeight: 800, color: 'var(--bx-text)', textDecoration: 'none', lineHeight: 1.35,
    overflowWrap: 'anywhere', minHeight: 44, display: 'flex', alignItems: 'center', borderRadius: 6,
  },
  metaAtivo: { fontSize: 13, fontWeight: 500, color: 'var(--bx-text-3)' },
  secao: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 },
  h2: { fontSize: 17, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
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
  badge: {
    fontSize: 12, fontWeight: 800, color: 'var(--bx-text)', background: 'var(--bx-bg-elev)',
    border: '1px solid var(--bx-border-2)', padding: '2px 8px', borderRadius: 6, fontVariantNumeric: 'tabular-nums',
  },
  rodape: { display: 'flex', flexDirection: 'column', gap: 2 },
  rodapeForte: { fontSize: 12, fontWeight: 700, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums' },
  rodapeFraco: { fontSize: 11, fontWeight: 600, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
}
