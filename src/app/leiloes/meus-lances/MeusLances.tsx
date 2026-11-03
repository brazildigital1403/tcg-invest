'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { IconClock, IconHistory, IconPokeball } from '@/components/ui/Icons'
import { AbasFiltro, Acoes, Botao, Esqueleto, Linhas, Resumo, Resumos, Selo, TelaEstado, Titulo } from '@/components/leilao/kit'
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
  const [aba, setAba] = useState<string | null>(null)
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

  // Ancora (#ml-a_pagar, vinda de "Arremates a pagar"): abre a aba do grupo.
  useEffect(() => {
    const m = decodeURIComponent(window.location.hash.slice(1)).match(/^ml-(.+)$/)
    if (m) setAba(m[1])
  }, [])

  // Relogio da tela (1s), acertado pelo servidor.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now() + deslocamento.current), 1000)
    return () => clearInterval(t)
  }, [])

  // O servidor ja manda primeiro o que pede acao: sem escolha, abre esse grupo.
  const grupoAtual = estado.tipo === 'pronto' && estado.dados.grupos.length > 0
    ? estado.dados.grupos.find(g => g.grupo === aba) ?? estado.dados.grupos[0]
    : null

  return (
    <div className="ml">
      <style>{`
        .ml { max-width: 760px; margin: 0 auto; padding-bottom: 32px; display: flex; flex-direction: column; gap: 18px; }
        .ml-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 720px) { .ml-lista { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .ml-cartao .lk-resumos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ml-topo { display: flex; gap: 14px; align-items: center; min-width: 0; }
        .ml-foto { flex: 0 0 80px; display: grid; place-items: center; min-height: 110px; border-radius: 8px; overflow: hidden; background: var(--bx-surface-2); }
        .ml-foto img { display: block; width: 100%; height: auto; }
        .ml-info { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .ml-nome { font-size: 17px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2; color: var(--bx-text); text-decoration: none; overflow-wrap: anywhere; }
        .ml-tempo { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--bx-text-2); }
        .ml-tempo-u { color: var(--bx-red); }
        .ml-aviso { margin: 0; font-size: 14px; color: var(--bx-text-3); }
      `}</style>

      <Titulo rotulo="Sua disputa" titulo="Meus lances" />

      {estado.tipo === 'carregando' && <Linhas><Esqueleto /><Esqueleto /></Linhas>}

      {estado.tipo === 'deslogado' && (
        <Vazio
          titulo="Entre para ver seus lances"
          texto="Aqui ficam os lotes em que você está liderando, os que alguém cobriu e os arremates a pagar."
          acao={
            <Botao cheio onClick={() => openLogin({ next: URL_PAGINA })}>Entrar</Botao>
          }
        />
      )}

      {estado.tipo === 'erro' && (
        <Vazio
          titulo="Não foi possível carregar"
          texto="Tente de novo em instantes."
          acao={
            <Botao tipo="sec" cheio onClick={() => carregar()}>Tentar de novo</Botao>
          }
        />
      )}

      {estado.tipo === 'pronto' && estado.dados.grupos.length === 0 && (
        <Vazio
          titulo="Você ainda não deu lance"
          texto="Quando der lance em um lote, ele aparece aqui com o preço atual e o seu máximo."
          acao={
            <Botao cheio href={URL_VITRINE}>Ver leilões</Botao>
          }
        />
      )}

      {estado.tipo === 'pronto' && grupoAtual && (
        <>
          <AbasFiltro
            rotulo="Filtrar meus lances"
            ativa={grupoAtual.grupo as string}
            aoEscolher={setAba}
            itens={estado.dados.grupos.map(g => ({ chave: g.grupo as string, rotulo: g.titulo, n: g.itens.length }))}
          />
          <ul className="ml-lista">
            {grupoAtual.itens.map(it => (
              <li key={it.lote.id}>
                <Cartao item={it} agora={agora} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao: ReactNode }) {
  return <TelaEstado tom="acento" icone={<IconHistory size={36} />} titulo={titulo} texto={texto} acoes={<Acoes>{acao}</Acoes>} />
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
    return <Botao cheio href={urlLote(l.slug)}>Cobrir</Botao>
  }
  if (it.pagamento?.estado === 'aguardando') {
    const ate = diaHora(it.pagamento.pagarAte)
    return (
      <div className="bx-ctx-comprador">
        <Botao cheio href={urlPagar(l.slug)}>{ate ? `Pagar até ${ate}` : 'Pagar'}</Botao>
      </div>
    )
  }
  if (it.pagamento?.estado === 'pago' && it.pagamento.pedidoId) {
    return <Botao tipo="sec" cheio href={urlPedido(it.pagamento.pedidoId)}>Ver pedido</Botao>
  }
  return <Botao tipo="sec" cheio href={urlLote(l.slug)}>Ver lote</Botao>
}

function seloDoItem(it: ItemMeu, tom: 'normal' | 'urgente' | 'apagado' | 'alerta') {
  if (it.grupo === 'liderando') return <Selo tom="frente">Na frente</Selo>
  if (it.grupo === 'superado') return <Selo tom="atencao">Superado</Selo>
  if (it.pagamento?.estado === 'aguardando') return <Selo tom="atencao">A pagar</Selo>
  if (it.pagamento?.estado === 'pago') return <Selo tom="frente">Pago</Selo>
  if (tom === 'urgente') return <Selo tom="perigo">Prazo vencido</Selo>
  return <Selo tom="neutro">Encerrado</Selo>
}

function Cartao({ item: it, agora }: { item: ItemMeu; agora: number }) {
  const l = it.lote
  const img = l.fotos[0] || l.cardImage
  const nome = [l.cardName, l.cardNumero, rotuloGraduacao(l)].filter(Boolean).join(' ')
  const preco = l.precoAtualCents ?? l.lanceInicialCents
  const linha = linhaDeEstado(it, agora)
  const aberto = it.grupo === 'liderando' || it.grupo === 'superado'

  return (
    <article className="lk-card ml-cartao">
      <div className="ml-topo">
        <Link href={urlLote(l.slug)} className="ml-foto" aria-label={nome}>
          {img ? <Image src={img} alt="" width={160} height={223} sizes="80px" /> : <IconPokeball size={22} color="var(--bx-text-3)" />}
        </Link>
        <div className="ml-info">
          {seloDoItem(it, linha.tom)}
          <Link href={urlLote(l.slug)} className="ml-nome">{nome}</Link>
          {aberto && linha.tom !== 'apagado' && (
            <span className={`ml-tempo${linha.tom === 'urgente' ? ' ml-tempo-u' : ''}`}><IconClock size={13} />{linha.texto.replace('Termina em ', '')}</span>
          )}
        </div>
      </div>
      <Resumos>
        <Resumo rotulo={aberto ? 'Lance atual' : 'Valor final'} valor={formatarBRL(preco)} />
        <Resumo rotulo="Seu máximo" valor={formatarBRL(it.seuMaximoCents)} />
      </Resumos>
      <Acao it={it} />
    </article>
  )
}

