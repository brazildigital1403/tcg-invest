'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { IconChart, IconClose, IconShield, IconWarning, IconCheck } from '@/components/ui/Icons'
import {
  formatarBRL,
  formatarTempoAnel,
  formatarTempoRestante,
  horarioBrasilia,
  incrementoCents,
  minimoProximoCents,
  statusPublico,
  type EstadoLote,
  type LanceResultado,
  type LotePublico,
  type StatusPublico,
} from '@/lib/leilao'
import { calcularArremate } from '@/lib/leilao-taxas'
import { urlPagar } from '@/lib/leilao-urls'
import { atalhosLance, textoProrrogacao } from '@/lib/leilao-rodada'

/**
 * Ilha ao vivo da pagina do lote: preco, relogio, faixa de lideranca, CTA e a
 * folha "Dar lance".
 *
 * Fatia 1 SEM Realtime: polling de /api/leiloes/[id]/estado a cada 10s, e 2s
 * nos ultimos 2 minutos (soft close de 10s ao vivo). Aba escondida para de
 * buscar e busca de novo ao voltar.
 *
 * RELOGIO: tudo conta em `agora do servidor` = Date.now() + deslocamento. O
 * deslocamento vem do `server_now` de cada resposta; celular com hora errada
 * nao abre nem fecha lote errado na tela.
 *
 * QUEM LIDERA: vem do SERVIDOR. A rota de estado devolve `voceLidera` e
 * `seuMaximoCents` para o usuario do Bearer (o apelido da view vem mascarado e
 * o teto dos outros nunca sai do banco). Entre uma leitura e outra, o retorno
 * do dar_lance (`lider`, `seu_maximo_cents`) atualiza na hora. Nada fica no
 * aparelho: outra aba, outro celular ou sessao nova mostram o mesmo.
 *
 * "Lance rapido" x "Lance maximo": TODO lance e automatico. As duas abas mandam
 * `maximoCents` ao RPC, que so sobe o preco ate onde precisar para vencer. No
 * rapido o teto e o chip escolhido; no maximo, o valor digitado. A diferenca e
 * so de entrada (chip x campo), nunca de regra.
 *
 * ENCERRAMENTO: relogio local zerado com o lote ainda `ativo` no servidor NAO
 * esconde nada por conta propria. A tela mostra "Conferindo encerramento...",
 * busca o estado na hora e segue a cada 2s ate o servidor fechar (ou estender,
 * se um lance de ultimo segundo prorrogou).
 *
 * NA PAGINA DA RODADA (`pollingExterno`): quem busca e a rodada (uma leitura
 * publica para todos os lotes). A ilha nao roda o proprio polling; recebe o
 * lote atualizado em `loteExterno` e so consulta a propria rota quando
 * precisa da posicao de quem esta logado (montagem COM sessao, troca de
 * sessao, depois do lance, e quando o lote mudou e a pessoa ja deu lance
 * nele). Sem o "conferindo" proprio: o fechamento preguicoso roda na rota da
 * rodada, que ja busca a 2s nessa hora. `aoParticipar` avisa a rodada quando
 * a pessoa tem lance no lote (para ela conferir o arremate quando fechar).
 *
 * VISUAL (casca do Bynx Leiloes, mockup aprovado em 27/09/2026): lance atual
 * grande em DM Sans 800 com numeros tabulares, relogio em ANEL (traco no
 * acento; vermelho nos ultimos 10s) e o CTA fixo no fim da tela no celular.
 * `variante="rodada"` (tela heroi da live) usa o preco maior e ganha os
 * atalhos "+1 degrau" e "+2 degraus" (atalhosLance): no desktop os dois acima
 * do CTA, no celular o "+2 degraus" ao lado do CTA fixo. Eles so ABREM a folha
 * ja preenchida: nenhum lance sai sem o Confirmar. A linha da prorrogacao
 * (soft close) fica sempre visivel enquanto o lote esta aberto.
 */

const INTERVALO_NORMAL_MS = 10_000
const INTERVALO_FINAL_MS = 2_000
const JANELA_FINAL_MS = 120_000
/** Aviso de lance muito acima da referencia do Mercado Brasileiro. */
const FATOR_AVISO_MERCADO = 1.5
/** Acima de N vezes o lance minimo atual, o Confirmar pede um segundo toque. */
const FATOR_CONFIRMACAO_DUPLA = 3
/** Ultimos N ms: o anel do relogio fica vermelho. */
const ANEL_URGENTE_MS = 10_000
const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

type Aba = 'rapido' | 'maximo'

/** Minha posicao no lote, sempre como o servidor disse. */
interface MinhaPosicao {
  voceLidera: boolean
  /** Meu teto em leilao_proxy; null = nunca dei lance neste lote. */
  seuMaximoCents: number | null
}

async function tokenAtual(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

/** "1.234,56" / "1234,5" / "1234" -> centavos. null se invalido. */
function reaisParaCents(txt: string): number | null {
  const limpo = txt.replace(/[^\d,.]/g, '')
  if (!limpo) return null
  const temVirgula = limpo.includes(',')
  const normal = temVirgula ? limpo.replace(/\./g, '').replace(',', '.') : limpo.replace(/\.(?=\d{3}(\D|$))/g, '')
  const v = Number(normal)
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
}

function centsParaCampo(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function novoIdem(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Fallback para navegador antigo sem randomUUID (formato v4).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const ROTULO_STATUS: Record<StatusPublico, string> = {
  em_breve: 'Em breve',
  ao_vivo: 'Ao vivo',
  encerrando: 'Encerrando',
  encerrado: 'Encerrado',
  arrematado: 'Arrematado',
  sem_lances: 'Encerrado sem lances',
  cancelado: 'Cancelado',
}

export default function LanceAoVivo({
  loteInicial,
  serverNow,
  referenciaMercadoCents,
  urlLote,
  urlLogin,
  loteExterno,
  pollingExterno = false,
  aoParticipar,
  variante = 'lote',
  aposMercado,
}: {
  loteInicial: LotePublico
  serverNow: string
  referenciaMercadoCents: number | null
  urlLote: string
  /** Pagina para onde o login volta. Padrao: a do lote. */
  urlLogin?: string
  /** Lote atualizado por quem faz o polling de fora (pagina da rodada). */
  loteExterno?: LotePublico | null
  /** true = nao roda o polling proprio; o estado chega por `loteExterno`. */
  pollingExterno?: boolean
  /** Chamado quando o servidor confirma que quem esta logado tem lance neste lote. */
  aoParticipar?: (loteId: string) => void
  /** 'rodada' = tela heroi da live (preco maior e botao "+ incremento"). */
  variante?: 'lote' | 'rodada'
  /** Bloco logo abaixo do Mercado Brasileiro (a rodada poe ali a faixa de resultado). */
  aposMercado?: ReactNode
}) {
  const [lote, setLote] = useState<LotePublico>(loteInicial)

  // Lote vindo de fora: aplica durante o render (padrao do React para derivar
  // estado de prop), so se for o mesmo lote e mais novo.
  const [externoVisto, setExternoVisto] = useState<LotePublico | null | undefined>(loteExterno)
  if (loteExterno !== externoVisto) {
    setExternoVisto(loteExterno)
    if (loteExterno && loteExterno.id === lote.id && loteExterno.versao > lote.versao) setLote(loteExterno)
  }
  const baseInicial = Date.parse(serverNow)
  const offsetRef = useRef<number>(0)
  const [agora, setAgora] = useState<number>(Number.isFinite(baseInicial) ? baseInicial : 0)

  const [logado, setLogado] = useState<boolean | null>(null)
  const [online, setOnline] = useState(true)
  const [posicao, setPosicao] = useState<MinhaPosicao | null>(null)
  /** O servidor diz se quem esta logado e o vendedor (o id do vendedor nunca vem). */
  const [proprio, setProprio] = useState(false)
  /** Prazo para pagar o arremate. So vem do servidor para quem venceu. */
  const [pagarAte, setPagarAte] = useState<string | null>(null)
  /** Hora local do ultimo lance confirmado: leitura que saiu antes dele e chegou depois nao desfaz. */
  const ultimoLanceEmRef = useRef(0)
  /** Maior versao do lote ja vista (leitura ou retorno do lance). */
  const versaoRef = useRef(loteInicial.versao)

  const [aberta, setAberta] = useState(false)
  const [aba, setAba] = useState<Aba>('rapido')
  const [valorTxt, setValorTxt] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** Segundo toque pendente no Confirmar (valor muito acima do minimo). */
  const [confirmarAlto, setConfirmarAlto] = useState(false)
  /** Area visivel (teclado do iOS aberto encolhe o visualViewport, nao o layout). */
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null)
  const idemRef = useRef<{ chave: string; valor: number } | null>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const ctaRef = useRef<HTMLButtonElement>(null)
  const folhaRef = useRef<HTMLDivElement>(null)

  // ── Relogio ──────────────────────────────────────────────────────────────
  useEffect(() => {
    offsetRef.current = Number.isFinite(baseInicial) ? baseInicial - Date.now() : 0
    const tick = () => setAgora(Date.now() + offsetRef.current)
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [baseInicial])

  // ── Sessao, conexao, lance guardado ─────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogado(!!data.session?.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLogado(!!session?.user)
    })
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [loteInicial.id])

  // ── Estado do servidor ──────────────────────────────────────────────────
  const aplicarServerNow = useCallback((iso: string | null | undefined, enviadoEm: number) => {
    const s = iso ? Date.parse(iso) : NaN
    if (!Number.isFinite(s)) return
    // Metade da ida e volta: o server_now foi gerado no meio da requisicao.
    const meio = enviadoEm + (Date.now() - enviadoEm) / 2
    offsetRef.current = s - meio
  }, [])

  const buscarEstado = useCallback(async () => {
    const enviadoEm = Date.now()
    try {
      const token = await tokenAtual()
      const r = await fetch(`/api/leiloes/${loteInicial.id}/estado`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!r.ok) return
      const j = (await r.json()) as Partial<EstadoLote>
      aplicarServerNow(j.server_now, enviadoEm)
      if (j.lote) {
        setProprio(j.proprio === true)
        setPagarAte(typeof j.pagarAte === 'string' ? j.pagarAte : null)
        const novo = j.lote
        // Resposta atrasada nao pode desfazer um lance ja visto. (Ref, nao o
        // updater do setState: o updater pode rodar so no proximo render.)
        if (novo.versao < versaoRef.current) return
        versaoRef.current = novo.versao
        setLote(atual => (novo.versao >= atual.versao ? novo : atual))
        if (enviadoEm >= ultimoLanceEmRef.current) {
          setPosicao({
            voceLidera: j.voceLidera === true,
            seuMaximoCents: typeof j.seuMaximoCents === 'number' ? j.seuMaximoCents : null,
          })
        }
      }
    } catch {
      // Rede instavel: a proxima volta tenta de novo.
    }
  }, [loteInicial.id, aplicarServerNow])

  const st = statusPublico(lote, agora)
  const aberto = st === 'ao_vivo' || st === 'encerrando'
  // Relogio local zerou, mas o servidor ainda nao fechou: nada de "Encerrado"
  // por conta propria. Um lance de ultimo segundo pode ter prorrogado.
  const conferindo = lote.status === 'ativo' && st === 'encerrado'
  const vivoOuAgendado = aberto || st === 'em_breve' || st === 'encerrado'
  const fimMs = lote.terminaEm ? Date.parse(lote.terminaEm) : NaN
  const restanteMs = Number.isFinite(fimMs) ? fimMs - agora : Infinity
  const intervalo =
    conferindo || (aberto && restanteMs <= JANELA_FINAL_MS) ? INTERVALO_FINAL_MS : INTERVALO_NORMAL_MS

  // Versao que entrou por fora tambem conta para descartar leitura atrasada.
  useEffect(() => {
    versaoRef.current = Math.max(versaoRef.current, lote.versao)
  }, [lote.versao])

  // Na rodada: o lote mudou (lance de alguem, fechamento) e a pessoa ja deu
  // lance nele -> confere a propria posicao (lidera? foi superada? venceu?).
  // So a VERSAO externa dispara: `participei` virar true acontece justamente
  // depois de uma leitura (ou do lance, que ja rele), e reler ali duplicaria.
  const participei = posicao?.seuMaximoCents != null
  const participeiRef = useRef(participei)
  useEffect(() => {
    participeiRef.current = participei
    if (participei) aoParticipar?.(loteInicial.id)
  }, [participei, aoParticipar, loteInicial.id])
  const versaoExterna = loteExterno && loteExterno.id === loteInicial.id ? loteExterno.versao : null
  const versaoExternaVistaRef = useRef(versaoExterna)
  useEffect(() => {
    if (!pollingExterno || versaoExterna == null || versaoExterna === versaoExternaVistaRef.current) return
    versaoExternaVistaRef.current = versaoExterna
    if (participeiRef.current) buscarEstado()
  }, [pollingExterno, versaoExterna, buscarEstado])

  useEffect(() => {
    // Lote que ja fechou de vez (arrematado, sem lances, cancelado) nao muda mais.
    // Na rodada, quem busca e a pagina (pollingExterno).
    if (!vivoOuAgendado || pollingExterno) return
    let vivo = true
    let t: ReturnType<typeof setTimeout> | undefined
    const volta = async () => {
      if (!vivo) return
      if (typeof document === 'undefined' || !document.hidden) await buscarEstado()
      if (vivo) t = setTimeout(volta, intervalo)
    }
    t = setTimeout(volta, intervalo)
    const aoVoltar = () => {
      if (!document.hidden) buscarEstado()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      vivo = false
      if (t) clearTimeout(t)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [vivoOuAgendado, pollingExterno, intervalo, buscarEstado])

  // Montagem (assim que a sessao resolve, logado ou nao) e a cada troca de
  // sessao: uma leitura na hora acerta o relogio pelo servidor (o server_now do
  // HTML chega atrasado pela latencia) e traz a posicao e o `proprio`, inclusive
  // em lote ja arrematado (o polling para nesses).
  // Na rodada sem sessao nao ha posicao a ler: o lote e o relogio ja chegam
  // pela leitura da rodada.
  useEffect(() => {
    if (logado === null) return
    if (!logado) {
      setPosicao(null)
      setProprio(false)
      setPagarAte(null)
      if (pollingExterno) return
    }
    buscarEstado()
  }, [logado, pollingExterno, buscarEstado])

  // Relogio zerou com o lote ativo: confere na hora, sem esperar a proxima volta.
  // Na rodada quem confere e o polling dela (2s com o relogio zerado).
  useEffect(() => {
    if (conferindo && !pollingExterno) buscarEstado()
  }, [conferindo, pollingExterno, buscarEstado])

  // ── Derivados ───────────────────────────────────────────────────────────
  const precoCents = lote.nLances > 0 && lote.precoAtualCents != null ? lote.precoAtualCents : lote.lanceInicialCents
  const minimo = minimoProximoCents(lote)
  const atalhos = atalhosLance(lote)
  const chipsRapidos = useMemo(() => {
    const a = minimo
    const b = a + incrementoCents(a)
    const c = b + incrementoCents(b)
    return [a, b, c]
  }, [minimo])

  const estouGanhando = !!posicao?.voceLidera && lote.nLances > 0
  const fuiSuperado = !!posicao && !posicao.voceLidera && posicao.seuMaximoCents != null && lote.nLances > 0

  const valorCents = reaisParaCents(valorTxt)
  // O valor e sempre o TETO: o total mostrado e o maximo que pode ser cobrado.
  const arremate = valorCents ? calcularArremate(valorCents) : null
  const acimaDoMercado =
    !!valorCents && !!referenciaMercadoCents && valorCents > referenciaMercadoCents * FATOR_AVISO_MERCADO
  const valorAlto = !!valorCents && valorCents > minimo * FATOR_CONFIRMACAO_DUPLA

  // Mudou o valor ou a aba: o segundo toque volta a ser pedido.
  useEffect(() => {
    setConfirmarAlto(false)
  }, [valorCents, aba])

  // aria-live: anuncia so quando o PRECO muda, nunca a cada tique do relogio.
  const [anuncio, setAnuncio] = useState('')
  const ultimoPreco = useRef(precoCents)
  useEffect(() => {
    if (ultimoPreco.current !== precoCents) {
      ultimoPreco.current = precoCents
      setAnuncio(`Lance atual ${formatarBRL(precoCents)}`)
    }
  }, [precoCents])

  // ── Folha ────────────────────────────────────────────────────────────────
  const abrirFolha = (valorInicial: number = minimo) => {
    setErro(null)
    setAviso(null)
    setAba('rapido')
    setValorTxt(centsParaCampo(valorInicial))
    setConfirmarAlto(false)
    setAberta(true)
  }
  const fecharFolha = useCallback(() => {
    setAberta(false)
    setTimeout(() => ctaRef.current?.focus(), 0)
  }, [])

  const trocarAba = (a: Aba) => {
    setAba(a)
    // Rapido so tem os chips: valor digitado fora deles volta para o minimo.
    if (a === 'rapido' && (valorCents == null || !chipsRapidos.includes(valorCents))) {
      setValorTxt(centsParaCampo(minimo))
    }
    // No maximo o campo e a entrada: foca (e abre o teclado) so quando a pessoa escolhe.
    if (a === 'maximo') setTimeout(() => campoRef.current?.focus(), 0)
  }

  useEffect(() => {
    if (!aberta) return
    // Foco no dialogo, nao no campo: no celular isso abriria o teclado sem pedir.
    const t = setTimeout(() => folhaRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fecharFolha()
        return
      }
      if (e.key !== 'Tab') return
      // Trap de foco: Tab e Shift+Tab ciclam dentro da folha.
      const raiz = folhaRef.current
      if (!raiz) return
      const focaveis = Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
        el => el.getClientRects().length > 0
      )
      if (!focaveis.length) {
        e.preventDefault()
        raiz.focus()
        return
      }
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      const ativo = document.activeElement as HTMLElement | null
      const dentro = !!ativo && raiz.contains(ativo) && ativo !== raiz
      if (e.shiftKey && (!dentro || ativo === primeiro)) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (!dentro || ativo === ultimo)) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Teclado do iOS: o layout viewport nao encolhe, o visualViewport sim. O
    // fundo acompanha a area visivel para o Confirmar nao ficar sob o teclado.
    const vvp = typeof window !== 'undefined' ? window.visualViewport : null
    const aplicarVv = () => {
      if (vvp) setVv({ h: vvp.height, top: vvp.offsetTop })
    }
    aplicarVv()
    vvp?.addEventListener('resize', aplicarVv)
    vvp?.addEventListener('scroll', aplicarVv)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      vvp?.removeEventListener('resize', aplicarVv)
      vvp?.removeEventListener('scroll', aplicarVv)
      setVv(null)
    }
  }, [aberta, fecharFolha])

  async function confirmar() {
    if (!valorCents || enviando) return
    if (!online) {
      setErro('Sem conexão. O lance fica disponível quando a internet voltar.')
      return
    }
    if (valorCents < minimo) {
      setErro(`O lance mínimo agora é ${formatarBRL(minimo)}.`)
      return
    }
    // Valor muito acima do minimo (zero a mais, dedo escorregou): segundo toque.
    if (valorAlto && !confirmarAlto) {
      setConfirmarAlto(true)
      return
    }
    setErro(null)
    setEnviando(true)

    // Mesmo valor reenviado (rede caiu no meio) reaproveita a chave: o banco
    // devolve o mesmo resultado em vez de registrar dois lances.
    if (!idemRef.current || idemRef.current.valor !== valorCents) {
      idemRef.current = { chave: novoIdem(), valor: valorCents }
    }
    const idem = idemRef.current.chave

    const enviadoEm = Date.now()
    try {
      const token = await tokenAtual()
      if (!token) {
        setErro('Sua sessão expirou. Entre de novo para dar lance.')
        setEnviando(false)
        return
      }
      const r = await fetch(`/api/leiloes/${lote.id}/lance`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // vistoCents: o minimo que a tela mostrava. O servidor usa para dizer se
        // outro lance chegou primeiro ou se o valor digitado ficou abaixo.
        body: JSON.stringify({ maximoCents: valorCents, idem, vistoCents: minimo }),
      })
      const j = await r.json().catch(() => null)
      // A chave so e descartada quando o servidor respondeu de verdade: 2xx, ou
      // 4xx com erro conhecido (regra do lance). 5xx ou corpo que nao e JSON
      // (proxy, timeout) pode ter gravado o lance: o reenvio do mesmo valor
      // precisa da MESMA chave para o banco nao registrar dois.
      const erroConhecido = !!j && typeof j.erro === 'string' && j.erro !== 'desconhecido'
      if (j && (r.ok || (r.status >= 400 && r.status < 500 && erroConhecido))) {
        idemRef.current = null
      }

      if (!r.ok || !j || j.ok === false) {
        const minimoServidor = typeof j?.minimoCents === 'number' ? j.minimoCents : null
        setErro(j?.mensagem || 'Não foi possível registrar o lance. Tente de novo.')
        if (minimoServidor) setValorTxt(centsParaCampo(minimoServidor))
        buscarEstado()
        return
      }

      const res = j as LanceResultado
      aplicarServerNow(res.serverNow, enviadoEm)
      ultimoLanceEmRef.current = Date.now()
      versaoRef.current = Math.max(versaoRef.current, res.versao)
      // seu_maximo_cents so vem quando o lider ajusta o proprio teto. Nos outros
      // casos o teto gravado e o maior entre o enviado e o que ja havia.
      setPosicao(atual => ({
        voceLidera: res.lider,
        seuMaximoCents: res.seuMaximoCents ?? Math.max(valorCents, atual?.seuMaximoCents ?? 0),
      }))
      setLote(atual => ({
        ...atual,
        precoAtualCents: res.precoCents,
        nLances: res.nLances,
        terminaEm: res.terminaEm ?? atual.terminaEm,
        versao: Math.max(atual.versao, res.versao),
      }))
      if (res.lider) {
        setAviso(null)
        fecharFolha()
      } else {
        // Outro teto automatico cobriu na hora. A folha fica aberta com o novo minimo.
        setAviso(`Outro participante tinha um lance máximo maior. Lance atual: ${formatarBRL(res.precoCents)}.`)
        setValorTxt(centsParaCampo(res.minimoProximoCents))
      }
      buscarEstado()
    } catch {
      // Rede caiu no meio: a chave fica guardada para o reenvio do mesmo valor.
      setErro('A conexão falhou antes da confirmação. Tente de novo: o lance não é registrado duas vezes.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  // `relogio` = texto completo (aria-label); `relogioAnel` = so a maior
  // unidade, que e o que cabe dentro do anel de 64px.
  let relogio = ''
  let relogioAnel = ''
  const marcar = (ms: number | null) => {
    relogio = ms == null ? '--:--' : formatarTempoRestante(ms)
    relogioAnel = ms == null ? '--:--' : formatarTempoAnel(ms)
  }
  if (st === 'em_breve') {
    const ini = lote.iniciaEm ? Date.parse(lote.iniciaEm) : NaN
    marcar(Number.isFinite(ini) && ini > agora ? ini - agora : null)
  } else if (aberto) {
    marcar(Number.isFinite(restanteMs) ? restanteMs : null)
  } else if (conferindo) {
    marcar(0)
  }
  // Fracao do anel: o que resta do lote. Total = fim - inicio (ja conta as
  // prorrogacoes); sem inicio legivel, a duracao configurada.
  const iniMs = lote.iniciaEm ? Date.parse(lote.iniciaEm) : NaN
  const totalMs = Number.isFinite(iniMs) && Number.isFinite(fimMs) && fimMs > iniMs ? fimMs - iniMs : lote.duracaoSeg * 1000
  const fracaoAnel =
    aberto && Number.isFinite(restanteMs) && totalMs > 0 ? Math.min(1, Math.max(0, restanteMs / totalMs)) : 0
  const anelUrgente = conferindo || (aberto && restanteMs <= ANEL_URGENTE_MS)
  const horaAbsoluta =
    st === 'em_breve' && lote.iniciaEm
      ? `Começa em ${horarioBrasilia(lote.iniciaEm)}`
      : (aberto || conferindo) && lote.terminaEm
        ? `Termina em ${horarioBrasilia(lote.terminaEm)}`
        : lote.encerradoEm
          ? `Encerrado em ${horarioBrasilia(lote.encerradoEm)}`
          : ''

  const voltarPara = urlLogin || urlLote
  const loginHref = `${voltarPara}?auth=login&next=${encodeURIComponent(voltarPara)}`

  // Quem venceu e ainda nao pagou: o CTA leva ao pagamento, com o prazo.
  const devePagar = lote.status === 'aguardando_pagamento' && !!posicao?.voceLidera && !!pagarAte

  let cta: ReactNode
  if (devePagar) {
    cta = (
      <Link href={urlPagar(lote.slug)} prefetch={false} className="lv-cta-btn bx-ctx-comprador" style={{ ...S.ctaBtn, background: 'var(--ac-grad)' }}>
        Pagar até {horarioBrasilia(pagarAte!)}
      </Link>
    )
  } else if (conferindo) {
    cta = (
      <div role="status" style={S.ctaInfo}>
        Conferindo encerramento...
      </div>
    )
  } else if (!aberto) {
    cta = (
      <div style={S.ctaInfo}>
        {st === 'em_breve' ? 'Os lances abrem quando o lote começar.' : ROTULO_STATUS[st]}
      </div>
    )
  } else if (proprio) {
    cta = <div style={S.ctaInfo}>Este lote é seu. Acompanhe os lances por aqui.</div>
  } else if (logado === false) {
    cta = (
      <Link href={loginHref} prefetch={false} className="lv-cta-btn" style={S.ctaBtn}>
        Entrar para dar lance
      </Link>
    )
  } else if (!online) {
    cta = <div style={S.ctaInfo}>Sem conexão. O lance fica disponível quando a internet voltar.</div>
  } else {
    const dois = atalhos[1]
    cta = (
      <div style={S.ctaLinha}>
        <button ref={ctaRef} type="button" onClick={() => abrirFolha()} disabled={logado === null} className="lv-cta-btn" style={S.ctaBtn}>
          Dar lance · {formatarBRL(minimo)}
        </button>
        {variante === 'rodada' && (
          <button
            type="button"
            onClick={() => abrirFolha(dois.valorCents)}
            disabled={logado === null}
            className="lv-cta-btn lv-cta-mais lv-so-celular"
            style={S.ctaMais}
            // O botao so ABRE a folha ja preenchida com o valor; quem confirma e a folha.
            aria-label={`Abrir lance em ${formatarBRL(dois.valorCents)}`}
          >
            {dois.rotulo}
          </button>
        )}
      </div>
    )
  }
  // Atalhos do desktop: mesmo estado em que o CTA e "Dar lance".
  const mostrarAtalhos =
    variante === 'rodada' && aberto && !devePagar && !conferindo && !proprio && logado !== false && online
  const prorrogacaoRodada = variante === 'rodada' && (aberto || conferindo) ? textoProrrogacao(lote.softCloseSeg, lote.prorrogacoes) : null

  return (
    <section aria-label="Lance ao vivo" style={S.bloco}>
      <style>{`
        .lv-cta-btn { transition: filter 0.15s ease, transform 0.15s ease; }
        .lv-cta-btn:hover:not(:disabled) { filter: brightness(1.08); }
        .lv-cta-btn:focus-visible, .lv-foco:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .lv-cta-btn:disabled { opacity: 0.6; cursor: default; }
        .lv-cta-mais:hover:not(:disabled) { filter: none; background: var(--bx-surface-2); }
        .lv-cta-fixo { margin-top: 16px; }
        .lv-rapidos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .lv-rapidos + .lv-cta-fixo { margin-top: 0; }
        .lv-rapido { transition: background 0.15s ease, border-color 0.15s ease; }
        .lv-rapido:hover:not(:disabled) { background: var(--bx-surface-2); border-color: var(--ac-1); }
        .lv-rapido:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .lv-so-celular { display: none; }
        @media (max-width: 768px) {
          .lv-rapidos { display: none; }
          .lv-so-celular { display: inline-flex; align-items: center; justify-content: center; }
        }
        @media (max-width: 768px) {
          /* Casca do Bynx Leiloes: sem bottom nav. O CTA encosta no fim da tela
             e a safe area (barra do iPhone) entra no padding, com o fundo por
             baixo dela. A folga no fim da pagina fica no rodape da casca
             (.lc-casca:has(.lv-cta-fixo) em casca/estilos.ts). */
          .lv-cta-fixo {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 150; margin: 0;
            padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
            background: var(--bx-bg-elev); border-top: 1px solid var(--bx-border);
            box-shadow: var(--bx-shadow);
          }
        }
        .lv-folha-fundo { position: fixed; inset: 0; z-index: 400; background: var(--bx-scrim); display: flex; align-items: flex-end; justify-content: center; }
        .lv-folha {
          width: 100%; max-width: 520px; max-height: 92vh; max-height: min(92dvh, 100%); overflow-y: auto;
          background: var(--bx-bg-elev); border: 1px solid var(--bx-border); border-bottom: none;
          border-radius: 18px 18px 0 0; box-shadow: var(--bx-shadow);
          padding: 16px 16px 0; outline: none;
          animation: lv-sobe 0.2s ease;
        }
        /* Confirmar sempre visivel, inclusive com o teclado aberto. */
        .lv-folha-rodape {
          position: sticky; bottom: 0; background: var(--bx-bg-elev);
          padding: 8px 0 calc(16px + env(safe-area-inset-bottom, 0px)); margin-top: 8px;
        }
        @media (min-width: 769px) { .lv-folha-fundo { align-items: center; } .lv-folha { border-radius: 18px; border-bottom: 1px solid var(--bx-border); } }
        @keyframes lv-sobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .lv-folha { animation: none; } .lv-cta-btn { transition: none; } }
        .lv-chip-rapido { transition: background 0.15s ease, border-color 0.15s ease; }
        .lv-chip-rapido:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
        .lv-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      `}</style>

      {/* Anuncio para leitor de tela num no SEPARADO: o preco visivel re-renderiza
          a cada tique do relogio, e aria-live nele leria a tela inteira. */}
      <p className="lv-sr" aria-live="polite" aria-atomic="true">{anuncio}</p>

      <div style={S.lanceLinha}>
        <div style={S.lanceCol}>
          <span style={S.precoRotulo}>
            {lote.nLances > 0 ? (st === 'arrematado' ? 'Arrematado por' : 'Lance atual') : 'Lance inicial'}
          </span>
          <span style={{ ...S.preco, fontSize: variante === 'rodada' ? 40 : 34 }}>{formatarBRL(precoCents)}</span>
          <span style={S.precoMeta}>
            {lote.nLances === 0 ? 'Nenhum lance ainda' : lote.nLances === 1 ? '1 lance' : `${lote.nLances} lances`}
            {lote.nParticipantes > 1 ? ` · ${lote.nParticipantes} participantes` : ''}
            {lote.liderApelido && lote.nLances > 0 ? ` · liderando: ${lote.liderApelido}` : ''}
          </span>
          {horaAbsoluta && <span style={S.horaAbs}>{horaAbsoluta}</span>}
        </div>
        {relogio ? (
          <Anel
            fracao={st === 'em_breve' ? 0 : fracaoAnel}
            texto={relogioAnel}
            urgente={anelUrgente}
            rotulo={st === 'em_breve' ? `Começa em ${relogio}` : conferindo ? 'Conferindo encerramento' : `Faltam ${relogio}`}
          />
        ) : (
          <span style={{ ...S.status, ...(st === 'arrematado' ? S.statusFeito : null) }}>{ROTULO_STATUS[st]}</span>
        )}
      </div>
      {variante !== 'rodada' && lote.prorrogacoes > 0 && aberto && (
        <p style={S.nota}>
          Prorrogado {lote.prorrogacoes === 1 ? '1 vez' : `${lote.prorrogacoes} vezes`}: lance nos últimos {lote.softCloseSeg}s
          estende o fim.
        </p>
      )}
      {referenciaMercadoCents && (
        <p style={S.mercado}>
          <IconChart size={14} />
          <span>
            Mercado Brasileiro: a partir de{' '}
            {lote.cardSlug ? (
              <Link href={`/carta/${lote.cardSlug}`} style={S.mercadoLink}>
                {formatarBRL(referenciaMercadoCents)}
              </Link>
            ) : (
              <strong style={S.mercadoValor}>{formatarBRL(referenciaMercadoCents)}</strong>
            )}
            {lote.nLances > 0 && (() => {
              const pct = Math.round((precoCents / referenciaMercadoCents - 1) * 100)
              if (pct === 0) return ' · no valor de mercado'
              return pct < 0 ? ` · ${-pct}% abaixo` : ` · ${pct}% acima`
            })()}
          </span>
        </p>
      )}
      {aposMercado}

      {estouGanhando && (aberto || st === 'arrematado') && (
        <div role="status" style={{ ...S.faixa, ...S.faixaGanhando }}>
          <IconCheck size={16} />
          {st === 'arrematado' ? 'Você venceu este lote' : 'Você está ganhando'}
          {aberto && posicao?.seuMaximoCents != null && posicao.seuMaximoCents > precoCents
            ? ` · seu máximo: ${formatarBRL(posicao.seuMaximoCents)}`
            : ''}
        </div>
      )}
      {fuiSuperado && (
        <div role="status" style={{ ...S.faixa, ...S.faixaSuperado }}>
          <IconWarning size={16} />
          Seu lance foi superado
        </div>
      )}

      {mostrarAtalhos && (
        <div className="lv-rapidos">
          {atalhos.map(a => (
            <button
              key={a.valorCents}
              type="button"
              onClick={() => abrirFolha(a.valorCents)}
              disabled={logado === null}
              className="lv-rapido"
              style={S.rapido}
              aria-label={`Abrir lance em ${formatarBRL(a.valorCents)}`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      )}
      <div className="lv-cta-fixo">{cta}</div>
      {prorrogacaoRodada && <p style={S.prorrogacao}>{prorrogacaoRodada}</p>}

      <p style={S.protecao}>
        <IconShield size={14} />
        Quem arremata paga pela Bynx, no cartão, com pagamento protegido.
      </p>

      {aberta && (
        <div
          className="lv-folha-fundo"
          style={vv ? { top: vv.top, height: vv.h, bottom: 'auto' } : undefined}
          onClick={e => {
            if (e.target === e.currentTarget) fecharFolha()
          }}
        >
          <div
            ref={folhaRef}
            className="lv-folha"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lv-folha-titulo"
            tabIndex={-1}
          >
            <div style={S.folhaTopo}>
              <h2 id="lv-folha-titulo" style={S.folhaTitulo}>Dar lance</h2>
              <button type="button" onClick={fecharFolha} aria-label="Fechar" className="lv-foco" style={S.fechar}>
                <IconClose size={18} />
              </button>
            </div>

            <div role="group" aria-label="Tipo de lance" style={S.abas}>
              {(['rapido', 'maximo'] as const).map(a => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={aba === a}
                  onClick={() => trocarAba(a)}
                  className="lv-foco"
                  style={{ ...S.aba, ...(aba === a ? S.abaAtiva : null) }}
                >
                  {a === 'rapido' ? 'Lance rápido' : 'Lance máximo'}
                </button>
              ))}
            </div>
            <p style={S.abaTexto}>
              {aba === 'rapido'
                ? 'Todo lance é automático. O valor que você escolher é o seu limite: você paga o menor valor necessário para vencer, até o limite que informou.'
                : 'Todo lance é automático. Informe o máximo que aceita pagar: você paga o menor valor necessário para vencer, até o limite que informou. Ninguém vê o seu máximo.'}
            </p>

            <p style={S.rotuloCampo}>Lance mínimo agora: {formatarBRL(minimo)}</p>

            {aba === 'rapido' ? (
              <div style={S.chipsRapidos}>
                {chipsRapidos.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={valorCents === c}
                    className="lv-chip-rapido lv-foco"
                    onClick={() => {
                      setValorTxt(centsParaCampo(c))
                      setErro(null)
                    }}
                    style={{ ...S.chipRapido, ...(valorCents === c ? S.chipRapidoAtivo : null) }}
                  >
                    {formatarBRL(c)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label htmlFor="lv-valor" style={S.rotuloCampo}>
                  Seu lance máximo
                </label>
                <div style={S.campoWrap}>
                  <span style={S.campoPrefixo}>R$</span>
                  <input
                    id="lv-valor"
                    ref={campoRef}
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="done"
                    value={valorTxt}
                    onChange={e => {
                      setValorTxt(e.target.value)
                      setErro(null)
                    }}
                    style={S.campo}
                  />
                </div>
              </>
            )}

            {acimaDoMercado && referenciaMercadoCents && (
              <p style={S.avisoMercado}>
                <IconWarning size={14} />
                Este valor está bem acima do Mercado Brasileiro ({formatarBRL(referenciaMercadoCents)}). Confira antes de
                confirmar.
              </p>
            )}

            {arremate && (
              <dl style={S.total}>
                <div style={S.totalLinha}><dt>Seu limite</dt><dd>{formatarBRL(arremate.precoCents)}</dd></div>
                <div style={S.totalLinha}><dt>Taxa de proteção</dt><dd>até {formatarBRL(arremate.protecaoCents)}</dd></div>
                <div style={S.totalLinha}><dt>Custo do cartão</dt><dd>até {formatarBRL(arremate.custoMetodoCents)}</dd></div>
                <div style={{ ...S.totalLinha, ...S.totalFinal }}>
                  <dt>Total máximo se arrematar</dt><dd>até {formatarBRL(arremate.compradorPagaCents)}</dd>
                </div>
              </dl>
            )}
            {arremate && (
              <p style={S.totalNota}>
                Se ninguém disputar até o seu limite, você paga menos. Frete calculado no pagamento, pelo seu CEP.
              </p>
            )}

            <div className="lv-folha-rodape">
              {aviso && <p role="alert" style={S.avisoMercado}><IconWarning size={14} />{aviso}</p>}
              {confirmarAlto && valorCents && (
                <p role="alert" style={S.avisoMercado}>
                  <IconWarning size={14} />
                  Este valor é mais de {FATOR_CONFIRMACAO_DUPLA} vezes o lance mínimo atual ({formatarBRL(minimo)}).
                  Toque de novo para confirmar.
                </p>
              )}
              {erro && <p role="alert" style={S.erro}>{erro}</p>}

              <button
                type="button"
                onClick={confirmar}
                disabled={!valorCents || enviando || !online || !aberto}
                className="lv-cta-btn"
                style={{ ...S.ctaBtn, marginTop: 10 }}
              >
                {enviando
                  ? 'Registrando lance...'
                  : conferindo
                    ? 'Conferindo encerramento...'
                    : !aberto
                      ? 'Lote encerrado'
                      : valorCents
                        ? confirmarAlto
                          ? `Confirmar ${formatarBRL(valorCents)} mesmo assim`
                          : `Confirmar lance de ${formatarBRL(valorCents)}`
                        : 'Informe o valor do lance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  bloco: { display: 'flex', flexDirection: 'column', gap: 12 },
  lanceLinha: { display: 'flex', alignItems: 'center', gap: 12 },
  lanceCol: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  status: {
    flexShrink: 0, display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, fontSize: 12,
    fontWeight: 700, background: 'var(--bx-surface-2)', color: 'var(--bx-text-2)',
    // Longhands: statusFeito troca so a cor (shorthand + borderColor gera aviso do React).
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)',
  },
  statusFeito: { color: 'var(--bx-green)', borderColor: 'var(--bx-green)' },
  horaAbs: { fontSize: 12.5, color: 'var(--bx-text-3)' },
  precoRotulo: { fontSize: 10.5, color: 'var(--bx-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  preco: {
    fontSize: 40, fontWeight: 800, color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
    lineHeight: 1, overflowWrap: 'anywhere',
  },
  precoMeta: { fontSize: 12.5, color: 'var(--bx-text-2)' },
  nota: { fontSize: 12.5, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5 },
  mercado: {
    display: 'flex', alignItems: 'center', gap: 6, margin: 0, paddingTop: 10,
    borderTop: '1px solid var(--bx-border)', fontSize: 12.5, color: 'var(--bx-text-2)', lineHeight: 1.5,
  },
  mercadoLink: { color: 'var(--bx-text)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 },
  mercadoValor: { color: 'var(--bx-text)', fontWeight: 700 },
  faixa: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)', background: 'var(--bx-surface)',
  },
  faixaGanhando: { color: 'var(--bx-green)', borderColor: 'var(--bx-green)' },
  faixaSuperado: { color: 'var(--bx-red)', borderColor: 'var(--bx-red)' },
  ctaLinha: { display: 'flex', gap: 8 },
  rapido: {
    minHeight: 44, borderRadius: 12, border: '1px solid var(--bx-border-2)', background: 'transparent', color: 'var(--bx-text)',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  prorrogacao: { fontSize: 12, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' },
  ctaMais: {
    flexShrink: 0, minWidth: 84, minHeight: 48, padding: '0 12px', borderRadius: 12, cursor: 'pointer',
    background: 'transparent', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  },
  ctaBtn: {
    flex: 1, width: '100%', minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', textDecoration: 'none',
    fontVariantNumeric: 'tabular-nums',
  },
  ctaInfo: {
    minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    padding: '8px 12px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)',
  },
  protecao: { display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.5 },
  folhaTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  folhaTitulo: { fontSize: 18, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  fechar: {
    width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)', cursor: 'pointer',
  },
  abas: {
    display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, padding: 4, borderRadius: 12,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)',
  },
  aba: {
    minHeight: 44, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--bx-text-2)',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  abaAtiva: { background: 'var(--bx-surface-3)', color: 'var(--bx-text)' },
  abaTexto: { fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5, margin: '10px 0 12px' },
  rotuloCampo: { display: 'block', fontSize: 12, color: 'var(--bx-text-3)', fontWeight: 600, margin: '0 0 6px' },
  chipsRapidos: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 },
  chipRapido: {
    minHeight: 44, borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)',
    background: 'var(--bx-surface)',
    color: 'var(--bx-text)', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontVariantNumeric: 'tabular-nums', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  chipRapidoAtivo: { borderColor: 'var(--ac-1)', color: 'var(--ac-1)', background: 'rgba(var(--ac-1-rgb), 0.12)' },
  campoWrap: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', minHeight: 52, borderRadius: 10,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border-2)',
  },
  campoPrefixo: { fontSize: 16, color: 'var(--bx-text-3)', fontWeight: 700 },
  // 16px: abaixo disso o Safari iOS da zoom ao focar e nao volta.
  campo: {
    flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--bx-text)',
    fontFamily: 'inherit', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', height: 50,
  },
  avisoMercado: {
    display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13, lineHeight: 1.5, margin: '10px 0 0',
    padding: '8px 10px', borderRadius: 8, color: 'var(--bx-amber)', border: '1px solid var(--bx-border-2)',
    background: 'var(--bx-surface)',
  },
  total: { margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 4 },
  totalLinha: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  totalFinal: { fontSize: 15, fontWeight: 800, color: 'var(--bx-text)', borderTop: '1px solid var(--bx-border)', paddingTop: 6, marginTop: 2 },
  totalNota: { fontSize: 12, color: 'var(--bx-text-3)', margin: '6px 0 0' },
  erro: { fontSize: 13, color: 'var(--bx-red)', margin: '10px 0 0', lineHeight: 1.5 },
}

/**
 * Relogio em anel (64px). Traco no gradiente do acento do contexto; nos
 * ultimos 10s (ou conferindo o fechamento) fica em --bx-red. So o traco muda:
 * nada anima por conta propria, entao prefers-reduced-motion nao tem o que
 * desligar aqui.
 */
function Anel({ fracao, texto, urgente, rotulo }: { fracao: number; texto: string; urgente: boolean; rotulo: string }) {
  const id = useId().replace(/:/g, '')
  const R = 28
  const C = 2 * Math.PI * R
  const tam = texto.length > 6 ? 10.5 : texto.length > 5 ? 12 : 15
  return (
    <span role="timer" aria-label={rotulo} style={SA.anel}>
      <svg viewBox="0 0 64 64" width={64} height={64} aria-hidden style={SA.svg}>
        <defs>
          <linearGradient id={`lv-anel-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--ac-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--ac-2)' }} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--bx-border)" strokeWidth="5" />
        {fracao > 0 && (
          <circle
            cx="32" cy="32" r={R} fill="none" strokeWidth="5" strokeLinecap="round"
            stroke={urgente ? 'var(--bx-red)' : `url(#lv-anel-${id})`}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fracao)}
            transform="rotate(-90 32 32)"
          />
        )}
      </svg>
      <b style={{ ...SA.texto, fontSize: tam, color: urgente ? 'var(--bx-red)' : 'var(--bx-text)' }}>{texto}</b>
    </span>
  )
}

const SA: Record<string, CSSProperties> = {
  anel: { position: 'relative', width: 64, height: 64, flex: '0 0 64px' },
  svg: { position: 'absolute', inset: 0 },
  texto: {
    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 800,
    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
  },
}
