'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { checkCardLimit, limiteCartasDoErro, textoLimiteCartas } from '@/lib/checkCardLimit'
import {
  adivinharColunas, ArquivoLido, emBlocos, lerCsv, LinhaImport, montarLinhas,
  PapelColuna, TAMANHO_BLOCO, TETO_IMPORTACAO,
} from '@/lib/csvColecao'

interface Props {
  userId: string | null
  onClose: () => void
  onAdded: () => void
}

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const MUTED = 'rgba(255,255,255,0.4)'

/**
 * Importacao em massa: arquivo de colecao ou lista colada.
 *
 * ★ POR QUE EM BLOCOS (24/09/2026, item 7 do brief). Medido no banco antes de
 * escrever: cada linha custa ~425 buffers e ~4,8 ms com cache QUENTE na
 * `analisar_import_lote` (ela usa indice, nao varre a tabela -- o custo e por
 * linha mesmo). Um arquivo de 300 cartas numa chamada so pediria ~128 mil
 * buffers, e no lambda frio isso passa dos 8 s do `authenticator`: a rota
 * morreria no meio e o usuario nao saberia o que entrou. Por isso a analise
 * vai de TAMANHO_BLOCO em TAMANHO_BLOCO, com progresso na tela.
 *
 * ★ O CASAMENTO CONTINUA NO BANCO. Este componente nao decide qual carta e
 * qual: ele monta as linhas e pergunta. Nome + numero + total do set e o que
 * a RPC usa, e casar por nome sozinho e justamente o erro que ela evita.
 *
 * ★ CONDICAO FICA DE FORA (decisao do Du). A coluna existe na maioria dos
 * arquivos exportados por outros aplicativos, mas cada um usa uma escala
 * propria: converter no chute gravaria NM numa carta jogada, sem ninguem ver.
 */

type Etapa = 'entrada' | 'mapear' | 'analisando' | 'revisao' | 'sucesso'

type Linha = {
  ordem: number
  linha: string
  quantidade: number
  card_id: string | null
  card_name: string | null
  card_set: string | null
  card_number: string | null
  card_image: string | null
  status: string
  /** Numero da linha no arquivo. Null quando veio do campo de colar. */
  origem?: number | null
  /** Set escrito no arquivo -- so para avisar quando o casamento diverge. */
  setArquivo?: string | null
}

type Resultado = { adicionadas: number; incrementadas: number; processadas: number; limiteAtingido: boolean }

const PLACEHOLDER = `2x Avalugg 024/086
Charizard ex 199/165
Pikachu VMAX 44/185`

const PAPEL_LABEL: Record<PapelColuna, string> = {
  nome: 'Nome', numero: 'Número', quantidade: 'Quantidade', set: 'Set', ignorar: 'Ignorar',
}
const PAPEIS: PapelColuna[] = ['nome', 'numero', 'quantidade', 'set', 'ignorar']

function msgErro(status: string): string {
  if (status === 'sem_numero') return 'Falta o número. Ex: Avalugg 024/086'
  return 'Não encontrada — confira o número e o set'
}

function mapErroAdd(codigo: string): string {
  if (codigo === 'nao_autenticado') return 'Sua sessão expirou. Recarregue a página e tente de novo.'
  if (codigo === 'payload_invalido') return 'A lista ficou inválida. Analise de novo.'
  return 'Não foi possível adicionar agora. Tente de novo.'
}

/** "Evolving Skies" e "evolving skies" sao o mesmo set; so avisa se diferir de verdade. */
function setDivergente(doArquivo: string | null | undefined, casado: string | null): boolean {
  if (!doArquivo || !casado) return false
  const n = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const a = n(doArquivo), b = n(casado)
  return a.length > 2 && b.length > 2 && !b.includes(a) && !a.includes(b)
}

export default function ImportarCartasModal({ userId, onClose, onAdded }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('entrada')
  const [texto, setTexto] = useState('')
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null)
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [papeis, setPapeis] = useState<PapelColuna[]>([])
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 })
  const [resultado, setResultado] = useState<Linha[] | null>(null)
  const [aba, setAba] = useState<'ok' | 'corrigir'>('ok')
  const [rascunho, setRascunho] = useState<Record<number, string>>({})
  const [procurando, setProcurando] = useState<number | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [sucesso, setSucesso] = useState<Resultado | null>(null)
  const [erroMsg, setErroMsg] = useState('')
  const [limiteDoPlano, setLimiteDoPlano] = useState(100)
  const inputArquivo = useRef<HTMLInputElement>(null)
  const cancelado = useRef(false)

  const linhasColadas = texto.split('\n').map(l => l.trim()).filter(Boolean)
  const okItems = (resultado || []).filter(r => r.status === 'ok')
  const erroItems = (resultado || []).filter(r => r.status !== 'ok')

  const linhasDoArquivo: LinhaImport[] = arquivo ? montarLinhas(arquivo, papeis) : []
  const temNome = papeis.includes('nome')
  const temNumero = papeis.includes('numero')
  const excedeTeto = linhasDoArquivo.length > TETO_IMPORTACAO

  // ── Arquivo ────────────────────────────────────────────────────────────────

  async function aoEscolherArquivo(f: File | null | undefined) {
    if (!f) return
    setErroMsg('')
    if (f.size > 2 * 1024 * 1024) {
      setErroMsg('Arquivo muito grande. O limite é 2 MB, o que dá muito mais que 500 cartas.')
      return
    }
    const lido = lerCsv(await f.text())
    if (!lido) {
      setErroMsg('Não consegui ler esse arquivo. Ele precisa ter uma linha de cabeçalho e pelo menos uma carta.')
      return
    }
    setArquivo(lido)
    setNomeArquivo(f.name)
    setPapeis(adivinharColunas(lido.cabecalho))
    setEtapa('mapear')
  }

  function trocarPapel(indice: number, novo: PapelColuna) {
    setPapeis(prev => prev.map((p, i) => {
      if (i === indice) return novo
      // Dois papeis iguais fariam a mesma coluna valer duas coisas.
      if (novo !== 'ignorar' && p === novo) return 'ignorar'
      return p
    }))
  }

  // ── Analise ────────────────────────────────────────────────────────────────

  async function analisarLinhas(itens: LinhaImport[]) {
    setErroMsg('')
    setEtapa('analisando')
    setProgresso({ feitos: 0, total: itens.length })
    cancelado.current = false

    const acumulado: Linha[] = []
    try {
      for (const bloco of emBlocos(itens, TAMANHO_BLOCO)) {
        if (cancelado.current) return
        const { data, error } = await supabase.rpc('analisar_import_lote', { linhas: bloco.map(b => b.linha) })
        if (error) throw error
        // A RPC numera a partir de 1 DENTRO do bloco; aqui a ordem vira global
        // e cada item recupera de qual linha do arquivo veio.
        ;((data || []) as Linha[]).forEach((r, i) => {
          const fonte = bloco[i]
          acumulado.push({ ...r, ordem: acumulado.length + 1, origem: fonte?.origem ?? null, setArquivo: fonte?.setArquivo ?? null })
        })
        setProgresso({ feitos: Math.min(acumulado.length, itens.length), total: itens.length })
      }
      if (cancelado.current) return
      setResultado(acumulado)
      setAba(acumulado.some(r => r.status === 'ok') ? 'ok' : 'corrigir')
      setEtapa('revisao')
    } catch (e) {
      console.error('[ImportarCartas] analisar:', e)
      setErroMsg('Não foi possível analisar. Tente de novo.')
      setEtapa(arquivo ? 'mapear' : 'entrada')
    }
  }

  function analisarColado() {
    if (linhasColadas.length === 0) { setErroMsg('Cole pelo menos uma carta.'); return }
    if (linhasColadas.length > TETO_IMPORTACAO) {
      setErroMsg(`São ${linhasColadas.length} linhas. O limite é ${TETO_IMPORTACAO} por importação.`)
      return
    }
    void analisarLinhas(linhasColadas.map((linha, i) => ({ origem: i + 1, linha, setArquivo: null })))
  }

  /** Uma linha só, depois que a pessoa corrigiu o texto à mão. */
  async function procurarDeNovo(item: Linha) {
    const novaLinha = (rascunho[item.ordem] ?? item.linha).trim()
    if (!novaLinha) return
    setProcurando(item.ordem)
    try {
      const { data, error } = await supabase.rpc('analisar_import_lote', { linhas: [novaLinha] })
      if (error) throw error
      const achado = ((data || []) as Linha[])[0]
      if (!achado) return
      setResultado(prev => (prev || []).map(r => r.ordem === item.ordem
        ? { ...achado, ordem: item.ordem, origem: item.origem, setArquivo: item.setArquivo }
        : r))
    } catch (e) {
      console.error('[ImportarCartas] procurar:', e)
      setErroMsg('Não consegui procurar agora. Tente de novo.')
    } finally {
      setProcurando(null)
    }
  }

  function removerLinha(ordem: number) {
    setResultado(prev => (prev || []).filter(r => r.ordem !== ordem))
  }

  // ── Gravacao ───────────────────────────────────────────────────────────────

  async function adicionar() {
    if (!userId) { setErroMsg('Faça login para adicionar.'); return }
    const items = okItems.map(r => ({ card_id: r.card_id, quantidade: r.quantidade }))
    if (items.length === 0) return

    setAdicionando(true)
    setErroMsg('')
    const soma: Resultado = { adicionadas: 0, incrementadas: 0, processadas: 0, limiteAtingido: false }
    try {
      // Gravar tambem em blocos: o insert e bem mais barato que a busca, mas um
      // jsonb de 500 itens numa transacao so e desnecessario -- e assim o que
      // ja entrou continua valendo se o limite do plano parar no meio.
      for (const bloco of emBlocos(items, 100)) {
        const { data, error } = await supabase.rpc('importar_cartas_lote', { items: bloco })
        if (error) throw error
        const d = (data || {}) as any
        if (d.erro) { setErroMsg(mapErroAdd(String(d.erro))); setAdicionando(false); return }
        soma.adicionadas += Number(d.adicionadas || 0)
        soma.incrementadas += Number(d.incrementadas || 0)
        soma.processadas += Number(d.processadas || 0)
        if (d.limite_atingido) { soma.limiteAtingido = true; break }
      }

      if (soma.limiteAtingido && soma.processadas === 0) {
        setErroMsg(textoLimiteCartas(await limiteAtual()))
        setAdicionando(false)
        return
      }
      if (soma.limiteAtingido) setLimiteDoPlano(await limiteAtual())
      setSucesso(soma)
      setEtapa('sucesso')
    } catch (e: any) {
      console.error('[ImportarCartas] adicionar:', e)
      const limite = limiteCartasDoErro(e)
      setErroMsg(limite !== null ? textoLimiteCartas(limite) : mapErroAdd(e?.code || e?.message || ''))
      setAdicionando(false)
    }
  }

  async function limiteAtual(): Promise<number> {
    if (!userId) return 100
    const { limite } = await checkCardLimit(userId)
    return Number.isFinite(limite) ? limite : 100
  }

  function voltarDoResultado() {
    setResultado(null)
    setRascunho({})
    setErroMsg('')
    setEtapa(arquivo ? 'mapear' : 'entrada')
  }

  function recomecar() {
    setArquivo(null); setNomeArquivo(''); setPapeis([]); setResultado(null)
    setRascunho({}); setErroMsg(''); setEtapa('entrada')
  }

  function concluir() { onAdded(); onClose() }

  // ── Render ─────────────────────────────────────────────────────────────────

  const subtitulo =
    etapa === 'mapear' ? 'Diga o que é cada coluna do arquivo.'
    : etapa === 'analisando' ? 'Procurando as cartas no catálogo.'
    : etapa === 'revisao' ? 'Confira antes de adicionar.'
    : etapa === 'sucesso' ? '' : `Arquivo ou lista colada. Até ${TETO_IMPORTACAO} cartas por vez.`

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16,
      }}
      onClick={sucesso || etapa === 'analisando' ? undefined : onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          background: '#12141a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18,
          overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* HEADER */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#f0f0f0' }}>Importar várias cartas</p>
            {subtitulo && <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{subtitulo}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: MUTED, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1 }}>

          {/* ---- SUCESSO ---- */}
          {etapa === 'sucesso' && sucesso && (
            <div style={{ textAlign: 'center', padding: '18px 8px 8px' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>
                {sucesso.processadas} carta{sucesso.processadas !== 1 ? 's' : ''} na sua coleção!
              </p>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                {sucesso.adicionadas > 0 && <>{sucesso.adicionadas} nova{sucesso.adicionadas !== 1 ? 's' : ''}</>}
                {sucesso.adicionadas > 0 && sucesso.incrementadas > 0 && ' · '}
                {sucesso.incrementadas > 0 && <>{sucesso.incrementadas} já tinha — somei a quantidade</>}
              </p>
              {sucesso.limiteAtingido && (
                <p style={{ fontSize: 13, color: 'var(--ac-1)', marginTop: 12, lineHeight: 1.6 }}>
                  O resto da lista não entrou. {textoLimiteCartas(limiteDoPlano)}{' '}
                  <a href="/planos" style={{ color: 'var(--ac-1)', fontWeight: 700 }}>Ver planos</a>
                </p>
              )}
              <p style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>A condição você ajusta depois, direto na coleção.</p>
            </div>
          )}

          {/* ---- ENTRADA ---- */}
          {etapa === 'entrada' && (
            <>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); void aoEscolherArquivo(e.dataTransfer.files?.[0]) }}
                style={{ border: '1.5px dashed rgba(255,255,255,0.14)', borderRadius: 14, padding: '26px 20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{ color: MUTED, marginBottom: 8 }}>
                  <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>Arraste o arquivo aqui</p>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, maxWidth: '46ch', margin: '0 auto' }}>
                  CSV ou TXT, até {TETO_IMPORTACAO} cartas. Serve o arquivo que você exporta da Bynx e o de outros
                  aplicativos de coleção.
                </p>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  style={{ display: 'none' }}
                  onChange={e => { void aoEscolherArquivo(e.target.files?.[0]); e.target.value = '' }}
                />
                <button
                  onClick={() => inputArquivo.current?.click()}
                  style={{ marginTop: 12, minHeight: 44, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Escolher arquivo
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', color: MUTED, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <i style={{ height: 1, background: 'rgba(255,255,255,0.08)', flex: 1 }} />ou cole a lista<i style={{ height: 1, background: 'rgba(255,255,255,0.08)', flex: 1 }} />
              </div>

              <textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={5}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', color: '#f0f0f0', fontSize: 16, lineHeight: 1.7, outline: 'none', boxSizing: 'border-box', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', resize: 'vertical' }}
              />
              <p style={{ fontSize: 12, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
                Formato: <span style={{ color: 'rgba(255,255,255,0.6)' }}>nome + número/set</span> (ex:{' '}
                <span style={{ fontFamily: 'monospace' }}>Avalugg 024/086</span>). Sem o número a linha não é
                reconhecida. Quantidade com <span style={{ fontFamily: 'monospace' }}>2x</span> no início.
              </p>
              {erroMsg && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 10 }}>{erroMsg}</p>}
            </>
          )}

          {/* ---- MAPEAR COLUNAS ---- */}
          {etapa === 'mapear' && arquivo && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 11, background: 'rgba(255,255,255,0.02)', marginBottom: 16 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M5 2.5h6l4 4v11a1 1 0 01-1 1H5a1 1 0 01-1-1v-14a1 1 0 011-1z" stroke={MUTED} strokeWidth="1.3" strokeLinejoin="round" />
                  <path d="M11 2.5v4h4" stroke={MUTED} strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeArquivo}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{arquivo.linhas.length} linha{arquivo.linhas.length !== 1 ? 's' : ''}</div>
                </div>
                <button onClick={recomecar} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--ac-1)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, minHeight: 44 }}>
                  Trocar arquivo
                </button>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {arquivo.cabecalho.map((col, i) => (
                        <th key={i} style={{ textAlign: 'left', padding: '9px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', minWidth: 130 }}>
                          <div style={{ fontSize: 10.5, color: MUTED, fontFamily: 'monospace', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col || '(sem nome)'}</div>
                          <select
                            value={papeis[i] || 'ignorar'}
                            onChange={e => trocarPapel(i, e.target.value as PapelColuna)}
                            style={{ width: '100%', minHeight: 34, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '5px 7px', borderRadius: 7, background: '#0d0f14', color: papeis[i] && papeis[i] !== 'ignorar' ? 'var(--ac-1)' : MUTED, border: `1px solid ${papeis[i] && papeis[i] !== 'ignorar' ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.1)'}` }}
                          >
                            {PAPEIS.map(p => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {arquivo.linhas.slice(0, 3).map((linha, i) => (
                      <tr key={i}>
                        {arquivo.cabecalho.map((_, j) => (
                          <td key={j} style={{ padding: '8px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none', color: 'rgba(255,255,255,0.72)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                            {linha[j] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
                Nome e número são obrigatórios. Sem o número não dá para saber de qual set é a carta, e casar só
                pelo nome erra. A condição não é importada.
              </p>
              {!temNome || !temNumero ? (
                <p style={{ fontSize: 13, color: 'var(--ac-1)', marginTop: 8 }}>
                  Escolha qual coluna é o {!temNome ? 'nome' : 'número'} para continuar.
                </p>
              ) : excedeTeto ? (
                <p style={{ fontSize: 13, color: 'var(--ac-1)', marginTop: 8 }}>
                  O arquivo tem {linhasDoArquivo.length} cartas e o limite é {TETO_IMPORTACAO} por importação.
                  As primeiras {TETO_IMPORTACAO} entram agora; o resto você importa num segundo arquivo.
                </p>
              ) : null}
              {erroMsg && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 8 }}>{erroMsg}</p>}
            </>
          )}

          {/* ---- ANALISANDO ---- */}
          {etapa === 'analisando' && (
            <div style={{ textAlign: 'center', padding: '26px 8px' }}>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Procurando as cartas no catálogo</p>
              <p style={{ fontSize: 12.5, color: MUTED, marginBottom: 20 }}>Pode deixar a tela aberta. Nada é gravado ainda.</p>
              <div style={{ maxWidth: 380, margin: '0 auto' }}>
                <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <i style={{ display: 'block', height: '100%', borderRadius: 99, background: BRAND, width: `${progresso.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0}%`, transition: 'width 0.2s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
                  <span>{progresso.feitos} de {progresso.total}</span>
                  <span>{progresso.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          )}

          {/* ---- REVISAO ---- */}
          {etapa === 'revisao' && resultado && (
            <>
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 14 }}>
                {([['ok', 'Prontas', okItems.length], ['corrigir', 'Para corrigir', erroItems.length]] as const).map(([chave, label, n]) => (
                  <button
                    key={chave}
                    onClick={() => setAba(chave)}
                    style={{ background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer', minHeight: 44, fontSize: 13, fontWeight: 700, color: aba === chave ? '#f0f0f0' : MUTED, padding: '9px 13px', borderBottom: `2px solid ${aba === chave ? '#f59e0b' : 'transparent'}`, marginBottom: -1, display: 'inline-flex', gap: 7, alignItems: 'center' }}
                  >
                    {label}
                    <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 99, background: aba === chave ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)', color: aba === chave ? 'var(--ac-1)' : MUTED }}>{n}</span>
                  </button>
                ))}
              </div>

              {aba === 'ok' && (
                okItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: MUTED, textAlign: 'center', padding: '18px 0' }}>Nenhuma carta casou com o catálogo. Corrija as linhas na outra aba.</p>
                ) : (
                  <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                    {okItems.map((r, i) => {
                      const diverge = setDivergente(r.setArquivo, r.card_set)
                      return (
                        <div key={r.ordem} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < okItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                          <div style={{ width: 28, height: 39, borderRadius: 4, flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                            {r.card_image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.card_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.card_name}</div>
                            <div style={{ fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.card_set}{r.card_number ? ` · ${r.card_number}` : ''}
                            </div>
                            {/* O set do arquivo nao entra no casamento -- mas quando difere
                                do encontrado, e sinal de carta parecida de outro set. */}
                            {diverge && (
                              <div style={{ fontSize: 11.5, color: 'var(--ac-1)', marginTop: 2 }}>
                                No arquivo estava: {r.setArquivo}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '2px 8px', flexShrink: 0 }}>{r.quantidade}x</span>
                          <button onClick={() => removerLinha(r.ordem)} title="Tirar da importação" style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', flexShrink: 0, minHeight: 44 }}>Tirar</button>
                        </div>
                      )
                    })}
                  </div>
                )
              )}

              {aba === 'corrigir' && (
                erroItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#22c55e', textAlign: 'center', padding: '18px 0' }}>Tudo casou. Nada para corrigir.</p>
                ) : (
                  <>
                    {erroItems.map(r => (
                      <div key={r.ordem} style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)', borderRadius: 11, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ac-1)' }}>{msgErro(r.status)}</span>
                          {r.origem != null && <span style={{ fontSize: 11.5, color: MUTED, fontFamily: 'monospace' }}>linha {r.origem}</span>}
                          <button onClick={() => removerLinha(r.ordem)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>Remover</button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            value={rascunho[r.ordem] ?? r.linha}
                            onChange={e => setRascunho(prev => ({ ...prev, [r.ordem]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') void procurarDeNovo(r) }}
                            style={{ flex: 1, minWidth: 0, minHeight: 40, background: '#0d0f14', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '8px 10px', color: '#f0f0f0', fontSize: 16, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                          />
                          <button
                            onClick={() => void procurarDeNovo(r)}
                            disabled={procurando === r.ordem}
                            style={{ flexShrink: 0, minHeight: 40, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#f0f0f0', padding: '9px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: procurando === r.ordem ? 0.5 : 1 }}
                          >
                            {procurando === r.ordem ? '…' : 'Procurar'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                      Dá para continuar sem corrigir: as linhas pendentes ficam de fora e o arquivo não muda.
                    </p>
                  </>
                )
              )}

              {erroMsg && <p style={{ fontSize: 13, color: '#ef4444', marginTop: 10 }}>{erroMsg}</p>}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          {etapa === 'sucesso' ? (
            <button onClick={concluir} style={primaryBtn(true)}>Concluir</button>
          ) : etapa === 'entrada' ? (
            <button onClick={analisarColado} disabled={linhasColadas.length === 0} style={primaryBtn(linhasColadas.length > 0)}>
              Analisar{linhasColadas.length > 0 ? ` ${linhasColadas.length}` : ''}
            </button>
          ) : etapa === 'mapear' ? (
            <>
              <span style={{ marginRight: 'auto', fontSize: 12.5, color: MUTED }}>
                {linhasDoArquivo.length} carta{linhasDoArquivo.length !== 1 ? 's' : ''} no arquivo
              </span>
              <button onClick={recomecar} style={secundarioBtn(false)}>Voltar</button>
              <button
                onClick={() => void analisarLinhas(linhasDoArquivo.slice(0, TETO_IMPORTACAO))}
                disabled={!temNome || !temNumero || linhasDoArquivo.length === 0}
                style={primaryBtn(temNome && temNumero && linhasDoArquivo.length > 0)}
              >
                Analisar {Math.min(linhasDoArquivo.length, TETO_IMPORTACAO)}
              </button>
            </>
          ) : etapa === 'analisando' ? (
            <button onClick={() => { cancelado.current = true; voltarDoResultado() }} style={secundarioBtn(false)}>Cancelar</button>
          ) : (
            <>
              <span style={{ marginRight: 'auto', fontSize: 12.5, color: MUTED }}>
                {erroItems.length > 0 ? `${erroItems.length} sem casar ${erroItems.length === 1 ? 'fica' : 'ficam'} de fora` : 'Tudo casou'}
              </span>
              <button onClick={voltarDoResultado} disabled={adicionando} style={secundarioBtn(adicionando)}>Voltar</button>
              <button onClick={() => void adicionar()} disabled={adicionando || okItems.length === 0} style={primaryBtn(okItems.length > 0 && !adicionando)}>
                {adicionando ? 'Adicionando...' : `Adicionar ${okItems.length} carta${okItems.length !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function primaryBtn(ativo: boolean): React.CSSProperties {
  return {
    background: ativo ? BRAND : 'rgba(255,255,255,0.06)',
    border: 'none',
    color: ativo ? '#000' : MUTED,
    padding: '11px 22px',
    minHeight: 44,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: ativo ? 'pointer' : 'default',
    fontFamily: 'inherit',
    boxShadow: ativo ? '0 0 20px rgba(245,158,11,0.2)' : 'none',
  }
}

function secundarioBtn(desativado: boolean): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: MUTED,
    padding: '11px 18px',
    minHeight: 44,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    cursor: desativado ? 'default' : 'pointer',
    fontFamily: 'inherit',
    opacity: desativado ? 0.5 : 1,
  }
}
