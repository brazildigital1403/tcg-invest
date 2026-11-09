'use client'

/**
 * Padrao do lote (quadro 06): variante e idioma que valem para toda carta
 * marcada sem ajuste proprio. Mudar o padrao reaplica nas marcadas que nao
 * foram ajustadas a mao (elas guardam objeto vazio) e preserva as ajustadas.
 * Condicao fica fora do lote de proposito.
 */

import { useState } from 'react'
import { Folha, Segmentos, ChipsIdioma, btnPrim, rotulo, dica, IconAjuste } from './TiqueBase'
import { AjusteCarta, PadraoLote, VARIANTES, IDIOMAS_PRINCIPAIS, IDIOMAS_OUTROS, ajustadaAMao, rotuloVariante } from './tiqueComum'

export default function FolhaPadraoLote({ padrao, selecao, onSalvar, onFechar }: {
  padrao: PadraoLote
  /** Para o aviso "as N marcadas ficam com o padrao novo". Opcional. */
  selecao?: Map<string, AjusteCarta>
  onSalvar: (p: PadraoLote) => void
  onFechar: () => void
}) {
  const [variante, setVariante] = useState(padrao.variante)
  const [idioma, setIdioma] = useState(padrao.idioma)
  const marcadas = selecao?.size || 0
  let aMao = 0
  selecao?.forEach(a => { if (ajustadaAMao(a)) aMao++ })
  const seguem = marcadas - aMao

  const opcoes = VARIANTES.filter(v => ['normal', 'reverse', 'foil'].includes(v.key)).map(v => ({ key: v.key, label: v.label }))

  return (
    <Folha
      titulo="Padrão do lote"
      subtitulo="Vale para todas as cartas que você marcar. Para mudar uma carta só, use o ícone de ajuste nela."
      onFechar={onFechar}
      rodape={<button type="button" style={btnPrim} onClick={() => onSalvar({ variante, idioma })}>Usar este padrão</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>Variante</span>
        <Segmentos opcoes={opcoes} valor={variante} onChange={setVariante} rotuloGrupo="Variante" />
        <span style={dica}>Se a carta não existir na variante escolhida, ela entra como Normal e você vê a pílula na grade.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>Idioma</span>
        <ChipsIdioma valor={idioma} onChange={setIdioma} principais={IDIOMAS_PRINCIPAIS} outros={IDIOMAS_OUTROS} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={rotulo}>Condição</span>
        <span style={dica}>Condição é por carta. Em lote ela fica em branco e você ajusta na coleção quando quiser.</span>
      </div>
      {marcadas > 0 && (
        <div style={{ fontSize: 13, color: 'var(--bx-text-2)', lineHeight: 1.5, padding: '10px 12px', borderRadius: 12, border: '1px dashed rgba(var(--ac-1-rgb), 0.35)', background: 'rgba(var(--ac-1-rgb), 0.05)' }}>
          {aMao === 0
            ? `${seguem === 1 ? 'A carta já marcada passa' : `As ${seguem} cartas já marcadas passam`} para o padrão novo.`
            : seguem === 0
              ? `${aMao === 1 ? 'A carta já marcada foi ajustada à mão e fica' : `As ${aMao} cartas já marcadas foram ajustadas à mão e ficam`} como está.`
              : `${seguem === 1 ? 'Uma carta marcada passa' : `${seguem} cartas marcadas passam`} para o padrão novo; ${aMao === 1 ? 'a que você ajustou à mão fica' : `as ${aMao} que você ajustou à mão ficam`} como está.`}
        </div>
      )}
    </Folha>
  )
}

/** Chip "Normal · PT" que abre a folha. Quem monta a tela decide onde ele fica. */
export function ChipPadraoLote({ padrao, onPadraoChange, selecao, style }: {
  padrao: PadraoLote
  onPadraoChange: (p: PadraoLote) => void
  selecao?: Map<string, AjusteCarta>
  style?: React.CSSProperties
}) {
  const [aberta, setAberta] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label={`Padrão do lote: ${rotuloVariante(padrao.variante)}, ${padrao.idioma.toUpperCase()}. Toque para mudar.`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 12px', borderRadius: 999, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(var(--ac-1-rgb), 0.5)', background: 'rgba(var(--ac-1-rgb), 0.12)', color: 'var(--bx-text)', whiteSpace: 'nowrap', transition: 'background 0.15s ease', ...style }}
      >
        <IconAjuste size={14} color="var(--ac-1)" />
        {rotuloVariante(padrao.variante)} · {padrao.idioma.toUpperCase()}
      </button>
      {aberta && (
        <FolhaPadraoLote padrao={padrao} selecao={selecao} onFechar={() => setAberta(false)} onSalvar={p => { onPadraoChange(p); setAberta(false) }} />
      )}
    </>
  )
}
