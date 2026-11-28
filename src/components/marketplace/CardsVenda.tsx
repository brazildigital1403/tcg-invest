'use client'

// Cards de venda do Marketplace (28/11/2026): ProdutoCard e AnuncioCard sairam de
// src/app/marketplace/page.tsx sem mudar nada do visual nem da logica, para o Club
// (pokecreatorsclub) usar o MESMO card com o MESMO "Comprar". O Marketplace importa
// daqui. Props novas, opcionais, so para quem embute o card fora do Marketplace:
//   comprar44 - o "Comprar" com 44 px de altura (regra de toque do Club);
//   onComprar - aviso de clique no "Comprar" (medicao), sem mudar o destino.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { IconLocation, IconBox, IconTag, IconFire, IconClock, IconBolt, IconCard, IconCarrinho, IconLoja, IconAccount } from '@/components/ui/Icons'
import { ehColecionador, NATUREZA_LABEL } from '@/lib/naturezaLoja'
import BotaoCompartilhar from '@/components/ui/BotaoCompartilhar'
import { dispararMarco } from '@/lib/marketplaceMarco'
import { authFetch } from '@/lib/authFetch'
import { GRADUADORA_MAP, tierNome, notaCurta, isNotaTop } from '@/lib/graduadoras'
import { transferirCartaAoComprador } from '@/lib/concluirCompra'
import { useAppModal } from '@/components/ui/useAppModal'
import MarketplaceFotosGaleria from '@/components/marketplace/MarketplaceFotosGaleria'
import CronometroLiberacao from '@/components/marketplace/CronometroLiberacao'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { podeExpirar, liberaEm as calcLiberaEm } from '@/lib/marketplaceStatus'
import { mudarStatusAnuncio } from '@/lib/marketplaceAcao'

export const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

export const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  disponivel:     { label: 'Disponível',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)'   },
  reservado:      { label: 'Reservado',           color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  em_negociacao:  { label: 'Em negociação',       color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  enviado:        { label: 'Enviado',             color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  concluido:      { label: 'Concluído',           color: '#22c55e', bg: 'rgba(34,197,94,0.1)'  },
  cancelado:      { label: 'Cancelado',           color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
}

export const CONDICAO_DESC: Record<string, string> = {
  NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played',
  HP: 'Heavily Played', D: 'Damaged',
}

export const CONDICAO_COR: Record<string, string> = {
  NM: '#22c55e', LP: '#84cc16', MP: '#f59e0b', HP: '#f97316', D: '#ef4444',
}

export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return ''
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'há 1 dia'
  if (d < 7) return `há ${d} dias`
  const sem = Math.floor(d / 7)
  if (d < 30) return sem === 1 ? 'há 1 semana' : `há ${sem} semanas`
  const meses = Math.floor(d / 30)
  if (d < 365) return meses === 1 ? 'há 1 mês' : `há ${meses} meses`
  const anos = Math.floor(d / 365)
  return anos === 1 ? 'há 1 ano' : `há ${anos} anos`
}

export const AVATAR_CORES = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316']
export function corDoNome(s: string | null | undefined): string {
  const str = s || '?'
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}
export function iniciais(nome: string | null | undefined): string {
  const n = (nome || '').trim()
  if (!n) return '?'
  const p = n.split(/\s+/)
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}


/**
 * ★ FONTE UNICA dos cortes de desconto desta tela.
 *
 * A mesma nocao de "oferta" estava escrita em QUATRO lugares com QUATRO faixas
 * diferentes (selo 0.20/0.05, chip 0.10/0.02, trilho 0.10, heroi 0.05). O
 * resultado media: 5 anuncios apareciam dentro do trilho "Ofertas imperdiveis"
 * carregando o selo "Bom preco" na propria arte, e o chip "Ofertas" mostrava
 * contagem 8 quando so 3 batiam o corte.
 *
 * Regra: quem entra num lugar chamado "imperdivel" TEM que carregar o selo
 * "Imperdivel". Por isso os dois usam a mesma constante.
 *
 * Os valores foram calibrados na virada pro menor preco (25/08/2026): eram
 * 25%/10% contra a MEDIA, que e ~20% mais alta -- mantidos, esvaziariam a
 * vitrine. O que se preserva e o SIGNIFICADO: estar abaixo do MENOR preco
 * anunciado no mercado ja e barganha.
 */
export const CORTE_IMPERDIVEL = 0.20
export const CORTE_BOM_PRECO  = 0.05

export const VARIANTES = [
  { key: 'normal', label: 'Normal' },
  { key: 'foil',   label: 'Foil'   },
  { key: 'promo',  label: 'Promo'  },
  { key: 'reverse',label: 'Reverse Foil' },
]

export const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
export const SURFACE = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }

// ─── Componente de card de anúncio ────────────────────────────────────────────

// ─── Identidade da loja no marketplace (#9, 12/09/2026) ─────────────────────
//
// ★ POR QUE EXISTE. Quando uma LOJA anunciava, os tres lugares que mostram o
// vendedor (card do grid, "Em destaque hoje" e o banner do topo) exibiam o
// nome da PESSOA dona da loja, com iniciais num circulo e link pro perfil
// pessoal. Medido: 21 dos 74 anuncios no ar sao de loja, 20 de loja
// verificada, e nenhum mostrava loja nem selo -- a primeira linha inteira do
// grid era da GhosTCG e todos os cards diziam "LG - Luiz Gustavo Alve...".
//
// ★ UM COMPONENTE, TRES TAMANHOS. A linha do vendedor estava desenhada 3 vezes
// a mao; a da loja nasce uma vez so, pra nao divergir. A linha da PESSOA foi
// mantida exatamente como estava em cada lugar: pelo mockup aprovado,
// colecionador nao muda.

export type VarianteVendedor = 'card' | 'trio' | 'hero'
export const TAM_VENDEDOR: Record<VarianteVendedor, { logo: number; nome: number; meta: number; selo: number }> = {
  card: { logo: 30, nome: 12.5, meta: 10.5, selo: 14 },
  trio: { logo: 24, nome: 11.5, meta: 10,   selo: 12 },
  hero: { logo: 28, nome: 12.5, meta: 11,   selo: 14 },
}

export function LogoLoja({ card, tamanho }: { card: any; tamanho: number }) {
  if (card.seller_loja_logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={card.seller_loja_logo} alt="" width={tamanho} height={tamanho} loading="lazy" decoding="async"
        style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.27), objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.14)', display: 'block' }} />
    )
  }
  return (
    <span style={{ width: tamanho, height: tamanho, borderRadius: Math.round(tamanho * 0.27), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(tamanho * 0.4), fontWeight: 800, color: '#fff', background: corDoNome(card.seller_loja_nome || card.user_id) }}>
      {(card.seller_loja_nome || '?').trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function VendedorLoja({ card, variante }: { card: any; variante: VarianteVendedor }) {
  const t = TAM_VENDEDOR[variante]
  // Estilo do CONTAINER copiado de cada linha de pessoa que ele substitui, pra
  // loja e colecionador ocuparem o mesmo espaco no mesmo card.
  const box: React.CSSProperties =
    variante === 'card' ? { display: 'flex', alignItems: 'center', gap: 9, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none', minWidth: 0 }
    : variante === 'trio' ? { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, textDecoration: 'none', minWidth: 0 }
    : { display: 'inline-flex', alignItems: 'center', gap: 9, marginTop: 14, textDecoration: 'none', minWidth: 0, maxWidth: '100%' }
  return (
    <a href={`/lojas/${card.seller_loja_slug}`} target="_blank" rel="noopener noreferrer"
      className={variante === 'hero' ? 'mkt-hero-vendedor' : undefined} style={box}>
      <LogoLoja card={card} tamanho={t.logo} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: t.nome, fontWeight: 700, color: '#e8e8e8', minWidth: 0 }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.seller_loja_nome || 'Loja'}</span>
          {card.seller_loja_verificada && <SeloVerificado size={t.selo} />}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: t.meta, color: 'rgba(255,255,255,0.4)', marginTop: 1, minWidth: 0, whiteSpace: 'nowrap' }}>
          {/* ★ AQUI AS DUAS ETIQUETAS CONVIVEM, ao contrario do Guia. No
              Mercado ha TRES vendedores -- loja com pagina, colecionador com
              pagina e a maioria, que nao tem pagina nenhuma e aparece so com
              as iniciais. Ausencia de etiqueta aqui significa "sem pagina",
              nao "loja", entao tirar a de Loja apagaria uma distincao que ja
              existe. */}
          {ehColecionador(card.seller_loja_natureza) ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#d8b4fe', fontWeight: 700, flexShrink: 0 }}>
              <IconAccount size={t.meta + 0.5} color="#d8b4fe" />{NATUREZA_LABEL.colecionador}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#60a5fa', fontWeight: 700, flexShrink: 0 }}>
              <IconLoja size={t.meta + 0.5} color="#60a5fa" />{NATUREZA_LABEL.loja}
            </span>
          )}
          {card.seller_loja_cidade && (
            <>
              <span style={{ opacity: 0.5, flexShrink: 0 }}>·</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{card.seller_loja_cidade}</span>
            </>
          )}
        </span>
      </span>
    </a>
  )
}

/**
 * Logo da loja sobre a arte (Proposta B aprovada pelo Du). Canto inferior
 * direito, que era o unico livre: em cima ficam condicao e variante, embaixo a
 * esquerda os selos de Novo/desconto.
 *
 * ★ Duas colisoes tratadas: a galeria de fotos poe o contador "Foto real" no
 * mesmo canto (entao o logo sobe), e a faixa do cronometro ocupa a borda de
 * baixo INTEIRA (entao o logo some enquanto ela aparece).
 */
export function ChipLojaArte({ card }: { card: any }) {
  if (!card.seller_loja_slug) return null
  if (podeExpirar(card.status) && card.status_em) return null
  const sobe = !!(card.fotos && card.fotos.length)
  return (
    <a href={`/lojas/${card.seller_loja_slug}`} target="_blank" rel="noopener noreferrer"
      aria-label={`Loja ${card.seller_loja_nome || ''}`.trim()} title={card.seller_loja_nome || 'Loja'}
      style={{ position: 'absolute', right: 8, bottom: sobe ? 36 : 8, zIndex: 6, display: 'block', padding: 2, borderRadius: 9, background: 'rgba(0,0,0,0.72)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 2px 8px rgba(0,0,0,0.45)' }}>
      <LogoLoja card={card} tamanho={26} />
      {card.seller_loja_verificada && (
        <span style={{ position: 'absolute', right: -5, bottom: -5, borderRadius: '50%', boxShadow: '0 0 0 2px #0d0f14', display: 'flex' }}>
          <SeloVerificado size={13} />
        </span>
      )}
    </a>
  )
}

// ─── Produto de loja no grid (#9, 12/09/2026) ──────────────────────────────
//
// Selado, pelucia, funko e acessorio so apareciam na pagina da loja. Agora
// entram no grid do marketplace, com o mesmo esqueleto do card de carta: arte,
// nome, preco, loja e acao. O que muda e o que nao se aplica -- produto nao tem
// condicao, variante nem preco de mercado.
//
// ★ O botao leva sempre pra pagina do PRODUTO, que e onde ficam quantidade,
//   frete e carrinho. "Comprar" quando a loja recebe pela Bynx; "Ver produto"
//   quando nao recebe -- a mesma regra da vitrine da loja (AnunciosLoja).

export const TIPO_PRODUTO: Record<string, string> = {
  selado: 'Selado', pelucia: 'Pelúcia', funko: 'Funko', fichario: 'Fichário', acessorio: 'Acessório',
}

export function ProdutoCard({ card, comprar44 = false, onComprar }: { card: any; comprar44?: boolean; onComprar?: () => void }) {
  const href = `/produto/${card.slug}`
  const novo = card.created_at && (Date.now() - new Date(card.created_at).getTime()) < 24 * 60 * 60 * 1000
  return (
    <div style={{ ...SURFACE, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ position: 'relative' }}>
        {card.fotos && card.fotos.length ? (
          <MarketplaceFotosGaleria fotos={card.fotos} cardName={card.card_name} aspecto="100%" sizes="(max-width: 880px) 45vw, 240px" />
        ) : (
          <Link href={href} aria-label={card.card_name} style={{ display: 'flex', width: '100%', aspectRatio: '1 / 1', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)' }}>
            <IconBox size={40} color="rgba(255,255,255,0.2)" />
          </Link>
        )}
        <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#f0f0f0' }}>
          {TIPO_PRODUTO[card.tipo] || 'Produto'}
        </span>
        {novo && (
          <span style={{ position: 'absolute', bottom: 8, left: 8, zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6, background: 'rgba(96,165,250,0.85)', color: '#0a0e16' }}>
            <IconBolt size={11} color="#0a0e16" />Novo
          </span>
        )}
        <ChipLojaArte card={card} />
      </div>

      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href={href} className="bx-card-nome" style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', display: 'block', textDecoration: 'none' }}>
          {card.card_name}
        </Link>
        <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#f59e0b', margin: 0 }}>{fmt(card.price)}</p>
        <VendedorLoja card={card} variante="card" />
        <div style={{ marginTop: 'auto' }}>
          {card.seller_vende ? (
            <Link href={href} className="bx-ctx-comprador" onClick={onComprar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '10px', minHeight: comprar44 ? 44 : undefined, borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
              <IconCarrinho size={15} /> Comprar
            </Link>
          ) : (
            <Link href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.14)', color: '#f0f0f0', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
              Ver produto
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export function AnuncioCard({ card, userId, userWhatsapp, onAction, railMode, comprar44 = false, onComprar }: {
  card: any; userId: string | null; userWhatsapp: string | null; onAction: () => void; railMode?: boolean
  comprar44?: boolean; onComprar?: () => void
}) {
  const { showAlert, showConfirm } = useAppModal()
  const router = useRouter()
  const isMeu    = card.user_id === userId
  // ★ `!!userId` NAO e redundante: sem ele, visitante DESLOGADO tinha
  // `userId === null` e os anuncios disponiveis tem `buyer_id === null` —
  // `null === null` e TRUE, entao todo anonimo era tratado como "o comprador
  // que ja reservou" e o CTA sumia. Medido em 03/09: 63 de 63 cards do grid
  // sem botao nenhum pra quem nao esta logado.
  const isBuyer  = !!userId && card.buyer_id === userId
  const st       = STATUS_CFG[card.status || 'disponivel'] || STATUS_CFG.disponivel
  const variante = VARIANTES.find(v => v.key === card.variante)?.label || 'Normal'
  const grad = card.graduada && card.graduadora ? GRADUADORA_MAP[card.graduadora] : null

  async function contatarVendedor(jaRegistrouInteresse: boolean) {
    try {
      const resp = await authFetch(`/api/marketplace/${card.id}/contato`)
      const dados = await resp.json().catch(() => ({}))
      if (resp.ok && dados.whatsapp) {
        const msg = encodeURIComponent(`Olá! Tenho interesse na carta *${card.card_name}* anunciada na Bynx por ${fmt(card.price)}. Podemos negociar?`)
        window.open(`https://wa.me/55${dados.whatsapp}?text=${msg}`, '_blank')
        return
      }
    } catch { /* cai no fallback abaixo */ }
    if (jaRegistrouInteresse) {
      showAlert('Interesse registrado! O vendedor será notificado.', 'success')
    } else {
      showAlert('Não foi possível abrir o contato agora. Tente novamente.', 'warning')
    }
  }

  async function handleInteresse() {
    if (!userId) { showAlert('Você precisa estar logado.', 'error'); return }
    if (isMeu)   { showAlert('Você não pode comprar sua própria carta.', 'warning'); return }

    // Verifica limite de negociações do comprador


    const ok = await showConfirm({
      message: `Deseja manifestar interesse em "${card.card_name}" por ${fmt(card.price)}?`,
      confirmLabel: 'Sim, tenho interesse',
      description: 'Você poderá conversar com o vendedor aqui pela plataforma.',
    })
    if (!ok) return

    const r = await mudarStatusAnuncio(card.id, 'reservar')
    if (!r.ok) { showAlert(r.erro || 'Nao foi possivel abrir a negociacao.', 'error'); return }

    await dispararMarco(card.id, 'interesse')

    router.push(`/marketplace?conversa=${card.id}`)
  }

  async function handleCancelar() {
    const ok = await showConfirm({ message: 'Cancelar este anúncio?', danger: true, confirmLabel: 'Cancelar anúncio' })
    if (!ok) return
    const r = await mudarStatusAnuncio(card.id, 'cancelar')
    if (!r.ok) { showAlert(r.erro || 'Nao foi possivel cancelar o anuncio.', 'error'); return }
    onAction()
  }

  async function handleConfirmarEnvio() {
    const ok = await showConfirm({ message: `Confirma que enviou a carta "${card.card_name}" para o comprador?`, confirmLabel: 'Sim, confirmei o envio' })
    if (!ok) return
    const r = await mudarStatusAnuncio(card.id, 'enviar')
    if (!r.ok) { showAlert(r.erro || 'Nao foi possivel confirmar o envio.', 'error'); return }
    showAlert('Envio confirmado! Aguardando o comprador confirmar o recebimento.', 'success')
    onAction()
  }

  async function handleConfirmarRecebimento() {
    if (!userId) return
    const ok = await showConfirm({ message: `Confirma que recebeu a carta "${card.card_name}"?`, confirmLabel: 'Sim, recebi a carta' })
    if (!ok) return

    const r = await transferirCartaAoComprador(card, userId)
    if (!r.ok) {
      showAlert('Nao foi possivel adicionar a carta a sua colecao. Nada foi concluido — tente de novo.', 'error')
      return
    }

    // Conclui anúncio. A transferencia acima continua ANTES disto de proposito:
    // a carta entra na colecao primeiro, e so entao a venda fecha.
    const rc = await mudarStatusAnuncio(card.id, 'concluir')
    if (!rc.ok) { showAlert(rc.erro || 'Nao foi possivel concluir a compra.', 'error'); return }

    showAlert('Compra concluída! A carta foi adicionada à sua coleção.', 'success')
    onAction()
  }

  return (
    <div style={{
      ...SURFACE,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: railMode ? '100%' : undefined,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      ...(grad ? { boxShadow: `inset 0 0 0 2px ${grad.cor}, inset 0 0 0 5px rgba(255,255,255,0.06)${isNotaTop(card.nota, card.black_label) ? `, 0 0 26px -3px ${grad.cor}` : ''}` } : {}),
      opacity: card.status === 'cancelado' || card.status === 'concluido' ? 0.5 : 1,
    }}>
      {/* Imagem */}
      <div style={{ position: 'relative' }}>
        {grad && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: card.black_label ? '#0a0a0a' : grad.cor }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff', letterSpacing: '0.03em' }}>{grad.curto}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: card.black_label ? '#e8c878' : '#fff' }}>{notaCurta(card.nota, card.black_label)}</span>
          </div>
        )}
        {/* ★ ALVO DE TOQUE. O nome sozinho da 21px de altura -- longe dos 44
            da regra. A ARTE e o alvo natural e grande, entao ela tambem leva
            ao detalhe. So que apenas quando NAO ha galeria: com fotos do
            vendedor a arte vira `MarketplaceFotosGaleria`, que tem setas
            proprias, e um <Link> por cima faria cada troca de foto navegar.
            Hoje sao 2 anuncios com galeria contra 55 sem -- a maioria ganha o
            alvo grande, e os 2 continuam com o nome como link. */}
        {card.fotos && card.fotos.length ? (
          <MarketplaceFotosGaleria fotos={card.fotos} cardName={card.card_name} />
        ) : card.card_image ? (
          railMode ? (
            <div style={{ position: 'relative', width: '100%', paddingBottom: '140%', overflow: 'hidden' }}>
              <img src={card.card_image} alt={card.card_name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                onError={e => { const img = e.target as HTMLImageElement; img.style.display = 'none'; img.parentElement?.nextElementSibling?.removeAttribute('hidden') }}
              />
            </div>
          ) : (
            <Link href={`/anuncio/${card.slug || card.id}`} aria-label={card.card_name} style={{ display: 'block' }}>
              <img src={card.card_image} alt={card.card_name} style={{ width: '100%', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute('hidden') }}
              />
            </Link>
          )
        ) : null}
        <div hidden={!!card.card_image} style={{ width: '100%', paddingBottom: '140%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: card.card_image ? 'absolute' : 'relative', inset: 0 }}>
          <IconCard size={40} color="rgba(255,255,255,0.2)" />
        </div>

        {/* Canto superior esquerdo — um so ocupante:
            - status, quando ele INFORMA algo (reservado, em negociacao, ...);
            - condicao da carta, quando o anuncio esta simplesmente disponivel.
            Antes o badge "Disponivel" aparecia em todo card; numa trilha feita
            so de disponiveis isso e ruido, e ocupava o canto que a condicao
            usa melhor. */}
        {(card.status || 'disponivel') !== 'disponivel' ? (
          <span style={{ position: 'absolute', top: grad ? 30 : 8, left: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: st.bg, color: st.color, backdropFilter: 'blur(4px)' }}>
            {st.label}
          </span>
        ) : !grad ? (() => {
          const cond = String(card.condicao || 'NM').toUpperCase()
          const cor = CONDICAO_COR[cond] || 'rgba(255,255,255,0.5)'
          return (
            <span
              title={CONDICAO_DESC[cond] || cond}
              style={{
                position: 'absolute', top: grad ? 30 : 8, left: 8, zIndex: 5,
                fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
                padding: '3px 8px', borderRadius: 6,
                color: cor, background: 'rgba(0,0,0,0.72)',
                border: '1px solid ' + cor + '66', backdropFilter: 'blur(4px)',
              }}
            >
              {cond}
            </span>
          )
        })() : null}

        {/* ★ Cronometro da liberacao: o card do marketplace ja MOSTRAVA o
            anuncio em negociacao (com o selo azul), mas nada dizia que ele
            volta sozinho. A faixa e o que da motivo pra pessoa voltar. */}
        {podeExpirar(card.status) && card.status_em && (() => {
          const alvo = calcLiberaEm(card.status, card.status_em)
          return alvo ? <CronometroLiberacao liberaEm={alvo} variante="faixa" /> : null
        })()}

        {/* Logo da loja sobre a arte -- ver ChipLojaArte */}
        <ChipLojaArte card={card} />

        {/* Variante badge */}
        <span style={{ position: 'absolute', top: grad ? 30 : 8, right: 8, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', color: '#f0f0f0' }}>
          {variante}
        </span>

        {/* Badges contextuais sobrepostos — só em anúncios disponíveis.
            Novo: criado nas ultimas 24h. Os cortes de desconto vem de
            CORTE_IMPERDIVEL / CORTE_BOM_PRECO (topo do arquivo) -- nunca cravar aqui.
            Todos com ícone outline (zero emoji). */}
        {(card.status || 'disponivel') === 'disponivel' && (() => {
          const badges: Array<{ Icon: any; label: string; bg: string; color: string }> = []
          const isNovo = card.created_at && (Date.now() - new Date(card.created_at).getTime()) < 24 * 60 * 60 * 1000
          if (isNovo) badges.push({ Icon: IconBolt, label: 'Novo', bg: 'rgba(96,165,250,0.85)', color: '#0a0e16' })

          if (card.preco_mercado > 0 && card.price > 0) {
            const desconto = (card.preco_mercado - card.price) / card.preco_mercado
            if (desconto >= CORTE_IMPERDIVEL) badges.push({ Icon: IconFire, label: 'Imperdível', bg: 'rgba(239,68,68,0.85)', color: '#fff' })
            else if (desconto >= CORTE_BOM_PRECO) badges.push({ Icon: IconTag, label: 'Bom preço', bg: 'rgba(34,197,94,0.85)', color: '#0a0e16' })
          }

          if (badges.length === 0) return null
          return (
            <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              {badges.map((b, i) => (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                  background: b.bg, color: b.color, backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                }}><b.Icon size={11} color={b.color} />{b.label}</span>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          {/* ★ O NOME LEVA AO DETALHE (07/09/2026). Ate agora o card do
              marketplace nao linkava pra lugar nenhum -- os `onClick` dele sao
              todos de ACAO (interesse, cancelar, confirmar), e a arte nao era
              clicavel. Quem navegava pelo marketplace nao tinha como abrir o
              anuncio nem como pegar a URL dele.
              O link fica no NOME, e nao na arte, porque quando ha fotos do
              vendedor a arte e a `MarketplaceFotosGaleria` -- com setas
              proprias. Envolver a galeria num <Link> faria cada clique de
              navegar entre fotos virar navegacao de pagina. */}
          <Link
            href={`/anuncio/${card.slug || card.id}`}
            className="bx-card-nome"
            style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 2, display: 'block', textDecoration: 'none' }}
          >
            {card.card_name}
          </Link>
          {/* Condicao simples ficou SO na arte (canto superior esquerdo).
              Aqui embaixo sobra a graduada, que carrega nota e tier e nao
              cabe num badge de canto. */}
          {grad && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.02em', color: card.black_label ? '#e8c878' : '#fff', background: card.black_label ? '#0a0a0a' : grad.cor, border: card.black_label ? '1px solid #c8a04b' : 'none', padding: '2px 8px', borderRadius: 6, display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                {grad.curto} {notaCurta(card.nota, card.black_label)}<span style={{ fontWeight: 700, opacity: 0.85, fontSize: 9, textTransform: 'uppercase' }}>{tierNome(card.graduadora, card.nota, card.black_label)}</span>
              </span>
            </div>
          )}
          {card.descricao && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, lineHeight: 1.4 }}>{card.descricao}</p>
          )}
        </div>

        {/* Preço */}
        <div>
          <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: '#f59e0b' }}>
            {fmt(card.price)}
          </p>
          {/* comparação vs mercado se preço canonical disponível */}
          {card.preco_mercado > 0 && card.price > 0 && (() => {
            const diff = ((card.price - card.preco_mercado) / card.preco_mercado) * 100
            const cor = diff <= -10 ? '#22c55e' : diff >= 10 ? '#ef4444' : 'rgba(255,255,255,0.4)'
            const label = Math.abs(diff) < 1
              ? `≈ no preço de mercado`
              : diff < 0
                ? `${Math.abs(diff).toFixed(0)}% abaixo do mercado`
                : `${diff.toFixed(0)}% acima do mercado`
            return (
              <p style={{ fontSize: 10, color: cor, marginTop: 2, fontWeight: 600 }}>
                {label}
              </p>
            )
          })()}
        </div>

        {/* Vendedor: a LOJA quando o anuncio e de loja ativa; a pessoa, senao. */}
        {card.seller_loja_slug ? <VendedorLoja card={card} variante="card" /> : (
        <a href={`/perfil/${card.user_id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 11, borderTop: '1px solid rgba(255,255,255,0.07)', textDecoration: 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', background: corDoNome(card.seller_name || card.user_id) }}>
            {iniciais(card.seller_name)}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {card.seller_name || 'Vendedor'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              {card.seller_city && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <IconLocation size={11} color="rgba(255,255,255,0.4)" />{card.seller_city}
                </span>
              )}
              {card.seller_city && card.created_at && <span style={{ opacity: 0.5 }}>·</span>}
              {card.created_at && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <IconClock size={11} color="rgba(255,255,255,0.4)" />{tempoRelativo(card.created_at)}
                </span>
              )}
            </span>
          </span>
        </a>
        )}

        {/* Ações por papel e status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>

          {/* ★ LOJA COMPRA, COLECIONADOR NEGOCIA (07/09/2026).
              Sao dois produtos no mesmo grid e ate agora mostravam o mesmo
              botao. Quem tem loja ativa COM Connect liberado consegue fechar
              a venda na hora -- pagamento, frete e rastreio pela Bynx --,
              entao o card leva direto ao checkout. Sem loja nao ha como
              cobrar, e o caminho honesto e "Tenho interesse" + conversa.
              `seller_vende` exige o Connect: vendedor sem recebimento ativo
              nao fecha venda, e oferecer "Comprar" ali seria prometer o que
              quebra no fim.

              ★ 02/10/2026: deixou de ser so a LOJA. Quem vende sem loja
              tambem fecha venda hoje -- a Barbara foi a primeira --, entao o
              campo le a conta da pessoa quando nao ha loja. */}
          {/* ★ O "Comprar" LEVA AO ANUNCIO, NAO AO CHECKOUT (02/10/2026).
              Ele pulava direto para o pagamento, e isso virou problema no dia
              em que o carrinho passou a aceitar vendedor sem loja: a pagina do
              anuncio e o unico lugar com "Adicionar ao carrinho", entao o
              caminho MAIS RAPIDO da vitrine era justamente o que escondia a
              saida do frete caro. Quem clicasse aqui na carta de R$ 0,90 caia
              num checkout de R$ 19,54 -- 95% de frete -- sem nunca saber que
              havia mais 12 cartas do mesmo vendedor para dividir o envio.
              De quebra, resolve uma divergencia que ja existia: o card de
              PRODUTO sempre levou a /produto/[slug] e o de carta ia ao
              checkout. Mesmo grid, mesmo rotulo, destinos diferentes. */}
          {!isMeu && !isBuyer && card.status === 'disponivel' && (
            card.seller_vende ? (
              <Link
                href={`/anuncio/${card.slug || card.id}`}
                className="bx-ctx-comprador"
                onClick={onComprar}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', padding: '10px', minHeight: comprar44 ? 44 : undefined, borderRadius: 10, fontWeight: 800, fontSize: 13, textDecoration: 'none' }}
              >
                <IconCarrinho size={15} /> Comprar
              </Link>
            ) : (
              <button onClick={handleInteresse} style={{ background: BRAND, border: 'none', color: '#000', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Tenho interesse
              </button>
            )
          )}

          {/* Abrir conversa (chat on-platform) — comprador ou vendedor */}
          {(isBuyer || isMeu) && ['reservado', 'em_negociacao', 'enviado'].includes(card.status) && (
            <button
              type="button"
              onClick={() => router.push(`/marketplace?conversa=${card.id}`)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#f59e0b', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none"><path d="M3 3h14v9H6l-4 3V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
              Abrir conversa
            </button>
          )}

          {/* Comprador: aguardando */}
          {isBuyer && card.status === 'reservado' && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                <IconClock size={13} color="#f59e0b" /> Aguardando vendedor
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Combine os detalhes na conversa</p>
            </div>
          )}

          {/* Comprador: confirmar recebimento */}
          {isBuyer && card.status === 'enviado' && (
            <button onClick={handleConfirmarRecebimento} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Confirmar recebimento
            </button>
          )}

          {/* Vendedor: confirmar envio */}
          {isMeu && (card.status === 'reservado' || card.status === 'em_negociacao') && (
            <button onClick={handleConfirmarEnvio} style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', padding: '10px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Confirmar envio
            </button>
          )}

          {/* Vendedor: cancelar */}
          {isMeu && !['concluido', 'cancelado', 'enviado'].includes(card.status) && (
            <button onClick={handleCancelar} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '8px', borderRadius: 10, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancelar anúncio
            </button>
          )}

          {/* Tag "Seu anúncio" */}
          {isMeu && card.status === 'disponivel' && (
            /* ★ E AQUI QUE O VENDEDOR PEGA O LINK (07/09/2026). A pagina
               /anuncio/[slug] nasceu justamente pra ele poder mandar "olha
               minha carta a venda" -- mas ate agora nao havia de onde copiar
               a URL: o card abre por onClick, nao por link. Sem este botao a
               pagina existiria e ninguem saberia o endereco dela. */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', margin: 0 }}>Seu anúncio</p>
              {/* `url` RELATIVA: o componente prefixa o origin sozinho. */}
              <BotaoCompartilhar
                compacto
                url={`/anuncio/${card.slug || card.id}`}
                titulo={`${card.card_name} — ${fmt(card.price)} na Bynx`}
                texto={`Estou vendendo ${card.card_name} por ${fmt(card.price)} na Bynx.`}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
