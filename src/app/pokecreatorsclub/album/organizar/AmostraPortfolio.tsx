'use client'

// Amostra do portfólio para quem organiza o álbum (Fase 2, fatia 2b). Até dez conteúdos sorteados
// entre os que ninguém conferiu ainda, nunca os da própria pessoa. "Confere" só carimba. "Não
// confere" tira o conteúdo do portfólio e bloqueia de novo a carta que dependia dele; dá para
// desfazer na lista de baixo. O link abre em outra aba: nada da rede carrega aqui dentro.

import { useCallback, useEffect, useState } from 'react'
import {
  avisoDesfeito, avisoReprovado, carregarAmostra, conferirConteudo, desfazerAmostra, resumoConteudo,
  type Amostra, type ConteudoAmostra,
} from '@/lib/pcc/portfolio'
import { Ico } from '../../amigo-secreto/estilo'
import { Folha } from '../../_comum/calendario'

type Carga = { fase: 'lendo' } | { fase: 'falhou' } | { fase: 'ok'; d: Amostra }

const buscar = (): Promise<Carga> => carregarAmostra().then(r => (r.ok ? { fase: 'ok', d: r.d } : { fase: 'falhou' }))
const quem = (c: ConteudoAmostra) => (c.instagram ? `@${c.instagram}` : 'Sem @ no perfil')

export default function AmostraPortfolio() {
  const [carga, setCarga] = useState<Carga>({ fase: 'lendo' })
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [alvo, setAlvo] = useState<ConteudoAmostra | null>(null)
  const [aviso, setAviso] = useState('')
  const [erro, setErro] = useState('')

  const ler = useCallback(() => { buscar().then(setCarga) }, [])
  useEffect(() => {
    let vivo = true
    buscar().then(c => { if (vivo) setCarga(c) })
    return () => { vivo = false }
  }, [])
  const fechar = useCallback(() => setAlvo(null), [])

  async function confere(c: ConteudoAmostra) {
    setOcupado(c.id); setErro(''); setAviso('')
    const r = await conferirConteudo(c.id, true)
    setOcupado(null)
    if (!r.ok) { setErro(r.msg); return }
    // Sai da fila na hora, sem sortear de novo: a lista não pula debaixo do dedo.
    setCarga(a => (a.fase === 'ok' ? { fase: 'ok', d: { ...a.d, pendentes: a.d.pendentes.filter(x => x.id !== c.id), total_pendentes: Math.max(0, a.d.total_pendentes - 1) } } : a))
  }

  async function desfazer(c: ConteudoAmostra) {
    setOcupado(c.id); setErro(''); setAviso('')
    const r = await desfazerAmostra(c.id)
    setOcupado(null)
    if (!r.ok) { setErro(r.msg); return }
    setAviso(avisoDesfeito(r.d.cartas_devolvidas))
    ler()
  }

  if (carga.fase === 'lendo') return <section className="as-card ap" aria-label="Amostra do portfólio"><h2 className="as-h3">Amostra do portfólio</h2><p className="as-meta">Abrindo...</p></section>
  if (carga.fase === 'falhou') {
    return (
      <section className="as-card ap" aria-label="Amostra do portfólio">
        <h2 className="as-h3">Amostra do portfólio</h2>
        <div className="as-erro" role="alert">Não conseguimos abrir a amostra.</div>
        <button type="button" className="as-btn sm" onClick={() => { setCarga({ fase: 'lendo' }); ler() }}>Tentar de novo</button>
      </section>
    )
  }

  const { pendentes, total_pendentes: total, reprovados } = carga.d
  const fora = total - pendentes.length

  return (
    <section className="as-card ap" aria-label="Amostra do portfólio">
      <div className="as-eye-row">
        <h2 className="as-h3">Amostra do portfólio</h2>
        <span className="as-meta">{total === 0 ? 'Fila vazia' : total === 1 ? '1 na fila' : `${total} na fila`}</span>
      </div>
      <p className="as-meta">Abra o link e veja se o conteúdo existe e é da pessoa. Os seus conteúdos não aparecem aqui.</p>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      {aviso && <div className="as-note strong" role="status">{aviso}</div>}

      {pendentes.length === 0
        ? <p className="as-meta">{total === 0 ? 'Nenhum conteúdo esperando conferência.' : 'Você conferiu esta leva.'}</p>
        : pendentes.map(c => (
          <div key={c.id} className="ap-item">
            <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="ap-link">
              <span className="tx"><b>{quem(c)}</b><small>{resumoConteudo(c)}</small></span>
              <Ico n="ext" s={16} />
            </a>
            <div className="ap-acoes">
              <button type="button" className="as-btn sm" disabled={ocupado === c.id} onClick={() => confere(c)}>{ocupado === c.id ? 'Salvando...' : 'Confere'}</button>
              <button type="button" className="as-btn sm ap-nao" disabled={ocupado === c.id} onClick={() => { setErro(''); setAviso(''); setAlvo(c) }}>Não confere</button>
            </div>
          </div>
        ))}
      {(fora > 0 || (pendentes.length === 0 && total > 0)) && (
        <button type="button" className="as-btn sm" onClick={ler}>{pendentes.length === 0 ? 'Ver mais conteúdos' : 'Sortear outros'}</button>
      )}

      {reprovados.length > 0 && (
        <div className="ap-rep">
          <h3 className="as-h3">Marcados como não confere</h3>
          {reprovados.map(c => (
            <div key={c.id} className="ap-item">
              <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="ap-link">
                <span className="tx"><b>{quem(c)}</b><small>{[resumoConteudo(c), c.nota ? `"${c.nota}"` : ''].filter(Boolean).join(' · ')}</small></span>
                <Ico n="ext" s={16} />
              </a>
              <div className="ap-acoes">
                <button type="button" className="as-btn sm" disabled={ocupado === c.id} onClick={() => desfazer(c)}>{ocupado === c.id ? 'Desfazendo...' : 'Desfazer'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {alvo && <FolhaNaoConfere c={alvo} onFechar={fechar} onFeito={msg => { setAlvo(null); setAviso(msg); ler() }} />}
      <style>{AP_CSS}</style>
    </section>
  )
}

function FolhaNaoConfere({ c, onFechar, onFeito }: { c: ConteudoAmostra; onFechar: () => void; onFeito: (msg: string) => void }) {
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function reprovar() {
    setOcupado(true); setErro('')
    const r = await conferirConteudo(c.id, false, nota)
    if (!r.ok) { setOcupado(false); setErro(r.msg); return }
    onFeito(avisoReprovado(r.d.cartas_tiradas))
  }

  return (
    <Folha titulo="Este conteúdo não confere?" eyebrow={quem(c)} onFechar={onFechar}>
      <p className="as-meta">O conteúdo sai do portfólio e da página pública da pessoa. A carta que dependia dele volta a ficar bloqueada. Quem já pediu o set fica com as cartas. Dá para desfazer depois.</p>
      <label className="as-f">
        <span className="as-lb">Motivo (opcional)</span>
        <input className="as-in" value={nota} maxLength={200} placeholder="Ex.: o link não abre" onChange={e => setNota(e.target.value)} />
      </label>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="button" className="as-btn pri" disabled={ocupado} onClick={reprovar}>{ocupado ? 'Salvando...' : 'Marcar como não confere'}</button>
      <button type="button" className="as-btn" disabled={ocupado} onClick={onFechar}>Voltar</button>
    </Folha>
  )
}

const AP_CSS = `
.ap{gap:10px;padding:14px}
.ap-item{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--bx-border)}
.ap-link{flex:1 1 220px;min-width:0;min-height:44px;display:flex;align-items:center;gap:10px;color:var(--bx-text);text-decoration:none}
.ap-link .tx{flex:1;min-width:0}
.ap-link b{display:block;font-size:14px;font-weight:700;overflow-wrap:anywhere}
.ap-link small{display:block;font-size:12.5px;color:var(--bx-text-3);line-height:1.35}
.ap-link:hover b{text-decoration:underline}
.ap-link .as-ico{color:var(--bx-text-3);flex:none}
.ap-acoes{display:flex;gap:8px;flex:none}
.ap-acoes .as-btn{width:auto;min-height:44px}
.ap .as-btn.ap-nao{color:var(--bx-red);border-color:rgba(239,68,68,.3)}
.ap-rep{display:flex;flex-direction:column;padding-top:12px;border-top:1px solid var(--bx-border)}
.ap>.as-btn.sm{align-self:flex-start;min-height:44px}
@media (max-width:480px){
  .ap-acoes{flex:1 1 100%}
  .ap-acoes .as-btn{flex:1}
}
`
