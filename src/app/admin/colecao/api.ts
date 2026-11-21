// Chamada da tela Album do Club para /api/admin/colecao (21/11/2026).

export type RespostaAdmin<T> = { ok: boolean; status: number; d: T & { error?: string; detalhe?: string } }

export async function chamar<T = Record<string, unknown>>(corpo: object): Promise<RespostaAdmin<T>> {
  const res = await fetch('/api/admin/colecao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  const d = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, d }
}

/** Envia a arte de uma carta (multipart). O servidor confere o tipo pelo conteudo da imagem. */
export async function enviarArte<T = Record<string, unknown>>(colecaoId: string, numero: number, arquivo: File): Promise<RespostaAdmin<T>> {
  const fd = new FormData()
  fd.append('id', colecaoId)
  fd.append('numero', String(numero))
  fd.append('arte', arquivo)
  const res = await fetch('/api/admin/colecao', { method: 'POST', body: fd })
  const d = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, d }
}
