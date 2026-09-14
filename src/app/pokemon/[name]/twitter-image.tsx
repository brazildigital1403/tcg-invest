// Mesma imagem do opengraph-image.tsx (o default ja manda o Cache-Control de
// 7 dias). A config de rota e repetida em literal de proposito: o Next le
// route segment config estaticamente e nao segue re-export. Sem este arquivo
// o X herdaria a imagem do hub /pokemon.
export { default, alt, size, contentType } from './opengraph-image'

export const dynamic = 'force-dynamic'
export const maxDuration = 20
