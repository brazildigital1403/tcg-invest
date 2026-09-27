import type { CSSProperties, ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import CardItem from '@/components/ui/CardItem'
import SeloTempo from '@/components/leilao/SeloTempo'
import LeilaoAbas from '@/components/leilao/casca/LeilaoAbas'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { IconChevronRight, IconClock } from '@/components/ui/Icons'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { dataBrasiliaISO, formatarBRL, type LotePublico } from '@/lib/leilao'
import { separarLotesRodada, tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { abaValida, urlHome, urlLote, urlRodada } from '@/lib/leilao-urls'
import {
  buscarLojasPorId,
  buscarLotesDaRodada,
  buscarRodadasAoVivo,
  contarLotesPorRodada,
  listarLotesVitrine,
  listarRodadasAgendadas,
  listarRodadasEncerradas,
  type LojaDoLote,
} from './_dados'

/**
 * /leiloes — inicio do Bynx Leiloes.
 *
 * Abas por link (?aba=agenda|encerrados|como-funciona), sem estado de
 * cliente: funciona sem JS e o link pode ser compartilhado. A aba padrao
 * ("Ao vivo") mostra o destaque da rodada no ar, "Hoje mais tarde" (rodadas
 * agendadas para hoje, horario de Brasilia) e a grade "Terminando".
 */

// DECISAO DO DU: cache. Provisorio: sem cache nenhum enquanto a superficie de
// cache/ISR do leilao nao for decidida. A vitrine muda a cada lance e a cada
// lote que abre; ISR aqui serviria lote encerrado como aberto.
export const dynamic = 'force-dynamic'

// DECISAO DO DU: cache. maxDuration provisorio, mesmo teto do /anuncio: request
// travado nao segura lambda e conexao do Postgres ate os 300s da Vercel.
export const maxDuration = 20

export const metadata: Metadata = {
  title: 'Leilões ao vivo',
  description:
    'Lotes de cartas Pokémon em leilão ao vivo, com lance em reais e pagamento protegido pela Bynx.',
  alternates: { canonical: urlHome() },
}

// ─── Horario de Brasilia ────────────────────────────────────────────────────

const FMT_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})
const FMT_DIA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit',
})

/** "19h" / "19h30" em Brasilia. */
function horaCurta(iso: string | null): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  const p: Record<string, string> = {}
  for (const part of FMT_HORA.formatToParts(d)) p[part.type] = part.value
  const h = String(Number(p.hour === '24' ? '0' : p.hour))
  return p.minute === '00' ? `${h}h` : `${h}h${p.minute}`
}

/** "Hoje" / "Amanhã" / "sáb., 04/10" em Brasilia. */
function diaCurto(iso: string | null, hojeISO: string, amanhaISO: string): string {
  if (!iso) return ''
  const dia = dataBrasiliaISO(iso)
  if (dia === hojeISO) return 'Hoje'
  if (dia === amanhaISO) return 'Amanhã'
  return FMT_DIA.format(new Date(iso))
}

function precoDoLote(l: LotePublico): number {
  return l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
}

function nomeLoja(loja: LojaDoLote | undefined | null): string | null {
  return loja ? loja.nome ?? loja.slug : null
}

// ─── Pagina ─────────────────────────────────────────────────────────────────

export default async function LeiloesPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>
}) {
  if (!LEILAO_ATIVO) notFound()

  const { aba: abaParam } = await searchParams
  const aba = abaValida(abaParam)

  let conteudo: ReactNode
  if (aba === 'agenda') conteudo = await abaAgenda()
  else if (aba === 'encerrados') conteudo = await abaEncerrados()
  else if (aba === 'como-funciona') conteudo = <AbaComoFunciona />
  else conteudo = await abaAoVivo()

  return (
    <div style={S.wrap}>
      <style>{`
        .lh-card, .lh-linha { transition: background 0.15s ease, border-color 0.15s ease; }
        .lh-linha:hover { background: var(--bx-surface-2); }
        .lh-lote { display: block; text-decoration: none; color: inherit; border-radius: 18px; transition: transform 0.15s ease; }
        .lh-lote:hover { transform: translateY(-2px); }
        .lh-lote:focus-visible, .lh-linha:focus-visible, .lh-cta:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .lh-cta { transition: filter 0.15s ease; }
        .lh-cta:hover { filter: brightness(1.08); }
        .lh-grid { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (min-width: 640px) { .lh-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; } }
        .lh-destaque { display: grid; grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 769px) { .lh-destaque { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .lh-destaque-foto { height: 100% !important; min-height: 240px; } }
        .lh-ponto { animation: lh-pulsa 1.2s ease-in-out infinite; }
        @keyframes lh-pulsa { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @media (prefers-reduced-motion: reduce) {
          .lh-lote, .lh-lote:hover { transition: none; transform: none; }
          .lh-ponto { animation: none; }
        }
      `}</style>
      <h1 style={S.sr}>Bynx Leilões</h1>
      <LeilaoAbas ativa={aba} />
      {conteudo}
    </div>
  )
}

// ─── Aba: Ao vivo ───────────────────────────────────────────────────────────

async function abaAoVivo() {
  const agora = Date.now()
  const hojeISO = dataBrasiliaISO(agora)
  const [noAr, agendadas, lotes] = await Promise.all([
    buscarRodadasAoVivo(),
    listarRodadasAgendadas(20),
    listarLotesVitrine('terminando'),
  ])
  const hoje = agendadas.filter(r => r.iniciaEm && dataBrasiliaISO(r.iniciaEm) === hojeISO)
  const destaque = noAr[0] ?? null
  const outrasNoAr = noAr.slice(1)

  const [lotesDestaque, lojas, contagem] = await Promise.all([
    destaque ? buscarLotesDaRodada(destaque.id) : Promise.resolve([] as LotePublico[]),
    buscarLojasPorId([...noAr, ...hoje].map(r => r.lojaId ?? '')),
    contarLotesPorRodada([...outrasNoAr, ...hoje].map(r => r.id)),
  ])
  const renderizadoEm = new Date(agora).toISOString()

  if (!destaque && hoje.length === 0 && lotes.length === 0) {
    return (
      <div style={S.vazio}>
        <span style={S.vazioIcone}><IconClock size={22} /></span>
        <p style={S.vazioTitulo}>Nenhum leilão aberto agora</p>
        <p style={S.vazioTexto}>
          Quando uma loja abrir uma rodada ao vivo, ela aparece aqui. As próximas rodadas ficam na Agenda; enquanto
          isso, as cartas à venda com preço fixo estão no Mercado.
        </p>
        <div style={S.vazioAcoes}>
          <Link href={urlHome('agenda')} prefetch={false} className="lh-cta" style={S.ctaSec}>Ver a agenda</Link>
          <Link href="/marketplace" prefetch={false} className="lh-cta" style={S.cta}>Ir para o Mercado</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={S.coluna}>
      {destaque && (
        <Destaque
          rodada={destaque}
          loja={lojas.get(destaque.lojaId ?? '') ?? null}
          lotes={lotesDestaque}
          renderizadoEm={renderizadoEm}
        />
      )}

      {outrasNoAr.length > 0 && (
        <section aria-labelledby="lh-tambem" style={S.secao}>
          <h2 id="lh-tambem" style={S.rot}>Também ao vivo</h2>
          <ListaRodadas
            rodadas={outrasNoAr}
            lojas={lojas}
            contagem={contagem}
            quando={() => 'Agora'}
          />
        </section>
      )}

      {hoje.length > 0 && (
        <section aria-labelledby="lh-hoje" style={S.secao}>
          <h2 id="lh-hoje" style={S.rot}>Hoje mais tarde</h2>
          <ListaRodadas rodadas={hoje} lojas={lojas} contagem={contagem} quando={r => horaCurta(r.iniciaEm)} />
        </section>
      )}

      {lotes.length > 0 && (
        <section aria-labelledby="lh-terminando" style={S.secao}>
          <h2 id="lh-terminando" style={S.rot}>Terminando</h2>
          <div className="lh-grid">
            {lotes.map(l => (
              <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="lh-lote">
                <CardItem
                  card={cardDoLote(l)}
                  mode="readonly"
                  hidePriceTable
                  ocultarSemPreco
                  badge={<span style={S.badgePreco}>{formatarBRL(precoDoLote(l))}</span>}
                  footerSlot={
                    <div style={S.rodape}>
                      <SeloTempo lote={l} renderizadoEm={renderizadoEm} />
                      <span style={S.lances}>
                        {l.nLances === 0 ? 'Sem lance' : l.nLances === 1 ? '1 lance' : `${l.nLances} lances`}
                      </span>
                    </div>
                  }
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

/** Cartao da rodada no ar: foto do lote no ar, preco, tempo e "Entrar na rodada". */
function Destaque({
  rodada,
  loja,
  lotes,
  renderizadoEm,
}: {
  rodada: RodadaPublica
  loja: LojaDoLote | null
  lotes: LotePublico[]
  renderizadoEm: string
}) {
  const { ativo } = separarLotesRodada(lotes)
  const visiveis = lotes.filter(l => l.status !== 'cancelado')
  const pos = ativo ? visiveis.findIndex(l => l.id === ativo.id) + 1 : 0
  const foto = ativo ? ativo.fotos[0] || ativo.cardImage : visiveis.find(l => l.cardImage)?.cardImage ?? null
  const url = urlRodada(rodada.numero)
  return (
    <article className="lh-destaque" style={S.destaque}>
      <Link href={url} prefetch={false} className="lh-destaque-foto" style={S.destaqueFoto} aria-label={`Entrar na rodada ${rodada.numero}`}>
        {foto ? (
          <Image src={foto} alt="" width={245} height={342} priority sizes="(max-width: 768px) 40vw, 180px" style={S.destaqueImg} />
        ) : null}
        <span style={S.seloVivo}>
          <span className="lh-ponto" aria-hidden style={S.ponto} />
          AO VIVO
        </span>
      </Link>
      <div style={S.destaqueInfo}>
        <p style={S.destaqueLoja}>
          {nomeLoja(loja) ?? 'Rodada ao vivo'}
          <span style={S.fraco}> · Rodada {rodada.numero}{rodada.titulo ? ` · ${tituloRodada(rodada)}` : ''}</span>
        </p>
        {ativo ? (
          <div style={S.linha3}>
            <span style={S.precoM}>{formatarBRL(precoDoLote(ativo))}</span>
            <SeloTempo lote={ativo} renderizadoEm={renderizadoEm} />
            <span style={S.fracoNum}>Lote {pos} de {visiveis.length}</span>
          </div>
        ) : (
          <p style={S.fracoP}>Próximo lote em instantes.</p>
        )}
        {ativo && <p style={S.destaqueNome}>{ativo.cardName}</p>}
        <Link href={url} prefetch={false} className="lh-cta" style={S.cta}>Entrar na rodada</Link>
      </div>
    </article>
  )
}

/** Lista de rodadas em linhas: hora, loja, lotes e seta. Toda a linha e o link. */
function ListaRodadas({
  rodadas,
  lojas,
  contagem,
  quando,
}: {
  rodadas: RodadaPublica[]
  lojas: Map<string, LojaDoLote>
  contagem: Map<string, number>
  quando: (r: RodadaPublica) => string
}) {
  return (
    <ul style={S.lista}>
      {rodadas.map((r, i) => {
        const loja = lojas.get(r.lojaId ?? '') ?? null
        const nome = nomeLoja(loja)
        const n = contagem.get(r.id)
        return (
          <li key={r.id} style={i > 0 ? S.itemBorda : undefined}>
            <Link href={urlRodada(r.numero)} prefetch={false} className="lh-linha" style={S.linhaRodada}>
              <span style={S.hora}>{quando(r)}</span>
              {loja?.logoUrl ? (
                <Image src={loja.logoUrl} alt="" width={26} height={26} sizes="26px" style={S.lojaMini} />
              ) : (
                <span style={{ ...S.lojaMini, ...S.lojaMiniVazia }}>{(nome ?? 'B').charAt(0).toUpperCase()}</span>
              )}
              <span style={S.linhaTexto}>
                <span style={S.linhaForte}>{nome ?? tituloRodada(r)}</span>
                {n != null ? ` · ${n === 1 ? '1 lote' : `${n} lotes`}` : ''}
                {nome && r.titulo ? <span style={S.linhaSub}>{tituloRodada(r)}</span> : null}
              </span>
              <IconChevronRight size={16} color="var(--bx-text-3)" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Aba: Agenda ────────────────────────────────────────────────────────────

async function abaAgenda() {
  const agora = Date.now()
  const hojeISO = dataBrasiliaISO(agora)
  const amanhaISO = dataBrasiliaISO(agora + 24 * 60 * 60 * 1000)
  const rodadas = await listarRodadasAgendadas(40)
  if (!rodadas.length) {
    return <Vazio titulo="Nenhuma rodada agendada" texto="Quando uma loja agendar uma rodada ao vivo, ela aparece aqui com o dia e o horário." />
  }
  const [lojas, contagem] = await Promise.all([
    buscarLojasPorId(rodadas.map(r => r.lojaId ?? '')),
    contarLotesPorRodada(rodadas.map(r => r.id)),
  ])
  // Agrupa por dia (Brasilia), na ordem do horario.
  const grupos: Array<{ dia: string; rodadas: RodadaPublica[] }> = []
  for (const r of rodadas) {
    const dia = diaCurto(r.iniciaEm, hojeISO, amanhaISO) || 'Sem horário'
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.rodadas.push(r)
    else grupos.push({ dia, rodadas: [r] })
  }
  return (
    <div style={S.coluna}>
      {grupos.map(g => (
        <section key={g.dia} aria-label={g.dia} style={S.secao}>
          <h2 style={S.rot}>{g.dia}</h2>
          <ListaRodadas rodadas={g.rodadas} lojas={lojas} contagem={contagem} quando={r => horaCurta(r.iniciaEm)} />
        </section>
      ))}
      <p style={S.nota}>Horários de Brasília.</p>
    </div>
  )
}

// ─── Aba: Encerrados ────────────────────────────────────────────────────────

async function abaEncerrados() {
  const agora = Date.now()
  const hojeISO = dataBrasiliaISO(agora)
  const ontemISO = dataBrasiliaISO(agora - 24 * 60 * 60 * 1000)
  const rodadas = await listarRodadasEncerradas(20)
  if (!rodadas.length) {
    return <Vazio titulo="Nenhuma rodada encerrada ainda" texto="O resultado de cada rodada ao vivo fica aqui depois que ela termina." />
  }
  const [lojas, contagem] = await Promise.all([
    buscarLojasPorId(rodadas.map(r => r.lojaId ?? '')),
    contarLotesPorRodada(rodadas.map(r => r.id)),
  ])
  const quando = (r: RodadaPublica) => {
    if (!r.iniciaEm) return '--'
    const dia = dataBrasiliaISO(r.iniciaEm)
    if (dia === hojeISO) return 'Hoje'
    if (dia === ontemISO) return 'Ontem'
    return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
  }
  return (
    <section aria-label="Rodadas encerradas" style={S.secao}>
      <ListaRodadas rodadas={rodadas} lojas={lojas} contagem={contagem} quando={quando} />
    </section>
  )
}

// ─── Aba: Como funciona ─────────────────────────────────────────────────────

const PASSOS: ReadonlyArray<{ titulo: string; texto: string }> = [
  {
    titulo: 'A loja abre uma rodada ao vivo',
    texto: 'Cada lote entra no ar na ordem da live, com o relógio correndo. Você acompanha a transmissão e o lance na mesma tela.',
  },
  {
    titulo: 'Todo lance é automático',
    texto: 'Você informa o máximo que aceita pagar e paga só o necessário para vencer. Ninguém vê o seu máximo. Lance nos últimos segundos prorroga o fim do lote.',
  },
  {
    titulo: 'Arrematou, paga pela Bynx',
    texto: 'O pagamento é no cartão, dentro do prazo, e você confere a taxa de proteção e o frete antes de confirmar. Sem o pagamento no prazo, o arremate é cancelado.',
  },
  {
    titulo: 'Pagamento protegido',
    texto: 'Os dados do cartão não passam pela Bynx e a taxa de proteção cobre a intermediação até a entrega.',
  },
]

function AbaComoFunciona() {
  return (
    <div style={S.coluna}>
      <ol style={S.passos}>
        {PASSOS.map((p, i) => (
          <li key={p.titulo} style={S.passo}>
            <span style={S.passoNum}>{i + 1}</span>
            <span>
              <strong style={S.passoTitulo}>{p.titulo}</strong>
              <span style={S.passoTexto}>{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      <div style={S.vazioAcoes}>
        <Link href={urlHome()} prefetch={false} className="lh-cta" style={S.cta}>Ver o que está ao vivo</Link>
        <Link href="/para-lojistas" prefetch={false} className="lh-cta" style={S.ctaSec}>Sou lojista</Link>
      </div>
    </div>
  )
}

function Vazio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={S.vazio}>
      <span style={S.vazioIcone}><IconClock size={22} /></span>
      <p style={S.vazioTitulo}>{titulo}</p>
      <p style={S.vazioTexto}>{texto}</p>
      <Link href={urlHome()} prefetch={false} className="lh-cta" style={S.ctaSec}>Voltar ao início</Link>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  wrap: { maxWidth: 1200, margin: '0 auto' },
  sr: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', margin: 0 },
  coluna: { display: 'flex', flexDirection: 'column', gap: 20 },
  secao: { display: 'flex', flexDirection: 'column', gap: 10 },
  rot: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: 0,
  },
  destaque: { borderRadius: 16, overflow: 'hidden', border: '1px solid var(--bx-border)', background: 'var(--bx-surface)' },
  destaqueFoto: {
    position: 'relative', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(120% 90% at 30% 20%, rgba(var(--ac-1-rgb), 0.14), transparent 60%), var(--bx-bg-elev)',
  },
  destaqueImg: { height: 166, width: 'auto', borderRadius: 8, boxShadow: 'var(--bx-shadow)' },
  seloVivo: {
    position: 'absolute', top: 10, right: 10, display: 'inline-flex', alignItems: 'center', gap: 6, height: 26,
    padding: '0 10px', borderRadius: 999, border: '1px solid var(--ac-2)', color: 'var(--ac-2)', background: 'var(--bx-scrim)',
    fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
  },
  ponto: { width: 7, height: 7, borderRadius: 999, background: 'var(--ac-2)' },
  destaqueInfo: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', minWidth: 0 },
  destaqueLoja: { fontSize: 14, fontWeight: 700, color: 'var(--bx-text)', margin: 0, overflowWrap: 'anywhere' },
  destaqueNome: { fontSize: 13, color: 'var(--bx-text-2)', margin: 0, overflowWrap: 'anywhere' },
  fraco: { fontWeight: 500, color: 'var(--bx-text-3)' },
  fracoP: { fontSize: 13, color: 'var(--bx-text-3)', margin: 0 },
  fracoNum: { fontSize: 12.5, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  linha3: { display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' },
  precoM: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums' },
  cta: {
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px', borderRadius: 12,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontWeight: 800, fontSize: 14, textDecoration: 'none',
  },
  ctaSec: {
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px', borderRadius: 12,
    border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)', fontWeight: 700, fontSize: 14, textDecoration: 'none',
  },
  lista: { listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--bx-border)', borderRadius: 12, overflow: 'hidden' },
  itemBorda: { borderTop: '1px solid var(--bx-border)' },
  linhaRodada: {
    display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 12px', fontSize: 13,
    color: 'var(--bx-text-2)', textDecoration: 'none',
  },
  hora: { fontWeight: 800, minWidth: 44, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 },
  lojaMini: { width: 26, height: 26, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  lojaMiniVazia: {
    display: 'grid', placeItems: 'center', background: 'var(--bx-surface-3)', color: 'var(--bx-text)', fontSize: 11, fontWeight: 800,
  },
  linhaTexto: { flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
  linhaForte: { color: 'var(--bx-text)', fontWeight: 600 },
  linhaSub: { display: 'block', fontSize: 12, color: 'var(--bx-text-3)' },
  badgePreco: {
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border-2)', borderRadius: 8,
    padding: '4px 8px', fontSize: 12, fontWeight: 800, color: 'var(--bx-text)',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
  rodape: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  lances: { fontSize: 11, color: 'var(--bx-text-3)', fontWeight: 600, whiteSpace: 'nowrap' },
  nota: { fontSize: 12, color: 'var(--bx-text-3)', margin: 0 },
  passos: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 },
  passo: {
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
  },
  passoNum: {
    width: 28, height: 28, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center',
    background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)', fontWeight: 800, fontSize: 13,
  },
  passoTitulo: { display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--bx-text)', marginBottom: 2 },
  passoTexto: { display: 'block', fontSize: 13.5, color: 'var(--bx-text-2)', lineHeight: 1.5 },
  vazio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
    padding: '40px 16px', borderRadius: 16, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
  },
  vazioIcone: {
    width: 48, height: 48, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)',
  },
  vazioTitulo: { fontSize: 16, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  vazioTexto: { fontSize: 14, color: 'var(--bx-text-2)', margin: 0, maxWidth: 420, lineHeight: 1.5 },
  vazioAcoes: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
}
