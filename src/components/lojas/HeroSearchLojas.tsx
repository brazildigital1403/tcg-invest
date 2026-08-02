'use client'

import { CSSProperties, FormEvent, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconSearch } from '@/components/ui/Icons'
import { buildLojasUrl, FiltrosLojasState } from './lojasFiltros'

export default function HeroSearchLojas({ atual }: { atual: FiltrosLojasState }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(atual.q)

  // Sincroniza se a busca for limpa por outro controle (pill ou "limpar filtros"
  // na sidebar/gaveta) -- ajusta durante o render (nao em efeito) pra nao
  // disparar um commit extra; e o padrao recomendado pra "derivar de prop".
  const [qDaUrl, setQDaUrl] = useState(atual.q)
  if (atual.q !== qDaUrl) {
    setQDaUrl(atual.q)
    setQ(atual.q)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(() => {
      router.push(buildLojasUrl({ ...atual, q: q.trim() }))
    })
  }

  return (
    <form onSubmit={onSubmit} style={S.wrap}>
      <span style={S.icon}>
        <IconSearch size={16} color="var(--bx-text-3)" />
      </span>
      <input
        type="text"
        placeholder="Buscar loja pelo nome..."
        value={q}
        onChange={e => setQ(e.target.value)}
        style={S.input}
        disabled={pending}
      />
      <button type="submit" style={S.btn} disabled={pending} aria-label="Buscar">
        <IconSearch size={15} color="var(--bx-brand-ink)" />
      </button>
    </form>
  )
}

const S: Record<string, CSSProperties> = {
  wrap: {
    position: 'relative',
    maxWidth: 480,
    margin: '0 auto 22px',
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
    left: 16,
    display: 'flex',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    fontFamily: 'inherit',
    fontSize: 14,
    color: 'var(--bx-text)',
    background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)',
    borderRadius: 12,
    padding: '14px 54px 14px 42px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btn: {
    position: 'absolute',
    right: 5,
    width: 36,
    height: 36,
    borderRadius: 9,
    border: 'none',
    background: 'var(--ac-grad)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
}
