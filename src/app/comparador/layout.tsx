import type { Metadata } from 'next'

/**
 * Metadata do /comparador.
 *
 * ★ POR QUE ESTE ARQUIVO EXISTE
 * A `page.tsx` e `'use client'`, e componente client NAO pode exportar
 * `metadata` -- por isso a rota herdava tudo do layout raiz. O efeito nao era
 * so "titulo generico no WhatsApp": o layout raiz declara
 * `canonical: "https://bynx.gg"` ABSOLUTA, entao /comparador vinha dizendo ao
 * Google que a versao canonica dela e a HOME. Confirmado no HTML de producao
 * em 31/08.
 *
 * Mesmo padrao do `perfil/[id]/layout.tsx`: page client, metadata no layout
 * server. Zero mudanca na page.
 *
 * ★ NOINDEX, E NAO CANONICAL PROPRIO -- decisao do Du em 31/08
 * O reflexo seria "corrigir" o canonical pra apontar pra ela mesma. Seria a
 * correcao ERRADA aqui: o comparador e produto INTERNO, de quem esta logado, e
 * ficou fora do sitemap por decisao dele. Canonical proprio seria justamente
 * convidar o Google a indexar uma tela de uso interno -- hoje o canonical
 * errado segurava a indexacao por acidente, e "consertar" abriria a porta.
 *
 * `follow: false` acompanha o padrao ja aprovado no /subprocessadores. As
 * cartas linkadas daqui ja tem rota propria de descoberta pelo sitemap, entao
 * nao se perde rastreamento de nada.
 *
 * ★ PENDENTE, E NAO E ESTE ARQUIVO QUE RESOLVE: a pagina AINDA ABRE
 * deslogada. Nao e bug, e escolha antiga -- o comentario no topo da page diz
 * "Nao precisa de login: e calculadora, nao mexe em dado de ninguem". O Du
 * decidiu em 31/08 que vai fechar, depois que o resto estiver pronto. Ate la o
 * noindex ja tira a tela do indice, que era o risco imediato.
 */
export const metadata: Metadata = {
  title: 'Comparador de troca — Bynx',
  description:
    'Monte os dois lados de uma troca de cartas Pokémon TCG e veja se está equilibrada, com preço em reais do Mercado Brasileiro.',
  robots: { index: false, follow: false },
  /**
   * ★ Canonical PROPRIA, apesar do noindex -- e nao pra ser indexada.
   * O layout raiz define `canonical: "https://bynx.gg"` ABSOLUTA, e sem
   * sobrescrever aqui a pagina continuava dizendo "minha versao canonica e a
   * home". Na pratica o noindex vence e o Google ignora o canonical, mas o
   * documento ficava se contradizendo: "nao me indexe" + "prefira a home no
   * meu lugar". Apontar pra si mesma nao reabre indexacao nenhuma -- quem
   * governa isso e a linha de cima -- e para de mandar sinal cruzado pra home.
   */
  alternates: { canonical: 'https://bynx.gg/comparador' },
}

export default function ComparadorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
