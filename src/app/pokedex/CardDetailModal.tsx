'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { IconHistory, IconCheck, IconPlus, IconBell, IconClose } from '@/components/ui/Icons'
import { TYPE_COLOR, raridadePt, subtipoPt, tipoTcgPt } from '@/lib/pokedexTextos'
import SinalCartaVista from '@/components/cards/SinalCartaVista'

/**
 * Detalhe da carta na Pokedex. Redesenhado em 21/09/2026 (mockup "Pokedex: nova
 * experiencia", aprovado pelo Du, com o modal do TCG Vision como referencia de
 * completude). Os dados ja vinham todos do /api/pokedex/browse; o que faltava
 * era hierarquia: a arte ficava em 140px, o preco no meio da rolagem e a acao
 * de adicionar no rodape, depois de tudo.
 *
 * Ordem agora: arte grande -> quem e (nome, PS, raridade em portugues) ->
 * quanto vale (Mercado Brasileiro, menor preco, faixa, ultima venda) -> "Suas
 * copias" (variante, idioma, condicao, Ja tenho, Avisar preco) -> dados de
 * jogo (ataques, fraqueza, recuo) quando existem -> historico e dolar.
 *
 * ★ A imagem carrega de imediato (era loading="lazy" na peca principal, e no
 * primeiro abrir o modal aparecia sem a carta).
 */

function EnergyDot({ type, size = 14 }: { type: string; size?: number }) {
  const c = TYPE_COLOR[type]
  return (
    <span title={tipoTcgPt(type)} style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c?.bg || 'var(--bx-surface-2)', border: `1.5px solid ${c?.text || 'var(--bx-text-3)'}`, flexShrink: 0 }} />
  )
}

const IDIOMAS = [['pt', 'PT'], ['en', 'EN'], ['jp', 'JP'], ['es', 'ES'], ['fr', 'FR'], ['de', 'DE'], ['it', 'IT'], ['cn', 'CN'], ['kr', 'KR']] as const
const CONDICOES = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
const FILTROS_DIAS = [7, 15, 30, 60] as const

interface HistoricoVenda { valor_cents: number; variante: string | null; condicao: string | null; idioma: string | null; capturado_em: string }

const fmtBRL = (v: unknown) => v != null && Number(v) > 0
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v))
  : null

export interface ExtraAdicao { _variante: string; _idioma: string; _condicao: string }

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  card: any
  cardIndex: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cards: any[]
  selectedVariante: string
  setSelectedVariante: (v: string) => void
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNavigate: (card: any, idx: number) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAdd: (card: any) => void
  isMobile: boolean
  tenho?: boolean
  avisoAtivo?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSino?: (card: any) => void
  adicionando?: boolean
  exchangeRate?: { usd: number }
}

export default function CardDetailModal({
  card: c, cardIndex, cards, selectedVariante, setSelectedVariante,
  onClose, onNavigate, onAdd, isMobile, tenho = false, avisoAtivo = false, onSino, adicionando = false, exchangeRate,
}: Props) {
  const prevCard = cardIndex > 0 ? cards[cardIndex - 1] : null
  const nextCard = cardIndex < cards.length - 1 ? cards[cardIndex + 1] : null

  const parse = <T,>(v: unknown, vazio: T): T => { if (v == null) return vazio; if (typeof v !== 'string') return v as T; try { return JSON.parse(v) as T } catch { return vazio } }
  const attacks = parse<{ name: string; cost?: string[]; damage?: string; text?: string }[]>(c.attacks, [])
  const abilities = parse<{ name: string; text?: string; type?: string }[]>(c.abilities, [])
  const weaknesses = parse<{ type: string; value: string }[]>(c.weaknesses, [])
  const resistances = parse<{ type: string; value: string }[]>(c.resistances, [])

  const VARIANTES = [
    { key: 'normal', label: 'Normal', med: c.preco_medio, min: c.preco_min, max: c.preco_max, usd: c.price_usd_normal },
    { key: 'foil', label: 'Holo', med: c.preco_foil_medio, min: c.preco_foil_min, max: c.preco_foil_max, usd: c.price_usd_holofoil },
    { key: 'reverse', label: 'Reverse', med: c.preco_reverse_medio, min: c.preco_reverse_min, max: c.preco_reverse_max, usd: c.price_usd_reverse },
    { key: 'promo', label: 'Promo', med: c.preco_promo_medio, min: c.preco_promo_min, max: c.preco_promo_max, usd: null },
    { key: 'pokeball', label: 'Pokéball', med: c.preco_pokeball_medio, min: c.preco_pokeball_min, max: c.preco_pokeball_max, usd: null },
  ].filter(v => Number(v.med) > 0 || Number(v.min) > 0)
  if (VARIANTES.length === 0) VARIANTES.push({ key: 'normal', label: 'Normal', med: null, min: null, max: null, usd: c.price_usd_normal })
  const vAtual = VARIANTES.find(v => v.key === selectedVariante) || VARIANTES[0]
  const holo = vAtual.key !== 'normal'

  const [idioma, setIdioma] = useState<string>(c.idioma || 'pt')
  const [condicao, setCondicao] = useState<string>('NM')
  useEffect(() => { setIdioma(c.idioma || 'pt'); setCondicao('NM') }, [c.id, c.idioma])

  const ultimoVendidoFmt = c.ultima_venda?.valor != null ? fmtBRL(Number(c.ultima_venda.valor) / 100) : null
  const usdVal = Number(vAtual.usd) > 0 ? Number(vAtual.usd) : null

  const [diasHistorico, setDiasHistorico] = useState<typeof FILTROS_DIAS[number]>(30)
  const [historicoVendas, setHistoricoVendas] = useState<HistoricoVenda[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  useEffect(() => {
    if (!c.id || !ultimoVendidoFmt) { setHistoricoVendas([]); return }
    let active = true
    setCarregandoHistorico(true)
    fetch(`/api/cards/${encodeURIComponent(c.id)}/historico-vendas?dias=${diasHistorico}`)
      .then(r => r.ok ? r.json() : { historico: [] })
      .then(({ historico }) => { if (active) setHistoricoVendas(historico || []) })
      .catch(() => { if (active) setHistoricoVendas([]) })
      .finally(() => { if (active) setCarregandoHistorico(false) })
    return () => { active = false }
  }, [c.id, ultimoVendidoFmt, diasHistorico])

  const numero = c.number && c.set_total ? `${String(c.number).padStart(3, '0')}/${c.set_total}` : c.number
  const raridade = raridadePt(c.rarity)
  const slug = c.slug || c.id
  const img = c.image_large || c.image_small

  const chip = (ativo: boolean): React.CSSProperties => ({
    font: 'inherit', fontSize: 12.5, fontWeight: 700, minHeight: 36, padding: '0 11px', borderRadius: 999, cursor: 'pointer',
    border: `1px solid ${ativo ? 'var(--ac-1)' : 'var(--bx-border)'}`, background: ativo ? 'rgba(var(--ac-1-rgb), 0.12)' : 'transparent',
    color: ativo ? 'var(--ac-1)' : 'var(--bx-text-2)', transition: 'background .15s ease, border-color .15s ease, color .15s ease',
  })
  const navBtn = (habilitado: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: habilitado ? 'var(--bx-text-2)' : 'var(--bx-text-faint)',
    cursor: habilitado ? 'pointer' : 'default', fontSize: 12.5, fontFamily: 'inherit', padding: '0 8px', minHeight: 44, borderRadius: 8, maxWidth: '40%',
  })

  return (
    <div onClick={onClose} className="bx-cdm-fundo">
      <SinalCartaVista cardId={c.id} tipo="view_app" />
      <div onClick={e => e.stopPropagation()} className="bx-cdm" role="dialog" aria-modal="true" aria-label={c.name}>
        {/* Navegacao */}
        <div className="bx-cdm-nav">
          <button onClick={() => prevCard && onNavigate(prevCard, cardIndex - 1)} disabled={!prevCard} style={navBtn(!!prevCard)} aria-label="Carta anterior">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prevCard ? prevCard.name : ''}</span>
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--bx-text-3)', fontWeight: 700 }}>{cardIndex + 1} de {cards.length}</span>
          <div style={{ display: 'flex', alignItems: 'center', maxWidth: '45%' }}>
            <button onClick={() => nextCard && onNavigate(nextCard, cardIndex + 1)} disabled={!nextCard} style={{ ...navBtn(!!nextCard), maxWidth: 'none' }} aria-label="Próxima carta">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextCard ? nextCard.name : ''}</span>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button onClick={onClose} aria-label="Fechar" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bx-text-2)' }}>
              <IconClose size={16} />
            </button>
          </div>
        </div>

        <div className="bx-cdm-corpo">
          {/* Arte */}
          <div className="bx-cdm-arte">
            <div className="bx-cdm-carta">
              {img && (
                <Image key={c.id} src={img} alt={`${c.name} ${numero || ''}`} width={300} height={419} priority sizes="(max-width: 768px) 220px, 300px"
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12 }} />
              )}
              {holo && <span className="bx-cdm-holo" aria-hidden="true" />}
            </div>
            {c.artist && <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--bx-text-3)', textAlign: 'center' }}>Ilustração: {c.artist}</div>}
          </div>

          {/* Informacao */}
          <div className="bx-cdm-info">
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? 23 : 27, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--bx-text)' }}>{c.name}</h2>
                {c.hp && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--bx-text-3)' }}>PS <span style={{ fontSize: 22, color: 'var(--bx-red)' }}>{c.hp}</span></span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--bx-text-2)', marginTop: 3 }}>
                {[c.set_name_pt || c.set_name, numero, raridade].filter(Boolean).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {raridade && <span className="bx-cdm-selo" style={{ borderColor: 'rgba(var(--ac-1-rgb), .45)', color: 'var(--ac-1)' }}>{raridade}</span>}
                {(c.subtypes || []).map((s: string) => <span key={s} className="bx-cdm-selo">{subtipoPt(s)}</span>)}
                {(c.types || []).map((t: string) => <span key={t} className="bx-cdm-selo" style={{ background: TYPE_COLOR[t]?.bg, color: TYPE_COLOR[t]?.text, borderColor: 'transparent' }}>{tipoTcgPt(t)}</span>)}
              </div>
            </div>

            {/* Quanto vale */}
            <div className="bx-cdm-preco">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div className="bx-cdm-k">Mercado Brasileiro · menor preço</div>
                  <div className="bx-cdm-grande">{fmtBRL(vAtual.min) || fmtBRL(vAtual.med) || 'Sem preço'}</div>
                </div>
                {VARIANTES.length > 1 && (
                  <div role="group" aria-label="Variante" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {VARIANTES.map(v => (
                      <button key={v.key} type="button" onClick={() => setSelectedVariante(v.key)} aria-pressed={vAtual.key === v.key} style={chip(vAtual.key === v.key)}>{v.label}</button>
                    ))}
                  </div>
                )}
              </div>
              {c.preco_nao_confiavel && (
                <div style={{ fontSize: 12, color: 'var(--bx-text-2)', marginTop: 8 }}><b style={{ color: 'var(--ac-1)' }}>Preço sob revisão.</b> Uma oferta só, muito acima do histórico desta carta.</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
                {[['Médio', fmtBRL(vAtual.med)], ['Máximo', fmtBRL(vAtual.max)], ['Última venda', ultimoVendidoFmt]].map(([r, v], i) => (
                  <div key={r as string} style={{ background: 'var(--bx-bg)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '8px 10px', minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)' }}>{r}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: i === 2 && v ? 'var(--bx-green)' : 'var(--bx-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v || 'sem dado'}</div>
                  </div>
                ))}
              </div>
              {usdVal && (
                <div style={{ fontSize: 12, color: 'var(--bx-text-3)', marginTop: 8 }}>
                  TCGPlayer · US$ {usdVal.toFixed(2).replace('.', ',')}{exchangeRate?.usd ? ` (cerca de ${fmtBRL(usdVal * exchangeRate.usd)} convertido)` : ''}
                </div>
              )}
            </div>

            {/* Suas copias */}
            <div className="bx-cdm-bloco">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div className="bx-cdm-k">Suas cópias</div>
                <span style={{ fontSize: 12, fontWeight: 700, color: tenho ? 'var(--bx-green)' : 'var(--bx-text-3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {tenho ? <><IconCheck size={13} color="var(--bx-green)" /> Na sua coleção</> : 'Você ainda não tem'}
                </span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)', marginBottom: 6 }}>IDIOMA</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {IDIOMAS.map(([k, r]) => <button key={k} type="button" onClick={() => setIdioma(k)} aria-pressed={idioma === k} style={chip(idioma === k)}>{r}</button>)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)', marginBottom: 6 }}>CONDIÇÃO</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                {CONDICOES.map(k => <button key={k} type="button" onClick={() => setCondicao(k)} aria-pressed={condicao === k} style={chip(condicao === k)}>{k}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" disabled={adicionando} onClick={() => onAdd({ ...c, _variante: vAtual.key, _idioma: idioma, _condicao: condicao } as ExtraAdicao)} className="bx-cdm-add">
                  <IconPlus size={15} color="currentColor" />
                  {adicionando ? 'Adicionando…' : tenho ? `Adicionar mais uma (${vAtual.label})` : `Já tenho esta (${vAtual.label})`}
                </button>
                {onSino && (
                  <button type="button" onClick={() => onSino(c)} aria-pressed={avisoAtivo} className={`bx-cdm-sino${avisoAtivo ? ' bx-cdm-sino-on' : ''}`}>
                    <IconBell size={15} color="currentColor" /> {avisoAtivo ? 'Aviso ligado' : 'Avisar preço'}
                  </button>
                )}
              </div>
            </div>

            {/* Dados de jogo (so nas cartas que tem) */}
            {abilities.map((a, i) => (
              <div key={`h${i}`} className="bx-cdm-linha">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(168,85,247,.15)', color: '#c084fc' }}>HABILIDADE</span>
                  <span style={{ fontSize: 14.5, fontWeight: 800 }}>{a.name}</span>
                </div>
                {a.text && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>{a.text}</p>}
              </div>
            ))}
            {attacks.length > 0 && (
              <div className="bx-cdm-linha">
                <div className="bx-cdm-k" style={{ marginBottom: 8 }}>Ataques</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attacks.map((atk, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', gap: 3 }}>{(atk.cost || []).map((e, j) => <EnergyDot key={j} type={e} />)}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 800, flex: 1 }}>{atk.name}</span>
                        {atk.damage && <span style={{ fontSize: 18, fontWeight: 900 }}>{atk.damage}</span>}
                      </div>
                      {atk.text && <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.55 }}>{atk.text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(weaknesses.length > 0 || resistances.length > 0 || (c.retreat_cost || []).length > 0) && (
              <div className="bx-cdm-linha" style={{ display: 'flex', gap: 22, flexWrap: 'wrap', fontSize: 13 }}>
                {weaknesses.length > 0 && <div><div className="bx-cdm-mini">FRAQUEZA</div>{weaknesses.map((w, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: 'var(--bx-red)', marginRight: 8 }}><EnergyDot type={w.type} size={12} />{w.value}</span>)}</div>}
                {resistances.length > 0 && <div><div className="bx-cdm-mini">RESISTÊNCIA</div>{resistances.map((r, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 800, color: 'var(--bx-green)', marginRight: 8 }}><EnergyDot type={r.type} size={12} />{r.value}</span>)}</div>}
                {(c.retreat_cost || []).length > 0 && <div><div className="bx-cdm-mini">RECUO</div><span style={{ display: 'flex', gap: 3 }}>{(c.retreat_cost || []).map((e: string, i: number) => <EnergyDot key={i} type={e} size={12} />)}</span></div>}
              </div>
            )}
            {c.flavor_text && <p className="bx-cdm-linha" style={{ margin: 0, fontSize: 13, color: 'var(--bx-text-2)', fontStyle: 'italic', lineHeight: 1.6 }}>&ldquo;{c.flavor_text}&rdquo;</p>}

            {/* Historico de vendas */}
            {ultimoVendidoFmt && (
              <div className="bx-cdm-linha">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="bx-cdm-k" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconHistory size={13} /> Histórico de vendas</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {FILTROS_DIAS.map(d => <button key={d} onClick={() => setDiasHistorico(d)} aria-pressed={diasHistorico === d} style={{ ...chip(diasHistorico === d), minHeight: 32, fontSize: 11.5 }}>{d}d</button>)}
                  </div>
                </div>
                {carregandoHistorico ? (
                  <p style={{ fontSize: 12, color: 'var(--bx-text-faint)', margin: 0 }}>Carregando…</p>
                ) : historicoVendas.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {historicoVendas.map((h, i) => {
                      const dias = Math.floor((Date.now() - new Date(h.capturado_em).getTime()) / 86400000)
                      const quando = dias <= 0 ? 'Hoje' : dias === 1 ? 'Ontem' : `${dias} dias atrás`
                      const meta = [h.variante, h.condicao, h.idioma].filter(Boolean).join(' · ')
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bx-surface-2)', fontSize: 12 }}>
                          <span style={{ color: 'var(--bx-text-2)' }}>{quando}</span>
                          {meta && <span style={{ color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>}
                          <b>{fmtBRL(h.valor_cents / 100)}</b>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--bx-text-faint)', margin: 0 }}>Coletando desde hoje. O histórico completo aparece com o tempo.</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href={`/carta/${slug}`} prefetch={false} className="bx-cdm-link">Ver página da carta</Link>
              <Link href={`/carta/${slug}#ofertas`} prefetch={false} className="bx-cdm-link bx-ctx-comprador" style={{ color: 'var(--ac-1)' }}>Ver quem vende</Link>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .bx-cdm-fundo { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.82); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: center; padding: 16px; animation: bxCdmEntra .2s ease both; }
        .bx-cdm { background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-radius: 22px; width: 100%; max-width: 1000px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: 0 32px 100px rgba(0,0,0,.7); overflow: hidden; }
        .bx-cdm-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; border-bottom: 1px solid var(--bx-border); flex-shrink: 0; }
        .bx-cdm-corpo { flex: 1; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; padding: 16px; }
        @media (min-width: 860px) { .bx-cdm-corpo { grid-template-columns: 300px minmax(0, 1fr); gap: 28px; padding: 22px 26px; } .bx-cdm-arte { position: sticky; top: 0; align-self: start; } }
        .bx-cdm-arte { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .bx-cdm-carta { position: relative; width: 220px; border-radius: 12px; overflow: hidden; box-shadow: 0 30px 60px -20px rgba(0,0,0,.9); background: var(--bx-surface-2); aspect-ratio: 300 / 419; }
        @media (min-width: 860px) { .bx-cdm-carta { width: 300px; } }
        .bx-cdm-holo { position: absolute; inset: 0; mix-blend-mode: screen; pointer-events: none; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.3) 45%, rgba(var(--ac-1-rgb), .2) 55%, transparent 70%); background-size: 250% 100%; animation: bxCdmHolo 3s ease-in-out infinite alternate; }
        .bx-cdm-info { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
        .bx-cdm-selo { font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--bx-border); color: var(--bx-text-2); }
        .bx-cdm-k { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ac-1); }
        .bx-cdm-mini { font-size: 10.5px; font-weight: 800; letter-spacing: .06em; color: var(--bx-text-3); margin-bottom: 4px; }
        .bx-cdm-preco { padding: 16px; border-radius: 16px; background: var(--bx-hero-wash), var(--bx-surface); border: 1px solid rgba(var(--ac-1-rgb), .28); }
        .bx-cdm-grande { font-size: clamp(30px, 5vw, 38px); font-weight: 900; letter-spacing: -.04em; line-height: 1.1; background: var(--ac-grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .bx-cdm-bloco { padding: 14px; border-radius: 16px; background: var(--bx-surface); border: 1px solid var(--bx-border); }
        .bx-cdm-linha { border-top: 1px solid var(--bx-border); padding-top: 12px; }
        .bx-cdm-add { flex: 1 1 200px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font: inherit; font-size: 14px; font-weight: 800; min-height: 46px; border: none; border-radius: 12px; cursor: pointer; background: var(--ac-grad); color: var(--bx-brand-ink); transition: transform .15s ease, box-shadow .15s ease; }
        .bx-cdm-add:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px -14px rgba(var(--ac-1-rgb), .9); }
        .bx-cdm-sino { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font: inherit; font-size: 13.5px; font-weight: 700; min-height: 46px; padding: 0 16px; border-radius: 12px; cursor: pointer; border: 1px solid var(--bx-border); background: var(--bx-surface-2); color: var(--bx-text); transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .bx-cdm-sino-on { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), .12); color: var(--ac-1); }
        .bx-cdm-link { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 12px; border: 1px solid var(--bx-border); font-size: 13.5px; font-weight: 700; color: var(--bx-text-2); text-decoration: none; transition: background .15s ease; }
        .bx-cdm-link:hover { background: var(--bx-surface-2); }
        @media (max-width: 859px) {
          .bx-cdm-fundo { align-items: flex-end; padding: 0; }
          .bx-cdm { border-radius: 22px 22px 0 0; max-height: 94vh; animation: bxCdmSobe .25s cubic-bezier(.22,.61,.36,1) both; }
        }
        @keyframes bxCdmEntra { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bxCdmSobe { from { transform: translateY(24px) } to { transform: none } }
        @keyframes bxCdmHolo { from { background-position: 0 0 } to { background-position: 100% 0 } }
        @media (prefers-reduced-motion: reduce) { .bx-cdm-fundo, .bx-cdm, .bx-cdm-holo { animation: none; } .bx-cdm-add:hover { transform: none; } }
      `}</style>
    </div>
  )
}
