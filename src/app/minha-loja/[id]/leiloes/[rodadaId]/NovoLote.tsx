'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import CardItem, { type CardItemData } from '@/components/ui/CardItem'
import { IconClose, IconImage, IconSearch } from '@/components/ui/Icons'
import { CAMPO_VALOR, getPrecoVariante, getVarianteEfetiva } from '@/lib/calcPatrimonio'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { GRADUADORAS } from '@/lib/graduadoras'
import { formatarBRL } from '@/lib/leilao'
import {
  CONDICOES_LOTE, DURACOES_LOTE, IDIOMAS_LOTE, FRACAO_SUGESTAO,
  reaisParaCents, sugestaoLanceInicialCents, validarLote,
  type CondicaoLote, type DuracaoLote, type IdiomaLote,
} from '@/lib/leilao-painel'
import { chamarPainel } from '../_rodada'

/**
 * Adicionar lote a uma rodada em rascunho.
 *
 * 1. Carta: busca no catalogo pela MESMA RPC do AddCardModal/comparador
 *    (smart_search_cards_v5, paginada em 12) ou escolha na colecao do dono
 *    (precos pelo /api/cards/lookup, por id). Nenhuma query nova no catalogo.
 * 2. Detalhes: frente e verso (obrigatorias), condicao, idioma, graduacao,
 *    descricao, lance inicial e duracao.
 *
 * Sugestao de lance: 60% do MENOR preco do Mercado Brasileiro da variante com
 * preco (CAMPO_VALOR de calcPatrimonio). So sugere; o campo fica com a loja.
 */

const PAGE = 12
const IDIOMA_ROTULO: Record<string, string> = {
  pt: 'PT', en: 'EN', jp: 'JP', es: 'ES', fr: 'FR', de: 'DE', it: 'IT', cn: 'CN', kr: 'KR',
}

type Linha = Record<string, unknown>
const txt = (v: unknown): string | undefined => (v == null || v === '' ? undefined : String(v))
interface Escolhida {
  row: Linha
  variante: string | null
}

function menorPreco(row: Linha, variante: string | null): number {
  const v = getVarianteEfetiva(row, variante)
  return getPrecoVariante(row, v)[CAMPO_VALOR] || 0
}

function cardDaLinha(row: Linha): CardItemData {
  return {
    id: String(row.id),
    name: txt(row.name),
    number: txt(row.number),
    set_name: txt(row.set_name),
    set_total: txt(row.set_total),
    image_small: txt(row.image_small),
    rarity: txt(row.rarity),
  }
}

export default function NovoLote({
  lojaId, rodadaId, onCriado, onCancelar, onEnviando,
}: {
  lojaId: string
  rodadaId: string
  onCriado: () => void
  onCancelar: () => void
  /** true enquanto o POST do lote esta no ar: o editor trava o Agendar. */
  onEnviando?: (enviando: boolean) => void
}) {
  const [aba, setAba] = useState<'catalogo' | 'colecao'>('catalogo')
  const [escolhida, setEscolhida] = useState<Escolhida | null>(null)

  // detalhes
  const [frente, setFrente] = useState<string | null>(null)
  const [verso, setVerso] = useState<string | null>(null)
  const [subindo, setSubindo] = useState<'frente' | 'verso' | null>(null)
  const [condicao, setCondicao] = useState<CondicaoLote | null>(null)
  const [idioma, setIdioma] = useState<IdiomaLote>('pt')
  const [graduadora, setGraduadora] = useState('')
  const [nota, setNota] = useState('')
  const [descricao, setDescricao] = useState('')
  const [lanceTxt, setLanceTxt] = useState('')
  const [duracao, setDuracao] = useState<DuracaoLote>(45)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fileFrente = useRef<HTMLInputElement>(null)
  const fileVerso = useRef<HTMLInputElement>(null)

  function escolher(row: Linha, variante: string | null, idiomaColecao?: string | null) {
    setEscolhida({ row, variante })
    const id = String(idiomaColecao ?? '').toLowerCase()
    if ((IDIOMAS_LOTE as readonly string[]).includes(id)) setIdioma(id as IdiomaLote)
    setErro(null)
  }

  async function subir(lado: 'frente' | 'verso', f: File) {
    setSubindo(lado)
    setErro(null)
    try {
      const arquivo = await comprimirImagem(f, { maxLado: 1600 })
      const fd = new FormData()
      fd.append('file', arquivo)
      const j = await chamarPainel<{ url: string }>(`/api/lojas/${lojaId}/leiloes/foto`, { method: 'POST', body: fd })
      if (lado === 'frente') setFrente(j.url)
      else setVerso(j.url)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSubindo(null)
      const ref = lado === 'frente' ? fileFrente : fileVerso
      if (ref.current) ref.current.value = ''
    }
  }

  const preco = escolhida ? menorPreco(escolhida.row, escolhida.variante) : 0
  const sugestao = sugestaoLanceInicialCents(preco)

  async function salvar() {
    if (!escolhida) return
    const corpo = {
      card_id: String(escolhida.row.id),
      fotos: [frente, verso].filter(Boolean),
      condicao,
      idioma,
      graduadora: graduadora || null,
      nota: graduadora ? nota : null,
      descricao: descricao.trim() || null,
      lance_inicial_cents: reaisParaCents(lanceTxt),
      duracao_seg: duracao,
    }
    // Mesma validacao do servidor, so para avisar antes (a URL da foto o
    // servidor confere com fotoLeilaoValida; aqui so conta as duas).
    const v = validarLote(corpo, { fotosDaLoja: null, graduadorasValidas: GRADUADORAS.map(g => g.slug) })
    if (!v.ok) { setErro(v.erro); return }
    setSalvando(true)
    setErro(null)
    onEnviando?.(true)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/${rodadaId}/lotes`, { method: 'POST', body: JSON.stringify(corpo) })
      onEnviando?.(false)
      onCriado()
    } catch (e) {
      onEnviando?.(false)
      setErro((e as Error).message)
      setSalvando(false)
    }
  }

  return (
    <div style={S.box}>
      <div style={S.topo}>
        <div style={S.cap}>{escolhida ? 'Detalhes do lote' : 'Escolha a carta'}</div>
        <button onClick={onCancelar} style={S.btnIcone} aria-label="Fechar"><IconClose size={18} /></button>
      </div>

      {!escolhida ? (
        <>
          <div style={S.abas} role="tablist">
            {(['catalogo', 'colecao'] as const).map(a => (
              <button
                key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
                style={{ ...S.aba, ...(aba === a ? S.abaOn : null) }}
              >
                {a === 'catalogo' ? 'Catálogo' : 'Minha coleção'}
              </button>
            ))}
          </div>
          {aba === 'catalogo'
            ? <BuscaCatalogo onPick={row => escolher(row, null)} />
            : <DaColecao onPick={(row, variante, idi) => escolher(row, variante, idi)} />}
        </>
      ) : (
        <>
          <div style={S.escolhida}>
            <div style={{ width: 120, flexShrink: 0 }}>
              <CardItem card={cardDaLinha(escolhida.row)} mode="readonly" hidePriceTable ocultarIdioma ocultarSemPreco />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={S.nomeCarta}>{txt(escolhida.row.name)}</div>
              <div style={S.hint}>
                {preco > 0
                  ? `Menor preço no Mercado Brasileiro: ${formatarBRL(Math.round(preco * 100))}`
                  : 'Sem preço no Mercado Brasileiro para esta carta.'}
              </div>
              <button onClick={() => setEscolhida(null)} style={S.btnGhost}>Trocar carta</button>
            </div>
          </div>

          <label style={S.lbl}>Fotos reais da carta (obrigatórias)</label>
          <div style={S.fotos}>
            {([['frente', frente, setFrente, fileFrente], ['verso', verso, setVerso, fileVerso]] as const).map(
              ([lado, url, set, ref]) => (
                <div key={lado} style={S.fotoCol}>
                  {url ? (
                    <div style={S.foto}>
                      <Image src={url} alt={lado === 'frente' ? 'Frente da carta' : 'Verso da carta'} fill sizes="128px" style={{ objectFit: 'cover' }} />
                      {/* Alvo de toque 44x44 no canto; o circulo visivel continua de 30px. */}
                      <button type="button" onClick={() => set(null)} style={S.remFoto} aria-label={`Remover foto do ${lado}`}>
                        <span style={S.remFotoCirculo}><IconClose size={14} /></span>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => ref.current?.click()} disabled={subindo !== null} style={S.addFoto}>
                      <IconImage size={22} />
                      <span>{subindo === lado ? 'Enviando…' : lado === 'frente' ? 'Frente' : 'Verso'}</span>
                    </button>
                  )}
                  <input
                    ref={ref} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) subir(lado, f) }}
                  />
                </div>
              )
            )}
          </div>
          <p style={S.hint}>Foto da carta que vai ser enviada, não a imagem do catálogo. JPG, PNG ou WEBP até 5 MB.</p>

          <label style={S.lbl}>Condição</label>
          <div style={S.chips}>
            {CONDICOES_LOTE.map(c => (
              <button key={c} onClick={() => setCondicao(c)} aria-pressed={condicao === c} style={{ ...S.chip, ...(condicao === c ? S.chipOn : null) }}>{c}</button>
            ))}
          </div>

          <label style={S.lbl}>Idioma</label>
          <div style={S.chips}>
            {IDIOMAS_LOTE.map(i => (
              <button key={i} onClick={() => setIdioma(i)} aria-pressed={idioma === i} style={{ ...S.chip, ...(idioma === i ? S.chipOn : null) }}>{IDIOMA_ROTULO[i]}</button>
            ))}
          </div>

          <div style={S.two}>
            <div>
              <label style={S.lbl} htmlFor="lote-grad">Graduadora (opcional)</label>
              <select id="lote-grad" value={graduadora} onChange={e => { setGraduadora(e.target.value); if (!e.target.value) setNota('') }} style={S.input}>
                <option value="">Sem graduação</option>
                {GRADUADORAS.map(g => <option key={g.slug} value={g.slug}>{g.curto}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl} htmlFor="lote-nota">Nota</label>
              <input
                id="lote-nota" value={nota} onChange={e => setNota(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 4))}
                placeholder={graduadora ? 'Ex: 9,5' : 'Sem graduação'} disabled={!graduadora} inputMode="decimal" style={S.input}
              />
            </div>
          </div>

          <label style={S.lbl} htmlFor="lote-desc">Descrição (opcional)</label>
          <textarea
            id="lote-desc" value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} maxLength={1000}
            placeholder="Detalhes que a foto não mostra: centralização, marcas, borda…"
            style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }}
          />

          <label style={S.lbl} htmlFor="lote-lance">Lance inicial</label>
          <div style={S.inputWrap}>
            <span style={S.prefixo}>R$</span>
            <input
              id="lote-lance" value={lanceTxt} onChange={e => setLanceTxt(e.target.value)} inputMode="decimal"
              placeholder={sugestao ? (sugestao / 100).toFixed(2).replace('.', ',') : '10,00'} style={S.inputBare}
            />
          </div>
          {sugestao ? (
            <div style={S.sugestao}>
              <span style={S.hint}>
                Sugestão: {formatarBRL(sugestao)} ({Math.round(FRACAO_SUGESTAO * 100)}% do menor preço do Mercado Brasileiro)
              </span>
              <button onClick={() => setLanceTxt((sugestao / 100).toFixed(2).replace('.', ','))} style={S.btnGhost}>Usar sugestão</button>
            </div>
          ) : (
            <p style={S.hint}>Sem preço de referência: defina o lance inicial pelo seu conhecimento da carta.</p>
          )}

          <label style={S.lbl}>Duração do lote</label>
          <div style={S.chips}>
            {DURACOES_LOTE.map(d => (
              <button key={d} onClick={() => setDuracao(d)} aria-pressed={duracao === d} style={{ ...S.chip, ...(duracao === d ? S.chipOn : null) }}>{d}s</button>
            ))}
          </div>
          <p style={S.hint}>Lance nos últimos 10 segundos estende o lote em mais 10.</p>

          {erro && <div style={S.erro} role="alert">{erro}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={salvar} disabled={salvando || subindo !== null} style={{ ...S.btnPrim, flex: 1, opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando…' : 'Adicionar lote'}
            </button>
            <button onClick={onCancelar} style={S.btnGhost}>Cancelar</button>
          </div>
        </>
      )}
      {!escolhida && erro && <div style={S.erro} role="alert">{erro}</div>}
    </div>
  )
}

// ─── Catalogo: smart_search_cards_v5 (mesma RPC do AddCardModal) ────────────

function BuscaCatalogo({ onPick }: { onPick: (row: Linha) => void }) {
  const [termo, setTermo] = useState('')
  const [rows, setRows] = useState<Linha[]>([])
  const [buscando, setBuscando] = useState(false)
  const [temMais, setTemMais] = useState(false)
  const [maisCarregando, setMaisCarregando] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  // O estado imediato (limpar, "Buscando...") muda no onChange; o efeito so
  // agenda a busca com debounce.
  function digitar(v: string) {
    setTermo(v)
    if (v.trim().length < 2) { setRows([]); setTemMais(false); setBuscando(false) }
    else setBuscando(true)
  }

  useEffect(() => {
    if (t.current) clearTimeout(t.current)
    if (termo.trim().length < 2) return
    t.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc('smart_search_cards_v5', { q: termo, limit_n: PAGE, offset_n: 0 })
      const r: Linha[] = error ? [] : (data || [])
      setRows(r)
      setTemMais(r.length === PAGE)
      setBuscando(false)
    }, 350)
    return () => { if (t.current) clearTimeout(t.current) }
  }, [termo])

  async function mais() {
    if (maisCarregando) return
    setMaisCarregando(true)
    const { data, error } = await supabase.rpc('smart_search_cards_v5', { q: termo, limit_n: PAGE, offset_n: rows.length })
    const r: Linha[] = error ? [] : (data || [])
    setRows(prev => {
      const vistos = new Set(prev.map(x => String(x.id)))
      return [...prev, ...r.filter(x => !vistos.has(String(x.id)))]
    })
    setTemMais(r.length === PAGE)
    setMaisCarregando(false)
  }

  return (
    <div>
      <div style={S.busca}>
        <IconSearch size={16} />
        <input
          autoFocus value={termo} onChange={e => digitar(e.target.value)} maxLength={60}
          placeholder="Nome ou número da carta (ex: Charizard 199)" style={S.inputBare} aria-label="Buscar carta no catálogo"
        />
      </div>
      {buscando && <p style={S.hint}>Buscando…</p>}
      {!buscando && termo.trim().length >= 2 && rows.length === 0 && <p style={S.hint}>Nenhuma carta encontrada.</p>}
      <Grade rows={rows} onPick={row => onPick(row)} />
      {temMais && (
        <button onClick={mais} disabled={maisCarregando} style={{ ...S.btnGhost, width: '100%', marginTop: 10 }}>
          {maisCarregando ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </div>
  )
}

// ─── Colecao do dono: user_cards + precos pelo /api/cards/lookup ────────────

function DaColecao({ onPick }: { onPick: (row: Linha, variante: string | null, idioma: string | null) => void }) {
  const [itens, setItens] = useState<Array<{ uc: Linha; row: Linha }>>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user?.id
      if (!uid) { if (vivo) setCarregando(false); return }
      const { data: ucs } = await supabase
        .from('user_cards')
        .select('id, card_name, pokemon_api_id, variante, idioma')
        .eq('user_id', uid)
        .not('pokemon_api_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300)
      const ids = [...new Set((ucs || []).map((u: Linha) => txt(u.pokemon_api_id)).filter(Boolean))]
      let mapa: Record<string, Linha> = {}
      if (ids.length) {
        const cards: Linha[] = await fetch('/api/cards/lookup', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
        }).then(r => r.json()).then(d => d.cards || []).catch(() => [])
        mapa = Object.fromEntries(cards.map(c => [String(c.id), c]))
      }
      const lista = (ucs || []).filter((u: Linha) => mapa[String(u.pokemon_api_id)]).map((u: Linha) => ({ uc: u as Linha, row: mapa[String(u.pokemon_api_id)] }))
      if (vivo) { setItens(lista); setCarregando(false) }
    })()
    return () => { vivo = false }
  }, [])

  const f = filtro.trim().toLowerCase()
  const visiveis = f ? itens.filter(i => String(i.row.name ?? i.uc.card_name ?? '').toLowerCase().includes(f)) : itens

  return (
    <div>
      <div style={S.busca}>
        <IconSearch size={16} />
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar sua coleção" style={S.inputBare} aria-label="Filtrar coleção" />
      </div>
      {carregando ? <p style={S.hint}>Carregando sua coleção…</p>
        : visiveis.length === 0 ? <p style={S.hint}>Nenhuma carta da sua coleção ligada ao catálogo.</p>
        : (
          <div style={S.grade}>
            {visiveis.slice(0, 60).map(({ uc, row }) => (
              <CardItem
                key={String(uc.id)} card={{ ...cardDaLinha(row), idioma: txt(uc.idioma) }} mode="select" hidePriceTable ocultarSemPreco
                onSelect={() => onPick(row, txt(uc.variante) ?? null, txt(uc.idioma) ?? null)}
                badge={<PrecoBadge valor={menorPreco(row, txt(uc.variante) ?? null)} />}
              />
            ))}
          </div>
        )}
    </div>
  )
}

function Grade({ rows, onPick }: { rows: Linha[]; onPick: (row: Linha) => void }) {
  if (rows.length === 0) return null
  return (
    <div style={S.grade}>
      {rows.map(row => (
        <CardItem
          key={String(row.id)} card={cardDaLinha(row)} mode="select" hidePriceTable ocultarIdioma ocultarSemPreco
          onSelect={() => onPick(row)} badge={<PrecoBadge valor={menorPreco(row, null)} />}
        />
      ))}
    </div>
  )
}

function PrecoBadge({ valor }: { valor: number }) {
  if (!valor) return null
  return <span style={S.badge}>{formatarBRL(Math.round(valor * 100))}</span>
}

const S: Record<string, CSSProperties> = {
  box: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16, padding: 16 },
  topo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  cap: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)' },
  btnIcone: {
    width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: '1px solid var(--bx-border)', borderRadius: 10, color: 'var(--bx-text-2)', cursor: 'pointer',
  },
  abas: { display: 'flex', gap: 6, marginBottom: 12 },
  aba: {
    flex: 1, minHeight: 44, borderRadius: 10, border: '1px solid var(--bx-border)', background: 'var(--bx-surface-2)',
    color: 'var(--bx-text-2)', fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },
  abaOn: { background: 'rgba(var(--ac-1-rgb), 0.12)', borderColor: 'rgba(var(--ac-1-rgb), 0.4)', color: 'var(--bx-text)' },
  busca: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', minHeight: 44, marginBottom: 10,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, color: 'var(--bx-text-3)',
  },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, 100%), 1fr))', gap: 10 },
  badge: { fontSize: 11.5, fontWeight: 800, color: 'var(--bx-text)', background: 'var(--bx-surface-3)', padding: '2px 7px', borderRadius: 6 },
  escolhida: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 4 },
  nomeCarta: { fontSize: 15, fontWeight: 800, color: 'var(--bx-text)' },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--bx-text-2)', marginBottom: 6, marginTop: 14 },
  hint: { fontSize: 12, color: 'var(--bx-text-3)', marginTop: 6, lineHeight: 1.45 },
  fotos: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, maxWidth: 280 },
  fotoCol: { minWidth: 0 },
  foto: { position: 'relative', width: '100%', aspectRatio: '63 / 88', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bx-border)' },
  remFoto: {
    position: 'absolute', top: 0, right: 0, width: 44, height: 44, background: 'transparent',
    color: 'var(--bx-text)', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  remFotoCirculo: {
    width: 30, height: 30, borderRadius: '50%', background: 'var(--bx-scrim)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  addFoto: {
    width: '100%', aspectRatio: '63 / 88', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, background: 'var(--bx-surface-2)', border: '1px dashed var(--bx-border-2)', color: 'var(--bx-text-2)',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    minWidth: 44, minHeight: 44, boxSizing: 'border-box', padding: '0 14px', borderRadius: 999,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)',
    fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
  },
  chipOn: { background: 'rgba(var(--ac-1-rgb), 0.14)', borderColor: 'rgba(var(--ac-1-rgb), 0.45)', color: 'var(--bx-text)' },
  two: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 },
  input: {
    width: '100%', boxSizing: 'border-box', minHeight: 44, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)',
    borderRadius: 9, padding: '10px 12px', fontSize: 16, color: 'var(--bx-text)', outline: 'none',
  },
  inputWrap: {
    display: 'flex', alignItems: 'center', minHeight: 44, background: 'var(--bx-surface-2)',
    border: '1px solid var(--bx-border-2)', borderRadius: 9, padding: '0 12px',
  },
  inputBare: {
    flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'var(--bx-text)',
    fontSize: 16, padding: '10px 0',
  },
  prefixo: { fontSize: 13, color: 'var(--bx-text-3)', marginRight: 6 },
  sugestao: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  btnPrim: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, boxSizing: 'border-box',
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 0, cursor: 'pointer',
  },
  btnGhost: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, boxSizing: 'border-box',
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  erro: {
    marginTop: 12, background: 'color-mix(in srgb, var(--bx-red) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--bx-red) 25%, transparent)', color: 'var(--bx-red)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
  },
}
