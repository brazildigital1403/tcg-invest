// Enderecos do Poké Creators Club (05/11/2026). O Club mora em /pokecreatorsclub
// e cada frente e uma subpasta. O /admin e as rotas /api continuam onde estavam.

export const CLUB = '/pokecreatorsclub'
export const AMIGO_SECRETO = `${CLUB}/amigo-secreto`
export const AMIGO_SECRETO_SALA = `${AMIGO_SECRETO}/sala`
export const ANIVERSARIANTES = `${CLUB}/aniversariantes`
export const AGENDA = `${CLUB}/agenda`
export const AGENDA_ORGANIZAR = `${AGENDA}/organizar`
export const agendaEvento = (slug: string) => `${AGENDA}/${slug}`
export const ANIVERSARIANTES_ORGANIZAR = `${ANIVERSARIANTES}/organizar`
