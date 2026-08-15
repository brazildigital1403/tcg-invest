'use client'

/**
 * FicharioVirtual — a experiencia de folhear um fichario de verdade.
 *
 * Complementa (nao substitui) a folha de impressao que ja existia: a folha
 * imprime separadores 63x88mm pro fichario FISICO; isto aqui e o fichario na
 * tela, pra quem quer navegar e ver o que falta sem imprimir nada.
 *
 * Duas decisoes que separam isto do concorrente:
 * 1. Preco em REAIS dentro do bolso (o binder do Pallet mostra em dolar).
 * 2. O selo diz "FALTA", nao "nao tenho" -- e a lacuna que interessa, e no
 *    rodape a gente soma quanto custa fechar o que falta. Isso so e possivel
 *    porque a Bynx precifica 69k cartas em BRL.
 *
 * Amostra: sem login/sem compra a API devolve so as 2 primeiras paginas. O
 * componente recebe `totalCartas` (o tamanho REAL do set) e monta os bolsos
 * bloqueados a partir da diferenca -- assim a pessoa ve o tamanho do que esta
 * perdendo em vez de achar que o set acabou na pagina 2.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { heroiEntre } from '@/lib/paginas-lendarias'

export interface FicharioCard {
  card_id: string
  numero: string
  nome: string
  image_small: string | null
  owned: boolean
  preco: number | null
}

const POR_PAGINA = 9

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// ─── Bolso ────────────────────────────────────────────────────────────────

function Bolso({ card }: { card: FicharioCard }) {
  const [erro, setErro] = useState(false)
  const mostra = !!card.image_small && !erro

  return (
    <div className="fv-bolso" data-tem={card.owned ? '1' : '0'} title={`${card.nome} · ${card.numero}`}>
      {mostra ? (
        <img src={card.image_small as string} alt={card.nome} loading="lazy" onError={() => setErro(true)} />
      ) : (
        <span className="fv-semimg">{card.numero}</span>
      )}

      {card.owned && (
        <span className="fv-check" aria-label="Você tem">
          <svg viewBox="0 0 20 20" fill="none" width="9" height="9"><path d="M4 10l4.5 4.5L16 6" stroke="#052e16" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}

      {!card.owned && <span className="fv-falta">falta</span>}

      {card.preco != null && card.preco > 0 && (
        <span className="fv-preco">{fmtBRL(card.preco)}</span>
      )}
    </div>
  )
}

function BolsoBloqueado() {
  return (
    <div className="fv-bolso fv-bloqueado" aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" width="15" height="15">
        <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 9V6.5a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// ─── Componente ───────────────────────────────────────────────────────────

export default function FicharioVirtual({
  cards,
  totalCartas,
  nomeSet,
  serie,
  bloqueado,
  onDesbloquear,
}: {
  cards: FicharioCard[]
  totalCartas: number
  nomeSet: string
  serie?: string | null
  bloqueado: boolean
  onDesbloquear?: () => void
}) {
  // Folha 0 = capa sozinha. Folha N>=1 = paginas (2N-1) e 2N.
  const [folha, setFolha] = useState(0)
  const [verTudo, setVerTudo] = useState(false)
  const toqueX = useRef<number | null>(null)

  const paginasReais = useMemo(() => chunk(cards, POR_PAGINA), [cards])
  const totalPaginas = Math.max(1, Math.ceil(totalCartas / POR_PAGINA))
  const paginasBloqueadas = Math.max(0, totalPaginas - paginasReais.length)
  const totalFolhas = 1 + Math.ceil(totalPaginas / 2)

  const faltando = useMemo(() => cards.filter(c => !c.owned), [cards])
  const custoFechar = useMemo(
    () => faltando.reduce((s, c) => s + (c.preco || 0), 0),
    [faltando]
  )

  const irPara = useCallback((n: number) => {
    setFolha(f => Math.max(0, Math.min(totalFolhas - 1, typeof n === 'number' ? n : f)))
  }, [totalFolhas])

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (verTudo) return
      if (e.key === 'ArrowRight') irPara(folha + 1)
      if (e.key === 'ArrowLeft') irPara(folha - 1)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [folha, irPara, verTudo])

  /** Indice de pagina (0-based) exibido em cada lado da folha aberta. */
  function paginaDoLado(lado: 'esq' | 'dir'): number | null {
    if (folha === 0) return lado === 'esq' ? null : 0
    const esq = folha * 2 - 1
    const idx = lado === 'esq' ? esq : esq + 1
    return idx < totalPaginas ? idx : null
  }

  function renderPagina(idx: number | null) {
    if (idx === null) return <div className="fv-vazia" aria-hidden="true" />
    const disponivel = idx < paginasReais.length
    const cartas = disponivel ? paginasReais[idx] : []

    // Teaser do fundo continuo: se a pagina contem a carta-heroi de uma
    // Pagina Lendaria, a arte dela vaza pro fundo da pagina (nivel 1 — eco
    // desfocado da propria imagem que os bolsos ja exibem). A experiencia
    // completa (arte nitida, compartilhar, imprimir) vive em /paginas-lendarias.
    const lend = disponivel ? heroiEntre(cartas.map(c => c.card_id)) : null
    const lendImg = lend ? (cartas.find(c => c.card_id === lend.cardId)?.image_small || null) : null

    return (
      <div className={`fv-pagina${lendImg ? ' fv-lend' : ''}`}>
        {lendImg && (
          <>
            <div className="fv-lend-cam1" style={{ backgroundImage: `url("${lendImg}")` }} aria-hidden="true" />
            <div className="fv-lend-cam2" style={{ backgroundImage: `url("${lendImg}")` }} aria-hidden="true" />
            <div className="fv-lend-vinheta" aria-hidden="true" />
            <a className="fv-lend-chip" href="/paginas-lendarias" title={`Pagina Lendaria: ${lend?.pagina.nome}`}>
              <svg width="9" height="9" viewBox="0 0 20 20" fill="none"><path d="M16.5 12.2A7 7 0 018.3 3.6a7 7 0 108.2 8.6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
              Página Lendária
            </a>
          </>
        )}
        <div className="fv-grade">
          {disponivel
            ? cartas.map(c => <Bolso key={c.card_id} card={c} />)
            : Array.from({ length: POR_PAGINA }).map((_, i) => <BolsoBloqueado key={i} />)}
          {disponivel && cartas.length < POR_PAGINA &&
            Array.from({ length: POR_PAGINA - cartas.length }).map((_, i) => (
              <div key={`v${i}`} className="fv-bolso fv-slot" aria-hidden="true" />
            ))}
        </div>
        <span className="fv-numpag">{idx + 1}</span>
      </div>
    )
  }

  const esq = paginaDoLado('esq')
  const dir = paginaDoLado('dir')

  return (
    <div className="fv-root no-print">
      <style>{`
        .fv-root { --fv-couro: #1c1a17; --fv-couro-2: #2a2621; }
        .fv-barra { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:12px; }
        .fv-acoes { display:flex; align-items:center; gap:8px; }
        .fv-btn { display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12.5px; font-weight:600;
          color:var(--bx-text-2); background:var(--bx-surface); border:1px solid var(--bx-border);
          border-radius:10px; padding:8px 13px; cursor:pointer; transition:background .15s ease, color .15s ease; }
        .fv-btn:hover { background:var(--bx-surface-2); color:var(--bx-text); }

        .fv-palco { position:relative; border-radius:16px; padding:22px 16px;
          background: radial-gradient(120% 90% at 50% 0%, rgba(245,158,11,0.05), transparent 60%),
                      linear-gradient(160deg, var(--fv-couro), var(--fv-couro-2));
          border:1px solid rgba(245,158,11,0.16);
          display:flex; align-items:center; justify-content:center; gap:12px; }
        .fv-folha { display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%; max-width:760px; }

        .fv-pagina { position:relative; background:rgba(0,0,0,0.26); border:1px solid rgba(245,158,11,0.14);
          border-radius:10px; padding:11px 11px 20px; }

        /* Fundo continuo (teaser das Paginas Lendarias) */
        .fv-lend { overflow:hidden; }
        .fv-lend-cam1 { position:absolute; inset:-14%; background-size:cover; background-position:center 18%;
          filter:blur(26px) saturate(1.4) brightness(0.72); transform:scale(1.3); pointer-events:none; }
        .fv-lend-cam2 { position:absolute; inset:-4%; background-size:cover; background-position:center 12%;
          filter:blur(8px) saturate(1.2) brightness(0.55); opacity:0.6; mix-blend-mode:screen; pointer-events:none; }
        .fv-lend-vinheta { position:absolute; inset:0; pointer-events:none; background:
          radial-gradient(120% 90% at 50% 42%, transparent 28%, rgba(8,6,4,0.72) 100%),
          linear-gradient(rgba(8,6,4,0.4), transparent 24% 68%, rgba(8,6,4,0.55)); }
        .fv-lend .fv-grade, .fv-lend .fv-numpag { position:relative; z-index:2; }
        .fv-lend .fv-bolso { background:rgba(10,8,6,0.32); border-color:rgba(255,255,255,0.2); }
        .fv-lend-chip { position:absolute; top:5px; left:50%; transform:translateX(-50%); z-index:3;
          display:inline-flex; align-items:center; gap:4px; font-size:8.5px; font-weight:800;
          letter-spacing:0.08em; text-transform:uppercase; text-decoration:none; white-space:nowrap;
          color:#fbbf24; background:rgba(0,0,0,0.55); border:1px solid rgba(245,158,11,0.4);
          border-radius:999px; padding:3px 8px; }
        .fv-lend-chip:hover { background:rgba(0,0,0,0.75); }
        .fv-vazia { border-radius:10px; border:1px dashed rgba(255,255,255,0.06); min-height:100%; }
        .fv-grade { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; }
        .fv-numpag { position:absolute; bottom:5px; left:0; right:0; text-align:center; font-size:9.5px;
          color:rgba(255,255,255,0.28); font-variant-numeric:tabular-nums; }

        .fv-capa { border-radius:10px; border:1px solid rgba(245,158,11,0.3);
          background: repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 6px, transparent 6px 12px),
                      linear-gradient(150deg,#241f19,#17140f);
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:9px; padding:20px 14px; }
        .fv-capa-logo { width:44px; height:44px; border-radius:11px; border:1.5px solid rgba(245,158,11,0.5);
          display:grid; grid-template-columns:repeat(3,1fr); gap:2.5px; padding:7px; }
        .fv-capa-logo i { background:rgba(245,158,11,0.5); border-radius:1.5px; }
        .fv-capa-nome { font-size:12.5px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:rgba(245,158,11,0.9); text-align:center; }
        .fv-capa-set { font-size:11px; color:rgba(255,255,255,0.35); text-align:center; }

        .fv-bolso { position:relative; aspect-ratio:63/88; border-radius:5px; overflow:hidden;
          background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); }
        .fv-bolso img { width:100%; height:100%; object-fit:cover; display:block; }
        .fv-bolso[data-tem="0"] img { filter:grayscale(1) brightness(0.44) contrast(0.92); }
        .fv-slot { background:rgba(255,255,255,0.015); border-style:dashed; }
        .fv-semimg { position:absolute; inset:0; display:grid; place-items:center; font-size:12px; font-weight:800; color:rgba(255,255,255,0.2); }

        .fv-check { position:absolute; top:3px; right:3px; z-index:3; width:13px; height:13px; border-radius:50%;
          background:#22c55e; display:grid; place-items:center; }
        .fv-falta { position:absolute; left:0; right:0; top:0; z-index:2; font-size:7px; font-weight:800;
          letter-spacing:0.1em; text-transform:uppercase; text-align:center; padding:2.5px 0;
          color:rgba(255,255,255,0.55); background:rgba(0,0,0,0.5); }
        .fv-preco { position:absolute; left:0; right:0; bottom:0; z-index:2; font-size:8px; font-weight:800;
          text-align:center; padding:3px 1px; color:#fbbf24; font-variant-numeric:tabular-nums;
          background:linear-gradient(transparent, rgba(0,0,0,0.85) 55%); }
        .fv-bloqueado { display:grid; place-items:center; color:rgba(245,158,11,0.35);
          background:rgba(245,158,11,0.04); border-style:dashed; border-color:rgba(245,158,11,0.18); }

        .fv-seta { width:34px; height:34px; border-radius:50%; flex:none; cursor:pointer;
          border:1px solid rgba(255,255,255,0.16); background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.6);
          display:grid; place-items:center; transition:background .15s ease, color .15s ease; }
        .fv-seta:hover:not(:disabled) { background:rgba(255,255,255,0.12); color:#fff; }
        .fv-seta:disabled { opacity:0.25; cursor:default; }

        .fv-rodape { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
          margin-top:10px; font-size:12px; color:var(--bx-text-3); }
        .fv-custo { color:var(--bx-text-2); }
        .fv-custo strong { color:var(--bx-amber); font-variant-numeric:tabular-nums; }

        .fv-aviso { margin-top:10px; display:flex; align-items:center; justify-content:space-between; gap:12px;
          flex-wrap:wrap; background:rgba(245,158,11,0.07); border:1px solid rgba(245,158,11,0.25);
          border-radius:12px; padding:12px 15px; font-size:12.5px; color:var(--bx-text-2); }
        .fv-aviso strong { color:var(--bx-text); }
        .fv-cta { font:inherit; font-size:12.5px; font-weight:700; border:none; border-radius:10px; padding:9px 16px;
          background:linear-gradient(135deg,#f59e0b,#ef4444); color:#1a0e00; cursor:pointer; white-space:nowrap; }

        .fv-modal { position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);
          display:flex; align-items:center; justify-content:center; padding:18px; }
        .fv-modal-cx { background:var(--bx-bg-elev); border:1px solid var(--bx-border-2); border-radius:18px;
          width:100%; max-width:760px; max-height:86vh; overflow-y:auto; padding:18px; }
        .fv-mini-grade { display:grid; grid-template-columns:repeat(auto-fill,minmax(112px,1fr)); gap:10px; margin-top:14px; }
        .fv-mini { background:rgba(0,0,0,0.25); border:1px solid var(--bx-border); border-radius:8px; padding:6px;
          cursor:pointer; transition:border-color .15s ease; }
        .fv-mini:hover { border-color:rgba(245,158,11,0.45); }
        .fv-mini-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px; }
        .fv-mini-cel { aspect-ratio:63/88; border-radius:1.5px; background:rgba(255,255,255,0.07); overflow:hidden; }
        .fv-mini-cel img { width:100%; height:100%; object-fit:cover; display:block; }
        .fv-mini-cel[data-tem="0"] img { filter:grayscale(1) brightness(0.45); }
        .fv-mini-lbl { font-size:10px; color:var(--bx-text-3); text-align:center; margin-top:5px; font-variant-numeric:tabular-nums; }

        @media (max-width: 640px) {
          .fv-palco { padding:14px 10px; gap:0; }
          .fv-folha { grid-template-columns:1fr; max-width:none; }
          .fv-seta { display:none; }
          .fv-vazia { display:none; }
          .fv-grade { gap:6px; }
        }
        @media (prefers-reduced-motion: reduce) { .fv-btn, .fv-seta, .fv-mini { transition:none; } }
      `}</style>

      <div className="fv-barra">
        <div className="fv-acoes">
          <button className="fv-btn" onClick={() => setVerTudo(true)}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /><rect x="11.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /><rect x="2.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /><rect x="11.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" strokeWidth="1.5" /></svg>
            Ver todas as páginas
          </button>
        </div>
        <span style={{ fontSize: 12, color: 'var(--bx-text-3)', fontVariantNumeric: 'tabular-nums' }}>
          {folha === 0
            ? `Capa · página 1 de ${totalPaginas}`
            : `Página ${(esq ?? 0) + 1}${dir !== null ? `–${dir + 1}` : ''} de ${totalPaginas}`}
        </span>
      </div>

      <div
        className="fv-palco"
        onTouchStart={e => { toqueX.current = e.touches[0]?.clientX ?? null }}
        onTouchEnd={e => {
          if (toqueX.current === null) return
          const dx = (e.changedTouches[0]?.clientX ?? 0) - toqueX.current
          if (Math.abs(dx) > 48) irPara(folha + (dx < 0 ? 1 : -1))
          toqueX.current = null
        }}
      >
        <button className="fv-seta" onClick={() => irPara(folha - 1)} disabled={folha === 0} aria-label="Página anterior">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <div className="fv-folha">
          {folha === 0 ? (
            <div className="fv-capa">
              <div className="fv-capa-logo"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
              <span className="fv-capa-nome">{nomeSet}</span>
              {serie && <span className="fv-capa-set">{serie}</span>}
            </div>
          ) : renderPagina(esq)}
          {renderPagina(dir)}
        </div>

        <button className="fv-seta" onClick={() => irPara(folha + 1)} disabled={folha >= totalFolhas - 1} aria-label="Próxima página">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>

      <div className="fv-rodape">
        <span>Toque numa carta pra ver o nome. No celular, deslize pra virar a página.</span>
        {custoFechar > 0 && (
          <span className="fv-custo">
            Falta{faltando.length === 1 ? '' : 'm'} {faltando.length} — <strong>{fmtBRL(custoFechar)}</strong> pra fechar
            {bloqueado ? ' (só desta amostra)' : ''}
          </span>
        )}
      </div>

      {bloqueado && paginasBloqueadas > 0 && (
        <div className="fv-aviso">
          <span>
            Você está vendo <strong>as {paginasReais.length} primeiras páginas</strong> de graça.
            Faltam {paginasBloqueadas} páginas e a impressão da folha completa.
          </span>
          {onDesbloquear && <button className="fv-cta" onClick={onDesbloquear}>Desbloquear set</button>}
        </div>
      )}

      {verTudo && (
        <div className="fv-modal" onClick={() => setVerTudo(false)} role="dialog" aria-label="Todas as páginas">
          <div className="fv-modal-cx" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Páginas do fichário</p>
                <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: '2px 0 0' }}>
                  {totalPaginas} páginas · {totalCartas} cartas
                </p>
              </div>
              <button className="fv-btn" onClick={() => setVerTudo(false)}>Fechar</button>
            </div>

            <div className="fv-mini-grade">
              {Array.from({ length: totalPaginas }).map((_, i) => {
                const disp = i < paginasReais.length
                return (
                  <div key={i} className="fv-mini" onClick={() => { irPara(Math.floor(i / 2) + 1); setVerTudo(false) }}>
                    <div className="fv-mini-grid">
                      {(disp ? paginasReais[i] : Array.from({ length: POR_PAGINA })).map((c: any, j: number) => (
                        <div key={j} className="fv-mini-cel" data-tem={c?.owned ? '1' : '0'}>
                          {c?.image_small && <img src={c.image_small} alt="" loading="lazy" />}
                        </div>
                      ))}
                    </div>
                    <p className="fv-mini-lbl">{disp ? `Pág. ${i + 1}` : 'Bloqueada'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
