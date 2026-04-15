'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

const frases = [
  'Essa carta não está no nosso banco de dados...',
  'Página mais rara que um Charizard holo 1ª edição.',
  'Nem a Pokédex encontrou essa página.',
  'Parece que essa página fugiu como um Pokémon selvagem.',
]

export default function NotFound() {
  const [frase, setFrase] = useState('')

  useEffect(() => {
    setFrase(frases[Math.floor(Math.random() * frases.length)])
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080a0f',
      color: '#f0f0f0',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo_BYNX.png" alt="Bynx" style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        </Link>
      </header>

      {/* Conteúdo */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}>

        {/* Número 404 estilizado */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <p style={{
            fontSize: 'clamp(100px, 20vw, 180px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            background: BRAND,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            opacity: 0.15,
            userSelect: 'none',
          }}>
            404
          </p>
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span style={{ fontSize: 'clamp(60px, 12vw, 100px)' }}>🃏</span>
          </div>
        </div>

        {/* Título */}
        <h1 style={{
          fontSize: 'clamp(22px, 4vw, 32px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          marginBottom: 12,
        }}>
          Página não encontrada
        </h1>

        {/* Frase aleatória */}
        <p style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.45)',
          maxWidth: 420,
          lineHeight: 1.6,
          marginBottom: 40,
        }}>
          {frase}
        </p>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/" style={{
            background: BRAND,
            color: '#000',
            padding: '13px 28px',
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
          }}>
            Voltar ao início
          </Link>
          <Link href="/pokedex" style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.7)',
            padding: '13px 28px',
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
          }}>
            Ver Pokédex
          </Link>
        </div>

        {/* Dica */}
        <p style={{ marginTop: 48, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          Erro 404 · Bynx — bynx.gg
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');
      `}</style>
    </div>
  )
}