import type { Metadata, Viewport } from "next"
import { DM_Sans } from "next/font/google"
import "./globals.css"
import { ModalProvider } from "@/components/ui/useAppModal"

const dmSans = DM_Sans({ 
  variable: "--font-dm-sans", 
  subsets: ["latin"],
  display: 'swap',
})

// ─── Viewport ─────────────────────────────────────────────────────────────────

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f59e0b",
}

// ─── Metadata global ─────────────────────────────────────────────────────────

export const metadata: Metadata = {
  metadataBase: new URL("https://bynx.gg"),

  title: {
    default: "Bynx — Organize e valorize sua coleção Pokémon TCG",
    template: "%s | Bynx",
  },
  description:
    "O app brasileiro para colecionadores de Pokémon TCG. Importe cartas por link, acompanhe preços em tempo real, veja o valor do seu portfólio e negocie com segurança no Marketplace.",

  keywords: [
    "Pokémon TCG", "cartas Pokémon", "coleção Pokémon", "portfolio Pokémon",
    "preço carta Pokémon", "marketplace Pokémon TCG", "LigaPokemon",
    "Bynx", "gerenciar coleção Pokémon", "investimento Pokémon",
    "vender carta Pokémon", "comprar carta Pokémon", "Pokémon card tracker",
  ],

  authors: [{ name: "Bynx", url: "https://bynx.gg" }],
  creator: "Bynx",
  publisher: "Bynx",

  category: "games",

  // ── Open Graph ─────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://bynx.gg",
    siteName: "Bynx",
    title: "Bynx — Organize e valorize sua coleção Pokémon TCG",
    description:
      "Importe cartas por link da LigaPokemon, acompanhe preços Normal/Foil/Promo em tempo real e negocie com segurança. Gratuito para as primeiras 15 cartas.",
    images: [
      {
        url: "https://bynx.gg/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bynx — Portfólio financeiro para colecionadores de Pokémon TCG",
      },
    ],
  },

  // ── Twitter / X ────────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@bynxgg",
    creator: "@bynxgg",
    title: "Bynx — Organize e valorize sua coleção Pokémon TCG",
    description:
      "Importe cartas por link, acompanhe preços em tempo real e negocie com segurança no Marketplace. Grátis!",
    images: ["https://bynx.gg/og-image.jpg"],
  },

  // ── Canonical + Alternates ─────────────────────────────────────────────────
  alternates: {
    canonical: "https://bynx.gg",
    languages: {
      "pt-BR": "https://bynx.gg",
    },
  },

  // ── Robots ─────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Icons ──────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/favicon.png",
    shortcut: "/favicon.png",
  },

  // ── Manifest ───────────────────────────────────────────────────────────────
  manifest: "/manifest.json",

  // ── App ────────────────────────────────────────────────────────────────────
  applicationName: "Bynx",
  appleWebApp: {
    capable: true,
    title: "Bynx",
    statusBarStyle: "black-translucent",
  },
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} h-full antialiased`}>
      <head>
        {/* Structured Data — Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Bynx",
              url: "https://bynx.gg",
              logo: "https://bynx.gg/logo_BYNX.png",
              description: "Plataforma brasileira para colecionadores de Pokémon TCG organizarem e valorizarem suas coleções.",
              sameAs: [
                "https://instagram.com/bynxgg",
                "https://twitter.com/bynxgg",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                availableLanguage: "Portuguese",
              },
            }),
          }}
        />
        {/* Structured Data — WebApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Bynx",
              url: "https://bynx.gg",
              applicationCategory: "LifestyleApplication",
              operatingSystem: "Web, iOS, Android",
              offers: [
                {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "BRL",
                  name: "Plano Gratuito",
                  description: "Até 15 cartas gratuitamente",
                },
                {
                  "@type": "Offer",
                  price: "29.90",
                  priceCurrency: "BRL",
                  name: "Plano Pro",
                  description: "Cartas ilimitadas e todas as funcionalidades",
                },
              ],
              description: "O app brasileiro para colecionadores de Pokémon TCG. Importe cartas por link, acompanhe preços em tempo real e negocie com segurança.",
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ModalProvider>
          {children}
        </ModalProvider>
      </body>
    </html>
  )
}