import type { CSSProperties } from 'react'
import { IconCheck, IconClock, IconShield } from '@/components/ui/Icons'
import { formatarBRL, incrementoCents, type LotePublico } from '@/lib/leilao'
import { LEILAO_PROTECAO_MIN_CENTS, LEILAO_PROTECAO_PCT } from '@/lib/leilao-taxas'
import { PRAZO_PAGAMENTO_HORAS } from '@/lib/leilao-rodada'

/**
 * "Regras desta rodada". Tudo lido das libs: prazo de pagamento (espelho do
 * SQL), degrau atual (tabela de incrementos, a mesma do SQL), soft close do
 * lote no ar e a taxa de protecao (leilao-taxas.ts). Sem lote no ar, a linha
 * do degrau some.
 */
export default function RegrasRodada({ ativo }: { ativo: LotePublico | null }) {
  const pct = Math.round(LEILAO_PROTECAO_PCT * 1000) / 10
  const atual = ativo ? (ativo.nLances > 0 && ativo.precoAtualCents != null ? ativo.precoAtualCents : ativo.lanceInicialCents) : null
  return (
    <section aria-labelledby="rr-titulo" style={S.caixa}>
      <h2 id="rr-titulo" style={S.h2}>Regras desta rodada</h2>
      <p style={S.linha}>
        <IconShield size={16} style={S.ic} />
        <span>Pague pela Bynx em até {PRAZO_PAGAMENTO_HORAS} horas depois de arrematar.</span>
      </p>
      {ativo && atual != null && (
        <p style={S.linha}>
          <IconClock size={16} style={S.ic} />
          <span>
            Degrau atual: {formatarBRL(incrementoCents(atual))}.
            {ativo.softCloseSeg > 0 ? ` Lance nos últimos ${ativo.softCloseSeg}s volta o relógio para ${ativo.softCloseSeg}s.` : ''}
          </span>
        </p>
      )}
      <p style={S.linha}>
        <IconCheck size={16} style={S.ic} />
        <span>
          Taxa de proteção de {pct.toLocaleString('pt-BR')}% (mínimo {formatarBRL(LEILAO_PROTECAO_MIN_CENTS)}) na hora de pagar.
        </span>
      </p>
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  caixa: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: 14, borderRadius: 16,
    background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', minWidth: 0,
  },
  h2: { margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--bx-text)' },
  linha: { display: 'flex', gap: 8, margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--bx-text-2)' },
  ic: { flex: '0 0 16px', color: 'var(--ac-1)', marginTop: 2 },
}
