'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconArrowRight, IconClock, IconHistory, IconPokeball, IconWarning } from '@/components/ui/Icons'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'
import { formatarBRL, formatarTempoRestante, horarioBrasilia, statusPublico } from '@/lib/leilao'
import type { ItemMeu, RespostaMeus } from '@/lib/leilao-meus'
import { urlHome, urlLote, urlMeusLances, urlPagar } from '@/lib/leilao-urls'

/**
 * Ilha de /leiloes/meus-lances. Busca GET /api/leiloes/meus com o Bearer da
 * sessao a cada 15s com a aba visivel (e na hora em que a aba volta).
 * O relogio conta pelo `server_now` da ultima resposta + deslocamento, como
 * a tela do lote.
 */

const URL_PAGINA = urlMeusLances()
const urlPedido = (id: string) => `/pedido/${id}`
const URL_VITRINE = urlHome()

const INTERVALO_MS = 15_000

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'deslogado' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; dados: RespostaMeus }

async function tokenAtual(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/** "28/09 21:30" em Brasilia. */
function diaHora(iso: string | null): string {
  if (!iso) return ''
  const m = horarioBrasilia(iso).match(/^(\d{2}\/\d{2})\/\d{4}, (\d{2}:\d{2})/)
  return m ? `${m[1]} ${m[2]}` : ''
}

export default function MeusLances() {
  const { openLogin } = useAuthModal()
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [agora, setAgora] = useState<number>(() => Date.now())
  const deslocamento = useRef(0)
  const emVoo = useRef(false)

  const carregar = useCallback(async () => {
    if (emVoo.current) return
    emVoo.current = true
    try {
      const token = await tokenAtual()
      if (!token) {
        setEstado({ tipo: 'deslogado' })
        return
      }
      const r = await fetch('/api/leiloes/meus', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      if (r.status === 401) {
        setEstado({ tipo: 'deslogado' })
        return
      }
      if (!r.ok) {
        // Falha no meio do polling: mantem o que ja estava na tela.
        setEstado(e => (e.tipo === 'pronto' ? e : { tipo: 'erro' }))
        return
      }
      const dados = (await r.json()) as RespostaMeus
      const srv = Date.parse(dados.server_now)
      if (Number.isFinite(srv)) deslocamento.current = srv - Date.now()
      setEstado({ tipo: 'pronto', dados })
    } catch {
      setEstado(e => (e.tipo === 'pronto' ? e : { tipo: 'erro' }))
    } finally {
      emVoo.current = false
    }
  }, [])

  // Sessao: carrega na montagem e quando o login muda.
  useEffect(() => {
    carregar()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      carregar()
    })
    return () => sub.subscription.unsubscribe()
  }, [carregar])

  // Polling so com a aba visivel; volta da aba busca na hora.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') carregar()
    }, INTERVALO_MS)
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') carregar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [carregar])

  // Ancora (#ml-a_pagar, vinda de "Arremates a pagar"): a secao so existe
  // depois da primeira resposta, entao o navegador nao rola sozinho. Rola uma
  // vez, no primeiro estado pronto; o polling nao puxa a tela de novo.
  const ancoraFeita = useRef(false)
  useEffect(() => {
    if (estado.tipo !== 'pronto' || ancoraFeita.current) return
    ancoraFeita.current = true
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (!id) return
    const alvo = document.getElementById(id)
    if (!alvo) return
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    alvo.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'start' })
  }, [estado.tipo])

  // Relogio da tela (1s), acertado pelo servidor.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now() + deslocamento.current), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={S.pagina}>
      <style>{`
        .ml-acao { transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
        .ml-acao:hover { transform: translateY(-2px); }
        .ml-acao:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .ml-item { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 12px; align-items: center; }
        .ml-item .ml-acoes { grid-column: 1 / -1; }
        @media (min-width: 640px) {
          .ml-item { grid-template-columns: 56px minmax(0, 1fr) auto; }
          .ml-item .ml-acoes { grid-column: auto; }
        }
        @media (prefers-reduced-motion: reduce) { .ml-acao, .ml-acao:hover { transition: none; transform: none; } }
      `}</style>

      <header style={S.cabeca}>
        <h1 style={S.titulo}>Meus lances</h1>
        <p style={S.sub}>Os lotes em que você deu lance. O que pede ação aparece primeiro.</p>
      </header>

      {estado.tipo === 'carregando' && <p style={S.aviso}>Carregando seus lances...</p>}

      {estado.tipo === 'deslogado' && (
        <Vazio
          titulo="Entre para ver seus lances"
          texto="Aqui ficam os lotes em que você está liderando, os que alguém cobriu e os arremates a pagar."
          acao={
            <button type="button" className="ml-acao" style={S.cta} onClick={() => openLogin({ next: URL_PAGINA })}>
              Entrar
            </button>
          }
        />
      )}

      {estado.tipo === 'erro' && (
        <Vazio
          titulo="Não foi possível carregar"
          texto="Tente de novo em instantes."
          acao={
            <button type="button" className="ml-acao" style={S.ghost} onClick={() => carregar()}>
              Tentar de novo
            </button>
          }
        />
      )}

      {estado.tipo === 'pronto' && estado.dados.grupos.length === 0 && (
        <Vazio
          titulo="Você ainda não deu lance"
          texto="Quando der lance em um lote, ele aparece aqui com o preço atual e o seu máximo."
          acao={
            <Link href={URL_VITRINE} className="ml-acao" style={S.cta}>
              Ver leilões <IconArrowRight size={16} />
            </Link>
          }
        />
      )}

      {estado.tipo === 'pronto' &&
        estado.dados.grupos.map(g => (
          <section key={g.grupo} style={S.secao} aria-labelledby={`ml-${g.grupo}`}>
            <h2 id={`ml-${g.grupo}`} style={S.secaoTitulo}>
              {g.titulo} <span style={S.contagem}>{g.itens.length}</span>
            </h2>
            <ul style={S.lista}>
              {g.itens.map(it => (
                <li key={it.lote.id}>
                  <Cartao item={it} agora={agora} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao: ReactNode }) {
  return (
    <div style={S.vazio}>
      <IconHistory size={28} color="var(--bx-text-3)" />
      <p style={S.vazioTitulo}>{titulo}</p>
      <p style={S.vazioTexto}>{texto}</p>
      {acao}
    </div>
  )
}

function linhaDeEstado(it: ItemMeu, agora: number): { texto: string; tom: 'normal' | 'urgente' | 'apagado' | 'alerta' } {
  const l = it.lote
  const st = statusPublico(l, agora)
  if (it.grupo === 'liderando' || it.grupo === 'superado') {
    if (st === 'em_breve') {
      const ini = l.iniciaEm ? Date.parse(l.iniciaEm) : NaN
      return { texto: Number.isFinite(ini) && ini > agora ? `Começa em ${formatarTempoRestante(ini - agora)}` : 'Em breve', tom: 'apagado' }
    }
    if (st === 'ao_vivo' || st === 'encerrando') {
      const fim = l.terminaEm ? Date.parse(l.terminaEm) : NaN
      const resta = Number.isFinite(fim) ? formatarTempoRestante(fim - agora) : 'Ao vivo'
      return { texto: `Termina em ${resta}`, tom: st === 'encerrando' ? 'urgente' : 'normal' }
    }
    return { texto: 'Encerrando...', tom: 'apagado' }
  }
  if (it.pagamento?.estado === 'aguardando') {
    const ate = diaHora(it.pagamento.pagarAte)
    return { texto: ate ? `Arrematado. Pague até ${ate} (Brasília)` : 'Arrematado. Aguardando pagamento', tom: 'alerta' }
  }
  if (it.pagamento?.estado === 'pago') return { texto: 'Arrematado e pago', tom: 'normal' }
  if (it.pagamento?.estado === 'calote') return { texto: 'Prazo de pagamento vencido', tom: 'urgente' }
  if (l.status === 'cancelado') return { texto: 'Lote cancelado', tom: 'apagado' }
  if (l.status === 'sem_lances') return { texto: 'Encerrado sem lances', tom: 'apagado' }
  return { texto: 'Encerrado. Outro lance venceu', tom: 'apagado' }
}

function Acao({ it }: { it: ItemMeu }) {
  const l = it.lote
  if (it.grupo === 'superado' && l.status === 'ativo') {
    return (
      <Link href={urlLote(l.slug)} className="ml-acao" style={S.cta}>
        Cobrir
      </Link>
    )
  }
  if (it.pagamento?.estado === 'aguardando') {
    const ate = diaHora(it.pagamento.pagarAte)
    return (
      <Link href={urlPagar(l.slug)} className="ml-acao" style={S.cta}>
        {ate ? `Pagar até ${ate}` : 'Pagar'}
      </Link>
    )
  }
  if (it.pagamento?.estado === 'pago' && it.pagamento.pedidoId) {
    return (
      <Link href={urlPedido(it.pagamento.pedidoId)} className="ml-acao" style={S.ghost}>
        Ver pedido
      </Link>
    )
  }
  return (
    <Link href={urlLote(l.slug)} className="ml-acao" style={S.ghost}>
      Ver lote
    </Link>
  )
}

function Cartao({ item: it, agora }: { item: ItemMeu; agora: number }) {
  const l = it.lote
  const img = l.fotos[0] || l.cardImage
  const nome = [l.cardName, l.cardNumero, rotuloGraduacao(l)].filter(Boolean).join(' ')
  const preco = l.precoAtualCents ?? l.lanceInicialCents
  const linha = linhaDeEstado(it, agora)
  const corLinha =
    linha.tom === 'urgente' ? 'var(--bx-red)' : linha.tom === 'alerta' ? 'var(--ac-1)' : linha.tom === 'apagado' ? 'var(--bx-text-3)' : 'var(--bx-text-2)'
  const aberto = it.grupo === 'liderando' || it.grupo === 'superado'

  return (
    <div className="ml-item" style={S.cartao}>
      <Link href={urlLote(l.slug)} style={S.thumb} aria-label={nome}>
        {img ? (
          <Image src={img} alt="" width={56} height={78} sizes="56px" style={S.thumbImg} />
        ) : (
          <IconPokeball size={22} color="var(--bx-text-3)" />
        )}
      </Link>
      <div style={{ minWidth: 0 }}>
        <Link href={urlLote(l.slug)} style={S.nome}>
          {nome}
        </Link>
        <div style={S.valores}>
          <span>
            <span style={S.rotulo}>{aberto ? 'Preço atual' : 'Final'}</span>{' '}
            <strong style={S.valor}>{formatarBRL(preco)}</strong>
          </span>
          <span>
            <span style={S.rotulo}>Seu máximo</span> <strong style={S.valor}>{formatarBRL(it.seuMaximoCents)}</strong>
          </span>
        </div>
        <p style={{ ...S.estado, color: corLinha }}>
          {linha.tom === 'urgente' && it.grupo !== 'liderando' && it.grupo !== 'superado' ? (
            <IconWarning size={12} />
          ) : (
            <IconClock size={12} />
          )}
          {linha.texto}
        </p>
      </div>
      <div className="ml-acoes">
        <Acao it={it} />
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  pagina: { maxWidth: 760, margin: '0 auto', paddingBottom: 32 },
  cabeca: { margin: '8px 0 20px' },
  titulo: { fontSize: 24, fontWeight: 800, color: 'var(--bx-text)', margin: 0 },
  sub: { fontSize: 14, color: 'var(--bx-text-2)', margin: '6px 0 0', lineHeight: 1.5 },
  aviso: { fontSize: 14, color: 'var(--bx-text-3)' },
  secao: { marginBottom: 24 },
  secaoTitulo: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 15, fontWeight: 800, color: 'var(--bx-text)', margin: '0 0 10px',
    // Cabecalho fixo da casca tem 56px: a ancora nao pode parar debaixo dele.
    scrollMarginTop: 72,
  },
  contagem: {
    fontSize: 12, fontWeight: 700, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums',
    padding: '2px 8px', borderRadius: 999, background: 'var(--bx-surface-2)',
  },
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  cartao: {
    padding: 12, borderRadius: 14,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)',
    background: 'var(--bx-surface)',
  },
  thumb: {
    width: 56, height: 78, borderRadius: 8, overflow: 'hidden', background: 'var(--bx-surface-2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  nome: {
    display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--bx-text)', textDecoration: 'none',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  valores: { display: 'flex', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginTop: 4, fontSize: 13 },
  rotulo: { color: 'var(--bx-text-3)' },
  valor: { color: 'var(--bx-text)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  estado: {
    display: 'flex', alignItems: 'center', gap: 5, margin: '6px 0 0',
    fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
  },
  cta: {
    minHeight: 44, width: '100%', padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', textDecoration: 'none', whiteSpace: 'nowrap',
  },
  ghost: {
    minHeight: 44, width: '100%', padding: '0 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)',
    background: 'var(--bx-surface)', color: 'var(--bx-text)', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
  },
  vazio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
    padding: '32px 16px', borderRadius: 14,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)', background: 'var(--bx-surface)',
  },
  vazioTitulo: { fontSize: 16, fontWeight: 800, color: 'var(--bx-text)', margin: '4px 0 0' },
  vazioTexto: { fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 8px', maxWidth: 360, lineHeight: 1.5 },
}
