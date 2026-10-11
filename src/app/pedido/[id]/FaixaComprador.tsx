'use client'

import {
  IconCheck, IconBox, IconClock, IconShield, IconTruck, IconLoja, IconWarning, IconArrowRight,
} from '@/components/ui/Icons'
import { fmtPrazo } from '@/lib/leilao-reclamacao'
import type { CasoComprador } from '@/lib/painelPedidos'

/**
 * Faixa do topo de /pedido/[id] (11/10, mockup aprovado): de quem e a vez,
 * o que falta e ate quando. Substitui o "hero" de status. Regra pura em
 * casoComprador (lib/painelPedidos, com autoteste).
 *
 *   SUA VEZ (acento do comprador, roxo -> rosa): confirmar recebimento,
 *     postar a devolucao, cancelar por atraso;
 *   AGUARDANDO A LOJA / OS CORREIOS / COM A BYNX (neutro): nada a fazer;
 *   concluido (verde) e cancelado (vermelho).
 * O botao principal so aparece na vez do comprador e so para confirmar o
 * recebimento; as outras acoes moram logo abaixo (Protecao Bynx).
 */

export interface FaixaProps {
  caso: CasoComprador
  processando: boolean
  entregueEm: string | null
  /** Ate quando ainda da para reclamar ou desistir (pedido de leilao entregue). */
  protecaoAte: Date | null
  /** Relogio da pagina (renderizacao pura: sem Date.now() aqui). */
  agora: number
  textoCancelado: string
  /** false = quem abriu o pedido foi o vendedor: a vez do comprador vira "aguardando o comprador", sem botao. */
  paraComprador: boolean
  confirmando: boolean
  onConfirmar: () => void
}

function dia(v: Date | string | null | undefined): string {
  return fmtPrazo(v ?? null).split(' ')[0] || ''
}

export default function FaixaComprador({ caso, processando, entregueEm, protecaoAte, textoCancelado, paraComprador, agora, confirmando, onConfirmar }: FaixaProps) {
  const { acao, prazo, fechaEm } = caso
  const vendedorVendo = !paraComprador && caso.quem === 'voce'
  const quem = vendedorVendo ? 'comprador' : caso.quem
  const ate = prazo ? fmtPrazo(prazo) : ''

  let selo = ''
  let titulo = ''
  let sub = ''
  let nota = ''
  let Ic = IconClock
  switch (acao) {
    case 'pagar':
      selo = processando ? 'CONFIRMANDO' : 'AGUARDANDO PAGAMENTO'
      titulo = processando ? 'Confirmando seu pagamento…' : 'Aguardando pagamento'
      sub = processando ? 'Isso leva alguns segundos. Pode deixar esta página aberta.' : 'Assim que o pagamento for confirmado, o pedido aparece aqui.'
      break
    case 'aguardar_envio':
      selo = 'AGUARDANDO A LOJA'; Ic = IconBox
      titulo = prazo ? `A loja envia até ${ate}` : 'A loja vai preparar o envio'
      sub = 'Pagamento aprovado. Você recebe o código de rastreio assim que ela despachar.'
      if (prazo) nota = 'Se não enviar no prazo, você pode cancelar com estorno integral.'
      break
    case 'cancelar_atraso':
      selo = 'SUA VEZ'; Ic = IconWarning
      titulo = 'A loja não enviou no prazo'
      sub = `O prazo terminou em ${ate}. Logo abaixo você pode cancelar e receber o valor integral de volta.`
      break
    case 'confirmar_recebimento':
      selo = 'SUA VEZ'; Ic = IconLoja
      titulo = 'A carta chegou? Confirme o recebimento'
      sub = fechaEm
        ? `Se não confirmar, o pedido fecha sozinho em ${dia(fechaEm)}. Depois da entrega você ainda tem 7 dias para reclamar ou desistir.`
        : 'Confirmar fecha a compra, avisa a loja e libera a sua avaliação.'
      break
    case 'estorno':
      selo = 'COM A BYNX'; Ic = IconShield
      titulo = 'Estorno em andamento'
      sub = 'Nada a fazer agora: o valor volta para o seu cartão no prazo do banco.'
      break
    case 'loja_responde':
      selo = 'AGUARDANDO A LOJA'; Ic = IconLoja
      titulo = `A loja responde até ${ate}`
      sub = 'Sem resposta no prazo, a decisão fica a seu favor.'
      break
    case 'bynx_decide':
      selo = 'COM A BYNX'; Ic = IconShield
      titulo = prazo ? `A Bynx decide até ${ate}` : 'A Bynx vai decidir'
      sub = 'Nada a fazer agora: você recebe um aviso com a decisão.'
      break
    case 'bynx_devolucao':
      selo = 'COM A BYNX'; Ic = IconShield
      titulo = 'A Bynx combina a devolução com você'
      sub = 'O estorno sai quando a carta chegar de volta à loja.'
      break
    case 'postar_devolucao':
      selo = 'SUA VEZ'; Ic = IconBox
      titulo = `Poste a carta até ${ate}`
      sub = 'O endereço da loja e o campo do rastreio estão logo abaixo.'
      break
    case 'devolucao_a_caminho':
      selo = 'AGUARDANDO OS CORREIOS'; Ic = IconTruck
      titulo = 'Devolução a caminho da loja'
      sub = 'Quando a loja receber e conferir, o estorno integral sai no seu cartão.'
      break
    case 'loja_confere':
      selo = 'AGUARDANDO A LOJA'; Ic = IconLoja
      titulo = `A loja confere até ${ate}`
      sub = 'Sem contestação até lá, o estorno integral sai sozinho.'
      break
    case 'entregue':
      Ic = IconCheck
      titulo = entregueEm ? `Pedido entregue em ${dia(entregueEm)}` : 'Pedido entregue'
      sub = protecaoAte && protecaoAte.getTime() > agora
        ? `Até ${fmtPrazo(protecaoAte)} você pode reclamar ou desistir em "Precisa de ajuda?".`
        : 'Que bom que chegou. Conte como foi a compra.'
      break
    case 'reembolsado':
    case 'cancelado':
      Ic = IconArrowRight
      titulo = acao === 'reembolsado' ? 'Pedido reembolsado' : 'Pedido cancelado'
      sub = textoCancelado
      break
  }

  if (vendedorVendo) selo = 'AGUARDANDO O COMPRADOR'

  const tom = quem === 'voce' ? 'fc-voce' : quem === 'concluido' ? 'fc-ok' : quem === 'cancelado' ? 'fc-off' : ''
  const icCor = quem === 'voce' ? 'var(--ac-1)' : quem === 'concluido' ? 'var(--bx-green)' : quem === 'cancelado' ? 'var(--bx-red)' : 'var(--bx-text-2)'

  return (
    <section className={`fc ${tom}`} aria-label="Situação do pedido">
      <style>{CSS}</style>
      {selo && <span className={`fc-selo${quem === 'voce' ? ' fc-selo-voce' : ''}`}>{selo}</span>}
      <div className="fc-linha">
        <span className="fc-ic"><Ic size={22} color={icCor} /></span>
        <div className="fc-txt">
          <h2 className="fc-tit">{titulo}</h2>
          {sub && <p className="fc-sub">{sub}</p>}
        </div>
      </div>
      {nota && <p className="fc-nota">{nota}</p>}
      {acao === 'confirmar_recebimento' && paraComprador && (
        <button type="button" className="fc-bt" disabled={confirmando} onClick={onConfirmar}>
          <IconCheck size={17} color="currentColor" />{confirmando ? 'Confirmando…' : 'Confirmar recebimento'}
        </button>
      )}
    </section>
  )
}

const CSS = `
.fc{margin:4px 0 16px;border-radius:14px;padding:16px;background:var(--bx-surface);border:1px solid var(--bx-border);display:flex;flex-direction:column;gap:12px;color:var(--bx-text)}
.fc-voce{background:rgba(var(--ac-1-rgb),.08);border-color:rgba(var(--ac-1-rgb),.40)}
.fc-ok{background:color-mix(in srgb,var(--bx-green) 6%,transparent);border-color:color-mix(in srgb,var(--bx-green) 30%,transparent)}
.fc-off{background:color-mix(in srgb,var(--bx-red) 6%,transparent);border-color:color-mix(in srgb,var(--bx-red) 28%,transparent)}
.fc-selo{align-self:flex-start;min-height:26px;padding:0 10px;border-radius:999px;background:var(--bx-surface-2);font-size:11.5px;font-weight:800;letter-spacing:.04em;color:var(--bx-text-2);display:inline-flex;align-items:center}
.fc-selo-voce{background:var(--ac-grad);color:var(--bx-brand-ink)}
.fc-linha{display:flex;gap:12px;align-items:flex-start}
.fc-ic{width:44px;height:44px;border-radius:12px;background:var(--bx-surface-2);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.fc-voce .fc-ic{background:rgba(var(--ac-1-rgb),.14)}
.fc-txt{display:flex;flex-direction:column;gap:4px;min-width:0}
.fc-tit{margin:0;font-size:17px;font-weight:800;line-height:1.3}
.fc-sub{margin:0;font-size:13px;line-height:1.5;color:var(--bx-text-2)}
.fc-nota{margin:0;font-size:12px;line-height:1.5;color:var(--bx-text-3)}
.fc-bt{min-height:48px;border-radius:12px;border:none;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:opacity .15s ease}
.fc-bt:disabled{opacity:.6;cursor:default}
@media (prefers-reduced-motion:reduce){.fc-bt{transition:none}}
`
