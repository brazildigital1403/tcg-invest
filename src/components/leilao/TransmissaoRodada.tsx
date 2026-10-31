'use client'

import type { CSSProperties } from 'react'
import { IconPlay } from '@/components/ui/Icons'

/**
 * Player da live do YouTube dentro da rodada, CLIQUE-PARA-CARREGAR (mesma
 * ideia do VideoLazy dos servicos): ate o toque e so a capa do video. O
 * iframe pesa ~1 MB e poe cookie de terceiro; quem so quer dar lance nao
 * paga isso. Sempre pelo youtube-nocookie.com (o unico host de video que a
 * CSP libera em frame-src).
 *
 * Controlado de fora (`tocando`): o botao "Assistir" do topo da rodada
 * tambem liga o player.
 */
export default function TransmissaoRodada({
  videoId,
  embedUrl,
  titulo,
  tocando,
  aoTocar,
}: {
  videoId: string
  embedUrl: string
  titulo: string
  tocando: boolean
  aoTocar: () => void
}) {
  return (
    <div style={S.caixa}>
      {tocando ? (
        <iframe
          src={`${embedUrl}?autoplay=1&rel=0&playsinline=1`}
          title={`Transmissão: ${titulo}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={S.iframe}
        />
      ) : (
        <button type="button" className="rd-video-capa" onClick={aoTocar} aria-label={`Assistir à transmissão: ${titulo}`} style={S.capa}>
          {/* Capa do proprio YouTube, direto do host dele (sem otimizador). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" style={S.img} />
          <span style={S.play}>
            <span style={S.playIcone}><IconPlay size={22} /></span>
            Assistir à transmissão
          </span>
        </button>
      )}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  caixa: {
    position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden',
    background: 'var(--bx-bg-elev)', border: '1px solid var(--bx-border)',
  },
  iframe: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 },
  capa: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 0, border: 'none', cursor: 'pointer',
    background: 'var(--bx-bg-elev)', color: 'var(--bx-text)', fontFamily: 'inherit',
  },
  img: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 },
  play: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, fontSize: 14, fontWeight: 700,
  },
  playIcone: {
    width: 52, height: 52, borderRadius: 999, display: 'grid', placeItems: 'center',
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)',
  },
}
