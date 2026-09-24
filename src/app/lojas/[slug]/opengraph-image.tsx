import { ImageResponse } from 'next/og'
import { fonteOg } from '@/lib/ogFontes'
import { notFound } from 'next/navigation'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getServiceSupabase } from '@/lib/supabaseServer'
import { ESPECIALIDADE_LABEL, ESPECIALIDADES_ORDEM } from '@/components/lojas/lojasFiltros'

/**
 * Imagem de compartilhamento de cada /lojas/[slug] (1200x630). Mesmo molde do
 * set/[id] e do pokemon/[name]: nome, cidade e especialidades a esquerda; a
 * direita as cartas mais caras que a loja tem a venda. Sem anuncio, entra a
 * inicial da loja no mesmo degrade que a page usa como fallback do logo.
 * Sem preco na imagem: ela fica dias em cache (aqui e no WhatsApp).
 *
 * ★ LOGO E CAPA NAO ENTRAM: em 14/09 todos os logos e capas das lojas eram
 * WebP, e o satori nao le WebP (derruba a imagem inteira). Por isso a inicial.
 *
 * ★ CACHE: rota dinamica SEM ISR + Cache-Control s-maxage de 7 dias, igual ao
 * set (95895b7). O ISR sozinho re-renderizava a cada request na Vercel.
 * NUNCA remover o header -- e ele que impede o render por request.
 *
 * ★ FALHA NUNCA VAI PARA O CACHE: erro de banco, fonte ou arte que existe mas
 * nao baixou lanca (500 nao vai para o CDN). Loja inativa ou oculta da 404,
 * mesmo filtro da page.
 *
 * ★ Service role ignora RLS: os filtros de loja ativa/nao oculta e de anuncio
 * disponivel/nao removido sao explicitos, como em lib/vitrineLoja.
 */

export const alt = 'Loja de TCG na Bynx'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

// 7 dias no CDN; depois disso serve a velha por mais 1 dia enquanto renova.
const CACHE_CONTROL_OG = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'

const AMBAR = '#f59e0b'
const DEGRADE_APP = 'linear-gradient(135deg, #f59e0b, #ef4444)'

async function baixar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`[og loja] ${r.status} ${url}`)
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
  if (nome.length <= 20) return 70
  return 56
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

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = getServiceSupabase()
  if (!sb) throw new Error('[og loja] sem cliente Supabase')

  const { data: loja, error: erroLoja } = await sb
    .from('lojas')
    .select('nome, cidade, estado, especialidades, verificada, owner_user_id')
    .eq('slug', slug)
    .eq('status', 'ativa')
    .neq('oculta', true)
    .maybeSingle()
  if (erroLoja) throw new Error(`[og loja] lojas: ${erroLoja.message}`)
  if (!loja) notFound()

  let artes: string[] = []
  if (loja.owner_user_id) {
    const { data: anuncios, error } = await sb
      .from('marketplace')
      .select('card_image')
      .eq('user_id', loja.owner_user_id)
      .eq('status', 'disponivel')
      .is('removido_em', null)
      .not('card_image', 'is', null)
      .order('price', { ascending: false })
      .limit(3)
    if (error) throw new Error(`[og loja] marketplace: ${error.message}`)
    artes = (anuncios || []).map(a => a.card_image as string)
  }

  const [f700, f900, logoBynx, ...baixadas] = await Promise.all([
    fonteOg(700),
    fonteOg(900),
    readFile(join(process.cwd(), 'public', 'logo_BYNX.png')),
    ...artes.map(u => baixar(u)),
  ])

  const logoBynxSrc = dataUriSeSuportado(logoBynx)
  const imgs = baixadas.map(b => dataUriSeSuportado(b)).filter((s): s is string => !!s)

  const nome = (loja.nome || 'Loja').trim()
  const inicial = nome.charAt(0).toUpperCase() || '?'
  // Ordem do Guia de Lojas, nao a do cadastro: com o corte em 3, a ordem do
  // banco deixava Magic de fora e mostrava "Outros" (Castle Games).
  const doCadastro: string[] = loja.especialidades || []
  const especialidades = ESPECIALIDADES_ORDEM
    .filter(e => doCadastro.includes(e))
    .map(e => ESPECIALIDADE_LABEL[e])
    .slice(0, 3)
  const detalhe = [[loja.cidade, loja.estado].filter(Boolean).join(', '), especialidades.join(' · ')]
    .filter(Boolean)
    .join(' · ')

  // Mesmo leque do set: a mais cara no centro e por ultimo no DOM.
  const cartasOg: CartaOg[] = []
  if (imgs.length >= 3) {
    cartasOg.push({ img: imgs[1], w: 196, rot: -12, left: 716, top: 190 })
    cartasOg.push({ img: imgs[2], w: 196, rot: 12, left: 968, top: 194 })
    cartasOg.push({ img: imgs[0], w: 236, rot: 0, left: 826, top: 140, brilho: true })
  } else if (imgs.length === 2) {
    cartasOg.push({ img: imgs[1], w: 220, rot: 8, left: 930, top: 170 })
    cartasOg.push({ img: imgs[0], w: 236, rot: -6, left: 752, top: 140, brilho: true })
  } else if (imgs.length === 1) {
    cartasOg.push({ img: imgs[0], w: 260, rot: 5, left: 814, top: 118, brilho: true })
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#080a0f', fontFamily: 'DM Sans', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 78% 50%, rgba(245,158,11,0.32), rgba(8,10,15,0) 55%)' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, display: 'flex', background: 'radial-gradient(circle at 98% 100%, rgba(239,68,68,0.28), rgba(8,10,15,0) 45%)' }} />

        {cartasOg.length === 0 && (
          <div
            style={{
              position: 'absolute', left: 810, top: 150, width: 300, height: 300, display: 'flex',
              alignItems: 'center', justifyContent: 'center', borderRadius: 48, background: DEGRADE_APP,
              transform: 'rotate(-5deg)', boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(245,158,11,0.45)',
              fontSize: 180, fontWeight: 900, color: '#0b0d12',
            }}
          >
            {inicial}
          </div>
        )}

        {cartasOg.map((c, i) => <Carta key={i} c={c} />)}

        <div style={{ position: 'absolute', left: 66, top: 0, height: 630, width: 640, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {logoBynxSrc && <img src={logoBynxSrc} width={170} height={64} style={{ marginBottom: 34 }} />}
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, letterSpacing: 3, color: AMBAR, marginBottom: 14 }}>
            {loja.verificada ? 'LOJA VERIFICADA NA BYNX' : 'LOJA NA BYNX'}
          </div>
          <div style={{ display: 'flex', fontSize: tamanhoTitulo(nome), fontWeight: 900, lineHeight: 1.02, letterSpacing: -2, color: '#fff' }}>
            {nome}
          </div>
          {detalhe && (
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.72)', marginTop: 22, lineHeight: 1.3 }}>
              {detalhe}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: AMBAR, marginTop: 10 }}>
            Cartas e produtos com preço em reais
          </div>
          <div style={{ display: 'flex', alignSelf: 'flex-start', marginTop: 30, fontSize: 22, fontWeight: 700, color: '#fff', padding: '9px 20px', borderRadius: 99, border: '2px solid rgba(255,255,255,0.22)' }}>
            {`bynx.gg/lojas/${slug}`}
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
