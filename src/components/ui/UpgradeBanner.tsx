'use client'

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'

interface Props {
  tipo: 'cartas' | 'marketplace'
}

export default function UpgradeBanner({ tipo }: Props) {
  const msg = tipo === 'cartas'
    ? 'Você atingiu o limite de 6 cartas do plano Gratuito.'
    : 'Você atingiu o limite de 3 anúncios ativos do plano Gratuito.'

  return (
    <div style={{
      margin: '8px 0 24px',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.08))',
      border: '1px solid rgba(245,158,11,0.25)',
      borderRadius: 16,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 12,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <p style={{ fontSize: 20 }}>🚀</p>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>
          {msg}
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          Faça upgrade para o plano <strong style={{ color: '#f59e0b' }}>Pro</strong> e tenha acesso ilimitado a todas as funcionalidades.
        </p>
      </div>

      {/* Planos */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: '100%', marginTop: 4 }}>

        {/* Pro Mensal */}
        <div style={{ flex: 1, minWidth: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Pro Mensal</p>
          <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2 }}>
            <span style={{ background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 19,90</span>
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>por mês</p>
          <button
            onClick={() => alert('Em breve! 🚀')}
            style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Assinar Pro
          </button>
        </div>

        {/* Pro Anual */}
        <div style={{ flex: 1, minWidth: 160, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '14px 16px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: BRAND, color: '#000', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 100, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
            2 MESES GRÁTIS
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Pro Anual</p>
          <p style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 2 }}>
            <span style={{ background: BRAND, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>R$ 179</span>
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>por ano · R$ 14,91/mês</p>
          <button
            onClick={() => alert('Em breve! 🚀')}
            style={{ width: '100%', background: BRAND, border: 'none', color: '#000', padding: '9px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Assinar Anual
          </button>
        </div>
      </div>

      {/* Features Pro */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
        {['✓ Cartas ilimitadas', '✓ Anúncios ilimitados', '✓ Perfil público', '✓ Exportar CSV', '✓ Badge Pro'].map(f => (
          <span key={f} style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{f}</span>
        ))}
      </div>
    </div>
  )
}