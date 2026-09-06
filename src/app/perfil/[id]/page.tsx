import { buscarPerfilPublico } from '@/lib/perfilPublico'
import PerfilClient from './PerfilClient'

/**
 * SERVER COMPONENT (04/09/2026).
 *
 * Antes esta rota era `'use client'` inteira e buscava tudo em `useEffect`.
 * Resultado medido em producao: o `generateMetadata` prometia "Guilherme tem
 * 300 cartas Pokemon TCG organizadas na Bynx. Veja a colecao completa" e o
 * crawler recebia um corpo de 69 CARACTERES -- "Carregando perfil...". Sao 370
 * perfis publicos e o robots.txt tem `Allow: /perfil/`: 370 paginas convidadas
 * a serem indexadas sem nada dentro.
 *
 * Agora o servidor busca o conteudo publico e o client renderiza com ele desde
 * o primeiro paint (SSR), entao o HTML sai preenchido. O `useEffect` do client
 * continua completando o resto.
 */

// ─── ISR: 1h ──────────────────────────────────────────────────────────────
//
// ★ ESTE `revalidate` NAO E ACESSORIO -- ele e o que torna a mudanca acima
// segura. Medido antes de escrever, no maior perfil (300 cartas): so o lookup
// de precos custa 1.228 shared buffers e 11,3 ms com buffer QUENTE. A regra da
// casa e "milhares de buffers = risco, dezenas = seguro", e no lambda o buffer
// e frio. Mover a busca pro servidor SEM cache, em 370 URLs publicas que o
// robots convida, seria reconstruir o apagao de 29/07 de proposito.
//
// 1h (e nao as 24h da carta) porque colecao muda com frequencia: o dono
// adiciona carta e quer ver no proprio perfil. Quando isso incomodar, o
// caminho e furar por evento, nao encurtar a janela.
export const revalidate = 3600

/**
 * ★ SEM ISTO O `revalidate` ACIMA NAO VALE NADA. Rota com segmento dinamico e
 * sem `generateStaticParams` o Next classifica como `f` (server-rendered on
 * demand) e responde `cache-control: private, no-cache, no-store` -- 100% MISS,
 * sempre. Foi exatamente o que medi nesta rota antes de mexer, e e a mesma
 * armadilha documentada no `/carta`.
 *
 * Lista vazia de proposito: prerenderizar os 370 no build gastaria 370x o
 * lookup de 1.228 buffers de uma vez. Com `dynamicParams`, cada perfil e
 * gerado na primeira visita e fica cacheado -- custo espalhado no tempo, e so
 * pros perfis que alguem realmente abre.
 */
export async function generateStaticParams() {
  return []
}

export const dynamicParams = true

// A pagina responde em ~1s. Sem isto herda o teto de 300s da Vercel, e request
// travado segura lambda E conexao do Postgres por cinco minutos -- foi assim
// que o pool esgotou em 29/07.
export const maxDuration = 20

export default async function PerfilPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // `null` aqui nao e erro: e perfil inexistente OU privado. Nos dois casos o
  // client assume, porque privado depende de SESSAO -- o dono ve o proprio
  // perfil, e sessao nao existe em pagina cacheada.
  const inicial = await buscarPerfilPublico(id)

  return <PerfilClient inicial={inicial} />
}
