'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

const AD_CLIENT = 'ca-pub-9762668656363196'

type AdSlotProps = {
  /** ID da unidade (data-ad-slot) criada no painel do AdSense */
  slot: string
  /** 'fluid' para in-article/in-feed; 'auto' para display responsivo */
  format?: string
  /** ex.: 'in-article' (use junto com format='fluid') */
  layout?: string
  /** aplica data-full-width-responsive (so faz sentido em display 'auto') */
  responsive?: boolean
  className?: string
  style?: CSSProperties
}

export default function AdSlot({
  slot,
  format = 'auto',
  layout,
  responsive,
  className,
  style,
}: AdSlotProps) {
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // adsbygoogle ainda nao carregou; o proximo push reaproveita a fila
    }
  }, [])

  const insProps: Record<string, string> = {
    'data-ad-client': AD_CLIENT,
    'data-ad-slot': slot,
    'data-ad-format': format,
  }
  if (layout) insProps['data-ad-layout'] = layout
  if (responsive) insProps['data-full-width-responsive'] = 'true'

  return (
    <ins
      className={`adsbygoogle${className ? ' ' + className : ''}`}
      style={{ display: 'block', textAlign: 'center', ...style }}
      {...insProps}
    />
  )
}
