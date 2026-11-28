'use client'

// 1o Torneio Online de TCG na casa do Club (27/11/2026; mockups da secao e do resultado aprovados pelo Du).
// Pele propria presa a secao (.to), como a Batalha: o preto da casa com faixas vermelhas na diagonal, a
// pokebola fantasma e as placas de 1o e 2o lugar. O estado e calculado no navegador, no relogio de
// Brasilia (lib/pcc/torneio.ts); antes de montar nao renderiza nada, para o HTML nao divergir.
// Encerrado com resultado: "Ver o resultado" abre a Folha da casa com o podio (?resultado=1 abre direto).

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { PREMIOS_TORNEIO, RESULTADO_TORNEIO, TORNEIO, estadoTorneio, type EstadoTorneio, type LugarTorneio, type ResultadoTorneio } from '@/lib/pcc/torneio'
import { Ico } from './amigo-secreto/estilo'
import { Folha } from './_comum/calendario'
import { TrilhoVenda, useVitrine } from './_comum/vendas'
import { doSet as doSetDe, escolher, novosUsados } from '@/lib/pcc/ofertas'

const LOGO = '/pokecreatorsclub/torneio/logo.webp'
const IG = (h: string) => `https://instagram.com/${h}`
const APOIO_LISTA = 'Coloque seu nome na lista de interessados no grupo da Escolinha dos Poké Creators.'

/** @ com quebra preferida depois de . e _ (o @ longo nao quebra no meio da palavra). */
function Arroba({ h }: { h: string }) {
  // Corta depois de cada . e _ (sem lookbehind, que falta em Safari antigo).
  const partes: string[] = []
  let atual = ''
  for (const c of h) { atual += c; if (c === '.' || c === '_') { partes.push(atual); atual = '' } }
  if (atual) partes.push(atual)
  return <>@{partes.map((p, i) => <Fragment key={i}>{p}{i < partes.length - 1 && <wbr />}</Fragment>)}</>
}
const inicial = (h: string) => (h.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase()
const urlFoto = (path: string) => supabase.storage.from('club-fotos').getPublicUrl(path).data.publicUrl

function chipDe(e: EstadoTorneio): { texto: string; cls: string } {
  switch (e.tipo) {
    case 'antes': return { texto: e.dias === 1 ? 'Falta 1 dia' : `Faltam ${e.dias} dias`, cls: '' }
    case 'amanha': return { texto: 'Amanhã, às 19h', cls: '' }
    case 'hoje': return { texto: 'Hoje, às 19h', cls: 'dia' }
    case 'agora': return { texto: 'Acontecendo agora', cls: 'agora' }
    default: return { texto: 'Encerrado', cls: 'fim' }
  }
}

export default function TorneioClub({ resultado = RESULTADO_TORNEIO }: { resultado?: ResultadoTorneio | null }) {
  const [agora, setAgora] = useState(0)
  const [aberto, setAberto] = useState(false)
  const logo = useRef<HTMLDivElement | null>(null)

  // Relogio: ao montar, a cada minuto (pega as 19h do dia 18) e ao voltar para a aba.
  useEffect(() => {
    const tic = () => setAgora(Date.now())
    tic()
    const t = setInterval(tic, 60000)
    const vis = () => { if (document.visibilityState === 'visible') tic() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [])

  const estado: EstadoTorneio | null = agora ? estadoTorneio(agora, !!resultado) : null

  // Marketplace (28/11/2026, automatico): as cartas anunciadas do set dos premios, pelo set da carta no
  // catalogo, e os selados que a loja marcou com o set. So antes do torneio; some quando as partidas comecam.
  const vitrine = useVitrine()
  const doSet = useMemo(() => (vitrine
    ? escolher(vitrine, { filtro: doSetDe(TORNEIO.sets), ordem: 'barato', max: 6, min: 2, umaPorCarta: true }, novosUsados())
    : []), [vitrine])
  const comResultado = estado?.tipo === 'fim' && !!resultado

  // Link compartilhado (?resultado=1): abre a folha assim que o resultado existe.
  useEffect(() => {
    if (!comResultado) return
    // A URL so existe no navegador: abrir a folha aqui e o unico jeito de ler o ?resultado=1.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).get('resultado') === '1') setAberto(true)
  }, [comResultado])

  // Brilho do logo: uma vez, quando ele entra na tela.
  useEffect(() => {
    const el = logo.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { el.classList.add('brilha'); io.disconnect() } }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [estado?.tipo])

  const fechar = useCallback(() => {
    setAberto(false)
    const u = new URL(window.location.href)
    if (u.searchParams.has('resultado')) { u.searchParams.delete('resultado'); window.history.replaceState(null, '', u.pathname + u.search + u.hash) }
  }, [])

  if (!estado || estado.tipo === 'fora') return null
  const chip = chipDe(estado)
  const curta = estado.tipo === 'fim'
  const titulo = <h2 className="to-h" id="to-titulo">1º Torneio <b>Online</b> de TCG</h2>
  const logoEl = (
    <div className="to-logo-col"><div className="to-logo" ref={logo}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO} alt="" width={520} height={486} loading="lazy" decoding="async" />
    </div></div>
  )

  if (curta) {
    const campeao = resultado?.podio.find(p => p.lugar === 1)
    // A folha fica fora da secao: o isolation da pele prenderia a camada fixa abaixo da Batalha.
    return (
      <>
      <section className="to curta" id="torneio" aria-labelledby="to-titulo">
        <span className="to-bola" aria-hidden="true" />
        {logoEl}
        <div className="to-tx">
          <span className={`to-chip ${chip.cls}`}>{chip.texto}</span>
          {titulo}
          <div className="to-acao">
            {comResultado && resultado
              ? (
                <>
                  <p className="to-apoio">Obrigado a todo mundo que jogou. Veja quem levou os prêmios.</p>
                  {campeao && <p className="to-camp"><Ico n="trophy" s={16} /><span>Campeão: <b><Arroba h={campeao.instagram} /></b></span></p>}
                  <button type="button" className="as-btn pri to-btn" onClick={() => setAberto(true)}><Ico n="trophy" />Ver o resultado</button>
                </>
              )
              : <p className="to-apoio">Obrigado a todo mundo que jogou. O resultado aparece aqui assim que a organização confirmar.</p>}
          </div>
        </div>
        <style>{TO_CSS}</style>
      </section>
      {aberto && resultado && <FolhaResultado resultado={resultado} onFechar={fechar} />}
      </>
    )
  }

  const acompanhando = estado.tipo === 'agora'
  return (
    <>
    <section className="to" id="torneio" aria-labelledby="to-titulo">
      <span className="to-bola" aria-hidden="true" />
      {logoEl}
      <div className="to-tx">
        <span className={`to-chip ${chip.cls}`}>{chip.texto}</span>
        {titulo}
        <div className="to-data-w">
          <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />
          <time className="to-data" dateTime={TORNEIO.inicio}>
            <span><Ico n="cal" s={16} />18 de dezembro</span><b aria-hidden="true" /><span><Ico n="clock" s={16} />19h (Brasília)</span>
          </time>
        </div>
        <div className="to-onde"><span><Ico n="chat" s={15} />Online, pelo Discord</span><span><Ico n="video" s={15} />Partidas no Pokémon TCG Live</span></div>
        <p className="to-sub">Coloque o seu deck em jogo e mostre as suas habilidades no Pokémon TCG Live.</p>
        <div className="to-acao">
          <p className="to-apoio">{acompanhando ? 'As partidas estão rolando no Pokémon TCG Live. Acompanhe pelo grupo.' : APOIO_LISTA}</p>
          <a className="as-btn pri to-btn" href={TORNEIO.grupo} target="_blank" rel="noopener noreferrer">
            <Ico n="chat" />{acompanhando ? 'Acompanhar no grupo' : 'Quero participar'}<span className="to-sr"> (abre em nova aba)</span><Ico n="ext" s={16} />
          </a>
          <p className="to-abre">Abre o grupo no WhatsApp</p>
        </div>
      </div>
      <div className="to-premios">
        <div className="to-k"><Ico n="trophy" s={14} />Prêmios</div>
        <div className="to-placas">
          {([1, 2] as const).map(l => {
            const p = PREMIOS_TORNEIO[l]
            return (
              <div key={l} className={`to-placa ${l === 1 ? 'ouro' : 'prata'}`}>
                <span className="to-aba"><Ico n="trophy" s={14} />{l}º lugar</span>
                <div className="to-placa-b"><div className="to-placa-in">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="to-foto"><img src={p.img} alt={p.alt} width={p.w} height={p.h} loading="lazy" decoding="async" /></div>
                  <p className="to-nome"><small>{p.linha}</small><strong>{p.nome}</strong><span>{p.pacotes}</span></p>
                </div></div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="to-pe">
        <details className="to-como">
          <summary>Como funciona<Ico n="down" /></summary>
          <ol className="to-passos">
            <li>Coloque seu nome na lista de interessados no grupo da Escolinha.</li>
            <li>No dia, o link da sala no Discord chega pelo grupo.</li>
            <li>As partidas são no aplicativo Pokémon TCG Live. Deixe a conta e o deck prontos antes das 19h.</li>
          </ol>
        </details>
        <Organizacao />
      </div>
      <style>{TO_CSS}</style>
    </section>
    {!acompanhando && doSet.length > 0 && (
      <TrilhoVenda titulo="Jogue com Reinado Delta" frase="Cartas e selados do set dos prêmios à venda no Marketplace da Bynx." itens={doSet} bloco="torneio" className="to-vendas" />
    )}
    </>
  )
}

function Organizacao({ rotulo = true }: { rotulo?: boolean }) {
  const [a, b] = TORNEIO.organizacao
  return (
    <p className="to-org">
      {rotulo && <em>Organização:</em>}
      <a href={IG(a)} target="_blank" rel="noopener noreferrer">@{a}</a>&nbsp;e&nbsp;<a href={IG(b)} target="_blank" rel="noopener noreferrer">@{b}</a>
    </p>
  )
}

function FotoLugar({ p }: { p: LugarTorneio }) {
  const [falhou, setFalhou] = useState(false)
  return (
    <span className="to-ft">
      {p.foto && !falhou
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={urlFoto(p.foto)} alt="" width={256} height={256} onError={() => setFalhou(true)} />
        : <span className="to-ini" aria-hidden="true">{inicial(p.instagram)}</span>}
      <span className="to-tr" aria-hidden="true"><Ico n="trophy" s={14} /></span>
    </span>
  )
}

function FolhaResultado({ resultado, onFechar }: { resultado: ResultadoTorneio; onFechar: () => void }) {
  const [ok, setOk] = useState('')
  // Dois lugares: o 2o sobe primeiro e o 1o chega por ultimo.
  const atraso = { 1: 0.12, 2: 0 }
  const podio = [...resultado.podio].sort((x, y) => x.lugar - y.lugar)

  async function compartilhar() {
    const url = `${window.location.origin}/pokecreatorsclub?resultado=1#torneio`
    const titulo = 'Resultado do 1º Torneio Online de TCG do Poké Creators Club'
    try {
      if (navigator.share) { await navigator.share({ title: titulo, url }); return }
      await navigator.clipboard.writeText(url)
      setOk('Link copiado'); setTimeout(() => setOk(''), 2000)
    } catch { /* a pessoa cancelou o compartilhamento */ }
  }

  return (
    <Folha titulo="Resultado do 1º Torneio Online de TCG" onFechar={onFechar} classe="to-folha"
      cabeca={
        <div className="to-cab">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="" width={520} height={486} />
          <div><div className="as-eye">Resultado</div><h3 className="as-h3">1º Torneio Online de TCG</h3></div>
        </div>
      }>
      <span className="to-deco" aria-hidden="true"><span className="to-bola" /></span>
      <p className="to-servico">18 de dezembro de 2026{resultado.participantes ? ` · ${resultado.participantes} jogadores` : ''}</p>
      <ol className="to-pod festa" aria-label="Pódio">
        {podio.map(p => (
          <li key={p.lugar} className={`to-lu l${p.lugar}`} style={{ ['--d' as string]: `${atraso[p.lugar]}s` }}>
            <div className="to-lu-top">
              <FotoLugar p={p} />
              <span className="to-sr">{p.lugar}º lugar, </span>
              <a className="to-at" href={IG(p.instagram)} target="_blank" rel="noopener noreferrer">
                <span><Arroba h={p.instagram} /></span><span className="to-sr"> (abre o Instagram em nova aba)</span>
              </a>
              <span className="to-sr">, {PREMIOS_TORNEIO[p.lugar].linha} {PREMIOS_TORNEIO[p.lugar].nome}</span>
            </div>
            <div className="to-deg" aria-hidden="true"><b>{p.lugar}º</b><small>lugar</small></div>
          </li>
        ))}
      </ol>
      <div className="to-k"><Ico n="gift" s={14} />Prêmios</div>
      <ul className="to-pr">
        {podio.map(p => {
          const pr = PREMIOS_TORNEIO[p.lugar]
          return (
            <li key={p.lugar} className={`l${p.lugar}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="to-pr-f"><img src={pr.img} alt="" width={pr.w} height={pr.h} /></span>
              <span className="to-pr-t"><small>{p.lugar}º lugar · <Arroba h={p.instagram} /></small><strong>{pr.linha} {pr.nome}</strong></span>
            </li>
          )
        })}
      </ul>
      <p className="to-obr">Obrigado a todo mundo que jogou, e à organização:</p>
      <Organizacao rotulo={false} />
      <div className="to-acoes">
        <button type="button" className="as-btn to-share" onClick={compartilhar}><Ico n="share" />Compartilhar o resultado</button>
        <button type="button" className="as-btn to-fechar" onClick={onFechar}>Fechar</button>
      </div>
      <p className="to-ok" aria-live="polite">{ok}</p>
    </Folha>
  )
}

const TO_CSS = `
.to{--pl-verm:var(--bx-red);--pl-verm-rgb:239,68,68;--pl-verm-solido:#dc2626;--pl-claro-2:rgba(255,255,255,.8);
  position:relative;isolation:isolate;overflow:hidden;margin-top:12px;border-radius:20px;padding:18px 14px;scroll-margin-top:72px;
  display:flex;flex-direction:column;gap:16px;min-width:0;color:var(--bx-text);
  background:radial-gradient(60% 40% at 50% 0%,rgba(var(--pl-verm-rgb),.22),transparent 70%),var(--bx-bg);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}
.to::before,.to::after{content:"";position:absolute;z-index:-1;width:96px;height:96px;opacity:.55;pointer-events:none;
  background:repeating-linear-gradient(-40deg,var(--pl-verm) 0 10px,transparent 10px 18px,rgba(255,255,255,.9) 18px 22px,transparent 22px 34px)}
.to::before{top:0;left:0;clip-path:polygon(0 0,100% 0,0 100%)}
.to::after{right:0;bottom:0;clip-path:polygon(100% 0,100% 100%,0 100%)}
.to-bola{position:absolute;z-index:-1;top:-110px;right:-110px;width:220px;height:220px;border-radius:50%;border:22px solid rgba(255,255,255,.05);pointer-events:none}
.to-bola::before{content:"";position:absolute;left:-22px;right:-22px;top:50%;height:22px;margin-top:-11px;background:rgba(255,255,255,.05)}
.to-bola::after{content:"";position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:var(--bx-bg);box-shadow:0 0 0 14px rgba(255,255,255,.05)}
.to-logo-col{display:flex;justify-content:center}
.to-logo{position:relative;width:min(200px,64%);aspect-ratio:520/486}
.to-logo img{display:block;width:100%;height:100%;filter:drop-shadow(0 10px 24px rgba(0,0,0,.55))}
.to-logo::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;
  background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%) no-repeat;background-size:250% 100%;background-position:120% 0;
  -webkit-mask:url(${LOGO}) center/contain no-repeat;mask:url(${LOGO}) center/contain no-repeat}
.to-logo.brilha::after{animation:to-brilho .7s ease 1 both}
@keyframes to-brilho{0%{opacity:1;background-position:120% 0}100%{opacity:1;background-position:-20% 0}}
.to-tx{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;min-width:0}
.to-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.02em;border:1px solid rgba(var(--pl-verm-rgb),.55);background:rgba(var(--pl-verm-rgb),.12);color:var(--bx-text);font-variant-numeric:tabular-nums}
.to-chip.dia,.to-chip.agora{background:var(--pl-verm-solido);border-color:transparent;color:#fff}
.to-chip.agora::before{content:"";width:7px;height:7px;border-radius:50%;background:#fff}
.to-chip.fim{border-color:var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text-2)}
.to-h{margin:0;font-size:24px;font-weight:800;font-style:italic;text-transform:uppercase;letter-spacing:-.01em;line-height:1.05;text-wrap:balance}
.to-h b{color:var(--pl-verm);font-weight:800}
.to-data-w{position:relative;width:100%;padding:0 18px}
.to-data-w>i{position:absolute;top:50%;width:12px;height:3px;background:var(--pl-verm);border-radius:2px}
.to-data-w>i:nth-of-type(1){left:2px;margin-top:-5px;transform:rotate(22deg)}
.to-data-w>i:nth-of-type(2){left:2px;margin-top:3px;transform:rotate(-22deg)}
.to-data-w>i:nth-of-type(3){right:2px;margin-top:-5px;transform:rotate(-22deg)}
.to-data-w>i:nth-of-type(4){right:2px;margin-top:3px;transform:rotate(22deg)}
.to-data{display:grid;grid-template-columns:minmax(0,1fr) 1px minmax(0,1fr);align-items:center;min-height:44px;border:1.5px solid var(--pl-verm);border-radius:999px;background:rgba(8,10,15,.6);font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--bx-text)}
.to-data>span{display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;padding:0 6px}
.to-data>span .as-ico{color:var(--pl-verm)}
.to-data>b{width:1px;height:20px;background:rgba(var(--pl-verm-rgb),.6)}
.to-onde{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 14px;font-size:12.5px;font-weight:600;color:var(--pl-claro-2)}
.to-onde span{display:inline-flex;align-items:center;gap:6px}
.to-sub{margin:0;font-size:13.5px;line-height:1.45;color:var(--pl-claro-2);max-width:44ch}
.to-acao{display:flex;flex-direction:column;align-items:stretch;gap:8px;width:100%}
.to-apoio{margin:0;font-size:13px;line-height:1.45;color:var(--bx-text)}
.to-btn{min-height:52px;width:100%;font-size:16px;border-radius:12px}
.to-abre{margin:0;font-size:12px;color:var(--bx-text-2)}
.to-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.to-premios{display:flex;flex-direction:column;gap:10px;min-width:0}
.to-k{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pl-claro-2);display:flex;align-items:center;gap:6px}
.to-k .as-ico{color:var(--pl-verm)}
.to-placas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.to-placa{position:relative;padding-top:12px;min-width:0;transition:transform .15s ease}
.to-placa-b{height:100%;padding:2px;background:var(--pl-verm);clip-path:polygon(5% 0,100% 0,95% 100%,0 100%)}
.to-placa.prata .to-placa-b{background:var(--bx-text-2)}
.to-placa-in{height:100%;display:flex;flex-direction:column;gap:8px;padding:20px 12px 12px;clip-path:polygon(5% 0,100% 0,95% 100%,0 100%);background:linear-gradient(var(--bx-surface),var(--bx-surface)),var(--bx-bg)}
.to-aba{position:absolute;top:0;left:10px;z-index:1;display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 10px;font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;transform:skewX(-8deg);background:var(--pl-verm-solido);color:#fff;box-shadow:0 4px 10px rgba(0,0,0,.4)}
.to-placa.prata .to-aba{background:var(--bx-text);color:var(--bx-brand-ink)}
.to-foto{aspect-ratio:1;border-radius:10px;background:var(--bx-text);padding:4px;margin:0 4px}
.to-foto img{display:block;width:100%;height:100%;object-fit:contain}
.to-nome{margin:0;display:flex;flex-direction:column;gap:1px;padding:0 4px;text-align:left}
.to-nome small{font-size:12px;font-weight:600;color:var(--bx-text-2)}
.to-nome strong{font-size:16px;font-weight:800;font-style:italic;text-transform:uppercase;line-height:1.05;color:var(--pl-verm);letter-spacing:-.01em}
.to-placa.prata .to-nome strong{color:var(--bx-text)}
.to-nome span{font-size:12px;color:var(--pl-claro-2);margin-top:3px}
.to-pe{display:flex;flex-direction:column;gap:12px;min-width:0}
.to-como{border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12)}
.to-como summary{list-style:none;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:14.5px;cursor:pointer}
.to-como summary::-webkit-details-marker{display:none}
.to-como summary .as-ico{color:var(--bx-text-2);transition:transform .15s ease}
.to-como[open] summary .as-ico{transform:rotate(180deg)}
.to-como summary:focus-visible{outline:2px solid var(--bx-text);outline-offset:2px;border-radius:6px}
.to-passos{list-style:none;margin:0;padding:0 0 14px;display:flex;flex-direction:column;gap:10px;counter-reset:p}
.to-passos li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.45;color:var(--pl-claro-2);counter-increment:p}
.to-passos li::before{content:counter(p);flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:var(--bx-text);border:1.5px solid var(--pl-verm);background:rgba(var(--pl-verm-rgb),.12)}
.to-org{margin:0;align-self:center;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:4px;min-height:44px;padding:0 12px;border-radius:999px;border:1px solid var(--pl-verm);background:var(--bx-bg);font-size:11.5px;font-weight:700;color:var(--bx-text);white-space:nowrap}
.to-org em{font-style:normal;color:var(--pl-verm);text-transform:uppercase;margin-right:2px}
.to-org a{display:inline-flex;align-items:center;min-height:44px;padding:0 1px;text-decoration:none;color:inherit}
.to-org a:hover{text-decoration:underline;text-underline-offset:3px}
.to-org a:focus-visible{outline:2px solid var(--bx-text);outline-offset:-6px;border-radius:6px}
.to.curta .to-logo{width:120px}
.to-camp{margin:0;display:flex;align-items:flex-start;justify-content:center;gap:6px;font-size:14px;font-weight:600;color:var(--bx-text-2);max-width:100%;text-align:left}
.to-camp .as-ico{color:var(--pl-verm);margin-top:1px;flex:none}
.to-camp b{color:var(--bx-text);font-weight:800;overflow-wrap:anywhere}

.to-folha{--pl-verm:var(--bx-red);--pl-verm-rgb:239,68,68;--pl-verm-solido:#dc2626;--pl-claro-2:rgba(255,255,255,.8);
  position:relative;isolation:isolate;gap:8px;color:var(--bx-text);
  background:radial-gradient(70% 30% at 50% 0%,rgba(var(--pl-verm-rgb),.18),transparent 70%),var(--bx-bg-elev)}
.to-folha p,.to-folha ol,.to-folha ul{margin:0}
.to-deco{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;border-radius:inherit}
.to-deco::before{content:"";position:absolute;top:0;left:0;width:72px;height:72px;opacity:.45;clip-path:polygon(0 0,100% 0,0 100%);
  background:repeating-linear-gradient(-40deg,var(--pl-verm) 0 10px,transparent 10px 18px,rgba(255,255,255,.9) 18px 22px,transparent 22px 34px)}
.to-deco .to-bola{top:auto;right:auto;bottom:-90px;left:-90px;width:180px;height:180px;border-width:18px}
.to-deco .to-bola::before{left:-18px;right:-18px;height:18px;margin-top:-9px}
.to-deco .to-bola::after{width:44px;height:44px;margin:-22px 0 0 -22px;background:var(--bx-bg-elev);box-shadow:0 0 0 11px rgba(255,255,255,.05)}
.to-folha .as-eye{color:var(--pl-verm)}
.to-cab{display:flex;align-items:center;gap:10px;min-width:0}
.to-cab img{width:48px;height:auto;flex:none;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5))}
.to-cab .as-h3{font-size:17px;font-weight:800;font-style:italic;text-transform:uppercase;letter-spacing:-.01em;line-height:1.1;margin:0}
.to-servico{text-align:center;font-size:12.5px;font-weight:600;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.to-pod{list-style:none;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,150px));justify-content:center;align-items:end;gap:12px}
.to-lu{display:flex;flex-direction:column;align-items:center;min-width:0}
.to-lu-top{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;margin-bottom:6px}
.to-ft{--ft:68px;--anel:var(--bx-text);position:relative;width:var(--ft);height:var(--ft);flex:none;border-radius:50%;box-shadow:0 0 0 3px var(--bx-bg-elev),0 0 0 6px var(--anel);margin:6px}
.l1 .to-ft{--ft:88px;--anel:var(--pl-verm)}
.to-ft img,.to-ini{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:50% 30%}
.to-ft::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);pointer-events:none}
.to-ini{display:grid;place-items:center;font-weight:800;font-size:calc(var(--ft) * .4);line-height:1;background:var(--bx-surface-3);color:var(--bx-text)}
.l1 .to-ini{background:rgba(var(--pl-verm-rgb),.14);color:var(--pl-verm)}
.to-tr{position:absolute;right:-4px;bottom:-4px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--bx-text);color:var(--bx-brand-ink);box-shadow:0 0 0 2px var(--bx-bg-elev)}
.l1 .to-tr{background:var(--pl-verm-solido);color:#fff}
.to-at{display:flex;align-items:center;justify-content:center;min-height:44px;max-width:100%;padding:0 2px;text-align:center;text-decoration:none;font-size:13px;font-weight:700;line-height:1.25;color:var(--bx-text);overflow-wrap:anywhere;border-radius:8px}
.to-at>span:first-child{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden}
.l1 .to-at{font-size:14px;font-weight:800}
.to-at:hover{text-decoration:underline;text-underline-offset:3px}
.to-at:focus-visible{outline:2px solid var(--bx-text);outline-offset:-2px}
.to-deg{position:relative;overflow:hidden;width:100%;height:72px;border-radius:8px 8px 0 0;clip-path:polygon(6% 0,94% 0,100% 100%,0 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transform-origin:50% 100%;background:var(--bx-text);color:var(--bx-brand-ink)}
.to-deg b{font-size:40px;font-weight:800;font-style:italic;line-height:.9;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.to-deg small{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.l1 .to-deg{height:96px;background:var(--pl-verm-solido);color:#fff}
.l1 .to-deg::after{content:"";position:absolute;inset:0;opacity:0;pointer-events:none;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.3) 50%,transparent 65%) no-repeat;background-size:250% 100%;background-position:120% 0}
.to-pod.festa .to-deg{animation:to-sobe .2s ease var(--d,0s) 1 both}
.to-pod.festa .to-lu-top{animation:to-entra .2s ease calc(var(--d,0s) + .2s) 1 both}
.to-pod.festa .l1 .to-deg::after{animation:to-passa .6s ease calc(var(--d,0s) + .25s) 1 both}
@keyframes to-sobe{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes to-entra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes to-passa{0%{opacity:1;background-position:120% 0}100%{opacity:1;background-position:-20% 0}}
.to-pr{list-style:none;padding:0;display:flex;flex-direction:column;gap:8px}
.to-pr li{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 12px 8px 8px;border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);min-width:0}
.to-pr-f{width:48px;height:48px;flex:none;border-radius:8px;background:var(--bx-text);padding:3px}
.to-pr-f img{display:block;width:100%;height:100%;object-fit:contain}
.to-pr-t{display:flex;flex-direction:column;gap:1px;min-width:0}
.to-pr-t small{font-size:12px;font-weight:700;color:var(--bx-text-2);overflow-wrap:anywhere}
.to-pr-t strong{font-size:14px;font-weight:800;font-style:italic;text-transform:uppercase;line-height:1.15;color:var(--bx-text);letter-spacing:-.01em}
.to-pr .l1 .to-pr-t strong{color:var(--pl-verm)}
.to-obr{text-align:center;font-size:13px;line-height:1.45;color:var(--pl-claro-2)}
.to-folha .to-org{margin-top:-4px;align-self:center}
.to-folha .to-org a{padding:0 2px}
.to-acoes{display:flex;flex-direction:column;gap:8px}
.to-share{min-height:48px;width:100%}
.to-share .as-ico{color:var(--bx-text-2)}
.to-fechar{width:100%;border-color:transparent;color:var(--bx-text-2)}
.to-ok{font-size:12.5px;font-weight:700;color:var(--bx-green);text-align:center}
.to-ok:empty{display:none}
@media (min-width:640px){
  .to-folha{padding:12px 16px 20px;gap:12px}
  .to-deco::before{width:120px;height:120px}
  .to-cab img{width:60px}
  .to-cab .as-h3{font-size:20px}
  .to-pod{grid-template-columns:repeat(2,minmax(0,180px));gap:16px}
  .to-ft{--ft:88px}
  .l1 .to-ft{--ft:112px}
  .to-at{font-size:14px}
  .l1 .to-at{font-size:15px}
  .to-deg{height:96px}
  .l1 .to-deg{height:128px}
  .to-deg b{font-size:52px}
  .to-pr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .to-pr-f{width:56px;height:56px}
  .to-acoes{flex-direction:row-reverse}
  .to-acoes .as-btn{flex:1}
}
@media (min-width:1024px){
  .to{margin-top:28px;padding:28px;display:grid;grid-template-columns:260px minmax(0,1fr) minmax(0,380px);column-gap:32px;row-gap:20px;align-items:center}
  .to::before,.to::after{width:160px;height:160px;opacity:.7}
  .to-bola{width:340px;height:340px;top:-170px;right:-170px;border-width:30px}
  .to-bola::before{left:-30px;right:-30px;height:30px;margin-top:-15px}
  .to-logo{width:260px}
  .to-tx{align-items:flex-start;text-align:left}
  .to-h{font-size:34px}
  .to-onde{justify-content:flex-start}
  .to-sub{font-size:14px}
  .to-data-w{max-width:340px}
  .to-acao{align-items:flex-start}
  .to-btn{width:auto;min-width:280px;padding:0 24px}
  .to-placa-in{padding:22px 14px 14px}
  .to-nome strong{font-size:20px}
  .to-pe{grid-column:1/-1;flex-direction:row;align-items:flex-start;justify-content:space-between;gap:24px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px}
  .to-como{flex:1;border:0}
  .to-como[open] .to-passos{flex-direction:row;gap:24px}
  .to-como[open] .to-passos li{flex:1}
  .to-org{align-self:flex-start;flex:none}
  .to.curta{grid-template-columns:140px minmax(0,1fr)}
  .to.curta .to-logo{width:140px}
  .to.curta .to-camp{justify-content:flex-start}
}
@media (hover:hover) and (min-width:1024px){ .to-placa:hover{transform:translateY(-2px)} }
@media (prefers-reduced-motion:reduce){
  .to-logo.brilha::after,.to-pod.festa .to-deg,.to-pod.festa .to-lu-top,.to-pod.festa .l1 .to-deg::after{animation:none}
  .to-placa,.to-como summary .as-ico{transition:none}
  .to-placa:hover{transform:none}
}
`
