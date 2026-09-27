import Link from 'next/link'
import type { CSSProperties } from 'react'
import SeloVerificado from '@/components/ui/SeloVerificado'
import LogoLoja from './LogoLoja'
import type { LojaDaRodada, ReputacaoDaRodada } from './tipos'

/**
 * Cartao da loja na coluna direita da rodada: logo, nome, selo, avaliacao
 * real (mesma RPC do ReputacaoCard) e rodadas que foram ao ar. Sem avaliacao:
 * "Loja nova na Bynx". Sem contagem de rodadas: a linha some.
 */
export default function CartaoLojaRodada({ loja, reputacao }: { loja: LojaDaRodada; reputacao: ReputacaoDaRodada | null }) {
  const nome = loja.nome ?? loja.slug
  const temAvaliacao = !!reputacao && reputacao.total > 0 && reputacao.media != null
  return (
    <section aria-label={`Loja ${nome}`} style={S.caixa}>
      <div style={S.topo}>
        <LogoLoja nome={nome} logoUrl={loja.logoUrl} tam={36} />
        <div style={{ minWidth: 0 }}>
          <b style={S.nome}>{nome}</b>
          {loja.verificada && (
            <span style={S.verif}>
              <SeloVerificado size={12} />
              Verificada
            </span>
          )}
        </div>
      </div>
      <div style={S.linha}>
        <span>Avaliação</span>
        <b style={S.valor}>
          {temAvaliacao
            ? `${(Math.round((reputacao!.media as number) * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} de 5 (${reputacao!.total})`
            : 'Loja nova na Bynx'}
        </b>
      </div>
      {reputacao?.rodadas != null && reputacao.rodadas > 0 && (
        <div style={S.linha}>
          <span>Rodadas na Bynx</span>
          <b style={S.valor}>{reputacao.rodadas}</b>
        </div>
      )}
      <Link href={`/lojas/${loja.slug}`} prefetch={false} className="rdc-btn" style={S.btn}>
        Ver loja
      </Link>
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  caixa: {
    display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 16,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', minWidth: 0,
  },
  topo: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  nome: { display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--bx-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  verif: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--bx-blue)' },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, color: 'var(--bx-text-2)' },
  valor: { color: 'var(--bx-text)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
  btn: {
    minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)', textDecoration: 'none', fontSize: 13.5, fontWeight: 700,
  },
}
