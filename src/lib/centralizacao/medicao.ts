// Medicao gravada no laudo (laudo.centralizacao_medicao.{frente,verso}): leitura
// validada, usada na gravacao (rota do admin) e na leitura (relatorio). Nada do
// banco ou do corpo da requisicao passa sem ser reconstruido campo a campo.

export type MedicaoGravada = {
  cantos: number[][]
  img: number[]
  linhas: { ext: Record<'esq' | 'dir' | 'topo' | 'base', number>; int: Record<'esq' | 'dir' | 'topo' | 'base', number> }
  sem_moldura: boolean
  midia_id: string | null
  medido_em: string | null
}

/** Medicao de UMA face. null se incompleta ou fora de faixa. */
export function lerMedicaoFace(v: unknown): MedicaoGravada | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const num = (x: unknown, min: number, max: number) => (typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? Math.round(x * 1000) / 1000 : null)
  const img = Array.isArray(o.img) ? o.img.map(x => num(x, 1, 20000)) : []
  if (img.length !== 2 || img.some(x => x == null)) return null
  const [w, h] = img as number[]
  const cantos = Array.isArray(o.cantos) && o.cantos.length === 4
    ? o.cantos.map(p => (Array.isArray(p) && p.length === 2 ? [num(p[0], -w, 2 * w), num(p[1], -h, 2 * h)] : [null, null]))
    : []
  if (cantos.length !== 4 || cantos.some(p => p[0] == null || p[1] == null)) return null
  const lin = (o.linhas && typeof o.linhas === 'object' ? o.linhas : {}) as Record<string, Record<string, unknown> | undefined>
  const linhas = { ext: {}, int: {} } as MedicaoGravada['linhas']
  for (const g of ['ext', 'int'] as const) {
    for (const l of ['esq', 'dir', 'topo', 'base'] as const) {
      const x = num(lin[g]?.[l], -10, 100)
      if (x == null) return null
      linhas[g][l] = x
    }
  }
  const midia = typeof o.midia_id === 'string' && /^[0-9a-f-]{36}$/i.test(o.midia_id) ? o.midia_id : null
  const medidoEm = typeof o.medido_em === 'string' && !Number.isNaN(Date.parse(o.medido_em)) ? o.medido_em : null
  return { cantos: cantos as number[][], img: img as number[], linhas, sem_moldura: o.sem_moldura === true, midia_id: midia, medido_em: medidoEm }
}
