'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { IconLeilao } from '@/components/ui/Icons'
import { formatarBRL } from '@/lib/leilao'
import { urlRodada } from '@/lib/leilao-urls'

/**
 * Secao de leilao da home, logo depois do hero (pedido do Du, 03/11).
 *
 * Ordem, sempre o REAL primeiro: rodada no ar > rodada agendada > demonstracao.
 * A demonstracao so entra quando a rota confirmou, com 200, que nao ha nada. Em
 * erro ou enquanto carrega, fica so o texto, que e verdade em qualquer momento:
 * nunca um leilao ficticio por cima de um real que nao conseguimos ler.
 *
 * Na demonstracao nada imita o estado real: sem selo AO VIVO, sem "Dar lance",
 * com aviso fixo e loja, lances e valores ficticios.
 */

interface Resumo {
  estado: 'ao_vivo' | 'agendada' | 'nada'
  serverNow: string
  rodada?: { numero: number; iniciaEm: string | null; lojaNome: string; nLotes: number; outrasNoAr: number }
  lote?: { nome: string; imagem: string | null; precoCents: number; nLances: number; terminaEm: string | null } | null
  proximos?: string[]
}

const IMG = (id: string) => `https://images.pokemontcg.io/${id}.png`

// Tudo ficticio: so existe para mostrar como a tela se comporta.
const DEMO = [
  { nome: 'Charizard', imagem: IMG('base1/4'), inicial: 90000, passos: [95000, 102000, 110000, 118000] },
  { nome: 'Umbreon VMAX', imagem: IMG('swsh7/215'), inicial: 600000, passos: [640000, 690000, 730000] },
  { nome: 'Eevee', imagem: IMG('sv3pt5/133'), inicial: 500, passos: [700, 1000, 1200, 1500] },
] as const
const DEMO_APELIDOS = ['a***o', 'm***a', 'r***s', 'j***e', 'c***a']
const DEMO_SEG = 24
const DEMO_FIM_SEG = 4

function relogio(seg: number): string {
  const s = Math.max(0, Math.ceil(seg))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function quando(iso: string | null | undefined, agora: number): string {
  if (!iso) return 'Em breve'
  const t = new Date(iso)
  const dia = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const hora = t.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  if (dia(t) === dia(new Date(agora))) return `Hoje, ${hora}`
  if (dia(t) === dia(new Date(agora + 86_400_000))) return `Amanhã, ${hora}`
  const sem = t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).split('-')[0]
  return `${sem[0].toUpperCase()}${sem.slice(1)}, ${hora}`
}

export default function LeilaoHome() {
  const [dados, setDados] = useState<Resumo | null>(null)
  const [offset, setOffset] = useState(0)
  const [agora, setAgora] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const [visivel, setVisivel] = useState(false)
  const [calmo, setCalmo] = useState(false)

  const buscar = useCallback(async () => {
    try {
      const r = await fetch('/api/leiloes/resumo-home')
      if (!r.ok) return
      const j = (await r.json()) as Resumo
      setOffset(Date.parse(j.serverNow) - Date.now())
      setDados(j)
    } catch {
      // Sem conexao: mantem o que ja esta na tela.
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalmo(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    buscar()
    const volta = () => { if (document.visibilityState === 'visible') buscar() }
    document.addEventListener('visibilitychange', volta)
    const el = raiz.current
    const io = el ? new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.1 }) : null
    if (el && io) io.observe(el)
    return () => { document.removeEventListener('visibilitychange', volta); io?.disconnect() }
  }, [buscar])

  // Rodada no ar muda em segundos; agendada so importa perto da hora. Fora da tela, nada.
  const estado = dados?.estado
  useEffect(() => {
    if (!visivel) return
    const ms = estado === 'ao_vivo' ? 5_000 : estado === 'agendada' ? 30_000 : 0
    if (!ms) return
    const id = setInterval(() => { if (document.visibilityState === 'visible') buscar() }, ms)
    return () => clearInterval(id)
  }, [estado, visivel, buscar])

  useEffect(() => {
    if (estado !== 'ao_vivo' && estado !== 'agendada') return
    const tique = () => setAgora(Date.now() + offset)
    tique()
    const id = setInterval(tique, 1_000)
    return () => clearInterval(id)
  }, [estado, offset])

  const r = dados?.rodada
  const titulo =
    estado === 'ao_vivo' && r ? `${r.lojaNome} está ao vivo agora`
    : estado === 'agendada' && r ? `${quando(r.iniciaEm, agora)}: rodada ao vivo de ${r.lojaNome}`
    : 'Leilão de cartas Pokémon, ao vivo e em reais.'
  const texto =
    estado === 'ao_vivo' && r ? `Rodada ${r.numero}, com ${r.nLotes} ${r.nLotes === 1 ? 'carta' : 'cartas'} em disputa, uma por vez. Lance em reais.`
    : estado === 'agendada' && r ? `${r.nLotes} ${r.nLotes === 1 ? 'carta' : 'cartas'} em disputa, uma por vez, no horário de Brasília.`
    : 'A loja abre a rodada, as cartas passam uma por uma e o maior lance leva. Você paga pela Bynx, no cartão. Só paga quem vence.'
  const destino = r ? urlRodada(r.numero) : '/leiloes'

  return (
    <div ref={raiz} className="lh">
      <style>{CSS}</style>
      <div className="lh-txt">
        <span className="eyebrow"><IconLeilao size={16} /> Bynx Leilões</span>
        <h2 className="sec-title">{titulo}</h2>
        <p className="sec-sub">{texto}</p>
      </div>
      <div className="lh-acoes">
        <div className="ctas">
          <Link href={destino} prefetch={false} className="btn-primary">
            {estado === 'ao_vivo' ? 'Entrar na rodada ao vivo' : estado === 'agendada' ? 'Ver a rodada' : 'Ver os leilões'}
          </Link>
          <Link href="/leiloes?aba=como-funciona" prefetch={false} className="btn-ghost">Como funciona</Link>
        </div>
        {estado === 'ao_vivo' && r && r.outrasNoAr > 0 && (
          <Link href="/leiloes" prefetch={false} className="lh-mais">Mais {r.outrasNoAr} {r.outrasNoAr === 1 ? 'rodada' : 'rodadas'} ao vivo</Link>
        )}
      </div>
      <div className="lh-palco-area">
        {estado === 'ao_vivo' && <PalcoReal d={dados as Resumo} agora={agora} />}
        {estado === 'agendada' && <PalcoAgendada d={dados as Resumo} agora={agora} />}
        {estado === 'nada' && <PalcoDemo ativo={visivel && !calmo} />}
      </div>
    </div>
  )
}

function Cartas({ imagens }: { imagens: string[] }) {
  if (!imagens.length) return null
  return (
    <div className="lh-prox">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imagens.map((src, i) => <img key={`${src}-${i}`} src={src} alt="" loading="lazy" />)}
    </div>
  )
}

function PalcoReal({ d, agora }: { d: Resumo; agora: number }) {
  const l = d.lote
  const restante = l?.terminaEm && agora ? (Date.parse(l.terminaEm) - agora) / 1000 : null
  return (
    <article className="lh-palco">
      <span className="lh-selo lh-vivo"><i /> AO VIVO</span>
      {l ? (
        <div className="lh-lote">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {l.imagem && <img className="lh-carta" src={l.imagem} alt={l.nome} />}
          <div className="lh-dados">
            <b className="lh-nome">{l.nome}</b>
            <span className="lh-rot">{l.nLances > 0 ? 'Lance atual' : 'Lance inicial'}</span>
            <span className="lh-preco">{formatarBRL(l.precoCents)}</span>
            <span className="lh-meta">{l.nLances === 1 ? '1 lance' : `${l.nLances} lances`}</span>
            {restante !== null && <span className={`lh-rel${restante <= 10 ? ' lh-urg' : ''}`}>{restante > 0 ? relogio(restante) : 'Conferindo'}</span>}
          </div>
        </div>
      ) : (
        <p className="lh-meta">Trocando de carta. A próxima abre em instantes.</p>
      )}
      {(d.proximos?.length ?? 0) > 0 && <span className="lh-rot">A seguir</span>}
      <Cartas imagens={d.proximos ?? []} />
    </article>
  )
}

function PalcoAgendada({ d, agora }: { d: Resumo; agora: number }) {
  const ini = d.rodada?.iniciaEm ? Date.parse(d.rodada.iniciaEm) : NaN
  const falta = agora && Number.isFinite(ini) ? (ini - agora) / 1000 : null
  return (
    <article className="lh-palco">
      <span className="lh-selo lh-ac">PRÓXIMA RODADA</span>
      <span className="lh-rot">Começa em</span>
      <span className="lh-preco">
        {falta === null ? '--' : falta <= 0 ? 'instantes'
          : falta >= 86_400 ? `${Math.floor(falta / 86_400)} d ${Math.floor((falta % 86_400) / 3600)} h`
          : falta >= 3600 ? `${Math.floor(falta / 3600)} h ${Math.floor((falta % 3600) / 60)} min`
          : relogio(falta)}
      </span>
      {(d.proximos?.length ?? 0) > 0 && <span className="lh-rot">Algumas cartas</span>}
      <Cartas imagens={d.proximos ?? []} />
    </article>
  )
}

/** Disputa simulada, so com o relogio local. Parada fora da tela e com menos movimento. */
function PalcoDemo({ ativo }: { ativo: boolean }) {
  const [i, setI] = useState(0)
  const [seg, setSeg] = useState(0)
  useEffect(() => {
    if (!ativo) return
    const id = setInterval(() => setSeg(s => s + 1), 1_000)
    return () => clearInterval(id)
  }, [ativo])
  useEffect(() => {
    if (seg < DEMO_SEG + DEMO_FIM_SEG) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeg(0)
    setI(n => (n + 1) % DEMO.length)
  }, [seg])

  const c = DEMO[i]
  const a = Math.min(c.passos.length, Math.floor(seg / (DEMO_SEG / (c.passos.length + 1))))
  const preco = a > 0 ? c.passos[a - 1] : c.inicial
  const acabou = seg >= DEMO_SEG
  const lances = Array.from({ length: a }, (_, k) => ({ v: c.passos[k], q: DEMO_APELIDOS[(k + i) % DEMO_APELIDOS.length] })).reverse().slice(0, 3)
  return (
    <article className="lh-palco" aria-label="Demonstração de como é uma rodada. Dados fictícios.">
      <span className="lh-selo">*DEMONSTRAÇÃO</span>
      <div className="lh-lote">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lh-carta" src={c.imagem} alt="" />
        <div className="lh-dados">
          <b className="lh-nome">{c.nome}</b>
          <span className="lh-rot">{acabou ? 'Arrematado por' : a > 0 ? 'Lance atual' : 'Lance inicial'}</span>
          <span className="lh-preco" key={preco}>{formatarBRL(preco)}</span>
          <span className="lh-meta">{a === 1 ? '1 lance' : `${a} lances`}</span>
          <span className={`lh-rel${!acabou && DEMO_SEG - seg <= 8 ? ' lh-urg' : ''}`}>{acabou ? 'Encerrado' : relogio(DEMO_SEG - seg)}</span>
        </div>
      </div>
      <ul className="lh-feed">
        {lances.map(l => <li key={l.v}><span>{l.q}</span><b>{formatarBRL(l.v)}</b></li>)}
      </ul>
      <p className="lh-aviso">*Demonstração com loja, lances e valores fictícios. Nenhum leilão está no ar agora.</p>
    </article>
  )
}

const CSS = `
.hm-root .lh{display:grid;grid-template-columns:minmax(0,1fr);grid-template-areas:'txt' 'palco' 'acoes';gap:16px;padding-top:32px;padding-bottom:32px}
.hm-root .lh-txt{grid-area:txt;min-width:0}
.hm-root .lh-acoes{grid-area:acoes;min-width:0}
.hm-root .lh-mais{display:inline-flex;align-items:center;min-height:44px;margin-top:6px;font-size:14px;font-weight:700;color:var(--ac-1);text-decoration:none}
.hm-root .lh-palco-area{grid-area:palco;min-width:0;min-height:320px}
.hm-root .lh-palco{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:16px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.hm-root .lh-selo{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.05em;background:var(--bx-surface-3);color:var(--bx-text-2)}
.hm-root .lh-vivo{background:rgba(239,68,68,.15);color:var(--bx-red)}
.hm-root .lh-vivo i{width:7px;height:7px;border-radius:50%;background:var(--bx-red)}
.hm-root .lh-ac{background:rgba(var(--ac-1-rgb),.14);color:var(--ac-1)}
.hm-root .lh-lote{display:flex;gap:14px;align-items:center;min-width:0}
.hm-root .lh-carta{width:118px;aspect-ratio:63/88;flex:none;border-radius:8px;object-fit:cover;background:var(--bx-surface-2)}
.hm-root .lh-dados{display:flex;flex-direction:column;gap:3px;min-width:0}
.hm-root .lh-nome{font-size:15px;font-weight:800;color:var(--bx-text)}
.hm-root .lh-rot{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--bx-text-3)}
.hm-root .lh-preco{font-size:26px;font-weight:800;line-height:1.1;color:var(--bx-text);font-variant-numeric:tabular-nums;animation:lh-entra .2s ease}
.hm-root .lh-meta{font-size:13px;color:var(--bx-text-2)}
.hm-root .lh-rel{margin-top:4px;font-size:20px;font-weight:800;color:var(--bx-text);font-variant-numeric:tabular-nums}
.hm-root .lh-urg{color:var(--bx-red)}
.hm-root .lh-prox{display:flex;gap:6px;overflow:hidden}
.hm-root .lh-prox img{width:52px;aspect-ratio:63/88;border-radius:5px;object-fit:cover;background:var(--bx-surface-2)}
.hm-root .lh-feed{list-style:none;display:flex;flex-direction:column;gap:4px;min-height:84px;font-size:13px;color:var(--bx-text-2)}
.hm-root .lh-feed li{display:flex;justify-content:space-between;gap:10px;padding:5px 10px;border-radius:8px;background:var(--bx-surface);font-variant-numeric:tabular-nums}
.hm-root .lh-feed li:first-child{background:rgba(var(--ac-1-rgb),.1);color:var(--bx-text)}
.hm-root .lh-aviso{font-size:12px;line-height:1.45;color:var(--bx-text-2)}
@keyframes lh-entra{from{opacity:.4}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.hm-root .lh-preco{animation:none}}
@media(min-width:900px){.hm-root .lh{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);grid-template-rows:auto auto;grid-template-areas:'txt palco' 'acoes palco';column-gap:48px;row-gap:12px;padding-top:44px;padding-bottom:44px}.hm-root .lh-txt{align-self:end}.hm-root .lh-acoes{align-self:start}}
`
