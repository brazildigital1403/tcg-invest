'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLojaOwner, LojaEstadoFallback, SH, LOJA_HOME, TrilhaLoja } from '../_shared'
import { IconCalendar, IconChevronDown, IconChevronRight, IconClock, IconPlus, IconTruck, IconWarning } from '@/components/ui/Icons'
import { formatarBRL, horarioBrasilia } from '@/lib/leilao'
import NovoLote, { type LoteInicial } from './[rodadaId]/NovoLote'
import { STATUS_RODADA, chamarPainel, type RodadaResumo } from './_rodada'

/**
 * Lista das rodadas ao vivo da loja, agrupadas por status. "Nova rodada" cria
 * um rascunho e abre o editor.
 */

const GRUPOS: Array<{ status: string; titulo: string }> = [
  { status: 'ao_vivo', titulo: 'Ao vivo' },
  { status: 'agendada', titulo: 'Agendadas' },
  { status: 'rascunho', titulo: 'Rascunhos' },
  { status: 'encerrada', titulo: 'Encerradas' },
  { status: 'cancelada', titulo: 'Canceladas' },
]

interface LotePrazo {
  id: string; slug: string; card_name: string; status: string; n_lances: number
  preco_atual_cents: number | null; lance_inicial_cents: number; termina_em: string | null
  card_id: string | null; card_numero: string | null; set_nome: string | null; card_image: string | null
  fotos: string[]; condicao: string | null; idioma: string | null; graduadora: string | null
  nota: string | number | null; descricao: string | null; duracao_seg: number | null
}
interface EnvioPendente { id: string; numero: number | null; item_nome: string | null; item_imagem: string | null; enviar_ate: string | null }
const diasDoLote = (l: LotePrazo) => Math.round((l.duracao_seg ?? 0) / 86400) || 3
const STATUS_LOTE: Record<string, string> = {
  aguardando_pagamento: 'aguardando pagamento', vendido: 'vendido', sem_lances: 'encerrado sem lances', cancelado: 'cancelado', calote: 'não pago',
}

const GRUPOS_LOTE: Array<{ titulo: string; status: string[]; recolhido?: boolean }> = [
  { titulo: 'Abertos', status: ['ativo'] },
  { titulo: 'Esperando o comprador pagar', status: ['aguardando_pagamento'] },
  { titulo: 'Terminaram sem lance', status: ['sem_lances'] },
  { titulo: 'Vendidos e cancelados', status: ['vendido', 'cancelado', 'calote'], recolhido: true },
]

export default function ListaRodadas({ lojaId }: { lojaId: string }) {
  const router = useRouter()
  const { estado, loja } = useLojaOwner(lojaId)
  const [rodadas, setRodadas] = useState<RodadaResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [lotes, setLotes] = useState<LotePrazo[]>([])
  const [novoLeilao, setNovoLeilao] = useState(false)
  const [inicial, setInicial] = useState<LoteInicial | null>(null)
  const [republicando, setRepublicando] = useState<string | null>(null)
  const [enderecoOk, setEnderecoOk] = useState(true)
  const [recebimento, setRecebimento] = useState<{ podeReceber: boolean; motivo: string | null } | null>(null)
  const [envios, setEnvios] = useState<EnvioPendente[]>([])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [j, p] = await Promise.all([
        chamarPainel<{ rodadas: RodadaResumo[] }>(`/api/lojas/${lojaId}/leiloes`),
        chamarPainel<{ lotes: LotePrazo[]; enderecoOk: boolean; recebimento: { podeReceber: boolean; motivo: string | null }; envios: EnvioPendente[] | null }>(`/api/lojas/${lojaId}/leiloes/lotes`),
      ])
      setRodadas(j.rodadas || [])
      setLotes(p.lotes || [])
      setEnderecoOk(p.enderecoOk)
      setRecebimento(p.recebimento)
      setEnvios(p.envios ?? [])
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  async function cancelarLote(id: string) {
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/lotes?lote_id=${id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Mesma carta fisica e mesmas fotos, que continuam sem lote vivo: o servidor
  // recusa se a foto ja estiver em outro leilao, entao clique duplo nao duplica.
  async function publicarDeNovo(l: LotePrazo) {
    if (republicando) return
    setRepublicando(l.id)
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/lotes`, {
        method: 'POST',
        body: JSON.stringify({
          card_id: l.card_id, fotos: l.fotos, condicao: l.condicao, idioma: l.idioma, graduadora: l.graduadora,
          nota: l.nota, descricao: l.descricao, lance_inicial_cents: l.lance_inicial_cents, dias: diasDoLote(l),
        }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setRepublicando(null)
    }
  }

  function outraIgual(l: LotePrazo) {
    if (!l.card_id) return
    setInicial({ ...l, card_id: l.card_id, dias: diasDoLote(l) })
    setNovoLeilao(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function novaRodada() {
    setCriando(true)
    setErro(null)
    try {
      const j = await chamarPainel<{ rodada: RodadaResumo }>(`/api/lojas/${lojaId}/leiloes`, {
        method: 'POST',
        body: JSON.stringify({ titulo: 'Rodada ao vivo' }),
      })
      router.push(`/minha-loja/${lojaId}/leiloes/${j.rodada.id}`)
    } catch (e) {
      setErro((e as Error).message)
      setCriando(false)
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const pendencia = recebimento && !recebimento.podeReceber
    ? recebimento.motivo
    : !enderecoOk ? 'Falta o endereço para devoluções. Ele não aparece na sua página.' : null

  const base = `/minha-loja/${lojaId}/leiloes`
  const linhaLote = (l: LotePrazo) => {
    const aberto = l.status === 'ativo'
    const preco = l.preco_atual_cents ?? l.lance_inicial_cents
    const imagem = l.fotos?.[0] || l.card_image
    return (
      <div key={l.id} style={{ ...S.item, flexWrap: 'wrap' }}>
        <Link href={`/leiloes/${l.slug}`} prefetch={false} style={S.loteLink}>
          {imagem && <Image src={imagem} alt="" width={84} height={117} sizes="42px" style={S.vezImg} />}
          <span style={{ minWidth: 0 }}>
            <b style={{ display: 'block' }}>{l.card_name}</b>
            <span style={{ fontSize: 12.5, color: 'var(--bx-text-2)' }}>
              {formatarBRL(preco)} · {l.n_lances === 1 ? '1 lance' : `${l.n_lances} lances`} · {aberto && l.termina_em ? `termina em ${horarioBrasilia(l.termina_em)}` : (STATUS_LOTE[l.status] ?? l.status)}
            </span>
          </span>
        </Link>
        {aberto && l.n_lances === 0 && (
          <button onClick={() => cancelarLote(l.id)} style={S.btnLeve}>Cancelar</button>
        )}
        {!aberto && l.card_id && (l.status === 'sem_lances' || l.status === 'cancelado') && (
          <button onClick={() => publicarDeNovo(l)} disabled={!!pendencia || !!republicando} style={{ ...S.btnLeve, opacity: pendencia || republicando ? 0.6 : 1 }}>
            {republicando === l.id ? 'Publicando…' : 'Publicar de novo'}
          </button>
        )}
        {l.card_id && (
          <button onClick={() => outraIgual(l)} disabled={!!pendencia} style={{ ...S.btnLeve, opacity: pendencia ? 0.6 : 1 }}>Outra carta igual</button>
        )}
      </div>
    )
  }
  const botaoNova = (
    <button onClick={novaRodada} disabled={criando} style={{ ...S.btnPrim, opacity: criando ? 0.6 : 1 }}>
      <IconPlus size={16} /> {criando ? 'Criando…' : 'Nova rodada'}
    </button>
  )

  return (
    <div style={SH.page}>
      <TrilhaLoja items={[LOJA_HOME, { name: loja.nome, href: `/minha-loja/${lojaId}` }, { name: 'Leilões', href: base }]} />
      <header style={S.head}>
        <div style={{ minWidth: 0 }}>
          <h1 style={SH.title}>Leilões</h1>
        </div>
      </header>

      {erro && <div style={S.erro} role="alert">{erro}</div>}
      {pendencia && (
        <section style={S.vez} aria-label="Sua vez">
          <span style={S.vezRot}><IconWarning size={14} /> Sua vez</span>
          <p style={S.vezTxt}>{pendencia}</p>
          <Link
            href={recebimento && !recebimento.podeReceber ? `/minha-loja/${lojaId}/pagamentos` : `/minha-loja/${lojaId}/vitrine`}
            style={S.btnPrim}
          >
            {recebimento && !recebimento.podeReceber ? 'Ativar recebimentos' : 'Cadastrar endereço'}
          </Link>
        </section>
      )}

      {envios.length > 0 && (
        <section style={S.vez} aria-label="Sua vez">
          <span style={S.vezRot}><IconTruck size={14} /> Sua vez</span>
          <div style={S.vezCarta}>
            {envios[0].item_imagem && <Image src={envios[0].item_imagem} alt="" width={84} height={117} sizes="42px" style={S.vezImg} />}
            <div style={{ minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 14 }}>{envios.length === 1 ? `Enviar ${envios[0].item_nome ?? 'a carta arrematada'}` : `${envios.length} arremates para enviar`}</b>
              {envios[0].enviar_ate && <span style={S.vezPrazo}>Postar até {horarioBrasilia(envios[0].enviar_ate)}</span>}
            </div>
          </div>
          <Link href={`/minha-loja/${lojaId}/pedidos`} style={S.btnPrim}>Ver envio</Link>
        </section>
      )}

      {!novoLeilao && (
        <button onClick={() => { setInicial(null); setNovoLeilao(true) }} disabled={!!pendencia} style={{ ...S.btnPrim, width: '100%', opacity: pendencia ? 0.6 : 1 }}>
          <IconPlus size={16} /> Colocar carta em leilão
        </button>
      )}

      {novoLeilao && (
        <NovoLote key={inicial?.card_id ?? 'novo'} lojaId={lojaId} inicial={inicial} onCancelar={() => setNovoLeilao(false)} onCriado={() => { setNovoLeilao(false); setInicial(null); carregar() }} />
      )}

      {GRUPOS_LOTE.map(g => {
        const lista = lotes.filter(l => g.status.includes(l.status))
        if (lista.length === 0) return null
        const itens = lista.map(l => linhaLote(l))
        return g.recolhido ? (
          <details key={g.titulo} className="lj-fold">
            <summary style={S.foldTit}>{g.titulo} · {lista.length}<IconChevronDown size={16} /></summary>
            <div style={S.grupo}>{itens}</div>
          </details>
        ) : (
          <section key={g.titulo} style={S.grupo}>
            <h2 style={SH.cardH3}>{g.titulo} · {lista.length}</h2>
            {itens}
          </section>
        )
      })}

      <h2 style={{ ...SH.cardH3, marginTop: 8 }}>Rodada ao vivo (opcional)</h2>
      {rodadas.length > 0 && <div>{botaoNova}</div>}

      {carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'var(--bx-text-3)' }}>Carregando…</div>
      ) : rodadas.length === 0 ? (
        <div style={{ ...SH.card, textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ color: 'var(--bx-text-3)', display: 'flex', justifyContent: 'center' }}>
            <IconClock size={34} strokeWidth={1.2} />
          </div>
          <h2 style={S.h2}>Nenhuma rodada ainda</h2>
          <p style={S.txt}>
            Crie a primeira rodada, adicione os lotes com as fotos reais de cada carta e agende o horário da sua live.
          </p>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>{botaoNova}</div>
        </div>
      ) : (
        GRUPOS.map(g => {
          const lista = rodadas.filter(r => r.status === g.status)
          if (lista.length === 0) return null
          return (
            <section key={g.status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={SH.cardH3}>{g.titulo} · {lista.length}</h2>
              {lista.map(r => {
                const st = STATUS_RODADA[r.status] ?? STATUS_RODADA.rascunho
                const n = r.lotes ?? 0
                return (
                  <Link key={r.id} href={`${base}/${r.id}`} className="lj-rodada" style={S.item}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={S.itemTit}>{r.titulo || `Rodada #${r.numero}`}</div>
                      <div style={S.itemSub}>
                        <span style={{ ...S.pill, color: st.cor, borderColor: 'var(--bx-border-2)' }}>{st.label}</span>
                        <span>{n === 1 ? '1 lote' : `${n} lotes`}</span>
                        {r.inicia_em && (
                          <span style={S.quando}><IconCalendar size={13} /> {horarioBrasilia(r.inicia_em)}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ color: 'var(--bx-text-3)', display: 'flex' }}><IconChevronRight size={18} /></span>
                  </Link>
                )
              })}
            </section>
          )
        })
      )}
      <style>{`
        .lj-rodada { transition: background 0.15s ease, border-color 0.15s ease; }
        .lj-rodada:hover { background: var(--bx-surface-2) !important; border-color: var(--bx-border-2) !important; }
        .lj-rodada:focus-visible, .lj-fold summary:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .lj-fold summary { list-style: none; cursor: pointer; }
        .lj-fold summary::-webkit-details-marker { display: none; }
        .lj-fold summary svg { transition: transform 0.15s ease; flex-shrink: 0; }
        .lj-fold[open] summary svg { transform: rotate(180deg); }
        @media (prefers-reduced-motion: reduce) { .lj-fold summary svg { transition: none; } }
      `}</style>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  head: { display: 'flex', gap: 12, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 4 },
  grupo: { display: 'flex', flexDirection: 'column', gap: 8 },
  foldTit: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, fontSize: 14, fontWeight: 700, color: 'var(--bx-text)' },
  vez: {
    display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14,
    border: '1px solid rgba(var(--ac-1-rgb), 0.4)', background: 'rgba(var(--ac-1-rgb), 0.08)',
  },
  vezRot: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ac-1)' },
  vezTxt: { margin: 0, fontSize: 14, color: 'var(--bx-text)', lineHeight: 1.45 },
  vezCarta: { display: 'flex', alignItems: 'center', gap: 10, color: 'var(--bx-text)' },
  vezImg: { width: 42, height: 'auto', borderRadius: 4, flexShrink: 0 },
  vezPrazo: { fontSize: 12.5, color: 'var(--bx-text-2)' },
  loteLink: { flex: '1 1 180px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'inherit', textDecoration: 'none' },
  btnPrim: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box',
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700,
    border: 0, cursor: 'pointer', textDecoration: 'none',
  },
  btnLeve: { flex: 'none', minHeight: 44, padding: '0 12px', borderRadius: 10, border: '1px solid var(--bx-border-2)', background: 'transparent', color: 'var(--bx-text)', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer' },
  item: {
    display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, boxSizing: 'border-box', padding: '12px 14px',
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 12,
    color: 'var(--bx-text)', textDecoration: 'none',
  },
  itemTit: { fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemSub: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 5, fontSize: 12.5, color: 'var(--bx-text-3)' },
  pill: { fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, border: '1px solid', background: 'var(--bx-surface-2)' },
  quando: { display: 'inline-flex', alignItems: 'center', gap: 4 },
  h2: { fontSize: 16, fontWeight: 800, margin: '10px 0 6px', color: 'var(--bx-text)' },
  txt: { fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },
  erro: {
    background: 'color-mix(in srgb, var(--bx-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-red) 25%, transparent)', color: 'var(--bx-red)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
  },
}
