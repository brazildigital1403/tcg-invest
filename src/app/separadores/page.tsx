'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/ui/AppLayout'

// ── Gerações da Pokédex Nacional ──────────────────────────────────────────────
const GENERATIONS = [
  { label: 'Geração I',   from: 1,   to: 151,  region: 'Kanto'   },
  { label: 'Geração II',  from: 152,  to: 251,  region: 'Johto'   },
  { label: 'Geração III', from: 252,  to: 386,  region: 'Hoenn'   },
  { label: 'Geração IV',  from: 387,  to: 493,  region: 'Sinnoh'  },
  { label: 'Geração V',   from: 494,  to: 649,  region: 'Unova'   },
  { label: 'Geração VI',  from: 650,  to: 721,  region: 'Kalos'   },
  { label: 'Geração VII', from: 722,  to: 809,  region: 'Alola'   },
  { label: 'Geração VIII',from: 810,  to: 905,  region: 'Galar'   },
  { label: 'Geração IX',  from: 906,  to: 1025, region: 'Paldea'  },
]

// ── Nomes PT dos Pokémons (geração por geração) ───────────────────────────────
// PokeAPI retorna nomes em inglês; mapeamos os 1025 para PT-BR
// Para os que não temos tradução oficial usamos o nome em inglês
const PT_NAMES: Record<number, string> = {
  1:'Bulbasaur',2:'Ivysaur',3:'Venusaur',4:'Charmander',5:'Charmeleon',6:'Charizard',
  7:'Squirtle',8:'Wartortle',9:'Blastoise',10:'Caterpie',11:'Metapod',12:'Butterfree',
  13:'Weedle',14:'Kakuna',15:'Beedrill',16:'Pidgey',17:'Pidgeotto',18:'Pidgeot',
  19:'Rattata',20:'Raticate',21:'Spearow',22:'Fearow',23:'Ekans',24:'Arbok',
  25:'Pikachu',26:'Raichu',27:'Sandshrew',28:'Sandslash',29:'Nidoran♀',30:'Nidorina',
  31:'Nidoqueen',32:'Nidoran♂',33:'Nidorino',34:'Nidoking',35:'Clefairy',36:'Clefable',
  37:'Vulpix',38:'Ninetales',39:'Jigglypuff',40:'Wigglytuff',41:'Zubat',42:'Golbat',
  43:'Oddish',44:'Gloom',45:'Vileplume',46:'Paras',47:'Parasect',48:'Venonat',
  49:'Venomoth',50:'Diglett',51:'Dugtrio',52:'Meowth',53:'Persian',54:'Psyduck',
  55:'Golduck',56:'Mankey',57:'Primeape',58:'Growlithe',59:'Arcanine',60:'Poliwag',
  61:'Poliwhirl',62:'Poliwrath',63:'Abra',64:'Kadabra',65:'Alakazam',66:'Machop',
  67:'Machoke',68:'Machamp',69:'Bellsprout',70:'Weepinbell',71:'Victreebel',
  72:'Tentacool',73:'Tentacruel',74:'Geodude',75:'Graveler',76:'Golem',
  77:'Ponyta',78:'Rapidash',79:'Slowpoke',80:'Slowbro',81:'Magnemite',82:'Magneton',
  83:"Farfetch'd",84:'Doduo',85:'Dodrio',86:'Seel',87:'Dewgong',88:'Grimer',
  89:'Muk',90:'Shellder',91:'Cloyster',92:'Gastly',93:'Haunter',94:'Gengar',
  95:'Onix',96:'Drowzee',97:'Hypno',98:'Krabby',99:'Kingler',100:'Voltorb',
  101:'Electrode',102:'Exeggcute',103:'Exeggutor',104:'Cubone',105:'Marowak',
  106:'Hitmonlee',107:'Hitmonchan',108:'Lickitung',109:'Koffing',110:'Weezing',
  111:'Rhyhorn',112:'Rhydon',113:'Chansey',114:'Tangela',115:'Kangaskhan',
  116:'Horsea',117:'Seadra',118:'Goldeen',119:'Seaking',120:'Staryu',121:'Starmie',
  122:'Mr. Mime',123:'Scyther',124:'Jynx',125:'Electabuzz',126:'Magmar',127:'Pinsir',
  128:'Tauros',129:'Magikarp',130:'Gyarados',131:'Lapras',132:'Ditto',133:'Eevee',
  134:'Vaporeon',135:'Jolteon',136:'Flareon',137:'Porygon',138:'Omanyte',139:'Omastar',
  140:'Kabuto',141:'Kabutops',142:'Aerodactyl',143:'Snorlax',144:'Articuno',
  145:'Zapdos',146:'Moltres',147:'Dratini',148:'Dragonair',149:'Dragonite',150:'Mewtwo',
  151:'Mew',152:'Chikorita',153:'Bayleef',154:'Meganium',155:'Cyndaquil',156:'Quilava',
  157:'Typhlosion',158:'Totodile',159:'Croconaw',160:'Feraligatr',161:'Sentret',
  162:'Furret',163:'Hoothoot',164:'Noctowl',165:'Ledyba',166:'Ledian',167:'Spinarak',
  168:'Ariados',169:'Crobat',170:'Chinchou',171:'Lanturn',172:'Pichu',173:'Cleffa',
  174:'Igglybuff',175:'Togepi',176:'Togetic',177:'Natu',178:'Xatu',179:'Mareep',
  180:'Flaaffy',181:'Ampharos',182:'Bellossom',183:'Marill',184:'Azumarill',
  185:'Sudowoodo',186:'Politoed',187:'Hoppip',188:'Skiploom',189:'Jumpluff',
  190:'Aipom',191:'Sunkern',192:'Sunflora',193:'Yanma',194:'Wooper',195:'Quagsire',
  196:'Espeon',197:'Umbreon',198:'Murkrow',199:'Slowking',200:'Misdreavus',
  201:'Unown',202:'Wobbuffet',203:'Girafarig',204:'Pineco',205:'Forretress',
  206:'Dunsparce',207:'Gligar',208:'Steelix',209:'Snubbull',210:'Granbull',
  211:'Qwilfish',212:'Scizor',213:'Shuckle',214:'Heracross',215:'Sneasel',
  216:'Teddiursa',217:'Ursaring',218:'Slugma',219:'Magcargo',220:'Swinub',
  221:'Piloswine',222:'Corsola',223:'Remoraid',224:'Octillery',225:'Delibird',
  226:'Mantine',227:'Skarmory',228:'Houndour',229:'Houndoom',230:'Kingdra',
  231:'Phanpy',232:'Donphan',233:'Porygon2',234:'Stantler',235:'Smeargle',
  236:'Tyrogue',237:'Hitmontop',238:'Smoochum',239:'Elekid',240:'Magby',
  241:'Miltank',242:'Blissey',243:'Raikou',244:'Entei',245:'Suicune',246:'Larvitar',
  247:'Pupitar',248:'Tyranitar',249:'Lugia',250:"Ho-oh",251:'Celebi',
}

function getPokeName(id: number, enName: string): string {
  return PT_NAMES[id] || enName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function getArtwork(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
}

function pad(n: number): string {
  return '#' + String(n).padStart(4, '0')
}

interface Pokemon { id: number; name: string }

export default function SeparadoresPage() {
  const [selectedGens, setSelectedGens] = useState<number[]>([0]) // índices
  const [pokeList, setPokeList] = useState<Pokemon[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Busca lista completa uma vez
  const loadPokemons = useCallback(async () => {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025')
      const data = await res.json()
      const list: Pokemon[] = data.results.map((p: any, i: number) => ({
        id: i + 1,
        name: getPokeName(i + 1, p.name),
      }))
      setPokeList(list)
      setLoaded(true)
    } catch {
      // fallback — gera lista apenas com IDs
      const list: Pokemon[] = Array.from({ length: 1025 }, (_, i) => ({
        id: i + 1,
        name: PT_NAMES[i + 1] || `Pokémon #${i + 1}`,
      }))
      setPokeList(list)
      setLoaded(true)
    }
    setLoading(false)
  }, [loaded])

  useEffect(() => { loadPokemons() }, [loadPokemons])

  function toggleGen(idx: number) {
    setSelectedGens(prev =>
      prev.includes(idx) ? prev.filter(g => g !== idx) : [...prev, idx].sort((a,b) => a - b)
    )
  }

  function selectAll() { setSelectedGens(GENERATIONS.map((_, i) => i)) }
  function clearAll() { setSelectedGens([]) }

  const filtered = pokeList.filter(p => {
    if (selectedGens.length === 0) return false
    return selectedGens.some(idx => {
      const g = GENERATIONS[idx]
      return p.id >= g.from && p.id <= g.to
    })
  })

  const totalPages = Math.ceil(filtered.length / 9)

  return (
    <AppLayout>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-grid { display: grid !important; }
          body { background: white !important; }
          .tcg-sidebar, .tcg-header, .tcg-bottom-nav, footer { display: none !important; }
          .tcg-content { padding: 0 !important; margin: 0 !important; }
          .print-page {
            width: 210mm;
            min-height: 297mm;
            page-break-after: always;
            padding: 10mm;
            box-sizing: border-box;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4mm;
            align-content: start;
          }
          .sep-card {
            border: 1px dashed #999 !important;
            background: white !important;
            color: #000 !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .sep-card img {
            filter: none !important;
          }
        }
        @page { size: A4; margin: 8mm; }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div className="no-print" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
                Separadores de Fichário
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                Imprima e recorte para organizar seu fichário por número da Pokédex.
                {filtered.length > 0 && <> · <strong style={{ color: '#f59e0b' }}>{filtered.length} Pokémons</strong> · {totalPages} página{totalPages !== 1 ? 's' : ''} A4</>}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              disabled={filtered.length === 0}
              style={{
                background: filtered.length === 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
                border: 'none', color: filtered.length === 0 ? 'rgba(255,255,255,0.3)' : '#000',
                padding: '12px 28px', borderRadius: 12, fontWeight: 800, fontSize: 15,
                cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M5 7V3h10v4M5 15H3a1 1 0 01-1-1V8a1 1 0 011-1h14a1 1 0 011 1v6a1 1 0 01-1 1h-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <rect x="5" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Imprimir / Gerar PDF
            </button>
          </div>

          {/* ── Seletor de Gerações ── */}
          <div style={{ marginTop: 24, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Selecionar gerações
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={selectAll} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', padding: '4px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Todas</button>
                <button onClick={clearAll} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)', padding: '4px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GENERATIONS.map((g, idx) => {
                const active = selectedGens.includes(idx)
                return (
                  <button
                    key={idx}
                    onClick={() => toggleGen(idx)}
                    style={{
                      background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      color: active ? '#f59e0b' : 'rgba(255,255,255,0.45)',
                      padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: active ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontWeight: 800 }}>{g.label.replace('Geração ', 'Gen ')}</span>
                    <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 10 }}>{g.region}</span>
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.5 }}>#{g.from}–{g.to}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Info ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
              Carregando Pokédex...
            </div>
          )}
        </div>

        {/* ── Preview + Print Grid ── */}
        {filtered.length > 0 && !loading && (() => {
          const pages: Pokemon[][] = []
          for (let i = 0; i < filtered.length; i += 9) {
            pages.push(filtered.slice(i, i + 9))
          }
          return pages.map((page, pi) => (
            <div
              key={pi}
              className="print-page"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 32,
                padding: '20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16,
              }}
            >
              {page.map(poke => (
                <SepCard key={poke.id} id={poke.id} name={poke.name} />
              ))}
            </div>
          ))
        })()}

        {filtered.length === 0 && !loading && loaded && (
          <div className="no-print" style={{ textAlign: 'center', padding: '60px 24px', color: 'rgba(255,255,255,0.3)' }}>
            <svg width="48" height="48" viewBox="0 0 20 20" fill="none" style={{ marginBottom: 12, opacity: 0.3 }}>
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M7 8.5c.5-1.2 1.7-2 3-2s2.5.8 3 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="10" cy="13" r="1" fill="currentColor"/>
            </svg>
            <p style={{ fontSize: 15 }}>Selecione pelo menos uma geração</p>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

// ── Card individual ──────────────────────────────────────────────────────────

function SepCard({ id, name }: { id: number; name: string }) {
  const [imgError, setImgError] = useState(false)
  const imgUrl = imgError
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
    : getArtwork(id)

  return (
    <div
      className="sep-card"
      style={{
        border: '1px dashed rgba(255,255,255,0.2)',
        borderRadius: 8,
        padding: '12px 8px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255,255,255,0.03)',
        minHeight: 130,
      }}
    >
      {/* Imagem */}
      <div style={{ width: 70, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img
          src={imgUrl}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'auto' }}
          loading="lazy"
        />
      </div>

      {/* Número */}
      <p style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(245,158,11,0.8)',
        letterSpacing: '0.05em', lineHeight: 1,
      }}>
        {pad(id)}
      </p>

      {/* Nome */}
      <p style={{
        fontSize: 12, fontWeight: 700, color: '#f0f0f0',
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: '100%', wordBreak: 'break-word',
      }}>
        {name}
      </p>
    </div>
  )
}