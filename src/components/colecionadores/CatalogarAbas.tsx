'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { CartaVitrine } from '@/components/colecionadores/FaixaCartas'

/**
 * "Como catalogar suas cartas Pokemon" na /colecionadores: tres jeitos de
 * comecar (buscar, escanear, colar uma lista), cada um mostrado funcionando
 * com cartas reais. Mira a busca "aplicativo/site para catalogar cartas
 * pokemon" -- o texto de cada aba sai no HTML (so esconde por CSS), para o
 * crawler ler as tres.
 */
type Aba = 'busca' | 'scan' | 'lista'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 100 ? 0 : 2 })

const Check = () => (
  <span className="bx-col-cat-ok" aria-hidden="true">
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4.5 10.5l3.5 3.5L15.5 6" stroke="var(--bx-brand-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
)

export default function CatalogarAbas({ busca, scan, lista, totalCartas, nomeColecao }: {
  busca: CartaVitrine[]; scan: CartaVitrine | null; lista: CartaVitrine[]; totalCartas: string; nomeColecao: string
}) {
  const [aba, setAba] = useState<Aba>('busca')
  const botao = (a: Aba, rotulo: string, icone: React.ReactNode) => (
    <button type="button" onClick={() => setAba(a)} aria-pressed={aba === a} className={`bx-col-chip${aba === a ? ' bx-col-chip-on' : ''}`}>
      {icone}{rotulo}
    </button>
  )
  const total = (c: CartaVitrine) => `${c.numero}`
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }} role="group" aria-label="Jeitos de catalogar">
        {botao('busca', 'Buscar', <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" /><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>)}
        {botao('scan', 'Escanear', <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M3 7V4.5A1.5 1.5 0 014.5 3H7M13 3h2.5A1.5 1.5 0 0117 4.5V7M17 13v2.5a1.5 1.5 0 01-1.5 1.5H13M7 17H4.5A1.5 1.5 0 013 15.5V13M3 10h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>)}
        {botao('lista', 'Colar uma lista', <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M7 5h10M7 10h10M7 15h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><circle cx="3.5" cy="5" r="1" fill="currentColor" /><circle cx="3.5" cy="10" r="1" fill="currentColor" /><circle cx="3.5" cy="15" r="1" fill="currentColor" /></svg>)}
      </div>

      <div className="bx-col-cat-painel">
        {/* BUSCA */}
        <div className="bx-col-cat-aba" hidden={aba !== 'busca'}>
          <div>
            <h3 className="bx-col-cat-h3">Digite o nome ou o número impresso</h3>
            <p className="bx-col-cat-p">&ldquo;Pikachu&rdquo;, &ldquo;Charizard ex&rdquo; ou &ldquo;199/165&rdquo;: a Pokédex da Bynx tem {totalCartas} cartas, com coleções em português, inglês e japonês.</p>
            <div className="bx-col-cat-busca" aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="var(--ac-1)" strokeWidth="1.6" /><path d="M13 13l3.5 3.5" stroke="var(--ac-1)" strokeWidth="1.6" strokeLinecap="round" /></svg>
              <span>{busca[0]?.nome ?? 'Charizard ex'}</span><span className="bx-col-cat-cursor" />
            </div>
          </div>
          <div className="bx-col-cat-resultados">
            {busca.map(c => (
              <div key={c.id}>
                <div className="bx-col-cat-carta">
                  <Image src={c.image} alt={c.nome} width={140} height={195} sizes="(max-width: 768px) 28vw, 140px" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  <span className="bx-col-cat-preco">{brl(c.valor)}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{c.nome}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)' }}>{total(c)} · {nomeColecao}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SCAN */}
        <div className="bx-col-cat-aba" hidden={aba !== 'scan'}>
          <div>
            <h3 className="bx-col-cat-h3">Aponte a câmera e pronto</h3>
            <p className="bx-col-cat-p">A IA de ponta reconhece nome, coleção e número a partir de uma foto, e várias cartas na mesma foto também. Está no Plus, com 100 scans por mês, e sem limite no Pro.</p>
            {scan && (
              <div className="bx-col-cat-reconhecida"><Check /><span><b>{scan.nome}</b> · {scan.numero} · {nomeColecao}</span></div>
            )}
          </div>
          {scan && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="bx-col-cat-camera">
                <span className="bx-col-cat-cantos" aria-hidden="true" />
                <div className="bx-col-cat-carta">
                  <Image src={scan.image} alt={scan.nome} width={220} height={307} sizes="220px" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  <span className="bx-col-cat-linha" aria-hidden="true" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LISTA */}
        <div className="bx-col-cat-aba" hidden={aba !== 'lista'}>
          <div>
            <h3 className="bx-col-cat-h3">Tem uma planilha? Cole a lista</h3>
            <p className="bx-col-cat-p">A importação em lote entende quantidade, nome e número, e adiciona tudo de uma vez, sem digitar carta por carta.</p>
            <pre className="bx-col-cat-pre">{lista.map((c, i) => `${i === 0 ? '2x ' : ''}${c.nome} ${c.numero}`).join('\n')}</pre>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map((c, i) => (
              <div key={c.id} className="bx-col-cat-linha-lista">
                <Image src={c.image} alt="" width={40} height={56} sizes="40px" style={{ width: 40, height: 'auto', borderRadius: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.nome}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--bx-text-3)' }}>{i === 0 ? '2 cópias · ' : ''}{c.numero}</div>
                </div>
                <Check />
              </div>
            ))}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--bx-green)' }}>{lista.length} cartas reconhecidas e adicionadas</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--bx-text-3)', marginRight: 4 }}>DEPOIS, MARQUE:</span>
        {['Variante', 'Idioma', 'Condição', 'Graduação'].map(t => (
          <span key={t} style={{ fontSize: 12.5, fontWeight: 700, padding: '7px 12px', borderRadius: 999, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)', color: 'var(--bx-text-2)' }}>{t}</span>
        ))}
      </div>

      <style>{`
        .bx-col-chip { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 14px; font-weight: 700; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--bx-border); background: var(--bx-surface); color: var(--bx-text-2); cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .bx-col-chip-on { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.12); color: var(--ac-1); }
        .bx-col-cat-painel { background: var(--bx-surface); border: 1px solid var(--bx-border); border-radius: 18px; padding: 18px 14px; }
        @media (min-width: 768px) { .bx-col-cat-painel { padding: 28px; min-height: 340px; } }
        .bx-col-cat-aba { display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; align-items: center; animation: bxColSobe 0.35s cubic-bezier(.22,.61,.36,1) both; }
        .bx-col-cat-aba[hidden] { display: none; }
        @media (min-width: 900px) { .bx-col-cat-aba { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 40px; } }
        .bx-col-cat-h3 { margin: 0 0 6px; font-size: 21px; font-weight: 800; letter-spacing: -0.02em; }
        .bx-col-cat-p { margin: 0 0 16px; font-size: 14.5px; color: var(--bx-text-2); line-height: 1.6; }
        .bx-col-cat-busca { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 16px; border-radius: 14px; border: 1px solid rgba(var(--ac-1-rgb), 0.5); background: var(--bx-bg-elev); font-size: 16px; box-shadow: 0 0 0 4px rgba(var(--ac-1-rgb), 0.08); }
        .bx-col-cat-cursor { width: 2px; height: 20px; background: var(--ac-1); animation: bxColPisca 1s steps(2) infinite; }
        .bx-col-cat-resultados { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .bx-col-cat-carta { position: relative; border-radius: 9px; overflow: hidden; background: var(--bx-surface-2); }
        .bx-col-cat-preco { position: absolute; right: 6px; bottom: 6px; background: rgba(0,0,0,.82); border-radius: 7px; padding: 3px 7px; font-size: 11px; font-weight: 800; color: #fff; }
        .bx-col-cat-reconhecida { display: inline-flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: color-mix(in srgb, var(--bx-green) 10%, transparent); border: 1px solid color-mix(in srgb, var(--bx-green) 30%, transparent); font-size: 14px; }
        .bx-col-cat-ok { width: 22px; height: 22px; border-radius: 50%; background: var(--bx-green); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .bx-col-cat-camera { position: relative; width: 190px; }
        @media (min-width: 768px) { .bx-col-cat-camera { width: 220px; } }
        .bx-col-cat-cantos { position: absolute; inset: -8px; border-radius: 14px; pointer-events: none;
          background: linear-gradient(var(--ac-1), var(--ac-1)) top left/22px 3px no-repeat, linear-gradient(var(--ac-1), var(--ac-1)) top left/3px 22px no-repeat,
                      linear-gradient(var(--ac-1), var(--ac-1)) top right/22px 3px no-repeat, linear-gradient(var(--ac-1), var(--ac-1)) top right/3px 22px no-repeat,
                      linear-gradient(var(--ac-1), var(--ac-1)) bottom left/22px 3px no-repeat, linear-gradient(var(--ac-1), var(--ac-1)) bottom left/3px 22px no-repeat,
                      linear-gradient(var(--ac-1), var(--ac-1)) bottom right/22px 3px no-repeat, linear-gradient(var(--ac-1), var(--ac-1)) bottom right/3px 22px no-repeat; }
        .bx-col-cat-linha { position: absolute; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent, var(--ac-1), transparent); box-shadow: 0 0 18px 4px rgba(var(--ac-1-rgb), 0.55); animation: bxColScan 2.2s cubic-bezier(.22,.61,.36,1) infinite alternate; }
        .bx-col-cat-pre { margin: 0; font-family: ui-monospace, Menlo, monospace; font-size: 14px; line-height: 1.8; padding: 14px 16px; border-radius: 12px; background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); color: var(--bx-text-2); white-space: pre-wrap; }
        .bx-col-cat-linha-lista { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; background: var(--bx-surface-2); border: 1px solid var(--bx-border); }
        @keyframes bxColScan { from { top: 4% } to { top: 94% } }
        @keyframes bxColPisca { 50% { opacity: 0 } }
        @keyframes bxColSobe { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .bx-col-cat-linha, .bx-col-cat-cursor, .bx-col-cat-aba { animation: none; } .bx-col-cat-linha { top: 50%; } }
      `}</style>
    </div>
  )
}
