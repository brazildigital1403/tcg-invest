'use client'

import { useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { IconArrowDown, IconArrowUp, IconTrash } from '@/components/ui/Icons'
import { MiniCarta, Resumo, Resumos, Rotulo, Selo } from '@/components/leilao/kit'
import { formatarBRL } from '@/lib/leilao'
import { FOTOS_OBRIGATORIAS } from '@/lib/leilao-painel'
import type { LotePainel } from '../_rodada'

/**
 * Studio da rodada em rascunho: contadores, fila na ordem da live e os detalhes
 * do lote escolhido (ao lado no desktop, dentro da linha no celular).
 * Pronto = as duas fotos, a mesma regra do agendar (pendenciasAgendar).
 * Reordenar por setas: arrastar nao funciona no toque.
 */

const pronto = (l: LotePainel) => Array.isArray(l.fotos) && l.fotos.length >= FOTOS_OBRIGATORIAS

function Detalhe({ lote }: { lote: LotePainel }) {
  const dados: Array<[string, string]> = [
    ['Lance inicial', formatarBRL(lote.lance_inicial_cents)],
    ['Duração', `${lote.duracao_seg}s`],
    ['Condição', lote.condicao || 'Não informada'],
    ['Idioma', (lote.idioma || 'pt').toUpperCase()],
  ]
  if (lote.graduadora) dados.push(['Graduação', `${lote.graduadora.toUpperCase()}${lote.nota ? ` ${lote.nota}` : ''}`])
  return (
    <div style={S.detalhe}>
      <div style={S.fotos}>
        {['Frente', 'Verso'].map((lado, i) => (
          <div key={lado} style={S.foto}>
            {lote.fotos?.[i]
              ? <Image src={lote.fotos[i]} alt={`${lado} de ${lote.card_name}`} fill sizes="140px" style={{ objectFit: 'cover' }} />
              : <span style={S.semFoto}>Sem {lado.toLowerCase()}</span>}
          </div>
        ))}
      </div>
      <dl style={S.dados}>
        {dados.map(([rotulo, valor]) => (
          <div key={rotulo} style={S.dado}><dt>{rotulo}</dt><dd>{valor}</dd></div>
        ))}
      </dl>
      {lote.descricao && <p style={S.descricao}>{lote.descricao}</p>}
    </div>
  )
}

export default function FilaLotes({
  lotes, ocupado, onMover, onRemover,
}: {
  lotes: LotePainel[]
  ocupado: boolean
  onMover: (indice: number, delta: -1 | 1) => void
  onRemover: (lote: LotePainel) => void
}) {
  const [aberto, setAberto] = useState<string | null>(null)
  const prontos = lotes.filter(pronto).length
  const pendentes = lotes.length - prontos
  const lateral = lotes.find(l => l.id === aberto) ?? lotes[0]

  return (
    <>
      <Resumos>
        <Resumo rotulo="Prontos" valor={String(prontos)} tom="frente" />
        <Resumo rotulo="Pendentes" valor={String(pendentes)} tom={pendentes > 0 ? 'atencao' : undefined} />
      </Resumos>

      <div className="lk-assist">
        <div className="lk-linhas">
          {lotes.map((l, i) => {
            const imagem = l.fotos?.[0] || l.card_image
            const expandido = aberto === l.id
            return (
              <div key={l.id} className="lk-item">
                <button
                  type="button"
                  className="lk-linha lk-linha-b"
                  aria-expanded={expandido}
                  aria-label={`Ver detalhes do lote ${i + 1}, ${l.card_name}`}
                  onClick={() => setAberto(expandido ? null : l.id)}
                >
                  <span style={S.numero}>{String(i + 1).padStart(2, '0')}</span>
                  {imagem ? <MiniCarta src={imagem} /> : <span className="lk-mini" style={S.semImagem} />}
                  <span className="lk-linha-c">
                    <b>{l.card_name}</b>
                    <small>{[l.card_numero, l.set_nome].filter(Boolean).join(' · ')}</small>
                  </span>
                  <span className="lk-linha-v">{formatarBRL(l.lance_inicial_cents)}</span>
                </button>
                {expandido && <div className="lk-so-celular"><Detalhe lote={l} /></div>}
                <div className="lk-item-acoes" style={S.acoes}>
                  {pronto(l) ? <Selo tom="frente">Pronto</Selo> : <Selo tom="atencao">Falta foto</Selo>}
                  <span style={S.botoes}>
                    <button type="button" onClick={() => onMover(i, -1)} disabled={ocupado || i === 0} style={S.icone} aria-label={`Subir ${l.card_name}`}>
                      <IconArrowUp size={16} />
                    </button>
                    <button type="button" onClick={() => onMover(i, 1)} disabled={ocupado || i === lotes.length - 1} style={S.icone} aria-label={`Descer ${l.card_name}`}>
                      <IconArrowDown size={16} />
                    </button>
                    <button type="button" onClick={() => onRemover(l)} disabled={ocupado} style={{ ...S.icone, ...S.perigo }} aria-label={`Remover ${l.card_name}`}>
                      <IconTrash size={16} />
                    </button>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        {lateral && (
          <aside className="lk-card lk-so-desktop" style={S.lateral}>
            <Rotulo fraco>Vista rápida</Rotulo>
            <b style={S.lateralNome}>{lateral.card_name}</b>
            <Detalhe lote={lateral} />
          </aside>
        )}
      </div>
    </>
  )
}

const S: Record<string, CSSProperties> = {
  numero: { width: 22, flexShrink: 0, fontSize: 12, fontWeight: 800, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' },
  semImagem: { display: 'block', height: 61, background: 'var(--bx-surface-3)' },
  acoes: { justifyContent: 'space-between', alignItems: 'center' },
  botoes: { display: 'inline-flex', gap: 6 },
  icone: {
    width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border-2)', borderRadius: 10, color: 'var(--bx-text)', cursor: 'pointer',
  },
  perigo: { color: 'var(--bx-red)', borderColor: 'color-mix(in srgb, var(--bx-red) 30%, transparent)' },
  lateral: { position: 'sticky', top: 16 },
  lateralNome: { fontSize: 18, fontWeight: 800, color: 'var(--bx-text)', overflowWrap: 'anywhere' },
  detalhe: { display: 'flex', flexDirection: 'column', gap: 12 },
  fotos: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, maxWidth: 280 },
  foto: { position: 'relative', aspectRatio: '63 / 88', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bx-border)', background: 'var(--bx-surface-2)', display: 'grid', placeItems: 'center' },
  semFoto: { fontSize: 12, fontWeight: 700, color: 'var(--bx-amber)', textAlign: 'center' },
  dados: { margin: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 },
  dado: { display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--bx-text-2)', fontVariantNumeric: 'tabular-nums' },
  descricao: { margin: 0, fontSize: 13, lineHeight: 1.45, color: 'var(--bx-text-2)', overflowWrap: 'anywhere' },
}
