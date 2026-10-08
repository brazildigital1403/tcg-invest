/**
 * Contexto de um tick do motor: o que e lido UMA vez e reaproveitado por
 * todos os templates (usuarios, log de envio, colecoes, historico de preco).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPromocoesEmail, type PromocaoEmail } from '@/lib/email'
import { modoAtual, ORCAMENTO_MS, type Modo } from './config'
import {
  Historico, carregarAnunciosAtivos, carregarColecoes, carregarEnvios, carregarUsuarios, db,
  type Anuncio, type CartaCatalogo, type Colecao, type EnvioLog, type Usuario,
} from './banco'
import { diaBR } from './tempo'

export type Contexto = {
  c: SupabaseClient
  hoje: string
  agoraMs: number
  modo: Modo
  /** Instante (ms) depois do qual nao se comeca trabalho novo. */
  prazoMs: number
  /** Ignora o calendario (so na simulacao): conta quem receberia se fosse o dia. */
  forcar: boolean
  usuarios: Map<string, Usuario>
  envios: Map<string, EnvioLog[]>
  catalogo: Map<string, CartaCatalogo>
  historico: Historico
  _colecoes?: Map<string, Colecao>
  _anuncios?: Anuncio[]
  _promocoes?: PromocaoEmail[]
  _metas?: MetaLinha[]
  _lojas: Map<string, LojaResumo | null>
}

/**
 * `forcar` (ignorar o calendario) so vale na simulacao ou numa contagem
 * `seca` (que nunca envia nem grava). Com a chave ligada, o cron respeita as datas.
 */
export async function criarContexto(opts: { forcar?: boolean; seco?: boolean; prazoMs?: number; inicioMs?: number; so?: string[] } = {}): Promise<Contexto> {
  const c = db()
  const inicio = opts.inicioMs ?? Date.now()
  const modo = modoAtual()
  // `so`: contexto de poucas pessoas (envio na hora), sem ler a base inteira.
  const usuarios = await carregarUsuarios(c, opts.so)
  const envios = await carregarEnvios(c, [...usuarios.keys()])
  const hoje = diaBR(new Date(inicio))
  return {
    c, hoje, agoraMs: inicio, modo,
    prazoMs: opts.prazoMs ?? inicio + ORCAMENTO_MS,
    // Forcar o calendario e ferramenta de SIMULACAO: com a chave ligada, nunca.
    forcar: opts.forcar === true && (modo === 'simulacao' || opts.seco === true),
    usuarios, envios, catalogo: new Map(), historico: new Historico(hoje), _lojas: new Map(),
  }
}

export function semTempo(ctx: Contexto): boolean {
  return Date.now() > ctx.prazoMs
}

/** Colecoes de TODOS os usuarios (user_cards inteira, ~7,5 mil linhas, como o cron-portfolio). */
export async function colecoes(ctx: Contexto): Promise<Map<string, Colecao>> {
  if (!ctx._colecoes) ctx._colecoes = await carregarColecoes(ctx.c, ctx.catalogo, [...ctx.usuarios.keys()])
  return ctx._colecoes
}

export async function colecaoDe(ctx: Contexto, userId: string): Promise<Colecao> {
  const m = await colecoes(ctx)
  return m.get(userId) ?? { cartas: [], total: 0, diferentes: 0, valor: 0 }
}

/** Historico de preco das cartas destas colecoes (carrega so o que falta). */
export async function prepararHistorico(ctx: Contexto, cols: Colecao[]): Promise<void> {
  const ids = new Set<string>()
  for (const col of cols) for (const x of col.cartas) if (x.cardId && x.cat) ids.add(x.cardId)
  await ctx.historico.carregar(ctx.c, [...ids])
}

export async function anunciosAtivos(ctx: Contexto): Promise<Anuncio[]> {
  if (!ctx._anuncios) ctx._anuncios = await carregarAnunciosAtivos(ctx.c)
  return ctx._anuncios
}

export type MetaLinha = {
  id: string
  user_id: string
  tipo: 'set' | 'pokemon'
  alvo: string
  regiao: string | null
  idioma: string | null
  total: number | null
  tenho: number | null
  concluida_em: string | null
}

/** metas_colecao inteira (~11 linhas), uma vez por tick. */
export async function metas(ctx: Contexto): Promise<MetaLinha[]> {
  if (!ctx._metas) {
    const { data, error } = await ctx.c.from('metas_colecao')
      .select('id, user_id, tipo, alvo, regiao, idioma, total, tenho, concluida_em').order('id').limit(5000)
    if (error) throw new Error(`[regua] metas_colecao: ${error.message}`)
    ctx._metas = (data || []) as MetaLinha[]
  }
  return ctx._metas
}

export type LojaResumo = { nome: string; cidade: string; uf: string }

/** Loja ativa do vendedor (a mais antiga, como no resolverRecebedor), cacheada no tick. */
export async function lojaDe(ctx: Contexto, userId: string): Promise<LojaResumo | null> {
  if (ctx._lojas.has(userId)) return ctx._lojas.get(userId) ?? null
  const { data, error } = await ctx.c.from('lojas').select('nome, cidade, estado').eq('owner_user_id', userId)
    .eq('status', 'ativa').order('created_at', { ascending: true }).limit(1)
  if (error) throw new Error(`[regua] lojas: ${error.message}`)
  const l = data?.[0] as { nome?: string; cidade?: string; estado?: string } | undefined
  const v = l ? { nome: String(l.nome || ''), cidade: String(l.cidade || '').trim(), uf: String(l.estado || '').trim().toUpperCase() } : null
  ctx._lojas.set(userId, v)
  return v
}

/** Selecao Bynx do momento (vitrine 'email'), lida uma vez por tick. Falha = sem o bloco. */
export async function promocoes(ctx: Contexto): Promise<PromocaoEmail[]> {
  if (!ctx._promocoes) ctx._promocoes = await getPromocoesEmail(2)
  return ctx._promocoes
}
