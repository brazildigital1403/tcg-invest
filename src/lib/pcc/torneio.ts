// 1o Torneio Online de TCG do Poke Creators Club (27/11/2026, pedido do Du; mockups da secao e do
// resultado aprovados). Tudo fixo aqui, como a Batalha (lib/pcc/batalhas.ts): sem migration, sem tela.
// O estado da secao (faltam N dias, amanha, hoje, acontecendo agora, encerrado) e calculado NO NAVEGADOR,
// no relogio de Brasilia, para nao congelar em cache. Resultado publicado vence o relogio.
//
// Para publicar o resultado: preencher RESULTADO_TORNEIO com os @ e, se a pessoa autorizar, a foto
// (webp quadrado de 256 px, rosto no terco de cima) no bucket club-fotos, pasta torneios/tcg-online-2026/.

export const TORNEIO = {
  /** Dia do torneio no calendario de Brasilia e a hora de inicio. */
  dia: '2026-12-18',
  inicio: '2026-12-18T19:00:00-03:00',
  /** Sem resultado, a secao some neste dia; com resultado, fica no ar ate o fim do dia `ateComResultado`. */
  someSemResultado: '2026-12-26',
  ateComResultado: '2027-01-10',
  /** Grupo da Escolinha dos Poke Creators, onde fica a lista de interessados. */
  grupo: 'https://chat.whatsapp.com/GkK4MTUscm43SFjAfjp7HE',
  organizacao: ['pokevandy', 'cardsdovictor'],
  /** Sets dos premios, para o bloco automatico de cartas do Marketplace (pelo set da carta do anuncio). */
  sets: ['dlr'],
} as const

export const PREMIOS_TORNEIO: Record<1 | 2, { linha: string; nome: string; pacotes: string; img: string; w: number; h: number; alt: string }> = {
  1: {
    linha: 'QuadriPack de', nome: 'Reinado Delta', pacotes: '4 pacotes de booster',
    img: '/pokecreatorsclub/torneio/premio-1.webp', w: 256, h: 246,
    alt: 'QuadriPack de Reinado Delta, blister com 4 pacotes de booster',
  },
  2: {
    linha: 'TriplePack de', nome: 'Reinado Delta', pacotes: '3 pacotes de booster',
    img: '/pokecreatorsclub/torneio/premio-2.webp', w: 256, h: 256,
    alt: 'TriplePack de Reinado Delta, blister com 3 pacotes de booster',
  },
}

export type LugarTorneio = {
  lugar: 1 | 2
  /** @ do Instagram, sem o arroba. */
  instagram: string
  /** Caminho da foto no bucket club-fotos (ex.: 'torneios/tcg-online-2026/1.webp'); sem foto, a inicial. */
  foto?: string
}
export type ResultadoTorneio = { participantes?: number; podio: LugarTorneio[] }

/** Nulo ate a organizacao confirmar os vencedores. */
export const RESULTADO_TORNEIO: ResultadoTorneio | null = null

export type EstadoTorneio = { tipo: 'antes'; dias: number } | { tipo: 'amanha' } | { tipo: 'hoje' } | { tipo: 'agora' } | { tipo: 'fim' } | { tipo: 'fora' }

const diaBrasilia = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t))
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000)

export function estadoTorneio(agora: number, temResultado: boolean): EstadoTorneio {
  const hoje = diaBrasilia(agora)
  const comecou = agora >= Date.parse(TORNEIO.inicio)
  if (comecou && temResultado) return hoje <= TORNEIO.ateComResultado ? { tipo: 'fim' } : { tipo: 'fora' }
  const faltam = diasEntre(hoje, TORNEIO.dia)
  if (faltam > 1) return { tipo: 'antes', dias: faltam }
  if (faltam === 1) return { tipo: 'amanha' }
  if (faltam === 0) return comecou ? { tipo: 'agora' } : { tipo: 'hoje' }
  return hoje < TORNEIO.someSemResultado ? { tipo: 'fim' } : { tipo: 'fora' }
}
