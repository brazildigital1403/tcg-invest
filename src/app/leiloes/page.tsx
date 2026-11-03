import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CardItem from '@/components/ui/CardItem'
import SeloTempo from '@/components/leilao/SeloTempo'
import LeilaoAbas from '@/components/leilao/casca/LeilaoAbas'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { CSS_VITRINE } from '@/components/leilao/vitrine/estilos'
import BotaoAvisoLeilao from '@/components/leilao/vitrine/BotaoAvisoLeilao'
import { HeroSemRodada, PalcoAoVivo, PalcoProxima } from '@/components/leilao/vitrine/Palco'
import CardHoje from '@/components/leilao/vitrine/CardHoje'
import FaixaGarantia from '@/components/leilao/vitrine/FaixaGarantia'
import LinhaAgenda from '@/components/leilao/vitrine/LinhaAgenda'
import LinhaResultado from '@/components/leilao/vitrine/LinhaResultado'
import LoteDestaque from '@/components/leilao/vitrine/LoteDestaque'
import PassosCurtos from '@/components/leilao/vitrine/PassosCurtos'
import SelosGarantia from '@/components/leilao/vitrine/SelosGarantia'
import Arrematados from '@/components/leilao/vitrine/Arrematados'
import AgendaSemana from '@/components/leilao/vitrine/AgendaSemana'
import LojasDoLeilao from '@/components/leilao/vitrine/LojasDoLeilao'
import { ComoFunciona, PerguntasFrequentes } from '@/components/leilao/vitrine/ComoFunciona'
import BlocoLojista from '@/components/leilao/vitrine/BlocoLojista'
import ListaRodadas from '@/components/leilao/vitrine/ListaRodadas'
import { IconClock } from '@/components/ui/Icons'
import { LEILAO_ATIVO } from '@/lib/leilao-flag'
import { dataBrasiliaISO, formatarBRL, type LotePublico } from '@/lib/leilao'
import type { RodadaPublica } from '@/lib/leilao-rodada'
import { abaValida, urlHome, urlLote } from '@/lib/leilao-urls'
import { agruparSemana, escolherPalcoAoVivo, quandoRodada, semanaVazia } from '@/lib/leilao-vitrine'
import {
  buscarLojasPorId,
  buscarLotesDaRodada,
  buscarRodadasAoVivo,
  contarLotesPorRodada,
  listarArrematadosRecentes,
  listarLojasDoLeilao,
  listarLotesVitrine,
  listarRodadasAgendadas,
  listarRodadasEncerradas,
  resumirLotesPorRodada,
  type ResumoRodada,
} from './_dados'

/**
 * /leiloes — inicio do Bynx Leiloes.
 *
 * Abas por link (?aba=agenda|resultados|como-funciona; o antigo
 * ?aba=encerrados cai em resultados), sem estado de cliente: funciona sem JS
 * e o link pode ser compartilhado. Canonico sempre /leiloes.
 *
 * A aba padrao e a VITRINE (mockup v2 aprovado pelo Du): palco da rodada no
 * ar (ou a proxima agendada, ou o hero sem rodada), card "Hoje", faixa de
 * garantia, arrematados, agenda da semana, lojas, como funciona, perguntas e
 * o bloco para lojas. So dado do banco; secao sem dado some.
 */

// DECISAO DO DU: cache. Provisorio: sem cache nenhum enquanto a superficie de
// cache/ISR do leilao nao for decidida. A vitrine muda a cada lance e a cada
// lote que abre; ISR aqui serviria lote encerrado como aberto.
export const dynamic = 'force-dynamic'

// DECISAO DO DU: cache. maxDuration provisorio, mesmo teto do /anuncio: request
// travado nao segura lambda e conexao do Postgres ate os 300s da Vercel.
export const maxDuration = 20

export const metadata: Metadata = {
  title: 'Leilão de cartas Pokémon, com lance em reais',
  description:
    'Lotes de cartas Pokémon em leilão, com lance em reais e Proteção Bynx na compra.',
  alternates: { canonical: urlHome() },
  // Sem isto o link herdava o preview da home, que fala da coleção.
  openGraph: {
    title: 'Leilão de cartas Pokémon, com lance em reais',
    description: 'Lojas colocam cartas em leilão, com lance em reais. Quem vence paga pela Bynx, no cartão.',
    url: `https://bynx.gg${urlHome()}`,
    type: 'website',
  },
  twitter: {
    title: 'Leilão de cartas Pokémon, com lance em reais',
    description: 'Lojas colocam cartas em leilão, com lance em reais. Quem vence paga pela Bynx, no cartão.',
  },
}

const DIA_MS = 24 * 60 * 60 * 1000

const TITULO_ABA = {
  agenda: 'Agenda de leilões de cartas Pokémon',
  resultados: 'Resultados de leilões de cartas Pokémon',
  'como-funciona': 'Como funciona o leilão de cartas Pokémon',
} as const

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
  else if (aba === 'resultados') conteudo = await abaResultados()
  else if (aba === 'como-funciona') conteudo = <AbaComoFunciona />
  else conteudo = await abaAoVivo()

  return (
    <div className="vt-wrap" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <style>{CSS_VITRINE}</style>
      <LeilaoAbas ativa={aba} />
      <div className="vt">
        {aba !== 'ao-vivo' && <h1 className="vt-sr">{TITULO_ABA[aba]}</h1>}
        {conteudo}
      </div>
    </div>
  )
}

// ─── Aba: Ao vivo (vitrine) ─────────────────────────────────────────────────

async function abaAoVivo() {
  const agora = Date.now()
  const hojeISO = dataBrasiliaISO(agora)
  const renderizadoEm = new Date(agora).toISOString()

  const [noAr, agendadas, lotesAbertos, arrematados, lojasLeilao] = await Promise.all([
    buscarRodadasAoVivo(),
    listarRodadasAgendadas(60),
    listarLotesVitrine('terminando'),
    listarArrematadosRecentes(6),
    listarLojasDoLeilao(),
  ])

  // Sem rodada no ar, o palco mostra a proxima agendada (a primeira pelo horario).
  const proxima = noAr.length ? null : agendadas[0] ?? null
  // O que da para comprar agora vem antes da agenda: a proxima rodada desce.
  const proximaAbaixo = !!proxima && lotesAbertos.length > 0
  const hoje = agendadas.filter(
    r => r.iniciaEm && dataBrasiliaISO(r.iniciaEm) === hojeISO && r.id !== proxima?.id
  )
  const dias = agruparSemana<RodadaPublica>([...noAr, ...agendadas], agora)
  const semana = dias.flatMap(d => d.itens)

  // O lote no ar de uma rodada ao vivo ja esta no palco: "Terminando" fica
  // com os lotes de prazo proprio.
  const rodadasNoAr = new Set(noAr.map(r => r.id))
  const lotes = lotesAbertos.filter(l => !l.rodadaId || !rodadasNoAr.has(l.rodadaId))
  const loteDestaque = noAr.length ? null : lotes[0] ?? null
  const lotesGrade = loteDestaque ? lotes.slice(1) : lotes

  const ids = [...noAr, ...hoje, ...semana, ...(proxima ? [proxima] : [])]
  const [lojas, resumo] = await Promise.all([
    buscarLojasPorId(ids.map(r => r.lojaId ?? '')),
    resumirLotesPorRodada(ids.map(r => r.id)),
  ])
  // Varias no ar: o palco fica com a mais movimentada (mais lances no lote no
  // ar; empate, a que termina primeiro). As demais vao para "Tambem ao vivo".
  const { destaque, outras: outrasNoAr } = escolherPalcoAoVivo(noAr, id => resumo.get(id)?.noAr)
  const lotesDestaque = destaque ? await buscarLotesDaRodada(destaque.id) : ([] as LotePublico[])
  const contagem = contagemDe(resumo)

  // Sem rodada, a explicacao vem antes da garantia: e o que falta a quem chegou.
  let semNada = false
  let palco: ReactNode
  let palcoProxima: ReactNode = null
  if (destaque) {
    palco = (
      <PalcoAoVivo
        rodada={destaque}
        loja={lojas.get(destaque.lojaId ?? '') ?? null}
        lotes={lotesDestaque}
        renderizadoEm={renderizadoEm}
      />
    )
  } else if (proxima) {
    palcoProxima = (
      <PalcoProxima
        rodada={proxima}
        loja={lojas.get(proxima.lojaId ?? '') ?? null}
        resumo={resumo.get(proxima.id) ?? null}
        renderizadoEm={renderizadoEm}
      />
    )
    if (!proximaAbaixo) palco = palcoProxima
  } else {
    semNada = lotes.length === 0
    palco = semNada ? <HeroSemRodada /> : null
  }

  return (
    <>
      {loteDestaque || semNada ? <h1 className="vt-sr">Leilão de cartas Pokémon</h1> : <TituloPagina />}
      <div className={hoje.length > 0 ? 'vt-dobra vt-com-hoje' : 'vt-dobra'}>
        {loteDestaque && <LoteDestaque lote={loteDestaque} renderizadoEm={renderizadoEm} />}
        {palco}
        {hoje.length > 0 && <CardHoje rodadas={hoje} lojas={lojas} resumo={resumo} renderizadoEm={renderizadoEm} />}
      </div>

      {outrasNoAr.length > 0 && (
        <section className="vt-sec" aria-labelledby="vt-tambem-t">
          <div className="vt-sec-t"><h2 id="vt-tambem-t">Também ao vivo</h2></div>
          <ListaRodadas rodadas={outrasNoAr} lojas={lojas} contagem={contagem} quando={() => 'Agora'} />
        </section>
      )}

      <SelosGarantia />
      {semNada && <PassosCurtos />}

      {lotesGrade.length > 0 && (
        <section className="vt-sec" aria-labelledby="vt-terminando-t">
          <div className="vt-sec-t">
            <h2 id="vt-terminando-t">Abertos agora{lotes.length < 48 && <span className="vt-conta">{lotes.length}</span>}</h2>
          </div>
          <div className="vt-grade vt-grade-auto">
            {lotesGrade.map(l => (
              <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="vt-lote">
                <CardItem
                  card={cardDoLote(l)}
                  mode="readonly"
                  hidePriceTable
                  ocultarSemPreco
                  badge={<span className="vt-tag">{formatarBRL(precoDoLote(l))}</span>}
                  footerSlot={
                    <div className="vt-rodape-lote">
                      <SeloTempo lote={l} renderizadoEm={renderizadoEm} />
                      <span className="vt-lances">
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

      {proximaAbaixo && palcoProxima}
      {arrematados.length > 0 && <Arrematados itens={arrematados} />}
      {!semanaVazia(dias) && <AgendaSemana dias={dias} lojas={lojas} resumo={resumo} />}
      {lojasLeilao.length > 0 && <LojasDoLeilao lojas={lojasLeilao} />}
      {!semNada && <ComoFunciona />}
      <PerguntasFrequentes />
      <BlocoLojista />
    </>
  )
}

function precoDoLote(l: LotePublico): number {
  return l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
}

function contagemDe(resumo: Map<string, ResumoRodada>): Map<string, number> {
  return new Map([...resumo].map(([id, r]) => [id, r.n]))
}

// ─── Aba: Agenda ────────────────────────────────────────────────────────────

async function abaAgenda() {
  const agora = Date.now()
  const rodadas = await listarRodadasAgendadas(40)
  if (!rodadas.length) {
    return (
      <Vazio titulo="Nenhuma rodada agendada">
        <BotaoAvisoLeilao />
        <Link href={urlHome()} prefetch={false} className="vt-cta-sec">Ver leilões abertos</Link>
      </Vazio>
    )
  }
  const [lojas, resumo] = await Promise.all([
    buscarLojasPorId(rodadas.map(r => r.lojaId ?? '')),
    resumirLotesPorRodada(rodadas.map(r => r.id)),
  ])
  // Agrupa por dia (Brasilia), na ordem do horario.
  const grupos: Array<{ dia: string; rodadas: RodadaPublica[] }> = []
  for (const r of rodadas) {
    const dia = (quandoRodada(r.iniciaEm, agora).split(',')[0] || 'Sem horário').trim()
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.rodadas.push(r)
    else grupos.push({ dia, rodadas: [r] })
  }
  return (
    <>
      {grupos.map(g => (
        <section key={g.dia} aria-label={g.dia} className="vt-sec">
          <div className="vt-sec-t"><h2>{g.dia}</h2></div>
          <div className="vt-res-lista">
            {g.rodadas.map(r => (
              <LinhaAgenda key={r.id} rodada={r} loja={lojas.get(r.lojaId ?? '') ?? null} resumo={resumo.get(r.id) ?? null} />
            ))}
          </div>
        </section>
      ))}
      <p className="vt-fraco" style={{ fontSize: 12, margin: 0 }}>Horários de Brasília.</p>
    </>
  )
}

// ─── Aba: Resultados ────────────────────────────────────────────────────────

async function abaResultados() {
  const agora = Date.now()
  const hojeISO = dataBrasiliaISO(agora)
  const ontemISO = dataBrasiliaISO(agora - DIA_MS)
  const [rodadas, arrematados] = await Promise.all([listarRodadasEncerradas(20), listarArrematadosRecentes(30)])
  if (!rodadas.length && !arrematados.length) {
    return (
      <Vazio titulo="Nenhum arremate ainda">
        <Link href={urlHome()} prefetch={false} className="vt-cta">Ver leilões abertos</Link>
      </Vazio>
    )
  }
  const [lojas, contagem] = await Promise.all([
    buscarLojasPorId([...rodadas.map(r => r.lojaId ?? ''), ...arrematados.map(a => a.lote.lojaId ?? '')]),
    contarLotesPorRodada(rodadas.map(r => r.id)),
  ])
  const nomeDia = (iso: string | null) => {
    if (!iso) return 'Antes'
    const dia = dataBrasiliaISO(iso)
    if (dia === hojeISO) return 'Hoje'
    if (dia === ontemISO) return 'Ontem'
    return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
  }
  const dias: Array<{ dia: string; lotes: LotePublico[] }> = []
  for (const { lote } of arrematados) {
    const dia = nomeDia(lote.encerradoEm)
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.lotes.push(lote)
    else dias.push({ dia, lotes: [lote] })
  }
  const quando = (r: RodadaPublica) => (r.iniciaEm ? nomeDia(r.iniciaEm) : '--')
  return (
    <>
      {dias.map(d => (
        <section key={d.dia} aria-label={d.dia} className="vt-sec">
          <div className="vt-sec-t"><h2>{d.dia}</h2></div>
          <div className="vt-res-lista">
            {d.lotes.map(l => <LinhaResultado key={l.id} lote={l} loja={lojas.get(l.lojaId ?? '') ?? null} />)}
          </div>
        </section>
      ))}
      {rodadas.length > 0 && (
        <section aria-labelledby="vt-rod-enc-t" className="vt-sec">
          <div className="vt-sec-t"><h2 id="vt-rod-enc-t">Rodadas encerradas</h2></div>
          <ListaRodadas rodadas={rodadas} lojas={lojas} contagem={contagem} quando={quando} />
        </section>
      )}
      <Link href={urlHome()} prefetch={false} className="vt-cta-sec">Ver leilões abertos</Link>
    </>
  )
}

// ─── Aba: Como funciona ─────────────────────────────────────────────────────

function AbaComoFunciona() {
  return (
    <>
      <ComoFunciona />
      <FaixaGarantia />
      <PerguntasFrequentes />
      <BlocoLojista />
    </>
  )
}

function TituloPagina() {
  return (
    <header className="vt-hero">
      <h1>Leilão de cartas Pokémon</h1>
      <p>Dê seu lance em reais até o fim do prazo. Só paga quem vence.</p>
    </header>
  )
}

function Vazio({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="vt-heroi" style={{ alignItems: 'center', textAlign: 'center' }}>
      <span
        style={{
          width: 48, height: 48, borderRadius: 999, display: 'grid', placeItems: 'center',
          background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--ac-1)',
        }}
      >
        <IconClock size={22} />
      </span>
      <h2>{titulo}</h2>
      <div className="vt-acoes" style={{ justifyContent: 'center' }}>{children}</div>
    </div>
  )
}
