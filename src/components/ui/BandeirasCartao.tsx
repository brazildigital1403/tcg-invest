/**
 * Bandeiras aceitas no checkout.
 *
 * ★ O QUE E FIEL E O QUE E APROXIMACAO — leia antes de mexer:
 *
 * - **Mastercard** e **Pix** sao GEOMETRICOS (dois circulos sobrepostos; losango
 *   de quatro pontas). Dao pra reproduzir com precisao em SVG, e estao fieis.
 * - **Visa**, **Elo** e **Amex** sao WORDMARKS com tipografia proprietaria.
 *   O que esta aqui e o nome na cor oficial da marca — legivel e reconhecivel,
 *   mas **nao e o logo oficial**. O certo e baixar o SVG do brand center de
 *   cada uma e servir de `/public`. Registrado pro Du decidir.
 *
 * Cores oficiais usadas: Mastercard #EB001B / #F79E1B · Pix #32BCAD ·
 * Visa #1A1F71 (aqui em branco, porque o fundo e escuro) · Amex #006FCF.
 */

const Mastercard = () => (
  <svg width="34" height="22" viewBox="0 0 34 22" fill="none" aria-hidden="true">
    <circle cx="13" cy="11" r="7.5" fill="#EB001B" />
    <circle cx="21" cy="11" r="7.5" fill="#F79E1B" fillOpacity="0.9" />
    <path d="M17 5.4a7.48 7.48 0 000 11.2 7.48 7.48 0 000-11.2z" fill="#FF5F00" />
  </svg>
)

const Pix = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2.6l3.3 3.3a2.4 2.4 0 001.7.7h.6L21.4 10a2.4 2.4 0 010 3.4L17.6 17H17a2.4 2.4 0 00-1.7.7L12 21.4l-3.3-3.3A2.4 2.4 0 007 17.4h-.6L2.6 13.6a2.4 2.4 0 010-3.4L6.4 6.4H7a2.4 2.4 0 001.7-.7L12 2.6z"
      fill="#32BCAD"
    />
  </svg>
)

/** Wordmark: nome na cor da marca. NAO e o logo oficial — ver o topo do arquivo. */
const Wordmark = ({ texto, cor, italico = false }: { texto: string; cor: string; italico?: boolean }) => (
  <span
    style={{
      fontSize: 11.5,
      fontWeight: 800,
      letterSpacing: '0.04em',
      color: cor,
      fontStyle: italico ? 'italic' : 'normal',
      lineHeight: '22px',
    }}
  >
    {texto}
  </span>
)

export default function BandeirasCartao() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {[
        { k: 'visa', el: <Wordmark texto="VISA" cor="#f0f0f0" italico /> },
        { k: 'mastercard', el: <Mastercard /> },
        { k: 'elo', el: <Wordmark texto="elo" cor="#f0f0f0" /> },
        { k: 'amex', el: <Wordmark texto="AMEX" cor="#4da3e0" /> },
        { k: 'pix', el: <Pix /> },
      ].map(b => (
        <span
          key={b.k}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 30, minWidth: 46, padding: '0 9px', borderRadius: 7,
            background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
          }}
        >
          {b.el}
        </span>
      ))}
    </div>
  )
}
