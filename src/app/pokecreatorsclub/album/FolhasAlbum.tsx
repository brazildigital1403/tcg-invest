'use client'

// Folhas do Álbum do Club (mockup de 17/11/2026): a carta que chega fechada e vira ao toque,
// a ficha de uma carta ganha e o pedido do set físico. Folha de baixo para cima no celular,
// janela no computador (a mesma Folha das outras frentes).
//
// A folha de virar é a que a tarefa "Você ganhou uma carta" abre na casa: vira uma, ou todas
// de uma vez, e leva ao álbum. Cada virada grava revelada_em no banco (club_carta_virar) e
// devolve o álbum já atualizado para quem abriu a folha.

import { useState } from 'react'
import Link from 'next/link'
import { dataCurta } from '@/lib/amigoSecreto'
import { ALBUM } from '@/lib/pcc/rotas'
import { PASSOS_SET, missaoDe, nn, pedirSet, tituloDe, virarCartas, type AlbumMinha, type CartaAlbum } from '@/lib/pcc/album'
import { Folha } from '../_comum/calendario'
import { Ico } from '../amigo-secreto/estilo'
import { CartaFrente, CartaVerso, Energia, Leque5 } from './CartaClub'

// ── Ficha ──────────────────────────────────────────────────────────────────

function Linha({ k, v }: { k: string; v: string }) {
  return <div><span>{k}</span><span>{v}</span></div>
}

/** Corpo da ficha: arte grande, chips e as linhas do que a carta diz. */
export function FichaCorpo({ carta, album }: { carta: CartaAlbum; album: AlbumMinha }) {
  const m = missaoDe(carta)
  return (
    <>
      <div className="al-glow"><div className="al-gc"><CartaFrente carta={carta} total={album.total} tam="f" /></div></div>
      <div className="al-chips">
        {carta.raridade && <span className="as-chip fill">{carta.raridade}</span>}
        <span className="as-chip">Edição {album.edicao.edicao}</span>
      </div>
      <div className="as-card al-linhas">
        {carta.tipo && <Linha k="Tipo" v={carta.tipo} />}
        <Linha k="Número" v={`${nn(carta.numero)}/${album.total}`} />
        {carta.homenageado && <Linha k="Homenagem" v={carta.homenageado} />}
        {carta.texto_efeito && <Linha k="Texto" v={carta.texto_efeito} />}
        {m && carta.origem !== 'brinde' && <Linha k="Missão" v={m.titulo} />}
        {carta.ganha_em && <Linha k="Ganha em" v={dataCurta(carta.ganha_em)} />}
      </div>
    </>
  )
}

export function FolhaFicha({ carta, album, onFechar }: { carta: CartaAlbum; album: AlbumMinha; onFechar: () => void }) {
  return (
    <Folha titulo={tituloDe(carta)} eyebrow={`Carta ${nn(carta.numero)} de ${album.total}`} onFechar={onFechar}>
      <FichaCorpo carta={carta} album={album} />
      <button type="button" className="as-btn lnk" onClick={onFechar}>Fechar</button>
    </Folha>
  )
}

// ── Virar ──────────────────────────────────────────────────────────────────

type FaseVirar = 'chega' | 'virada' | 'varias' | 'ficha'

export function FolhaVirar({ album, onAlbum, onFechar }: {
  album: AlbumMinha
  /** Recebe o álbum atualizado a cada virada (a casa e o contador acompanham). */
  onAlbum: (a: AlbumMinha) => void
  onFechar: () => void
}) {
  const [fase, setFase] = useState<FaseVirar>('chega')
  const [virada, setVirada] = useState<number | null>(null)
  const [quantas, setQuantas] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const novas = album.cartas.filter(c => c.estado === 'nova')
  const proxima = novas[0] || null
  const cartaVirada = album.cartas.find(c => c.numero === virada) || null

  async function virar(numeros?: number[]) {
    if (ocupado) return
    setOcupado(true); setErro('')
    const r = await virarCartas(album, numeros)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    onAlbum(r.album)
    if (numeros && numeros.length === 1) { setVirada(numeros[0]); setFase('virada') }
    else { setQuantas(r.viradas.length); setFase('varias') }
  }

  // Sem carta fechada para mostrar (ja viradas em outra tela): a folha nao tem o que fazer.
  if (fase === 'chega' && !proxima) {
    return (
      <Folha titulo="Tudo virado" onFechar={onFechar}>
        <p className="as-p">Todas as suas cartas já estão viradas no álbum.</p>
        <Link href={ALBUM} className="as-btn pri cta">Abrir o álbum</Link>
        <button type="button" className="as-btn lnk" onClick={onFechar}>Fechar</button>
      </Folha>
    )
  }

  if (fase === 'chega' && proxima) {
    const m = missaoDe(proxima)
    return (
      <Folha titulo={novas.length > 1 ? `Você ganhou ${novas.length} cartas` : 'Você ganhou uma carta'} eyebrow="Missão cumprida" onFechar={onFechar}>
        <div className="al-glow">
          <button type="button" className="al-big" onClick={() => virar([proxima.numero])} disabled={ocupado} aria-label={`Virar a carta ${nn(proxima.numero)}`}>
            <CartaVerso carta={proxima} total={album.total} tam="f" nova tilt />
          </button>
        </div>
        <div className="cen">
          <div className="al-t">Carta {nn(proxima.numero)}{m ? `, ${m.titulo}` : ''}</div>
          <p className="as-meta">Toque para virar e ver a arte.</p>
        </div>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri cta" onClick={() => virar([proxima.numero])} disabled={ocupado}>{ocupado ? 'Virando...' : 'Virar a carta'}</button>
        {novas.length > 1 && (
          <p className="as-meta cen">Mais {novas.length - 1} {novas.length - 1 === 1 ? 'carta esperando' : 'cartas esperando'}. <button type="button" className="al-lk" onClick={() => virar()} disabled={ocupado}>Virar todas</button></p>
        )}
        <button type="button" className="as-btn lnk" onClick={onFechar}>Ver depois</button>
      </Folha>
    )
  }

  if (fase === 'ficha' && cartaVirada) {
    return (
      <Folha titulo={tituloDe(cartaVirada)} eyebrow={`Carta ${nn(cartaVirada.numero)} de ${album.total}`} onFechar={onFechar}>
        <FichaCorpo carta={cartaVirada} album={album} />
        <button type="button" className="as-btn pri cta" onClick={() => setFase('virada')}>Voltar</button>
      </Folha>
    )
  }

  if (fase === 'virada' && cartaVirada) {
    return (
      <Folha titulo={tituloDe(cartaVirada)} eyebrow={`Carta ${nn(cartaVirada.numero)} de ${album.total}`} onFechar={onFechar}>
        <div className="al-glow"><div className="al-gc"><CartaFrente carta={cartaVirada} total={album.total} tam="f" virou /></div></div>
        <div className="al-chips">
          <span className="as-chip fill">Nova no álbum</span>
          <span className="as-chip">{album.reveladas} de {album.total}</span>
        </div>
        <Energia n={album.reveladas} total={album.total} />
        {proxima
          ? <button type="button" className="as-btn pri cta" onClick={() => { setVirada(null); setFase('chega') }}>Virar a próxima carta</button>
          : <Link href={ALBUM} className="as-btn pri cta">Abrir o álbum</Link>}
        <button type="button" className="as-btn lnk" onClick={() => setFase('ficha')}>Ver a ficha</button>
      </Folha>
    )
  }

  // 'varias' (virou todas de uma vez)
  return (
    <Folha titulo={quantas === 1 ? 'Carta virada' : `${quantas} cartas viradas`} eyebrow="Álbum do Club" onFechar={onFechar}>
      <div className="al-chips">
        <span className="as-chip fill">{quantas === 1 ? 'Nova no álbum' : 'Novas no álbum'}</span>
        <span className="as-chip">{album.reveladas} de {album.total}</span>
      </div>
      <Energia n={album.reveladas} total={album.total} />
      <Link href={ALBUM} className="as-btn pri cta">Abrir o álbum</Link>
      <button type="button" className="as-btn lnk" onClick={onFechar}>Fechar</button>
    </Folha>
  )
}

// ── Pedido do set físico ───────────────────────────────────────────────────

const AVISO_PEDIDO: Record<string, string> = {
  solicitada: 'A organização vai chamar você pelo e-mail da conta para combinar o frete. Depois disso o Edu envia o set.',
  combinada: 'O frete foi combinado. Agora é com o Edu: ele monta e envia o set.',
  postada: 'O set foi postado. É só esperar o carteiro.',
  entregue: 'O set foi entregue. Aproveite.',
}

export function FolhaSet({ album, onAlbum, onFechar }: { album: AlbumMinha; onAlbum: (a: AlbumMinha) => void; onFechar: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const pedido = album.retirada

  async function pedir() {
    if (ocupado) return
    setOcupado(true); setErro('')
    const r = await pedirSet(album)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    onAlbum(r.album)
  }

  if (pedido) {
    const atual = Math.max(0, PASSOS_SET.findIndex(p => p.id === pedido.status))
    return (
      <Folha titulo={atual === 0 ? 'Pedido registrado' : 'Seu pedido'} eyebrow="Set físico" onFechar={onFechar}>
        <div className="al-glow" style={{ color: 'var(--ac-1)' }}><Ico n="box" s={56} /></div>
        <div className="as-hp">
          <div className="lb"><span>Pedido nº {pedido.numero}</span><span>{atual + 1} de {PASSOS_SET.length}</span></div>
          <div className="al-passos">
            {PASSOS_SET.map((p, i) => (
              <div key={p.id} className={i <= atual ? 'on' : ''}>
                <i />
                <span>{p.rotulo}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="as-note">{AVISO_PEDIDO[pedido.status]}</div>
        <button type="button" className="as-btn pri" onClick={onFechar}>Voltar ao álbum</button>
      </Folha>
    )
  }

  const ate = album.edicao.pedir_set_ate
  return (
    <Folha titulo="Receber meu set em casa" eyebrow="Álbum completo" onFechar={onFechar}>
      <Leque5 cartas={album.cartas} total={album.total} />
      <div className="as-note strong"><strong>O Edu monta o seu set com as {album.total} cartas e envia para você.</strong> As cartas não têm custo: você paga só o frete, combinado antes do envio.</div>
      <div className="as-card al-checks">
        <div><span className="as-st ok"><Ico n="check" s={13} /></span><div><b>Um set por pessoa</b></div></div>
        <div><span className="as-st ok"><Ico n="check" s={13} /></span><div><b>{ate ? `Peça até ${dataCurta(ate)}` : 'Peça quando quiser'}</b><small>O álbum digital continua guardado se você não pedir.</small></div></div>
      </div>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="button" className="as-btn pri cta" onClick={pedir} disabled={ocupado || !album.pode_pedir_set}>{ocupado ? 'Enviando...' : 'Pedir o meu set'}</button>
      <button type="button" className="as-btn lnk" onClick={onFechar}>Agora não</button>
    </Folha>
  )
}

export const FOLHAS_CSS = `
.al-glow{position:relative;display:flex;justify-content:center;padding:10px 0 4px}
.al-glow:before{content:"";position:absolute;left:50%;top:50%;width:220px;height:220px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(var(--ac-1-rgb),.28),transparent);pointer-events:none}
.al-glow>*{position:relative}
.al-gc{width:216px}
.al-big{width:168px;padding:0;margin:0;background:transparent;border:0;cursor:pointer;display:block;border-radius:16px}
.al-big:disabled{cursor:default;opacity:.8}
.al-big:focus-visible{outline:2px solid var(--bx-text);outline-offset:4px}
.al-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.cen{text-align:center}
.al-t{font-size:15px;font-weight:700}
.al-lk{background:transparent;border:0;padding:0;font:inherit;font-weight:700;color:var(--bx-text-2);text-decoration:underline;text-underline-offset:3px;cursor:pointer;min-height:44px}
.al-lk:hover:not(:disabled){color:var(--bx-text)}
.al-lk:disabled{opacity:.5;cursor:default}
.al-linhas{padding:4px 12px;gap:0}
.al-linhas>div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--bx-border);font-size:13.5px}
.al-linhas>div:last-child{border-bottom:0}
.al-linhas span:first-child{color:var(--bx-text-3);flex:none}
.al-linhas span:last-child{text-align:right;font-weight:600;min-width:0;overflow-wrap:anywhere}
.al-checks{gap:4px;padding:6px 12px}
.al-checks>div{display:flex;align-items:center;gap:12px;padding:6px 0}
.al-checks b{display:block;font-size:14px}
.al-checks small{display:block;font-size:11.5px;color:var(--bx-text-3);line-height:1.35}
.al-passos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.al-passos>div{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:700;color:var(--bx-text-3)}
.al-passos>div i{display:block;height:6px;border-radius:999px;background:var(--bx-surface-3);border:1px solid var(--bx-border)}
.al-passos>div.on{color:var(--ac-1)}
.al-passos>div.on i{background:var(--ac-grad);border-color:transparent}
`
