import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { serieExibicao, nomeSetSemCadastro } from '@/lib/setExibicao'

/**
 * Imagem de compartilhamento de cada /set/[id] (1200x630). Mesma familia da
 * /cartas-graduadas: nome do set a esquerda, logo do set e as 3 cartas mais
 * valiosas dele a direita. Sem preco e sem contagem na imagem: a imagem fica
 * dias em cache (aqui e no WhatsApp), o og:title ja leva o numero atualizado.
 *
 * ★ CACHE: rota dinamica SEM ISR + Cache-Control s-maxage de 7 dias. Quem
 * guarda e o CDN da Vercel; nao grava ISR nenhum.
 * O ISR (revalidate 7d + generateStaticParams vazio) foi a primeira tentativa
 * e falhou em producao em 14/09: toda request voltava STALE e re-renderizava
 * a funcao (revert abfd3cb). Sem o header explicito a Vercel nao segura a
 * imagem. Provado no preview da branch teste/og-set-cache: 1 execucao (MISS)
 * e depois so HIT com a idade crescendo por 4 min, confirmado nos logs.
 * NUNCA remover o header -- e ele que impede o render por request.
 *
 * ★ FALHA NUNCA VAI PARA O CACHE: erro de banco, fonte ou arte que existe mas
 * nao baixou lanca -- a request da 500, nada e gravado e a proxima tenta de
 * novo. Imagem sem carta ficaria 7 dias servida.
 *
 * ★ Formato: o satori so le PNG e JPEG, e WebP derruba a imagem inteira. Arte
 * em outro formato e descartada (e permanente, nao adianta tentar de novo).
 *
 * Custo medido em 14/09: as 3 cartas saem pelo idx_pokemon_cards_set_id,
 * ~450 buffers no maior set (mc, 766 cartas) -- a mesma leitura que a page ja faz.
 */

export const alt = 'Coleção Pokémon TCG na Bynx'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// 7 dias no CDN; depois disso serve a velha por mais 1 dia enquanto renova.
const CACHE_CONTROL_OG = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'

const FONTE_700 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf'
const FONTE_900 = 'https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAC5thTg.ttf'
const AMBAR = '#f59e0b'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`[og set] ${r.status} ${url}`)
  return r.arrayBuffer()
}

/** data URI so para PNG/JPEG, pelos bytes (nao pela extensao nem pelo header). */
function dataUriSeSuportado(buf: ArrayBuffer | Buffer): string | null {
  const b = Buffer.from(buf as ArrayBuffer)
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  if (!png && !jpg) return null
  return `data:image/${png ? 'png' : 'jpeg'};base64,${b.toString('base64')}`
}

function tamanhoTitulo(nome: string): number {
  if (nome.length <= 12) return 84
  if (nome.length <= 20) return 72
  if (nome.length <= 30) return 60
  return 50
}

type CartaOg = { img: string; w: number; rot: number; left: number; top: number; brilho?: boolean }

function Carta({ c }: { c: CartaOg }) {
  const h = Math.round(c.w * 1.395)
  return (
    <div
      style={{
        position: 'absolute', left: c.left, top: c.top, width: c.w, height: h, display: 'flex',
        borderRadius: 12, overflow: 'hidden', transform: `rotate(${c.rot}deg)`,
        border: '1px solid rgba(255,255,255,0.22)', background: '#0b0d12',
        boxShadow: c.brilho ? '0 30px 60px rgba(0,0,0,0.7), 0 0 60px rgba(245,158,11,0.5)' : '0 30px 60px rgba(0,0,0,0.7)',
      }}
    >
      <img src={c.img} width={c.w} height={h} />
    </div>
  )
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = getServiceSupabase()
  if (!sb) throw new Error('[og set] sem cliente Supabase')

  const [setRes, cartasRes] = await Promise.all([
    sb.from('pokemon_sets').select('name, name_pt, series, release_date, logo_url').eq('id', id).maybeSingle(),
    sb
      .from('pokemon_cards')
      .select('image_small, set_name')
      .eq('set_id', id)
      .not('image_small', 'is', null)
      .not('preco_min', 'is', null)
      .order('preco_min', { ascending: false })
      .limit(3),
  ])
  if (setRes.error) throw new Error(`[og set] pokemon_sets: ${setRes.error.message}`)
  if (cartasRes.error) throw new Error(`[og set] pokemon_cards: ${cartasRes.error.message}`)

  const set = setRes.data
  const cartas = cartasRes.data || []
  if (!set && cartas.length === 0) notFound()

  const nome = set ? set.name_pt || set.name : nomeSetSemCadastro(cartas[0]?.set_name, id)
  const detalhe = [
    set?.name_pt && set.name !== set.name_pt ? set.name : null,
    serieExibicao(set?.series),
    set?.release_date ? set.release_date.slice(0, 4) : null,
  ].filter(Boolean).join(' · ')

  const [f700, f900, logoBynx, logoSet, ...artes] = await Promise.all([
    baixar(FONTE_700),
    baixar(FONTE_900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    set?.logo_url ? baixar(set.logo_url) : Promise.resolve(null),
    ...cartas.map(c => baixar(c.image_small as string)),
  ])

  const logoBynxSrc = dataUriSeSuportado(logoBynx)
  const logoSetSrc = logoSet ? dataUriSeSuportado(logoSet) : null
  const imgs = artes.map(a => dataUriSeSuportado(a)).filter((s): s is string => !!s)

  // Leque: a mais valiosa no centro e por ultimo no DOM (fica por cima). Set
  // pequeno ou com arte descartada pode ter 1 ou 2 cartas: o leque se ajusta
  // em vez de ficar torto.
  const topo = logoSetSrc ? 214 : 150
  const cartasOg: CartaOg[] = []
  if (imgs.length >= 3) {
    cartasOg.push({ img: imgs[1], w: 196, rot: -12, left: 716, top: topo + 40 })
    cartasOg.push({ img: imgs[2], w: 196, rot: 12, left: 968, top: topo + 44 })
    cartasOg.push({ img: imgs[0], w: 224, rot: 0, left: 832, top: topo, brilho: true })
  } else if (imgs.length === 2) {
    cartasOg.push({ img: imgs[1], w: 210, rot: 8, left: 930, top: topo + 30 })
    cartasOg.push({ img: imgs[0], w: 224, rot: -6, left: 760, top: topo, brilho: true })
  } else if (imgs.length === 1) {
    cartasOg.push({ img: imgs[0], w: 236, rot: 0, left: 822, top: topo - 6, brilho: true })
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: 'DM Sans', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 55%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {logoSetSrc && (
          <div
            style={{
              position: 'absolute', left: 740, top: 36, width: 400, height: 150, display: 'flex',
              alignItems: 'center', justifyContent: 'center', borderRadius: 18,
              background: 'linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
          >
            <img src={logoSetSrc} width={340} height={112} style={{ objectFit: 'contain' }} />
          </div>
        )}

        {cartasOg.map((c, i) => <Carta key={i} c={c} />)}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 620, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoBynxSrc && <img src={logoBynxSrc} width={170} height={64} style={{ marginBottom: 34 }} />}
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 3, color: AMBAR, marginBottom: 14 }}>
            COLEÇÃO POKÉMON TCG
          </div>
          <div style={{ display: 'flex', fontSize: tamanhoTitulo(nome), fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: '#fff' }}>
            {nome}
          </div>
          {detalhe && (
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 22, lineHeight: 1.3 }}>
              {detalhe}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: AMBAR, marginTop: 10 }}>
            Todas as cartas, com preço em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            {`bynx.gg/set/${id}`}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      headers: { 'Cache-Control': CACHE_CONTROL_OG },
      fonts: [
        { name: 'DM Sans', data: f700, weight: 700, style: 'normal' },
        { name: 'DM Sans', data: f900, weight: 900, style: 'normal' },
      ],
    },
  )
}
