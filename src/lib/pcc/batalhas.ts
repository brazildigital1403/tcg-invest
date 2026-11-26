// 1o Campeonato de Ilustracoes Pokemon (26/11/2026, mockup "Batalha de Ilustracao" aprovado).
// Carrossel unico na casa do Club, na ordem do torneio: batalhas, repescagens, semifinais e final.
// Cada card abre o reel no Instagram em outra aba; nada do Instagram carrega na home.
// Capas e logo vivem no bucket club-fotos, em batalhas/ilustracao-2026/ (capas 540x960,
// tiradas da previa publica de cada reel em 26/11/2026). Os @ vem da legenda de cada reel,
// com uma correcao do Du: a legenda da Batalha 03 diz @pokehelotcg, o certo e @pokehelo.
// Campeonato fechado: a lista e fixa, por isso mora aqui e nao numa tabela.

export type Duelo = {
  /** Fase como aparece no card: "Batalha 01", "Repescagem 01", "Semifinal 01", "Final". */
  fase: string
  link: string
  /** Caminho da capa no bucket club-fotos. */
  capa: string
  /** Quem disputa, na ordem da legenda do reel. */
  quem: string[]
  final?: boolean
}

const PASTA = 'batalhas/ilustracao-2026'
export const LOGO_BATALHA = `${PASTA}/logo.webp`

const d = (n: number, fase: string, reel: string, quem: string[], final = false): Duelo => ({
  fase,
  link: `https://www.instagram.com/reel/${reel}/`,
  capa: `${PASTA}/${String(n).padStart(2, '0')}.webp`,
  quem,
  final,
})

export const DUELOS: Duelo[] = [
  d(1, 'Batalha 01', 'DduK9xcxLqk', ['tocadozard', 'minadosloots']),
  d(2, 'Batalha 02', 'Dd7As2IhgwQ', ['minadosloots', 'hitcoupletcg']),
  d(3, 'Batalha 03', 'DeANOTLh42c', ['pokehelo', 'helotcg']),
  d(4, 'Batalha 04', 'DeNDr24hsRf', ['meilipkm', 'casaltcg']),
  d(5, 'Batalha 05', 'DeSOARRAkr5', ['zozo.deck', 'poke.cesar']),
  d(6, 'Batalha 06', 'DefGZNJue71', ['hachitcg', 'chinaritcg']),
  d(7, 'Repescagem 01', 'De2VFw4vuDi', ['pokehelo', 'meilipkm', 'chinaritcg', 'poke.cesar']),
  d(8, 'Repescagem 02', 'DfAkeCNhq_B', ['meilipkm', 'poke.cesar']),
  d(9, 'Semifinal 01', 'DekPt9wtjPS', ['hitcoupletcg', 'helotcg']),
  d(10, 'Semifinal 02', 'DexF8QUxqGv', ['casaltcg', 'hachitcg']),
  d(11, 'Semifinal 03', 'DfIS8yypM25', ['meilipkm', 'zozo.deck']),
  d(12, 'Final', 'Dfu5ShCt0K0', ['hitcoupletcg', 'casaltcg', 'zozo.deck'], true),
]
