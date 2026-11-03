'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import CardItem from '@/components/ui/CardItem'
import { useAppModal } from '@/components/ui/useAppModal'
import { IconArrowDown, IconArrowUp, IconCalendar, IconCheck, IconPlus, IconTag, IconTrash } from '@/components/ui/Icons'
import { Acoes, Aviso, Botao, Etapas, Resumo, Resumos, Rotulo, Selo, TelaEstado, Titulo } from '@/components/leilao/kit'
import { CSS_KIT } from '@/components/leilao/kit/estilos'
import { cardDoLote } from '@/components/leilao/cardDoLote'
import { formatarBRL, horarioBrasilia, lotePublicoDeLinha } from '@/lib/leilao'
import { brasiliaParaISO, isoParaBrasilia, linkValido, pendenciasAgendar } from '@/lib/leilao-painel'
import { useLojaOwner, LojaEstadoFallback, SH, LOJA_HOME, TrilhaLoja } from '../../_shared'
import { STATUS_RODADA, chamarPainel, type LotePainel, type RodadaResumo } from '../_rodada'
import NovoLote from './NovoLote'
import PainelAoVivo from './PainelAoVivo'
import LinkDivulgar from './LinkDivulgar'

/**
 * Editor de uma rodada ao vivo da loja.
 *
 * - Rascunho: assistente em 4 passos (informacoes, lotes, previa, publicar). Os
 *   dados salvam ao avancar; a conta (recebimentos, endereco) avisa desde o inicio.
 * - Dados da rodada: editaveis so em rascunho (agendada ja esta na vitrine).
 * - Lotes: subir/descer (rascunho e agendada, antes de abrir), remover e
 *   adicionar (so rascunho). A ordem vai inteira para a RPC de reordenar.
 * - Agendar: a tela lista as pendencias; o servidor confere de novo, sob trava.
 * - Cancelar: so enquanto nenhum lote abriu.
 */

interface Recebimento { podeReceber: boolean; motivo: string | null }

type Passo = 1 | 2 | 3 | 4
const PASSOS = ['Informações', 'Lotes', 'Prévia', 'Publicar']
const TITULOS: Record<Passo, string> = {
  1: 'Monte sua próxima live',
  2: 'Lotes da rodada',
  3: 'Como o público vê',
  4: 'Tudo certo para publicar?',
}

/** "08/11, 20:30": o horario completo nao cabe no bloco de resumo a 390 px. */
function inicioCurto(iso: string) {
  const b = isoParaBrasilia(iso)
  const [, mes, dia] = b.data.split('-')
  return `${dia}/${mes}, ${b.hora}`
}

export default function EditorRodada({ lojaId, rodadaId }: { lojaId: string; rodadaId: string }) {
  const { estado, loja } = useLojaOwner(lojaId)
  const { showAlert, showConfirm } = useAppModal()
  const [rodada, setRodada] = useState<RodadaResumo | null>(null)
  const [lotes, setLotes] = useState<LotePainel[]>([])
  const [recebimento, setRecebimento] = useState<Recebimento | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [enderecoOk, setEnderecoOk] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  // Lote a caminho do servidor: o Agendar espera (o banco serializa os dois
  // pela trava da rodada, mas agendar no meio recusaria o lote que o lojista
  // acabou de montar).
  const [enviandoLote, setEnviandoLote] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [passo, setPasso] = useState<Passo>(1)
  const passoIniciado = useRef(false)

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
      const j = await chamarPainel<{ rodada: RodadaResumo; lotes: LotePainel[]; recebimento: Recebimento; enderecoOk?: boolean }>(
        `/api/lojas/${lojaId}/leiloes/${rodadaId}`
      )
      setRodada(j.rodada)
      setLotes(j.lotes || [])
      setRecebimento(j.recebimento)
      setEnderecoOk(j.enderecoOk !== false)
      preencher(j.rodada)
      setErro(null)
      // Rascunho retomado com horario definido volta direto para os lotes.
      if (!passoIniciado.current) {
        passoIniciado.current = true
        if (j.rodada.inicia_em) setPasso(2)
      }
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
  // A rota de agendar recusa sem endereco: a tela nao pode dizer "Tudo pronto".
  const bloqueado = pendencias.length > 0 || !enderecoOk

  async function salvarRodada(): Promise<boolean> {
    if (!rodada) return false
    if ((data || hora) && !inicioISO) { setErro('Data ou hora de início inválida.'); return false }
    if (link.trim() && !linkValido(link.trim())) { setErro('Link da transmissão inválido. Use o endereço completo com https:// do YouTube, Instagram, Twitch ou TikTok.'); return false }
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
      return true
    } catch (e) {
      setErro((e as Error).message)
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function irPara(n: Passo) {
    // O erro aparece no topo: sem subir, o botao fica longe dele no celular.
    if (sujo && !(await salvarRodada())) { window.scrollTo(0, 0); return }
    setErro(null)
    setPasso(n)
    window.scrollTo(0, 0)
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
      message: 'Publicar a rodada?',
      description: `Começa em ${horarioBrasilia(rodada.inicia_em)} com ${lotes.length} ${lotes.length === 1 ? 'lote' : 'lotes'}. Depois de publicada, os dados e os lotes não mudam mais; você ainda pode reordenar os lotes ou cancelar a rodada antes de ela começar.`,
      confirmLabel: 'Publicar',
    })
    if (!ok) return
    setOcupado(true)
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/${rodadaId}`, { method: 'POST', body: JSON.stringify({ acao: 'agendar' }) })
      await carregar()
      showAlert('Rodada publicada. Os lotes já aparecem na vitrine de leilões como "em breve".', 'success')
    } catch (e) {
      // Nesta ordem: carregar() limpa o erro quando da certo, e a mensagem sumia.
      await carregar()
      setErro((e as Error).message)
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
  const faltasRodada = pendencias.filter(p => p !== recebimento?.motivo && !p.startsWith('Ative os recebimentos'))
  const grade = (
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
  )

  return (
    <div style={{ ...SH.page, fontFamily: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif" }}>
      <style>{CSS_KIT}</style>
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
      ) : editavel ? (
        <div style={S.corpo}>
          <Titulo rotulo={`Rodada #${rodada.numero} · Rascunho`} titulo={TITULOS[passo]} />
          <Etapas
            direcao="h"
            itens={PASSOS.map((t, i) => ({ titulo: t, estado: i + 1 < passo ? 'feito' : i + 1 === passo ? 'atual' : 'futuro' }))}
          />

          {erro && <Aviso tom="perigo">{erro}</Aviso>}
          {recebimento && !recebimento.podeReceber && (
            <Aviso tom="atencao" titulo="Recebimentos pendentes">
              {recebimento.motivo || 'Ative para receber pelos arremates.'}
              <Botao tipo="leve" href={`/minha-loja/${lojaId}/pagamentos`}>Abrir Pagamentos</Botao>
            </Aviso>
          )}
          {!enderecoOk && (
            <Aviso tom="atencao" titulo="Falta o endereço para devoluções">
              <Botao tipo="leve" href={`/minha-loja/${lojaId}/vitrine`}>Cadastrar endereço</Botao>
            </Aviso>
          )}

          {passo === 1 && (
            <div className="lk-assist">
              <section className="lk-card">
                <div>
                  <label style={{ ...S.lbl, marginTop: 0 }} htmlFor="rd-titulo">Nome da rodada</label>
                  <input id="rd-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={80} style={S.input} />

                  <label style={S.lbl} htmlFor="rd-desc">Descrição curta (opcional)</label>
                  <textarea
                    id="rd-desc" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={1000} rows={2}
                    placeholder="Singles, vintage, o que vai rolar na live" style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
                  />

                  <div style={S.two}>
                    <div>
                      <label style={S.lbl} htmlFor="rd-data">Data</label>
                      <input id="rd-data" type="date" value={data} onChange={e => setData(e.target.value)} style={S.input} />
                    </div>
                    <div>
                      <label style={S.lbl} htmlFor="rd-hora">Hora (Brasília)</label>
                      <input id="rd-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} style={S.input} />
                    </div>
                  </div>

                  <label style={S.lbl} htmlFor="rd-link">Link da live (opcional)</label>
                  <input
                    id="rd-link" value={link} onChange={e => setLink(e.target.value)} maxLength={300}
                    placeholder="https://instagram.com/sualoja" inputMode="url" style={S.input}
                  />
                </div>
              </section>
              <aside className="lk-card">
                <Rotulo fraco>Como aparece</Rotulo>
                <span style={S.previaData}>{inicioISO ? horarioBrasilia(inicioISO) : 'Sem horário definido'}</span>
                <b style={S.previaTitulo}>{titulo.trim() || 'Nome da rodada'}</b>
                {descricao.trim() && <span style={S.previaDesc}>{descricao.trim()}</span>}
                <Selo tom="acento">Agendada</Selo>
                <span style={S.previaNota}>Nada fica visível até você publicar.</span>
              </aside>
            </div>
          )}

          {passo === 2 && (
            <>
              {lotes.length > 0 && grade}
              {novoAberto ? (
                <NovoLote
                  lojaId={lojaId}
                  rodadaId={rodadaId}
                  onCancelar={() => { setEnviandoLote(false); setNovoAberto(false) }}
                  onEnviando={setEnviandoLote}
                  onCriado={async () => { setNovoAberto(false); await carregar() }}
                />
              ) : lotes.length === 0 ? (
                <TelaEstado
                  icone={<IconTag size={38} />}
                  titulo="Comece pelo primeiro lote"
                  texto="Cada lote é uma carta, com fotos reais de frente e verso."
                  acoes={<Botao cheio onClick={() => setNovoAberto(true)}><IconPlus size={16} /> Adicionar lote</Botao>}
                />
              ) : (
                <Botao tipo="sec" cheio onClick={() => setNovoAberto(true)}><IconPlus size={16} /> Adicionar lote</Botao>
              )}
            </>
          )}

          {passo === 3 && (
            <>
              <section className="lk-card lk-card-d">
                <div className="lk-card-t">
                  <Rotulo>{loja.nome} · Rodada ao vivo</Rotulo>
                  <Selo tom="atencao">Não publicada</Selo>
                </div>
                <h2 style={S.previaHero}>{nomeRodada}</h2>
                {rodada.descricao && <p style={S.previaDesc}>{rodada.descricao}</p>}
                <div style={S.previaMeta}>
                  <span style={S.previaItem}><IconTag size={15} /> {lotes.length} {lotes.length === 1 ? 'lote' : 'lotes'}</span>
                  <span style={S.previaItem}><IconCalendar size={15} /> {rodada.inicia_em ? horarioBrasilia(rodada.inicia_em) : 'Sem horário definido'}</span>
                </div>
              </section>
              {lotes.length > 0 && (
                <>
                  <Rotulo fraco>Na fila da rodada</Rotulo>
                  <div style={S.grade}>
                    {lotes.map(l => (
                      <CardItem
                        key={l.id}
                        card={cardDoLote(lotePublicoDeLinha(l as unknown as Record<string, unknown>))}
                        mode="readonly"
                        hidePriceTable
                        ocultarSemPreco
                        footerSlot={<span style={S.rodapeInfo}>A partir de {formatarBRL(l.lance_inicial_cents)}</span>}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {passo === 4 && (
            <>
              <Resumos>
                <Resumo rotulo="Lotes" valor={String(lotes.length)} />
                <Resumo rotulo="Início" valor={rodada.inicia_em ? inicioCurto(rodada.inicia_em) : 'A definir'} meta={rodada.inicia_em ? 'Brasília' : undefined} />
              </Resumos>
              {faltasRodada.map(p => (
                <Aviso key={p} tom="atencao">
                  {p}
                  <Botao tipo="leve" onClick={() => irPara(/lote/i.test(p) ? 2 : 1)}>Ajustar</Botao>
                </Aviso>
              ))}
              {!bloqueado && <Aviso tom="frente" icone={<IconCheck size={17} />}>Tudo pronto para publicar.</Aviso>}
              <Botao cheio onClick={agendar} disabled={ocupado || enviandoLote || bloqueado}>
                {enviandoLote ? 'Salvando o lote…' : 'Publicar rodada'}
              </Botao>
            </>
          )}

          {!novoAberto && (
            <div style={S.navega}>
              {passo < 4 && (
                <Acoes linha>
                  {/* Sem lote nao ha o que prever: o botao da tela e o de adicionar. */}
                  {(passo !== 2 || lotes.length > 0) && (
                    <Botao cheio onClick={() => irPara((passo + 1) as Passo)} disabled={ocupado}>
                      {passo === 1 ? 'Continuar para lotes' : passo === 2 ? 'Ver prévia' : 'Revisar e publicar'}
                    </Botao>
                  )}
                  {passo > 1 && <Botao tipo="sec" cheio onClick={() => irPara((passo - 1) as Passo)} disabled={ocupado}>Voltar</Botao>}
                </Acoes>
              )}
              {passo === 4 && <Botao tipo="sec" cheio onClick={() => irPara(3)} disabled={ocupado}>Voltar</Botao>}
              {podeCancelar && (
                <button type="button" onClick={cancelar} disabled={ocupado} style={S.cancelar}>Cancelar rodada</button>
              )}
            </div>
          )}
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

          {(rodada.status === 'agendada' || rodada.status === 'ao_vivo') && <LinkDivulgar numero={rodada.numero} />}

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
            <input id="rd-titulo" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={80} disabled style={S.input} />

            <label style={S.lbl} htmlFor="rd-desc">Descrição (opcional)</label>
            <textarea
              id="rd-desc" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={1000} rows={3} disabled
              placeholder="O que vai rolar na live, regras de envio…" style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
            />

            <div style={S.two}>
              <div>
                <label style={S.lbl} htmlFor="rd-data">Data de início</label>
                <input id="rd-data" type="date" value={data} onChange={e => setData(e.target.value)} disabled style={S.input} />
              </div>
              <div>
                <label style={S.lbl} htmlFor="rd-hora">Hora (Brasília)</label>
                <input id="rd-hora" type="time" value={hora} onChange={e => setHora(e.target.value)} disabled style={S.input} />
              </div>
            </div>

            <label style={S.lbl} htmlFor="rd-link">Link da transmissão (opcional)</label>
            <input
              id="rd-link" value={link} onChange={e => setLink(e.target.value)} maxLength={300} disabled
              placeholder="https://instagram.com/sualoja" inputMode="url" style={S.input}
            />
            <p style={S.hint}>Instagram, YouTube ou onde for a live. Aparece na página pública da rodada.</p>

          </section>

          {/* ─── Lotes ─── */}
          <section style={SH.card}>
            <h2 style={SH.cardH3}>Lotes · {lotes.length}</h2>
            {lotes.length > 0 && grade}

          </section>

          {/* ─── Cancelar ─── */}
          {podeCancelar && (
            <section style={SH.card}>
              <h2 style={SH.cardH3}>Rodada</h2>
              <button onClick={cancelar} disabled={ocupado} style={{ ...S.btnGhost, ...S.btnPerigoTexto, width: '100%' }}>
                Cancelar rodada
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  corpo: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 },
  previaData: { fontSize: 13, fontWeight: 600, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  previaTitulo: { fontSize: 20, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.015em', color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  previaDesc: { margin: 0, fontSize: 14, lineHeight: 1.45, color: 'var(--bx-text-2)', overflowWrap: 'anywhere' },
  previaNota: { fontSize: 12, color: 'var(--bx-text-3)' },
  previaHero: { margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  previaMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13, color: 'var(--bx-text-2)' },
  previaItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' },
  navega: { display: 'flex', flexDirection: 'column', gap: 10 },
  cancelar: { minHeight: 44, background: 'none', border: 0, color: 'var(--bx-red)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },
  sub: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: 13, color: 'var(--bx-text-3)' },
  pill: {
    fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
    border: '1px solid var(--bx-border-2)', background: 'var(--bx-surface-2)',
  },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--bx-text-2)', marginBottom: 6, marginTop: 12 },
  hint: { fontSize: 12, color: 'var(--bx-text-3)', marginTop: 6, lineHeight: 1.45 },
  input: {
    width: '100%', boxSizing: 'border-box', minHeight: 44, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    borderRadius: 9, padding: '10px 12px', fontSize: 16, color: 'var(--bx-text)', outline: 'none', colorScheme: 'dark',
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
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, boxSizing: 'border-box',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
  },
  erro: {
    background: 'color-mix(in srgb, var(--bx-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-red) 25%, transparent)', color: 'var(--bx-red)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
  },
}
