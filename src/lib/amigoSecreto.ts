// Amigo Secreto do Poké Creators Club (04/11/2026).
//
// Tudo que a landing, a sala e o admin compartilham: a edicao em curso, as
// mensagens prontas do mural, os Pokemon de perfil e os tipos do que as
// funcoes do banco devolvem (amigo_secreto_* em supabase/migrations/
// 20261104100000_amigo_secreto.sql). O navegador nunca le as tabelas: tudo
// passa pelas funcoes, com a sessao do proprio usuario.

/** Edicao em curso. Uma por vez; a proxima troca aqui e no banco. */
export const AMIGO_SECRETO_SLUG = 'pcc-2026'

export const TETO_PADRAO_CENTS = 10000

/** Mensagens prontas do mural. O indice e gravado em `pronta`. */
export const MENSAGENS_PRONTAS = [
  'Já comprei o seu presente.',
  'Postei hoje. Fica de olho na caixa de correio.',
  'Acho que acertei no seu desejo.',
  'Chega antes do prazo, pode confiar.',
  'Me surpreenda também.',
  'Seu amigo secreto está de olho em você.',
]

export const MURAL_MAX_DIA = 3
export const MURAL_MAX_CHARS = 120
export const DESEJO_MAX_CHARS = 140

/** Pokemon de perfil: o slug e o que o banco guarda; o sprite vem da mesma fonte da Pokedex. */
export const POKEMON_PERFIL: { slug: string; nome: string }[] = [
  { slug: 'pikachu', nome: 'Pikachu' }, { slug: 'eevee', nome: 'Eevee' }, { slug: 'charizard', nome: 'Charizard' },
  { slug: 'gengar', nome: 'Gengar' }, { slug: 'snorlax', nome: 'Snorlax' }, { slug: 'psyduck', nome: 'Psyduck' },
  { slug: 'mewtwo', nome: 'Mewtwo' }, { slug: 'mew', nome: 'Mew' }, { slug: 'bulbasaur', nome: 'Bulbasaur' },
  { slug: 'squirtle', nome: 'Squirtle' }, { slug: 'charmander', nome: 'Charmander' }, { slug: 'jigglypuff', nome: 'Jigglypuff' },
  { slug: 'umbreon', nome: 'Umbreon' }, { slug: 'sylveon', nome: 'Sylveon' }, { slug: 'lucario', nome: 'Lucario' },
  { slug: 'greninja', nome: 'Greninja' }, { slug: 'dragonite', nome: 'Dragonite' }, { slug: 'lapras', nome: 'Lapras' },
  { slug: 'togepi', nome: 'Togepi' }, { slug: 'mimikyu', nome: 'Mimikyu' }, { slug: 'ditto', nome: 'Ditto' },
  { slug: 'rayquaza', nome: 'Rayquaza' }, { slug: 'garchomp', nome: 'Garchomp' }, { slug: 'chandelure', nome: 'Chandelure' },
]

export function spritePokemon(slug: string | null | undefined): string | null {
  if (!slug || !POKEMON_PERFIL.some(p => p.slug === slug)) return null
  return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`
}

export function nomePokemon(slug: string | null | undefined): string {
  return POKEMON_PERFIL.find(p => p.slug === slug)?.nome || ''
}

// ── Tipos do que as funcoes do banco devolvem ──────────────────────────────

export type EstadoEdicao = 'inscricoes' | 'sorteado' | 'entregas' | 'encerrado'

export type Ficha = { instagram: string; pokemon: string | null }

export type EdicaoPublica = {
  slug: string; nome: string; teto_cents: number
  inscricoes_ate: string; sorteio_em: string; postar_ate: string; revelacao_em: string
  estado: EstadoEdicao; feed_ligado: boolean; minimo: number
  participantes: number; lista: Ficha[]
}

export type Eu = {
  instagram: string; whatsapp: string | null; nome_completo: string | null; pokemon: string | null
  desejo: string | null; sugestoes: string[]; me_surpreenda: boolean
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null
  bairro: string | null; cidade: string | null; uf: string | null
  rastreio: string | null; postado_em: string | null; recebido_em: string | null
  quer_revelar: boolean; perfil_completo: boolean
}

export type Tirou = {
  instagram: string; pokemon: string | null; nome_completo: string | null
  desejo: string | null; sugestoes: string[]; me_surpreenda: boolean
  endereco: { cep: string; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null } | null
  recebido_em: string | null
}

export type Recebo = { postado_em: string | null; rastreio: string | null; revelado: Ficha | null }

export type MinhaSala =
  | { inscrito: false; estado: EstadoEdicao }
  | {
      inscrito: true; estado: EstadoEdicao; revelado: boolean
      teto_cents: number; postar_ate: string; revelacao_em: string; sorteio_em: string; inscricoes_ate: string; feed_ligado: boolean
      eu: Eu; tirou: Tirou | null; recebo: Recebo | null; mensagens_hoje: number
    }

export type MensagemMural = { id: string; texto: string; pronta: number | null; dia: string; para: Ficha; para_mim: boolean }

// ── Formatacao (sempre Brasilia) ───────────────────────────────────────────

const TZ = 'America/Sao_Paulo'

export const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(new Date(iso))

export const dataHora = (iso: string) => {
  const d = new Date(iso)
  const dia = dataCurta(iso)
  const h = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d)
  return h.endsWith(':00') ? `${dia}, às ${h.slice(0, 2)}h` : `${dia}, às ${h}`
}

/** "Hoje", "Ontem" ou dd/mm, a partir de uma data AAAA-MM-DD do banco. */
export function rotuloDia(diaIso: string): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  if (diaIso === hoje) return 'Hoje'
  const ontem = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() - 86_400_000))
  if (diaIso === ontem) return 'Ontem'
  const [a, m, d] = diaIso.split('-')
  return `${d}/${m}/${a}`
}

export function diasAte(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

export const brl = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(cents / 100)

export const cepBonito = (cep: string | null | undefined) =>
  cep && cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep || ''

export const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/

export function limparInstagram(v: string): string {
  return v.trim().toLowerCase().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/[/?].*$/, '')
}

/** Mensagens das funcoes do banco em texto para a pessoa. */
export function erroAmigoSecreto(msg: string | undefined | null): string {
  const m = msg || ''
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('inscricoes_encerradas')) return 'As inscrições encerraram. O sorteio já aconteceu ou o prazo passou.'
  if (m.includes('instagram_invalido')) return 'Confira o seu @: só letras, números, ponto e sublinhado, sem espaço.'
  if (m.includes('instagram_ja_usado')) return 'Esse @ já está na sala com outra conta.'
  if (m.includes('sugestoes_invalidas')) return 'São até 3 sugestões.'
  if (m.includes('sem_sorteio')) return 'Isso só fica disponível depois do sorteio.'
  if (m.includes('limite_diario')) return 'Você já publicou 3 mensagens hoje. O limite reinicia à meia-noite.'
  if (m.includes('mural_desligado')) return 'O mural está fechado no momento.'
  if (m.includes('texto_vazio')) return 'Escreva alguma coisa antes de publicar.'
  if (m.includes('edicao_nao_encontrada')) return 'Esta edição do Amigo Secreto não existe.'
  return 'Não deu certo agora. Tente de novo em instantes.'
}
