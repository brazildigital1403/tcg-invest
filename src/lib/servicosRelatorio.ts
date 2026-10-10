// Relatorio de bancada: o formato do dado que o documento impresso recebe.
//
// Mesmo formato para o dado vivo (F1, montado a cada GET) e, depois, para o
// snapshot congelado (F2). Nada aqui e segredo nem dado de contato: e-mail,
// WhatsApp, endereco, ids da Stripe, paths do bucket e a nota crua dos eventos
// NUNCA entram neste objeto. Pode ser importado no cliente.

import type { FichaCondicao, ServicoId } from '@/lib/servicos'

export interface RelatorioFoto {
  tipo: string
  /** Posicao do protocolo (frente, verso_sup_esq, superior...). '' quando a midia nao tem posicao (rasante). */
  posicao: string
  url: string | null
  em: string
}

export interface RelatorioProcedimento {
  ordem: number
  problema: string
  procedimento: string
  objetivo: string | null
  resultadoEsperado: string | null
  risco: 'baixo' | 'medio' | 'alto'
  riscoDescricao: string | null
  alternativa: string | null
  decisao: 'pendente' | 'aprovado' | 'recusado'
  decididoEm: string | null
}

export interface RelatorioLaudo {
  centralizacaoFrente: string | null
  centralizacaoVerso: string | null
  cantos: string | null
  bordas: string | null
  superficie: string | null
  /** Sempre intervalo, com virgula ("8,5 a 9"). null se o texto gravado nao for faixa valida. */
  faixa: { min: number; max: number; texto: string } | null
  graduadora: string | null
  proximoPasso: string | null
  caderno: string | null
}

export interface RelatorioCarta {
  nome: string
  custodia: string | null
  aceito: boolean
  recusaMotivo: string | null
  queixas: string[]
  obs: string | null
  valorDeclaradoCents: number
  fichaEntrada: FichaCondicao | null
  fichaEntradaEm: string | null
  fichaSaida: FichaCondicao | null
  fichaSaidaEm: string | null
  procedimentos: RelatorioProcedimento[]
  laudo: RelatorioLaudo | null
  /** Existe laudo anexado como arquivo (PDF/imagem), que o papel nao reproduz. */
  laudoAnexo: boolean
  fotos: RelatorioFoto[]
}

export interface RelatorioPagamento {
  etapa: 'sinal' | 'servico' | 'integral' | 'unico'
  valorCents: number
  metodo: 'Pix' | 'Cartão' | null
  pagoEm: string | null
  reembolsadoCents: number
  reembolsadoEm: string | null
}

export interface RelatorioTermo {
  titulo: string
  versao: string
  aceitoEm: string | null
  /** null = versao desconhecida: imprime so versao e data. */
  itens: string[] | null
}

export interface RelatorioMarco {
  status: string
  rotulo: string
  nota: string
  em: string
}

export interface RelatorioDados {
  emitidoEm: string
  pedido: {
    numero: string
    servico: ServicoId
    status: string
    prazo: 'padrao' | 'expresso'
    objetivo: string | null
    graduadoraAlvo: string | null
    cliente: string
    criadoEm: string
    valorDeclaradoCents: number
    orcamentoCents: number | null
    /** Taxa de valor declarado dos Correios na volta (coluna seguro_cents, nome antigo). */
    seguroCents: number | null
    /** true quando o valor gravado bate com a tarifa de balcao dos Correios (entra o % no rotulo). */
    seguroTarifa: boolean
    freteVoltaCents: number | null
    totalCents: number | null
    rastreioIda: string | null
    videoAberturaEm: string | null
    propostaEnviadaEm: string | null
    propostaAceitaEm: string | null
    /** Houve cobranca do servico conferida depois de procedimento recusado. */
    servicoConferido: boolean
  }
  termos: RelatorioTermo[]
  pagamentos: RelatorioPagamento[]
  linhaDoTempo: RelatorioMarco[]
  /** Primeira ocorrencia de cada status (lista branca), para as datas-chave. */
  marcos: Record<string, string>
  descanso: { de: string; ate: string; dias: number } | null
  cartas: RelatorioCarta[]
}

/**
 * Linha do tempo impressa: um marco por status, na primeira ocorrencia, com
 * nota de mapa fixo. `servico_eventos.nota` nunca vai ao papel (tem valor,
 * rastreio e texto livre do admin). Versao da caixa (F1): ate "Pronta";
 * "enviada" e "entregue" ficam para a versao da conta (F4).
 */
export const NOTA_MARCO: Record<string, string> = {
  aguardando_orcamento: 'Pedido enviado com as fotos.',
  orcado: 'Orçamento enviado.',
  aceito: 'Orçamento aceito.',
  recebida: 'Pacote aberto em vídeo. Custódia registrada.',
  proposta: 'Proposta de tratamento enviada.',
  cobranca_servico: 'Serviço cobrado.',
  em_bancada: '',
  descansando: 'Descanso após a prensa.',
  pronta: 'Fotos de saída e laudo registrados.',
  devolvida_sem_servico: 'Devolvida sem serviço.',
}

/** "Pronta" diz o que foi registrado, conforme o servico (pre-grading nao tem foto de saida). */
export const NOTA_PRONTA: Record<string, string> = {
  restauracao: 'Fotos de saída registradas.',
  pre_grading: 'Laudo registrado.',
  completo: 'Fotos de saída e laudo registrados.',
}

export const TITULO_TERMO: Record<string, string> = {
  'v1-2026-09': 'Termo de ciência de risco',
  'v2-2026-09': 'Termo de ciência de risco',
  'pg-v1-2026-09': 'Termo do pré-grading',
  'proposta-v1-2026-09': 'Termo da proposta de tratamento',
}

export const GUARDA_RECOMENDADA = [
  'Sleeve sem PVC e, por fora, toploader ou semirrígido.',
  'Na vertical ou deitada sob leve peso. Nunca apertada em fichário de argola.',
  'Umidade relativa entre 40% e 55%, longe de banheiro, parede externa e janela.',
  'Sem sol direto nem luz forte contínua, que desbotam a tinta e o holo.',
]
export const GUARDA_PRENSA = 'Carta que passou por prensa não deve ir para ambiente úmido nas primeiras semanas.'
export const GUARDA_GRADUADORA = 'Para enviar à graduadora, mantenha a carta no sleeve em que ela voltou.'
