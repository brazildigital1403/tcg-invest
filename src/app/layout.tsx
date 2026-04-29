import type { Metadata, Viewport } from "next"
import { DM_Sans } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { ModalProvider } from "@/components/ui/useAppModal"

const dmSans = DM_Sans({ 
  variable: "--font-dm-sans", 
  subsets: ["latin"],
  display: 'swap',
})

// ─── Google Tag Manager ───────────────────────────────────────────────────────
// ID configurável via env. Fallback pra GTM-N94DLM4H (container Bynx em produção).
// Em previews/dev pode ser sobrescrito por NEXT_PUBLIC_GTM_ID.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-N94DLM4H"

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
    default: "Bynx — Quanto vale sua coleção Pokémon TCG hoje?",
    template: "%s | Bynx",
  },
  description:
    "A plataforma brasileira para colecionadores de Pokémon TCG. Adicione cartas em segundos, acompanhe preços por variante em reais, use o scan com IA e negocie no Marketplace. Pokédex com 22.000+ cartas em 240+ coleções.",

  keywords: [
    "Pokémon TCG", "cartas Pokémon", "coleção Pokémon", "preço carta Pokémon",
    "valor coleção Pokémon", "quanto vale carta Pokémon", "cotação Pokémon",
    "marketplace Pokémon TCG", "Pokémon TCG Brasil", "carta Pokémon em reais",
    "Pokédex Pokémon TCG", "scan carta Pokémon", "guia de lojas TCG",
    "Bynx", "organizar coleção Pokémon", "investir em cartas Pokémon",
    "vender carta Pokémon", "comprar carta Pokémon", "Pokémon card tracker BR",
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
    title: "Bynx — Quanto vale sua coleção Pokémon TCG hoje?",
    description:
      "Adicione suas cartas pela Pokédex ou pelo scan com IA. Acompanhe preços em reais por variante (Normal, Holo, Reverse, Foil, Promo) e negocie no Marketplace. 7 dias de Pro grátis.",
    images: [
      {
        url: "https://bynx.gg/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bynx — Plataforma brasileira para colecionadores de Pokémon TCG",
      },
    ],
  },

  // ── Twitter / X ────────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@bynxgg",
    creator: "@bynxgg",
    title: "Bynx — Quanto vale sua coleção Pokémon TCG hoje?",
    description:
      "A plataforma brasileira de coleções Pokémon TCG. Pokédex de 22 mil+ cartas, scan com IA, preços em reais e Marketplace. 7 dias Pro grátis.",
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
        {/* Google Tag Manager — carregado o mais cedo possível, sem bloquear render */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${GTM_ID}');
            `,
          }}
        />

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
              description: "Plataforma brasileira para colecionadores de Pokémon TCG organizarem suas coleções, acompanharem preços em reais e negociarem no Marketplace.",
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

        {/* Structured Data — WebSite com SearchAction (sitelinks search box no Google) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Bynx",
              url: "https://bynx.gg",
              inLanguage: "pt-BR",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://bynx.gg/pokedex?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />

        {/* Structured Data — WebApplication (catálogo + planos) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Bynx",
              url: "https://bynx.gg",
              applicationCategory: "LifestyleApplication",
              applicationSubCategory: "Trading Card Game Collection Management",
              operatingSystem: "Web, iOS, Android",
              inLanguage: "pt-BR",
              offers: [
                {
                  "@type": "Offer",
                  price: "0",
                  priceCurrency: "BRL",
                  name: "Plano Gratuito",
                  description: "Acesso à Pokédex e organização básica da coleção",
                },
                {
                  "@type": "Offer",
                  price: "29.90",
                  priceCurrency: "BRL",
                  name: "Plano Pro Mensal",
                  description: "Cartas ilimitadas, scan com IA, histórico de preços e marketplace",
                },
                {
                  "@type": "Offer",
                  price: "249.00",
                  priceCurrency: "BRL",
                  name: "Plano Pro Anual",
                  description: "Pro com desconto anual",
                },
              ],
              description: "Plataforma brasileira de coleções Pokémon TCG. Pokédex com 22 mil+ cartas, scan com IA, preços em reais por variante e marketplace.",
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Google Tag Manager (noscript) — fallback pra browsers sem JS */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        <ModalProvider>
          {children}
        </ModalProvider>
      </body>
    </html>
  )
}