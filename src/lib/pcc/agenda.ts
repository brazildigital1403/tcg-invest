// Agenda do Poke Creators Club (08/11/2026, wireframe aprovado). Datas e horas
// sao de relogio de Brasilia, como vem do banco (date + "HH:MI"). O navegador
// nunca le a tabela: tudo vem das funcoes club_agenda_*.

import { MESES, MESES_CURTOS, type Dia } from './datas'

export type TipoEvento = 'live' | 'collab' | 'abertura' | 'torneio' | 'presencial' | 'lancamento' | 'club'
export type StatusEvento = 'rascunho' | 'publicado' | 'adiado' | 'cancelado'

export type Evento = {
  id: string; slug: string; tipo: TipoEvento; titulo: string; descricao: string | null
  formato: 'online' | 'presencial'; local_nome: string | null; cidade: string | null; uf: string | null
  link_url: string | null; participantes: string[]; imagem_path: string | null
  inicio_data: string; fim_data: string; hora_inicio: string | null; hora_fim: string | null
  status: StatusEvento; nota_status: string | null; remarcado_em: string | null
}

export type ListaAgenda = { eventos: Evento[]; papeis: string[] }

export const TIPOS: Record<TipoEvento, { rotulo: string; ico: string }> = {
  live: { rotulo: 'Live', ico: 'video' },
  collab: { rotulo: 'Collab', ico: 'users' },
  abertura: { rotulo: 'Abertura', ico: 'box' },
  torneio: { rotulo: 'Torneio', ico: 'trophy' },
  presencial: { rotulo: 'Presencial', ico: 'pin' },
  lancamento: { rotulo: 'Lançamento', ico: 'spark' },
  club: { rotulo: 'Do Club', ico: 'star' },
}
export const ORDEM_TIPOS = Object.keys(TIPOS) as TipoEvento[]

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export const parseDia = (iso: string): Dia => {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return { ano, mes, dia }
}
export const isoDia = (d: Dia) => `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(d.dia).padStart(2, '0')}`
const utc = (d: Dia) => Date.UTC(d.ano, d.mes - 1, d.dia)
const semana = (d: Dia) => new Date(utc(d)).getUTCDay()

/** Dias entre hoje e a data (negativo = ja passou). */
export const diasAte = (iso: string, hoje: Dia) => Math.round((utc(parseDia(iso)) - utc(hoje)) / 86_400_000)

/** "20:00" -> "20h", "19:30" -> "19h30". */
export const horaCurta = (h: string) => {
  const [hh, mm] = h.split(':')
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`
}

/** Hora atual de Brasilia em "HH:MI", para saber se o evento esta acontecendo. */
export function agoraBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(agora)
}

export type Momento = 'futuro' | 'hoje' | 'agora' | 'passado'

/** Fim menor que o inicio: cada bloco termina no dia seguinte (live das 22h a 1h). */
export const viraDia = (e: Pick<Evento, 'hora_inicio' | 'hora_fim'>) => !!e.hora_inicio && !!e.hora_fim && e.hora_fim < e.hora_inicio

export function momento(e: Evento, hoje: Dia, hora = agoraBrasilia()): Momento {
  // Adiado espera nova data: nunca vira passado (nem "Ver a gravacao"), mesmo
  // depois da data original. Revisao de 08/11.
  if (e.status === 'adiado') return 'futuro'
  const ini = diasAte(e.inicio_data, hoje)
  const fim = diasAte(e.fim_data, hoje)
  if (viraDia(e)) {
    // Bloco de cada dia vai de hora_inicio ate hora_fim do dia seguinte.
    const noBlocoDeOntem = ini <= -1 && fim >= -1 && hora < (e.hora_fim as string)
    if (noBlocoDeOntem) return 'agora'
    if (fim < 0) return 'passado'
    if (ini > 0) return 'futuro'
    return hora >= (e.hora_inicio as string) ? 'agora' : 'hoje'
  }
  if (fim < 0) return 'passado'
  if (ini > 0) return 'futuro'
  // Hoje esta dentro do periodo. Sem horario: o dia inteiro conta.
  if (!e.hora_inicio) return ini < 0 ? 'agora' : 'hoje'
  // Com horario, ele vale para cada dia do periodo (feira das 10h as 18h nos
  // dois dias): fora da faixa a feira esta fechada.
  if (e.hora_fim && hora >= e.hora_fim) return fim === 0 ? 'passado' : 'futuro'
  return hora >= e.hora_inicio ? 'agora' : 'hoje'
}

/** Linha curta das listas: "qui, 20h · Online" ou "28 a 29 nov · São Paulo, SP". */
export function linhaMeta(e: Evento): string {
  const ini = parseDia(e.inicio_data)
  const onde = e.formato === 'online' ? 'Online' : [e.cidade, e.uf].filter(Boolean).join(', ')
  if (e.status === 'adiado') return 'Nova data em breve'
  if (e.fim_data !== e.inicio_data) {
    const fim = parseDia(e.fim_data)
    const faixa = ini.mes === fim.mes ? `${ini.dia} a ${fim.dia} ${MESES_CURTOS[fim.mes - 1]}` : `${ini.dia} ${MESES_CURTOS[ini.mes - 1]} a ${fim.dia} ${MESES_CURTOS[fim.mes - 1]}`
    return `${faixa} · ${onde}`
  }
  const quando = e.hora_inicio ? `${DIAS_CURTOS[semana(ini)]}, ${horaCurta(e.hora_inicio)}` : `${DIAS_CURTOS[semana(ini)]}, dia inteiro`
  return `${quando} · ${onde}`
}

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Data por extenso do detalhe, sempre com o horario de Brasilia. */
export function dataPorExtenso(e: Evento): string {
  const ini = parseDia(e.inicio_data)
  const fim = parseDia(e.fim_data)
  const horas = e.hora_inicio
    ? (e.hora_fim ? `, das ${horaCurta(e.hora_inicio)} às ${horaCurta(e.hora_fim)}${viraDia(e) ? ' do dia seguinte' : ''}` : `, às ${horaCurta(e.hora_inicio)}`)
    : ''
  if (e.fim_data === e.inicio_data) {
    return `${maiuscula(DIAS_SEMANA[semana(ini)])}, ${ini.dia} de ${MESES[ini.mes - 1].toLowerCase()}${horas}`
  }
  const dias = diasAte(e.fim_data, ini)
  const mesmoMes = ini.mes === fim.mes && ini.ano === fim.ano
  const comeco = mesmoMes ? `${ini.dia}` : `${ini.dia} de ${MESES[ini.mes - 1].toLowerCase()}`
  const conector = dias === 1 ? ' e ' : ' a '
  return `${comeco}${conector}${fim.dia} de ${MESES[fim.mes - 1].toLowerCase()}${horas}`
}

export const ondeTexto = (e: Evento) =>
  e.formato === 'online'
    ? (e.link_url ? `Online, pelo ${dominio(e.link_url)}` : 'Online')
    : [e.local_nome, [e.cidade, e.uf].filter(Boolean).join(', ')].filter(Boolean).join(' · ')

export function dominio(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** O evento teve a data trocada nos ultimos 7 dias. */
export const remarcadoRecente = (e: Evento, agora = Date.now()) =>
  !!e.remarcado_em && agora - Date.parse(e.remarcado_em) < 7 * 86_400_000

export const mapaUrl = (e: Evento) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.local_nome, e.cidade, e.uf].filter(Boolean).join(', '))}`

/** Rotulo do botao principal do link, pelo tipo. */
export function rotuloLink(e: Evento, passou: boolean): string {
  // Gravacao so faz sentido para o que foi transmitido (revisao de 08/11).
  if (passou && e.formato === 'online' && ['live', 'collab', 'abertura'].includes(e.tipo)) return 'Ver a gravação'
  if (e.formato === 'presencial') return 'Abrir o site do evento'
  if (e.tipo === 'live') return 'Abrir a live'
  if (e.tipo === 'torneio') return 'Abrir a inscrição'
  return 'Abrir o link'
}

/** Dias de calendario do evento (1 para evento de um dia). */
export const diasDoEvento = (e: Pick<Evento, 'inicio_data' | 'fim_data'>) => diasAte(e.fim_data, parseDia(e.inicio_data)) + 1

// Google Agenda: datas sem fuso + ctz, que o Google interpreta em Brasilia.
// Evento de varios dias com horario vira um bloco por dia (RRULE diaria), igual
// ao arquivo .ics: o horario vale para cada dia, nao um bloco unico.
export function googleAgendaUrl(e: Evento, urlEvento: string): string {
  const d = (iso: string) => iso.replace(/-/g, '')
  const t = (h: string) => `T${h.replace(':', '')}00`
  let datas: string
  const n = diasDoEvento(e)
  if (e.hora_inicio) {
    const fimHora = e.hora_fim || somaHora(e.hora_inicio, 1)
    datas = `${d(e.inicio_data)}${t(e.hora_inicio)}/${d(viraDia(e) ? diaSeguinte(e.inicio_data) : e.inicio_data)}${t(fimHora)}`
  } else {
    datas = `${d(e.inicio_data)}/${d(diaSeguinte(e.fim_data))}`
  }
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: e.titulo, dates: datas, ctz: 'America/Sao_Paulo',
    details: [e.descricao, e.link_url, `Agenda do Club: ${urlEvento}`].filter(Boolean).join('\n\n'),
  })
  if (e.hora_inicio && n > 1) q.set('recur', `RRULE:FREQ=DAILY;COUNT=${n}`)
  if (e.formato === 'presencial') q.set('location', [e.local_nome, e.cidade, e.uf].filter(Boolean).join(', '))
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

export function somaHora(h: string, horas: number): string {
  const [hh, mm] = h.split(':').map(Number)
  if (hh + horas > 23) return '23:59'
  return `${String(hh + horas).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function diaSeguinte(iso: string): string {
  const x = new Date(utc(parseDia(iso)) + 86_400_000)
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`
}

/** Texto pronto para o WhatsApp, sem emoji; o asterisco e o negrito do WhatsApp. */
export function textoWhatsApp(e: Evento, urlEvento: string): string {
  if (e.status === 'cancelado') {
    const ini = parseDia(e.inicio_data)
    return `*Cancelado:* ${e.titulo}, que seria em ${String(ini.dia).padStart(2, '0')}/${String(ini.mes).padStart(2, '0')}.${e.nota_status ? ` ${e.nota_status}` : ''}\n\n${urlEvento}`
  }
  const linhas = [`*${e.titulo}*`]
  if (e.status === 'adiado') linhas.push('Adiado. Nova data em breve.')
  else linhas.push(`${dataPorExtenso(e)} (Brasília)`)
  linhas.push(e.formato === 'online' ? 'Online' : [e.local_nome, e.cidade].filter(Boolean).join(', '))
  if (e.descricao) linhas.push('', e.descricao)
  linhas.push('', 'Detalhes na agenda do Club:', urlEvento)
  return linhas.join('\n')
}

export function erroAgenda(msg: string | undefined | null): string {
  const m = msg || ''
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('sem_papel')) return 'Só a organização do Club pode editar a agenda.'
  if (m.includes('evento_nao_encontrado')) return 'Não encontramos este evento.'
  if (m.includes('tipo_invalido')) return 'Escolha o tipo.'
  if (m.includes('titulo_invalido')) return 'Dê um título ao evento, de 3 a 60 caracteres.'
  if (m.includes('descricao_longa')) return 'A descrição passou de 600 caracteres.'
  if (m.includes('data_obrigatoria')) return 'Coloque a data.'
  if (m.includes('data_passada')) return 'A data já passou. Confira o dia.'
  if (m.includes('fim_antes_do_inicio')) return 'O dia de fim vem antes do dia de começo.'
  if (m.includes('evento_longo')) return 'O evento pode durar no máximo 31 dias.'
  if (m.includes('hora_invalida')) return 'Confira os horários. Precisa do início, e o fim não pode ser igual a ele.'
  if (m.includes('data_invalida')) return 'Confira a data e o horário.'
  if (m.includes('link_invalido')) return 'O link precisa começar com https://'
  if (m.includes('cidade_obrigatoria')) return 'Evento presencial precisa de cidade.'
  if (m.includes('local_invalido')) return 'Confira o local e a cidade.'
  if (m.includes('imagem_invalida')) return 'Não conseguimos usar esta imagem. Suba outra.'
  if (m.includes('uf_invalida')) return 'A UF tem duas letras, como SP.'
  if (m.includes('participante_invalido')) return 'Confira os @ de quem participa. Use letras, números, ponto ou sublinhado.'
  if (m.includes('participantes_demais')) return 'Coloque no máximo 20 @.'
  if (m.includes('motivo_obrigatorio')) return 'Conte o motivo do cancelamento.'
  if (m.includes('evento_cancelado')) return 'Evento cancelado não pode ser editado.'
  if (m.includes('so_rascunho')) return 'Só rascunho pode ser excluído. Para evento publicado, use Cancelar.'
  if (m.includes('ja_publicado')) return 'Este evento já foi publicado.'
  if (m.includes('estado_invalido')) return 'Esta ação não vale para o estado atual do evento.'
  return 'Não conseguimos salvar. Tente de novo.'
}
