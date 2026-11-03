import { PRAZO_PAGAMENTO_ARREMATE_HORAS } from '@/lib/leilao-vitrine'

const PASSOS = [
  { titulo: 'Escolha', texto: 'Veja a carta e quem vende' },
  { titulo: 'Dê o lance', texto: 'Seu máximo fica oculto' },
  { titulo: 'Só paga se vencer', texto: `No cartão, em ${PRAZO_PAGAMENTO_ARREMATE_HORAS} horas` },
] as const

/** Como funciona em uma olhada, para quem chega sem leilão aberto. */
export default function PassosCurtos() {
  return (
    <ol className="vt-passos-c" aria-label="Como funciona">
      {PASSOS.map((p, i) => (
        <li key={p.titulo}>
          <i aria-hidden>{i + 1}</i>
          <b>{p.titulo}</b>
          <span>{p.texto}</span>
        </li>
      ))}
    </ol>
  )
}
