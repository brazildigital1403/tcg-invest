// src/lib/paginas-lendarias.ts
// Fonte UNICA de verdade das Paginas Lendarias (fichario com fundo continuo).
//
// PURO como o plan.ts: nao importa supabase nem DB — usavel no server, no client
// e em teste. O catalogo vive em codigo (nao em tabela) de proposito: sao 30
// cartas curadas a mao, versionadas junto com a arte; banco so guarda o que e
// por-usuario (desbloqueios, em user_paginas_lendarias — migration em
// supabase/migrations/20260815_paginas_lendarias.sql, AINDA NAO APLICADA).
//
// Selecao (estudo 15/08/2026): preco BRL na Bynx x sinal interno (donos em
// colecao, anuncios no marketplace) x demanda global. 19 paginas, 30 cartas:
// 17 paginas-heroi (1 carta no centro), a pagina Eeveelution (9 cartas) e a
// pagina Kanto 151 (4 cartas).

export interface CartaLendaria {
  /** id em pokemon_cards */
  cardId: string
  /** posicao no fichario 3x3, 0..8 (4 = centro) */
  slot: number
  /** carta que da o fundo continuo da pagina */
  heroi?: boolean
}

export interface PaginaLendaria {
  /** slug estavel da pagina (chave de compra em user_paginas_lendarias) */
  id: string
  nome: string
  /** subtitulo curto exibido no rodape da pagina */
  sub: string
  ordem: number
  /** amostra gratis: liberada pra qualquer visitante */
  gratis?: boolean
  /** briefing da arte curada (nivel 2) — a direcao de cena da pagina */
  tema: string
  /**
   * Arte curada (nivel 2). Quando presente, o fichario usa este arquivo como
   * fundo em vez do eco gerado da carta (nivel 1). Caminho relativo a /public.
   * Producao documentada em public/paginas-lendarias/README.md.
   */
  arteUrl?: string
  cartas: CartaLendaria[]
}

// Precos de referencia (a UI le daqui; o Stripe le do price configurado nas
// envs STRIPE_PRICE_PAGINA_LENDARIA / STRIPE_PRICE_COLECAO_LENDARIA).
export const PL_PRECOS = {
  avulsa: 12.90,
  pacote: 79.90,
} as const

/** Valor sentinela em user_paginas_lendarias.pagina_id = pacote completo. */
export const PL_PACOTE = '*'

const hero = (id: string, nome: string, sub: string, ordem: number, tema: string, cardId: string, extra?: Partial<PaginaLendaria>): PaginaLendaria => ({
  id, nome, sub, ordem, tema,
  cartas: [{ cardId, slot: 4, heroi: true }],
  ...extra,
})

export const PAGINAS_LENDARIAS: PaginaLendaria[] = [
  hero('moonbreon', 'Moonbreon', 'Umbreon VMAX · Evolving Skies', 1,
    'A lua cheia da carta toma a pagina inteira; o campo de estrelas atravessa os 9 bolsos.',
    'swsh7-215', { gratis: true }),
  hero('gengar-vmax', 'Gengar VMAX', 'Fusion Strike · Alt Art', 2,
    'A rua noturna de neon roxo continua pelos bolsos vizinhos.',
    'swsh8-271'),
  hero('mega-charizard-x', 'Mega Charizard X', 'Phantasmal Flames · SIR', 3,
    'Chamas azuis escorrendo da carta pros bolsos vizinhos.',
    'me2-125'),
  hero('rayquaza-vmax', 'Rayquaza', 'Rayquaza VMAX · Evolving Skies', 4,
    'A tempestade no ceu se abre pela pagina, com o corpo da serpente sugerido entre os bolsos.',
    'swsh7-218'),
  hero('charizard-vmax-cp', 'Charizard VMAX', "Champion's Path · Rainbow", 5,
    'O arco-iris de fogo da rainbow explode alem da moldura.',
    'swsh35-74'),
  hero('sylveon-vmax', 'Sylveon VMAX', 'Evolving Skies · Alt Art', 6,
    'As fitas e o ceu rosa do fim de tarde cruzam a pagina.',
    'swsh7-212'),
  hero('leafeon-vmax', 'Leafeon VMAX', 'Evolving Skies · Alt Art', 7,
    'A floresta da cena original vira dossel cobrindo os 9 bolsos.',
    'swsh7-205'),
  hero('glaceon-vmax', 'Glaceon VMAX', 'Evolving Skies · Alt Art', 8,
    'A geleira se estende em silencio azul pela pagina.',
    'swsh7-209'),
  hero('pikachu-vmax-vv', 'Pikachu VMAX', 'Vivid Voltage', 9,
    'O raio amarelo corta a pagina em diagonal.',
    'swsh4-44'),
  hero('mew-vmax', 'Mew VMAX', 'Fusion Strike · Alt Art', 10,
    'O psicodelico rosa da alt art se espalha como aquarela.',
    'swsh8-269'),
  hero('pikachu-ex-ss', 'Pikachu ex', 'Surging Sparks · SIR', 11,
    'A tempestade eletrica da cena original cruzando a pagina.',
    'sv8-238'),
  hero('latias-ex', 'Latias ex', 'Surging Sparks · SIR', 12,
    'O voo rasante sobre o mar continua alem da carta.',
    'sv8-239'),
  hero('greninja-ex', 'Greninja ex', 'Twilight Masquerade · SIR', 13,
    'Sombras ninja e lampioes do baile se estendem pelos bolsos.',
    'sv6-214'),
  hero('mega-lucario-ex', 'Mega Lucario ex', 'Mega Evolution · SIR', 14,
    'A aura azul irradia do centro pra pagina inteira.',
    'me1-179'),
  hero('mega-gardevoir-ex', 'Mega Gardevoir ex', 'Mega Evolution · SIR', 15,
    'O vestido psiquico se desdobra em veu por toda a pagina.',
    'me1-178'),
  hero('lugia-vstar', 'Lugia VSTAR', 'Silver Tempest · Alt Art', 16,
    'A tempestade prata do mar revolto toma a pagina.',
    'swsh12-202'),
  hero('giratina-vstar', 'Giratina VSTAR', 'Lost Origin · Alt Art', 17,
    'O Mundo Distorcido vaza da carta e dobra a geometria da pagina.',
    'swsh11-201'),
  {
    id: 'eeveelutions',
    nome: 'Eeveelutions',
    sub: 'Prismatic Evolutions · 9 cartas, 1 arte',
    ordem: 18,
    tema: 'Um ceu unico atravessa os nove bolsos mudando de bioma — cachoeira, relampago, brasa, aurora, prisma, lua, folhagem, cristal de gelo, jardim rosa.',
    cartas: [
      { cardId: 'sv8pt5-149', slot: 0 },              // Vaporeon
      { cardId: 'sv8pt5-153', slot: 1 },              // Jolteon
      { cardId: 'sv8pt5-146', slot: 2 },              // Flareon
      { cardId: 'sv8pt5-155', slot: 3 },              // Espeon
      { cardId: 'sv8pt5-167', slot: 4, heroi: true }, // Eevee no centro
      { cardId: 'sv8pt5-161', slot: 5 },              // Umbreon
      { cardId: 'sv8pt5-144', slot: 6 },              // Leafeon
      { cardId: 'sv8pt5-150', slot: 7 },              // Glaceon
      { cardId: 'sv8pt5-156', slot: 8 },              // Sylveon
    ],
  },
  {
    id: 'kanto-151',
    nome: 'Kanto 151',
    sub: '151 · o trio inicial',
    ordem: 19,
    // Redesign 16/08 (decisao do Du): SO os 3 iniciais, lado a lado na
    // fileira do meio — o poster definitivo de Kanto na parede do usuario.
    tema: 'Os tres cenarios originais emendados lado a lado: a selva do Venusaur a esquerda, o vulcao do Charizard no centro e a baia do Blastoise a direita, com um unico ceu de Kanto atravessando o topo e os terrenos se encontrando na base.',
    cartas: [
      { cardId: 'sv3pt5-198', slot: 3 },              // Venusaur ex
      { cardId: 'sv3pt5-199', slot: 4, heroi: true }, // Charizard ex — centro
      { cardId: 'sv3pt5-200', slot: 5 },              // Blastoise ex
    ],
  },

  // ─── Onda 2 (15/08/2026): +31 paginas-heroi, total 50 ────────────────────
  hero('umbreon-v', 'Umbreon V', 'Evolving Skies · Alt Art', 20, 'A clareira noturna da alt art se abre em floresta sob a lua.', 'swsh7-189'),
  hero('charizard-v-bs', 'Charizard V', 'Brilliant Stars · Alt Art', 21, 'O acampamento ao anoitecer: fogueira, montanha e o ceu esfumacado.', 'swsh9-154'),
  hero('espeon-vmax', 'Espeon VMAX', 'Fusion Strike · Alt Art', 22, 'O salto sobre a cidade futurista continua em skyline neon.', 'swsh8-270'),
  hero('lugia-v', 'Lugia V', 'Silver Tempest · Alt Art', 23, 'O farol na tempestade, mar revolto de prata.', 'swsh12-186'),
  hero('giratina-v', 'Giratina V', 'Lost Origin · Alt Art', 24, 'A fenda do Mundo Distorcido rasga a pagina.', 'swsh11-186'),
  hero('sylveon-v', 'Sylveon V', 'Evolving Skies · Alt Art', 25, 'O campo florido ao entardecer com fitas ao vento.', 'swsh7-183'),
  hero('leafeon-v', 'Leafeon V', 'Evolving Skies · Alt Art', 26, 'O bosque banhado de sol da alt art vira dossel.', 'swsh7-167'),
  hero('vaporeon-v', 'Vaporeon V', 'Evolving Skies · Alt Art', 27, 'A beira do lago cristalino se espalha em aguas calmas.', 'swsh7-172'),
  hero('machamp-v', 'Machamp V', 'Astral Radiance · Alt Art', 28, 'O treino ao por do sol: ceu laranja queimando a pagina.', 'swsh10-172'),
  hero('tyranitar-v', 'Tyranitar V', 'Battle Styles · Alt Art', 29, 'A montanha rochosa ao amanhecer, poeira e pedra.', 'swsh5-155'),
  hero('rayquaza-amazing', 'Rayquaza Amazing', 'Vivid Voltage · Amazing Rare', 30, 'O arco de cores do Amazing explode alem da moldura.', 'swsh4-138'),
  hero('zamazenta-amazing', 'Zamazenta Amazing', 'Vivid Voltage · Amazing Rare', 31, 'O escudo de luz multicolorida irradia do centro.', 'swsh4-102'),
  hero('magikarp-scroll', 'Magikarp', 'Paldea Evolved · IR', 32, 'A pintura oriental do cardume sobe a pagina como um pergaminho.', 'sv2-203'),
  hero('charmander-151', 'Charmander', '151 · IR', 33, 'A trilha do filhote continua pela floresta de Kanto.', 'sv3pt5-168'),
  hero('charmeleon-151', 'Charmeleon', '151 · IR', 34, 'O crepusculo rochoso entre a chama e a evolucao.', 'sv3pt5-169'),
  hero('squirtle-151', 'Squirtle', '151 · IR', 35, 'O riacho da cena original serpenteia pelos bolsos.', 'sv3pt5-170'),
  hero('bulbasaur-151', 'Bulbasaur', '151 · IR', 36, 'O jardim ensolarado cresce em folhagem pagina afora.', 'sv3pt5-166'),
  hero('mew-ex-pf', 'Mew ex', 'Paldean Fates · SIR', 37, 'O voo rosa-choque em ceu de sonho shiny.', 'sv4pt5-232'),
  hero('tr-mewtwo', "Team Rocket's Mewtwo", 'Destined Rivals · SIR', 38, 'O laboratorio sombrio da equipe Rocket em roxo e preto.', 'sv10-231'),
  hero('tr-nidoking', "Team Rocket's Nidoking", 'Destined Rivals · SIR', 39, 'A cidade tomada pela Rocket, neon e fumaca.', 'sv10-233'),
  hero('cynthia-garchomp', "Cynthia's Garchomp", 'Destined Rivals · UR', 40, 'A arena da campea em velocidade e areia.', 'sv10-215'),
  hero('gardevoir-ex-svi', 'Gardevoir ex', 'Scarlet & Violet · SIR', 41, 'O veu psiquico esvoacante toma a pagina em luz branca.', 'sv1-245'),
  hero('charizard-ex-of', 'Charizard ex', 'Obsidian Flames · SIR', 42, 'A cratera vulcanica em brasas negras e laranja.', 'sv3-223'),
  hero('roaring-moon', 'Roaring Moon ex', 'Paradox Rift · SIR', 43, 'O canion ancestral sob o ceu do paradoxo.', 'sv4-251'),
  hero('terapagos-ex', 'Terapagos ex', 'Stellar Crown · SIR', 44, 'A caverna de cristais tera refletindo constelacoes.', 'sv7-170'),
  hero('victini-wf', 'Victini', 'White Flare · IR', 45, 'A chama branca da vitoria dancando pela pagina.', 'rsv10pt5-172'),
  hero('pikachu-ex-ah', 'Pikachu ex', 'Ascended Heroes · SIR', 46, 'A ascensao eletrica em ceu dourado — era atual.', 'me2pt5-276'),
  hero('mega-gengar-ex', 'Mega Gengar ex', 'Ascended Heroes · SIR', 47, 'O pesadelo roxo da mega evolucao engole a pagina.', 'me2pt5-284'),
  hero('mega-dragonite-ex', 'Mega Dragonite ex', 'Ascended Heroes · SIR', 48, 'O voo sobre o mar ao amanhecer, escamas douradas.', 'me2pt5-290'),
  hero('meowth-pf', 'Meowth', 'Phantasmal Flames · IR', 49, 'A rua noturna do gato — a carta com mais donos na Bynx (18).', 'me2-106'),
  hero('clefairy-po', 'Clefairy', 'Perfect Order · IR', 50, 'A dança sob a lua cheia em campo estrelado.', 'me3-94'),
  hero('flareon-v', 'Flareon V', 'Evolving Skies · Alt Art', 51, 'O fim de tarde em brasa da alt art aquece a pagina.', 'swsh7-169'),
  hero('glaceon-v', 'Glaceon V', 'Evolving Skies · Alt Art', 52, 'O gelo azul silencioso da alt art cobre os bolsos.', 'swsh7-175'),
]

// ─── Artes curadas (nivel 2) ────────────────────────────────────────────────
// Manifest escrito pelo scripts/gerar-artes-lendarias.mjs (Nano Banana).
// Arte gerada vence o eco do nivel 1; pagina sem entrada continua no eco.
import artesGeradas from './paginas-lendarias-artes.json'

for (const p of PAGINAS_LENDARIAS) {
  const arte = (artesGeradas as Record<string, string>)[p.id]
  if (arte) p.arteUrl = arte
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const POR_ID = new Map(PAGINAS_LENDARIAS.map(p => [p.id, p]))

const HEROI_POR_CARD = new Map<string, PaginaLendaria>()
for (const p of PAGINAS_LENDARIAS) {
  for (const c of p.cartas) if (c.heroi) HEROI_POR_CARD.set(c.cardId, p)
}

export function getPaginaLendaria(id: string): PaginaLendaria | null {
  return POR_ID.get(id) || null
}

/** Todos os card_ids do catalogo (30). */
export function cardIdsLendarios(): string[] {
  return PAGINAS_LENDARIAS.flatMap(p => p.cartas.map(c => c.cardId))
}

/**
 * Se uma das cartas desta lista e heroi de alguma Pagina Lendaria, devolve a
 * pagina — e o gancho do fichario dos master sets: a pagina 3x3 que contem a
 * carta ganha o fundo continuo de teaser.
 */
export function heroiEntre(cardIds: (string | null | undefined)[]): { pagina: PaginaLendaria; cardId: string } | null {
  for (const id of cardIds) {
    if (!id) continue
    const p = HEROI_POR_CARD.get(id)
    if (p) return { pagina: p, cardId: id }
  }
  return null
}
