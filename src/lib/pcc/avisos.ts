// Avisos do Poke Creators Club (08/11/2026, wireframe aprovado). O navegador
// nunca le a tabela: tudo vem das funcoes club_aviso*. Prazo e timestamptz;
// a tela mostra sempre em horario de Brasilia.

export type LinkAviso = { rotulo: string | null; url: string }
export type EnqueteAviso = {
  pergunta: string; regra: string | null; multipla: boolean; opcoes: string[]
  aberta: boolean; meu_voto: number[] | null; total: number; contagem?: number[] | null
}
export type Aviso = {
  id: string; slug: string; titulo: string; resumo: string; imagens: string[]; links: LinkAviso[]
  prazo_em: string | null; fixado: boolean; status: 'rascunho' | 'publicado' | 'arquivado'
  publicado_em: string | null; editado_em: string | null; autor: string | null
  tem_atualizacoes: boolean; enquete: EnqueteAviso | null
  // So no aviso completo:
  corpo?: string; importante?: string | null; atualizacoes?: { em: string; texto: string }[]
  evento?: { slug: string; titulo: string; inicio_data: string; hora_inicio: string | null; status: string } | null
}
export type AvisoOrg = Aviso & { editado_por: string | null; updated_at: string; evento_id: string | null }
export type ListaAvisos = { avisos: Aviso[]; papeis: string[] }

const TZ = 'America/Sao_Paulo'
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, ...o })

/** "8 nov" */
export const dataCurta = (iso: string) => fmt({ day: 'numeric', month: 'short' }).format(new Date(iso)).replace('.', '')
/** "10/11" */
export const diaMes = (iso: string) => fmt({ day: '2-digit', month: '2-digit' }).format(new Date(iso))
/** "Terça, 10 de novembro, às 23h59" */
export function prazoPorExtenso(iso: string): string {
  const d = new Date(iso)
  const dia = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d)
  const [hh, mm] = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':')
  const hora = mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, às ${hora}`
}
/** Dias inteiros ate o prazo, pelo calendario de Brasilia (0 = hoje). */
export function diasAtePrazo(iso: string, agora = new Date()): number {
  const dia = (d: Date) => { const [a, m, x] = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).filter(p => p.type !== 'literal').map(p => Number(p.value)); return Date.UTC(x, m - 1, a) }
  return Math.round((dia(new Date(iso)) - dia(agora)) / 86_400_000)
}
export const prazoPassou = (a: Pick<Aviso, 'prazo_em'>, agora = Date.now()) => !!a.prazo_em && Date.parse(a.prazo_em) <= agora

/** Chip curto do prazo: "Até 10/11", "Termina hoje", "Faltam 2 dias" ou "Encerrado". */
export function chipPrazo(a: Pick<Aviso, 'prazo_em'>): { texto: string; forte: boolean } | null {
  if (!a.prazo_em) return null
  if (prazoPassou(a)) return { texto: 'Encerrado', forte: false }
  const d = diasAtePrazo(a.prazo_em)
  if (d <= 0) return { texto: 'Termina hoje', forte: true }
  if (d <= 3) return { texto: d === 1 ? 'Termina amanhã' : `Faltam ${d} dias`, forte: true }
  return { texto: `Até ${diaMes(a.prazo_em)}`, forte: false }
}

/** Enquete aberta que a pessoa ainda nao respondeu. */
export const pedeResposta = (a: Pick<Aviso, 'enquete'>) => !!a.enquete && a.enquete.aberta && !a.enquete.meu_voto

export function dominio(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
// Link de pagamento de terceiro: a tela avisa que e fora da Bynx (decisao do Du, 08/11).
const PAGAMENTO = /(^|\.)(pag\.ae|pagseguro\.uol\.com\.br|pagseguro\.com\.br|mercadopago\.com(\.br)?|mpago\.la|mpago\.li|picpay\.me|picpay\.com|nubank\.com\.br|pix\.|asaas\.com|sumup\.com|infinitepay\.io|stone\.com\.br|paypal\.com|paypal\.me)$/i
export const ehPagamento = (url: string) => PAGAMENTO.test(dominio(url))

// "Novo": guardado so no navegador (decisao de 08/11). Quem nunca abriu a lista
// nao ve tudo como novo: na primeira visita a marca nasce agora.
const CHAVE_VISTO = 'pcc-avisos-visto'
export function ultimaVisita(): number | null {
  try { const v = localStorage.getItem(CHAVE_VISTO); return v ? Number(v) : null } catch { return null }
}
export function marcarVisita(t = Date.now()) {
  try { localStorage.setItem(CHAVE_VISTO, String(t)) } catch { /* sem armazenamento: so nao marca */ }
}
export const ehNovo = (a: Pick<Aviso, 'publicado_em'>, visto: number | null) => visto !== null && !!a.publicado_em && Date.parse(a.publicado_em) > visto

// Mesma limpeza do banco, para a previa ja mostrar sem emoji.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}\u{2B50}\u{2B55}\u{3030}\u{303D}]/gu
export const semEmoji = (t: string) => t.replace(EMOJI, '').replace(/ {2,}/g, ' ').replace(/\n +/g, '\n').replace(/ +\n/g, '\n').trim()

export function erroAviso(msg: string | undefined | null): string {
  const m = msg || ''
  if (m.includes('nao_logado')) return 'Entre na sua conta para continuar.'
  if (m.includes('sem_papel')) return 'Só a organização do Club pode publicar avisos.'
  if (m.includes('aviso_nao_encontrado')) return 'Não encontramos este aviso.'
  if (m.includes('aviso_arquivado')) return 'Este aviso está arquivado. Restaure antes de editar.'
  if (m.includes('titulo_invalido')) return 'Dê um título ao aviso, de 3 a 80 caracteres.'
  if (m.includes('corpo_obrigatorio')) return 'Escreva o texto do aviso.'
  if (m.includes('corpo_longo')) return 'O texto passou de 3000 caracteres.'
  if (m.includes('importante_longo')) return 'O destaque passou de 300 caracteres.'
  if (m.includes('imagens_demais')) return 'Coloque no máximo 3 imagens.'
  if (m.includes('imagem_invalida')) return 'Não conseguimos usar esta imagem. Suba outra.'
  if (m.includes('links_demais')) return 'Coloque no máximo 3 links.'
  if (m.includes('link_invalido')) return 'O link precisa começar com https://'
  if (m.includes('rotulo_longo')) return 'O texto do botão passou de 40 caracteres.'
  if (m.includes('prazo_passado')) return 'O prazo já passou. Confira o dia e a hora.'
  if (m.includes('prazo_invalido')) return 'Confira o prazo.'
  if (m.includes('evento_nao_encontrado')) return 'Não encontramos o evento da Agenda.'
  if (m.includes('enquete_opcoes')) return 'A enquete precisa de 2 a 8 opções.'
  if (m.includes('opcao_longa')) return 'Cada opção pode ter até 60 caracteres.'
  if (m.includes('enquete_longa')) return 'A pergunta ou a regra da enquete ficou longa demais.'
  if (m.includes('enquete_com_votos')) return 'A enquete já tem votos: as opções não podem mudar.'
  if (m.includes('fixados_demais')) return 'Já existem 3 avisos fixados. Desafixe um antes.'
  if (m.includes('ja_publicado')) return 'Este aviso já foi publicado.'
  if (m.includes('so_rascunho')) return 'Só rascunho pode ser excluído. Para aviso publicado, use Arquivar.'
  if (m.includes('estado_invalido')) return 'Esta ação não vale para o estado atual do aviso.'
  if (m.includes('atualizacao_vazia')) return 'Escreva a atualização.'
  if (m.includes('atualizacao_longa')) return 'A atualização passou de 500 caracteres.'
  if (m.includes('atualizacoes_demais')) return 'O aviso já tem 20 atualizações. Publique um aviso novo.'
  if (m.includes('enquete_encerrada')) return 'A enquete já encerrou.'
  if (m.includes('so_uma_opcao')) return 'Escolha só uma opção.'
  if (m.includes('voto_vazio')) return 'Escolha uma opção.'
  return 'Não conseguimos salvar. Tente de novo.'
}
