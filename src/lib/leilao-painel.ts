/**
 * Leilao — painel da loja (fatia 5). Funcoes puras: sem I/O, sem Supabase.
 *
 * Usadas nas rotas /api/lojas/[id]/leiloes/** (validacao do body) e nas telas
 * /minha-loja/[id]/leiloes (formulario). A regra que vale e a do SERVIDOR; a
 * tela repete so para avisar antes de enviar.
 *
 * ★ O que e decisao atomica do banco (leilao_agendar_rodada, migration
 *   20260928120000_leilao_painel.sql) NAO mora aqui: pelo menos 1 lote, 2 fotos
 *   por lote e inicio >= agora + 10 min sao conferidos DE NOVO la, sob trava.
 *   Aqui e so o aviso cedo.
 */

// ─── Opcoes do formulario ───────────────────────────────────────────────────

/** Condicao do lote. "M" (mint) a mais que a escala da colecao (src/lib/condicoes.ts). */
export const CONDICOES_LOTE = ['M', 'NM', 'SP', 'MP', 'HP', 'D'] as const
export type CondicaoLote = (typeof CONDICOES_LOTE)[number]

/** Mesmos 9 idiomas do seletor da colecao (AddCardModal) e do selo do CardItem. */
export const IDIOMAS_LOTE = ['pt', 'en', 'jp', 'es', 'fr', 'de', 'it', 'cn', 'kr'] as const
export type IdiomaLote = (typeof IDIOMAS_LOTE)[number]

/** Duracao de cada lote na rodada ao vivo (segundos). */
export const DURACOES_LOTE = [30, 45, 60, 90] as const
export type DuracaoLote = (typeof DURACOES_LOTE)[number]

/** Antecedencia minima para agendar (espelho do p_antecedencia_min do SQL). */
export const ANTECEDENCIA_MIN_AGENDAR = 10

/** Lance inicial: mesmo intervalo do CHECK de leiloes.lance_inicial_cents. */
export const LANCE_INICIAL_MIN_CENTS = 100
export const LANCE_INICIAL_MAX_CENTS = 100_000_000

/** Fotos reais obrigatorias: frente e verso. */
export const FOTOS_OBRIGATORIAS = 2

// ─── Sugestao de lance inicial ──────────────────────────────────────────────

/** Fracao do menor preco do Mercado Brasileiro usada como sugestao. */
export const FRACAO_SUGESTAO = 0.6

/**
 * Sugestao de lance inicial: 60% do MENOR preco (reais) do Mercado Brasileiro,
 * arredondado para baixo em reais inteiros. Sem preco (0, null, NaN) -> null:
 * a tela nao sugere nada, nunca crava um valor. Nunca abaixo de R$ 1,00.
 */
export function sugestaoLanceInicialCents(menorPrecoReais: number | null | undefined): number | null {
  const p = Number(menorPrecoReais)
  if (!Number.isFinite(p) || p <= 0) return null
  const reais = Math.floor(p * FRACAO_SUGESTAO)
  return Math.max(LANCE_INICIAL_MIN_CENTS, reais * 100)
}

// ─── Dinheiro digitado ──────────────────────────────────────────────────────

/** "1.234,56" | "12,5" | "12" | "12.50" -> centavos. null se invalido. */
export function reaisParaCents(txt: string | null | undefined): number | null {
  let s = String(txt ?? '').trim().replace(/[^\d.,]/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '')
  else if (/\.\d{3}$/.test(s)) s = s.replace('.', '')
  const v = Number(s)
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.round(v * 100)
}

// ─── Horario de Brasilia ────────────────────────────────────────────────────

/**
 * Data e hora digitadas em Brasilia -> ISO UTC. America/Sao_Paulo e UTC-3 fixo
 * desde 2019 (sem horario de verao). null se o formato nao bater.
 *   ("2026-09-28", "21:30") -> "2026-09-29T00:30:00.000Z"
 */
export function brasiliaParaISO(data: string, hora: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data ?? '').trim())
  const h = /^(\d{2}):(\d{2})$/.exec(String(hora ?? '').trim())
  if (!d || !h) return null
  const [ano, mes, dia] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const [hh, mm] = [Number(h[1]), Number(h[2])]
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || hh > 23 || mm > 59) return null
  const ms = Date.UTC(ano, mes - 1, dia, hh + 3, mm)
  const t = new Date(ms)
  // 31/02 vira 03/03 no Date.UTC: confere que o dia sobreviveu.
  const volta = new Date(ms - 3 * 3600_000)
  if (volta.getUTCDate() !== dia || volta.getUTCMonth() !== mes - 1) return null
  return t.toISOString()
}

/** ISO -> { data: "2026-09-28", hora: "21:30" } em Brasilia (para preencher o form). */
export function isoParaBrasilia(iso: string | null | undefined): { data: string; hora: string } {
  const t = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(t)) return { data: '', hora: '' }
  const d = new Date(t - 3 * 3600_000)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return {
    data: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
    hora: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
  }
}

// ─── Validacao da rodada ────────────────────────────────────────────────────

export interface RodadaInput {
  titulo: string
  descricao: string | null
  iniciaEm: string | null
  linkTransmissao: string | null
}

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string }

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Link da transmissao: so https, sem espaco, ate 300 caracteres. */
export function linkValido(v: string): boolean {
  if (!v || v.length > 300 || /\s/.test(v)) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && !!u.hostname && u.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * Body de criar/editar rodada. `parcial` = PATCH (so valida o que veio).
 * `inicia_em` chega em ISO (a tela converte de Brasilia antes).
 */
export function validarRodada(
  b: Record<string, unknown>,
  parcial: boolean
): Resultado<Partial<RodadaInput>> {
  const out: Partial<RodadaInput> = {}
  if (!parcial || 'titulo' in b) {
    const t = texto(b.titulo)
    if (t.length < 3 || t.length > 80) return { ok: false, erro: 'O título precisa ter entre 3 e 80 caracteres.' }
    out.titulo = t
  }
  if ('descricao' in b) {
    const d = texto(b.descricao)
    if (d.length > 1000) return { ok: false, erro: 'Descrição muito longa (máx. 1000 caracteres).' }
    out.descricao = d || null
  }
  if ('inicia_em' in b) {
    if (b.inicia_em == null || b.inicia_em === '') {
      out.iniciaEm = null
    } else {
      const t = Date.parse(String(b.inicia_em))
      if (!Number.isFinite(t)) return { ok: false, erro: 'Data de início inválida.' }
      out.iniciaEm = new Date(t).toISOString()
    }
  }
  if ('link_transmissao' in b) {
    const l = texto(b.link_transmissao)
    if (l && !linkValido(l)) return { ok: false, erro: 'Link da transmissão inválido. Use o endereço completo com https://.' }
    out.linkTransmissao = l || null
  }
  return { ok: true, valor: out }
}

// ─── Validacao do lote ──────────────────────────────────────────────────────

export interface LoteInput {
  cardId: string
  fotos: string[]
  condicao: CondicaoLote
  idioma: IdiomaLote
  graduadora: string | null
  nota: string | null
  descricao: string | null
  lanceInicialCents: number
  duracaoSeg: DuracaoLote
}

/**
 * Body de adicionar lote. A carta vem so pelo `card_id` do catalogo: nome,
 * numero, set e imagem o servidor le por PK, nunca confia no que o cliente
 * mandou. `fotosPermitidas` = prefixo de URL do bucket da loja (a foto tem de
 * ter subido pela rota de foto do leilao).
 */
export function validarLote(
  b: Record<string, unknown>,
  opts: { fotosPermitidas: string; graduadorasValidas: readonly string[] }
): Resultado<LoteInput> {
  const cardId = texto(b.card_id)
  if (!cardId || cardId.length > 120) return { ok: false, erro: 'Escolha a carta do catálogo.' }

  const fotos = Array.isArray(b.fotos) ? b.fotos.map(texto).filter(Boolean) : []
  if (fotos.length !== FOTOS_OBRIGATORIAS) {
    return { ok: false, erro: 'Envie as duas fotos reais da carta: frente e verso.' }
  }
  if (!fotos.every(u => u.startsWith(opts.fotosPermitidas) && u.length <= 500)) {
    return { ok: false, erro: 'Foto inválida. Envie de novo pelo botão de foto.' }
  }
  if (new Set(fotos).size !== fotos.length) return { ok: false, erro: 'Frente e verso precisam ser fotos diferentes.' }

  const condicao = texto(b.condicao).toUpperCase() as CondicaoLote
  if (!CONDICOES_LOTE.includes(condicao)) return { ok: false, erro: 'Escolha a condição da carta.' }

  const idioma = texto(b.idioma).toLowerCase() as IdiomaLote
  if (!IDIOMAS_LOTE.includes(idioma)) return { ok: false, erro: 'Escolha o idioma da carta.' }

  const gradTxt = texto(b.graduadora).toLowerCase()
  let graduadora: string | null = null
  let nota: string | null = null
  if (gradTxt) {
    if (!opts.graduadorasValidas.includes(gradTxt)) return { ok: false, erro: 'Graduadora inválida.' }
    graduadora = gradTxt
    const n = texto(b.nota).replace(',', '.')
    const nv = Number(n)
    if (!n || !Number.isFinite(nv) || nv < 1 || nv > 10 || !/^\d{1,2}(\.\d)?$/.test(n)) {
      return { ok: false, erro: 'Informe a nota da graduação (de 1 a 10).' }
    }
    nota = n
  } else if (texto(b.nota)) {
    return { ok: false, erro: 'Nota sem graduadora. Escolha a graduadora ou apague a nota.' }
  }

  const descricao = texto(b.descricao)
  if (descricao.length > 1000) return { ok: false, erro: 'Descrição muito longa (máx. 1000 caracteres).' }

  const lance = Number(b.lance_inicial_cents)
  if (!Number.isInteger(lance) || lance < LANCE_INICIAL_MIN_CENTS || lance > LANCE_INICIAL_MAX_CENTS) {
    return { ok: false, erro: 'Lance inicial inválido. Use de R$ 1,00 a R$ 1.000.000,00.' }
  }

  const duracao = Number(b.duracao_seg) as DuracaoLote
  if (!DURACOES_LOTE.includes(duracao)) return { ok: false, erro: 'Escolha a duração do lote: 30, 45, 60 ou 90 segundos.' }

  return {
    ok: true,
    valor: {
      cardId,
      fotos,
      condicao,
      idioma,
      graduadora,
      nota,
      descricao: descricao || null,
      lanceInicialCents: lance,
      duracaoSeg: duracao,
    },
  }
}

// ─── Aviso antes de agendar ─────────────────────────────────────────────────

export interface ResumoAgendar {
  iniciaEm: string | null
  lotes: Array<{ fotos: unknown[] | null }>
  podeReceber: boolean
}

/**
 * Pendencias para agendar, em frase de tela. Lista vazia = pode agendar.
 * O banco confere de novo sob trava (exceto recebimento, que e da Stripe).
 */
export function pendenciasAgendar(r: ResumoAgendar, agoraMs: number = Date.now()): string[] {
  const out: string[] = []
  if (r.lotes.length === 0) out.push('Adicione pelo menos um lote.')
  const semFoto = r.lotes.filter(l => !Array.isArray(l.fotos) || l.fotos.length < FOTOS_OBRIGATORIAS).length
  if (semFoto > 0) out.push(semFoto === 1 ? 'Um lote está sem as duas fotos.' : `${semFoto} lotes estão sem as duas fotos.`)
  const ini = r.iniciaEm ? Date.parse(r.iniciaEm) : NaN
  if (!Number.isFinite(ini)) out.push('Defina a data e a hora de início.')
  else if (ini < agoraMs + ANTECEDENCIA_MIN_AGENDAR * 60_000) {
    out.push(`O início precisa ser daqui a pelo menos ${ANTECEDENCIA_MIN_AGENDAR} minutos.`)
  }
  if (!r.podeReceber) out.push('Ative os recebimentos em Pagamentos para receber pelos arremates.')
  return out
}

// ─── Erros das RPCs do painel ───────────────────────────────────────────────

/**
 * `raise` das RPCs do painel -> mensagem de tela + status HTTP. Os codigos sao
 * exatamente os da migration 20260928120000_leilao_painel.sql.
 */
export function erroDoPainel(msg: string | null | undefined): { status: number; mensagem: string } {
  const s = String(msg ?? '')
  const tabela: Array<[string, number, string]> = [
    ['rodada_nao_encontrada', 404, 'Rodada não encontrada.'],
    ['rodada_nao_rascunho', 409, 'Esta rodada já saiu do rascunho.'],
    ['rodada_fechada', 409, 'Esta rodada já foi encerrada ou cancelada.'],
    ['sem_lotes', 409, 'Adicione pelo menos um lote antes de agendar.'],
    ['lote_sem_fotos', 409, 'Todo lote precisa das duas fotos reais (frente e verso).'],
    ['inicio_cedo', 409, `O início precisa ser daqui a pelo menos ${ANTECEDENCIA_MIN_AGENDAR} minutos.`],
    ['sem_inicio', 409, 'Defina a data e a hora de início.'],
    ['lote_ja_abriu', 409, 'Um lote desta rodada já abriu para lances. A rodada não pode mais ser cancelada.'],
    ['ordem_invalida', 409, 'A lista de lotes mudou. Atualize a página e tente de novo.'],
    ['lote_fechado', 409, 'Só é possível reordenar lotes que ainda não abriram.'],
  ]
  for (const [cod, status, mensagem] of tabela) {
    if (new RegExp(`\\b${cod}\\b`).test(s)) return { status, mensagem }
  }
  return { status: 500, mensagem: 'Não foi possível concluir. Tente de novo.' }
}
