'use client'

import { TYPE_COLOR } from './page'

const ENERGY: Record<string, string> = {
  Fire:'🔥', Water:'💧', Grass:'🌿', Lightning:'⚡', Psychic:'🔮',
  Fighting:'👊', Darkness:'🌑', Metal:'⚙️', Dragon:'🐉', Colorless:'⭕', Fairy:'🌸'
}

const fmtBRL = (v: any) => v && Number(v) > 0
  ? new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(Number(v))
  : null

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

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#0d0f14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, width:'100%', maxWidth:900, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 32px 100px rgba(0,0,0,0.7)', overflow:'hidden' }}>

        {/* Nav entre cartas */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(0,0,0,0.2)', flexShrink:0 }}>
          <button onClick={() => prevCard && onNavigate(prevCard, cardIndex - 1)} disabled={!prevCard}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color: prevCard ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', cursor: prevCard ? 'pointer' : 'default', fontSize:12, fontFamily:'inherit', padding:'4px 8px', borderRadius:8 }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {prevCard ? prevCard.name : '—'}
          </button>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.25)' }}>{cardIndex + 1} de {cards.length}</span>
          <button onClick={() => nextCard && onNavigate(nextCard, cardIndex + 1)} disabled={!nextCard}
            style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color: nextCard ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)', cursor: nextCard ? 'pointer' : 'default', fontSize:12, fontFamily:'inherit', padding:'4px 8px', borderRadius:8 }}>
            {nextCard ? nextCard.name : '—'}
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Corpo */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* Coluna esquerda */}
          <div style={{ padding:20, background:'rgba(255,255,255,0.02)', borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none', display:'flex', flexDirection:'row', flexWrap:'wrap', alignItems:'flex-start', gap:12, overflowY:'auto', maxHeight: isMobile ? 220 : undefined, flexShrink:0 }}>
            {(c.image_large || c.image_small) && (
              <img src={c.image_large || c.image_small} alt={c.name} referrerPolicy="no-referrer" style={{ width:140, maxWidth:'40vw', borderRadius:12, flexShrink:0 }} />
            )}
            <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minWidth:150 }}>
              {(c.set_symbol || c.set_logo) && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {c.set_symbol && <img src={c.set_symbol} alt="" style={{ height:18, objectFit:'contain' }} />}
                  {c.set_logo && <img src={c.set_logo} alt={c.set_name} style={{ height:18, objectFit:'contain', maxWidth:100 }} />}
                </div>
              )}
              {[
                { label:'Coleção',     value: c.set_name },
                { label:'Número',      value: c.number && c.set_total ? `${String(c.number).padStart(3,'0')} / ${String(c.set_total).padStart(3,'0')}` : c.number },
                { label:'Lançamento',  value: c.set_release_date ? c.set_release_date.split('/').reverse().join('/') : null },
                { label:'Artista',     value: c.artist },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display:'flex', gap:6 }}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:700, minWidth:72, flexShrink:0 }}>{r.label}:</span>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.65)', lineHeight:1.4 }}>{r.value}</span>
                </div>
              ))}
            </div>
            {c.liga_link && (
              <a href={c.liga_link} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'rgba(96,165,250,0.8)', textDecoration:'none', padding:'6px 10px', background:'rgba(96,165,250,0.08)', borderRadius:8, border:'1px solid rgba(96,165,250,0.15)', width:'100%', justifyContent:'center' }}>
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M11 3h6v6m0-6L10 10M7 5H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Ver na Liga Pokémon
              </a>
            )}
          </div>

          {/* Coluna direita */}
          <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14, overflowY:'auto', flex:1 }}>

            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div>
                <h2 style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.03em', marginBottom:6 }}>{c.name}</h2>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {c.rarity && <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:100, background:'rgba(245,158,11,0.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,0.25)' }}>{c.rarity}</span>}
                  {(c.subtypes||[]).map((s:string) => <span key={s} style={{ fontSize:10, padding:'3px 8px', borderRadius:100, background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' }}>{s}</span>)}
                  {(c.types||[]).map((t:string) => <span key={t} style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:100, background:(TYPE_COLOR[t]?.bg||'rgba(255,255,255,0.08)'), color:(TYPE_COLOR[t]?.text||'#f0f0f0') }}>{t}</span>)}
                </div>
              </div>
              {c.hp && <div style={{ textAlign:'right', flexShrink:0 }}><p style={{ fontSize:9, color:'rgba(255,255,255,0.3)', marginBottom:2 }}>HP</p><p style={{ fontSize:28, fontWeight:900, color:'#ef4444', letterSpacing:'-0.03em' }}>{c.hp}</p></div>}
            </div>

            {/* Ataques */}
            {attacks.length > 0 && (
              <div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Ataques</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {attacks.map((atk:any, i:number) => (
                    <div key={i} style={{ background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: atk.text ? 4 : 0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ display:'flex', gap:2 }}>
                            {(atk.cost||[]).map((e:string, j:number) => <span key={j} style={{ fontSize:13 }}>{ENERGY[e]||'⭕'}</span>)}
                          </div>
                          <span style={{ fontSize:13, fontWeight:700 }}>{atk.name}</span>
                        </div>
                        {atk.damage && <span style={{ fontSize:16, fontWeight:900, color:'#f59e0b' }}>{atk.damage}</span>}
                      </div>
                      {atk.text && <p style={{ fontSize:11, color:'rgba(255,255,255,0.45)', lineHeight:1.5 }}>{atk.text}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fraqueza / Resistência / Recuo */}
            {(weaknesses.length > 0 || resistances.length > 0 || (c.retreat_cost||[]).length > 0) && (
              <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                {weaknesses.length > 0 && <div><p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Fraqueza</p>{weaknesses.map((w:any,i:number) => <span key={i} style={{ fontSize:12, color:'#ef4444', fontWeight:700 }}>{ENERGY[w.type]||w.type} {w.value}</span>)}</div>}
                {resistances.length > 0 && <div><p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Resistência</p>{resistances.map((r:any,i:number) => <span key={i} style={{ fontSize:12, color:'#22c55e', fontWeight:700 }}>{ENERGY[r.type]||r.type} {r.value}</span>)}</div>}
                {(c.retreat_cost||[]).length > 0 && <div><p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Recuo</p><div style={{ display:'flex', gap:2 }}>{(c.retreat_cost||[]).map((e:string,i:number) => <span key={i} style={{ fontSize:13 }}>{ENERGY[e]||'⭕'}</span>)}</div></div>}
              </div>
            )}

            {/* Flavor text */}
            {c.flavor_text && (
              <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid rgba(245,158,11,0.3)' }}>
                <p style={{ fontSize:12, color:'rgba(255,255,255,0.45)', lineHeight:1.7, fontStyle:'italic' }}>"{c.flavor_text}"</p>
              </div>
            )}

            {/* Preços BR */}
            {VARIANTES.filter(v => Number(v.med) > 0 || Number(v.min) > 0).length > 0 && (
              <div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Preços BR (Liga Pokémon)</p>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {VARIANTES.filter(v => Number(v.med) > 0 || Number(v.min) > 0).map(v => (
                    <div key={v.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(34,197,94,0.05)', borderRadius:8, padding:'6px 10px', border:'1px solid rgba(34,197,94,0.1)' }}>
                      <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>{v.icon} {v.label}</span>
                      <div style={{ display:'flex', gap:12 }}>
                        {v.min && <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>mín {fmtBRL(v.min)}</span>}
                        {v.med && <span style={{ fontSize:13, fontWeight:800, color:'#22c55e' }}>{fmtBRL(v.med)}</span>}
                        {v.max && <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>máx {fmtBRL(v.max)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preços internacionais */}
            {(c.price_usd_normal || c.price_usd_holofoil || c.price_eur_normal || c.price_eur_holofoil) && (
              <div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Preços Internacionais (TCGPlayer)</p>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {c.price_usd_normal && <div style={{ background:'rgba(96,165,250,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.15)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.6)', marginBottom:2 }}>USD Normal</p><p style={{ fontSize:14, fontWeight:800, color:'#60a5fa' }}>${Number(c.price_usd_normal).toFixed(2)}</p></div>}
                  {c.price_usd_holofoil && <div style={{ background:'rgba(96,165,250,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.15)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.6)', marginBottom:2 }}>USD Foil</p><p style={{ fontSize:14, fontWeight:800, color:'#60a5fa' }}>${Number(c.price_usd_holofoil).toFixed(2)}</p></div>}
                  {c.price_usd_reverse && <div style={{ background:'rgba(96,165,250,0.08)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.15)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.6)', marginBottom:2 }}>USD Reverse</p><p style={{ fontSize:14, fontWeight:800, color:'#60a5fa' }}>${Number(c.price_usd_reverse).toFixed(2)}</p></div>}
                  {c.price_eur_normal && <div style={{ background:'rgba(96,165,250,0.06)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.12)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.5)', marginBottom:2 }}>EUR Normal</p><p style={{ fontSize:14, fontWeight:800, color:'#93c5fd' }}>€{Number(c.price_eur_normal).toFixed(2)}</p></div>}
                  {c.price_eur_holofoil && <div style={{ background:'rgba(96,165,250,0.06)', borderRadius:8, padding:'6px 12px', border:'1px solid rgba(96,165,250,0.12)' }}><p style={{ fontSize:9, color:'rgba(96,165,250,0.5)', marginBottom:2 }}>EUR Foil</p><p style={{ fontSize:14, fontWeight:800, color:'#93c5fd' }}>€{Number(c.price_eur_holofoil).toFixed(2)}</p></div>}
                </div>
              </div>
            )}

            {/* Legalidades */}
            {Object.keys(legalities).length > 0 && (
              <div>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6 }}>Legalidade</p>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {Object.entries(legalities).map(([fmt, status]:any) => (
                    <span key={fmt} style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100, background: status==='Legal' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: status==='Legal' ? '#22c55e' : '#ef4444', border:`1px solid ${status==='Legal' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      {fmt.charAt(0).toUpperCase()+fmt.slice(1)}: {status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.3)', flexShrink:0 }}>
          <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:10, fontWeight:600 }}>Qual versão você possui?</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:8, marginBottom:14 }}>
            {VARIANTES.map(v => {
              const isSelected = selectedVariante === v.key
              return (
                <button key={v.key} onClick={() => setSelectedVariante(v.key)}
                  style={{ padding:'10px 8px', borderRadius:12, cursor:'pointer', fontFamily:'inherit', textAlign:'center', background: isSelected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)', border: isSelected ? '2px solid rgba(245,158,11,0.6)' : '1px solid rgba(255,255,255,0.08)', color: isSelected ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                  <p style={{ fontSize:16, marginBottom:2 }}>{v.icon}</p>
                  <p style={{ fontSize:12, fontWeight:700 }}>{v.label}</p>
                  {fmtBRL(v.med) && <p style={{ fontSize:11, color: isSelected ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.3)', marginTop:2 }}>{fmtBRL(v.med)}</p>}
                </button>
              )
            })}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', padding:'11px 24px', borderRadius:12, fontSize:13, cursor:'pointer', fontFamily:'inherit', flex:1 }}>
              Fechar
            </button>
            <button onClick={() => onAdd({ ...c, _variante: selectedVariante })}
              style={{ background:'linear-gradient(135deg, #f59e0b, #ef4444)', border:'none', color:'#000', padding:'11px 28px', borderRadius:12, fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, flex:2 }}>
              + Adicionar à Coleção
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
