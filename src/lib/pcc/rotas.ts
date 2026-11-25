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
export const ALBUM = `${CLUB}/album`
export const ALBUM_ORGANIZAR = `${ALBUM}/organizar`
export const ALBUM_REGRAS = `${ALBUM}/regras`
export const PORTFOLIO = `${CLUB}/portfolio`
export const MEU_LINK = `${CLUB}/meu-link`
/** Página pública do criador: o @ vai na consulta para a página continuar estática (sem rota dinâmica). */
export const criadorUrl = (arroba: string) => `${CLUB}/criador?u=${encodeURIComponent(arroba)}`
export const AVISOS = `${CLUB}/avisos`
export const AVISOS_ORGANIZAR = `${AVISOS}/organizar`
export const avisoUrl = (slug: string) => `${AVISOS}/${slug}`
