// Mesma imagem do opengraph-image.tsx. A config de cache e repetida em
// literal de proposito: o Next le route segment config estaticamente e nao
// segue re-export. Sem este arquivo o X herdaria a imagem do hub /set.
export { default, alt, size, contentType } from './opengraph-image'

export const revalidate = 604800
export const maxDuration = 20
export const dynamicParams = true
export async function generateStaticParams() {
  return []
}
