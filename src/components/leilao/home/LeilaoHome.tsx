'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import BotaoAvisoLeilao from '@/components/leilao/vitrine/BotaoAvisoLeilao'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { urlLote, urlRodada } from '@/lib/leilao-urls'

/**
 * Parte viva da secao de leilao da home. Titulo, texto e letreiro vem do servidor
 * (page.tsx), para o Google e para nunca dependerem do JS.
 *
 * Ordem, sempre o REAL primeiro: rodada no ar > leiloes abertos > rodada agendada >
 * demonstracao. A demonstracao so entra quando a rota confirmou, com 200, que nao
 * ha nada; em erro aparece o aviso de leitura, nunca um leilao ficticio.
 *
 * Na demonstracao nada imita o real: contorno tracejado, *Exemplo em vez de relogio,
 * sem vermelho, sem "Dar lance". Decisao do Du: cartas de exemplo com aviso visivel.
 */

type LoteHome = LotePublico & { lojaNome: string | null }

interface Resumo {
  estado: 'ao_vivo' | 'abertos' | 'agendada' | 'nada'
  serverNow: string
  lotes?: LoteHome[]
  totalAbertos?: number
  rodada?: { numero: number; iniciaEm: string | null; lojaNome: string; nLotes: number; outrasNoAr: number }
  lote?: { nome: string; imagem: string | null; precoCents: number; nLances: number; terminaEm: string | null } | null
  proximos?: string[]
}

const IMG = (id: string) => `https://images.pokemontcg.io/${id}_hires.png`
const DEMO = [
  { nome: 'Charizard', set: 'Base', imagem: IMG('base1/4'), precoCents: 100000, lances: 7 },
  { nome: 'Umbreon VMAX', set: 'Evolving Skies', imagem: IMG('swsh7/215'), precoCents: 600000, lances: 12 },
  { nome: 'Eevee', set: '151', imagem: IMG('sv3pt5/133'), precoCents: 1000, lances: 3 },
] as const

function tempo(ms: number): { txt: string; urg: boolean } {
  if (ms <= 0) return { txt: 'Conferindo o último lance', urg: false }
  const s = Math.ceil(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d >= 1) return { txt: `${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h`, urg: false }
  if (h >= 1) return { txt: `${h} h ${m} min`, urg: false }
  return { txt: `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, urg: true }
}

const lancesTxt = (n: number) => (n === 0 ? 'Sem lance' : n === 1 ? '1 lance' : `${n} lances`)

export default function LeilaoHome() {
  const [dados, setDados] = useState<Resumo | null>(null)
  const [erro, setErro] = useState(false)
  const [offset, setOffset] = useState(0)
  const [agora, setAgora] = useState(0)
  const [visivel, setVisivel] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  const buscar = useCallback(async () => {
    try {
      const r = await fetch('/api/leiloes/resumo-home')
      if (!r.ok) { setErro(true); return }
      const j = (await r.json()) as Resumo
      setOffset(Date.parse(j.serverNow) - Date.now())
      setDados(j)
      setErro(false)
    } catch {
      setErro(true)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    buscar()
    const volta = () => { if (document.visibilityState === 'visible') buscar() }
    document.addEventListener('visibilitychange', volta)
    const el = raiz.current
    const io = el ? new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { threshold: 0.05 }) : null
    if (el && io) io.observe(el)
    return () => { document.removeEventListener('visibilitychange', volta); io?.disconnect() }
  }, [buscar])

  const estado = dados?.estado
  useEffect(() => {
    if (!visivel) return
    const ms = estado === 'ao_vivo' ? 5_000 : estado === 'abertos' || estado === 'agendada' ? 30_000 : 0
    if (!ms) return
    const id = setInterval(() => { if (document.visibilityState === 'visible') buscar() }, ms)
    return () => clearInterval(id)
  }, [estado, visivel, buscar])

  useEffect(() => {
    if (!visivel || !estado || estado === 'nada') return
    const tique = () => setAgora(Date.now() + offset)
    tique()
    const id = setInterval(tique, 1_000)
    return () => clearInterval(id)
  }, [estado, offset, visivel])

  return (
    <div ref={raiz} className="lh" style={{ minHeight: dados || erro ? undefined : 560 }}>
      <style>{CSS}</style>
      {erro && !dados && (
        <div className="lh-erro" role="status">
          <p>Não foi possível carregar os lotes aqui. Na página de leilões, você vê o que está aberto.</p>
          <div className="lh-ctas">
            <Link href="/leiloes" prefetch={false} className="lh-bt lh-pri">Ver os leilões</Link>
            <button type="button" onClick={buscar} className="lh-bt">Tentar de novo</button>
          </div>
        </div>
      )}
      {estado === 'abertos' && <Abertos lotes={dados?.lotes ?? []} total={dados?.totalAbertos ?? 0} agora={agora} />}
      {estado === 'ao_vivo' && <AoVivo d={dados as Resumo} agora={agora} />}
      {estado === 'agendada' && <Agendada d={dados as Resumo} agora={agora} />}
      {estado === 'nada' && <Demonstracao />}
    </div>
  )
}

function Abertos({ lotes, total, agora }: { lotes: LoteHome[]; total: number; agora: number }) {
  return (
    <>
      <div className={`lh-trilho lh-n${Math.min(lotes.length, 3)}`}>
        {lotes.map((l, i) => {
          const fim = l.terminaEm ? Date.parse(l.terminaEm) : NaN
          const t = agora && Number.isFinite(fim) ? tempo(fim - agora) : null
          const preco = l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
          return (
            <Link key={l.id} href={urlLote(l.slug)} prefetch={false} className="lh-card">
              <CardItem
                card={cardDoLote(l)}
                mode="readonly"
                hidePriceTable
                ocultarSemPreco
                badge={t ? <span className={`lh-tempo${t.urg ? ' lh-urg' : ''}`}>{t.txt}</span> : undefined}
                footerSlot={
                  <div className="lh-card-pe">
                    <span className="lh-rot">{l.nLances > 0 ? 'Lance atual' : 'Lance inicial'}</span>
                    <span className="lh-preco">{formatarBRL(preco)}</span>
                    <span className="lh-meta">{lancesTxt(l.nLances)}{l.lojaNome ? ` · ${l.lojaNome}` : ''}</span>
                    <span className={`lh-bt lh-card-bt${i === 0 ? ' lh-pri' : ''}`}>{l.nLances === 0 ? 'Dar o primeiro lance' : 'Dar lance'}</span>
                  </div>
                }
              />
            </Link>
          )
        })}
      </div>
      <div className="lh-ctas">
        <Link href="/leiloes" prefetch={false} className="lh-bt lh-pri">{total > 1 ? `Ver os ${total} leilões` : 'Ver os leilões'}</Link>
        <Link href="/leiloes?aba=como-funciona" prefetch={false} className="lh-bt">Como funciona</Link>
      </div>
      <Confianca />
    </>
  )
}

function AoVivo({ d, agora }: { d: Resumo; agora: number }) {
  const l = d.lote
  const fim = l?.terminaEm ? Date.parse(l.terminaEm) : NaN
  const t = agora && Number.isFinite(fim) ? tempo(fim - agora) : null
  return (
    <>
      <article className="lh-faixa">
        <span className="lh-selo lh-vivo">AO VIVO</span>
        <b className="lh-nome">{d.rodada?.lojaNome} está ao vivo agora</b>
        {l && (
          <div className="lh-lote">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.imagem && <img className="lh-carta" src={l.imagem} alt={l.nome} />}
            <div className="lh-dados">
              <b className="lh-nome">{l.nome}</b>
              <span className="lh-rot">{l.nLances > 0 ? 'Lance atual' : 'Lance inicial'}</span>
              <span className="lh-preco">{formatarBRL(l.precoCents)}</span>
              <span className="lh-meta">{lancesTxt(l.nLances)}</span>
              {t && <span className={`lh-tempo${t.urg ? ' lh-urg' : ''}`}>{t.txt}</span>}
            </div>
          </div>
        )}
      </article>
      <div className="lh-ctas">
        <Link href={urlRodada(d.rodada?.numero ?? 0)} prefetch={false} className="lh-bt lh-pri">Entrar na rodada ao vivo</Link>
        <Link href="/leiloes" prefetch={false} className="lh-bt">Ver os leilões</Link>
      </div>
      <Confianca />
    </>
  )
}

function Agendada({ d, agora }: { d: Resumo; agora: number }) {
  const r = d.rodada
  const ini = r?.iniciaEm ? Date.parse(r.iniciaEm) : NaN
  const t = agora && Number.isFinite(ini) && ini > agora ? tempo(ini - agora) : null
  return (
    <>
      <article className="lh-faixa">
        <span className="lh-selo">PRÓXIMA RODADA</span>
        <b className="lh-nome">Rodada ao vivo de {r?.lojaNome}, com {r?.nLotes} {r?.nLotes === 1 ? 'carta' : 'cartas'}</b>
        <span className="lh-rot">Começa em</span>
        <span className="lh-preco">{t ? t.txt : 'instantes'}</span>
      </article>
      <div className="lh-ctas">
        <Link href={urlRodada(r?.numero ?? 0)} prefetch={false} className="lh-bt lh-pri">Ver a rodada</Link>
        <Link href="/leiloes?aba=como-funciona" prefetch={false} className="lh-bt">Como funciona</Link>
      </div>
    </>
  )
}

function Demonstracao() {
  return (
    <>
      <p className="lh-aviso">*Demonstração: nenhum leilão aberto agora. Cartas, lances e valores abaixo são exemplos e não estão à venda.</p>
      <div className="lh-trilho lh-n3 lh-demo" aria-label="Exemplos de como um leilão aparece">
        {DEMO.map(c => (
          <div key={c.nome} className="lh-card lh-card-demo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.imagem} alt="" loading="lazy" className="lh-demo-img" />
            <div className="lh-card-pe">
              <b className="lh-nome">{c.nome}</b>
              <span className="lh-meta">{c.set}</span>
              <span className="lh-rot">Exemplo de lance*</span>
              <span className="lh-preco">{formatarBRL(c.precoCents)}*</span>
              <span className="lh-meta">{c.lances} lances de exemplo · termina em 2 dias*</span>
            </div>
          </div>
        ))}
      </div>
      <div className="lh-ctas lh-ctas-demo">
        <BotaoAvisoLeilao className="lh-bt lh-pri" />
        <Link href="/leiloes?aba=como-funciona" prefetch={false} className="lh-bt">Como funciona</Link>
        <Link href="/marketplace" prefetch={false} className="lh-bt">Ver cartas à venda</Link>
      </div>
      <Link href="/para-lojistas" prefetch={false} className="lh-loja">Tenho loja e quero fazer um leilão</Link>
    </>
  )
}

function Confianca() {
  return (
    <ul className="lh-conf">
      <li>Lance é compromisso de compra: não pode ser cancelado, e quem vence precisa pagar.</li>
      <li>Ao lance somam-se taxa de proteção de 5% (mínimo R$ 2), custo do cartão e frete.</li>
      <li>Proteção Bynx: se a carta não chegar, vier diferente ou danificada, abra uma ocorrência na tela do pedido.</li>
    </ul>
  )
}

const CSS = `
.hm-root .lh{display:flex;flex-direction:column;gap:16px;min-width:0}
.hm-root .lh-trilho{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,62%);gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:6px 16px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.hm-root .lh-trilho::-webkit-scrollbar{display:none}
.hm-root .lh-card{display:block;scroll-snap-align:center;min-width:0;border-radius:18px;background:var(--bx-bg-elev);color:inherit;text-decoration:none;transition:transform .2s ease}
.hm-root .lh-trilho>.lh-card:nth-child(odd){transform:rotate(-1deg)}
.hm-root .lh-trilho>.lh-card:nth-child(even){transform:rotate(1deg)}
.hm-root .lh-card-pe{display:flex;flex-direction:column;gap:3px;min-width:0;padding-top:4px}
.hm-root .lh-rot{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--bx-text-2)}
.hm-root .lh-preco{font-size:24px;font-weight:800;line-height:1.15;color:var(--bx-text);font-variant-numeric:tabular-nums}
.hm-root .lh-meta{font-size:13px;color:var(--bx-text-2);overflow-wrap:anywhere}
.hm-root .lh-nome{font-size:15px;font-weight:800;color:var(--bx-text)}
.hm-root .lh-tempo{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:var(--bx-bg);border:1px solid var(--bx-border-2);font-size:12.5px;font-weight:800;color:var(--bx-text);font-variant-numeric:tabular-nums}
.hm-root .lh-urg{color:var(--bx-red);border-color:rgba(239,68,68,.45)}
.hm-root .lh-bt{display:flex;align-items:center;justify-content:center;min-height:44px;padding:8px 16px;border-radius:10px;border:1px solid rgba(var(--ac-1-rgb),.55);background:transparent;color:var(--bx-text);font-family:inherit;font-size:14px;font-weight:800;text-align:center;text-decoration:none;cursor:pointer;transition:filter .15s ease,background .15s ease}
.hm-root .lh-bt:hover{background:rgba(var(--ac-1-rgb),.1)}
.hm-root .lh-pri{background:var(--ac-grad);border-color:transparent;color:var(--bx-brand-ink)}
.hm-root .lh-pri:hover{background:var(--ac-grad);filter:brightness(1.08)}
.hm-root .lh-card-bt{margin-top:8px}
.hm-root .lh-ctas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.hm-root .lh-ctas-demo{grid-template-columns:minmax(0,1fr)}
.hm-root .lh-conf{list-style:none;display:flex;flex-direction:column;gap:6px;font-size:12.5px;line-height:1.45;color:var(--bx-text-2)}
.hm-root .lh-aviso{padding:10px 12px;border-radius:10px;border:1px dashed var(--bx-border-2);background:var(--bx-surface);font-size:13px;font-weight:600;line-height:1.45;color:var(--bx-text)}
.hm-root .lh-card-demo{padding:10px;border:1.5px dashed var(--bx-border-2)}
.hm-root .lh-demo-img{display:block;width:100%;aspect-ratio:63/88;object-fit:cover;border-radius:10px;background:var(--bx-surface-2);opacity:.9}
.hm-root .lh-loja{display:inline-flex;align-items:center;justify-content:center;min-height:44px;font-size:13.5px;font-weight:700;color:var(--ac-1);text-decoration:none}
.hm-root .lh-faixa{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2)}
.hm-root .lh-selo{align-self:flex-start;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.05em;background:rgba(var(--ac-1-rgb),.14);color:var(--ac-1)}
.hm-root .lh-vivo{background:rgba(239,68,68,.15);color:var(--bx-red)}
.hm-root .lh-lote{display:flex;gap:14px;align-items:center;min-width:0}
.hm-root .lh-carta{width:118px;aspect-ratio:63/88;flex:none;border-radius:8px;object-fit:cover}
.hm-root .lh-dados{display:flex;flex-direction:column;gap:4px;min-width:0;align-items:flex-start}
.hm-root .lh-erro{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:12px;background:var(--bx-surface);font-size:14px;color:var(--bx-text-2)}
@media(hover:hover){.hm-root .lh-trilho>.lh-card:hover{transform:rotate(0) translateY(-3px)}}
@media(prefers-reduced-motion:reduce){.hm-root .lh-card{transition:none}.hm-root .lh-trilho>.lh-card:nth-child(n){transform:none}}
@media(min-width:900px){
  .hm-root .lh-trilho{margin:0;padding:6px 0 10px;overflow:visible;grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:repeat(3,minmax(0,1fr))}
  .hm-root .lh-trilho>.lh-card:nth-child(n+4){display:none}
  .hm-root .lh-ctas{max-width:460px}
}
`
