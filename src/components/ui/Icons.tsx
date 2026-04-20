// Bynx Icon System — Stroke icons, 1.4px line width, Pokémon-themed
// Usage: <Icon name="collection" size={20} color="currentColor" />

interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

const defaultColor = 'currentColor'
const defaultStroke = 1.4

// ── Navigation icons ──────────────────────────────────────────────────────────

export function IconCollection({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      {/* Two cards stacked — TCG */}
      <rect x="2" y="4" width="11" height="14" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <rect x="5" y="2" width="11" height="14" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M8 9l1.5 2L12 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconDashboard({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      {/* Lightning bolt — Pikachu energy */}
      <path d="M11.5 2L5 11h6l-2.5 7L17 9h-6l2.5-7z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  )
}

export function IconPokedex({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      {/* Pokéball */}
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M2.5 10h15" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  )
}

export function IconMarketplace({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      {/* Two cards swapping — P2P trade */}
      <path d="M3 7h8M3 7l2.5-2.5M3 7l2.5 2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 13H9M17 13l-2.5-2.5M17 13l-2.5 2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconAccount({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      {/* Trainer cap — treinador Pokémon */}
      <path d="M10 3C6.7 3 4 5.7 4 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M10 3C13.3 3 16 5.7 16 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M2 9h16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M6 9v5a4 4 0 008 0V9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 3V1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconLogout({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M8 3H4a1 1 0 00-1 1v12a1 1 0 001 1h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M13 14l4-4-4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 10H8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

// ── UI icons ───────────────────────────────────────────────────────────────────

export function IconBell({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2a6 6 0 016 6c0 3 1 4 1.5 5H2.5C3 12 4 11 4 8a6 6 0 016-6z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M8 17a2 2 0 004 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconBellDot({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2a6 6 0 016 6c0 3 1 4 1.5 5H2.5C3 12 4 11 4 8a6 6 0 016-6z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M8 17a2 2 0 004 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <circle cx="15" cy="4" r="2.5" fill="#ef4444"/>
    </svg>
  )
}

export function IconSearch({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M13 13l3.5 3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconCamera({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <rect x="2" y="5" width="16" height="12" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="11" r="3" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M7 5l1.5-2h3L13 5" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    </svg>
  )
}

export function IconLink({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M8 12.5l4-4a3.5 3.5 0 000-5l-.5-.5a3.5 3.5 0 00-5 5L8 9.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M12 7.5l-4 4a3.5 3.5 0 000 5l.5.5a3.5 3.5 0 005-5L12 10.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconTrash({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 6h12M8 6V4h4v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 6l1 10h8l1-10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconCheck({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 10l4.5 4.5L16 6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconClose({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M5 5l10 10M15 5L5 15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconPlus({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 4v12M4 10h12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconMinus({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M4 10h12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconChevronDown({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M5 8l5 5 5-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconArrowUp({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 16V4M5 9l5-5 5 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconArrowDown({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 4v12M5 11l5 5 5-5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconStar({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2l2.4 5h5.3l-4.3 3.1 1.7 5.2L10 12.3l-5.1 2.9 1.7-5.2L2.3 7h5.3L10 2z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    </svg>
  )
}

export function IconStarFilled({ size = 20, color = defaultColor, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2l2.4 5h5.3l-4.3 3.1 1.7 5.2L10 12.3l-5.1 2.9 1.7-5.2L2.3 7h5.3L10 2z" fill={color}/>
    </svg>
  )
}

export function IconShare({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="15" cy="5" r="2" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="5" cy="10" r="2" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="15" cy="15" r="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M7 9l6-3M7 11l6 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconDownload({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 3v10M6 9l4 4 4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 15h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconWhatsApp({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2a8 8 0 016.3 12.9L18 18l-3.1-1.7A8 8 0 1110 2z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M7 8.5c.5 1 1.3 2.2 2.5 3 1.2.7 2 .8 2.5.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconInstagram({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <rect x="2.5" y="2.5" width="15" height="15" rx="4" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="10" r="3.5" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="14.5" cy="5.5" r="0.8" fill={color}/>
    </svg>
  )
}

export function IconDiscord({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M6.5 5.5C5 6 3.5 7.5 3 10.5c0 0 1.5 2 4 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.5 5.5C15 6 16.5 7.5 17 10.5c0 0-1.5 2-4 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="10" r="1" fill={color}/>
      <circle cx="12" cy="10" r="1" fill={color}/>
    </svg>
  )
}

export function IconMenu({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 5h14M3 10h14M3 15h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconPokeball({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M2.5 10h15" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  )
}

export function IconScan({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 7V4a1 1 0 011-1h3M13 3h3a1 1 0 011 1v3M17 13v3a1 1 0 01-1 1h-3M7 17H4a1 1 0 01-1-1v-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <rect x="6" y="6" width="8" height="8" rx="1" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  )
}

export function IconChart({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 15l4-5 3.5 2.5L14 7l3 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 17h14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconShield({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2l6.5 2.5v5C16.5 13.5 13.5 17 10 18 6.5 17 3.5 13.5 3.5 9.5v-5L10 2z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M7 10l2 2 4-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconCard({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <rect x="3" y="4" width="14" height="12" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M3 8h14" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M6 12h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

// ── Generic icon by name ───────────────────────────────────────────────────────

const iconMap: Record<string, (props: IconProps) => JSX.Element> = {
  collection: IconCollection,
  dashboard: IconDashboard,
  pokedex: IconPokedex,
  marketplace: IconMarketplace,
  account: IconAccount,
  logout: IconLogout,
  bell: IconBell,
  bellDot: IconBellDot,
  search: IconSearch,
  camera: IconCamera,
  link: IconLink,
  trash: IconTrash,
  check: IconCheck,
  close: IconClose,
  plus: IconPlus,
  minus: IconMinus,
  chevronDown: IconChevronDown,
  arrowUp: IconArrowUp,
  arrowDown: IconArrowDown,
  star: IconStar,
  starFilled: IconStarFilled,
  share: IconShare,
  download: IconDownload,
  whatsapp: IconWhatsApp,
  instagram: IconInstagram,
  discord: IconDiscord,
  menu: IconMenu,
  pokeball: IconPokeball,
  scan: IconScan,
  chart: IconChart,
  shield: IconShield,
  card: IconCard,
}

export function Icon({ name, ...props }: IconProps & { name: string }) {
  const Component = iconMap[name]
  if (!Component) return null
  return <Component {...props} />
}

// ── Ícones adicionais ─────────────────────────────────────────────────────────

export function IconLocation({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2a5 5 0 015 5c0 3.5-5 11-5 11S5 10.5 5 7a5 5 0 015-5z" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="7" r="2" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  )
}

export function IconCalendar({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M3 8h14M7 2v4M13 2v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconWallet({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M13 10a1 1 0 100 2 1 1 0 000-2z" fill={color}/>
      <path d="M13 6V4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconTrendingUp({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 14l5-5 3 3 6-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 5h3v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconTrendingDown({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 6l5 5 3-3 6 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 15h3v-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconHistory({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 10a7 7 0 107-7 7 7 0 00-5 2H2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M2 4v5h5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 7v4l2.5 2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconFire({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2c0 4-4 5-4 9a4 4 0 008 0c0-2-1-3-1-3s-1 2-2 2c0-3 2-4 2-7a5 5 0 00-3-1z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    </svg>
  )
}

export function IconWarning({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 3L2 17h16L10 3z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M10 9v4M10 14.5v.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconPhone({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <rect x="5" y="2" width="10" height="16" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="15.5" r="0.8" fill={color}/>
      <path d="M8 4h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconEye({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  )
}

export function IconEyeOff({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 3l14 14M7.5 7.6A5 5 0 0014.4 12.5M5 5.5C3.3 7 2 9 2 10s3 6 8 6a8 8 0 003.5-.8M9.5 5.1c.2 0 .3 0 .5 0 5 0 8 6 8 6a13 13 0 01-2 2.9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconKey({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="7.5" cy="9.5" r="4" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M11 10l7 7M15 14l-2 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconTag({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 3h7l7 7-7 7-7-7V3z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <circle cx="7" cy="7" r="1" fill={color}/>
    </svg>
  )
}

export function IconBox({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 7l7-4 7 4v9l-7 4-7-4V7z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M10 3v13M3 7l7 4 7-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconChat({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M3 3h14a1 1 0 011 1v9a1 1 0 01-1 1H6l-4 3V4a1 1 0 011-1z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    </svg>
  )
}

export function IconRocket({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <path d="M10 2c3 0 6 3 6 8 0 2-1 4-2 5l-3 3c-1-1-2-1-3 0L5 15c-1-1-2-3-2-5 0-5 3-8 7-8z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <circle cx="10" cy="9" r="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M7 17l-2 1M13 17l2 1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  )
}

export function IconGlobe({ size = 20, color = defaultColor, strokeWidth = defaultStroke, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={style}>
      <circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M10 2.5C8 5 7 7.5 7 10s1 5 3 7.5M10 2.5c2 2.5 3 5 3 7.5s-1 5-3 7.5" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M2.5 10h15" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  )
}