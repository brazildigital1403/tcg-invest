/**
 * Hub de ilustrador (Fase 3 do epico #490, 09/10/2026).
 *
 * O slug sai do nome como vem do catalogo ("Ken Sugimori/Yusuke Ohmura" ->
 * "ken-sugimori-yusuke-ohmura"). Mesma regra do SQL que mediu as colisoes:
 * minusculas, sem acento, tudo que nao e letra ou numero vira hifen. Uma
 * colisao conhecida ("K. Hoshiba" e "K Hoshiba") e tratada no resolvedor:
 * os dois nomes viram o mesmo hub.
 */
export function slugIlustrador(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Minimo de cartas com preco para o hub existir (abaixo disso e 404). */
export const MIN_CARTAS_COM_PRECO = 3
