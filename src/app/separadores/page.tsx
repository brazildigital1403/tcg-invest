'use client'

import { useState, useEffect, useCallback } from 'react'
import AppLayout from '@/components/ui/AppLayout'

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
  const [pokeList, setPokeList] = useState<Pokemon[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

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
          .no-print, .tcg-sidebar, .tcg-header, .tcg-bottom-nav, footer, header, nav, aside { display: none !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .tcg-content { padding: 0 !important; margin: 0 !important; }
          /* Cada bloco de 9 = uma página A4 */
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
          }
          .print-page:last-child { page-break-after: auto !important; break-after: auto !important; }
          /* Card — exatamente 63mm x 88mm */
          /* Corner tip na impressão */
          .bynx-tip-triangle {
            border-width: 0 5mm 5mm 0 !important;
          }
          .bynx-tip-logo {
            width: 3.5mm !important;
            height: 3.5mm !important;
          }
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
            <button
              onClick={() => window.print()}
              disabled={filtered.length === 0}
              style={{
                background: filtered.length === 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#f59e0b,#ef4444)',
                border: 'none', borderRadius: 12, padding: '12px 24px',
                color: filtered.length === 0 ? 'rgba(255,255,255,0.3)' : '#000',
                fontWeight: 800, fontSize: 14, cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                <path d="M5 7V3h10v4M5 15H3a1 1 0 01-1-1V8a1 1 0 011-1h14a1 1 0 011 1v6a1 1 0 01-1 1h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="5" y="11" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Imprimir / PDF
            </button>
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

        {/* Grid de preview + impressão */}
        {pages.map((page, pi) => (
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

      {/* Bynx tip — canto superior direito */}
      <div className="bynx-tip-triangle" style={{
        position: 'absolute', top: 0, right: 0,
        width: 0, height: 0,
        borderStyle: 'solid',
        /* Triângulo no canto — preenchido de preto */
        borderWidth: '0 20px 20px 0',
        borderColor: 'transparent #000 transparent transparent',
        zIndex: 3,
      }} />
      <div className="bynx-tip-logo" style={{
        position: 'absolute',
        top: '1%',
        right: '2%',
        width: 'min(3.5vw, 14px)',
        height: 'min(3.5vw, 14px)',
        zIndex: 4,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}>
        <img
          src="https://www.bynx.gg/favicon.png"
          alt="Bynx"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
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
          loading="lazy"
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