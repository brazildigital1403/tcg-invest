'use client'

/**
 * src/components/ui/PageHeader.tsx
 *
 * Cabecalho padrao de TODA tela do app (dentro do AppLayout):
 *
 *   [ Inicio > Colecao > Pastas ]        <- trilha (Breadcrumb)
 *   Minha Colecao          [selo]  [acao]
 *   Tudo que voce tem, com valor de mercado.   <- descricao estatica
 *   119 cartas no total - 106 diferentes       <- linha dinamica
 *   [children: botoes secundarios]
 *
 * Regra da trilha (decisao do Du, 25/07/2026):
 *   - desktop: aparece em todas as telas;
 *   - mobile:  so nas telas ANINHADAS.
 * Numa tela de primeiro nivel a trilha teria um item so e repetiria o que a
 * bottom nav ja destaca, custando ~40px de altura em cada tela do celular.
 * "Primeiro nivel" = trilha com ate 2 itens (Inicio + a propria tela).
 *
 * Nao adiciona padding lateral: quem da a margem e o .tcg-content do AppLayout.
 */

import type { ReactNode } from 'react'
import Breadcrumb from '@/components/ui/Breadcrumb'

type Crumb = { name: string; href: string }

export const INICIO: Crumb = { name: 'Início', href: '/dashboard-financeiro' }

export default function PageHeader({
  trilha,
  titulo,
  selo,
  acao,
  descricao,
  stat,
  children,
}: {
  trilha: Crumb[]
  titulo: string
  /** Pilula ao lado do titulo (limite de plano, contagem, status). */
  selo?: ReactNode
  /** Botao principal, alinhado a direita do titulo. */
  acao?: ReactNode
  /** Frase fixa que explica a tela. Uma linha, sem ponto final duplo. */
  descricao: string
  /** Linha de numeros da tela. Omitir quando a tela nao tem o que contar. */
  stat?: ReactNode
  /** Botoes secundarios / filtros. */
  children?: ReactNode
}) {
  const primeiroNivel = trilha.length <= 2

  return (
    <div style={{ marginBottom: 24 }}>
      <style>{`
        .bx-pagehead-trilha { margin-bottom: 4px; }
        @media (max-width: 768px) {
          .bx-pagehead-trilha[data-toplevel="1"] { display: none; }
        }
      `}</style>

      <div className="bx-pagehead-trilha" data-toplevel={primeiroNivel ? '1' : '0'}>
        <Breadcrumb items={trilha} />
      </div>

      {/* Titulo + selo (esquerda) e acao principal (direita).
          flexWrap:'nowrap' + h1 com minWidth:0 evita que o selo "caia" pra
          uma linha propria quando o titulo e longo o bastante pra quebrar em
          2 linhas sozinho (ex: "Colecionadores em Destaque" no mobile) --
          alignItems:flex-start mantem o selo colado na primeira linha do
          titulo nesse caso, sem mudar o visual de titulo curto (selo e
          titulo tem alturas parecidas). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'nowrap', minWidth: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--bx-text)', margin: 0, minWidth: 0 }}>
            {titulo}
          </h1>
          {selo && <span style={{ flex: '0 0 auto' }}>{selo}</span>}
        </div>
        {acao}
      </div>

      <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.45 }}>
        {descricao}
      </p>

      {stat && (
        <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: '3px 0 0', lineHeight: 1.45 }}>
          {stat}
        </p>
      )}

      {children && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {children}
        </div>
      )}
    </div>
  )
}
