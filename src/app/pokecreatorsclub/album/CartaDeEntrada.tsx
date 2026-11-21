'use client'

// A carta que chega com a entrada no Club (mockup aprovado em 18/11/2026, estado "Você entrou no
// Club"). Vai dentro do "pronto" do modal de entrada: o verso da carta 01, "A carta 01 chegou" e
// dois botões. O toque na carta (ou o botão) vira a carta ali mesmo, pela mesma função do álbum
// (club_carta_virar), e o álbum já guarda a virada. As outras cartas que a entrada valeu (o @
// vale a 03) ficam fechadas esperando no álbum: aqui só a primeira tem a cerimônia.
//
// Quem chama só mostra isto quando há edição aberta e carta nova; sem edição, o "pronto" segue
// como era. Traz o próprio CSS da carta: a casa só o carrega depois que o álbum existe.

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ALBUM } from '@/lib/pcc/rotas'
import { nn, tituloDe, virarCartas, type AlbumMinha } from '@/lib/pcc/album'
import { CARTA_CSS, CartaFrente, CartaVerso } from './CartaClub'
import { FOLHAS_CSS } from './FolhasAlbum'

export default function CartaDeEntrada({ album, onFechar, onAlbum, children }: {
  /** O álbum lido logo depois de entrar: tem pelo menos uma carta nova (fechada). */
  album: AlbumMinha
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
  // A carta da cerimônia: a 01 (entrar). Se ela não estiver fechada, a primeira que estiver.
  const [numero] = useState(() => {
    const novas = album.cartas.filter(c => c.estado === 'nova')
    return (novas.find(c => c.numero === 1) || novas[0])?.numero ?? 1
  })

  const carta = atual.cartas.find(c => c.numero === numero)
  if (!carta) return null
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
        <p className="as-meta">{numero === 1 ? 'Entrar no Club vale a primeira carta. Toque para virar.' : 'Toque para virar.'}</p>
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
