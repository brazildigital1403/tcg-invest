'use client'

/**
 * GradeTique: a grade de tique usada na aba Buscar do "Adicionar carta" e na
 * tela /minha-colecao/por-set/[setId]. Um comportamento so, em dois lugares:
 * tocar marca/desmarca, carta que a pessoa ja tem em verde com "+", padrao do
 * lote, ajuste por carta pelo icone, barra fixa, folha "Seu lote", trava do
 * limite e toast com Desfazer.
 *
 * A selecao vive FORA (prop `selecao`), para sobreviver a nova busca. O que
 * vive aqui dentro: folhas abertas, toast, otimismo das pilhas depois de
 * salvar e o cache das cartas ja vistas (o lote pode conter cartas de buscas
 * anteriores que nao estao mais em `cartas`).
 */

import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import CardItem from '@/components/ui/CardItem'
import { IconCheck, IconPlus, IconWarning } from '@/components/ui/Icons'
import { FONTE, IconAjuste, IconCadeado, Pilula, Portal, Z_TOAST } from './TiqueBase'
import FolhaAjusteCarta from './FolhaAjusteCarta'
import FolhaLote, { LinhaLote } from './FolhaLote'
import BarraLote from './BarraLote'
import {
  AjusteCarta, CartaTique, ItemLote, PadraoLote, PilhaCarta, PlanoTique, ResultadoLote,
  calcularVagas, gastaVaga, numeroESet, pilulaDe, precoUnitario, precosParaCardPrice, resolverItem, totalTenho,
} from './tiqueComum'

// Tudo que a integracao precisa sai daqui.
export type { CartaTique, PadraoLote, AjusteCarta, ItemLote, ResultadoLote, PilhaCarta, PlanoTique, Vagas } from './tiqueComum'
export { calcularVagas, resolverItem, pilulaDe, precoUnitario, PADRAO_INICIAL } from './tiqueComum'
export { ChipPadraoLote, default as FolhaPadraoLote } from './FolhaPadraoLote'
export { ListaLote, default as FolhaLote } from './FolhaLote'
export type { LinhaLote } from './FolhaLote'
export { default as FolhaAjusteCarta } from './FolhaAjusteCarta'
export { default as BarraLote } from './BarraLote'

export interface GradeTiqueProps {
  /** O que esta na tela (resultado da busca ou o set). */
  cartas: CartaTique[]
  /** card_id -> ajuste (vazio = padrao do lote). Estado vem de fora. */
  selecao: Map<string, AjusteCarta>
  onSelecaoChange: (s: Map<string, AjusteCarta>) => void
  padrao: PadraoLote
  onPadraoChange: (p: PadraoLote) => void
  /** limite -1 = sem limite; totalAtual = linhas em user_cards hoje. */
  plano: PlanoTique
  /** busca: barra com "M neste resultado" e "Ver as N"; set: sem "Ver as N". */
  modo: 'busca' | 'set'
  /** Padrao 3 / 7 (set) e 3 / 6 (busca). */
  colunas?: { mobile: number; desktop: number }
  /** No desktop do modal o lote ja aparece no painel ao lado: esconde o Ver as N da barra. */
  ocultarVerAsN?: boolean
  /** Quem chama grava (RPC colecao_adicionar_lote). null = falhou. */
  onSalvar: (itens: ItemLote[]) => Promise<ResultadoLote | null>
  onDesfazer: (r: ResultadoLote) => Promise<void>
  /** Para a tela atualizar progresso / recarregar. */
  onSalvo?: (r: ResultadoLote) => void
  /** Opcional, entra no fim da barra (ex.: "Ver planos"). */
  rodape?: ReactNode
}

type Toast = { tipo: 'ok' | 'aviso' | 'erro'; texto: string; desfazer?: () => void }
type Recente = { tipo: 'entrou' } | { tipo: 'agora'; n: number }
type Overlay = { base: PilhaCarta[]; pilhas: PilhaCarta[] }
type FolhaAberta = { tipo: 'ajuste'; cardId: string; voltarLote: boolean } | { tipo: 'lote' }

const TOAST_MS = 6000

// Mesmas pilhas = o servidor ainda nao refletiu o lote; o otimismo continua
// valendo. Se a prop mudou, o chamador recarregou e o overlay cai.
function mesmasPilhas(a: PilhaCarta[], b: PilhaCarta[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((p, i) => p.id === b[i].id && p.quantity === b[i].quantity)
}

function pilhasEfetivas(carta: CartaTique, overlay: Map<string, Overlay>): PilhaCarta[] {
  const o = overlay.get(carta.card_id)
  if (!o) return carta.pilhas
  return mesmasPilhas(o.base, carta.pilhas) ? o.pilhas : carta.pilhas
}

export default function GradeTique({ cartas, selecao, onSelecaoChange, padrao, onPadraoChange, plano, modo, colunas, ocultarVerAsN, onSalvar, onDesfazer, onSalvo, rodape }: GradeTiqueProps) {
  const cols = colunas || { mobile: 3, desktop: modo === 'set' ? 7 : 6 }
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const classeGrade = `bx-tq-grade-${uid}`

  const [folha, setFolha] = useState<FolhaAberta | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [overlay, setOverlay] = useState<Map<string, Overlay>>(() => new Map())
  const [recentes, setRecentes] = useState<Map<string, Recente>>(() => new Map())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avisoTravaDado = useRef(false)
  const selecaoRef = useRef(selecao)
  selecaoRef.current = selecao
  // Toda mudanca parte da ultima selecao emitida, nao da prop: dois toques
  // antes do re-render (auditoria de 09/11) sobrescreviam um ao outro.
  function emitirSelecao(novo: Map<string, AjusteCarta>) {
    selecaoRef.current = novo
    onSelecaoChange(novo)
  }

  // Cache de toda carta ja vista: o lote da aba Buscar guarda cartas de
  // buscas anteriores que sumiram de `cartas`.
  const conhecidas = useRef(new Map<string, CartaTique>())
  useEffect(() => { cartas.forEach(c => conhecidas.current.set(c.card_id, c)) }, [cartas])

  const mapaAtual = useMemo(() => new Map(cartas.map(c => [c.card_id, c])), [cartas])
  const cartaDe = useCallback((id: string): CartaTique | undefined => {
    const c = mapaAtual.get(id) || conhecidas.current.get(id)
    return c ? { ...c, pilhas: pilhasEfetivas(c, overlay) } : undefined
  }, [mapaAtual, overlay])

  // Conta de vagas sobre TODAS as conhecidas (o lote pode estar fora da tela).
  const vagas = useMemo(() => {
    const m = new Map(conhecidas.current)
    cartas.forEach(c => m.set(c.card_id, c))
    const todas = Array.from(m.values()).map(c => ({ ...c, pilhas: pilhasEfetivas(c, overlay) }))
    return calcularVagas(plano, selecao, todas, padrao)
  }, [plano, selecao, cartas, overlay, padrao])

  const linhas: LinhaLote[] = useMemo(() => Array.from(selecao, ([id, ajuste]) => {
    const carta = cartaDe(id)
    return { card_id: id, carta, item: resolverItem(id, ajuste, padrao, carta) }
  }), [selecao, padrao, cartaDe])

  const valorLote = useMemo(() => linhas.reduce((s, l) => s + precoUnitario(l.carta, l.item.variante) * l.item.quantity, 0), [linhas])
  const nesteResultado = useMemo(() => { let n = 0; selecao.forEach((_, id) => { if (mapaAtual.has(id)) n++ }); return n }, [selecao, mapaAtual])

  // ── Toast ──────────────────────────────────────────────────────────────────
  const mostrarToast = useCallback((t: Toast) => {
    setToast(t)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const avisarTrava = useCallback(() => {
    // Uma vez so por sessao da grade: a barra ja fica vermelha com o cadeado.
    if (avisoTravaDado.current) return
    avisoTravaDado.current = true
    mostrarToast({ tipo: 'aviso', texto: `Suas ${vagas.limite} vagas do plano acabaram. Salve as ${selecao.size} marcadas ou veja os planos.` })
  }, [mostrarToast, vagas.limite, selecao.size])

  // ── Selecao ────────────────────────────────────────────────────────────────
  function travadaPara(carta: CartaTique, ajuste: AjusteCarta): boolean {
    if (!vagas.travado) return false
    return gastaVaga(carta, resolverItem(carta.card_id, ajuste, padrao, carta))
  }

  function alternar(carta: CartaTique) {
    if (salvando) return
    const novo = new Map(selecaoRef.current)
    if (novo.has(carta.card_id)) {
      novo.delete(carta.card_id)
    } else {
      // Carta que a pessoa ja tem: o toque e "somar 1" NA PILHA que existe
      // (variante e idioma dela), nao uma pilha nova pelo padrao do lote, que
      // gastaria vaga e dizia "Somar" sem somar (teste funcional de 09/11).
      const pilha = carta.pilhas[0]
      const ajuste: AjusteCarta = pilha ? { variante: pilha.variante, idioma: pilha.idioma, quantity: 1 } : {}
      if (travadaPara(carta, ajuste)) { avisarTrava(); return }
      novo.set(carta.card_id, ajuste)
    }
    emitirSelecao(novo)
  }

  function aplicarAjuste(cardId: string, ajuste: AjusteCarta) {
    const carta = cartaDe(cardId)
    const novo = new Map(selecaoRef.current)
    if (!novo.has(cardId) && carta && travadaPara(carta, ajuste)) { avisarTrava(); return }
    novo.set(cardId, ajuste)
    emitirSelecao(novo)
  }

  function fecharFolha() {
    setFolha(f => (f && f.tipo === 'ajuste' && f.voltarLote ? { tipo: 'lote' } : null))
  }

  function removerDoLote(cardId: string) {
    const novo = new Map(selecaoRef.current)
    novo.delete(cardId)
    emitirSelecao(novo)
    if (novo.size === 0) setFolha(null)
  }

  // ── Salvar / desfazer ──────────────────────────────────────────────────────
  function aplicarOtimismo(r: ResultadoLote, itens: ItemLote[]) {
    const novoOverlay = new Map(overlay)
    const novosRecentes = new Map(recentes)
    const pilhasAtuais = (c: CartaTique) => {
      const o = novoOverlay.get(c.card_id)
      return o && mesmasPilhas(o.base, c.pilhas) ? o.pilhas : c.pilhas
    }
    r.entraram.forEach(e => {
      const c = mapaAtual.get(e.card_id) || conhecidas.current.get(e.card_id)
      if (!c) return
      novoOverlay.set(c.card_id, { base: c.pilhas, pilhas: [...pilhasAtuais(c), { id: e.id, variante: e.variante, idioma: e.idioma, quantity: e.quantity }] })
      novosRecentes.set(c.card_id, { tipo: 'entrou' })
    })
    r.somadas.forEach(s => {
      const c = mapaAtual.get(s.card_id) || conhecidas.current.get(s.card_id)
      if (!c) return
      const atuais = pilhasAtuais(c)
      const idx = atuais.findIndex(p => p.id === s.id)
      const item = itens.find(i => i.card_id === s.card_id)
      const pilhas = idx >= 0
        ? atuais.map((p, i) => (i === idx ? { ...p, quantity: p.quantity + s.quantity } : p))
        : [...atuais, { id: s.id, variante: item?.variante || 'normal', idioma: item?.idioma || 'pt', quantity: s.quantity }]
      novoOverlay.set(c.card_id, { base: c.pilhas, pilhas })
      novosRecentes.set(c.card_id, { tipo: 'agora', n: pilhas.reduce((t, p) => t + p.quantity, 0) })
    })
    setOverlay(novoOverlay)
    setRecentes(novosRecentes)
  }

  async function desfazer(r: ResultadoLote, selecaoAntes: Map<string, AjusteCarta>) {
    setToast(null)
    try { await onDesfazer(r) } catch {
      mostrarToast({ tipo: 'erro', texto: 'Não deu para desfazer agora. Confira a coleção.' })
      return
    }
    const ids = [...r.entraram, ...r.somadas].map(x => x.card_id)
    setOverlay(prev => { const m = new Map(prev); ids.forEach(id => m.delete(id)); return m })
    setRecentes(prev => { const m = new Map(prev); ids.forEach(id => m.delete(id)); return m })
    // Devolve a selecao do que foi gravado, para a pessoa corrigir e salvar de novo.
    const volta = new Map(selecaoRef.current)
    ids.forEach(id => { const aj = selecaoAntes.get(id); if (aj) volta.set(id, aj) })
    emitirSelecao(volta)
  }

  async function salvar() {
    if (salvando || linhas.length === 0) return
    const itens = linhas.map(l => l.item)
    const selecaoAntes = new Map(selecao)
    setSalvando(true)
    let r: ResultadoLote | null = null
    try { r = await onSalvar(itens) } catch { r = null }
    setSalvando(false)
    if (!r) {
      // Erro nunca limpa a selecao.
      mostrarToast({ tipo: 'erro', texto: 'Não deu para salvar agora. Nada entrou e a sua seleção continua como estava.' })
      return
    }
    aplicarOtimismo(r, itens)
    // Recusadas continuam marcadas (nunca somem); ignoradas nao existem no catalogo.
    const restam = new Map<string, AjusteCarta>()
    r.recusadas.forEach(id => { const aj = selecaoAntes.get(id); if (aj) restam.set(id, aj) })
    emitirSelecao(restam)
    setFolha(null)
    const total = r.entraram.length + r.somadas.length
    let texto = total === 1 ? 'Adicionada 1 carta' : `Adicionadas ${total} cartas`
    if (r.recusadas.length) texto += ` · ${r.recusadas.length} não ${r.recusadas.length === 1 ? 'coube' : 'couberam'} no plano`
    const resultado = r
    mostrarToast({ tipo: total > 0 ? 'ok' : 'aviso', texto, desfazer: total > 0 ? () => desfazer(resultado, selecaoAntes) : undefined })
    onSalvo?.(r)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const cartaDaFolha = folha?.tipo === 'ajuste' ? cartaDe(folha.cardId) : undefined
  // O toast fica ACIMA da barra fixa quando ela esta na tela: cobria o botao de
  // salvar no celular (auditoria mobile de 09/11). Sem barra, vale o CSS.
  const barraRef = useRef<HTMLDivElement | null>(null)
  const [toastBottom, setToastBottom] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!toast) { setToastBottom(null); return }
    const r = barraRef.current?.getBoundingClientRect()
    setToastBottom(r && r.height > 0 ? Math.round(window.innerHeight - r.top) + 12 : null)
  }, [toast, linhas.length])
  const pct = Math.max(20, Math.floor(100 / Math.max(1, cols.mobile)) - 3)

  return (
    <div style={{ fontFamily: FONTE, color: 'var(--bx-text)' }}>
      <div className={classeGrade} role="group" aria-label="Cartas para marcar" aria-busy={salvando} style={{ pointerEvents: salvando ? 'none' : undefined, opacity: salvando ? 0.85 : 1, transition: 'opacity 0.2s ease' }}>
        {cartas.map(c => {
          const carta = { ...c, pilhas: pilhasEfetivas(c, overlay) }
          const ajuste = selecao.get(carta.card_id)
          const sel = ajuste !== undefined
          const tenho = carta.pilhas.length > 0
          const travada = !sel && travadaPara(carta, {})
          const item = sel ? resolverItem(carta.card_id, ajuste, padrao, carta) : null
          const pilula = item ? pilulaDe(item, padrao) : null
          const recente = recentes.get(carta.card_id)
          const nTenho = totalTenho(carta)
          const status = recente?.tipo === 'entrou' ? 'Entrou' : recente?.tipo === 'agora' ? `Agora ${recente.n}` : tenho ? `Tenho ${nTenho}` : null
          const statusNovo = recente !== undefined
          const rotuloCelula = travada
            ? `${carta.nome}: sem vaga no plano`
            : tenho
              ? `${sel ? 'Tirar a cópia extra de' : 'Somar 1 cópia de'} ${carta.nome}`
              : `${sel ? 'Desmarcar' : 'Marcar'} ${carta.nome}`

          return (
            <div key={carta.card_id} style={{ position: 'relative', minWidth: 0 }}>
              <button
                type="button"
                onClick={() => alternar(carta)}
                aria-pressed={sel}
                aria-disabled={travada || undefined}
                aria-label={rotuloCelula}
                className={`bx-tq-cel${travada ? ' bx-tq-travada' : ''}${tenho && !sel ? ' bx-tq-tenho' : ''}`}
                style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: travada ? 'not-allowed' : 'pointer', borderRadius: 18, font: 'inherit', color: 'inherit', boxShadow: sel ? '0 0 0 2px var(--ac-1)' : tenho ? '0 0 0 1.5px rgba(34,197,94,0.45)' : 'none', opacity: travada ? 0.5 : 1, transition: 'box-shadow 0.15s ease, opacity 0.15s ease, transform 0.15s ease' }}
              >
                <CardItem
                  mode="readonly"
                  hidePriceTable
                  selected={sel}
                  ocultarIdioma={!tenho}
                  card={{
                    id: carta.card_id, name: carta.nome, number: carta.numero || undefined,
                    image_small: carta.image_small || undefined, rarity: carta.raridade || undefined,
                    set_name: carta.set_name || undefined,
                    idioma: tenho ? (carta.pilhas[0].idioma || undefined) : undefined,
                    price: precosParaCardPrice(carta.precos, carta.valor),
                  }}
                  variante={item?.variante}
                  footerSlot={(status || pilula) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minHeight: 20, paddingRight: tenho ? 36 : 0 }}>
                      {status && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: statusNovo ? 'var(--ac-1)' : 'var(--bx-green)', whiteSpace: 'nowrap' }}>
                          <IconCheck size={12} color={statusNovo ? 'var(--ac-1)' : 'var(--bx-green)'} />{status}
                        </span>
                      )}
                      {pilula && <Pilula texto={pilula} />}
                    </div>
                  ) : undefined}
                />
                {/* Tique dos estados sem selecao: vazio, verde (tenho) ou cadeado. Com selecao o CardItem desenha o dele. */}
                {!sel && (
                  <span aria-hidden="true" style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tenho ? 'rgba(34,197,94,0.18)' : 'rgba(0,0,0,0.55)', border: travada ? '1.5px dashed var(--bx-text-3)' : tenho ? '1.5px solid var(--bx-green)' : '1.5px solid rgba(255,255,255,0.5)', transition: 'background 0.15s ease, border-color 0.15s ease' }}>
                    {travada ? <IconCadeado size={12} color="var(--bx-text-3)" /> : tenho ? <IconCheck size={12} color="var(--bx-green)" /> : null}
                  </span>
                )}
              </button>

              {/* Icone de ajuste: so em carta marcada ou ja na colecao, no canto inferior esquerdo da arte, acima do selo de preco. */}
              {(sel || tenho) && !travada && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, aspectRatio: '245 / 342', pointerEvents: 'none' }}>
                  <button
                    type="button"
                    onClick={() => setFolha({ tipo: 'ajuste', cardId: carta.card_id, voltarLote: false })}
                    aria-label={`Ajustar ${carta.nome}: variante, idioma e quantidade`}
                    className="bx-tq-ajuste"
                    style={{ position: 'absolute', left: 0, bottom: 30, width: 44, height: 44, padding: '0 0 4px 6px', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', border: 'none', background: 'none', cursor: 'pointer', pointerEvents: 'auto' }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bx-text)', transition: 'border-color 0.15s ease' }}>
                      <IconAjuste size={14} />
                    </span>
                  </button>
                </div>
              )}

              {/* "+" da carta que a pessoa ja tem: soma 1 copia; nao gasta vaga quando casa com uma pilha. */}
              {tenho && (
                <button
                  type="button"
                  onClick={() => alternar(carta)}
                  aria-label={rotuloCelula}
                  aria-pressed={sel}
                  aria-disabled={travada || undefined}
                  style={{ position: 'absolute', right: 2, bottom: 2, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: travada ? 'not-allowed' : 'pointer', padding: 0 }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: `1px solid ${sel ? 'rgba(var(--ac-1-rgb), 0.5)' : 'var(--bx-border-2)'}`, background: sel ? 'rgba(var(--ac-1-rgb), 0.14)' : 'var(--bx-surface-2)', color: sel ? 'var(--ac-1)' : 'var(--bx-text)', opacity: travada ? 0.5 : 1, transition: 'background 0.15s ease, border-color 0.15s ease' }}>
                    {sel && item ? `+${item.quantity}` : <IconPlus size={14} color="currentColor" />}
                  </span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      {selecao.size > 0 && (
        <BarraLote
          barraRef={barraRef}
          verAsN={!ocultarVerAsN}
          onLimpar={() => { emitirSelecao(new Map()); setFolha(null) }}
          modo={modo}
          n={selecao.size}
          nesteResultado={nesteResultado}
          valor={valorLote}
          vagas={vagas}
          salvando={salvando}
          onVerLote={() => setFolha({ tipo: 'lote' })}
          onSalvar={salvar}
          rodape={rodape}
        />
      )}

      {folha?.tipo === 'lote' && (
        <FolhaLote
          linhas={linhas}
          padrao={padrao}
          vagas={vagas}
          salvando={salvando}
          onAjustar={id => setFolha({ tipo: 'ajuste', cardId: id, voltarLote: true })}
          onRemover={removerDoLote}
          onLimpar={() => { emitirSelecao(new Map()); setFolha(null) }}
          onSalvar={salvar}
          onFechar={() => setFolha(null)}
        />
      )}

      {folha?.tipo === 'ajuste' && cartaDaFolha && (
        <FolhaAjusteCarta
          carta={cartaDaFolha}
          ajuste={selecao.get(cartaDaFolha.card_id) || {}}
          padrao={padrao}
          onFechar={fecharFolha}
          onAplicar={a => { aplicarAjuste(cartaDaFolha.card_id, a); fecharFolha() }}
          onUsarComoPadrao={(p, q) => { onPadraoChange(p); aplicarAjuste(cartaDaFolha.card_id, q > 1 ? { quantity: q } : {}); fecharFolha() }}
        />
      )}

      {toast && (
        <Portal>
          <div role="status" aria-live="polite" className="bx-tq-toast" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: Z_TOAST, bottom: toastBottom ?? undefined, width: 'min(520px, calc(100vw - 32px))', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px 10px 16px', borderRadius: 14, background: 'var(--bx-bg-elev)', border: `1px solid ${toast.tipo === 'ok' ? 'var(--bx-border-2)' : 'rgba(239,68,68,0.4)'}`, boxShadow: 'var(--bx-shadow)', fontSize: 13.5, lineHeight: 1.45, fontFamily: FONTE, color: 'var(--bx-text)' }}>
            {toast.tipo === 'ok' ? <IconCheck size={16} color="var(--bx-green)" /> : <IconWarning size={16} color="var(--bx-red)" />}
            <span style={{ flex: 1 }}>{toast.texto}</span>
            {toast.desfazer && (
              <button type="button" onClick={toast.desfazer} style={{ font: 'inherit', fontSize: 13, fontWeight: 800, minHeight: 44, padding: '0 12px', border: 'none', borderRadius: 10, background: 'var(--bx-surface-3)', color: 'var(--bx-text)', cursor: 'pointer' }}>Desfazer</button>
            )}
          </div>
        </Portal>
      )}

      <style>{`
        .${classeGrade} { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(${pct}%, 150px), 1fr)); }
        @media (min-width: 769px) { .${classeGrade} { gap: 12px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } }
        @media (min-width: 1280px) { .${classeGrade} { grid-template-columns: repeat(${cols.desktop}, minmax(0, 1fr)); } }
        .bx-tq-cel:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .bx-tq-cel img { transition: filter 0.2s ease, opacity 0.2s ease; }
        .bx-tq-tenho img { opacity: 0.78; }
        .bx-tq-travada img { filter: grayscale(1); }
        @media (hover: hover) {
          .bx-tq-cel:not([aria-disabled]):hover { transform: translateY(-2px); }
          .bx-tq-ajuste:hover > span { border-color: var(--ac-1); }
        }
        .bx-tq-toast { bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 769px) { .bx-tq-toast { bottom: 24px; } }
        @media (prefers-reduced-motion: reduce) { .bx-tq-cel, .bx-tq-cel img { transition: none; } .bx-tq-cel:hover { transform: none; } }
      `}</style>
    </div>
  )
}

export { numeroESet }
