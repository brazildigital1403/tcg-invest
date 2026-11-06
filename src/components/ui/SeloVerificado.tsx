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
/**
 * ★ O ROTULO SEGUE A NATUREZA (06/11/2026). O desenho e o mesmo -- quem
 * verifica e a Bynx, e o circulo azul quer dizer a mesma coisa nos dois casos
 * --, mas o TEXTO nao pode dizer "Loja verificada" para quem vende da propria
 * colecao. O e-mail de verificacao passou a chamar esse selo de "Colecionador
 * Verificado" para pessoa fisica, e o rotulo aqui tem que bater: a mesma coisa
 * com dois nomes e como um numero cravado em dois lugares.
 *
 * `colecionador` e opcional e o default e loja, que e o default do banco.
 * Hoje NENHUM colecionador esta verificado (0 de 6), entao as 13 telas que
 * montam o selo seguem no default sem exibir rotulo errado a ninguem -- mas
 * quem souber a natureza deve passar, e a primeira verificacao de
 * colecionador pede essa volta.
 */
export default function SeloVerificado({
  size = 14,
  colecionador = false,
}: {
  size?: number
  colecionador?: boolean
}) {
  const rotulo = colecionador ? 'Colecionador verificado' : 'Loja verificada'
  return (
    <span
      title={rotulo}
      aria-label={rotulo}
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
