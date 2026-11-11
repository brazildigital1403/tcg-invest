'use client'

/**
 * Lista do "Historico de vendas" do detalhe da carta (Colecao e Pokedex).
 *
 * ★ 11/11/2026. As duas telas tinham a lista copiada e, com o periodo vazio,
 * diziam "Coletando desde hoje" -- falso: a coleta existe desde 31/07. A fonte
 * que cobria quase todo o catalogo parou em 06/09 e, passados 60 dias (o maior
 * filtro), o bloco ficou vazio em quase toda carta, com as vendas ainda no
 * banco. Agora, com o periodo vazio, mostra as ultimas vendas registradas.
 *
 * A data da venda e a real (`data_venda`, que a rota ja resolve como
 * vendido_em ?? capturado_em). A Pokedex contava os dias pela captura.
 */

export interface VendaRegistrada {
  valor_cents: number
  variante: string | null
  condicao: string | null
  idioma: string | null
  capturado_em: string
  vendido_em?: string | null
  data_venda?: string | null
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function quandoFoi(v: VendaRegistrada): string {
  const ref = v.data_venda || v.vendido_em || v.capturado_em
  const t = new Date(ref).getTime()
  if (!Number.isFinite(t)) return ''
  const dias = Math.floor((Date.now() - t) / 86400000)
  if (dias <= 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  if (dias < 60) return `${dias} dias atrás`
  // Venda antiga: a data diz mais do que "143 dias atrás".
  const d = new Date(t)
  const mesmoAno = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('pt-BR', mesmoAno ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function Linhas({ vendas }: { vendas: VendaRegistrada[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {vendas.map((h, i) => {
        const meta = [h.variante, h.condicao, h.idioma].filter(Boolean).join(' · ')
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--bx-surface-2)', fontSize: 12 }}>
            <span style={{ color: 'var(--bx-text-2)', flexShrink: 0 }}>{quandoFoi(h)}</span>
            {meta && <span style={{ color: 'var(--bx-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>}
            <b style={{ flexShrink: 0 }}>{brl(h.valor_cents)}</b>
          </div>
        )
      })}
    </div>
  )
}

export default function HistoricoVendasLista(props: {
  carregando: boolean
  /** Vendas dentro do periodo escolhido. */
  historico: VendaRegistrada[]
  /** As mais recentes de qualquer data, para quando o periodo vem vazio. */
  ultimas: VendaRegistrada[]
  dias: number
}) {
  const nota = { fontSize: 12, color: 'var(--bx-text-faint)', margin: 0 } as const
  if (props.carregando) return <p style={nota}>Carregando…</p>
  if (props.historico.length > 0) return <Linhas vendas={props.historico} />
  if (props.ultimas.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={nota}>Nenhuma venda registrada nos últimos {props.dias} dias. Estas são as últimas que temos:</p>
        <Linhas vendas={props.ultimas} />
      </div>
    )
  }
  return <p style={nota}>Ainda não temos vendas registradas desta carta.</p>
}
