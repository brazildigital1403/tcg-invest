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
  'Vi algo com a sua cara. Acho que você vai gostar.',
  'Seu Pokémon favorito entrou na investigação.',
  'Acho que acertei na sua pista.',
  'Mais uma pista: você vai descobrir na revelação.',
  'Já tem embrulho. Falta só o correio fazer a parte dele.',
  'Nada de spoiler. Só saiba que foi escolhido com carinho.',
]

export const MURAL_MAX_DIA = 3
export const MURAL_MAX_CHARS = 120
export const DESEJO_MAX_CHARS = 500

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
  rastreio: string | null; postado_em: string | null; recebido_em: string | null; recebido_em_maos: boolean
  quer_revelar: boolean; perfil_completo: boolean
  /** Quando a pista mudou depois do sorteio (null = nunca). */
  pista_atualizada_em: string | null
  /** CPF de quem recebe (11/11/2026): o dono ve so os 5 ultimos digitos. */
  tem_cpf: boolean
  cpf_final: string | null
}

export type Tirou = {
  instagram: string; pokemon: string | null; nome_completo: string | null
  desejo: string | null; sugestoes: string[]; me_surpreenda: boolean
  endereco: { cep: string; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; cpf?: string | null } | null
  recebido_em: string | null
  /** Quem eu tirei aceitou revelar a troca (sem dizer quem me tirou). */
  aceitou: boolean
  /** Quando a pista de quem eu tirei mudou depois do sorteio (null = nunca). */
  pista_atualizada_em: string | null
}

export type Recebo = { postado_em: string | null; rastreio: string | null; outro_aceitou: boolean; revelado: Ficha | null }

export type MinhaSala =
  | { inscrito: false; estado: EstadoEdicao }
  | {
      inscrito: true; estado: EstadoEdicao; revelado: boolean
      teto_cents: number; postar_ate: string; revelacao_em: string; sorteio_em: string; inscricoes_ate: string; feed_ligado: boolean
      minimo: number
      /** Hora em que o mural abre (60 min depois do sorteio executado); null antes do sorteio. */
      mural_abre_em: string | null
      eu: Eu; tirou: Tirou | null; recebo: Recebo | null; mensagens_hoje: number
    }

export type MensagemMural = { id: string; texto: string; pronta: number | null; dia: string; para: Ficha; para_mim: boolean }

// ── Pista depois do sorteio (direcao "Pista na missao", 09/11/2026) ─────────

/** Limite antigo do desejo: quem bateu nele teve o texto cortado na digitacao. */
const DESEJO_LIMITE_ANTIGO = 140

export type FaltaPista = 'cortado' | 'curto' | 'sem_sugestao' | null

/**
 * O que falta na pista para o aviso "Ajude quem tirou voce". "Pode escolher por
 * mim" e escolha, nao esquecimento: nunca recebe aviso.
 */
export function faltaNaPista(eu: Pick<Eu, 'desejo' | 'sugestoes' | 'me_surpreenda' | 'pista_atualizada_em'>): FaltaPista {
  if (eu.me_surpreenda) return null
  const d = (eu.desejo || '').trim()
  // Quem ja mexeu na pista depois do sorteio viu o texto: tamanho deixa de ser aviso.
  if (!eu.pista_atualizada_em) {
    if (d.length >= DESEJO_LIMITE_ANTIGO - 1 && d.length <= DESEJO_LIMITE_ANTIGO) return 'cortado'
    if (d.length > 0 && d.length < 20) return 'curto'
  }
  if ((eu.sugestoes || []).length === 0) return 'sem_sugestao'
  return null
}

/** Ultimas palavras do texto, para mostrar onde a pista parou. */
export const finalDoTexto = (t: string, palavras = 2) => t.trim().split(/\s+/).slice(-palavras).join(' ')

// ── CPF de quem recebe (11/11/2026) ────────────────────────────────────────
// Os Correios pedem o CPF do destinatario para a etiqueta. A conta do digito
// verificador roda aqui e de novo no banco (amigo_secreto_cpf_valido).

export const cpfSoDigitos = (v: string) => v.replace(/\D/g, '').slice(0, 11)

/** Mascara progressiva: 123 -> 123, 1234 -> 123.4, 12345678909 -> 123.456.789-09. */
export function cpfMascara(v: string): string {
  const d = cpfSoDigitos(v)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function cpfValido(v: string): boolean {
  const d = cpfSoDigitos(v)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

/** Os 5 ultimos digitos que o banco devolve ao dono, no formato da mascara. */
export const cpfFinal = (cf: string | null | undefined) =>
  cf && cf.length === 5 ? `•••.•••.${cf.slice(0, 3)}-${cf.slice(3)}` : ''

/** "EDUARDO GOMES" -> "Eduardo": o primeiro nome ajuda a ligar o @ a quem a pessoa conhece (11/11/2026). */
export function primeiroNomeBonito(nome: string | null | undefined): string {
  const p = (nome || '').trim().split(/\s+/)[0] || ''
  return p ? p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : ''
}

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

export const horaCurta = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso))

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
  if (m.includes('sugestoes_invalidas')) return 'São até 3 sugestões, de até 120 caracteres cada.'
  if (m.includes('cep_invalido')) return 'CEP tem 8 números.'
  if (m.includes('whatsapp_invalido')) return 'Confira o WhatsApp: só números, com DDD.'
  if (m.includes('pokemon_invalido')) return 'Escolha um Pokémon da lista.'
  if (m.includes('dados_invalidos')) return 'Algum campo passou do tamanho. Encurte e tente de novo.'
  if (m.includes('edicao_encerrada')) return 'Esta edição já encerrou.'
  if (m.includes('cpf_invalido')) return 'Esse CPF não confere. Confira os números.'
  if (m.includes('pista_encerrada')) return 'O prazo de entrega passou, e a pista não muda mais.'
  if (m.includes('nao_participante')) return 'Só quem está na sala vê o mural.'
  if (m.includes('sem_sorteio')) return 'Isso só fica disponível depois do sorteio.'
  if (m.includes('sem_postagem')) return 'Quem tirou você ainda não registrou o envio. Se o presente chegou em mãos, use essa opção.'
  if (m.includes('mural_aguardando')) return 'O mural abre uma hora depois do sorteio.'
  if (m.includes('limite_diario')) return `Você já publicou ${MURAL_MAX_DIA} recados hoje. O limite reinicia à meia-noite.`
  if (m.includes('mural_desligado')) return 'O mural está fechado no momento.'
  if (m.includes('texto_vazio')) return 'Escreva alguma coisa antes de publicar.'
  if (m.includes('edicao_nao_encontrada')) return 'Esta edição do Amigo Secreto não existe.'
  return 'Não deu certo agora. Tente de novo em instantes.'
}
