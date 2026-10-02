'use client'

// Relatorio de bancada: o documento A4 que volta dentro da caixa.
//
// Componente puro: recebe RelatorioDados (o mesmo formato do futuro snapshot
// da F2) e desenha as paginas. Paginacao MEDIDA, nunca por corte: cada bloco
// (secao, procedimento, fileira de fotos, tabela) e renderizado num medidor
// invisivel com a largura util da pagina, a altura e lida no DOM e os blocos
// sao empilhados ate a area util acabar; o que nao cabe abre pagina nova. Bloco
// nunca parte. Se um bloco sozinho passa da pagina, a pagina e marcada e o
// estado devolvido traz o numero dela (quem imprime trava o botao).
//
// Cor so por token: o documento vive dentro de [data-theme="light"] (o bloco
// claro do globals.css) e as faixas escuras de marca usam --ink*, capturados
// dos tokens escuros do :root ANTES de entrar no escopo claro.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  SERVICOS, ESCALA, PILARES, DANOS, IDENTIFICACAO, RISCOS, GRADUADORAS, compararCentralizacao, OBJETIVOS, ALERTA_GRADUACAO,
  CUSTODIA, CUSTODIA_PRE_GRADING, FOTOS_ENTRADA, FOTOS_SAIDA, brl, compararFicha, fmtDataHoraAnoBRT, fmtDataAnoBRT,
  type FichaCondicao,
} from '@/lib/servicos'
import {
  GUARDA_RECOMENDADA, GUARDA_PRENSA, GUARDA_GRADUADORA,
  type RelatorioDados, type RelatorioCarta, type RelatorioFoto, type RelatorioPagamento,
} from '@/lib/servicosRelatorio'
import { IconCheck, IconClose, IconWarning } from '@/components/ui/Icons'

// ── Geometria (mm) ──────────────────────────────────────────────────────────
const MM = 96 / 25.4
/** 297 - 24 (faixa do cabecalho + respiro) - 20 (margem de baixo com o rodape). */
const UTIL_MM = 253
/** Capa nao tem cabecalho corrido: a faixa de marca faz parte do miolo. */
const UTIL_CAPA_MM = 277
const GAP_MM = 5

export interface EstadoImpressao {
  /** Paginacao medida e pronta. */
  pronto: boolean
  paginas: number
  /** Numeros (1..N) das paginas em que o conteudo passou da area util. */
  estouro: number[]
  fotos: 'carregando' | 'ok' | 'erro'
}

const dt = (iso: string | null | undefined) => (iso ? fmtDataHoraAnoBRT.format(iso) : '')
const reais = (c: number) => `R$ ${brl(c / 100)}`
const rotuloEscala = (id: string | null) => (id ? ESCALA.find(e => e.id === id)?.rotulo || id : 'Sem registro')
const rotuloPilar = (id: string) => PILARES.find(p => p.id === id)?.rotulo || id
const rotuloDano = (id: string) => DANOS.find(d => d.id === id)?.rotulo || id
const LADO: Record<string, string> = { frente: 'Frente', verso: 'Verso' }

function juntar(xs: string[]) {
  if (xs.length <= 1) return xs.join('')
  return `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`
}

const SUBTITULO: Record<string, string> = {
  restauracao: 'Restauração · laudo de bancada',
  pre_grading: 'Pré-grading',
  completo: 'Restauração + pré-grading',
}

// No medidor as fotos nao carregam: a moldura tem proporcao fixa, entao a
// altura nao depende da imagem.
const MedindoCtx = createContext(false)

// ── Pecas ───────────────────────────────────────────────────────────────────

function Regua() {
  const tracos = Array.from({ length: 64 }, (_, i) => i)
  return (
    <svg className="regua" viewBox="-1 -0.2 65 5.2" role="img" aria-label="Régua de 6 cm">
      <line x1="0" y1="0" x2="63" y2="0" stroke="currentColor" strokeWidth=".25" />
      {tracos.map(i => (
        <line key={i} x1={i} y1="0" x2={i} y2={i % 10 === 0 ? 2.2 : i % 5 === 0 ? 1.6 : 1} stroke="currentColor" strokeWidth=".18" />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map(n => (
        <text key={n} x={n * 10} y="4.6" fontSize="2" textAnchor="middle" className="regua-n">{n}</text>
      ))}
      <text x="63" y="4.6" fontSize="2" textAnchor="end" className="regua-n">cm</text>
    </svg>
  )
}

function Foto({ foto, ratio, legenda, vazio, alt }: {
  foto?: RelatorioFoto; ratio: 'r57' | 'r11' | 'r31' | 'r43'; legenda: string; vazio: string; alt: string
}) {
  const medindo = useContext(MedindoCtx)
  return (
    <figure className={`foto ${ratio}`}>
      {foto ? (
        <div className="ph ph-img">
          {/* eslint-disable-next-line @next/next/no-img-element -- bucket privado por URL assinada; next/image nao serve */}
          {!medindo && foto.url && <img src={foto.url} alt={alt} />}
          {!medindo && !foto.url && <span data-sem-url>Foto indisponível. Recarregue as fotos.</span>}
        </div>
      ) : (
        <div className="ph ph-vazio"><span>{vazio}</span></div>
      )}
      <figcaption>{legenda}</figcaption>
    </figure>
  )
}

function FotoReal({ foto, alt }: { foto?: RelatorioFoto; alt: string }) {
  const medindo = useContext(MedindoCtx)
  return (
    <div className={`real${foto ? '' : ' real-vazio'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- bucket privado por URL assinada */}
      {foto?.url && !medindo ? <img src={foto.url} alt={alt} /> : foto && !medindo ? <span data-sem-url>Foto indisponível</span> : <span>{foto ? '' : 'Sem registro'}</span>}
    </div>
  )
}

function SecT({ rot, leg, semMarca }: { rot: string; leg?: ReactNode; semMarca?: boolean }) {
  return (
    <div className="sec-t">
      <span className={`rot${semMarca ? ' sem-marca' : ''}`}>{rot}</span>
      {leg && <span className="leg num">{leg}</span>}
    </div>
  )
}

function Kv({ l, children }: { l: string; children: ReactNode }) {
  return <div className="kv"><span className="kv-l">{l}</span>{children}</div>
}

// ── Blocos ──────────────────────────────────────────────────────────────────

interface Bloco {
  k: string
  node: ReactNode
  /** Abre pagina nova antes deste bloco. */
  quebra?: boolean
  /** A pagina aberta por este bloco e capa (sem cabecalho corrido). */
  capa?: boolean
  /** Rotulo da secao, para o "continuacao" quando ela passa de pagina. */
  secao?: string
  letra?: string
  /** 1..N entre as cartas aceitas; ausente em fechamento e termos. */
  carta?: number
  custodia?: string | null
  /** Rotulo fixo do cabecalho (fechamento, termos). */
  cab?: string
}

function fotoDe(c: RelatorioCarta, tipo: string, posicao: string) {
  return c.fotos.find(f => f.tipo === tipo && f.posicao === posicao)
}

function contagem(c: RelatorioCarta, comSaida: boolean) {
  const slots = comSaida ? [...FOTOS_ENTRADA, ...FOTOS_SAIDA] : FOTOS_ENTRADA
  const tem = slots.filter(s => fotoDe(c, s.tipo, s.posicao)).length
  const rasante = c.fotos.some(f => f.tipo === 'entrada_rasante' || (comSaida && f.tipo === 'saida_rasante'))
  return `${tem} de ${slots.length} fotos do protocolo${comSaida ? '' : ' de entrada'}${rasante ? ', mais as de luz rasante' : ''}.`
}

function montarBlocos(d: RelatorioDados): Bloco[] {
  const p = d.pedido
  const tipo = p.servico
  const devolvida = p.status === 'devolvida_sem_servico'
  const aceitas = d.cartas.filter(c => c.aceito)
  const nomeServico = SERVICOS.find(s => s.id === tipo)?.nome || 'Serviço'
  const titulo = devolvida ? 'de devolução' : 'de bancada'
  const blocos: Bloco[] = []

  aceitas.forEach((c, idx) => {
    const k = `c${idx}`
    const carta = idx + 1
    const base = { carta, custodia: c.custodia }
    const aprovados = c.procedimentos.filter(x => x.decisao === 'aprovado')
    const recusados = c.procedimentos.filter(x => x.decisao === 'recusado')
    const tratada = !devolvida && tipo !== 'pre_grading' && aprovados.length > 0
    const comSaida = tratada && !!c.fichaSaida
    const comLaudo = !devolvida && tipo !== 'restauracao'
    const comProposta = !devolvida && tipo !== 'pre_grading'
    const linhasFicha = compararFicha(c.fichaEntrada, comSaida ? c.fichaSaida : null)
    const ident = c.fichaEntrada?.identificacao || {}
    const frenteCh = fotoDe(c, 'entrada_difusa', 'frente')
    const frenteSa = fotoDe(c, 'saida_difusa', 'frente')

    // Letras geradas pelas secoes presentes, sem buraco.
    const secoes: string[] = ['ident', 'ficha']
    if (comLaudo && tipo === 'pre_grading') secoes.push('laudo')
    if (comProposta) secoes.push('proposta')
    secoes.push('fotos')
    if (comLaudo && tipo === 'completo') secoes.push('laudo')
    const L = (s: string) => String.fromCharCode(65 + secoes.indexOf(s))

    // ── Capa ──
    const melhorou = linhasFicha.filter(l => l.variacao === 'melhorou').map(l => `${rotuloPilar(l.pilar).toLowerCase()} (${LADO[l.lado].toLowerCase()})`)
    const piorou = linhasFicha.filter(l => l.variacao === 'piorou').map(l => `${rotuloPilar(l.pilar).toLowerCase()} (${LADO[l.lado].toLowerCase()})`)
    const condicao = comSaida
      ? [
        melhorou.length ? `Melhorou: ${juntar(melhorou)}.` : 'Sem variação entre chegada e saída.',
        piorou.length ? `Piorou: ${juntar(piorou)}.` : '',
        recusados.length ? `${recusados.length === 1 ? 'Um procedimento foi recusado' : `${recusados.length} procedimentos foram recusados`} por você.` : '',
      ].filter(Boolean).join(' ')
      : 'Condição registrada na chegada, sem intervenção na carta.'

    const datas: [string, string | null, boolean][] = [
      ['Pedido', p.criadoEm, true],
      ...(tipo === 'pre_grading' ? [['Aceito', d.marcos.aceito || null, false] as [string, string | null, boolean]] : []),
      ['Recebida', d.marcos.recebida || null, false],
      ...(comProposta ? [['Proposta aceita', p.propostaAceitaEm, false] as [string, string | null, boolean]] : []),
      ...(!devolvida ? [['Em bancada', d.marcos.em_bancada || null, false] as [string, string | null, boolean]] : []),
      devolvida ? ['Devolvida', d.marcos.devolvida_sem_servico || null, false] : ['Pronta', d.marcos.pronta || null, false],
    ]
    const datasOk = datas.filter(x => x[1])

    blocos.push({
      ...base, k: `${k}-capa-topo`, quebra: true, capa: true,
      node: (
        <div className="topo">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo local, sem otimizacao no papel */}
            <img className="logo-capa" src="/logo_BYNX.png" alt="Bynx" />
            <div className="rot sem-marca marca-sub">Bancada Bynx</div>
          </div>
          <div className="selo">
            <div>
              <div className="l">CUSTÓDIA</div>
              <div className="cod num">{c.custodia || 'Sem custódia'}</div>
              <div className="l num">Pedido {p.numero}</div>
            </div>
          </div>
        </div>
      ),
    })
    blocos.push({
      ...base, k: `${k}-capa-titulo`,
      node: (
        <div className="titulo">
          <h1>Relatório <span className="g">{titulo}</span></h1>
          <div className="sub">{SUBTITULO[tipo]}</div>
          <div className="carta-id">
            <b>{c.nome}</b>
            {IDENTIFICACAO.filter(x => x.k !== 'serie' && ident[x.k]).map(x => <span key={x.k}> · {ident[x.k]}</span>)}
          </div>
        </div>
      ),
    })
    blocos.push({
      ...base, k: `${k}-capa-fotos`,
      node: (
        <div className="capa-fotos">
          <div className="par-real">
            <div className="rot2">Chegada {frenteCh && <span className="num">· {dt(frenteCh.em)}</span>}</div>
            <FotoReal foto={frenteCh} alt={`${c.nome}, frente na chegada`} />
            <Regua />
          </div>
          {comSaida ? (
            <div className="par-real">
              <div className="rot2">Saída {frenteSa && <span className="num">· {dt(frenteSa.em)}</span>}</div>
              <FotoReal foto={frenteSa} alt={`${c.nome}, frente na saída`} />
              <div className="leg" style={{ width: '63mm' }}>Tamanho real quando impresso em 100%. Confira: a régua ao lado deve medir 6 cm. Mesma luz difusa e mesmo enquadramento.</div>
            </div>
          ) : (
            <div className="capa-nota">
              <span className="tag forte">{tipo === 'pre_grading' && !devolvida ? 'Examinada, sem intervenção' : 'Devolvida sem intervenção'}</span>
              <div className="leg">
                {tipo === 'pre_grading' && !devolvida
                  ? 'No pré-grading a carta é medida e fotografada. Nada é tratado, então não há foto de saída: a condição da chegada é a condição da volta.'
                  : 'Nenhum procedimento foi realizado. A carta volta na condição da chegada.'}
              </div>
              <div className="leg">Tamanho real quando impresso em 100%. Confira: a régua abaixo da foto deve medir 6 cm.</div>
            </div>
          )}
          <dl className="resumo">
            <dt>{comSaida ? 'Condição' : 'Condição na chegada'}</dt>
            <dd>{condicao}</dd>
            {comProposta && c.procedimentos.length > 0 && (
              <>
                <dt>Procedimentos</dt>
                <dd>
                  <b>{aprovados.length} {aprovados.length === 1 ? 'aprovado' : 'aprovados'}</b>
                  {recusados.length > 0 && <>, {recusados.length} {recusados.length === 1 ? 'recusado' : 'recusados'} por você</>}.
                </dd>
              </>
            )}
            {comLaudo && c.laudo?.faixa && (
              <>
                <dt>Faixa provável</dt>
                <dd><b className="num">{c.laudo.faixa.texto}</b><br /><span className="leg">Estimativa, não é nota.</span></dd>
              </>
            )}
            {comLaudo && c.laudo?.graduadora && (<><dt>Graduadora recomendada</dt><dd><b>{c.laudo.graduadora}</b></dd></>)}
            {comLaudo && c.laudo?.proximoPasso && (<><dt>Próximo passo</dt><dd><b>{c.laudo.proximoPasso}</b></dd></>)}
          </dl>
        </div>
      ),
    })
    if (datasOk.length) {
      blocos.push({
        ...base, k: `${k}-capa-datas`,
        node: (
          <div className="datas num" style={{ gridTemplateColumns: `repeat(${datasOk.length}, minmax(0, 1fr))` }}>
            {datasOk.map(([r, iso, soData]) => <div key={r}><span>{r}</span><b>{soData ? fmtDataAnoBRT.format(iso!) : dt(iso)}</b></div>)}
          </div>
        ),
      })
    }
    blocos.push({
      ...base, k: `${k}-capa-meta`,
      node: (
        <div className="meta">
          <Kv l="Cliente">{p.cliente}</Kv>
          {p.objetivo && <Kv l="Objetivo">{p.objetivo}</Kv>}
          {p.graduadoraAlvo && <Kv l="Graduadora pretendida">{p.graduadoraAlvo}</Kv>}
          <Kv l="Prazo">{p.prazo === 'expresso' ? 'Expresso' : 'Padrão'}</Kv>
          <Kv l="Cartas no pedido">{d.cartas.length}</Kv>
          <Kv l="Serviço">{nomeServico}</Kv>
          {tratada && d.descanso && <Kv l="Descanso após a prensa">{d.descanso.dias < 1 ? 'Menos de 1 dia' : `${d.descanso.dias} ${d.descanso.dias === 1 ? 'dia' : 'dias'}`}</Kv>}
          <Kv l="Horários">Brasília</Kv>
        </div>
      ),
    })
    if (d.cartas.length > 1) {
      blocos.push({
        ...base, k: `${k}-capa-cartas`,
        node: (
          <div className="sec">
            <SecT rot="Cartas deste pedido" semMarca />
            <table>
              <thead><tr><th>#</th><th>Carta</th><th>Custódia</th><th>Situação</th></tr></thead>
              <tbody>
                {d.cartas.map((x, i) => (
                  <tr key={i} className={x === c ? 'atual' : ''}>
                    <td className="num">{i + 1}</td>
                    <td>{x === c ? <b>{x.nome}</b> : x.nome}</td>
                    <td className="num">{x.custodia || '—'}</td>
                    <td>{x.aceito ? (x === c ? 'Este relatório' : 'Relatório próprio') : `Não aceita no orçamento${x.recusaMotivo ? `: ${x.recusaMotivo}` : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      })
    }
    blocos.push({
      ...base, k: `${k}-capa-aviso`,
      node: (
        <div className="caixa-aviso">
          <IconWarning size={17} color="currentColor" strokeWidth={1.8} style={{ flex: 'none' }} />
          <div>
            <b>Este relatório não é certificado de graduação nem de autenticidade.</b>{' '}
            {comLaudo ? 'A faixa provável é uma estimativa. A nota final é atribuída exclusivamente pela graduadora. ' : ''}
            O documento descreve a carta na data de emissão.
          </div>
        </div>
      ),
    })

    // ── A. Identificacao e queixa ──
    const objGrad = p.objetivo === OBJETIVOS.find(o => o.id === 'graduacao')?.rotulo
    blocos.push({
      ...base, k: `${k}-ident`, quebra: true, letra: L('ident'), secao: `${L('ident')}. Identificação e queixa`,
      node: (
        <div className="sec">
          <SecT rot={`${L('ident')}. Identificação e queixa`} />
          <div className="grid2">
            <Kv l="Carta"><b>{c.nome}</b></Kv>
            <Kv l="Custódia"><b className="num">{c.custodia || '—'}</b></Kv>
            {IDENTIFICACAO.filter(x => ident[x.k]).map(x => <Kv key={x.k} l={x.rotulo}><span className="num">{ident[x.k]}</span></Kv>)}
            <Kv l="Queixa informada">{c.queixas.length ? c.queixas.join(' · ') : 'Nenhuma'}</Kv>
            <Kv l="Valor declarado"><span className="num">{reais(c.valorDeclaradoCents)}</span></Kv>
            {c.obs && <Kv l="Observação do cliente">“{c.obs}”</Kv>}
          </div>
          {p.objetivo && (
            <div className="painel">
              <b>Objetivo: {p.objetivo.charAt(0).toLowerCase() + p.objetivo.slice(1)}.</b>{' '}
              {tipo === 'pre_grading' ? 'A carta foi apenas examinada; nenhuma intervenção foi realizada.' : objGrad ? ALERTA_GRADUACAO : ''}
            </div>
          )}
        </div>
      ),
    })

    // ── B. Ficha de condicao ──
    const secFicha = `${L('ficha')}. Ficha de condição`
    blocos.push({
      ...base, k: `${k}-ficha`, letra: L('ficha'), secao: secFicha,
      node: (
        <div className="sec">
          <SecT
            rot={secFicha}
            leg={comSaida
              ? `Chegada registrada em ${dt(c.fichaEntradaEm)} · Saída registrada em ${dt(c.fichaSaidaEm)}`
              : c.fichaEntradaEm ? `Condição registrada na chegada, em ${dt(c.fichaEntradaEm)}` : 'Condição registrada na chegada'}
          />
          {c.fichaEntrada ? <TabelaFicha entrada={c.fichaEntrada} saida={comSaida ? c.fichaSaida : null} /> : <p>Ficha de entrada não registrada.</p>}
          <div className="leg">
            Escala textual: {ESCALA.map(e => e.rotulo).join(', ')}. Não é nota de graduação.{comSaida ? ' Melhora em negrito.' : ''}
            {!comSaida && tipo === 'pre_grading' && !devolvida ? ' A carta foi apenas examinada; nenhuma intervenção foi realizada.' : ''}
          </div>
        </div>
      ),
    })
    blocos.push({
      ...base, k: `${k}-danos`, letra: L('ficha'), secao: secFicha,
      node: <Danos entrada={c.fichaEntrada} saida={comSaida ? c.fichaSaida : null} />,
    })
    const obsCh = c.fichaEntrada?.observacao?.trim()
    const obsSa = comSaida ? c.fichaSaida?.observacao?.trim() : ''
    if (obsCh || obsSa) {
      blocos.push({
        ...base, k: `${k}-obs`, letra: L('ficha'), secao: secFicha,
        node: (
          <div className="sec">
            <SecT rot="Observação da ficha" />
            {obsCh && <p>{obsSa ? <b>Na chegada. </b> : null}{obsCh}</p>}
            {obsSa && <p><b>Na saída. </b>{obsSa}</p>}
          </div>
        ),
      })
    }

    // ── Laudo (pre-grading: logo apos a ficha) ──
    const blocosLaudo = (): Bloco[] => {
      const secL = `${L('laudo')}. Laudo de pré-grading`
      const fotoC = comSaida ? frenteSa : frenteCh
      const la = c.laudo
      const leg = tipo === 'completo' ? 'Medido após o tratamento' : undefined
      if (!la) {
        return [{
          ...base, k: `${k}-laudo`, quebra: true, letra: L('laudo'), secao: secL,
          node: <div className="sec"><SecT rot={secL} leg={leg} /><p>{c.laudoAnexo ? 'Laudo anexo (entregue em arquivo separado).' : 'Laudo não registrado.'}</p></div>,
        }]
      }
      const quando = GRADUADORAS.find(g => g.nome === la.graduadora)?.quando
      const limite = compararCentralizacao(la.graduadora, la.centralizacaoFrente, la.centralizacaoVerso)
      const lo = la.faixa ? Math.floor(la.faixa.min) : 0
      const hi = la.faixa ? Math.ceil(la.faixa.max) : 0
      return [
        {
          ...base, k: `${k}-laudo`, quebra: true, letra: L('laudo'), secao: secL,
          node: (
            <div className="sec">
              <SecT rot={secL} leg={leg} />
              <div className="laudo">
                <div className="laudo-col">
                  <div>
                    <div className="leg"><b>1. Centralização medida</b> · frente{fotoC ? ` · ${comSaida ? 'saída' : 'chegada'}` : ''}</div>
                    <div className="centro"><FotoReal foto={fotoC} alt={`${c.nome}, frente usada na medição`} /></div>
                  </div>
                  <div className="sec">
                    <SecT rot="2. Mapa de imperfeições" semMarca />
                    <Kv l="Cantos">{la.cantos || 'Não registrado'}</Kv>
                    <Kv l="Bordas">{la.bordas || 'Não registrado'}</Kv>
                    <Kv l="Superfície">{la.superficie || 'Não registrado'}</Kv>
                  </div>
                </div>
                <div className="laudo-col laudo-dir">
                  <table>
                    <thead><tr><th>Lado</th><th>Centralização medida</th></tr></thead>
                    <tbody>
                      <tr><td><b>Frente</b></td><td className="num">{la.centralizacaoFrente || 'Não registrada'}</td></tr>
                      <tr><td><b>Verso</b></td><td className="num">{la.centralizacaoVerso || 'Não registrada'}</td></tr>
                    </tbody>
                  </table>
                  <div className="leg">Medida com régua sobre a foto em luz difusa. Centralização vem da impressão e não tem correção.</div>
                  {limite && (
                    <div>
                      <p><b>{limite.texto}</b></p>
                      <div className="leg">{limite.nota}</div>
                    </div>
                  )}
                  <div className="faixa-selo">
                    <div className="rot sem-marca">3. Faixa provável</div>
                    <div className="faixa-num num">{la.faixa ? la.faixa.texto : 'Não registrada'}</div>
                    <div className="escala">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i + 1 >= lo && i + 1 <= hi ? 'on' : ''} />)}</div>
                    <div className="escala-n num">{Array.from({ length: 10 }, (_, i) => <span key={i} className={i + 1 >= lo && i + 1 <= hi ? 'on' : ''}>{i + 1}</span>)}</div>
                    <div className="ressalva">Estimativa, não é nota de graduação. A nota final é da graduadora.</div>
                  </div>
                  <div className="grid2" style={{ gap: '3mm 4mm' }}>
                    <Kv l="4. Graduadora recomendada"><b>{la.graduadora || 'Não registrada'}</b>{quando && <div className="leg">{quando}</div>}</Kv>
                    {p.graduadoraAlvo && <Kv l="Graduadora pretendida"><b>{p.graduadoraAlvo}</b><div className="leg">Informada por você no pedido.</div></Kv>}
                  </div>
                  <Kv l="5. Próximo passo"><b>{la.proximoPasso || 'Não registrado'}</b></Kv>
                </div>
              </div>
            </div>
          ),
        },
        {
          ...base, k: `${k}-laudo-6`, letra: L('laudo'), secao: secL,
          node: <div className="leg"><b>6. Fotos em luz difusa e rasante:</b> ver {L('fotos')}. {tipo === 'pre_grading' ? 'Registro de entrada' : 'Antes e depois'}.</div>,
        },
      ]
    }
    if (comLaudo && tipo === 'pre_grading') blocos.push(...blocosLaudo())

    // ── Proposta e tratamento ──
    if (comProposta) {
      const secP = `${L('proposta')}. ${tipo === 'restauracao' ? 'Proposta, tratamento e laudo' : 'Proposta e tratamento'}`
      const cabP = <SecT rot={secP} leg={[p.propostaEnviadaEm && `Proposta enviada em ${dt(p.propostaEnviadaEm)}`, p.propostaAceitaEm && `decidida em ${dt(p.propostaAceitaEm)}`].filter(Boolean).join(' · ')} />
      const procs = [...c.procedimentos].sort((a, b) => a.ordem - b.ordem)
      if (!procs.length) {
        blocos.push({ ...base, k: `${k}-prop`, quebra: true, letra: L('proposta'), secao: secP, node: <div className="sec">{cabP}<p>Nenhum procedimento proposto.</p></div> })
      }
      procs.forEach((pr, i) => {
        const risco = RISCOS.find(r => r.id === pr.risco)?.rotulo || pr.risco
        const card = (
          <div className={`proc${pr.decisao === 'recusado' ? ' recusado' : ''}`}>
            <div className="n num">{pr.ordem}</div>
            <div>
              <div className="proc-top"><h3>{pr.problema}</h3><span className={`tag${pr.risco === 'alto' ? ' forte' : ''}`}>{risco}</span></div>
              <dl>
                <dt>Procedimento</dt><dd>{pr.procedimento}</dd>
                {pr.objetivo && <><dt>Objetivo</dt><dd>{pr.objetivo}</dd></>}
                {pr.resultadoEsperado && <><dt>Resultado esperado</dt><dd>{pr.resultadoEsperado}</dd></>}
                <dt>Risco</dt><dd>{risco.replace('Risco ', '').replace(/^./, s => s.toUpperCase())}.{pr.riscoDescricao ? ` ${pr.riscoDescricao}` : ''}</dd>
                {pr.alternativa && <><dt>Alternativa</dt><dd>{pr.alternativa}</dd></>}
              </dl>
              <div className="decisao">
                {pr.decisao === 'aprovado' && <><IconCheck size={13} color="currentColor" strokeWidth={2} /> Aprovado por você em {dt(pr.decididoEm)}</>}
                {pr.decisao === 'recusado' && <><IconClose size={13} color="currentColor" strokeWidth={2} /> Não realizado, por decisão do cliente em {dt(pr.decididoEm)}. A condição permanece como registrada na chegada.</>}
                {pr.decisao === 'pendente' && <>Sem decisão registrada. Não realizado.</>}
              </div>
            </div>
          </div>
        )
        blocos.push({
          ...base, k: `${k}-proc-${i}`, quebra: i === 0, letra: L('proposta'), secao: secP,
          node: i === 0 ? <div className="sec">{cabP}{card}</div> : card,
        })
      })
      const caderno = c.laudo?.caderno
      if (caderno || (tratada && d.descanso)) {
        blocos.push({
          ...base, k: `${k}-caderno`, letra: L('proposta'), secao: secP,
          node: (
            <div className="grid2">
              {caderno && <div className="sec"><SecT rot="Caderno de bancada" /><p>{caderno}</p></div>}
              {tratada && d.descanso && (
                <div className="sec">
                  <SecT rot="Descanso" />
                  <p className="num">
                    De {dt(d.descanso.de)} a {dt(d.descanso.ate)}, {d.descanso.dias < 1 ? 'menos de 1 dia' : `${d.descanso.dias} ${d.descanso.dias === 1 ? 'dia' : 'dias'}`}. É o descanso depois da prensa que faz o resultado durar.
                  </p>
                </div>
              )}
            </div>
          ),
        })
      }
      const persistem = comSaida ? (['frente', 'verso'] as const).flatMap(lado => {
        const a = lado === 'frente' ? c.fichaEntrada?.danos_frente || [] : c.fichaEntrada?.danos_verso || []
        const b = lado === 'frente' ? c.fichaSaida?.danos_frente || [] : c.fichaSaida?.danos_verso || []
        return a.filter(x => b.includes(x)).map(x => `${rotuloDano(x).toLowerCase()} (${lado})`)
      }) : []
      blocos.push({
        ...base, k: `${k}-limites`, letra: L('proposta'), secao: secP,
        node: (
          <div className="sec">
            <SecT rot="Limitações" />
            <ul className="lista">
              {recusados.map((r, i) => <li key={i}>{r.problema}: não tratado, por sua decisão.</li>)}
              {!tratada && <li>Nenhum procedimento foi realizado: a carta volta na condição da chegada.</li>}
              {persistem.length > 0 && <li>Permanecem registrados na saída: {juntar(persistem)}.</li>}
              <li>O resultado depende do material e do histórico da carta. A restauração não usa tinta, cola nem corte.</li>
              <li>Nenhuma nota de graduação é garantida.</li>
            </ul>
          </div>
        ),
      })
    }

    // ── Fotos: antes e depois / registro de entrada ──
    const secF = tratada ? `${L('fotos')}. Antes e depois` : `${L('fotos')}. Registro de entrada`
    const fb = { ...base, letra: L('fotos'), secao: secF }
    const canto = (lado: 'frente' | 'verso', pos: string) => `${lado}_${pos}`
    const CANTOS = [['sup_esq', 'Superior esquerdo'], ['sup_dir', 'Superior direito'], ['inf_esq', 'Inferior esquerdo'], ['inf_dir', 'Inferior direito']] as const
    const BORDAS = [['superior', 'Superior'], ['inferior', 'Inferior'], ['esquerda', 'Esquerda'], ['direita', 'Direita']] as const
    const legF = (f: RelatorioFoto | undefined, rot: string) => (f ? `${rot} · ${dt(f.em)}` : rot)
    const rasantes = c.fotos.filter(f => f.tipo === 'entrada_rasante' || (tratada && f.tipo === 'saida_rasante'))
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.em.localeCompare(b.em))
    const angulo = fotoDe(c, 'entrada_angulo', 'frente')
    const rotRasante = (f: RelatorioFoto) => `Rasante${f.posicao ? ` · ${f.posicao}` : ''} · ${f.tipo === 'saida_rasante' ? 'saída' : 'chegada'}`

    if (tratada) {
      blocos.push({
        ...fb, k: `${k}-f-inteiras`, quebra: true,
        node: (
          <div className="sec">
            <SecT rot={secF} leg={`Mesma luz, mesma distância, mesmo fundo. Sem edição além de recorte. ${contagem(c, true)}`} />
            <div className="g-inteiras">
              {([['entrada_difusa', 'frente', 'Frente · chegada', 'Sem registro de entrada'], ['saida_difusa', 'frente', 'Frente · saída', 'Sem registro de saída'],
                ['entrada_difusa', 'verso', 'Verso · chegada', 'Sem registro de entrada'], ['saida_difusa', 'verso', 'Verso · saída', 'Sem registro de saída']] as const).map(([t, pos, rot, vz]) => {
                const f = fotoDe(c, t, pos)
                return <Foto key={t + pos} foto={f} ratio="r57" legenda={legF(f, rot)} vazio={vz} alt={`${c.nome}, ${rot.toLowerCase()}`} />
              })}
            </div>
          </div>
        ),
      })
      for (const lado of ['frente', 'verso'] as const) {
        for (const fileira of [0, 1]) {
          const pares = CANTOS.slice(fileira * 2, fileira * 2 + 2)
          const grade = (
            <div className="g-cantos">
              {pares.map(([pos, rot]) => {
                const ch = fotoDe(c, 'entrada_canto', canto(lado, pos))
                const sa = fotoDe(c, 'saida_canto', canto(lado, pos))
                return (
                  <div key={pos} className="par-canto">
                    <div className="par-canto-t">{rot}</div>
                    <div className="par-fotos">
                      <Foto foto={ch} ratio="r11" legenda={legF(ch, 'Chegada')} vazio="Sem registro de entrada" alt={`Canto ${rot.toLowerCase()} (${lado}), chegada`} />
                      <Foto foto={sa} ratio="r11" legenda={legF(sa, 'Saída')} vazio="Sem registro de saída" alt={`Canto ${rot.toLowerCase()} (${lado}), saída`} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
          blocos.push({
            ...fb, k: `${k}-f-cantos-${lado}-${fileira}`,
            node: fileira === 0
              ? <div className="sec"><div className="leg"><b>Cantos {lado === 'frente' ? 'da frente' : 'do verso'}</b> · chegada e saída lado a lado</div>{grade}</div>
              : grade,
          })
        }
      }
      blocos.push({
        ...fb, k: `${k}-f-bordas`,
        node: (
          <div className="sec">
            <div className="leg"><b>Bordas</b> · chegada</div>
            <div className="g-bordas">
              {BORDAS.map(([pos, rot]) => {
                const f = fotoDe(c, 'entrada_borda', pos)
                return <Foto key={pos} foto={f} ratio="r31" legenda={legF(f, rot)} vazio="Sem registro de entrada" alt={`Borda ${rot.toLowerCase()}, chegada`} />
              })}
            </div>
          </div>
        ),
      })
      blocos.push({
        ...fb, k: `${k}-f-extra`,
        node: (
          <div className="sec">
            <div className="leg"><b>Superfície em ângulo{rasantes.length ? ' e luz rasante' : ''}</b></div>
            <div className="g-extra">
              <Foto foto={angulo} ratio="r43" legenda={legF(angulo, 'Ângulo · frente · chegada')} vazio="Sem registro de entrada" alt="Superfície em ângulo, chegada" />
              {rasantes.slice(0, 3).map((f, i) => <Foto key={i} foto={f} ratio="r43" legenda={legF(f, rotRasante(f))} vazio="" alt={rotRasante(f)} />)}
            </div>
            <div className="leg">Bordas e ângulo registrados só na chegada.</div>
          </div>
        ),
      })
    } else {
      const angRas = [
        <Foto key="ang" foto={angulo} ratio="r43" legenda={legF(angulo, 'Superfície em ângulo')} vazio="Sem registro de entrada" alt="Superfície em ângulo, chegada" />,
        ...rasantes.slice(0, 1).map((f, i) => <Foto key={`r${i}`} foto={f} ratio="r43" legenda={legF(f, rotRasante(f))} vazio="" alt={rotRasante(f)} />),
      ]
      blocos.push({
        ...fb, k: `${k}-f-topo`, quebra: true,
        node: (
          <div className="sec">
            <SecT rot={secF} leg={`Luz difusa, mesma distância, mesmo fundo. Sem edição além de recorte. ${contagem(c, false)}`} />
            {tipo !== 'pre_grading' && <div className="painel">Devolvida sem intervenção: a carta volta na condição da chegada.</div>}
            <div className="reg-topo">
              {([['frente', 'Frente inteira'], ['verso', 'Verso inteiro']] as const).map(([pos, rot]) => {
                const f = fotoDe(c, 'entrada_difusa', pos)
                return <Foto key={pos} foto={f} ratio="r57" legenda={legF(f, rot)} vazio="Sem registro de entrada" alt={`${c.nome}, ${rot.toLowerCase()} na chegada`} />
              })}
              <div className="reg-luz">
                <div className="reg-luz-g">{angRas}</div>
                <div className="painel reg-nota"><b>Por que a luz rasante.</b> A luz entra quase paralela à carta e deixa à mostra relevo, risco e ondulação que a luz difusa esconde.</div>
              </div>
            </div>
          </div>
        ),
      })
      for (const lado of ['frente', 'verso'] as const) {
        blocos.push({
          ...fb, k: `${k}-f-cantos-${lado}`,
          node: (
            <div className="reg-bloco">
              <div className="par-canto-t">Cantos {lado === 'frente' ? 'da frente' : 'do verso'}</div>
              <div className="reg-4">
                {CANTOS.map(([pos, rot]) => {
                  const f = fotoDe(c, 'entrada_canto', canto(lado, pos))
                  return <Foto key={pos} foto={f} ratio="r11" legenda={legF(f, rot)} vazio="Sem registro de entrada" alt={`Canto ${rot.toLowerCase()} (${lado}), chegada`} />
                })}
              </div>
            </div>
          ),
        })
      }
      blocos.push({
        ...fb, k: `${k}-f-bordas`,
        node: (
          <div className="reg-bloco">
            <div className="par-canto-t">Bordas</div>
            <div className="g-bordas">
              {BORDAS.map(([pos, rot]) => {
                const f = fotoDe(c, 'entrada_borda', pos)
                return <Foto key={pos} foto={f} ratio="r31" legenda={legF(f, rot)} vazio="Sem registro de entrada" alt={`Borda ${rot.toLowerCase()}, chegada`} />
              })}
            </div>
          </div>
        ),
      })
    }

    if (comLaudo && tipo === 'completo') blocos.push(...blocosLaudo())
  })

  // ── Fechamento ──
  const custodias = aceitas.map(c => c.custodia).filter(Boolean) as string[]
  const fe = { cab: 'Fechamento', custodia: custodias.length === 1 ? custodias[0] : null }
  const semSeguro = !p.seguroCents
  const pagos = d.pagamentos.filter(x => x.pagoEm)
  const totalPago = pagos.reduce((s, x) => s + x.valorCents, 0) - d.pagamentos.reduce((s, x) => s + x.reembolsadoCents, 0)
  const emAberto = (p.totalCents || 0) - pagos.reduce((s, x) => s + x.valorCents, 0)
  const reembolsou = d.pagamentos.some(x => x.reembolsadoCents > 0)
  const algumAprovado = aceitas.some(c => c.procedimentos.some(x => x.decisao === 'aprovado'))

  blocos.push({
    ...fe, k: 'fech-valores', quebra: true,
    node: (
      <div className="grid2" style={{ alignItems: 'start' }}>
        <div className="sec">
          <SecT rot="Valores do pedido" />
          <table>
            <tbody>
              <tr><td>Serviço · {nomeServico}{p.servicoConferido ? ' (conferido após a sua decisão)' : ''}</td><td className="v">{reais(p.orcamentoCents || 0)}</td></tr>
              {!semSeguro && <tr><td>Valor declarado nos Correios</td><td className="v">{reais(p.seguroCents || 0)}</td></tr>}
              {!!p.freteVoltaCents && <tr><td>Frete de volta</td><td className="v">{reais(p.freteVoltaCents)}</td></tr>}
              <tr className="total"><td>Total</td><td className="v">{reais(p.totalCents || 0)}</td></tr>
            </tbody>
          </table>
          <div className="leg num">
            {tipo === 'pre_grading'
              ? `A carta viaja pelo valor declarado que você informou no orçamento: ${reais(p.valorDeclaradoCents)}.`
              : `Valor declarado: ${reais(p.valorDeclaradoCents)}. É a referência para qualquer indenização relacionada a este serviço.`}
          </div>
        </div>
        <div className="sec">
          <SecT rot={d.pagamentos.length > 1 ? 'Pagamentos por etapa' : 'Pagamento'} />
          <TabelaPagamentos linhas={d.pagamentos} totalPago={totalPago} emAberto={emAberto} />
          <div className="leg">
            {tipo === 'pre_grading' ? 'No pré-grading o pagamento é um só, no aceite. ' : ''}
            {reembolsou ? '' : 'Nenhum reembolso neste pedido.'}
          </div>
        </div>
      </div>
    ),
  })
  const listaCustodia = tipo === 'pre_grading' ? CUSTODIA_PRE_GRADING : CUSTODIA
  blocos.push({
    ...fe, k: 'fech-custodia',
    node: (
      <div className="sec">
        <SecT rot="Custódia e envio" />
        <div className="grid3">
          <Kv l="Vídeo de abertura"><span className="num">{p.videoAberturaEm ? `Sim, em ${dt(p.videoAberturaEm)}` : 'Não registrado'}</span></Kv>
          <Kv l="Rastreio de ida"><span className="num">{p.rastreioIda || 'Não informado'}</span></Kv>
          <Kv l="Rastreio e lacre da volta">Ficam na página do pedido em bynx.gg, porque são gerados depois que este relatório é fechado na caixa.</Kv>
        </div>
        <ul className="lista-custodia">
          {listaCustodia.map(x => <li key={x.t}><b>{x.t}.</b> {x.d}</li>)}
        </ul>
      </div>
    ),
  })
  blocos.push({
    ...fe, k: 'fech-tempo',
    node: (
      <div className="sec">
        <SecT rot="Linha do tempo" leg="Horários de Brasília" />
        <table className="tempo">
          <tbody>
            {d.linhaDoTempo.map(m => (
              <tr key={m.status}><td className="num quando">{dt(m.em)}</td><td><b>{m.rotulo}</b></td><td className="fraco">{m.nota}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  })
  const guarda = [...GUARDA_RECOMENDADA, ...(tipo !== 'pre_grading' && algumAprovado && !devolvida ? [GUARDA_PRENSA] : []), GUARDA_GRADUADORA]
  blocos.push({
    ...fe, k: 'fech-guarda',
    node: (
      <div className="sec">
        <SecT rot="Guarda recomendada" />
        <ul className="lista lista-2">{guarda.map(g => <li key={g}>{g}</li>)}</ul>
      </div>
    ),
  })

  // ── Termos e conferencia ──
  const te = { cab: 'Termos e conferência', custodia: fe.custodia }
  if (d.termos.length) {
    blocos.push({
      ...te, k: 'termos', quebra: true,
      node: (
        <div className="sec">
          <SecT rot="Termos aceitos" />
          <div className="termos">
            {d.termos.map(t => (
              <div key={t.versao}>
                <h3>{t.titulo}</h3>
                <div className="ver num">Versão {t.versao}{t.aceitoEm ? ` · aceito em ${dt(t.aceitoEm)}` : ''}</div>
                {t.itens && <ol>{t.itens.map((x, i) => <li key={i}>{x}</li>)}</ol>}
              </div>
            ))}
          </div>
        </div>
      ),
    })
  }
  blocos.push({
    ...te, k: 'ressalvas', quebra: !d.termos.length,
    node: (
      <div className="sec">
        <SecT rot="Ressalvas" />
        <ul className="lista" style={{ fontSize: '8.5pt' }}>
          <li>Este documento não é certificado de graduação nem de autenticidade.</li>
          {tipo !== 'restauracao' && <li>A faixa provável é uma estimativa. A nota final é atribuída exclusivamente pela graduadora.</li>}
          <li>A Bynx não é afiliada a {juntar(GRADUADORAS.map(g => g.nome)).replace(/ e ([^ ]+)$/, ' ou $1')}. Os nomes identificam empresas independentes.</li>
          <li>Este relatório descreve a carta na data de emissão. A condição pode mudar depois, e ele não acompanha a carta como garantia em revenda.</li>
        </ul>
      </div>
    ),
  })
  blocos.push({
    ...te, k: 'conferir',
    node: (
      <div className="sec">
        <SecT rot="Como conferir" />
        <div className="verif">
          <div className="codigo num">Pedido {p.numero}{custodias.length ? ` · Custódia ${custodias.join(', ')}` : ''}</div>
          <div>Confira este pedido, as fotos de entrada{tipo !== 'pre_grading' && !devolvida ? ' e de saída' : ''} e o rastreio da volta na sua conta em <b>bynx.gg</b>.</div>
          <div className="leg">A custódia é o número que acompanha a carta desde a abertura do pacote em vídeo.</div>
        </div>
      </div>
    ),
  })
  const fimEm = devolvida ? d.marcos.devolvida_sem_servico : d.marcos.pronta
  blocos.push({
    ...te, k: 'assinatura',
    node: (
      <div className="assin">
        <div className="linha">
          <b>{devolvida ? 'Conferido na bancada' : tipo === 'pre_grading' ? 'Examinado e conferido na bancada' : 'Executado e conferido na bancada'}</b>
          Edu · Bancada Bynx.{fimEm ? ` ${devolvida ? 'Devolvida' : 'Pronta'} em ${dt(fimEm)}.` : ''}
        </div>
        <div className="linha">
          <b>{custodias.length ? `Custódia ${custodias.join(', ')}` : 'Sem custódia'}</b>
          Pedido {p.numero} · {d.cartas.length} {d.cartas.length === 1 ? 'carta' : 'cartas'} · {nomeServico}
        </div>
      </div>
    ),
  })

  return blocos
}

function TabelaFicha({ entrada, saida }: { entrada: FichaCondicao; saida: FichaCondicao | null }) {
  const linhas = compararFicha(entrada, saida)
  const de = (lado: 'frente' | 'verso', pilar: string) => linhas.find(l => l.lado === lado && l.pilar === pilar)
  const variacao = (v: string | null | undefined) =>
    v === 'melhorou' ? <b>Melhorou</b> : v === 'piorou' ? <span className="tag forte">Piorou</span> : v === 'igual' ? <span className="fraco">Igual</span> : <span className="fraco">Sem registro</span>
  if (!saida) {
    return (
      <table>
        <thead><tr><th>Pilar</th><th>Frente</th><th>Verso</th></tr></thead>
        <tbody>
          {PILARES.map(p => (
            <tr key={p.id}><td><b>{p.rotulo}</b></td><td>{rotuloEscala(de('frente', p.id)?.chegada ?? null)}</td><td>{rotuloEscala(de('verso', p.id)?.chegada ?? null)}</td></tr>
          ))}
        </tbody>
      </table>
    )
  }
  return (
    <table>
      <thead><tr><th>Pilar</th><th>Frente · chegada</th><th>Frente · saída</th><th>Variação</th><th>Verso · chegada</th><th>Verso · saída</th><th>Variação</th></tr></thead>
      <tbody>
        {PILARES.map(p => {
          const f = de('frente', p.id), v = de('verso', p.id)
          return (
            <tr key={p.id}>
              <td><b>{p.rotulo}</b></td>
              <td>{rotuloEscala(f?.chegada ?? null)}</td>
              <td className={f?.variacao === 'melhorou' ? 'melhor' : ''}>{rotuloEscala(f?.saida ?? null)}</td>
              <td>{variacao(f?.variacao)}</td>
              <td>{rotuloEscala(v?.chegada ?? null)}</td>
              <td className={v?.variacao === 'melhorou' ? 'melhor' : ''}>{rotuloEscala(v?.saida ?? null)}</td>
              <td>{variacao(v?.variacao)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Danos({ entrada, saida }: { entrada: FichaCondicao | null; saida: FichaCondicao | null }) {
  const linhas: { lado: string; dano: string; ch: boolean; sa: boolean }[] = []
  for (const lado of ['frente', 'verso'] as const) {
    const a = (lado === 'frente' ? entrada?.danos_frente : entrada?.danos_verso) || []
    const b = (lado === 'frente' ? saida?.danos_frente : saida?.danos_verso) || []
    for (const dn of DANOS) {
      const ch = a.includes(dn.id), sa = b.includes(dn.id)
      if (ch || sa) linhas.push({ lado: LADO[lado], dano: dn.rotulo, ch, sa })
    }
  }
  const novos = linhas.filter(l => !l.ch && l.sa).length
  return (
    <div className="sec">
      <SecT rot="Danos registrados" leg={saida ? 'Chegada comparada com a saída' : 'Na chegada'} />
      {linhas.length === 0 ? (
        <p>Nenhum dano registrado{saida ? ' na chegada nem na saída' : ' na chegada'}.</p>
      ) : saida ? (
        <table>
          <thead><tr><th>Lado</th><th>Dano</th><th>Na chegada</th><th>Na saída</th><th>Estado</th></tr></thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td>{l.lado}</td><td>{l.dano}</td><td>{l.ch ? 'Presente' : 'Ausente'}</td><td>{l.sa ? 'Presente' : 'Ausente'}</td>
                <td>{l.ch && !l.sa ? <span className="tag">Tratado</span> : l.ch && l.sa ? <span className="tag suave">Persiste</span> : <span className="tag forte">Dano novo</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table>
          <thead><tr><th>Lado</th><th>Dano</th></tr></thead>
          <tbody>{linhas.map((l, i) => <tr key={i}><td>{l.lado}</td><td>{l.dano}</td></tr>)}</tbody>
        </table>
      )}
      {saida && linhas.length > 0 && (
        <div className="leg">{novos ? `${novos} ${novos === 1 ? 'dano novo registrado' : 'danos novos registrados'} na saída. A explicação está na observação da ficha.` : 'Nenhum dano novo registrado na saída.'}</div>
      )}
    </div>
  )
}

const ROTULO_ETAPA_PAPEL: Record<RelatorioPagamento['etapa'], [string, string]> = {
  sinal: ['Sinal', 'valor declarado + frete de volta'],
  servico: ['Serviço', ''],
  integral: ['Pagamento', 'integral, no aceite'],
  unico: ['Pagamento', ''],
}

function TabelaPagamentos({ linhas, totalPago, emAberto }: { linhas: RelatorioPagamento[]; totalPago: number; emAberto: number }) {
  if (!linhas.length) return <p>Nenhum pagamento registrado.</p>
  return (
    <table>
      <thead><tr><th>Etapa</th><th>Método</th><th>Pago em</th><th className="v">Valor</th></tr></thead>
      <tbody>
        {linhas.map((l, i) => {
          const [r, sub] = ROTULO_ETAPA_PAPEL[l.etapa]
          return [
            <tr key={`p${i}`}>
              <td><b>{r}</b>{sub && <div className="leg">{sub}</div>}</td>
              <td>{l.metodo || '—'}</td>
              <td className="num quando">{l.pagoEm ? dt(l.pagoEm) : <b>Em aberto</b>}</td>
              <td className="v">{reais(l.valorCents)}</td>
            </tr>,
            l.reembolsadoCents > 0 && (
              <tr key={`r${i}`}>
                <td colSpan={3}>Reembolso{l.reembolsadoEm ? ` em ${dt(l.reembolsadoEm)}` : ''}</td>
                <td className="v">− {reais(l.reembolsadoCents)}</td>
              </tr>
            ),
          ]
        })}
        <tr className="total"><td colSpan={3}>Total pago</td><td className="v">{reais(totalPago)}</td></tr>
        {emAberto > 0 && <tr><td colSpan={3}><b>Em aberto</b></td><td className="v">{reais(emAberto)}</td></tr>}
      </tbody>
    </table>
  )
}

// ── Paginacao ───────────────────────────────────────────────────────────────

interface Pagina { blocos: Bloco[]; capa: boolean; continua?: string; usado: number }

function paginar(blocos: Bloco[], alt: Record<string, number>): Pagina[] {
  const paginas: Pagina[] = []
  const gap = GAP_MM * MM
  const contH = alt.__cont || 0
  let atual: Pagina | null = null
  let anterior: Bloco | null = null
  for (const b of blocos) {
    const h = alt[b.k] || 0
    const cap = (pg: Pagina) => (pg.capa ? UTIL_CAPA_MM : UTIL_MM) * MM - 2
    if (b.quebra || !atual) {
      atual = { blocos: [], capa: !!b.capa, usado: 0 }
      paginas.push(atual)
    } else if (atual.usado + gap + h > cap(atual)) {
      const continua = b.secao && anterior?.secao === b.secao ? b.secao : undefined
      atual = { blocos: [], capa: false, continua, usado: continua ? contH : 0 }
      paginas.push(atual)
    }
    atual.usado += (atual.blocos.length || atual.continua ? gap : 0) + h
    atual.blocos.push(b)
    anterior = b
  }
  return paginas
}

// ── Componente ──────────────────────────────────────────────────────────────

export default function RelatorioImpresso({ dados, onEstado }: { dados: RelatorioDados; onEstado?: (e: EstadoImpressao) => void }) {
  const blocos = useMemo(() => montarBlocos(dados), [dados])
  const medidor = useRef<HTMLDivElement>(null)
  const folhas = useRef<HTMLDivElement>(null)
  const [alturas, setAlturas] = useState<Record<string, number> | null>(null)
  const [estouro, setEstouro] = useState<number[]>([])
  const aviso = useRef(onEstado)
  useEffect(() => { aviso.current = onEstado }, [onEstado])

  // 1. Mede cada bloco depois que a fonte carregou (a altura do texto depende dela).
  useEffect(() => {
    let vivo = true
    const pronto = typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve()
    // setTimeout, nao requestAnimationFrame: aba em segundo plano nao roda rAF.
    pronto.then(() => setTimeout(() => {
      if (!vivo || !medidor.current) return
      const r: Record<string, number> = {}
      medidor.current.querySelectorAll<HTMLElement>('[data-k]').forEach(el => { r[el.dataset.k!] = el.getBoundingClientRect().height })
      setAlturas(r)
    }, 0))
    return () => { vivo = false }
  }, [blocos])

  const paginas = useMemo(() => (alturas ? paginar(blocos, alturas) : []), [blocos, alturas])

  // 2. Confere estouro no DOM real e espera todas as fotos decodificarem.
  useEffect(() => {
    if (!alturas || !folhas.current) return
    let vivo = true
    const raiz = folhas.current
    const id = setTimeout(() => {
      if (!vivo) return
      const ruins: number[] = []
      raiz.querySelectorAll<HTMLElement>('.pagina').forEach((pg, i) => {
        const miolo = pg.querySelector('.miolo'), rod = pg.querySelector('.rod')
        if (!miolo || !rod) return
        // Area util acaba 20 mm antes da borda de baixo (a tela pode estar com zoom: mede em proporcao).
        const caixa = pg.getBoundingClientRect()
        const limite = caixa.top + caixa.height * (297 - 20) / 297
        const fim = miolo.getBoundingClientRect().bottom
        const passou = pg.scrollHeight > pg.clientHeight + 1 || fim > limite + 1 || fim > rod.getBoundingClientRect().top
        if (passou) ruins.push(i + 1)
      })
      setEstouro(ruins)
      const imgs = [...raiz.querySelectorAll('img')]
      const semUrl = !!raiz.querySelector('[data-sem-url]')
      aviso.current?.({ pronto: true, paginas: paginas.length, estouro: ruins, fotos: 'carregando' })
      Promise.all(imgs.map(im => im.decode()))
        .then(() => vivo && aviso.current?.({ pronto: true, paginas: paginas.length, estouro: ruins, fotos: semUrl ? 'erro' : 'ok' }))
        .catch(() => vivo && aviso.current?.({ pronto: true, paginas: paginas.length, estouro: ruins, fotos: 'erro' }))
    }, 0)
    return () => { vivo = false; clearTimeout(id) }
  }, [paginas, alturas])

  const p = dados.pedido
  const aceitas = dados.cartas.filter(c => c.aceito)
  const titulo = p.status === 'devolvida_sem_servico' ? 'Relatório de devolução' : 'Relatório de bancada'
  const emitido = dt(dados.emitidoEm)

  return (
    <div className="rel-doc">
      <style>{CSS}</style>
      <div ref={folhas} className="rel-folhas">
        {paginas.map((pg, i) => {
          const b0 = pg.blocos[0]
          const carta = b0?.carta
          const letras = [...new Set(pg.blocos.map(b => b.letra).filter(Boolean))] as string[]
          const cabSec = b0?.cab
            ? `${b0.cab}${pg.continua ? ', continuação' : ''}`
            : `Carta ${carta} de ${aceitas.length}${letras.length ? ` · ${juntar(letras)}` : ''}${pg.continua ? ', continuação' : ''}`
          const custodia = b0?.custodia
          return (
            <section key={i} className={`pagina${pg.capa ? ' capa' : ''}${estouro.includes(i + 1) ? ' estourou' : ''}`} aria-label={`Página ${i + 1}`}>
              {!pg.capa && (
                <header className="cab">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo local */}
                  <img className="logo-cab" src="/logo_BYNX.png" alt="Bynx" />
                  <span>{titulo} · {p.numero}{custodia ? ` · Custódia ${custodia}` : aceitas.length > 1 ? ` · ${aceitas.length} cartas` : ''}</span>
                  <span className="cab-sec">{cabSec}</span>
                </header>
              )}
              <div className="miolo">
                {pg.continua && <div className="sec-t"><span className="rot">{pg.continua}, continuação</span></div>}
                {pg.blocos.map(b => <div key={b.k} className="bloco">{b.node}</div>)}
              </div>
              <footer className="rod">
                <span>Página {i + 1} de {paginas.length}</span>
                <span>Emitido em {emitido} (Brasília)</span>
                <span>{p.numero}</span>
                <span>bynx.gg</span>
              </footer>
            </section>
          )
        })}
      </div>
      <MedindoCtx.Provider value>
        <div ref={medidor} className="rel-medidor" aria-hidden>
          <div className="miolo">
            <div data-k="__cont" className="bloco"><div className="sec-t"><span className="rot">X. Seção, continuação</span></div></div>
            {blocos.map(b => <div key={b.k} data-k={b.k} className="bloco">{b.node}</div>)}
          </div>
        </div>
      </MedindoCtx.Provider>
    </div>
  )
}

// ── Estilo (mockup aprovado; so tokens) ─────────────────────────────────────
// Tamanhos em mm/pt porque e papel. Nenhuma cor cravada: bloco claro do
// globals.css via [data-theme="light"] e --ink* para as faixas escuras.

const CSS = `
@page{size:A4;margin:0}
.rel-doc{font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text);font-size:9pt;line-height:1.35;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.rel-doc *{box-sizing:border-box;margin:0;padding:0}
.rel-doc .num,.rel-doc td.v{font-variant-numeric:tabular-nums}
.rel-doc .rel-medidor{position:absolute;left:-10000px;top:0;visibility:hidden;width:180mm;pointer-events:none}
.rel-doc .pagina{position:relative;width:210mm;height:297mm;margin:0 auto 10mm;background:var(--bx-bg-elev);
  box-shadow:var(--bx-shadow);padding:24mm 15mm 20mm;overflow:visible}
.rel-doc .pagina.capa{padding-top:0}
.rel-doc .pagina.estourou{outline:2px dashed var(--bx-red);outline-offset:2mm}
.rel-doc .miolo{display:flex;flex-direction:column;gap:5mm}
.rel-doc .bloco{min-width:0}

.rel-doc .cab{position:absolute;top:0;left:0;right:0;height:15mm;padding:0 15mm;display:flex;gap:3mm;align-items:center;
  background:var(--ink);color:var(--ink-text-2);font-size:7.5pt}
.rel-doc .cab::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.2mm;background:var(--ac-grad)}
.rel-doc .cab-sec{margin-left:auto;color:var(--ink-text);font-weight:800;letter-spacing:.02em;white-space:nowrap}
.rel-doc .logo-cab{height:6.5mm;width:auto;display:block;margin-right:2mm}
.rel-doc .rod{position:absolute;left:0;right:0;bottom:0;height:12mm;padding:0 15mm;display:flex;justify-content:space-between;gap:3mm;
  align-items:center;background:var(--ink);color:var(--ink-text-2);font-size:7.5pt}
.rel-doc .rod::before{content:"";position:absolute;left:0;right:0;top:0;height:1.2mm;background:var(--ac-grad)}
.rel-doc .rod span:first-child,.rel-doc .rod span:last-child{color:var(--ink-text);font-weight:700}

.rel-doc .rot{font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--bx-text);display:inline-flex;align-items:center;gap:1.5mm}
.rel-doc .rot::before{content:"";flex:none;width:1mm;height:3mm;border-radius:.3mm;background:var(--ac-grad)}
.rel-doc .rot.sem-marca::before{display:none}
.rel-doc h1{font-size:25pt;font-weight:800;letter-spacing:-.035em;line-height:1.1}
.rel-doc h1 .g{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.rel-doc h3{font-size:9.5pt;font-weight:700}
.rel-doc .sub{font-size:11pt;color:var(--bx-text-2);font-weight:500}
.rel-doc .leg{font-size:8pt;color:var(--bx-text-2)}
.rel-doc .fraco{color:var(--bx-text-2)}
.rel-doc .sec{display:flex;flex-direction:column;gap:2.5mm}
.rel-doc .sec-t{display:flex;align-items:baseline;gap:2.5mm;padding-bottom:1.5mm;border-bottom:.5pt solid var(--bx-border-2)}
.rel-doc .sec-t .rot{white-space:nowrap}
.rel-doc .lista{padding-left:4mm;display:flex;flex-direction:column;gap:1mm}
.rel-doc .lista-2{display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm}

.rel-doc .topo{display:flex;justify-content:space-between;align-items:center;gap:6mm;margin:0 -15mm;padding:11mm 15mm 9mm;
  background:var(--ink);color:var(--ink-text);position:relative}
.rel-doc .topo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.6mm;background:var(--ac-grad)}
.rel-doc .logo-capa{height:15mm;width:auto;display:block}
.rel-doc .marca-sub{color:var(--ac-1);margin-top:2.5mm;letter-spacing:.14em}
.rel-doc .selo{border:1pt solid var(--ink-border);background:var(--ink-surface);border-radius:2mm;padding:3mm;display:flex;gap:3mm;align-items:center;min-width:64mm}
.rel-doc .selo .cod{font-size:15pt;font-weight:900;letter-spacing:.02em;line-height:1.1;color:var(--ink-text)}
.rel-doc .selo .l{font-size:8pt;color:var(--ink-text-2)}
.rel-doc .titulo{display:flex;flex-direction:column;gap:1.5mm}
.rel-doc .carta-id{font-size:10pt;color:var(--bx-text-2)}
.rel-doc .carta-id b{color:var(--bx-text);font-weight:700}
.rel-doc .capa-fotos{display:flex;gap:6mm;align-items:flex-start}
.rel-doc .par-real{display:flex;flex-direction:column;gap:1.5mm}
.rel-doc .rot2{font-size:8pt;font-weight:700}
.rel-doc .rot2 span{font-weight:400;color:var(--bx-text-2)}
.rel-doc .real{width:63mm;height:88mm;border:.5pt solid var(--bx-border-2);border-radius:2mm;overflow:hidden;background:var(--bx-surface-2);
  display:flex;align-items:center;justify-content:center;font-size:8pt;font-weight:700}
.rel-doc .real img{width:100%;height:100%;object-fit:contain;display:block}
.rel-doc .real-vazio{background:var(--bx-bg-elev);border:.75pt dashed var(--bx-text-3)}
/* 1 unidade do viewBox = 1 mm (65 x 5,2): a regua mede 6 cm de verdade em escala 100%. */
.rel-doc .regua{width:65mm;height:5.2mm;margin-left:-1mm;color:var(--bx-text);display:block}
.rel-doc .regua-n{fill:var(--bx-text-2);font-family:inherit}
.rel-doc .capa-nota{width:52mm;display:flex;flex-direction:column;gap:2.5mm;padding-top:5mm}
.rel-doc .capa-nota .tag{align-self:flex-start;white-space:normal}
.rel-doc .resumo{flex:1;min-width:0;display:flex;flex-direction:column;gap:2.5mm;padding-left:4mm;border-left:.5pt solid var(--bx-border-2)}
.rel-doc .resumo dt{font-size:7.5pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text)}
.rel-doc .resumo dd{font-size:9pt;margin-bottom:1mm}
.rel-doc .resumo dd b{font-weight:800}
.rel-doc .datas{display:grid;border:.5pt solid var(--bx-border-2);border-radius:2mm}
.rel-doc .datas div{padding:2mm 2.5mm;border-left:.5pt solid var(--bx-border-2)}
.rel-doc .datas div:first-child{border-left:0}
.rel-doc .datas span{display:block;font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text)}
.rel-doc .datas b{font-size:8.5pt;font-weight:700}
.rel-doc .meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2mm 4mm}
.rel-doc .caixa-aviso{border:1pt solid var(--bx-text);border-radius:2mm;padding:2.5mm 3mm;display:flex;gap:3mm;align-items:flex-start;font-size:8.5pt}
.rel-doc .caixa-aviso b{font-weight:800}

.rel-doc table{width:100%;border-collapse:collapse}
.rel-doc th{font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text);text-align:left;
  padding:1.5mm 2mm;border-bottom:.75pt solid var(--bx-text)}
.rel-doc td{padding:1.6mm 2mm;border-bottom:.5pt solid var(--bx-border-2);vertical-align:top}
.rel-doc td.v{text-align:right;white-space:nowrap}
.rel-doc th.v{text-align:right}
.rel-doc tr.total td{border-top:1.5pt double var(--bx-text);border-bottom:0;font-weight:800;font-size:10pt}
.rel-doc .melhor{font-weight:800}
.rel-doc .tag{display:inline-block;border:.75pt solid var(--bx-text);border-radius:1mm;padding:.2mm 1.5mm;font-size:8pt;font-weight:700;white-space:nowrap}
.rel-doc .tag.forte{border-width:1.5pt}
.rel-doc .tag.suave{border-color:var(--bx-border-2);font-weight:500;color:var(--bx-text-2)}
.rel-doc .grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3mm 6mm}
.rel-doc .grid3{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,2fr);gap:2mm 4mm}
.rel-doc .kv-l{display:block;font-size:7pt;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text)}
.rel-doc .kv b{font-weight:700}
.rel-doc .painel{background:var(--bx-surface-2);border-radius:2mm;padding:2.5mm 3mm;font-size:8.5pt}

.rel-doc .proc{border:.5pt solid var(--bx-border-2);border-radius:2mm;padding:2.5mm 3mm;display:grid;grid-template-columns:7mm minmax(0,1fr);gap:1mm 2mm}
.rel-doc .proc.recusado{border:1pt dashed var(--bx-text)}
.rel-doc .proc .n{font-size:13pt;font-weight:900;letter-spacing:-.03em;line-height:1}
.rel-doc .proc-top{display:flex;justify-content:space-between;align-items:baseline;gap:3mm}
.rel-doc .proc dl{display:grid;grid-template-columns:30mm minmax(0,1fr);gap:.8mm 3mm;margin-top:1.5mm;font-size:8.5pt}
.rel-doc .proc dt{color:var(--bx-text-2)}
.rel-doc .decisao{margin-top:1.5mm;font-size:8.5pt;font-weight:700;display:flex;gap:2mm;align-items:center}
.rel-doc .decisao svg{flex:none}

.rel-doc .laudo{display:grid;grid-template-columns:70mm minmax(0,1fr);gap:6mm}
.rel-doc .laudo-col{display:flex;flex-direction:column;gap:4mm}
.rel-doc .laudo-dir{gap:3.5mm}
.rel-doc .centro{width:63mm;margin:2mm auto 0}
.rel-doc .faixa-selo{border:1pt solid var(--bx-text);border-radius:2mm;padding:3mm;display:flex;flex-direction:column;gap:2mm}
.rel-doc .faixa-num{font-size:26pt;font-weight:900;letter-spacing:-.03em;line-height:1}
.rel-doc .escala{display:grid;grid-template-columns:repeat(10,1fr);gap:1mm}
.rel-doc .escala i{display:block;height:5mm;border:.75pt solid var(--bx-border-2);border-radius:.8mm}
.rel-doc .escala i.on{border:.75pt solid var(--bx-text);
  background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--bx-text) 55%,transparent) 0 .5mm,transparent .5mm 1.4mm),var(--ac-grad)}
.rel-doc .escala-n{display:grid;grid-template-columns:repeat(10,1fr);gap:1mm;font-size:7.5pt;text-align:center;color:var(--bx-text)}
.rel-doc .escala-n .on{font-weight:800}
.rel-doc .ressalva{font-size:8pt;font-weight:700;border-top:.5pt solid var(--bx-border-2);padding-top:1.5mm}

.rel-doc .foto{display:flex;flex-direction:column;gap:1mm}
.rel-doc .foto figcaption{font-size:8pt;color:var(--bx-text-2);line-height:1.25}
.rel-doc .ph{position:relative;border:.5pt solid var(--bx-border-2);border-radius:1.5mm;overflow:hidden;
  display:flex;align-items:center;justify-content:center;text-align:center}
.rel-doc .ph span{background:var(--bx-bg-elev);border:.5pt solid var(--bx-border-2);border-radius:1mm;padding:.5mm 1.2mm;font-size:7pt;line-height:1.2;color:var(--bx-text);font-weight:500}
.rel-doc .ph-img{background:var(--bx-surface-2)}
.rel-doc .ph-img img{width:100%;height:100%;object-fit:contain;display:block}
.rel-doc .ph-vazio{background:var(--bx-bg-elev);border:.75pt dashed var(--bx-text-3)}
.rel-doc .ph-vazio span{border:0;font-weight:700}
.rel-doc .r57 .ph{aspect-ratio:5/7}
.rel-doc .r11 .ph{aspect-ratio:1/1}
.rel-doc .r31 .ph{aspect-ratio:3/1}
.rel-doc .r43 .ph{aspect-ratio:4/3}
.rel-doc .g-inteiras{display:grid;grid-template-columns:repeat(4,38mm);justify-content:space-between;gap:3mm}
.rel-doc .g-cantos{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3mm 6mm}
.rel-doc .par-canto{display:flex;flex-direction:column;gap:1mm}
.rel-doc .par-canto-t{font-size:7.5pt;font-weight:700;color:var(--bx-text);border-bottom:.5pt solid var(--bx-border-2);padding-bottom:.5mm}
.rel-doc .par-fotos{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2mm}
.rel-doc .g-bordas{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.6mm 3mm}
.rel-doc .g-extra{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3mm}
.rel-doc .reg-topo{display:grid;grid-template-columns:38mm 38mm minmax(0,1fr);gap:4mm;align-items:start}
.rel-doc .reg-luz{display:flex;flex-direction:column;gap:3mm}
.rel-doc .reg-luz-g{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3mm}
.rel-doc .reg-nota{font-size:8pt;line-height:1.4}
.rel-doc .reg-bloco{display:flex;flex-direction:column;gap:1.5mm}
.rel-doc .reg-4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3mm}

.rel-doc .tempo td{padding:1.1mm 2mm;font-size:8pt}
.rel-doc td.quando{white-space:nowrap}
.rel-doc .lista-custodia{padding-left:4mm;display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;font-size:8.5pt;margin-top:1mm}
.rel-doc .lista-custodia b{font-weight:700}

.rel-doc .termos{columns:2;column-gap:6mm;font-size:8pt;color:var(--bx-text-2);line-height:1.4}
.rel-doc .termos h3{font-size:8pt;color:var(--bx-text);break-after:avoid;margin-bottom:1mm}
.rel-doc .termos ol{padding-left:4mm;margin-bottom:3mm}
.rel-doc .termos li{margin-bottom:1mm;break-inside:avoid}
.rel-doc .termos .ver{font-size:8pt;color:var(--bx-text);margin-bottom:1.5mm}
.rel-doc .verif{display:flex;flex-direction:column;gap:1.2mm;border:1pt solid var(--bx-text);border-radius:2mm;padding:3mm;align-items:center;text-align:center}
.rel-doc .verif .codigo{font-size:12pt;font-weight:800}
.rel-doc .assin{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:2mm}
.rel-doc .assin .linha{font-size:8pt}
.rel-doc .assin .linha b{display:block;font-size:9pt}

@media screen and (max-width:820px){.rel-doc .pagina{zoom:.46}}
@media print{
  .rel-doc .pagina{margin:0;box-shadow:none;break-after:page;outline:0}
  .rel-doc .pagina:last-child{break-after:auto}
  .rel-doc .rel-medidor{display:none}
}
`
