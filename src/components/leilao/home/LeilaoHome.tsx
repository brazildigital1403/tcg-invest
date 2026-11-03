'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import BotaoAvisoLeilao from '@/components/leilao/vitrine/BotaoAvisoLeilao'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { LEILAO_PRAZO_ATIVO } from '@/lib/leilao-flag'
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
 * Na demonstracao nada imita o real: contorno tracejado, faixa em cada carta e
 * nenhum preco, lance ou relogio. Real e demonstracao nunca dividem a tela.
 * Decisao do Du: cartas de exemplo com aviso visivel, e so quando nao ha nada.
 */

type LoteHome = LotePublico & { lojaNome: string | null }

interface Resumo {
  estado: 'ao_vivo' | 'abertos' | 'agendada' | 'nada'
  serverNow: string
  lotes?: LoteHome[]
  totalAbertos?: number
  totalNoLimite?: boolean
  rodada?: { numero: number; iniciaEm: string | null; lojaNome: string; nLotes: number; outrasNoAr: number }
  lote?: { nome: string; imagem: string | null; precoCents: number; nLances: number; terminaEm: string | null } | null
  proximos?: string[]
}

// Conferidas por id no catalogo em 03/11. Sem preco de proposito: colecionador
// compara numero, e valor de exemplo vira ancora falsa.
const IMG = (caminho: string) => `https://images.pokemontcg.io/${caminho}.png`
const DEMO = [
  { id: 'base1-4', nome: 'Charizard', set: 'Base', imagem: IMG('base1/4') },
  { id: 'swsh7-215', nome: 'Umbreon VMAX', set: 'Evolving Skies', imagem: IMG('swsh7/215') },
  { id: 'sv3pt5-133', nome: 'Eevee', set: '151', imagem: IMG('sv3pt5/133') },
  { id: 'sv3pt5-25', nome: 'Pikachu', set: '151', imagem: IMG('sv3pt5/25') },
  { id: 'neo1-9', nome: 'Lugia', set: 'Neo Genesis', imagem: IMG('neo1/9') },
  { id: 'sv3pt5-151', nome: 'Mew ex', set: '151', imagem: IMG('sv3pt5/151') },
  { id: 'base1-2', nome: 'Blastoise', set: 'Base', imagem: IMG('base1/2') },
  { id: 'sv3pt5-94', nome: 'Gengar', set: '151', imagem: IMG('sv3pt5/94') },
  { id: 'sv8-238', nome: 'Pikachu ex', set: 'Surging Sparks', imagem: IMG('sv8/238') },
  { id: 'sv3pt5-6', nome: 'Charizard ex', set: '151', imagem: IMG('sv3pt5/6') },
  { id: 'sm12-1', nome: 'Venusaur & Snivy-GX', set: 'Cosmic Eclipse', imagem: IMG('sm12/1') },
  { id: 'sv3pt5-9', nome: 'Blastoise ex', set: '151', imagem: IMG('sv3pt5/9') },
] as const
const TROCA_MS = 8_000

// Vermelho antes disso e urgencia sem motivo: 45 minutos nao sao o fim.
const URGENTE_MS = 10 * 60_000

function tempo(ms: number): { txt: string; urg: boolean } {
  if (ms <= 0) return { txt: 'Conferindo o último lance', urg: false }
  const s = Math.ceil(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d >= 1) return { txt: `${d} ${d === 1 ? 'dia' : 'dias'} e ${h} h`, urg: false }
  if (h >= 1) return { txt: `${h} h ${m} min`, urg: false }
  return { txt: `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, urg: ms < URGENTE_MS }
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

  // Um card vencido sai sozinho: o tick fecha em segundos, e isto evita esperar o
  // proximo polling mostrando "Conferindo" a toa.
  const lotesAbertos = dados?.lotes
  useEffect(() => {
    if (estado !== 'abertos' || !lotesAbertos?.length) return
    const agoraMs = Date.now() + offset
    const fins = lotesAbertos.map(l => (l.terminaEm ? Date.parse(l.terminaEm) : NaN)).filter(f => f > agoraMs)
    if (!fins.length) return
    const falta = Math.min(...fins) - agoraMs + 6_000
    if (falta > 3_600_000) return
    const id = setTimeout(buscar, falta)
    return () => clearTimeout(id)
  }, [estado, lotesAbertos, offset, buscar])

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
      {estado === 'abertos' && <div key="abertos" className="lh-troca"><Abertos lotes={dados?.lotes ?? []} total={dados?.totalAbertos ?? 0} noLimite={!!dados?.totalNoLimite} agora={agora} /></div>}
      {estado === 'ao_vivo' && <div key="ao_vivo" className="lh-troca"><AoVivo d={dados as Resumo} agora={agora} /></div>}
      {estado === 'agendada' && <div key="agendada" className="lh-troca"><Agendada d={dados as Resumo} agora={agora} /></div>}
      {estado === 'nada' && <div key="nada" className="lh-troca"><Demonstracao visivel={visivel} /></div>}
    </div>
  )
}

function CardLote({ l, agora, destaque }: { l: LoteHome; agora: number; destaque: boolean }) {
  const fim = l.terminaEm ? Date.parse(l.terminaEm) : NaN
  const t = agora && Number.isFinite(fim) ? tempo(fim - agora) : null
  const preco = l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
  return (
    <Link href={urlLote(l.slug)} prefetch={false} className="lh-card">
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
            <span className={`lh-bt lh-card-bt${destaque ? ' lh-pri' : ''}`}>{l.nLances === 0 ? 'Dar o primeiro lance' : 'Dar lance'}</span>
          </div>
        }
      />
    </Link>
  )
}

function UmLote({ l, agora }: { l: LoteHome; agora: number }) {
  const fim = l.terminaEm ? Date.parse(l.terminaEm) : NaN
  const t = agora && Number.isFinite(fim) ? tempo(fim - agora) : null
  const preco = l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
  return (
    <Link href={urlLote(l.slug)} prefetch={false} className="lh-um">
      <div className="lh-um-carta">
        <CardItem card={cardDoLote(l)} mode="readonly" hidePriceTable ocultarSemPreco />
      </div>
      <div className="lh-um-dados">
        <span className="lh-selo">Aberto agora</span>
        <span className="lh-rot">{l.nLances > 0 ? 'Lance atual' : 'Lance inicial'}</span>
        <span className="lh-preco">{formatarBRL(preco)}</span>
        <span className="lh-meta">{lancesTxt(l.nLances)}</span>
        {t && <span className="lh-meta">Termina em <b className={t.urg ? 'lh-urg-txt' : 'lh-forte'}>{t.txt}</b></span>}
        {l.lojaNome && <span className="lh-meta">Vendido por {l.lojaNome}</span>}
      </div>
      <span className="lh-bt lh-pri lh-um-bt">{l.nLances === 0 ? 'Dar o primeiro lance' : 'Dar lance'}</span>
    </Link>
  )
}

function Passos() {
  return (
    <ol className="lh-passos" aria-label="Como funciona">
      <li><b>1</b><span>Escolha a carta e informe até quanto aceita pagar.</span></li>
      <li><b>2</b><span>Acompanhe os lances, que ficam visíveis até o fim.</span></li>
      <li><b>3</b><span>Se o seu lance for o maior, pague em até 48 horas no cartão.</span></li>
    </ol>
  )
}

function Abertos({ lotes, total, noLimite, agora }: { lotes: LoteHome[]; total: number; noLimite: boolean; agora: number }) {
  const n = lotes.length
  const rotuloTodos = noLimite ? 'Ver todos os leilões' : n > 1 ? `Ver os ${total} leilões` : 'Ver os leilões'
  return (
    <>
      {n === 1 && <div className="lh-comp"><UmLote l={lotes[0]} agora={agora} /><Passos /></div>}
      {n === 2 && (
        <div className="lh-comp">
          <div className="lh-dois">{lotes.map((l, i) => <CardLote key={l.id} l={l} agora={agora} destaque={i === 0} />)}</div>
          <Passos />
        </div>
      )}
      {n > 2 && <div className="lh-trilho">{lotes.map((l, i) => <CardLote key={l.id} l={l} agora={agora} destaque={i === 0} />)}</div>}
      <div className="lh-ctas">
        {n > 1
          ? <Link href="/leiloes" prefetch={false} className="lh-bt lh-pri">{rotuloTodos}</Link>
          : <Link href="/marketplace" prefetch={false} className="lh-bt">Ver cartas à venda</Link>}
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

function Demonstracao({ visivel }: { visivel: boolean }) {
  const [slots, setSlots] = useState([0, 1, 2])
  const [feitas, setFeitas] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [tocando, setTocando] = useState(false)
  const [reduzido, setReduzido] = useState(false)
  const passo = useRef({ prox: 3, slot: 0 })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReduzido(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const trocar = useCallback(() => {
    const colunas = window.matchMedia('(min-width: 900px)').matches ? 3 : 1
    const { prox, slot } = passo.current
    const alvo = slot % colunas
    setSlots(a => a.map((v, i) => (i === alvo ? prox % DEMO.length : v)))
    passo.current = { prox: prox + 1, slot: slot + 1 }
  }, [])

  // Uma volta nas cartas e para: nada contínuo disputando a atenção de quem lê.
  const automatico = !reduzido && feitas < DEMO.length
  useEffect(() => {
    if (!automatico || !visivel || pausado || tocando) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      trocar()
      setFeitas(f => f + 1)
    }, TROCA_MS)
    return () => clearInterval(id)
  }, [automatico, visivel, pausado, tocando, trocar])

  return (
    <div data-nosnippet>
      <p className="lh-aviso">*Demonstração: nenhum leilão aberto agora. As cartas abaixo são exemplos e não estão à venda.</p>
      <div
        className="lh-trilho lh-demo"
        onMouseEnter={() => setTocando(true)}
        onMouseLeave={() => setTocando(false)}
        onFocusCapture={() => setTocando(true)}
        onBlurCapture={() => setTocando(false)}
        onTouchStart={() => setTocando(true)}
        onTouchEnd={() => setTocando(false)}
      >
        {slots.map((idx, i) => {
          const c = DEMO[idx]
          return (
            <Link key={`${i}-${c.id}`} href="/leiloes?aba=como-funciona" prefetch={false} className="lh-card lh-card-demo" aria-label={`Exemplo: ${c.nome}. Ver como funciona o leilão`}>
              <CardItem
                card={{ id: c.id, name: c.nome, set_name: c.set, image_small: c.imagem }}
                mode="readonly"
                hidePriceTable
                ocultarSemPreco
                ocultarIdioma
                badge={<span className="lh-faixa-demo">*DEMONSTRAÇÃO</span>}
                footerSlot={
                  <div className="lh-card-pe">
                    <span className="lh-forte">Não está à venda</span>
                    <span className="lh-meta">{LEILAO_PRAZO_ATIVO ? 'Prazo no leilão real: 1, 3, 5 ou 7 dias' : 'No leilão real, o prazo fica aqui'}</span>
                    <span className="lh-meta">No leilão real, o lance atual fica aqui</span>
                    <span className="lh-bt lh-card-bt">Ver como funciona</span>
                  </div>
                }
              />
            </Link>
          )
        })}
      </div>
      <div className="lh-demo-ctrl">
        <button type="button" className="lh-bt lh-bt-leve" onClick={trocar}>Ver outra carta</button>
        {automatico && <button type="button" className="lh-bt lh-bt-leve" onClick={() => setPausado(p => !p)}>{pausado ? 'Retomar' : 'Pausar'}</button>}
      </div>
      <div className="lh-ctas lh-ctas-demo">
        <BotaoAvisoLeilao className="lh-bt lh-pri" />
        <Link href="/leiloes?aba=como-funciona" prefetch={false} className="lh-bt">Como funciona</Link>
        <Link href="/marketplace" prefetch={false} className="lh-bt">Ver cartas à venda</Link>
      </div>
      <Link href="/para-lojistas" prefetch={false} className="lh-loja">Tenho loja e quero fazer um leilão</Link>
    </div>
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
.hm-root .lh{min-width:0}
.hm-root .lh-troca,.hm-root .lh-troca>div[data-nosnippet]{display:flex;flex-direction:column;gap:16px;min-width:0}
.hm-root .lh-troca{animation:lh-in .2s ease}
.hm-root .lh-card-demo{animation:lh-in .2s ease}
@keyframes lh-in{from{opacity:0}to{opacity:1}}
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
.hm-root .lh-card-demo{border:1.5px dashed var(--bx-border-2)}
.hm-root .lh-demo{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:minmax(0,260px);justify-content:center;overflow:visible;margin:0;padding:6px 0 4px}
.hm-root .lh-demo>.lh-card:nth-child(n+2){display:none}
.hm-root .lh-faixa-demo{display:inline-flex;padding:4px 9px;border-radius:999px;background:var(--bx-bg);border:1px solid var(--bx-border-2);font-size:12px;font-weight:800;letter-spacing:.03em;color:var(--bx-text)}
.hm-root .lh-demo-ctrl{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.hm-root .lh-bt-leve{border-color:var(--bx-border-2);font-size:13px;font-weight:700}
.hm-root .lh-forte{font-size:13.5px;font-weight:800;color:var(--bx-text)}
.hm-root .lh-urg-txt{color:var(--bx-red);font-weight:800}
.hm-root .lh-comp{display:flex;flex-direction:column;gap:16px;min-width:0}
.hm-root .lh-um{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:16px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);color:inherit;text-decoration:none}
.hm-root .lh-um-carta{min-width:0}
.hm-root .lh-um-dados{display:flex;flex-direction:column;gap:4px;min-width:0;align-items:flex-start}
.hm-root .lh-um-bt{grid-column:1/-1}
.hm-root .lh-dois{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}
.hm-root .lh-dois .lh-preco{font-size:20px}
.hm-root .lh-dois .lh-card>*{height:100%}
.hm-root .lh-passos{list-style:none;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.hm-root .lh-passos li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.45;color:var(--bx-text-2)}
.hm-root .lh-passos b{flex:none;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:rgba(var(--ac-1-rgb),.14);color:var(--ac-1);font-size:12.5px;font-weight:800}
.hm-root .lh-loja{display:inline-flex;align-items:center;justify-content:center;min-height:44px;font-size:13.5px;font-weight:700;color:var(--ac-1);text-decoration:none}
.hm-root .lh-faixa{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2)}
.hm-root .lh-selo{align-self:flex-start;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.05em;background:rgba(var(--ac-1-rgb),.14);color:var(--ac-1)}
.hm-root .lh-vivo{background:rgba(239,68,68,.15);color:var(--bx-red)}
.hm-root .lh-lote{display:flex;gap:14px;align-items:center;min-width:0}
.hm-root .lh-carta{width:118px;aspect-ratio:63/88;flex:none;border-radius:8px;object-fit:cover}
.hm-root .lh-dados{display:flex;flex-direction:column;gap:4px;min-width:0;align-items:flex-start}
.hm-root .lh-erro{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:12px;background:var(--bx-surface);font-size:14px;color:var(--bx-text-2)}
@media(hover:hover){.hm-root .lh-trilho>.lh-card:hover{transform:rotate(0) translateY(-3px)}}
@media(prefers-reduced-motion:reduce){.hm-root .lh-troca,.hm-root .lh-card-demo{animation:none}.hm-root .lh-card{transition:none}.hm-root .lh-trilho>.lh-card:nth-child(n){transform:none}}
@media(min-width:900px){
  .hm-root .lh-trilho{margin:0;padding:6px 0 10px;overflow:visible;grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:repeat(3,minmax(0,1fr))}
  .hm-root .lh-trilho>.lh-card:nth-child(n+4){display:none}
  .hm-root .lh-demo{justify-content:stretch}
  .hm-root .lh-demo>.lh-card:nth-child(n+2){display:block}
  .hm-root .lh-comp{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start}
  .hm-root .lh-um{grid-template-columns:220px minmax(0,1fr);gap:20px;padding:16px}
  .hm-root .lh-ctas{max-width:460px}
}
`
