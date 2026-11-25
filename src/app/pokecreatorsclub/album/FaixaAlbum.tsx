'use client'

// Faixa do Álbum na casa do Club (mockup de 17/11/2026): entre as frentes e as Trends. Não é
// uma quinta frente: no celular ela ficaria a mais de 1.200 px da borda e, no computador,
// estreitaria as colunas. Mostra o contador (só cartas viradas), o leque das cinco primeiras
// cartas, a energia do álbum e leva ao álbum. A carta nova esperando aparece como tarefa
// ("Sua missão agora"), na própria casa.

import Link from 'next/link'
import { ALBUM, MEU_LINK, PORTFOLIO } from '@/lib/pcc/rotas'
import type { AlbumMinha, Estante } from '@/lib/pcc/album'
import { Ico } from '../amigo-secreto/estilo'
import { Energia, Leque5 } from './CartaClub'

export default function FaixaAlbum({ album, estante }: { album: AlbumMinha; estante?: Estante | null }) {
  const { edicao, reveladas, total, cartas } = album
  const completo = total > 0 && reveladas === total
  // Com capítulos abertos, o número grande é o do álbum inteiro e cada capítulo ganha a sua linha.
  const capitulos = (estante?.edicoes ?? []).filter(e => e.papel !== 'base' && !e.previa)
  const ciclo = capitulos.length > 0 && estante ? estante.ciclo : null
  return (
    <section className="fx" aria-label="Álbum do Club">
      <div className="as-eye">
        <Ico n="colecao" s={14} />Álbum do Club · Edição {edicao.edicao}
        {edicao.previa && <span className="as-chip wait fx-prev">Prévia</span>}
      </div>
      <h2 className="fx-h">{ciclo ? ciclo.reveladas : reveladas} de {ciclo ? ciclo.total : total} cartas no seu álbum</h2>
      <p className="as-meta">
        {ciclo
          ? `Cada participação no Club vira uma carta. A Base tem ${total} cartas e vale o set em casa.`
          : completo
            ? 'Você completou o álbum. Peça o seu set em casa.'
            : `Cada participação no Club vira uma carta. Complete as ${total} e receba o set em casa.`}
      </p>
      {capitulos.length > 0 && (
        <div className="fx-caps">
          {capitulos.map(c => (
            <Link key={c.slug} href={`${ALBUM}?c=${c.slug}`} className="fx-cap">
              <b>{c.titulo}</b>
              <span>{c.reveladas} de {c.total}{c.novas > 0 ? ` · ${c.novas} ${c.novas === 1 ? 'nova' : 'novas'}` : ''}</span>
            </Link>
          ))}
        </div>
      )}
      <Leque5 cartas={cartas} total={total} />
      <Energia n={reveladas} total={total} />
      <Link href={ALBUM} className="as-btn pri fx-bt">Abrir meu álbum</Link>
      {/* O portfolio so faz sentido com capitulo de Creator aberto: ate la a entrada fica guardada. */}
      {capitulos.some(c => c.trilha === 'creator') && <Link href={PORTFOLIO} className="as-btn lnk fx-pf">Meu portfólio de criador</Link>}
      {/* O link so aparece com capitulo da trilha Bynx aberto, como o portfolio com o de Creator. */}
      {capitulos.some(c => c.trilha === 'bynx') && <Link href={MEU_LINK} className="as-btn lnk fx-pf">Meu link do Club</Link>}
    </section>
  )
}

export const FAIXA_CSS = `
.fx{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:16px;border:1px solid rgba(var(--ac-1-rgb),.3);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.07),rgba(var(--ac-1-rgb),.02));min-width:0}
.fx-h{font-size:21px;font-weight:800;letter-spacing:-.02em;line-height:1.15}
.fx-prev{height:22px;margin-left:6px}
.fx-pf{width:auto;align-self:flex-start;min-height:44px;padding:0}
.fx-caps{display:flex;gap:8px;flex-wrap:wrap}
.fx-cap{min-height:44px;padding:6px 12px;border-radius:10px;border:1px solid var(--bx-border);background:var(--bx-surface);display:flex;flex-direction:column;justify-content:center;gap:1px;text-decoration:none;color:var(--bx-text);transition:background .15s ease}
.fx-cap:hover{background:var(--bx-surface-2)}
.fx-cap b{font-size:13px;font-weight:800}
.fx-cap span{font-size:11.5px;color:var(--bx-text-3)}
.cl-tcarta{display:flex;gap:14px;align-items:center}
.cl-vmini{width:84px;flex:none}
.cl-tcarta-tx{display:flex;flex-direction:column;gap:6px;min-width:0}
@media (min-width:1024px){
  .fx{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:12px 28px;align-items:center;padding:24px 28px}
  .fx>*{grid-column:1}
  .fx>.lq5{grid-column:2;grid-row:1/span 6;margin:0}
  .fx-bt{width:auto;justify-self:start;padding:0 22px}
}
`
