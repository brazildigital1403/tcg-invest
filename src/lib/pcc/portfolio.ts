// Portfólio do criador no Poké Creators Club (Fase 2, fatia 2). O membro registra o próprio
// conteúdo (um link por linha, sem texto livre), preenche a ficha de criador e aceita o
// compromisso do criador. O banco valida o link pelo formato e o grava na forma canônica; o
// servidor não chama rede nenhuma. O portfólio é público: quem tem conteúdo ativo tem página.

import { supabase } from '@/lib/supabaseClient'

export type Rede = 'instagram' | 'tiktok' | 'youtube' | 'twitch'
export type Formato = 'video_curto' | 'video_longo' | 'carrossel' | 'foto' | 'live'
export type Tema = 'abertura' | 'tour_fichario' | 'historia_carta' | 'resposta_publico' | 'colecao' | 'outro'

export const REDES: Record<Rede, string> = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', twitch: 'Twitch' }
export const FORMATOS: Record<Formato, string> = { video_curto: 'Vídeo curto', video_longo: 'Vídeo longo', carrossel: 'Carrossel', foto: 'Foto', live: 'Live' }
export const TEMAS: Record<Tema, string> = {
  abertura: 'Abertura', tour_fichario: 'Tour de fichário', historia_carta: 'História de uma carta',
  resposta_publico: 'Resposta ao público', colecao: 'Coleção', outro: 'Outro',
}
export const PRODUZ: Record<string, string> = {
  abertura: 'Aberturas', colecao: 'Coleção', noticias: 'Notícias', tutorial: 'Tutoriais', competitivo: 'Competitivo',
  humor: 'Humor', review: 'Reviews', live: 'Lives', vlog: 'Vlogs',
}
export const HABILIDADES: Record<string, string> = {
  edicao: 'Edição', roteiro: 'Roteiro', captacao: 'Captação', luz_audio: 'Luz e áudio', capas: 'Capas', lives: 'Lives',
  parcerias: 'Parcerias', graduacao: 'Graduação', colecao: 'Coleção', competitivo: 'Competitivo',
}
/** Quantos itens cabem em cada lista da ficha. */
export const MAX_FICHA = 5
/** O termo do compromisso do criador em vigor. O texto fica na tela; o id muda se o texto mudar. */
export const TERMO_JOGO_LIMPO = 'jogo-limpo-v1'

export type Conteudo = {
  id: string; rede: Rede; formato: Formato; tema: Tema | null; url: string
  /** A data que a pessoa declarou (AAAA-MM-DD). */
  publicado_em: string
  created_at: string
  status: 'ativo' | 'reprovado'
}
export type Ficha = { produz: string[]; ensina: string[]; aprende: string[]; bio: string | null }
/** Carta que chegou com a ação (registrar conteúdo, ficha ou aceite). */
export type CartaChegou = { slug: string; titulo: string; papel: 'base' | 'capitulo' | 'especial'; numero: number }

export type Portfolio = {
  /** O @ do perfil, que forma o endereço da página pública. Nulo = ainda sem @ válido. */
  instagram: string | null
  conteudos: Conteudo[]
  /** Quantos conteúdos ainda cabem hoje (o teto é 5 por dia). */
  hoje_restam: number
  semanas_seguidas: number
  ficha: Ficha | null
  aceites: string[]
}

export type ConteudoPublico = Pick<Conteudo, 'rede' | 'formato' | 'tema' | 'url' | 'publicado_em'>
export type CriadorPublico = { criador: { instagram: string; bio: string | null; produz: string[]; total: number }; conteudos: ConteudoPublico[] }

export type Resposta<T> = { ok: true; d: T } | { ok: false; msg: string; codigo: string }

/** Mensagens das funções do banco em texto para a pessoa. */
export function erroPortfolio(msg?: string | null): string {
  const m = msg || ''
  if (m.includes('nao_membro')) return 'Entre no Club para usar o portfólio.'
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('link_invalido')) return 'Cole o link completo de um post do Instagram, TikTok, YouTube ou Twitch. Link de perfil e link curto não valem.'
  if (m.includes('link_ja_cadastrado')) return 'Esse link já está em um portfólio do Club.'
  if (m.includes('formato_invalido')) return 'Escolha o formato do conteúdo.'
  if (m.includes('tema_invalido')) return 'Tema inválido.'
  if (m.includes('data_invalida')) return 'Confira a data de publicação: ela não pode ser futura.'
  if (m.includes('limite_do_dia')) return 'Você já registrou 5 conteúdos hoje. Amanhã cabem mais.'
  if (m.includes('limite_total')) return 'O portfólio chegou ao limite de 300 conteúdos.'
  if (m.includes('conteudo_nao_encontrado')) return 'Esse conteúdo não é seu ou não existe mais.'
  if (m.includes('ficha_invalida')) return `Escolha até ${MAX_FICHA} itens em cada lista.`
  if (m.includes('bio_invalida')) return 'A bio precisa ter de 10 a 120 caracteres, em uma linha.'
  if (m.includes('termo_invalido')) return 'Esse compromisso não está mais em vigor.'
  return 'Não conseguimos concluir. Tente de novo.'
}

async function chamar<T>(funcao: string, args?: Record<string, unknown>): Promise<Resposta<T>> {
  const { data, error } = await supabase.rpc(funcao, args)
  if (error) return { ok: false, msg: erroPortfolio(error.message), codigo: error.message || '' }
  return { ok: true, d: data as T }
}

export const carregarPortfolio = () => chamar<Portfolio>('club_portfolio_meu')

export const salvarConteudo = (p: { url: string; formato: Formato; tema: Tema | null; publicado_em: string }) =>
  chamar<{ conteudo: Conteudo; cartas: CartaChegou[] }>('club_conteudo_salvar', { p })

export const removerConteudo = (id: string) => chamar<{ removido: string }>('club_conteudo_remover', { p_id: id })

export const salvarFicha = (p: Partial<Ficha>) => chamar<{ ficha: Ficha; cartas: CartaChegou[] }>('club_criador_salvar', { p })

export const aceitarTermo = (termo: string) => chamar<{ termo: string; cartas: CartaChegou[] }>('club_aceite_registrar', { p_termo: termo })

/** A página pública de um criador, sem sessão. Nulo = não existe (sem conteúdo, fora do Club ou @ errado). */
export async function carregarCriador(arroba: string): Promise<{ ok: true; d: CriadorPublico | null } | { ok: false }> {
  const { data, error } = await supabase.rpc('club_portfolio_publico', { p_arroba: arroba })
  if (error) return { ok: false }
  const d = data as { criador: CriadorPublico['criador'] | null; conteudos?: ConteudoPublico[] } | null
  if (!d || !d.criador) return { ok: true, d: null }
  return { ok: true, d: { criador: d.criador, conteudos: d.conteudos ?? [] } }
}

/** Hoje em Brasília, no formato do campo de data. */
export function hojeBr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** 2026-11-21 em 21/11/2026. */
export const dataBrCurta = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}` }

/** A rede de um link, só para mostrar o chip enquanto a pessoa digita (quem decide é o banco). */
export function redeDoLink(url: string): Rede | null {
  const u = url.trim().toLowerCase()
  if (/^https:\/\/(www\.)?instagram\.com\//.test(u)) return 'instagram'
  if (/^https:\/\/(www\.|m\.)?tiktok\.com\//.test(u)) return 'tiktok'
  if (/^https:\/\/((www\.|m\.)?youtube\.com|youtu\.be)\//.test(u)) return 'youtube'
  if (/^https:\/\/(www\.|m\.)?twitch\.tv\//.test(u)) return 'twitch'
  return null
}
