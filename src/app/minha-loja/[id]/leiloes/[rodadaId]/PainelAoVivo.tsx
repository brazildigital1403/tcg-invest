'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IconArrowRight, IconClock, IconBox, IconPlay } from '@/components/ui/Icons'
import { Aviso, Botao, Etapas, Linha, MiniCarta, Preco, ProximaAcao, Recolhido, Resumo, Resumos, Rotulo, Selo, Titulo, type Etapa, type Tom } from '@/components/leilao/kit'
import { formatarBRL, formatarTempoRestante, horarioBrasilia, incrementoCents } from '@/lib/leilao'
import { urlLote } from '@/lib/leilao-urls'
import {
  JANELA_FINAL_MS, ROTULO_RESULTADO, intervaloPolling, resultadoDoLote, totaisRodada, type TomResultado,
} from '@/lib/leilao-painel'
import { SH } from '../../_shared'
import { chamarPainel } from '../_rodada'

/** Cada busca do painel aborta sozinha depois disso. */
const TIMEOUT_BUSCA_MS = 10_000
/** Rodada encerrada: releitura enquanto a aba esta visivel. */
const POLL_ENCERRADA_MS = 60_000

/**
 * Painel "Ao vivo" + "Resultado" da rodada, no editor da loja.
 *
 * - Ao vivo (rodada ao_vivo): sala com o lote no ar em destaque (foto, relógio,
 *   preço, lances, líder mascarado), a fila, os lotes encerrados e os totais
 *   da rodada. Só o que o motor faz: o relógio e a troca de lote rodam no
 *   servidor, então a tela não oferece pausar nem avançar.
 * - Resultado (ao vivo e encerrada): um item por lote fechado, com o status do
 *   arremate/pedido, e os totais arrematado e pago.
 *
 * Polling de GET /api/lojas/[id]/leiloes/[rodadaId]/ao-vivo: 5s, 2s nos
 * últimos 30s do lote no ar; rodada encerrada, 60s. Parado com a aba oculta
 * (volta na hora ao aparecer). Cada busca aborta em 10s (e no desmonte); se
 * falhar, a tela mostra há quanto tempo está sem atualização e segue tentando.
 * O relógio da contagem usa o `server_now` da resposta (deslocamento sobre o
 * relógio do aparelho).
 */

interface PedidoLote { id: string; numero: number; status: string }

interface LoteAoVivo {
  id: string
  codigo: string
  slug: string
  ordem: number
  card_name: string
  card_numero: string | null
  set_nome: string | null
  card_image: string | null
  fotos: string[] | null
  lance_inicial_cents: number
  preco_atual_cents: number | null
  n_lances: number
  duracao_seg: number
  inicia_em: string | null
  termina_em: string | null
  status: string
  encerrado_em: string | null
  pagar_ate: string | null
  lider_apelido: string | null
  pedido: PedidoLote | null
}

interface RespostaAoVivo {
  server_now: string
  rodada: { id: string; numero: number; titulo: string | null; status: string; inicia_em: string | null; link_transmissao: string | null }
  lotes: LoteAoVivo[]
}

const TOM_RESULTADO: Record<TomResultado, Tom> = { vivo: 'vivo', ok: 'frente', alerta: 'atencao', perigo: 'perigo', neutro: 'neutro' }

const COR_TOM: Record<TomResultado, string> = {
  vivo: 'var(--bx-red)',
  ok: 'var(--bx-green)',
  alerta: 'var(--bx-amber)',
  perigo: 'var(--bx-red)',
  neutro: 'var(--bx-text-3)',
}

const FECHADOS = new Set(['aguardando_pagamento', 'vendido', 'calote', 'sem_lances', 'cancelado'])

function fotoDe(l: LoteAoVivo): string | null {
  return (Array.isArray(l.fotos) && l.fotos[0]) || l.card_image || null
}

export default function PainelAoVivo({
  lojaId, rodadaId, statusRodada, onStatusRodada,
}: {
  lojaId: string
  rodadaId: string
  statusRodada: string
  /** A rodada mudou de status no servidor (ex.: último lote fechou). */
  onStatusRodada: (status: string) => void
}) {
  const [dados, setDados] = useState<RespostaAoVivo | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  /** Hora (relogio do servidor) da ultima resposta boa. */
  const [ultimoOk, setUltimoOk] = useState<number | null>(null)
  /** "Tentar agora": reinicia o ciclo de busca sem esperar o proximo intervalo. */
  const [tentativa, setTentativa] = useState(0)
  /** Relogio do SERVIDOR: Date.now() + deslocamento da ultima resposta. */
  const [agora, setAgora] = useState(() => Date.now())
  const deslocamento = useRef(0)
  const emVoo = useRef(false)
  const avisado = useRef(statusRodada)
  const onStatusRef = useRef(onStatusRodada)
  useEffect(() => { onStatusRef.current = onStatusRodada }, [onStatusRodada])

  const aoVivo = statusRodada === 'ao_vivo'

  // Encerrar a rodada ao vivo (#416, opcao a): o lote no ar termina no tempo
  // dele; os proximos sao cancelados. Confirmacao dentro do painel.
  const [encerrar, setEncerrar] = useState<'fechado' | 'confirmando' | 'enviando'>('fechado')
  const [msgEncerrar, setMsgEncerrar] = useState<string | null>(null)
  async function confirmarEncerrar() {
    setEncerrar('enviando'); setMsgEncerrar(null)
    try {
      const j = await chamarPainel<{ resultado?: { cancelados?: number; lote_ativo_termina?: boolean } }>(
        `/api/lojas/${lojaId}/leiloes/${rodadaId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'encerrar' }) },
      )
      const n = j.resultado?.cancelados ?? 0
      setMsgEncerrar(`${n} ${n === 1 ? 'lote cancelado' : 'lotes cancelados'}.${j.resultado?.lote_ativo_termina ? ' O lote no ar termina no tempo dele.' : ' Rodada encerrada.'}`)
      setEncerrar('fechado')
    } catch (e) {
      setMsgEncerrar((e as Error).message || 'Não foi possível encerrar. Tente de novo.')
      setEncerrar('confirmando')
    }
  }

  /** Uma busca; abortada por `signal` (desmonte) nao mexe no estado. */
  const buscar = useCallback(async (signal: AbortSignal): Promise<RespostaAoVivo | null> => {
    const t0 = Date.now()
    try {
      const j = await chamarPainel<RespostaAoVivo>(
        `/api/lojas/${lojaId}/leiloes/${rodadaId}/ao-vivo`,
        { cache: 'no-store', signal },
        { timeoutMs: TIMEOUT_BUSCA_MS },
      )
      const t1 = Date.now()
      const srv = Date.parse(j.server_now)
      if (Number.isFinite(srv)) deslocamento.current = srv - (t0 + t1) / 2
      const agoraSrv = Date.now() + deslocamento.current
      setDados(j)
      setErro(null)
      setUltimoOk(agoraSrv)
      setAgora(agoraSrv)
      return j
    } catch (e) {
      if (signal.aborted) return null
      setErro((e as Error).message || 'Não foi possível atualizar.')
      setAgora(Date.now() + deslocamento.current)
      return null
    }
  }, [lojaId, rodadaId])

  // Polling: 5s / 2s no fim do lote, 60s com a rodada encerrada; pausa com a
  // aba oculta e busca na hora ao voltar.
  useEffect(() => {
    let vivo = true
    let timer: ReturnType<typeof setTimeout> | null = null
    let ctrl: AbortController | null = null
    const limpar = () => { if (timer) { clearTimeout(timer); timer = null } }

    const ciclo = async () => {
      limpar()
      if (!vivo || emVoo.current) return
      emVoo.current = true
      const meu = new AbortController()
      ctrl = meu
      let j: RespostaAoVivo | null = null
      try {
        j = await buscar(meu.signal)
      } finally {
        emVoo.current = false
        if (ctrl === meu) ctrl = null
      }
      if (!vivo || document.hidden) return
      const ativo = j?.lotes.find(l => l.status === 'ativo')
      limpar()
      timer = setTimeout(ciclo, aoVivo
        ? intervaloPolling(ativo?.termina_em ?? null, Date.now() + deslocamento.current)
        : POLL_ENCERRADA_MS)
    }

    ciclo()
    const onVis = () => { if (document.hidden) limpar(); else ciclo() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      vivo = false
      limpar()
      ctrl?.abort()
      emVoo.current = false
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [aoVivo, buscar, tentativa])

  // Relógio: contagem com a rodada no ar, e o "sem atualização há Xs" com falha.
  const tique = aoVivo || erro !== null
  useEffect(() => {
    if (!tique) return
    const t = setInterval(() => { if (!document.hidden) setAgora(Date.now() + deslocamento.current) }, 1000)
    return () => clearInterval(t)
  }, [tique])

  // Status mudou no servidor: o editor recarrega a rodada (uma vez por status).
  useEffect(() => {
    const s = dados?.rodada.status
    if (s && s !== statusRodada && s !== avisado.current) {
      avisado.current = s
      onStatusRef.current(s)
    }
  }, [dados, statusRodada])

  if (!dados) {
    return (
      <section style={SH.card}>
        <h2 style={SH.cardH3}>{aoVivo ? 'Ao vivo' : 'Resultado'}</h2>
        <p style={S.suave}>{erro ? `${erro} Tentando de novo.` : 'Carregando…'}</p>
      </section>
    )
  }

  // `agora` ja vem no relogio do servidor (deslocamento aplicado ao gravar).
  const agoraSrv = agora
  const { lotes, rodada } = dados
  const total = lotes.length
  const ativo = lotes.find(l => l.status === 'ativo') ?? null
  const fila = lotes.filter(l => l.status === 'agendado' || l.status === 'rascunho')
  const fechados = lotes.filter(l => FECHADOS.has(l.status))
  const totais = totaisRodada(lotes)
  const semAtualizacao = erro !== null && ultimoOk !== null
    ? (
      <p style={S.faixa}>
        Sem atualização há {Math.max(0, Math.round((agoraSrv - ultimoOk) / 1000))}s. Tentando de novo.
      </p>
    )
    : null

  const segundosSemDado = ultimoOk !== null ? Math.max(0, Math.round((agoraSrv - ultimoOk) / 1000)) : null

  if (aoVivo) {
    const lancesRecebidos = lotes.reduce((soma, l) => soma + (l.n_lances || 0), 0)
    return (
      <div style={S.sala}>
        <Titulo
          selo={<Selo tom="vivo">Ao vivo</Selo>}
          titulo={rodada.titulo || `Rodada #${rodada.numero}`}
          texto={rodada.inicia_em ? `Começou em ${horarioBrasilia(rodada.inicia_em)}` : undefined}
        />

        {erro !== null && (
          <Aviso tom="perigo" titulo="Conexão instável">
            {segundosSemDado !== null ? `Última atualização há ${segundosSemDado}s. ` : ''}
            A rodada segue no ar: relógio e lances rodam no servidor.
            <Botao tipo="leve" onClick={() => setTentativa(n => n + 1)}>Tentar agora</Botao>
          </Aviso>
        )}

        <div className="lk-assist">
          <div style={S.sala}>
            {ativo ? (
              <LoteNoAr lote={ativo} total={total} agoraSrv={agoraSrv} />
            ) : (
              <section className="lk-card">
                <Rotulo fraco>Sem lote no ar</Rotulo>
                <b style={S.semLote}>{fila.length > 0 ? 'Preparando o próximo lote…' : 'Fechando o último lote…'}</b>
              </section>
            )}
            {rodada.link_transmissao && (
              <Botao tipo="sec" cheio href={rodada.link_transmissao} target="_blank" rel="noopener noreferrer">
                <IconPlay size={15} /> Abrir transmissão
              </Botao>
            )}
          </div>

          <aside style={S.sala}>
            <section className="lk-card">
              <div className="lk-card-t">
                <Rotulo fraco>Fila</Rotulo>
                <span style={S.detalhe}>{fila.length} {fila.length === 1 ? 'lote' : 'lotes'}</span>
              </div>
              {fila.length === 0 ? <p style={S.suave}>Nenhum lote na fila.</p> : (
                <ol style={S.lista}>
                  {fila.map(l => (
                    <li key={l.id} style={S.linha}>
                      <span style={S.num}>{l.ordem}</span>
                      <Miniatura lote={l} />
                      <div style={S.textoLinha}>
                        <span style={S.nome}>{l.card_name}</span>
                        <span style={S.detalhe}>Inicial {formatarBRL(l.lance_inicial_cents)} · {l.duracao_seg}s</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <Resumos>
              <Resumo rotulo="Lances" valor={String(lancesRecebidos)} />
              <Resumo rotulo="Arrematado" valor={formatarBRL(totais.arrematadoCents)} meta={`${totais.nArrematados} ${totais.nArrematados === 1 ? 'lote' : 'lotes'}`} />
            </Resumos>

            {fechados.length > 0 && (
              <section className="lk-card">
                <div className="lk-card-t">
                  <Rotulo fraco>Encerrados</Rotulo>
                  <span style={S.detalhe}>{fechados.length}</span>
                </div>
                <ol style={S.lista}>
                  {fechados.map(l => <LoteFechado key={l.id} lote={l} lojaId={lojaId} />)}
                </ol>
              </section>
            )}
          </aside>
        </div>

        <div style={S.encerrar}>
          {encerrar === 'fechado' ? (
            <button type="button" style={S.btPerigo} onClick={() => { setEncerrar('confirmando'); setMsgEncerrar(null) }}>
              Encerrar a rodada agora
            </button>
          ) : (
            <div style={S.confirma} role="alertdialog" aria-label="Encerrar a rodada">
              <p style={{ margin: 0 }}>
                O lote no ar termina no tempo dele, com o vencedor que tiver. {fila.length > 0
                  ? `${fila.length === 1 ? 'O lote seguinte é cancelado' : `Os ${fila.length} lotes seguintes são cancelados`}; para leiloar de novo, cadastre em outra rodada.`
                  : 'Não há lotes na fila.'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={S.btPerigo} disabled={encerrar === 'enviando'} onClick={confirmarEncerrar}>
                  {encerrar === 'enviando' ? 'Encerrando…' : 'Confirmar encerramento'}
                </button>
                <button type="button" style={S.btNeutro} disabled={encerrar === 'enviando'} onClick={() => setEncerrar('fechado')}>Voltar</button>
              </div>
            </div>
          )}
          {msgEncerrar && <p style={S.suave} role="status">{msgEncerrar}</p>}
        </div>
      </div>
    )
  }

  // Rodada encerrada: resumo, proxima acao e pos-venda de cada arremate.
  const arrematados = fechados.filter(l => ['aguardando_pagamento', 'vendido', 'calote'].includes(l.status))
  const semVenda = fechados.filter(l => !arrematados.includes(l))
  const aguardando = lotes.filter(l => l.status === 'aguardando_pagamento').length
  const aEnviar = lotes.filter(l => resultadoDoLote(l.status, l.pedido?.status) === 'pago').length
  const pedidos = `/minha-loja/${lojaId}/pedidos`

  return (
    <div style={S.sala}>
      <Titulo
        rotulo={`Rodada encerrada${rodada.inicia_em ? ` · ${horarioBrasilia(rodada.inicia_em)}` : ''}`}
        titulo="Resultado da rodada"
      />
      {semAtualizacao}

      <Resumos>
        <Resumo rotulo="Arrematados" valor={`${totais.nArrematados} / ${total}`} meta={total === 1 ? 'lote na rodada' : 'lotes na rodada'} />
        <Resumo rotulo="Valor arrematado" valor={formatarBRL(totais.arrematadoCents)} meta="Sem frete" />
        <Resumo
          rotulo="Pagamentos"
          valor={`${totais.nPagos} / ${totais.nArrematados}`}
          meta={aguardando > 0 ? `${aguardando} aguardando` : formatarBRL(totais.pagoCents)}
          tom={aguardando > 0 ? 'atencao' : undefined}
        />
      </Resumos>

      {aEnviar > 0 && (
        <ProximaAcao
          icone={<IconBox size={22} />}
          titulo={aEnviar === 1 ? '1 lote pago para enviar' : `${aEnviar} lotes pagos para enviar`}
          texto="O endereço de quem venceu está no pedido."
          acao={<Botao cheio href={pedidos}>Ver pedidos</Botao>}
        />
      )}
      {aguardando > 0 && (
        <Aviso tom="atencao" icone={<IconClock size={17} />} titulo="Você não precisa cobrar">
          O vencedor paga pela Bynx. Depois do pagamento, o endereço aparece em Pedidos.
        </Aviso>
      )}

      {arrematados.length > 0 && (
        <section style={S.sala}>
          <Rotulo fraco>Arrematados · {arrematados.length}</Rotulo>
          <div className="lk-linhas">
            {arrematados.map(l => <LoteArrematado key={l.id} lote={l} pedidos={pedidos} />)}
          </div>
        </section>
      )}

      {semVenda.length > 0 && (
        <Recolhido titulo={`Sem venda · ${semVenda.length}`} aberto={arrematados.length === 0}>
          <div className="lk-linhas">
            {semVenda.map(l => {
              const rot = ROTULO_RESULTADO[resultadoDoLote(l.status, l.pedido?.status)]
              const img = fotoDe(l)
              return (
                <Linha
                  key={l.id}
                  midia={img ? <MiniCarta src={img} /> : undefined}
                  titulo={l.card_name}
                  meta={`Lote ${l.ordem}`}
                  selo={<Selo tom={TOM_RESULTADO[rot.tom]}>{rot.label}</Selo>}
                />
              )
            })}
          </div>
        </Recolhido>
      )}

      <Botao tipo="sec" cheio href={`/minha-loja/${lojaId}/leiloes`}>Voltar aos leilões</Botao>
    </div>
  )
}

/** Etapas do pos-venda: arremate, pagamento, envio e conclusao. */
function etapasPosVenda(res: string): Etapa[] {
  const atual = res === 'aguardando_pagamento' ? 1 : res === 'pago' ? 2 : 3
  return ['Arremate', 'Pagamento', 'Envio', 'Concluído'].map((titulo, i) => ({
    titulo,
    estado: i < atual ? 'feito' : i === atual ? 'atual' : 'futuro',
  }))
}

function LoteArrematado({ lote: l, pedidos }: { lote: LoteAoVivo; pedidos: string }) {
  const res = resultadoDoLote(l.status, l.pedido?.status)
  const rot = ROTULO_RESULTADO[res]
  const img = fotoDe(l)
  const linkPedido = l.pedido && l.pedido.status !== 'aguardando_pagamento'
  return (
    <div className="lk-card" style={{ gap: 12, padding: 14 }}>
      <div className="lk-card-t">
        <Rotulo fraco>Lote {l.ordem}</Rotulo>
        <Selo tom={TOM_RESULTADO[rot.tom]}>{rot.label}</Selo>
      </div>
      <div style={S.arrematado}>
        {img && <MiniCarta src={img} />}
        <span className="lk-linha-c">
          <b>{l.card_name}</b>
          {l.lider_apelido && <small>{l.lider_apelido}</small>}
        </span>
        <span className="lk-linha-v">{l.preco_atual_cents != null ? formatarBRL(l.preco_atual_cents) : ''}</span>
      </div>
      {res !== 'calote' && res !== 'entregue' && <Etapas direcao="h" itens={etapasPosVenda(res)} />}
      {res === 'aguardando_pagamento' && l.pagar_ate && (
        <span style={S.detalhe}>O vencedor tem até {horarioBrasilia(l.pagar_ate)} para pagar.</span>
      )}
      {res === 'calote' && <span style={S.detalhe}>O prazo de pagamento acabou sem pagamento.</span>}
      {linkPedido && (
        <Link href={pedidos} prefetch={false} style={S.linkPedido}>
          Pedido #{l.pedido!.numero} <IconArrowRight size={14} />
        </Link>
      )}
    </div>
  )
}

function Miniatura({ lote }: { lote: LoteAoVivo }) {
  const src = fotoDe(lote)
  return (
    <div style={S.mini}>
      {src && <Image src={src} alt={lote.card_name} fill sizes="40px" loading="eager" style={{ objectFit: 'cover' }} />}
    </div>
  )
}

function LoteFechado({ lote: l, lojaId }: { lote: LoteAoVivo; lojaId: string }) {
  const res = resultadoDoLote(l.status, l.pedido?.status)
  const rot = ROTULO_RESULTADO[res]
  const arrematado = ['aguardando_pagamento', 'vendido', 'calote'].includes(l.status) && l.preco_atual_cents != null
  const linkPedido = l.pedido && l.pedido.status !== 'aguardando_pagamento'
  return (
    <li style={S.linha}>
      <span style={S.num}>{l.ordem}</span>
      <Miniatura lote={l} />
      <div style={S.textoLinha}>
        <span style={S.nome}>{l.card_name}</span>
        <span style={{ ...S.pill, color: COR_TOM[rot.tom] }}>{rot.label}</span>
        {arrematado && (
          <span style={S.detalhe}>
            Arrematado por <strong style={S.forte}>{formatarBRL(l.preco_atual_cents!)}</strong>
            {l.lider_apelido ? ` · ${l.lider_apelido}` : ''}
          </span>
        )}
        {res === 'aguardando_pagamento' && l.pagar_ate && (
          <span style={S.detalhe}>Prazo: {horarioBrasilia(l.pagar_ate)}</span>
        )}
        {linkPedido && (
          <Link href={`/minha-loja/${lojaId}/pedidos`} style={S.linkPedido}>
            Pedido #{l.pedido!.numero} <IconArrowRight size={14} />
          </Link>
        )}
      </div>
    </li>
  )
}

function LoteNoAr({ lote, total, agoraSrv }: { lote: LoteAoVivo; total: number; agoraSrv: number }) {
  const fim = lote.termina_em ? Date.parse(lote.termina_em) : NaN
  const restante = Number.isFinite(fim) ? fim - agoraSrv : NaN
  const final = Number.isFinite(restante) && restante <= JANELA_FINAL_MS
  const src = fotoDe(lote)
  const comLance = lote.n_lances > 0 && lote.preco_atual_cents != null
  const preco = comLance ? lote.preco_atual_cents! : lote.lance_inicial_cents
  const tomRelogio: Tom = final ? 'perigo' : 'acento'
  // Leitor de tela: so preco e lider (a contagem muda todo segundo e nao entra).
  const anuncio = `${comLance ? 'Lance atual' : 'Lance inicial'} ${formatarBRL(preco)}`
    + (lote.lider_apelido ? `, líder ${lote.lider_apelido}` : '')
  const meta = [
    `${lote.n_lances} ${lote.n_lances === 1 ? 'lance' : 'lances'}`,
    lote.lider_apelido ? `líder ${lote.lider_apelido}` : null,
    comLance ? `próximo ${formatarBRL(preco + incrementoCents(preco))}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <section className="lk-card lk-card-d">
      <span style={S.somenteLeitor} aria-live="polite" aria-atomic="true">{anuncio}</span>
      <div className="lk-card-t">
        <Rotulo>Lote {lote.ordem} de {total} · No ar</Rotulo>
        <Selo tom={tomRelogio} tempo icone={<IconClock size={13} />}>
          {Number.isFinite(restante) ? (restante > 0 ? formatarTempoRestante(restante) : 'Encerrando…') : '--:--'}
        </Selo>
      </div>
      <div className="lk-noar">
        <div className="lk-noar-foto">
          {src && <Image src={src} alt={lote.card_name} fill priority sizes="(min-width: 769px) 260px, 112px" style={{ objectFit: 'cover' }} />}
        </div>
        <div className="lk-noar-nome">
          <b style={S.noArNome}>{lote.card_name}</b>
          {(lote.card_numero || lote.set_nome) && (
            <span style={S.noArSet}>{[lote.card_numero, lote.set_nome].filter(Boolean).join(' · ')}</span>
          )}
        </div>
        <div className="lk-noar-info">
          <Preco rotulo={comLance ? 'Lance atual' : 'Lance inicial'} valor={formatarBRL(preco)} meta={meta} />
          <Botao tipo="sec" cheio href={urlLote(lote.slug)} target="_blank" rel="noopener noreferrer">
            Abrir página pública <IconArrowRight size={16} />
          </Botao>
        </div>
      </div>
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  sala: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  arrematado: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  semLote: { fontSize: 20, fontWeight: 800, color: 'var(--bx-text)' },
  noArNome: { display: 'block', fontSize: 22, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.015em', color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  noArSet: { display: 'block', marginTop: 3, fontSize: 13, color: 'var(--bx-text-2)' },
  encerrar: { paddingTop: 14, borderTop: '1px solid var(--bx-border)', display: 'flex', flexDirection: 'column', gap: 10 },
  confirma: { display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, color: 'var(--bx-text-2)', background: 'color-mix(in srgb, var(--bx-red) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-red) 30%, transparent)' },
  btPerigo: { minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid color-mix(in srgb, var(--bx-red) 45%, transparent)', background: 'color-mix(in srgb, var(--bx-red) 8%, transparent)', color: 'var(--bx-red)', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' },
  btNeutro: { minHeight: 44, padding: '0 16px', borderRadius: 10, border: '1px solid var(--bx-border)', background: 'transparent', color: 'var(--bx-text)', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  suave: { fontSize: 13, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.45 },
  faixa: {
    fontSize: 12, color: 'var(--bx-text-2)', margin: '0 0 10px', padding: '6px 10px', borderRadius: 8,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', fontVariantNumeric: 'tabular-nums',
  },
  somenteLeitor: {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden',
    clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
  },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column' },
  linha: {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
    borderTop: '1px solid var(--bx-border)',
  },
  num: {
    minWidth: 22, fontSize: 12, fontWeight: 800, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums', paddingTop: 2,
  },
  mini: {
    position: 'relative', width: 40, aspectRatio: '63 / 88', flexShrink: 0, borderRadius: 5, overflow: 'hidden',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
  },
  textoLinha: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, minWidth: 0, flex: 1 },
  nome: { fontSize: 13, fontWeight: 700, color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  detalhe: { fontSize: 12, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.4 },
  forte: { color: 'var(--bx-text)', fontWeight: 800 },
  pill: {
    fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
    border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
  },
  linkPedido: {
    display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, fontSize: 13, fontWeight: 700,
    color: 'var(--ac-1)', textDecoration: 'none',
  },
}
