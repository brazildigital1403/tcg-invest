'use client'

import { useEffect, useState } from 'react'
import { TYPE_COLOR } from './page'
import { IconHistory } from '@/components/ui/Icons'
import SinalCartaVista from '@/components/cards/SinalCartaVista'

// Selo de energia: bolinha na cor do tipo (mesmo TYPE_COLOR dos badges de
// tipo do header) em vez do emoji de elemento antigo (🔥💧🌿...) -- regra 15
// da casa, zero emoji na UI. Reusa a mesma paleta que já identifica o tipo
// nos badges logo acima, então a cor já é familiar quando chega aqui.
function EnergyDot({ type, size = 13 }: { type: string; size?: number }) {
  const c = TYPE_COLOR[type]
  return (
    <span
      title={type}
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: c?.bg || 'var(--bx-surface-2)',
        border: `1.5px solid ${c?.text || 'var(--bx-text-3)'}`,
        flexShrink: 0,
      }}
    />
  )
}

// Cor do selo de idioma -- mesma paleta do badge de idioma do CardItem
// (paleta fixa por familia de idioma, mesma logica do TYPE_COLOR acima).
const IDIOMA_COR: Record<string, string> = {
  pt: '#9ca3af', en: '#60a5fa', jp: '#f472b6', es: '#f59e0b', fr: '#a855f7',
  de: '#94a3b8', it: '#22c55e', cn: '#ef4444', kr: '#818cf8',
}

const FILTROS_DIAS = [7, 15, 30, 60] as const

interface HistoricoVenda {
  valor_cents: number
  variante: string | null
  condicao: string | null
  idioma: string | null
  capturado_em: string
}

const fmtBRL = (v: any) => v && Number(v) > 0
  ? new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v))
  : null

// Data curta pt-BR a partir de um timestamp ISO -- usado nos rodapes
// "Atualizado em" (achado: liga_updated_at/tcg_updated_at ja chegam no
// card mas nunca eram mostrados).
const fmtDataCurta = (iso: any) => {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return null }
}

interface Props {
  card: any
  cardIndex: number
  cards: any[]
  selectedVariante: string
  setSelectedVariante: (v: string) => void
  onClose: () => void
  onNavigate: (card: any, idx: number) => void
  onAdd: (card: any) => void
  isMobile: boolean
}

export default function CardDetailModal({
  card: c, cardIndex, cards, selectedVariante, setSelectedVariante,
  onClose, onNavigate, onAdd, isMobile
}: Props) {
  const prevCard = cardIndex > 0 ? cards[cardIndex - 1] : null
  const nextCard = cardIndex < cards.length - 1 ? cards[cardIndex + 1] : null

  const attacks    = (() => { try { return JSON.parse(c.attacks    || '[]') } catch { return [] } })()
  const weaknesses = (() => { try { return JSON.parse(c.weaknesses || '[]') } catch { return [] } })()
  const resistances= (() => { try { return JSON.parse(c.resistances|| '[]') } catch { return [] } })()
  const legalities = (() => { try { return JSON.parse(c.legalities || '{}') } catch { return {} } })()

  const VARIANTES = [
    { key:'normal',   label:'Normal',   icon:'○', med:c.preco_medio,         min:c.preco_min,         max:c.preco_max },
    { key:'foil',     label:'Foil',     icon:'✦', med:c.preco_foil_medio,    min:c.preco_foil_min,    max:c.preco_foil_max },
    { key:'reverse',  label:'Reverse',  icon:'◈', med:c.preco_reverse_medio, min:c.preco_reverse_min, max:c.preco_reverse_max },
    { key:'promo',    label:'Promo',    icon:'★', med:c.preco_promo_medio,   min:c.preco_promo_min,   max:c.preco_promo_max },
    { key:'pokeball', label:'Pokéball', icon:'⊕', med:c.preco_pokeball_medio,min:c.preco_pokeball_min,max:c.preco_pokeball_max },
  ].filter(v => Number(v.med) > 0 || Number(v.min) > 0)
  if (VARIANTES.length === 0) VARIANTES.push({ key:'normal', label:'Normal', icon:'○', med:null, min:null, max:null })

  // Variantes extras que a tabela fixa acima nao cobre -- o scraper acha
  // formatos como "prerelease"/"unknown_a" e guarda em outras_variantes
  // (jsonb: {min,med,max,sigla}). Raro (~1% das cartas) mas e preco de
  // mercado real que hoje se perdia.
  const outrasVariantesExtra: { key: string; label: string; med: number | null; min: number | null; max: number | null }[] =
    c.outras_variantes && typeof c.outras_variantes === 'object'
      ? Object.entries(c.outras_variantes as Record<string, any>)
          .filter(([, v]) => Number(v?.med) > 0 || Number(v?.min) > 0)
          .map(([key, v]) => ({ key, label: v?.sigla || key, med: v?.med ?? null, min: v?.min ?? null, max: v?.max ?? null }))
      : []

  // "Ultimo vendido" ja vem calculado do banco (montarUltimaVenda em page.tsx,
  // zero busca nova) -- so faltava ligar nesse modal.
  const ultimoVendidoFmt = c.ultima_venda?.valor != null
    ? fmtBRL(Number(c.ultima_venda.valor) / 100)
    : null

  // Historico de vendas -- so busca quando ha "ultima venda" pra comparar
  // contra, e refaz quando a carta muda (navegacao prev/next no modal) ou
  // o filtro de periodo muda. Mesmo endpoint que a Coleção ja usa.
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

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      {/* Sinal "carta acessada" na area logada. cardId na dep do useEffect
          reinicia o relogio a cada troca de carta -- carta atravessada pela
          seta em 200ms nunca dispara, senao folhear um Pokemon popular
          creditaria dezenas de cartas que a pessoa nao olhou. */}
      <SinalCartaVista cardId={c.id} tipo="view_app" />
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bx-bg-elev)', border:'1px solid var(--bx-border-2)', borderRadius:24, width:'100%', maxWidth:900, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 32px 100px rgba(0,0,0,0.7)', overflow:'hidden' }}>

        {/* Nav entre cartas */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid var(--bx-border)', background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
          <button onClick={() => prevCard && onNavigate(prevCard, cardIndex - 1)} disabled={!prevCard}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color: prevCard ? 'var(--bx-text-2)' : 'var(--bx-text-faint)', cursor: prevCard ? 'pointer' : 'default', fontSize:12, fontFamily:'inherit', padding:'10px 8px', minHeight:44, borderRadius:8, boxSizing:'border-box' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {prevCard ? prevCard.name : '—'}
          </button>
          <span style={{ fontSize:11, color:'var(--bx-text-faint)' }}>{cardIndex + 1} de {cards.length}</span>
          <button onClick={() => nextCard && onNavigate(nextCard, cardIndex + 1)} disabled={!nextCard}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color: nextCard ? 'var(--bx-text-2)' : 'var(--bx-text-faint)', cursor: nextCard ? 'pointer' : 'default', fontSize:12, fontFamily:'inherit', padding:'10px 8px', minHeight:44, borderRadius:8, boxSizing:'border-box' }}>
            {nextCard ? nextCard.name : '—'}
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Corpo — no mobile vira UMA regiao de scroll so (achado #4: antes a
            coluna esquerda tinha maxHeight:220 + scroll proprio, cortando os
            metadados de coleção/número/artista atrás de 3px de barra que
            ninguém via). No desktop nao mudou nada, ja funcionava. */}
        <div style={{ flex:1, overflow: isMobile ? 'auto' : 'hidden', display:'flex', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* Coluna esquerda */}
          {/* S34: removido o botao que levava a fonte de preco — pagina /pokedex e publica
              e indexavel pelo Google, expor link externo a Liga = risco SEO/juridico */}
          <div style={{ padding:20, background:'var(--bx-surface)', borderRight: isMobile ? 'none' : '1px solid var(--bx-border)', borderBottom: isMobile ? '1px solid var(--bx-border)' : 'none', display:'flex', flexDirection:'row', flexWrap:'wrap', alignItems:'flex-start', gap:12, overflowY: isMobile ? 'visible' : 'auto', maxHeight: isMobile ? undefined : undefined, flexShrink:0 }}>
            {(c.image_large || c.image_small) && (
              <img src={c.image_large || c.image_small} alt={c.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" style={{ width:140, maxWidth:'40vw', borderRadius:12, flexShrink:0 }} />
            )}
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minWidth:150 }}>
              {(c.set_symbol || c.set_logo) && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {c.set_symbol && <img src={c.set_symbol} alt="" style={{ height:18, objectFit:'contain' }} />}
                  {c.set_logo && <img src={c.set_logo} alt={c.set_name} style={{ height:18, objectFit:'contain', maxWidth:100 }} />}
                </div>
              )}
              {[
                { label:'Coleção',     value: c.set_name, valuePt: c.set_name_pt },
                { label:'Série',       value: c.set_series },
                { label:'Número',      value: c.number && c.set_total ? `${String(c.number).padStart(3,'0')} / ${String(c.set_total).padStart(3,'0')}` : c.number },
                { label:'Lançamento',  value: c.set_release_date ? c.set_release_date.split('/').reverse().join('/') : null },
                { label:'Artista',     value: c.artist },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display:'flex', gap:6 }}>
                  <span style={{ fontSize:10, color:'var(--bx-text-3)', fontWeight:700, minWidth:72, flexShrink:0 }}>{r.label}:</span>
                  <span style={{ fontSize:10, color:'var(--bx-text-2)', lineHeight:1.4 }}>
                    {r.value}
                    {r.valuePt && r.valuePt !== r.value && (
                      <span style={{ display:'block', color:'var(--bx-text-3)', fontStyle:'italic', marginTop:1 }}>{r.valuePt}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna direita */}
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14, overflowY: isMobile ? 'visible' : 'auto', flex:1 }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div>
                <h2 style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.03em', marginBottom: c.name_pt ? 1 : 6, color:'var(--bx-text)' }}>{c.name}</h2>
                {c.name_pt && c.name_pt !== c.name && (
                  <p style={{ fontSize:12, color:'var(--bx-text-3)', fontStyle:'italic', margin:'0 0 6px' }}>{c.name_pt}</p>
                )}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {c.rarity && <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:100, background:'rgba(var(--ac-1-rgb), 0.15)', color:'var(--ac-1)', border:'1px solid rgba(var(--ac-1-rgb), 0.25)' }}>{c.rarity}</span>}
                  {(c.subtypes||[]).map((s:string) => <span key={s} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'var(--bx-surface-2)', color:'var(--bx-text-2)' }}>{s}</span>)}
                  {(c.types||[]).map((t:string) => <span key={t} style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:100, background:(TYPE_COLOR[t]?.bg||'var(--bx-surface-2)'), color:(TYPE_COLOR[t]?.text||'var(--bx-text)') }}>{t}</span>)}
                  {c.idioma && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:100, background:`${IDIOMA_COR[c.idioma]||'#9ca3af'}22`, color:IDIOMA_COR[c.idioma]||'#9ca3af', border:`1px solid ${IDIOMA_COR[c.idioma]||'#9ca3af'}44` }}>{String(c.idioma).toUpperCase()}</span>
                  )}
                </div>
              </div>
              {c.hp && <div style={{ textAlign:'right', flexShrink:0 }}><p style={{ fontSize:9, color:'var(--bx-text-3)', marginBottom:2 }}>HP</p><p style={{ fontSize:28, fontWeight:900, color:'var(--bx-red)', letterSpacing:'-0.03em' }}>{c.hp}</p></div>}
            </div>

            {/* Ataques */}
            {attacks.length > 0 && (
              <div>
                <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Ataques</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {attacks.map((atk:any, i:number) => (
                    <div key={i} style={{ background:'var(--bx-surface-2)', borderRadius:10, padding:'10px 12px', border:'1px solid var(--bx-border)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: atk.text ? 4 : 0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ display:'flex', gap:3 }}>
                            {(atk.cost||[]).map((e:string, j:number) => <EnergyDot key={j} type={e} />)}
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--bx-text)' }}>{atk.name}</span>
                        </div>
                        {atk.damage && <span style={{ fontSize:16, fontWeight:900, color:'var(--ac-1)' }}>{atk.damage}</span>}
                      </div>
                      {atk.text && <p style={{ fontSize:11, color:'var(--bx-text-2)', lineHeight:1.5 }}>{atk.text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fraqueza / Resistência / Recuo */}
            {(weaknesses.length > 0 || resistances.length > 0 || (c.retreat_cost||[]).length > 0) && (
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                {weaknesses.length > 0 && (
                  <div>
                    <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Fraqueza</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {weaknesses.map((w:any,i:number) => (
                        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--bx-red)', fontWeight:700 }}>
                          <EnergyDot type={w.type} size={11} /> {w.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {resistances.length > 0 && (
                  <div>
                    <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Resistência</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {resistances.map((r:any,i:number) => (
                        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--bx-green)', fontWeight:700 }}>
                          <EnergyDot type={r.type} size={11} /> {r.value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(c.retreat_cost||[]).length > 0 && (
                  <div>
                    <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Recuo</p>
                    <div style={{ display:'flex', gap:3 }}>{(c.retreat_cost||[]).map((e:string,i:number) => <EnergyDot key={i} type={e} />)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Flavor text */}
            {c.flavor_text && (
              <div style={{ background:'var(--bx-surface)', borderRadius:10, padding:'10px 14px', border:'1px solid var(--bx-border)', borderLeft:'3px solid rgba(var(--ac-1-rgb), 0.3)' }}>
                <p style={{ fontSize:12, color:'var(--bx-text-2)', lineHeight:1.7, fontStyle:'italic' }}>&quot;{c.flavor_text}&quot;</p>
              </div>
            )}

            {/* Preços BR */}
            {/* S34: removido o sufixo que nomeava a fonte — pagina e publica e indexavel,
                expor marca externa = risco SEO/juridico */}
            {(VARIANTES.filter(v => Number(v.med) > 0 || Number(v.min) > 0).length > 0 || outrasVariantesExtra.length > 0) && (
              <div>
                <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Preços BR</p>
                {/* Guard de preco: mesma leitura da pagina de carta -- os
                    numeros continuam (sao o que a fonte diz), mas param de ser
                    afirmados como referencia. */}
                {(c as any)?.preco_nao_confiavel && (
                  <div style={{ display:'flex', gap:8, alignItems:'flex-start', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.28)', borderRadius:8, padding:'8px 10px', marginBottom:8 }}>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ flex:'none', marginTop:1 }}>
                      <path d="M10 3.5 2.5 16.5h15L10 3.5z" stroke="var(--ac-1)" strokeWidth="1.4" strokeLinejoin="round" />
                      <path d="M10 8.5v3.2M10 14.2v.1" stroke="var(--ac-1)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <p style={{ margin:0, fontSize:11.5, lineHeight:1.45, color:'var(--bx-text-2)' }}>
                      <b style={{ color:'var(--ac-1)', fontWeight:600 }}>Preço sob revisão.</b>{' '}
                      Uma oferta só, muito acima do histórico desta carta.
                    </p>
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {VARIANTES.filter(v => Number(v.med) > 0 || Number(v.min) > 0).map(v => (
                    <div key={v.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(34,197,94,0.05)', borderRadius:8, padding:'6px 10px', border:'1px solid rgba(34,197,94,0.1)' }}>
                      <span style={{ fontSize:11, color:'var(--bx-text-2)', fontWeight:600 }}>{v.icon} {v.label}</span>
                      <div style={{ display:'flex', gap:12 }}>
                        {v.min && <span style={{ fontSize:10, color:'var(--bx-text-3)' }}>mín {fmtBRL(v.min)}</span>}
                        {v.med && <span style={{ fontSize:13, fontWeight:800, color:'var(--bx-green)' }}>{fmtBRL(v.med)}</span>}
                        {v.max && <span style={{ fontSize:10, color:'var(--bx-text-3)' }}>máx {fmtBRL(v.max)}</span>}
                      </div>
                    </div>
                  ))}
                  {/* Variantes extras que a Liga acha mas nao tem coluna fixa
                      (ex: prerelease, unknown_a) -- raro, mas e preco real. */}
                  {outrasVariantesExtra.map(v => (
                    <div key={v.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(96,165,250,0.05)', borderRadius:8, padding:'6px 10px', border:'1px solid rgba(96,165,250,0.12)' }}>
                      <span style={{ fontSize:11, color:'var(--bx-text-2)', fontWeight:600 }}>◇ {v.label}</span>
                      <div style={{ display:'flex', gap:12 }}>
                        {v.min && <span style={{ fontSize:10, color:'var(--bx-text-3)' }}>mín {fmtBRL(v.min)}</span>}
                        {v.med && <span style={{ fontSize:13, fontWeight:800, color:'var(--bx-blue)' }}>{fmtBRL(v.med)}</span>}
                        {v.max && <span style={{ fontSize:10, color:'var(--bx-text-3)' }}>máx {fmtBRL(v.max)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {fmtDataCurta(c.liga_updated_at) && (
                  <p style={{ fontSize:9.5, color:'var(--bx-text-faint)', margin:'6px 2px 0' }}>Atualizado em {fmtDataCurta(c.liga_updated_at)}</p>
                )}
              </div>
            )}

            {/* Último vendido — preco REALIZADO (fonte externa), nao pedido (Liga).
                Roxo cravado de proposito, mesmo padrao do modal da Coleção —
                nao var(--ac-2), que aqui seria vermelho (cor de erro/queda).
                Zero busca nova: card.ultima_venda ja vem calculado do banco. */}
            {ultimoVendidoFmt && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, background:'rgba(168,85,247,0.07)', border:'1px solid rgba(168,85,247,0.22)', borderRadius:12, padding:'11px 16px' }}>
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:'#a855f7', display:'flex', flexShrink:0 }}><IconHistory size={14} /></span>
                  <span style={{ fontSize:11, color:'var(--bx-text-2)', fontWeight:600 }}>Último vendido</span>
                </span>
                <span style={{ fontSize:15, fontWeight:800, color:'#a855f7', letterSpacing:'-0.01em' }}>{ultimoVendidoFmt}</span>
              </div>
            )}

            {/* Histórico de vendas -- mesmo endpoint que a Coleção ja usa
                (/api/cards/[id]/historico-vendas), so aparece quando ha
                "ultima venda" pra comparar contra. */}
            {ultimoVendidoFmt && (
              <div style={{ background:'var(--bx-surface)', border:'1px solid var(--bx-border)', borderRadius:12, padding:'12px 14px' }}>
                <p style={{ fontSize:10, letterSpacing:'0.08em', fontWeight:700, color:'var(--bx-text-3)', textTransform:'uppercase', marginBottom:10 }}>Histórico de vendas</p>

                <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                  {FILTROS_DIAS.map(d => (
                    <button key={d} onClick={() => setDiasHistorico(d)}
                      style={{
                        flex:1, padding:'6px 0', minHeight:32, borderRadius:999, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                        border: '1px solid ' + (diasHistorico === d ? 'rgba(168,85,247,0.4)' : 'var(--bx-border-2)'),
                        background: diasHistorico === d ? 'rgba(168,85,247,0.16)' : 'var(--bx-surface-2)',
                        color: diasHistorico === d ? '#a855f7' : 'var(--bx-text-3)',
                      }}>
                      {d}d
                    </button>
                  ))}
                </div>

                {carregandoHistorico ? (
                  <p style={{ fontSize:11, color:'var(--bx-text-faint)', textAlign:'center', padding:'8px 0' }}>Carregando…</p>
                ) : historicoVendas.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {historicoVendas.map((h, i) => {
                      const dias = Math.floor((Date.now() - new Date(h.capturado_em).getTime()) / 86400000)
                      const quando = dias <= 0 ? 'Hoje' : dias === 1 ? 'Ontem' : `${dias} dias atrás`
                      const meta = [h.variante, h.condicao, h.idioma].filter(Boolean).join(' · ')
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, padding:'7px 10px', borderRadius:10, background:'var(--bx-surface-2)' }}>
                          <span style={{ fontSize:11, color:'var(--bx-text-2)', flexShrink:0 }}>{quando}</span>
                          {meta && <span style={{ fontSize:10, color:'var(--bx-text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{meta}</span>}
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--bx-text)', flexShrink:0 }}>{fmtBRL(h.valor_cents / 100)}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize:11, color:'var(--bx-text-faint)', textAlign:'center', padding:'8px 0', lineHeight:1.5 }}>
                    Coletando desde hoje — histórico completo aparece com o tempo.
                  </p>
                )}
              </div>
            )}

            {/* Preços internacionais */}
            {(c.price_usd_normal || c.price_usd_holofoil || c.price_usd_1st_edition || c.price_eur_normal || c.price_eur_holofoil) && (
              <div>
                <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Preços Internacionais (TCGPlayer)</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {c.price_usd_normal && <div style={{ background:'rgba(96,165,250,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.15)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.6)', marginBottom:2 }}>USD Normal</p><p style={{ fontSize:14, fontWeight:800, color:'var(--bx-blue)' }}>${Number(c.price_usd_normal).toFixed(2)}</p></div>}
                  {c.price_usd_holofoil && <div style={{ background:'rgba(96,165,250,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.15)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.6)', marginBottom:2 }}>USD Foil</p><p style={{ fontSize:14, fontWeight:800, color:'var(--bx-blue)' }}>${Number(c.price_usd_holofoil).toFixed(2)}</p></div>}
                  {c.price_usd_reverse && <div style={{ background:'rgba(96,165,250,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.15)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.6)', marginBottom:2 }}>USD Reverse</p><p style={{ fontSize:14, fontWeight:800, color:'var(--bx-blue)' }}>${Number(c.price_usd_reverse).toFixed(2)}</p></div>}
                  {c.price_usd_1st_edition && <div style={{ background:'rgba(245,158,11,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(245,158,11,0.18)' }}><p style={{ fontSize:9, color:'rgba(245,158,11,0.7)', marginBottom:2 }}>USD 1ª Edição</p><p style={{ fontSize:14, fontWeight:800, color:'var(--ac-1)' }}>${Number(c.price_usd_1st_edition).toFixed(2)}</p></div>}
                  {c.price_eur_normal && <div style={{ background:'rgba(96,165,250,0.06)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.12)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.5)', marginBottom:2 }}>EUR Normal</p><p style={{ fontSize:14, fontWeight:800, color:'#93c5fd' }}>€{Number(c.price_eur_normal).toFixed(2)}</p></div>}
                  {c.price_eur_holofoil && <div style={{ background:'rgba(96,165,250,0.06)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.12)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.5)', marginBottom:2 }}>EUR Foil</p><p style={{ fontSize:14, fontWeight:800, color:'#93c5fd' }}>€{Number(c.price_eur_holofoil).toFixed(2)}</p></div>}
                </div>
                {fmtDataCurta(c.tcg_updated_at) && (
                  <p style={{ fontSize:9.5, color:'var(--bx-text-faint)', margin:'6px 2px 0' }}>Atualizado em {fmtDataCurta(c.tcg_updated_at)}</p>
                )}
              </div>
            )}

            {/* Legalidades */}
            {Object.keys(legalities).length > 0 && (
              <div>
                <p style={{ fontSize:10, color:'var(--bx-text-3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Legalidade</p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(legalities).map(([fmt, status]:any) => (
                    <span key={fmt} style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100, background: status==='Legal' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: status==='Legal' ? 'var(--bx-green)' : 'var(--bx-red)', border:`1px solid ${status==='Legal' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      {fmt.charAt(0).toUpperCase()+fmt.slice(1)}: {status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid var(--bx-border)', background:'rgba(0,0,0,0.3)', flexShrink:0 }}>
          <p style={{ fontSize:11, color:'var(--bx-text-3)', marginBottom:10, fontWeight:600 }}>Qual versão você possui?</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:8, marginBottom:14 }}>
            {VARIANTES.map(v => {
              const isSelected = selectedVariante === v.key
              return (
                <button key={v.key} onClick={() => setSelectedVariante(v.key)}
                  style={{ padding:'10px 8px', minHeight:44, borderRadius:12, cursor:'pointer', fontFamily:'inherit', textAlign:'center', background: isSelected ? 'rgba(var(--ac-1-rgb), 0.15)' : 'var(--bx-surface-2)', border: isSelected ? '2px solid rgba(var(--ac-1-rgb), 0.6)' : '1px solid var(--bx-border-2)', color: isSelected ? 'var(--ac-1)' : 'var(--bx-text-3)', boxSizing:'border-box' }}>
                  <p style={{ fontSize:16, marginBottom:2 }}>{v.icon}</p>
                  <p style={{ fontSize:12, fontWeight:700 }}>{v.label}</p>
                  {fmtBRL(v.med) && <p style={{ fontSize:11, color: isSelected ? 'rgba(var(--ac-1-rgb), 0.8)' : 'var(--bx-text-3)', marginTop:2 }}>{fmtBRL(v.med)}</p>}
                </button>
              )
            })}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
            <button onClick={onClose} style={{ background:'var(--bx-surface-2)', border:'1px solid var(--bx-border-2)', color:'var(--bx-text-3)', padding:'11px 24px', minHeight:44, borderRadius:12, fontSize:13, cursor:'pointer', fontFamily:'inherit', flex:1, boxSizing:'border-box' }}>
              Fechar
            </button>
            <button onClick={() => onAdd({ ...c, _variante: selectedVariante })}
              style={{ background:'var(--ac-grad)', border:'none', color:'var(--bx-brand-ink)', padding:'11px 28px', minHeight:44, borderRadius:12, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, flex:2, boxSizing:'border-box' }}>
              + Adicionar à Coleção
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
