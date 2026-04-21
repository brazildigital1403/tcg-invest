'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/ui/AppLayout'
import { supabase } from '@/lib/supabaseClient'

const GENERATIONS = [
  { label: 'Gen I',    short: 'GEN 1', from: 1,    to: 151,  region: 'Kanto',  color: '#e74c3c' },
  { label: 'Gen II',   short: 'GEN 2', from: 152,   to: 251,  region: 'Johto',  color: '#f39c12' },
  { label: 'Gen III',  short: 'GEN 3', from: 252,   to: 386,  region: 'Hoenn',  color: '#27ae60' },
  { label: 'Gen IV',   short: 'GEN 4', from: 387,   to: 493,  region: 'Sinnoh', color: '#2980b9' },
  { label: 'Gen V',    short: 'GEN 5', from: 494,   to: 649,  region: 'Unova',  color: '#8e44ad' },
  { label: 'Gen VI',   short: 'GEN 6', from: 650,   to: 721,  region: 'Kalos',  color: '#16a085' },
  { label: 'Gen VII',  short: 'GEN 7', from: 722,   to: 809,  region: 'Alola',  color: '#d35400' },
  { label: 'Gen VIII', short: 'GEN 8', from: 810,   to: 905,  region: 'Galar',  color: '#c0392b' },
  { label: 'Gen IX',   short: 'GEN 9', from: 906,   to: 1025, region: 'Paldea', color: '#7f8c8d' },
]

const PT: Record<number, string> = {
  1:'Bulbasaur',2:'Ivysaur',3:'Venusaur',4:'Charmander',5:'Charmeleon',6:'Charizard',7:'Squirtle',8:'Wartortle',9:'Blastoise',10:'Caterpie',11:'Metapod',12:'Butterfree',13:'Weedle',14:'Kakuna',15:'Beedrill',16:'Pidgey',17:'Pidgeotto',18:'Pidgeot',19:'Rattata',20:'Raticate',21:'Spearow',22:'Fearow',23:'Ekans',24:'Arbok',25:'Pikachu',26:'Raichu',27:'Sandshrew',28:'Sandslash',29:'Nidoran♀',30:'Nidorina',31:'Nidoqueen',32:'Nidoran♂',33:'Nidorino',34:'Nidoking',35:'Clefairy',36:'Clefable',37:'Vulpix',38:'Ninetales',39:'Jigglypuff',40:'Wigglytuff',41:'Zubat',42:'Golbat',43:'Oddish',44:'Gloom',45:'Vileplume',46:'Paras',47:'Parasect',48:'Venonat',49:'Venomoth',50:'Diglett',51:'Dugtrio',52:'Meowth',53:'Persian',54:'Psyduck',55:'Golduck',56:'Mankey',57:'Primeape',58:'Growlithe',59:'Arcanine',60:'Poliwag',61:'Poliwhirl',62:'Poliwrath',63:'Abra',64:'Kadabra',65:'Alakazam',66:'Machop',67:'Machoke',68:'Machamp',69:'Bellsprout',70:'Weepinbell',71:'Victreebel',72:'Tentacool',73:'Tentacruel',74:'Geodude',75:'Graveler',76:'Golem',77:'Ponyta',78:'Rapidash',79:'Slowpoke',80:'Slowbro',81:'Magnemite',82:'Magneton',83:"Farfetch'd",84:'Doduo',85:'Dodrio',86:'Seel',87:'Dewgong',88:'Grimer',89:'Muk',90:'Shellder',91:'Cloyster',92:'Gastly',93:'Haunter',94:'Gengar',95:'Onix',96:'Drowzee',97:'Hypno',98:'Krabby',99:'Kingler',100:'Voltorb',101:'Electrode',102:'Exeggcute',103:'Exeggutor',104:'Cubone',105:'Marowak',106:'Hitmonlee',107:'Hitmonchan',108:'Lickitung',109:'Koffing',110:'Weezing',111:'Rhyhorn',112:'Rhydon',113:'Chansey',114:'Tangela',115:'Kangaskhan',116:'Horsea',117:'Seadra',118:'Goldeen',119:'Seaking',120:'Staryu',121:'Starmie',122:'Mr. Mime',123:'Scyther',124:'Jynx',125:'Electabuzz',126:'Magmar',127:'Pinsir',128:'Tauros',129:'Magikarp',130:'Gyarados',131:'Lapras',132:'Ditto',133:'Eevee',134:'Vaporeon',135:'Jolteon',136:'Flareon',137:'Porygon',138:'Omanyte',139:'Omastar',140:'Kabuto',141:'Kabutops',142:'Aerodactyl',143:'Snorlax',144:'Articuno',145:'Zapdos',146:'Moltres',147:'Dratini',148:'Dragonair',149:'Dragonite',150:'Mewtwo',151:'Mew',152:'Chikorita',153:'Bayleef',154:'Meganium',155:'Cyndaquil',156:'Quilava',157:'Typhlosion',158:'Totodile',159:'Croconaw',160:'Feraligatr',161:'Sentret',162:'Furret',163:'Hoothoot',164:'Noctowl',165:'Ledyba',166:'Ledian',167:'Spinarak',168:'Ariados',169:'Crobat',170:'Chinchou',171:'Lanturn',172:'Pichu',173:'Cleffa',174:'Igglybuff',175:'Togepi',176:'Togetic',177:'Natu',178:'Xatu',179:'Mareep',180:'Flaaffy',181:'Ampharos',182:'Bellossom',183:'Marill',184:'Azumarill',185:'Sudowoodo',186:'Politoed',187:'Hoppip',188:'Skiploom',189:'Jumpluff',190:'Aipom',191:'Sunkern',192:'Sunflora',193:'Yanma',194:'Wooper',195:'Quagsire',196:'Espeon',197:'Umbreon',198:'Murkrow',199:'Slowking',200:'Misdreavus',201:'Unown',202:'Wobbuffet',203:'Girafarig',204:'Pineco',205:'Forretress',206:'Dunsparce',207:'Gligar',208:'Steelix',209:'Snubbull',210:'Granbull',211:'Qwilfish',212:'Scizor',213:'Shuckle',214:'Heracross',215:'Sneasel',216:'Teddiursa',217:'Ursaring',218:'Slugma',219:'Magcargo',220:'Swinub',221:'Piloswine',222:'Corsola',223:'Remoraid',224:'Octillery',225:'Delibird',226:'Mantine',227:'Skarmory',228:'Houndour',229:'Houndoom',230:'Kingdra',231:'Phanpy',232:'Donphan',233:'Porygon2',234:'Stantler',235:'Smeargle',236:'Tyrogue',237:'Hitmontop',238:'Smoochum',239:'Elekid',240:'Magby',241:'Miltank',242:'Blissey',243:'Raikou',244:'Entei',245:'Suicune',246:'Larvitar',247:'Pupitar',248:'Tyranitar',249:'Lugia',250:'Ho-oh',251:'Celebi',
}

function getName(id: number, en: string): string {
  return PT[id] || en.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function getGen(id: number) {
  return GENERATIONS.find(g => id >= g.from && id <= g.to) || GENERATIONS[0]
}

function getArtwork(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
}

interface Pokemon { id: number; name: string }

export default function SeparadoresPage() {
  const [selectedGens, setSelectedGens] = useState<number[]>([0])
  const [pokeList, setPokeList]   = useState<Pokemon[]>([])
  const [loading, setLoading]     = useState(false)
  const [loaded, setLoaded]       = useState(false)
  const [desbloqueado, setDesbloqueado] = useState<boolean | null>(null)
  const [comprando, setComprando] = useState(false)

  const loadPokemons = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
      const data = await res.json()
      setPokeList(data.results.map((p: any, i: number) => ({ id: i + 1, name: getName(i + 1, p.name) })))
    } catch {
      setPokeList(Array.from({ length: 1025 }, (_, i) => ({ id: i + 1, name: PT[i + 1] || `#${i + 1}` })))
    }
    setLoaded(true)
    setLoading(false)
  }, [loaded])

  useEffect(() => { loadPokemons() }, [loadPokemons])

  // Bloqueia impressão no CSS quando não desbloqueado
  useEffect(() => {
    if (desbloqueado === false) {
      document.body.classList.add('print-blocked')
    } else {
      document.body.classList.remove('print-blocked')
    }
    return () => document.body.classList.remove('print-blocked')
  }, [desbloqueado])

  // Verifica se já desbloqueou + detecta retorno do Stripe
  useEffect(() => {
    async function checkStatus() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setDesbloqueado(false); return }

      const { data } = await supabase
        .from('users')
        .select('separadores_desbloqueado')
        .eq('id', user.id)
        .limit(1)

      const status = data?.[0]?.separadores_desbloqueado ?? false
      setDesbloqueado(status)

      // Se voltou do Stripe com ?desbloqueado=1, força refresh
      if (window.location.search.includes('desbloqueado=1') && !status) {
        setTimeout(checkStatus, 2000) // Aguarda webhook processar
      }
    }
    checkStatus()
  }, [])

  async function handleComprar() {
    setComprando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: 'separadores', userId: user.id, userEmail: user.email }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      setComprando(false)
    }
  }

  // Força carregamento de todas as imagens antes de imprimir
  useEffect(() => {
    const handleBeforePrint = () => {
      const imgs = document.querySelectorAll('.sep-card img')
      imgs.forEach((img: any) => {
        if (!img.complete) {
          img.loading = 'eager'
          const src = img.src
          img.src = ''
          img.src = src
        }
      })
    }
    window.addEventListener('beforeprint', handleBeforePrint)
    return () => window.removeEventListener('beforeprint', handleBeforePrint)
  }, [])

  function toggleGen(idx: number) {
    setSelectedGens(p => p.includes(idx) ? p.filter(g => g !== idx) : [...p, idx].sort((a, b) => a - b))
  }

  const filtered = pokeList.filter(p =>
    selectedGens.some(idx => { const g = GENERATIONS[idx]; return p.id >= g.from && p.id <= g.to })
  )

  const pages: Pokemon[][] = []
  for (let i = 0; i < filtered.length; i += 9) pages.push(filtered.slice(i, i + 9))

  return (
    <AppLayout>
      <style>{`
        @media print {
          /* ── Esconde interface do app ── */
          .no-print, .tcg-sidebar, .tcg-header, .tcg-bottom-nav,
          footer, header, nav, aside { display: none !important; }

          /* ── Reset total — neutraliza todos os containers do AppLayout ── */
          html, body {
            background: white !important;
            margin: 0 !important; padding: 0 !important;
            width: 210mm !important;
            overflow: visible !important;
          }
          .tcg-root, .tcg-main-col, .tcg-content {
            display: block !important;
            width: 210mm !important;
            max-width: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          /* Wrapper inline (max-width:1000 + padding:32px 24px) */
          .tcg-content > div {
            max-width: 210mm !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 210mm !important;
          }

          /* ── Uma página A4 por bloco de 9 cartas ── */
          .print-page {
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            display: grid !important;
            grid-template-columns: repeat(3, 63mm) !important;
            grid-template-rows: repeat(3, 88mm) !important;
            gap: 0 !important;
            padding: 10.5mm !important;
            box-sizing: border-box !important;
            background: white !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .print-page:last-child { page-break-after: auto !important; break-after: auto !important; }

          /* ── Card: exatamente 63mm x 88mm ── */
          .sep-card {
            width: 63mm !important;
            height: 88mm !important;
            border: 0.5px solid #333 !important;
            border-radius: 2.5mm !important;
            background: white !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* ── Badge Bynx ── */
          .bynx-badge {
            width: 5mm !important; height: 5mm !important;
            top: 1.5mm !important; right: 1.5mm !important;
          }
          /* Bloqueia impressão se não desbloqueado */
          .print-blocked * { display: none !important; }
          .print-blocked::before {
            display: block !important;
            content: 'Acesse bynx.gg/separadores para desbloquear os Separadores de Fichário.';
            font-size: 16pt;
            text-align: center;
            margin-top: 120mm;
          }
        }
        @page { size: A4 portrait; margin: 0; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
                Separadores de Fichário
              </h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                Tamanho exato de carta TCG Pokémon (6,3 × 8,8 cm).
                {filtered.length > 0 && (
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                    {' '}· {filtered.length} Pokémons · {pages.length} página{pages.length > 1 ? 's' : ''} A4
                  </span>
                )}
              </p>
            </div>
            {/* Botão: comprar ou imprimir */}
            {desbloqueado === false ? (
              <button onClick={handleComprar} disabled={comprando} style={{
                background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
                border: 'none', borderRadius: 12, padding: '12px 24px',
                color: '#000', fontWeight: 800, fontSize: 14,
                cursor: comprando ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', flexShrink: 0,
                opacity: comprando ? 0.7 : 1,
              }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="6" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M6 6V5a4 4 0 018 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {comprando ? 'Aguarde...' : 'Desbloquear — R$14,90'}
              </button>
            ) : (
              <button
                onClick={async () => {
                  const imgs = Array.from(document.querySelectorAll('.sep-card img')) as HTMLImageElement[]
                  const unloaded = imgs.filter(img => !img.complete || img.naturalWidth === 0)
                  if (unloaded.length > 0) {
                    await Promise.allSettled(unloaded.map(img =>
                      new Promise(res => { img.onload = res; img.onerror = res; const s = img.src; img.src = ''; img.src = s })
                    ))
                  }
                  window.print()
                }}
                disabled={filtered.length === 0 || desbloqueado === null}
                style={{
                  background: filtered.length === 0 || desbloqueado === null ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
                  border: 'none', borderRadius: 12, padding: '12px 24px',
                  color: filtered.length === 0 || desbloqueado === null ? 'rgba(255,255,255,0.3)' : '#000',
                  fontWeight: 800, fontSize: 14,
                  cursor: filtered.length === 0 || desbloqueado === null ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M5 7V3h10v4M5 15H3a1 1 0 01-1-1V8a1 1 0 011-1h14a1 1 0 011 1v6a1 1 0 01-1 1h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <rect x="5" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Imprimir / PDF
              </button>
            )}
          </div>

          {/* Gerações */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 20px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gerações</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setSelectedGens(GENERATIONS.map((_, i) => i))} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Todas</button>
                <button onClick={() => setSelectedGens([])} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.25)', padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {GENERATIONS.map((g, idx) => {
                const on = selectedGens.includes(idx)
                return (
                  <button key={idx} onClick={() => toggleGen(idx)} style={{
                    background: on ? `${g.color}20` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${on ? g.color + '55' : 'rgba(255,255,255,0.07)'}`,
                    color: on ? g.color : 'rgba(255,255,255,0.35)',
                    padding: '7px 12px', borderRadius: 8, fontSize: 12,
                    fontWeight: on ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {g.label}
                    <span style={{ fontSize: 9, opacity: 0.55, marginLeft: 5 }}>{g.region}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dica */}
          {filtered.length > 0 && (
            <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="10" cy="10" r="7.5" stroke="#f59e0b" strokeWidth="1.3"/>
                <path d="M10 9v5M10 7v.5" stroke="#f59e0b" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Ao imprimir: selecione <strong style={{ color: 'rgba(255,255,255,0.65)' }}>Sem margens</strong>, tamanho <strong style={{ color: 'rgba(255,255,255,0.65)' }}>A4</strong>, escala <strong style={{ color: 'rgba(255,255,255,0.65)' }}>100%</strong>. Cada cartão imprime exatamente em 6,3 × 8,8 cm — tamanho real de uma carta TCG.
            </div>
          )}
        </div>

        {loading && (
          <p className="no-print" style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
            Carregando Pokédex completa...
          </p>
        )}

        {/* Banner de desbloqueio — quando não pago */}
        {desbloqueado === false && filtered.length > 0 && (
          <div className="no-print" style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.06))',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 16, padding: '28px 32px', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 24, flexWrap: 'wrap',
          }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>
                🔒 Preview — 9 separadores de amostra
              </p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
                Desbloqueie os <strong style={{ color: '#f59e0b' }}>1.025 Pokémons completos</strong> por apenas <strong style={{ color: '#f59e0b' }}>R$14,90 uma única vez</strong>. Acesso vitalício, sempre atualizado.
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
                ✓ Todas as 9 gerações · ✓ Seleção por geração · ✓ Para sempre · ✓ Impressão ilimitada
              </p>
            </div>
            <button onClick={handleComprar} disabled={comprando} style={{
              background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
              border: 'none', borderRadius: 12, padding: '14px 28px',
              color: '#000', fontWeight: 800, fontSize: 15,
              cursor: comprando ? 'wait' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              opacity: comprando ? 0.7 : 1,
            }}>
              {comprando ? 'Aguarde...' : 'Desbloquear por R$14,90'}
            </button>
          </div>
        )}

        {/* Sucesso após pagamento */}
        {desbloqueado === true && window?.location?.search?.includes('desbloqueado=1') && (
          <div className="no-print" style={{
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#22c55e',
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 10l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            <strong>Separadores desbloqueados!</strong> Agora você pode selecionar as gerações e imprimir à vontade.
          </div>
        )}

        {/* Grid de preview + impressão */}
        {(desbloqueado === false ? pages.slice(0, 1) : pages).map((page, pi) => (
          <div key={pi} className="print-page" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            padding: 16,
            marginBottom: 20,
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
          }}>
            {page.map(poke => <SepCard key={poke.id} id={poke.id} name={poke.name} />)}
          </div>
        ))}

        {filtered.length === 0 && !loading && loaded && (
          <div className="no-print" style={{ textAlign: 'center', padding: '56px 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
            <svg width="40" height="40" viewBox="0 0 20 20" fill="none" style={{ display: 'block', margin: '0 auto 12px' }}>
              <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 7h14M3 12h14M7 2v5M7 12v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            Selecione pelo menos uma geração
          </div>
        )}

      </div>
    </AppLayout>
  )
}

// ── Card: 63mm x 88mm na impressão ───────────────────────────────────────────

function SepCard({ id, name }: { id: number; name: string }) {
  const [imgErr, setImgErr] = useState(false)
  const gen = getGen(id)
  const img = imgErr
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    : getArtwork(id)

  return (
    <div className="sep-card" style={{
      background: 'white',
      border: '1px solid #2a2a2a',
      borderRadius: 6,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      aspectRatio: '63 / 88',
      position: 'relative',
    }}>
      {/* GEN badge — canto superior esquerdo */}
      <div style={{
        position: 'absolute', top: '4%', left: '5%',
        fontSize: 'min(1.8vw, 8px)',
        fontWeight: 800,
        color: gen.color,
        letterSpacing: '0.04em',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: 1,
        zIndex: 2,
      }}>
        {gen.short}
      </div>

      {/* Bynx badge circular — canto superior direito */}
      <div className="bynx-badge" style={{
        position: 'absolute',
        top: '3%',
        right: '4%',
        width: 'min(4vw, 18px)',
        height: 'min(4vw, 18px)',
        borderRadius: '50%',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: 3,
        flexShrink: 0,
      }}>
        <img
          src="/bynx_perfil.png"
          alt="Bynx"
          onError={(e: any) => { e.currentTarget.src = '/favicon.png' }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* Imagem Pokémon — 65% da altura */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16% 12% 4%',
      }}>
        <img
          src={img}
          alt={name}
          onError={() => setImgErr(true)}
          loading="eager"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Nome + Número */}
      <div style={{
        borderTop: '0.5px solid #e0e0e0',
        padding: '4% 6% 5%',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}>
        <p style={{
          fontSize: 'min(2.2vw, 12px)',
          fontWeight: 900,
          color: '#111',
          textAlign: 'center',
          lineHeight: 1.15,
          fontFamily: "'Arial Black', 'Helvetica Neue', system-ui, sans-serif",
          margin: 0,
          wordBreak: 'break-word',
        }}>
          {name}
        </p>
        <p style={{
          fontSize: 'min(1.8vw, 10px)',
          fontWeight: 600,
          color: '#666',
          letterSpacing: '0.06em',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
        }}>
          #{String(id).padStart(4, '0')}
        </p>
      </div>
    </div>
  )
}