import { IconCheck } from '@/components/ui/Icons'

/**
 * Selo de loja verificada. Um componente so, porque ate 07/09/2026 cada
 * pagina desenhava o seu: a /produto usava um circulo azul com o glifo
 * `&#10003;` e a /anuncio um `IconShield` verde. O Du decidiu pelo da
 * /produto -- o circulo com check e o vocabulario que as pessoas ja
 * reconhecem como "verificado"; escudo verde lê como "seguro", que e outra
 * coisa.
 *
 * ★ O AZUL E COR SEMANTICA DE SELO, nao acento da marca -- por isso e o unico
 * valor cravado aqui e nao sai de `var(--ac-*)`. Trocar pelo acento faria o
 * selo mudar de cor entre o app (ambar), a loja (azul-roxo) e o fluxo de
 * compra (roxo-rosa), e "verificado" nao pode depender de onde a pessoa esta.
 *
 * O glifo virou `IconCheck`: a regra da casa e icone SVG do `Icons.tsx`, e
 * glifo de fonte muda de desenho conforme o sistema.
 */
export default function SeloVerificado({ size = 14 }: { size?: number }) {
  return (
    <span
      title="Loja verificada"
      aria-label="Loja verificada"
      style={{
        width: size, height: size, borderRadius: '50%', background: '#1877F2',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', flex: 'none',
      }}
    >
      <IconCheck size={Math.round(size * 0.64)} color="#fff" strokeWidth={3} />
    </span>
  )
}
