'use client'

// Álbum do Club (opção C, aprovada em 17/11/2026; plano da Fase 1 de 19/11): o contador, a
// carta em destaque e o trilho das 12 (grade 6x2 com legenda no computador). A carta nova abre
// sozinha, fechada, e vira ao toque (grava revelada_em); o contador conta só as viradas. A carta
// bloqueada mostra o verso, a missão e o botão que leva ao lugar certo: o banco não envia a arte,
// o nome nem o texto de carta que a pessoa ainda não ganhou. Com todas viradas, o destaque vira
// a porta do set físico.
//
// Fora do AppLayout (casca do Club): fonte e gutter declarados aqui, só tokens --bx-* / --ac-*.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { dataCurta } from '@/lib/amigoSecreto'
import { ALBUM, ALBUM_ORGANIZAR, ALBUM_REGRAS, CLUB } from '@/lib/pcc/rotas'
import {
  cartaInicial, carregarAlbum, missaoDe, nn, textoGanha, tituloDe, virarCartas,
  type AlbumMinha, type CartaAlbum, type EdicaoAlbum, type RespostaAlbum,
} from '@/lib/pcc/album'
import { meusPapeis } from '@/lib/pcc/albumOrg'
import { AS_CSS, Ico, VoltarClub } from '../amigo-secreto/estilo'
import { CARTA_CSS, CartaDoAlbum, CartaFrente, CartaVerso, Pilha } from './CartaClub'
import { FOLHAS_CSS, FolhaFicha, FolhaSet } from './FolhasAlbum'

type Fase = 'lendo' | 'ok' | 'sem' | 'nao_membro' | 'falhou'

export default function AlbumClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [fase, setFase] = useState<Fase>('lendo')
  const [album, setAlbum] = useState<AlbumMinha | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  // O estado de partida ja e 'lendo'; quem pede de novo (botao) volta para 'lendo' antes de ler.
  const aplicar = useCallback((r: RespostaAlbum) => {
    if (r.erro) { setFase(r.erro); return }
    if (!r.album) { setFase('sem'); return }
    setAlbum(r.album)
    setFase('ok')
  }, [])

  useEffect(() => {
    if (!uid) return
    let vivo = true
    carregarAlbum().then(r => { if (vivo) aplicar(r) })
    return () => { vivo = false }
  }, [uid, aplicar])

  // Quem tem o papel "colecao" ganha o atalho para organizar em qualquer estado da página, até sem
  // ser membro do Club: a área de organização não exige. Sem resposta, nenhum atalho.
  const [organiza, setOrganiza] = useState(false)
  useEffect(() => {
    if (!uid) return
    let vivo = true
    meusPapeis().then(p => { if (vivo) setOrganiza(p.includes('colecao')) })
    return () => { vivo = false }
  }, [uid])

  const recarregar = () => { setFase('lendo'); carregarAlbum().then(aplicar) }

  const entrar = () => openLogin({ next: ALBUM, cta: 'Entrar no Club' })

  if (uid === undefined) return <Casca logado={false} onEntrar={() => {}}><div className="as-center"><span className="as-meta">Abrindo...</span></div></Casca>

  if (uid === null) {
    return (
      <Casca logado={false} onEntrar={entrar}>
        <div className="as-center">
          <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="colecao" s={40} /></span>
          <h1 className="as-h2">Álbum do Club</h1>
          <p className="as-p">Entre para abrir o seu álbum.</p>
          <button type="button" className="as-btn pri cta" style={{ maxWidth: 320 }} onClick={entrar}>Entrar</button>
          <Link href={`/cadastro?next=${encodeURIComponent(ALBUM)}`} className="as-btn" style={{ maxWidth: 320 }}>Criar conta</Link>
          <Link href={ALBUM_REGRAS} className="as-btn lnk">Ler a regra do álbum</Link>
        </div>
      </Casca>
    )
  }

  if (fase === 'lendo') return <Casca logado organiza={organiza} onEntrar={() => {}}><div className="as-center"><span className="as-meta">Abrindo o álbum...</span></div></Casca>

  if (fase === 'nao_membro') {
    return (
      <Casca logado organiza={organiza} onEntrar={() => {}}>
        <div className="as-center">
          <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="colecao" s={40} /></span>
          <h1 className="as-h2">Álbum do Club</h1>
          <p className="as-p">O álbum é dos membros do Club. Entrar leva um minuto e vale a carta 01.</p>
          <Link href={`${CLUB}?entrar=1`} className="as-btn pri cta" style={{ maxWidth: 320 }}>Entrar no Club</Link>
          <Link href={ALBUM_REGRAS} className="as-btn lnk">Ler a regra do álbum</Link>
        </div>
      </Casca>
    )
  }

  if (fase === 'falhou') {
    return (
      <Casca logado organiza={organiza} onEntrar={() => {}}>
        <h1 className="as-h2">Álbum do Club</h1>
        <div className="as-erro" role="alert">Não conseguimos abrir o álbum.</div>
        <button type="button" className="as-btn" onClick={recarregar}>Tentar de novo</button>
      </Casca>
    )
  }

  if (fase === 'sem' || !album) {
    return (
      <Casca logado organiza={organiza} onEntrar={() => {}}>
        <div className="as-center">
          <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="colecao" s={40} /></span>
          <h1 className="as-h2">Álbum do Club</h1>
          <p className="as-p">O álbum ainda não abriu. Quando abrir, as suas cartas aparecem aqui.</p>
          <Link href={CLUB} className="as-btn" style={{ maxWidth: 320 }}>Voltar ao Club</Link>
        </div>
      </Casca>
    )
  }

  return <Casca logado organiza={organiza} onEntrar={() => {}}><AlbumView album={album} onAlbum={setAlbum} /></Casca>
}

function Casca({ children, logado, organiza, onEntrar }: { children: ReactNode; logado: boolean; organiza?: boolean; onEntrar: () => void }) {
  return (
    <div className="as al">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Álbum do Club</span>
          {logado
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm" style={{ minHeight: 44, width: 'auto' }} onClick={onEntrar}>Entrar</button>}
        </div>
      </header>
      <main className="bx-gutter">
        <div className="as-wrap as-bd">
          {organiza && <Link href={ALBUM_ORGANIZAR} className="as-btn sm al-org"><Ico n="menu" s={16} />Organizar o álbum</Link>}
          {children}
        </div>
      </main>
      <style>{AS_CSS + CARTA_CSS + FOLHAS_CSS + AL_CSS}</style>
    </div>
  )
}

/** Linha de prazo sob o contador: até quando dá para ganhar cartas nesta edição. */
function textoPrazo(e: EdicaoAlbum): string {
  if (e.status === 'encerrada') return 'Edição encerrada.'
  if (!e.fecha_em) return ''
  return e.ganhando ? `Você ganha cartas até ${dataCurta(e.fecha_em)}.` : `O prazo para ganhar cartas acabou em ${dataCurta(e.fecha_em)}.`
}

/** Legenda sob a miniatura (só aparece no computador). */
function legendaDe(c: CartaAlbum): ReactNode {
  if (c.estado === 'ganha' || c.estado === 'previa') return <b>{tituloDe(c)}</b>
  if (c.estado === 'nova') return <b>Virar</b>
  return tituloDe(c)
}

function rotuloDe(c: CartaAlbum, total: number): string {
  const base = `Carta ${nn(c.numero)} de ${total}`
  if (c.estado === 'nova') return `${base}, nova, fechada`
  if (c.estado === 'ganha') return `${base}, ${tituloDe(c)}`
  if (c.estado === 'previa') return `${base}, ${tituloDe(c)}, prévia`
  return `${base}, bloqueada, ${tituloDe(c)}`
}

export function AlbumView({ album, onAlbum }: { album: AlbumMinha; onAlbum: (a: AlbumMinha) => void }) {
  const [sel, setSel] = useState<number | null>(() => cartaInicial(album.cartas))
  // Cartas viradas nesta visita: ganham o chip "Nova no álbum" e a animação de virar.
  const [recem, setRecem] = useState<number[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [folha, setFolha] = useState<null | 'ficha' | 'set'>(null)
  const fechar = useCallback(() => setFolha(null), [])

  const { cartas, total, reveladas, edicao } = album
  const completo = total > 0 && reveladas === total
  const novas = cartas.filter(c => c.estado === 'nova')
  const todasNovas = total > 0 && novas.length === total && reveladas === 0
  const carta = cartas.find(c => c.numero === sel) || null
  // A "próxima carta" é a primeira que ainda não é da pessoa (as novas já são dela).
  const proximaAGanhar = cartas.find(c => c.estado !== 'ganha' && c.estado !== 'nova') || null

  async function virar(numeros?: number[]) {
    if (ocupado) return
    setOcupado(true); setErro('')
    const r = await virarCartas(album, numeros)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    onAlbum(r.album)
    setRecem(rs => Array.from(new Set([...rs, ...r.viradas])))
    if (numeros && numeros.length === 1) setSel(numeros[0])
    else setSel(r.album.reveladas >= r.album.total ? null : r.viradas[0] ?? cartaInicial(r.album.cartas))
  }

  const escolher = (n: number) => { setSel(n); setErro('') }

  return (
    <>
      <h1 className="al-sr">Álbum do Club, edição {edicao.edicao}</h1>
      <div className="al-corpo">
        <div className="al-cab">
          <div className="al-cnt"><b className={completo ? 'ok' : ''}>{reveladas}</b><span>de {total} cartas</span></div>
          {textoPrazo(edicao) && <p className="al-prazo">{textoPrazo(edicao)}</p>}
        </div>

        {edicao.previa && <div className="as-note strong" role="status"><strong>Prévia da organização.</strong> Só quem organiza o álbum enxerga esta edição, até ela abrir para os membros.</div>}
        {erro && <div className="as-erro" role="alert">{erro}</div>}

        <section className="as-mis al-foco" aria-label="Carta em destaque" aria-busy={ocupado}>
          {todasNovas ? (
            <>
              <div className="fc glow"><Pilha cartas={novas} total={total} fechadas /></div>
              <div className="ft">
                <div className="tp">
                  <div className="kk">Cartas novas</div>
                  <h2>Você ganhou as {total}</h2>
                  <p>As cartas chegaram fechadas.</p>
                </div>
                <button type="button" className="as-btn pri" onClick={() => virar()} disabled={ocupado}>{ocupado ? 'Virando...' : `Virar as ${total}`}</button>
              </div>
            </>
          ) : !carta ? (
            <FocoSet album={album} onSet={() => setFolha('set')} />
          ) : (
            <FocoCarta
              album={album} carta={carta} novas={novas.length} ocupado={ocupado}
              proxima={proximaAGanhar?.numero === carta.numero} recem={recem.includes(carta.numero)} completo={completo}
              onVirar={virar} onFicha={() => setFolha('ficha')} onSet={() => { setSel(null); setErro('') }}
              onProxima={() => { setSel(cartaInicial(cartas)); setErro('') }}
            />
          )}
        </section>

        <div className="al-trilho" role="group" aria-label="As cartas do álbum">
          {cartas.map(c => (
            <button key={c.numero} type="button" className="al-slot" aria-pressed={c.numero === sel} aria-label={rotuloDe(c, total)} onClick={() => escolher(c.numero)}>
              <CartaDoAlbum carta={c} total={total} tam="mini" sel={c.numero === sel} virou={recem.includes(c.numero)} />
              <span className="cap">{legendaDe(c)}</span>
            </button>
          ))}
        </div>

        <details className="as-card al-como">
          <summary>Como ganhar <Ico n="down" s={16} /></summary>
          <div className="al-mis">
            {cartas.map(c => {
              const m = missaoDe(c)
              const ok = c.estado === 'ganha' || c.estado === 'nova'
              return (
                <div key={c.numero} className="al-mi">
                  <span className={`as-st${ok ? ' ok' : m?.confere ? ' opt' : ''}`}>{ok && <Ico n="check" s={13} />}</span>
                  <div className="tx">
                    <b>{m?.titulo || 'Surpresa'}</b>
                    <small>{c.secreta && !ok ? 'Aparece sozinha quando você avança no álbum.' : `${c.como_ganhar}${m?.confere && !ok ? `${/[.!?]$/.test(c.como_ganhar) ? '' : '.'} A organização confere.` : ''}`}</small>
                  </div>
                  <span className="nr">{nn(c.numero)}</span>
                </div>
              )
            })}
          </div>
          <Link href={ALBUM_REGRAS} className="as-btn lnk al-regra">Ler a regra completa do álbum</Link>
        </details>

        {!completo && !todasNovas && (
          <div className="al-camis"><Ico n="sacola" s={16} /><span>Camiseta: {total} cartas juntas, após o pagamento.</span></div>
        )}
      </div>

      {folha === 'ficha' && carta && (carta.estado === 'ganha' || carta.estado === 'previa') && <FolhaFicha carta={carta} album={album} onFechar={fechar} />}
      {folha === 'set' && <FolhaSet album={album} onAlbum={onAlbum} onFechar={fechar} />}
    </>
  )
}

/** Destaque do álbum completo: a porta do set físico. */
function FocoSet({ album, onSet }: { album: AlbumMinha; onSet: () => void }) {
  const { retirada, pode_pedir_set: pode, set_esgotado: esgotado, prazo_set_passou: prazoPassou, edicao, cartas, total } = album
  let texto = 'Em breve você poderá pedir o seu set.'
  if (retirada) texto = 'Recebemos o seu pedido. A organização chama você para combinar o frete.'
  else if (pode) texto = `O Edu monta o set com as ${total} cartas e envia para você. Você paga só o frete.`
  else if (esgotado) texto = 'Os sets desta edição acabaram. O seu álbum continua guardado.'
  else if (edicao.previa) texto = 'O pedido do set abre quando a edição estiver aberta para os membros.'
  else if (prazoPassou) texto = 'O prazo para pedir o set desta edição acabou. O seu álbum continua guardado.'
  return (
    <>
      <div className="fc glow"><Pilha cartas={cartas} total={total} fechadas={false} /></div>
      <div className="ft">
        <div className="tp">
          <div className="kk">Álbum completo</div>
          <h2>Receber meu set em casa</h2>
          {retirada && <span className="as-chip fill">Pedido nº {retirada.numero}</span>}
          <p>{texto}</p>
        </div>
        {retirada
          ? <button type="button" className="as-btn" onClick={onSet}>Ver o pedido</button>
          : pode ? <button type="button" className="as-btn pri" onClick={onSet}>Receber meu set</button> : null}
      </div>
    </>
  )
}

/** Destaque de uma carta: a que abriu sozinha ou a que a pessoa tocou no trilho. */
function FocoCarta({ album, carta, novas, ocupado, proxima, recem, completo, onVirar, onFicha, onSet, onProxima }: {
  album: AlbumMinha; carta: CartaAlbum; novas: number; ocupado: boolean; proxima: boolean; recem: boolean; completo: boolean
  onVirar: (numeros?: number[]) => void; onFicha: () => void; onSet: () => void; onProxima: () => void
}) {
  const { total } = album
  const m = missaoDe(carta)
  const numero = `Carta ${nn(carta.numero)} de ${total}`
  const abre = (m?.botao && m.href) ? <Link href={m.href} className="as-btn pri">{m.botao}</Link> : null

  // Carta nova: chegou fechada, o toque vira. Com 3 ou mais esperando, o botão vira todas.
  if (carta.estado === 'nova') {
    return (
      <>
        <div className="fc glow">
          <button type="button" className="al-fc" onClick={() => onVirar([carta.numero])} disabled={ocupado} aria-label={`Virar a carta ${nn(carta.numero)}`}>
            <CartaVerso carta={carta} total={total} tam="f" nova />
          </button>
        </div>
        <div className="ft">
          <div className="tp">
            <div className="kk">Carta nova</div>
            <h2>{m?.titulo || `Carta ${nn(carta.numero)}`}</h2>
            <p>Chegou fechada. Toque para virar.</p>
          </div>
          <button type="button" className="as-btn pri" onClick={() => onVirar(novas >= 3 ? undefined : [carta.numero])} disabled={ocupado}>
            {ocupado ? 'Virando...' : novas >= 3 ? 'Virar todas' : 'Virar a carta'}
          </button>
        </div>
      </>
    )
  }

  // Carta ganha (e virada) ou liberada como prévia: a arte, o crédito e a data.
  if (carta.estado === 'ganha' || carta.estado === 'previa') {
    const ganha = carta.estado === 'ganha'
    return (
      <>
        <div className="fc glow">
          <button type="button" className="al-fc" onClick={onFicha} aria-label={`Ver a ficha da carta ${nn(carta.numero)}`}>
            <CartaFrente carta={carta} total={total} tam="f" virou={recem} />
          </button>
        </div>
        <div className="ft">
          <div className="tp">
            <div className="kk">{numero}</div>
            <h2>{tituloDe(carta)}</h2>
            {carta.homenageado && <p className="meta">Homenagem: {carta.homenageado}</p>}
            <p>{ganha ? textoGanha(carta) : carta.como_ganhar}</p>
            {recem && <span className="as-chip fill">Nova no álbum</span>}
            {!ganha && <span className="as-chip wait">Prévia: ainda não é sua</span>}
          </div>
          {!ganha && abre}
          {ganha && recem && !completo
            ? <button type="button" className="as-btn lnk" onClick={onProxima}>Ver a próxima</button>
            : <button type="button" className="as-btn lnk" onClick={onFicha}>Ver a ficha</button>}
          {ganha && completo && <button type="button" className="as-btn lnk" onClick={onSet}>Receber meu set</button>}
        </div>
      </>
    )
  }

  // Carta secreta: a missão não é anunciada.
  if (carta.estado === 'secreta') {
    return (
      <>
        <div className="fc"><CartaVerso carta={carta} total={total} tam="f" /></div>
        <div className="ft">
          <div className="tp">
            <div className="kk">{numero}</div>
            <h2>Surpresa</h2>
            <p>Continue ganhando cartas e descubra. Esta aparece sozinha.</p>
          </div>
        </div>
      </>
    )
  }

  // Carta bloqueada: o verso, a missão e o botão que leva ao lugar certo.
  return (
    <>
      <div className="fc"><CartaVerso carta={carta} total={total} tam="f" /></div>
      <div className="ft">
        <div className="tp">
          <div className="kk">{proxima ? 'Próxima carta' : numero}</div>
          <h2>{m?.titulo || `Carta ${nn(carta.numero)}`}</h2>
          <p>{carta.como_ganhar}</p>
          {m?.confere && <span className="as-chip wait"><Ico n="eye" s={13} />A organização confere</span>}
        </div>
        {abre}
      </div>
    </>
  )
}

const AL_CSS = `
.al-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.al-corpo{display:flex;flex-direction:column;gap:12px;min-width:0}
.al-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;flex-wrap:wrap}
.al-cnt{display:flex;align-items:baseline;gap:8px}
.al-cnt b{font-size:44px;font-weight:800;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.al-cnt b.ok{color:var(--bx-green)}
.al-cnt span{font-size:14px;color:var(--bx-text-2)}
.al-prazo{font-size:12.5px;color:var(--bx-text-3)}
.as-mis.al-foco{flex-direction:row;gap:12px;padding:12px}
.al-foco .fc{width:140px;flex:none;position:relative}
.al-foco .fc.glow:before{content:"";position:absolute;inset:-16px;background:radial-gradient(closest-side,rgba(var(--ac-1-rgb),.30),transparent);pointer-events:none}
.al-foco .fc>*{position:relative}
.al-fc{display:block;width:100%;padding:0;margin:0;background:transparent;border:0;cursor:pointer;border-radius:16px;transition:transform .15s ease}
.al-fc:hover:not(:disabled){transform:translateY(-2px)}
.al-fc:disabled{cursor:default;opacity:.85}
.al-fc:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.al-foco .ft{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:8px}
.al-foco .tp{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.al-foco .kk{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1)}
.al-foco h2{font-size:20px;font-weight:800;line-height:1.15;letter-spacing:-.01em;overflow-wrap:anywhere;text-wrap:balance}
.al-foco p{font-size:13px;color:var(--bx-text-2);line-height:1.4}
.al-foco p.meta{font-size:12px;color:var(--bx-text-3)}
.al-trilho{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.al-slot{display:flex;flex-direction:column;gap:7px;min-width:0;padding:0;margin:0;background:transparent;border:0;font:inherit;color:inherit;text-align:left;cursor:pointer;border-radius:10px}
.al-slot .cap{display:none}
.al-slot .cd,.al-slot .cv{transition:transform .15s ease}
.al-slot:hover .cd,.al-slot:hover .cv{transform:translateY(-2px)}
.al-slot:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.al-como{display:block;padding:4px 12px}
.al-como summary{list-style:none;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:14.5px;cursor:pointer;color:var(--bx-text)}
.al-como summary::-webkit-details-marker{display:none}
.al-como summary .as-ico{color:var(--bx-text-3);transition:transform .15s ease}
.al-como[open] summary .as-ico{transform:rotate(180deg)}
.al-mis{display:flex;flex-direction:column}
.al-mi{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--bx-border)}
.al-mi .tx{flex:1;min-width:0}
.al-mi .tx b{display:block;font-size:14px;font-weight:700}
.al-mi .tx small{display:block;font-size:11.5px;color:var(--bx-text-3);line-height:1.35}
.al-mi .nr{font-size:11px;font-weight:800;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.al-org{align-self:flex-end;width:auto}
.al-regra{align-self:flex-start;width:auto;min-height:44px;padding:0;margin-bottom:6px}
.al-camis{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--bx-text-2);padding:10px 12px;border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.al-camis .as-ico{color:var(--ac-1)}
@media (prefers-reduced-motion:reduce){.al-fc,.al-slot .cd,.al-slot .cv,.al-como summary .as-ico{transition:none}.al-fc:hover:not(:disabled),.al-slot:hover .cd,.al-slot:hover .cv{transform:none}}
@media (min-width:1024px){
  .al-corpo{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);gap:20px 32px;align-items:start}
  .al-corpo>*{grid-column:1}
  .al-corpo>.al-cab{grid-column:1/-1}
  .al-corpo>.al-foco{grid-column:2;grid-row:2/span 6;align-self:start;position:sticky;top:84px}
  .al-cnt b{font-size:56px}
  .as-mis.al-foco{flex-direction:column;align-items:center;text-align:center;padding:22px;gap:12px}
  .al-foco .fc{width:160px;margin-top:2px}
  .al-foco .ft{align-items:center;gap:12px;width:100%}
  .al-foco .tp{align-items:center}
  .al-foco .ft .as-btn{width:100%}
  .al-trilho{gap:22px 14px}
  .al-slot .cap{display:block;font-size:12.5px;line-height:1.3;color:var(--bx-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .al-slot .cap b{color:var(--bx-text);font-weight:700}
  .al-trilho .cd.mini{border-radius:11px;box-shadow:0 6px 18px rgba(0,0,0,.45)}
  .al-trilho .cd.mini .jan{left:6px;right:6px;top:6px;bottom:32px;border-radius:7px}
  .al-trilho .cd.mini .fita{left:7px;right:7px;bottom:6px;height:24px}
  .al-trilho .cd.mini .nn{font-size:10px;padding:2px 6px}
  .al-trilho .cd.mini .tot{display:inline}
  .al-trilho .cd.mini .pa .pn{display:block;font-size:48px}
  .al-trilho .cd.mini .pa .pl{display:block}
  .al-trilho .cv.mini{border-radius:11px;border-width:2px;box-shadow:0 6px 18px rgba(0,0,0,.4)}
  .al-trilho .cv.mini:before{inset:6px;border-radius:6px}
  .al-trilho .cv.mini:after{display:block;inset:12px;border-radius:4px}
  .al-trilho .cv.mini .mb{width:48%;margin-top:-12%}
  .al-trilho .cv.mini .cad{font-size:11px;bottom:11%}
  .al-trilho .cv.mini .cad .as-ico{display:block;width:14px;height:14px}
  .al-trilho .cv.mini .tot{display:inline}
  .al-trilho .cv.mini .logo{width:62%}
  .al-trilho .cv.mini .nv{font-size:9px;width:auto;height:auto;padding:2px 7px;top:8px;right:8px;left:auto}
  .al-trilho .cv.mini .eyeb{width:20px;height:20px;top:7px;right:7px}
  .al-trilho .cv.mini .eyeb .as-ico{width:12px;height:12px;display:block}
}
`
