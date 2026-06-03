/**
 * Helpers de validação/montagem de eventos de loja (loja_eventos).
 * Compartilhado entre POST (criar) e PATCH (editar) das rotas de eventos.
 */

export const EVENTO_TIPOS = ['torneio', 'liga', 'pre_lancamento', 'encontro', 'outro'] as const
export const EVENTO_STATUS = ['rascunho', 'publicado'] as const
export const EVENTO_RECORRENCIAS = ['nenhuma', 'semanal', 'quinzenal', 'mensal'] as const

export type MontarResultado =
  | { ok: true; value: Record<string, any> }
  | { ok: false; error: string }

/**
 * Valida e monta o payload de um evento.
 * @param body   corpo recebido da request
 * @param parcial true em PATCH (campos ausentes são ignorados); false em POST
 *                (titulo + data_inicio obrigatórios; defaults aplicados).
 */
export function montarEvento(body: any, parcial: boolean): MontarResultado {
  const out: Record<string, any> = {}
  body = body || {}

  // titulo
  if (body.titulo !== undefined) {
    const t = String(body.titulo ?? '').trim()
    if (!t) return { ok: false, error: 'Título é obrigatório' }
    if (t.length > 160) return { ok: false, error: 'Título muito longo (máx. 160)' }
    out.titulo = t
  } else if (!parcial) {
    return { ok: false, error: 'Título é obrigatório' }
  }

  // data_inicio
  if (body.data_inicio !== undefined) {
    const d = new Date(body.data_inicio)
    if (isNaN(d.getTime())) return { ok: false, error: 'Data de início inválida' }
    out.data_inicio = d.toISOString()
  } else if (!parcial) {
    return { ok: false, error: 'Data de início é obrigatória' }
  }

  // tipo
  if (body.tipo !== undefined) {
    if (!EVENTO_TIPOS.includes(body.tipo)) return { ok: false, error: 'Tipo inválido' }
    out.tipo = body.tipo
  } else if (!parcial) {
    out.tipo = 'outro'
  }

  // status
  if (body.status !== undefined) {
    if (!EVENTO_STATUS.includes(body.status)) return { ok: false, error: 'Status inválido' }
    out.status = body.status
  } else if (!parcial) {
    out.status = 'rascunho'
  }

  // recorrencia
  if (body.recorrencia !== undefined) {
    if (!EVENTO_RECORRENCIAS.includes(body.recorrencia))
      return { ok: false, error: 'Recorrência inválida' }
    out.recorrencia = body.recorrencia
  } else if (!parcial) {
    out.recorrencia = 'nenhuma'
  }

  // datas opcionais (''/null => limpa)
  for (const campo of ['data_fim', 'recorrencia_fim'] as const) {
    if (body[campo] !== undefined) {
      if (body[campo] === null || body[campo] === '') {
        out[campo] = null
      } else {
        const d = new Date(body[campo])
        if (isNaN(d.getTime())) return { ok: false, error: `Data inválida em ${campo}` }
        out[campo] = d.toISOString()
      }
    }
  }

  // textos opcionais (''/null => null)
  for (const campo of ['local', 'descricao', 'link', 'banner'] as const) {
    if (body[campo] !== undefined) {
      const v = body[campo] === null ? null : String(body[campo]).trim()
      out[campo] = v === '' ? null : v
    }
  }

  // coerência: data_fim não pode ser antes de data_inicio (quando ambos resolvidos)
  if (out.data_inicio && out.data_fim && new Date(out.data_fim) < new Date(out.data_inicio)) {
    return { ok: false, error: 'Data de término não pode ser antes do início' }
  }

  if (parcial && Object.keys(out).length === 0) {
    return { ok: false, error: 'Nada para atualizar' }
  }

  return { ok: true, value: out }
}
