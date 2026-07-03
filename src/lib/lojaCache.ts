// Cache leve de lojas (client) — evita blank/pop ao trocar de mundo (App|Loja|Admin).
// Preenchido em background por cada casca; lido no init pra render instantaneo.
// NAO e fonte de verdade: sempre revalidado no mount de cada consumidor.

type AnyLoja = Record<string, unknown> & { id?: string }

let _lojasList: AnyLoja[] | null = null        // lista PARCIAL (sidebar): id,slug,nome,logo_url,status
const _lojaFull = new Map<string, AnyLoja>()   // loja COMPLETA (select *) para as paginas do dashboard
let _hasLoja: boolean | null = null            // flag rapida (switcher App/Admin)

export const lojaCache = {
  getList: (): AnyLoja[] | null => _lojasList,
  setList: (l: AnyLoja[]) => { _lojasList = l; _hasLoja = (l?.length ?? 0) > 0 },

  getFull: (id: string): AnyLoja | null => _lojaFull.get(id) ?? null,
  setFull: (id: string, l: AnyLoja) => { if (id && l) { _lojaFull.set(id, l); _hasLoja = true } },

  getHasLoja: (): boolean | null => _hasLoja,
  setHasLoja: (v: boolean) => { _hasLoja = v },

  clear: () => { _lojasList = null; _lojaFull.clear(); _hasLoja = null },
}
