'use client'

// A carta que chega com a entrada no Club (mockup aprovado em 18/11/2026, estado "Você entrou no
// Club"). Vai dentro do "pronto" do modal de entrada: o verso da carta, "A carta 01 chegou" e dois
// botões. O toque na carta (ou o botão) vira a carta ali mesmo, pela mesma função do álbum
// (club_carta_virar), e o álbum já guarda a virada. Quem entrou agora recebe a 01; quem já era
// membro e completa o cadastro recebe a que o @ valeu (a 03). As outras cartas fechadas ficam
// esperando no álbum: aqui só uma tem a cerimônia.
//
// Quem chama só mostra isto quando há edição aberta e carta que chegou com a ação; sem isso, o
// "pronto" segue como era. Traz o próprio CSS da carta: a casa só o carrega depois que o álbum existe.

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ALBUM } from '@/lib/pcc/rotas'
import { missaoDe, nn, tituloDe, virarCartas, type AlbumMinha } from '@/lib/pcc/album'
import { CARTA_CSS, CartaFrente, CartaVerso } from './CartaClub'
import { FOLHAS_CSS } from './FolhasAlbum'

export default function CartaDeEntrada({ album, chegadas, onFechar, onAlbum, children }: {
  /** O álbum lido logo depois de salvar. */
  album: AlbumMinha
  /** Os números das cartas que chegaram fechadas com esta ação (não as que já esperavam no álbum). */
  chegadas: number[]
  onFechar: () => void
  /** Recebe o álbum atualizado depois da virada (a casa e o contador acompanham). */
  onAlbum?: (a: AlbumMinha) => void
  /** Aviso extra entre o texto e os botões (o do WhatsApp). */
  children?: ReactNode
}) {
  const [atual, setAtual] = useState(album)
  const [virada, setVirada] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  // A carta da cerimônia: a 01 (entrar), se chegou agora; senão a primeira que chegou. Uma 01 que já
  // esperava fechada desde antes não conta: quem completa o cadastro não "entrou" agora.
  const [numero] = useState(() => {
    const fechadas = new Set(album.cartas.filter(c => c.estado === 'nova').map(c => c.numero))
    const vindas = chegadas.filter(n => fechadas.has(n))
    return (vindas.includes(1) ? 1 : vindas[0]) ?? [...fechadas][0] ?? 1
  })

  const carta = atual.cartas.find(c => c.numero === numero)
  if (!carta) return null
  const missao = missaoDe(carta)
  const total = atual.total
  const outras = atual.cartas.filter(c => c.estado === 'nova' && c.numero !== numero).length
  const mais = outras > 0 ? `Mais ${outras} ${outras === 1 ? 'carta espera fechada' : 'cartas esperam fechadas'} no seu álbum.` : ''

  async function virar() {
    if (ocupado || virada) return
    setOcupado(true); setErro('')
    const r = await virarCartas(atual, [numero])
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    setAtual(r.album)
    setVirada(true)
    onAlbum?.(r.album)
  }

  if (virada) {
    return (
      <>
        <div className="al-glow"><div className="al-gc"><CartaFrente carta={carta} total={total} tam="f" virou /></div></div>
        <div className="cen">
          <div className="al-t">{tituloDe(carta)}</div>
          <p className="as-meta">Carta {nn(numero)} de {total}. Ela já está no seu álbum.</p>
          {mais && <p className="as-meta">{mais}</p>}
        </div>
        {children}
        <Link href={ALBUM} className="as-btn pri cta">Abrir o meu álbum</Link>
        <button type="button" className="as-btn lnk" onClick={onFechar}>Fechar</button>
        <style>{CARTA_CSS + FOLHAS_CSS}</style>
      </>
    )
  }

  return (
    <>
      <div className="al-glow">
        <button type="button" className="al-big" onClick={virar} disabled={ocupado} aria-label={`Virar a carta ${nn(numero)}`}>
          <CartaVerso carta={carta} total={total} tam="f" nova tilt />
        </button>
      </div>
      <div className="cen">
        <div className="al-t">A carta {nn(numero)} chegou</div>
        <p className="as-meta">{numero === 1 ? 'Entrar no Club vale a primeira carta. Toque para virar.' : missao ? `Missão cumprida: ${missao.titulo}. Toque para virar.` : 'Toque para virar.'}</p>
        {mais && <p className="as-meta">{mais}</p>}
      </div>
      {children}
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="button" className="as-btn pri cta" onClick={virar} disabled={ocupado}>{ocupado ? 'Virando...' : 'Virar a carta'}</button>
      <Link href={ALBUM} className="as-btn lnk">Abrir o meu álbum</Link>
      <style>{CARTA_CSS + FOLHAS_CSS}</style>
    </>
  )
}
