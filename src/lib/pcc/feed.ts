// Feed do Poke Creators Club (26/11/2026, wireframe v3 e UI v3 aprovados pelo Du).
// Substitui a sala de links do WhatsApp. O apoio que vale e o que a pessoa fez NA REDE
// do post, declarado na volta (sem print, sem prova, sem cota). O retorno privado e opcional,
// ligado por padrao, e so o autor le. Tudo passa pelas funcoes club_feed_* (migration
// 20261126200000_club_feed.sql); o navegador nunca le tabela.

export type Rede = 'instagram' | 'tiktok' | 'youtube' | 'twitch'
export type Formato = 'video_curto' | 'video_longo' | 'carrossel' | 'foto' | 'live'
export type Tema = 'abertura' | 'tour_fichario' | 'historia_carta' | 'resposta_publico' | 'colecao' | 'outro'
export type Pergunta = 'gancho' | 'edicao' | 'capa' | 'tamanho' | 'parte2' | 'so_ver'
export type Gesto = 'curti' | 'comentei' | 'compartilhei' | 'salvei' | 'segui'
export type Resposta = 'funcionou' | 'capa_abriu' | 'ate_o_fim' | 'aprendi' | 'parte2' | 'capa_escura' | 'texto_pequeno' | 'longo'
export type MotivoDenuncia = 'cobra_apoio' | 'nao_e_da_pessoa' | 'spam' | 'link_quebrado' | 'ofensivo' | 'golpe' | 'outro'
export type MotivoTirar = 'cobra_apoio' | 'nao_e_da_pessoa' | 'spam' | 'link_quebrado' | 'ofensivo' | 'fora_do_tema' | 'outro'

export type PostFeed = {
  id: string
  rede: Rede
  formato: Formato
  tema: Tema | null
  pergunta: Pergunta | null
  url: string
  /** Caminho da capa no bucket club-fotos (feed/<id>.webp); nulo enquanto a Mia Servidor nao capturou. */
  capa: string | null
  arroba: string
  feed_em: string
  retorno: boolean
  primeiro: boolean
  tema_semana: boolean
  escolha: boolean
  meu: boolean
  /** Gestos que eu marquei (vazio = "So vi"); nulo se nao marquei ou nao estou logado. */
  minha_marca: Gesto[] | null
  meu_retorno: boolean
  ja_sigo: boolean
  /** So vem no proprio post do autor. */
  apoiaram: number | null
}

export type ListaFeed = {
  itens: PostFeed[]
  tem_mais: boolean
  semana: { inicio: string; tema: string | null } | null
}

export type MeuPost = {
  id: string; rede: Rede; formato: Formato; tema: Tema | null; pergunta: Pergunta | null; url: string; capa: string | null
  feed_em: string; retorno: boolean; oculto: boolean; oculto_motivo: string | null
  apoiaram: number; a_confirmar: number; retornos: number
}

export type QuemApoiou = {
  apoios: { arroba: string; gestos: Gesto[]; comentou: boolean; confirmado_em: string | null; em: string }[]
  soma: { pessoas: number; curti: number; comentei: number; compartilhei: number; salvei: number }
  retornos: { arroba: string; respostas: Resposta[]; em: string }[]
}

export type MeuApoio = { creators: number; comentarios_confirmados: number; desde: string | null }

export type ListaOrganizar = {
  primeiros: { id: string; arroba: string; rede: Rede; tema: Tema | null; url: string; feed_em: string; apoiaram: number }[]
  denunciados: { id: string; arroba: string; rede: Rede; tema: Tema | null; url: string; oculto: boolean; motivos: Record<string, number>; ultima: string }[]
  conferir_arroba: { id: string; arroba: string; arroba_video: string; url: string; feed_em: string }[]
  fora: { id: string; arroba: string; rede: Rede; url: string; motivo: string | null; nota: string | null; em: string }[]
  semana: { inicio: string; tema: string | null; escolha: string | null }
}

export const REDES: Record<Rede, { nome: string; ico: string }> = {
  instagram: { nome: 'Instagram', ico: 'insta' },
  tiktok: { nome: 'TikTok', ico: 'tiktok' },
  youtube: { nome: 'YouTube', ico: 'youtube' },
  twitch: { nome: 'Twitch', ico: 'twitch' },
}

export const FORMATOS: Record<Formato, string> = {
  video_curto: 'Vídeo curto', video_longo: 'Vídeo longo', carrossel: 'Carrossel', foto: 'Foto', live: 'Live',
}

export const TEMAS: Record<Tema, string> = {
  abertura: 'Abertura', tour_fichario: 'Tour de fichário', historia_carta: 'História de carta',
  resposta_publico: 'Resposta ao público', colecao: 'Coleção', outro: 'Outro',
}

/** A pergunta do autor vira o assunto do comentário na rede ("@x pergunta: ..."). */
export const PERGUNTAS: Record<Pergunta, string> = {
  gancho: 'O começo prende?', edicao: 'A edição está clara?', capa: 'A capa chama atenção?',
  tamanho: 'O tamanho está bom?', parte2: 'Vale uma parte 2?', so_ver: 'Só quero que vejam',
}

/** Gestos de cada rede, do mais leve ao mais pesado; seguir sempre por último. Twitch não tem salvar. */
export const GESTOS_POR_REDE: Record<Rede, { g: Gesto; rotulo: string; ico: string }[]> = {
  instagram: [
    { g: 'curti', rotulo: 'Curti', ico: 'coracao' }, { g: 'comentei', rotulo: 'Comentei', ico: 'chat' },
    { g: 'compartilhei', rotulo: 'Compartilhei ou repostei', ico: 'repost' }, { g: 'salvei', rotulo: 'Salvei', ico: 'salvar' },
    { g: 'segui', rotulo: 'Comecei a seguir', ico: 'seguir' },
  ],
  tiktok: [
    { g: 'curti', rotulo: 'Curti', ico: 'coracao' }, { g: 'comentei', rotulo: 'Comentei', ico: 'chat' },
    { g: 'compartilhei', rotulo: 'Compartilhei ou repostei', ico: 'repost' }, { g: 'salvei', rotulo: 'Favoritei', ico: 'salvar' },
    { g: 'segui', rotulo: 'Comecei a seguir', ico: 'seguir' },
  ],
  youtube: [
    { g: 'curti', rotulo: 'Gostei', ico: 'coracao' }, { g: 'comentei', rotulo: 'Comentei', ico: 'chat' },
    { g: 'compartilhei', rotulo: 'Compartilhei', ico: 'repost' }, { g: 'salvei', rotulo: 'Salvei em uma playlist', ico: 'salvar' },
    { g: 'segui', rotulo: 'Me inscrevi no canal', ico: 'seguir' },
  ],
  twitch: [
    { g: 'curti', rotulo: 'Assisti', ico: 'eye' }, { g: 'comentei', rotulo: 'Escrevi no chat', ico: 'chat' },
    { g: 'compartilhei', rotulo: 'Compartilhei', ico: 'repost' }, { g: 'segui', rotulo: 'Comecei a seguir o canal', ico: 'seguir' },
  ],
}

export function rotuloGesto(rede: Rede, g: Gesto): string {
  return GESTOS_POR_REDE[rede].find(x => x.g === g)?.rotulo ?? g
}

export const RESPOSTAS_BOAS: { r: Resposta; rotulo: string }[] = [
  { r: 'funcionou', rotulo: 'Funcionou' }, { r: 'capa_abriu', rotulo: 'A capa me fez abrir' },
  { r: 'ate_o_fim', rotulo: 'Vi até o fim' }, { r: 'aprendi', rotulo: 'Aprendi algo novo' }, { r: 'parte2', rotulo: 'Quero a parte 2' },
]
export const RESPOSTAS_MELHORAR: { r: Resposta; rotulo: string }[] = [
  { r: 'capa_escura', rotulo: 'A capa está escura' }, { r: 'texto_pequeno', rotulo: 'Texto pequeno' }, { r: 'longo', rotulo: 'Ficou longo' },
]
export const rotuloResposta = (r: Resposta) => [...RESPOSTAS_BOAS, ...RESPOSTAS_MELHORAR].find(x => x.r === r)?.rotulo ?? r

export const MOTIVOS_DENUNCIA: { m: MotivoDenuncia; rotulo: string }[] = [
  { m: 'cobra_apoio', rotulo: 'Cobra apoio ou propõe troca' }, { m: 'nao_e_da_pessoa', rotulo: 'Não é um post desta pessoa' },
  { m: 'spam', rotulo: 'Spam ou post repetido' }, { m: 'link_quebrado', rotulo: 'O link não abre' },
  { m: 'ofensivo', rotulo: 'Ofensivo' }, { m: 'golpe', rotulo: 'Golpe ou link suspeito' }, { m: 'outro', rotulo: 'Outro motivo' },
]

export const MOTIVOS_TIRAR: { m: MotivoTirar; rotulo: string }[] = [
  { m: 'cobra_apoio', rotulo: 'Cobra apoio ou propõe troca' }, { m: 'nao_e_da_pessoa', rotulo: 'Não é um post desta pessoa' },
  { m: 'spam', rotulo: 'Spam ou repetido' }, { m: 'link_quebrado', rotulo: 'O link não abre' },
  { m: 'ofensivo', rotulo: 'Ofensivo ou link suspeito' }, { m: 'fora_do_tema', rotulo: 'Fora do tema do Club' }, { m: 'outro', rotulo: 'Outro' },
]

/** Motivo de "fora do feed" como o autor lê. */
export function motivoFora(m: string | null): string {
  if (m === 'denuncias') return 'Recebeu denúncias. A organização vai olhar.'
  return MOTIVOS_TIRAR.find(x => x.m === m)?.rotulo ?? 'Tirado pela organização.'
}

/**
 * Só abre link de post das quatro redes, em https. O banco já grava a URL remontada a partir do
 * id do post; aqui é a segunda trava, para nada fora disso virar href.
 */
export function linkFeed(url: string): string | null {
  return /^https:\/\/(www\.instagram\.com\/(p|reel|tv)\/|www\.tiktok\.com\/@[A-Za-z0-9._]{1,30}\/video\/|www\.youtube\.com\/(watch\?v=|shorts\/|live\/)|www\.twitch\.tv\/videos\/)[A-Za-z0-9_-]+\/?$/.test(url) ? url : null
}

/** Lê o link colado e adivinha rede e formato, igual ao que o banco aceita. Nulo = não é post das quatro redes. */
export function lerLinkColado(bruto: string): { rede: Rede; formato: Formato; arroba: string | null } | null {
  const v = bruto.trim()
  let m = v.match(/^https:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]{5,40}(?:[/?#].*)?$/)
  if (m) return { rede: 'instagram', formato: m[1] === 'p' ? 'foto' : 'video_curto', arroba: null }
  m = v.match(/^https:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{1,30})\/video\/[0-9]{8,25}(?:[/?#].*)?$/)
  if (m) return { rede: 'tiktok', formato: 'video_curto', arroba: m[1].toLowerCase() }
  m = v.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/(shorts|live)\/[A-Za-z0-9_-]{11}(?:[/?#].*)?$/)
  if (m) return { rede: 'youtube', formato: m[1] === 'shorts' ? 'video_curto' : 'live', arroba: null }
  if (/^https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?(?:[^#]*&)?v=[A-Za-z0-9_-]{11}/.test(v) || /^https:\/\/youtu\.be\/[A-Za-z0-9_-]{11}/.test(v)) {
    return { rede: 'youtube', formato: 'video_longo', arroba: null }
  }
  if (/^https:\/\/(?:www\.|m\.)?twitch\.tv\/videos\/[0-9]{6,15}(?:[/?#].*)?$/.test(v)) return { rede: 'twitch', formato: 'live', arroba: null }
  return null
}

/** Por que o link não serve, para a folha Postar explicar (quadro 11). */
export function motivoLinkRecusado(bruto: string): string {
  const v = bruto.trim().toLowerCase()
  if (!v) return 'Cole o link do post.'
  if (/instagram\.com\/stories\//.test(v)) return 'Story some em 24 horas e não entra no feed. Cole o link de um post, reel ou carrossel.'
  if (/vm\.tiktok\.com|vt\.tiktok\.com/.test(v)) return 'Link curto do TikTok não serve. Abra o vídeo e copie o link completo, com o @ e o número do vídeo.'
  if (/instagram\.com\/[a-z0-9._]+\/?$/.test(v) || /tiktok\.com\/@[a-z0-9._]+\/?$/.test(v)) return 'Esse é o link do perfil. Cole o link de um post.'
  if (!/^https:\/\//.test(v)) return 'O link precisa começar com https://.'
  return 'Só entra post do Instagram, TikTok, YouTube ou Twitch.'
}

/** Mensagens das funções do banco em texto para a pessoa. */
export function erroFeed(msg?: string | null): string {
  const m = msg || ''
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('nao_membro')) return 'Para postar e apoiar, entre no Club primeiro.'
  if (m.includes('sem_instagram')) return 'Falta o seu @ do Instagram no cadastro do Club.'
  if (m.includes('sem_declaracao')) return 'Confirme que o post foi publicado pelo seu perfil.'
  if (m.includes('link_invalido')) return 'Só entra post do Instagram, TikTok, YouTube ou Twitch.'
  if (m.includes('post_de_outra_pessoa') || m.includes('link_ja_cadastrado')) return 'Esse post já foi colocado no Club por outra pessoa. Se ele é seu, fale com a organização.'
  if (m.includes('ja_no_feed')) return 'Esse post já está no feed.'
  if (m.includes('tirado_do_feed')) return 'Esse post foi tirado do feed. Só a organização devolve.'
  if (m.includes('arroba_diferente')) return 'O @ do vídeo é diferente do seu @ no Club.'
  if (m.includes('pergunta_invalida')) return 'Escolha o que você quer saber de quem comentar.'
  if (m.includes('formato_invalido')) return 'Escolha o formato do post.'
  if (m.includes('proprio_post')) return 'Esse post é seu.'
  if (m.includes('proprio_conteudo')) return 'Esse post é seu. Outra pessoa da organização decide.'
  if (m.includes('retorno_desligado')) return 'Quem postou desligou o retorno privado.'
  if (m.includes('resposta_invalida')) return 'Escolha de uma a três respostas.'
  if (m.includes('gesto_invalido')) return 'Marque só o que dá para fazer nessa rede.'
  if (m.includes('post_nao_encontrado')) return 'Esse post não está mais no feed.'
  if (m.includes('apoio_nao_encontrado')) return 'Não achamos esse comentário.'
  if (m.includes('motivo_invalido')) return 'Escolha um motivo.'
  if (m.includes('sem_papel')) return 'Só a organização do feed pode fazer isso.'
  if (m.includes('tema_invalido')) return 'O tema tem de 3 a 40 letras.'
  return 'Não deu certo agora. Tente de novo em instantes.'
}

/** Quanto tempo faz, curto, no relógio de Brasília: "agora", "há 12 min", "há 3 h", "ontem", "12/11". */
export function haQuanto(iso: string, agora = Date.now()): string {
  const s = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  if (s < 172800) return 'ontem'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(iso))
}

/** Dia do calendario de Brasilia (AAAA-MM-DD) de um instante. */
const diaBrasilia = (t: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(t))

export type GrupoDia = 'hoje' | 'ontem' | 'semana' | 'antes'
export const ROTULO_DIA: Record<GrupoDia, string> = { hoje: 'Hoje', ontem: 'Ontem', semana: 'Esta semana', antes: 'Mais antigos' }

/** Hoje / Ontem / Esta semana (ate 7 dias) / Mais antigos, no relogio de Brasilia. Mantem a ordem da lista. */
export function agruparPorDia<T extends { feed_em: string }>(itens: T[], agora: number): { g: GrupoDia; itens: T[] }[] {
  const hoje = diaBrasilia(agora)
  const ontem = diaBrasilia(agora - 86400000)
  const grupos: { g: GrupoDia; itens: T[] }[] = []
  for (const p of itens) {
    const t = new Date(p.feed_em).getTime()
    const d = diaBrasilia(t)
    const g: GrupoDia = d === hoje ? 'hoje' : d === ontem ? 'ontem' : agora - t < 7 * 86400000 ? 'semana' : 'antes'
    const ult = grupos[grupos.length - 1]
    if (ult && ult.g === g) ult.itens.push(p)
    else grupos.push({ g, itens: [p] })
  }
  return grupos
}

/** Post das ultimas 24 horas. */
export const ehNovo = (iso: string, agora: number) => agora > 0 && agora - new Date(iso).getTime() < 86400000

/** "@a, @b e mais gente postaram hoje" sem repetir pessoa. Devolve os @ unicos e a frase. */
export function linhaViva(arrobas: string[], g: GrupoDia): { unicos: string[]; partes: { a: string[]; resto: string } } {
  const unicos = Array.from(new Set(arrobas))
  const quando = g === 'hoje' ? ' hoje' : g === 'ontem' ? ' ontem' : ''
  const verbo = unicos.length === 1 ? 'postou' : 'postaram'
  if (unicos.length <= 2) return { unicos, partes: { a: unicos, resto: `${verbo}${quando}` } }
  return { unicos, partes: { a: unicos.slice(0, 2), resto: `e mais gente postaram${quando}` } }
}

/** Posts que a pessoa ja abriu, guardados no navegador para o anel de "nao visto". */
const CHAVE_VISTOS = 'bynx.feed.vistos'
export function lerVistos(): Set<string> {
  try { const v = localStorage.getItem(CHAVE_VISTOS); return new Set(v ? (JSON.parse(v) as string[]) : []) } catch { return new Set() }
}
export function gravarVisto(id: string) {
  try {
    const v = Array.from(lerVistos()).filter(x => x !== id)
    v.push(id)
    localStorage.setItem(CHAVE_VISTOS, JSON.stringify(v.slice(-400)))
  } catch { /* sem armazenamento: o anel so fica aceso */ }
}

/** Marca guardada no navegador: as ideias de comentar aparecem uma vez; as regras, antes do primeiro post. */
export const CHAVE_IDEIAS = 'bynx.feed.ideias-vistas'
export const CHAVE_REGRAS = 'bynx.feed.regras-vistas'
export function lerMarca(chave: string): boolean {
  try { return localStorage.getItem(chave) === '1' } catch { return false }
}
export function gravarMarca(chave: string) {
  try { localStorage.setItem(chave, '1') } catch { /* navegador sem armazenamento: só volta a mostrar */ }
}
