'use client'

// Bloco "Graduadoras" do medidor: uma escada por tabela publicada, com a carta
// (silhueta) apoiada no degrau mais alto em que a centralizacao cabe. Ordem
// fixa (a medida muda ao vivo; reordenar faria a lista pular a cada ajuste).
// Nunca e nota: so diz onde a centralizacao cabe e quanto falta.

import { escadasDeCentralizacao, fmtLimite, fmtPontos, fmtMmCurto, type Escada, type FaceNome } from '@/lib/centralizacao/graduadoras'
import type { Medida } from '@/lib/centralizacao/medida'
import { IconStar, IconWarning } from '@/components/ui/Icons'

const NOME_FACE: Record<FaceNome, string> = { frente: 'frente', verso: 'verso' }
const COLUNAS = 6

/** "na PSA", "na PSA e na TAG", "na PSA, na BGS e na TAG". */
function listaNomes(n: string[]) {
  const c = n.map(x => `na ${x}`)
  return c.length <= 1 ? c.join('') : `${c.slice(0, -1).join(', ')} e ${c[c.length - 1]}`
}

export default function EscadasGraduadoras({ frente, verso, previa, onMedir }: {
  frente: Medida | null
  verso: Medida | null
  /** Ainda ha linha sem conferir. */
  previa: boolean
  onMedir: (f: FaceNome) => void
}) {
  const r = escadasDeCentralizacao(frente, verso)

  let resumo = ''
  if (r.base !== 'nenhuma') {
    if (r.todasNoGem) resumo = 'Pela centralização, a carta cabe na faixa Gem Mint das quatro tabelas.'
    else if (r.nenhumaCabe) resumo = 'A centralização fica fora das quatro tabelas publicadas.'
    else if (r.melhores.length) {
      const e = r.escadas.find(x => x.graduadora === r.melhores[0])
      const nota = e && e.teto != null ? e.degraus[e.teto].nota : ''
      resumo = `Pela centralização, a melhor faixa está ${listaNomes(r.melhores)}: cabe em ${nota}.`
    } else resumo = 'Pela centralização, a carta fica na mesma altura das tabelas publicadas.'
  }

  return (
    <section className="eg" aria-label="Graduadoras">
      <style>{CSS}</style>
      <div className="eg-cab">
        <div>
          <h2>Graduadoras</h2>
          <p className="eg-sub">Onde a centralização cabe em cada tabela</p>
        </div>
      </div>

      {r.base === 'nenhuma' && <p className="eg-faixa">Meça a frente para ver onde a centralização cabe em cada tabela.</p>}
      {(r.base === 'frente' || r.base === 'verso') && (
        <div className="eg-faixa eg-faixa-aviso">
          <IconWarning size={15} />
          <span>{r.base === 'frente' ? 'Só a frente medida. O verso pode baixar a faixa.' : 'Só o verso medido. A frente pode baixar a faixa.'}</span>
          <button type="button" className="eg-bt" onClick={() => onMedir(r.base === 'frente' ? 'verso' : 'frente')}>
            {r.base === 'frente' ? 'Medir o verso' : 'Medir a frente'}
          </button>
        </div>
      )}
      {previa && r.base !== 'nenhuma' && <p className="eg-faixa">Prévia. Confira as 8 linhas para valer.</p>}

      {resumo && (
        <div className="eg-resumo">
          <b>{resumo}</b>
          <span>A centralização é só um dos critérios. Cantos, bordas e superfície também entram, e a nota final é da graduadora.</span>
        </div>
      )}

      <div className="eg-lista">
        {r.escadas.map(e => <Linha key={e.graduadora} e={e} base={r.base} />)}
      </div>

      <p className="eg-rodape">
        Tabelas oficiais consultadas em {r.consulta}. Um ponto é um ponto percentual do lado maior: de 55/45 para 54/46. 10P = Pristine.
      </p>
    </section>
  )
}

function Linha({ e, base }: { e: Escada; base: 'duas' | FaceNome | 'nenhuma' }) {
  if (!e.publica) {
    return (
      <div className="eg-linha">
        <div className="eg-nome"><b>{e.graduadora}</b><small>{e.quando}</small></div>
        <div className="eg-frases eg-frases-largo"><span>Não publica limite em proporção. Avalia a centralização de forma qualitativa.</span></div>
      </div>
    )
  }
  const uma = base === 'frente' || base === 'verso'
  const teto = e.teto != null ? e.degraus[e.teto] : null
  const prox = e.teto == null ? e.degraus[0] : e.degraus[e.teto + 1]
  const vazias = Math.max(0, COLUNAS - e.degraus.length)
  const rotulo = teto ? `${e.graduadora}: cabe em ${teto.nota}` : `${e.graduadora}: abaixo da tabela publicada`

  const frases: string[] = []
  if (base !== 'nenhuma') {
    if (teto) {
      frases.push(uma ? `${base === 'verso' ? 'Pelo verso' : 'Pela frente'}, cabe até ${teto.nota}.` : `Cabe na faixa ${teto.nota}.`)
      if (uma && e.outraFace) {
        frases.push(e.outraFace.ate != null
          ? `Para manter, o ${NOME_FACE[e.outraFace.face]} precisa ficar até ${fmtLimite(e.outraFace.ate)}.`
          : `Nessa nota, a ${e.graduadora} não separa o ${NOME_FACE[e.outraFace.face]}.`)
      }
    } else if (e.graduadora === 'CGC') {
      // A observacao da CGC (embaixo) ja explica que so a nota 10 tem numero.
      frases.push('Fica abaixo da tabela publicada.')
    } else {
      const baixo = e.degraus[0]
      frases.push(`Fica abaixo da tabela publicada. O degrau mais baixo, ${baixo.nota}, vai até ${fmtLimite(baixo.frente)} na frente.`)
    }
    if (prox && e.folga.length) {
      const partes = e.folga.map(f => `${fmtPontos(f.pp)} ${f.face === 'verso' ? 'no verso' : 'na frente'}`)
      const mm = e.folga.length === 1 ? ` (${fmtMmCurto(e.folga[0].mm)})` : ''
      const margem = e.folga.every(f => f.naMargem) ? ', menos que a precisão da foto. Vale conferir as linhas' : ''
      frases.push(`Para ${prox.nota}: faltam ${partes.join(' e ')}${mm}${margem}.`)
    } else if (teto && !prox) {
      frases.push('É o degrau mais alto da tabela.')
    }
    if (e.margem?.naMargem) frases.push('Está no limite da faixa. Uma diferença de 0,1 mm muda o resultado.')
  }

  return (
    <div className={`eg-linha${e.melhor ? ' eg-melhor' : ''}`}>
      <div className="eg-nome">
        <b>{e.graduadora}</b>
        {e.melhor && <span className="eg-selo">Melhor faixa</span>}
        <small>{e.quando}</small>
      </div>
      <div className="eg-escada" role="img" aria-label={rotulo}>
        {base !== 'nenhuma' && e.teto == null && (
          <div className="eg-chao"><span className={`eg-carta${uma ? ' eg-carta-uma' : ''}`} /><small>abaixo</small></div>
        )}
        {Array.from({ length: vazias }, (_, i) => <div key={`v${i}`} className="eg-col" aria-hidden />)}
        {e.degraus.map((d, i) => (
          <div key={d.nota} className="eg-col" title={`${d.nota}: frente até ${fmtLimite(d.frente)}${d.verso != null ? `, verso até ${fmtLimite(d.verso)}` : ''}`}>
            {d.estado === 'teto' && <span className={`eg-carta${uma ? ' eg-carta-uma' : ''}`} aria-hidden />}
            <div className={`eg-degrau eg-${d.estado}`} style={{ height: Math.min(54, 14 + (i + vazias) * 8) }} />
            <span className="eg-rot">{d.gem && <IconStar size={10} />}{d.curto}</span>
          </div>
        ))}
      </div>
      <div className="eg-frases">
        {frases.map((f, i) => <span key={i} className={i === 0 ? 'eg-f1' : ''}>{f}</span>)}
        {teto && <small>Limite: frente até {fmtLimite(teto.frente)}{teto.verso != null ? `, verso até ${fmtLimite(teto.verso)}` : ''}.</small>}
        {e.obs && <small>{e.obs}</small>}
      </div>
    </div>
  )
}

const CSS = `
.eg{display:grid;gap:12px;padding:16px;border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.eg-cab h2{margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.eg-sub{margin:2px 0 0;font-size:14px;font-weight:700;color:var(--bx-text)}
.eg-faixa{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0;font-size:12.5px;color:var(--bx-text-2);line-height:1.5}
.eg-faixa-aviso{padding:10px 12px;border-radius:10px;color:var(--bx-text);background:color-mix(in srgb,var(--bx-amber) 10%,transparent);border:1px solid color-mix(in srgb,var(--bx-amber) 35%,transparent)}
.eg-faixa-aviso svg{color:var(--bx-amber);flex:none}
.eg-faixa-aviso span{flex:1;min-width:160px}
.eg-bt{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s ease}
.eg-bt:hover{background:var(--bx-surface-3)}
.eg-resumo{display:grid;gap:4px}
.eg-resumo b{font-size:15px;line-height:1.4}
.eg-resumo span{font-size:12px;color:var(--bx-text-3);line-height:1.45}
.eg-lista{display:grid}
.eg-linha{display:grid;grid-template-columns:120px minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:end;padding:12px 10px;border-top:1px solid var(--bx-border);border-radius:0;transition:background .15s ease,border-color .15s ease}
.eg-melhor{background:rgba(var(--ac-1-rgb),.06);border:1px solid rgba(var(--ac-1-rgb),.35);border-radius:10px}
.eg-melhor + .eg-linha{border-top-color:transparent}
.eg-nome{display:grid;gap:4px;align-self:center}
.eg-nome b{font-size:15px;letter-spacing:.02em}
.eg-nome small{font-size:11.5px;color:var(--bx-text-3);line-height:1.4}
.eg-selo{justify-self:start;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;color:var(--bx-text);background:rgba(var(--ac-1-rgb),.14)}
.eg-escada{display:flex;align-items:flex-end;gap:5px;min-height:96px;padding-top:24px}
.eg-col{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;min-width:0}
.eg-degrau{width:100%;border-radius:4px 4px 0 0;border:1px solid var(--bx-border);background:var(--bx-surface-2);transition:background .15s ease,border-color .15s ease}
.eg-atingido{background:rgba(var(--ac-1-rgb),.22);border-color:transparent}
.eg-teto{background:rgba(var(--ac-1-rgb),.45);border-color:var(--ac-1)}
.eg-proximo{background:transparent;border:1px dashed rgba(var(--ac-1-rgb),.6)}
.eg-rot{display:inline-flex;align-items:center;gap:2px;font-size:11px;font-weight:800;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.eg-rot svg{color:var(--ac-1)}
.eg-carta{width:12px;height:17px;border:1.5px solid var(--bx-text);border-radius:2px;background:var(--bx-bg);margin-bottom:-2px;transition:transform .15s ease}
.eg-carta-uma{border-style:dashed}
.eg-chao{display:flex;flex-direction:column;align-items:center;gap:4px;padding-right:4px}
.eg-chao small{font-size:10.5px;color:var(--bx-text-3)}
.eg-frases{display:grid;gap:3px;font-size:13px;line-height:1.45;color:var(--bx-text-2);align-self:center}
.eg-frases-largo{grid-column:2 / span 2}
.eg-f1{color:var(--bx-text);font-weight:700}
.eg-frases small{font-size:11.5px;color:var(--bx-text-3);line-height:1.4}
.eg-rodape{margin:0;font-size:11.5px;color:var(--bx-text-3);line-height:1.45}
@media (max-width:900px){
  .eg{padding:14px}
  .eg-linha{grid-template-columns:minmax(0,1fr);gap:10px}
  .eg-nome{grid-template-columns:auto 1fr;align-items:center;column-gap:10px}
  .eg-nome small{grid-column:1 / -1;order:3}
  .eg-frases-largo{grid-column:auto}
}
`
