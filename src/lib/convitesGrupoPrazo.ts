// Convite de grupo sem prazo e com link curto (19/11/2026). Pedido do Du: um link unico para
// os criadores, sem ficar criando convite novo a cada prazo.
//
// A coluna convites_grupo.expira_em e obrigatoria e a funcao resgatar_convite_grupo confere o
// prazo, entao "sem prazo" e uma data muito distante, nao um NULL (sem migration). A landing
// e o admin tratam essa data como "sem prazo": nao mostram "ate DD/MM".
//
// Sem importar nada de servidor: a landing e o admin (cliente) usam este arquivo.

/** A partir desta data o convite conta como sem prazo. */
const SEM_PRAZO_A_PARTIR_DE = Date.parse('2090-01-01T00:00:00Z')

export const semPrazo = (expiraEm: string | null | undefined): boolean =>
  !!expiraEm && Date.parse(expiraEm) >= SEM_PRAZO_A_PARTIR_DE

/** Convite que abre em /criadores, sem o parametro ?c=. */
export const CONVITE_PADRAO = 'criadores'

/** Links antigos que seguem abrindo o convite de hoje: codigo antigo -> codigo atual. */
export const CODIGOS_ANTIGOS: Record<string, string> = { 'criadores-out26': CONVITE_PADRAO }
