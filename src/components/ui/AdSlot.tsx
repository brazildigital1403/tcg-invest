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
  const insRef = useRef<HTMLModElement | null>(null)
  const pushed = useRef(false)

  useEffect(() => {
    const el = insRef.current
    if (!el) return

    const tryPush = (): boolean => {
      if (pushed.current) return true
      // AdSense lanca "No slot size for availableWidth=0" se a largura for 0
      if (el.offsetWidth === 0) return false
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
        pushed.current = true
      } catch {
        // adsbygoogle ainda nao carregou; sera reprocessado
      }
      return true
    }

    if (tryPush()) return

    // largura ainda 0 (layout nao estabilizou): espera ter largura real
    const ro = new ResizeObserver(() => {
      if (tryPush()) ro.disconnect()
    })
    ro.observe(el)
    return () => ro.disconnect()
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
      ref={insRef}
      className={`adsbygoogle${className ? ' ' + className : ''}`}
      style={{ display: 'block', width: '100%', textAlign: 'center', ...style }}
      {...insProps}
    />
  )
}
