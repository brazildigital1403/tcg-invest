'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconArrowDown, IconArrowUp, IconCheck, IconPlus, IconTrash, IconWarning } from '@/components/ui/Icons'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { formatarBRL, horarioBrasilia, lotePublicoDeLinha } from '@/lib/leilao'
import { brasiliaParaISO, isoParaBrasilia, linkValido, pendenciasAgendar } from '@/lib/leilao-painel'
import { useLojaOwner, LojaEstadoFallback, SH, LOJA_HOME, TrilhaLoja } from '../../_shared'
import { STATUS_RODADA, chamarPainel, type LotePainel, type RodadaResumo } from '../_rodada'
import NovoLote from './NovoLote'
import PainelAoVivo from './PainelAoVivo'

/**
 * Editor de uma rodada ao vivo da loja.
 *
 * - Dados da rodada: editaveis so em rascunho (agendada ja esta na vitrine).
 * - Lotes: subir/descer (rascunho e agendada, antes de abrir), remover e
 *   adicionar (so rascunho). A ordem vai inteira para a RPC de reordenar.
 * - Agendar: a tela lista as pendencias; o servidor confere de novo, sob trava.
 * - Cancelar: so enquanto nenhum lote abriu.
 */

interface Recebimento { podeReceber: boolean; motivo: string | null }

export default function EditorRodada({ lojaId, rodadaId }: { lojaId: string; rodadaId: string }) {
  const { estado, loja } = useLojaOwner(lojaId)
  const { showAlert, showConfirm } = useAppModal()
  const [rodada, setRodada] = useState<RodadaResumo | null>(null)
  const [lotes, setLotes] = useState<LotePainel[]>([])
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  // Lote a caminho do servidor: o Agendar espera (o banco serializa os dois
  // pela trava da rodada, mas agendar no meio recusaria o lote que o lojista
  // acabou de montar).
  const [enviandoLote, setEnviandoLote] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())

  // form da rodada
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [link, setLink] = useState('')

  const preencher = useCallback((r: RodadaResumo) => {
    setTitulo(r.titulo || '')
    setDescricao(r.descricao || '')
    const b = isoParaBrasilia(r.inicia_em)
    setData(b.data)
    setHora(b.hora)
    setLink(r.link_transmissao || '')
  }, [])

  const carregar = useCallback(async () => {
    try {
      const j = await chamarPainel<{ rodada: RodadaResumo; lotes: LotePainel[]; recebimento: Recebimento }>(
        `/api/lojas/${lojaId}/leiloes/${rodadaId}`
      )
      setRodada(j.rodada)
      setLotes(j.lotes || [])
      setRecebimento(j.recebimento)
      preencher(j.rodada)
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
      setAgora(Date.now())
    }
  }, [lojaId, rodadaId, preencher])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  // Relogio das pendencias (inicio >= agora + 10 min) sem recarregar a rodada.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Agendada e ja passou da hora: recarrega a cada 15s (aba visivel) ate o
  // tick do banco virar a rodada para ao_vivo e o painel ao vivo aparecer sem
  // o lojista atualizar a pagina.
  useEffect(() => {
    if (rodada?.status !== 'agendada' || !rodada.inicia_em) return
    const ini = Date.parse(rodada.inicia_em)
    const t = setInterval(() => {
      if (Date.now() >= ini && !document.hidden) carregar()
    }, 15_000)
    return () => clearInterval(t)
  }, [rodada?.status, rodada?.inicia_em, carregar])

  const editavel = rodada?.status === 'rascunho'
  const podeOrdenar = (rodada?.status === 'rascunho' || rodada?.status === 'agendada')
    && lotes.every(l => l.status === 'rascunho' || l.status === 'agendado')
  const podeCancelar = !!rodada && ['rascunho', 'agendada', 'ao_vivo'].includes(rodada.status)
    && lotes.every(l => ['rascunho', 'agendado', 'cancelado'].includes(l.status))

  const inicioISO = data || hora ? brasiliaParaISO(data, hora) : null
  const sujo = !!rodada && (
    titulo.trim() !== (rodada.titulo || '') ||
    descricao.trim() !== (rodada.descricao || '') ||
    link.trim() !== (rodada.link_transmissao || '') ||
    (inicioISO ?? null) !== (rodada.inicia_em ? new Date(rodada.inicia_em).toISOString() : null)
  )

  const pendencias = useMemo(() => {
    if (!rodada || !recebimento) return []
    const p = pendenciasAgendar(
      { iniciaEm: rodada.inicia_em, lotes: lotes.map(l => ({ fotos: l.fotos })), podeReceber: recebimento.podeReceber },
      agora
    )
    if (!recebimento.podeReceber && recebimento.motivo) {
      return p.map(x => (x.startsWith('Ative os recebimentos') ? recebimento.motivo! : x))
    }
    return p
  }, [rodada, lotes, recebimento, agora])

  async function salvarRodada() {
    if (!rodada) return
    if ((data || hora) && !inicioISO) { setErro('Data ou hora de início inválida.'); return }
    if (link.trim() && !linkValido(link.trim())) { setErro('Link da transmissão inválido. Use o endereço completo com https:// do YouTube, Instagram, Twitch ou TikTok.'); return }
    setOcupado(true)
    setErro(null)
    try {
      const j = await chamarPainel<{ rodada: RodadaResumo }>(`/api/lojas/${lojaId}/leiloes/${rodadaId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          inicia_em: inicioISO,
          link_transmissao: link.trim() || null,
        }),
      })
      setRodada(j.rodada)
      preencher(j.rodada)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function mover(idx: number, delta: -1 | 1) {
    const alvo = idx + delta
    if (alvo < 0 || alvo >= lotes.length || ocupado) return
    const antes = lotes
    const nova = [...lotes]
    ;[nova[idx], nova[alvo]] = [nova[alvo], nova[idx]]
    setLotes(nova.map((l, i) => ({ ...l, ordem: i + 1 })))
    setOcupado(true)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/${rodadaId}`, {
        method: 'POST',
        body: JSON.stringify({ acao: 'reordenar', ids: nova.map(l => l.id) }),
      })
    } catch (e) {
      setLotes(antes)
      setErro((e as Error).message)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  async function remover(l: LotePainel) {
    const ok = await showConfirm({
      message: `Remover "${l.card_name}" da rodada?`,
      description: 'As fotos enviadas deste lote também são apagadas.',
      confirmLabel: 'Remover', danger: true,
    })
    if (!ok) return
    setOcupado(true)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/${rodadaId}/lotes?lote_id=${l.id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function agendar() {
    if (!rodada?.inicia_em || enviandoLote) return
    const ok = await showConfirm({
      message: 'Agendar a rodada?',
      description: `Começa em ${horarioBrasilia(rodada.inicia_em)} com ${lotes.length} ${lotes.length === 1 ? 'lote' : 'lotes'}. Depois de agendada, os dados e os lotes não mudam mais; você ainda pode reordenar os lotes ou cancelar a rodada antes de ela começar.`,
      confirmLabel: 'Agendar',
    })
    if (!ok) return
    setOcupado(true)
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/${rodadaId}`, { method: 'POST', body: JSON.stringify({ acao: 'agendar' }) })
      await carregar()
      showAlert('Rodada agendada. Os lotes já aparecem na vitrine de leilões como "em breve".', 'success')
    } catch (e) {
      setErro((e as Error).message)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  async function cancelar() {
    const ok = await showConfirm({
      message: 'Cancelar a rodada inteira?',
      description: 'Todos os lotes são cancelados e saem da vitrine. Não dá para desfazer.',
      confirmLabel: 'Cancelar rodada', cancelLabel: 'Voltar', danger: true,
    })
    if (!ok) return
    setOcupado(true)
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/${rodadaId}`, { method: 'POST', body: JSON.stringify({ acao: 'cancelar' }) })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
      await carregar()
    } finally {
      setOcupado(false)
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const base = `/minha-loja/${lojaId}/leiloes`
  const st = rodada ? STATUS_RODADA[rodada.status] ?? STATUS_RODADA.rascunho : null
  const nomeRodada = rodada?.titulo || (rodada ? `Rodada #${rodada.numero}` : 'Rodada')

  return (
    <div style={SH.page}>
      <TrilhaLoja items={[
        LOJA_HOME,
        { name: loja.nome, href: `/minha-loja/${lojaId}` },
        { name: 'Leilões', href: base },
        { name: nomeRodada, href: `${base}/${rodadaId}` },
      ]} />

      {carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'var(--bx-text-3)' }}>Carregando…</div>
      ) : !rodada ? (
        <div style={{ ...SH.card, textAlign: 'center' }}>
          <p style={{ color: 'var(--bx-text-2)' }}>{erro || 'Rodada não encontrada.'}</p>
          <Link href={base} style={{ ...S.btnGhost, marginTop: 12 }}>Voltar para os leilões</Link>
        </div>
      ) : (
        <>
          <header style={SH.head}>
            <h1 style={{ ...SH.title, overflowWrap: 'anywhere' }}>{nomeRodada}</h1>
            <div style={S.sub}>
              {st && <span style={{ ...S.pill, color: st.cor }}>{st.label}</span>}
              {rodada.inicia_em && <span>{horarioBrasilia(rodada.inicia_em)}</span>}
            </div>
          </header>

          {erro && <div style={S.erro} role="alert">{erro}</div>}

          {(rodada.status === 'ao_vivo' || rodada.status === 'encerrada') && (
            <PainelAoVivo
              lojaId={lojaId}
              rodadaId={rodadaId}
              statusRodada={rodada.status}
              onStatusRodada={() => { carregar() }}
            />
          )}

          {/* ─── Dados da rodada ─── */}
          <section style={SH.card}>
            <h2 style={SH.cardH3}>Dados da rodada</h2>
            <label style={S.lbl} htmlFor="rd-titulo">Título</label>
            <input id="rd-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={80} disabled={!editavel} style={S.input} />

            <label style={S.lbl} htmlFor="rd-desc">Descrição (opcional)</label>
            <textarea
              id="rd-desc" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={1000} rows={3} disabled={!editavel}
              placeholder="O que vai rolar na live, regras de envio…" style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
            />

            <div style={S.two}>
              <div>
                <label style={S.lbl} htmlFor="rd-data">Data de início</label>
                <input id="rd-data" type="date" value={data} onChange={e => setData(e.target.value)} disabled={!editavel} style={S.input} />
              </div>
              <div>
                <label style={S.lbl} htmlFor="rd-hora">Hora (Brasília)</label>
                <input id="rd-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} disabled={!editavel} style={S.input} />
              </div>
            </div>

            <label style={S.lbl} htmlFor="rd-link">Link da transmissão (opcional)</label>
            <input
              id="rd-link" value={link} onChange={e => setLink(e.target.value)} maxLength={300} disabled={!editavel}
              placeholder="https://instagram.com/sualoja" inputMode="url" style={S.input}
            />
            <p style={S.hint}>Instagram, YouTube ou onde for a live. Aparece na página pública da rodada.</p>

            {editavel && (
              <button onClick={salvarRodada} disabled={ocupado || !sujo} style={{ ...S.btnPrim, width: '100%', marginTop: 14, opacity: ocupado || !sujo ? 0.55 : 1 }}>
                {sujo ? 'Salvar dados' : 'Dados salvos'}
              </button>
            )}
          </section>

          {/* ─── Lotes ─── */}
          <section style={SH.card}>
            <h2 style={SH.cardH3}>Lotes · {lotes.length}</h2>
            {lotes.length === 0 && !novoAberto && (
              <p style={{ ...S.hint, marginTop: 0 }}>Nenhum lote ainda. Cada lote é uma carta, com as fotos reais de frente e verso.</p>
            )}
            {lotes.length > 0 && (
              <div style={S.grade}>
                {lotes.map((l, i) => {
                  const lp = lotePublicoDeLinha(l as unknown as Record<string, unknown>)
                  return (
                    <CardItem
                      key={l.id}
                      card={cardDoLote(lp)}
                      mode="readonly"
                      hidePriceTable
                      ocultarSemPreco
                      badge={<span style={S.badge}>{i + 1}</span>}
                      footerSlot={
                        <div style={S.rodape}>
                          <div style={S.rodapeInfo}>
                            <span>Inicial {formatarBRL(l.lance_inicial_cents)}</span>
                            <span>{l.duracao_seg}s{l.condicao ? ` · ${l.condicao}` : ''}</span>
                          </div>
                          {(podeOrdenar || editavel) && (
                            <div style={S.acoes}>
                              {podeOrdenar && (
                                <>
                                  <button onClick={() => mover(i, -1)} disabled={ocupado || i === 0} style={S.btnIcone} aria-label="Subir lote">
                                    <IconArrowUp size={16} />
                                  </button>
                                  <button onClick={() => mover(i, 1)} disabled={ocupado || i === lotes.length - 1} style={S.btnIcone} aria-label="Descer lote">
                                    <IconArrowDown size={16} />
                                  </button>
                                </>
                              )}
                              {editavel && l.status === 'rascunho' && (
                                <button onClick={() => remover(l)} disabled={ocupado} style={{ ...S.btnIcone, ...S.btnPerigo }} aria-label="Remover lote">
                                  <IconTrash size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      }
                    />
                  )
                })}
              </div>
            )}

            {editavel && (
              novoAberto ? (
                <div style={{ marginTop: 14 }}>
                  <NovoLote
                    lojaId={lojaId}
                    rodadaId={rodadaId}
                    onCancelar={() => { setEnviandoLote(false); setNovoAberto(false) }}
                    onEnviando={setEnviandoLote}
                    onCriado={async () => { setNovoAberto(false); await carregar() }}
                  />
                </div>
              ) : (
                <button onClick={() => setNovoAberto(true)} style={{ ...S.btnGhost, width: '100%', marginTop: 14 }}>
                  <IconPlus size={16} /> Adicionar lote
                </button>
              )
            )}
          </section>

          {/* ─── Agendar / cancelar ─── */}
          {(editavel || podeCancelar) && (
            <section style={SH.card}>
              <h2 style={SH.cardH3}>{editavel ? 'Agendar' : 'Rodada'}</h2>
              {editavel && (
                <>
                  {sujo ? (
                    <p style={S.aviso}><IconWarning size={16} /> Salve os dados da rodada antes de agendar.</p>
                  ) : pendencias.length > 0 ? (
                    <ul style={S.lista}>
                      {pendencias.map(p => (
                        <li key={p} style={S.aviso}><IconWarning size={16} /> <span>{p}</span></li>
                      ))}
                    </ul>
                  ) : (
                    <p style={S.okMsg}><IconCheck size={16} /> Tudo pronto para agendar.</p>
                  )}
                  <button
                    onClick={agendar}
                    disabled={ocupado || enviandoLote || sujo || pendencias.length > 0}
                    style={{ ...S.btnPrim, width: '100%', marginTop: 12, opacity: ocupado || enviandoLote || sujo || pendencias.length > 0 ? 0.55 : 1 }}
                  >
                    {enviandoLote ? 'Salvando o lote…' : 'Agendar rodada'}
                  </button>
                </>
              )}
              {podeCancelar && (
                <button onClick={cancelar} disabled={ocupado} style={{ ...S.btnGhost, ...S.btnPerigoTexto, width: '100%', marginTop: 10 }}>
                  Cancelar rodada
                </button>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  sub: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: 'var(--bx-text-3)' },
  pill: {
    fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
    border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
  },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--bx-text-2)', marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, color: 'var(--bx-text-3)', marginTop: 6, lineHeight: 1.45 },
  input: {
    width: '100%', boxSizing: 'border-box', minHeight: 44, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    borderRadius: 9, padding: '10px 12px', fontSize: 16, color: 'var(--bx-text)', outline: 'none',
  },
  two: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))', gap: 10 },
  badge: { fontSize: 12, fontWeight: 800, color: 'var(--bx-text)', background: 'var(--bx-surface-3)', padding: '2px 8px', borderRadius: 6 },
  rodape: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 },
  rodapeInfo: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  acoes: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  btnIcone: {
    width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, color: 'var(--bx-text)', cursor: 'pointer',
  },
  btnPerigo: { color: 'var(--bx-red)', borderColor: 'color-mix(in srgb, var(--bx-red) 30%, transparent)', marginLeft: 'auto' },
  btnPerigoTexto: { color: 'var(--bx-red)', borderColor: 'color-mix(in srgb, var(--bx-red) 30%, transparent)' },
  btnPrim: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box',
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 0, cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
  },
  lista: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  aviso: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--bx-amber)', margin: 0, lineHeight: 1.4 },
  okMsg: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--bx-green)', margin: 0 },
  erro: {
    background: 'color-mix(in srgb, var(--bx-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-red) 25%, transparent)', color: 'var(--bx-red)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
  },
}
