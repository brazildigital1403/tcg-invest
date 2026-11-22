'use client'

// Portfolio dos criadores no /admin (Fase 2, fatia 2b): a fila de conteudos que ninguem conferiu
// (ate 30, sorteados) e os marcados como "nao confere", com desfazer. Vale para o Club inteiro,
// nao para uma edicao. O Admin ve tambem os conteudos de quem organiza, que nao os confere.

import { useCallback, useEffect, useState } from 'react'
import { avisoDesfeito, avisoReprovado, erroPortfolio, resumoConteudo, type Amostra, type ConteudoAmostra } from '@/lib/pcc/portfolio'
import { chamar } from './api'

const buscar = (): Promise<Amostra | null> => chamar<{ amostra?: Amostra }>({ acao: 'portfolio' }).then(r => (r.ok && r.d.amostra ? r.d.amostra : null))
const quem = (c: ConteudoAmostra) => (c.instagram ? `@${c.instagram}` : 'Sem @ no perfil')

export default function PortfolioAdmin({ onErro, onOk }: { onErro: (m: string) => void; onOk: (m: string) => void }) {
  const [amostra, setAmostra] = useState<Amostra | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const aplicar = useCallback((a: Amostra | null) => { if (a) { setAmostra(a); setFalhou(false) } else setFalhou(true) }, [])
  const ler = useCallback(() => { buscar().then(aplicar) }, [aplicar])
  useEffect(() => {
    let vivo = true
    buscar().then(a => { if (vivo) aplicar(a) })
    return () => { vivo = false }
  }, [aplicar])

  async function conferir(c: ConteudoAmostra, ok: boolean) {
    let nota = ''
    if (!ok) {
      const resp = window.prompt('Marcar como não confere? O conteúdo sai do portfólio e a carta que dependia dele volta a ficar bloqueada. Motivo (opcional):', '')
      if (resp === null) return
      nota = resp
    }
    setOcupado(c.id); onErro(''); onOk('')
    const r = await chamar<{ resultado?: { cartas_tiradas: number } }>({ acao: 'conteudo_conferir', id: c.id, ok, nota })
    setOcupado(null)
    if (!r.ok || !r.d.resultado) { onErro(erroPortfolio(r.d.error)); return }
    if (ok) {
      setAmostra(a => (a ? { ...a, pendentes: a.pendentes.filter(x => x.id !== c.id), total_pendentes: Math.max(0, a.total_pendentes - 1) } : a))
    } else {
      onOk(avisoReprovado(r.d.resultado.cartas_tiradas))
      ler()
    }
  }

  async function desfazer(c: ConteudoAmostra) {
    setOcupado(c.id); onErro(''); onOk('')
    const r = await chamar<{ resultado?: { cartas_devolvidas: number } }>({ acao: 'conteudo_desfazer', id: c.id })
    setOcupado(null)
    if (!r.ok || !r.d.resultado) { onErro(erroPortfolio(r.d.error)); return }
    onOk(avisoDesfeito(r.d.resultado.cartas_devolvidas))
    ler()
  }

  if (falhou && !amostra) return <div className="ac-box"><p className="ac-mut">Não conseguimos carregar o portfólio.</p></div>
  if (!amostra) return <div className="ac-box"><p className="ac-mut">Carregando...</p></div>

  const { pendentes, total_pendentes: total, reprovados } = amostra

  return (
    <>
      <div className="ac-box">
        <div className="ac-row sp">
          <h3 className="ac-h3">Conteúdos para conferir</h3>
          <button type="button" className="ac-btn sm" onClick={ler}>Sortear outros</button>
        </div>
        <p className="ac-mut">Vale para o Club inteiro, não só para esta edição. <b>{total}</b> {total === 1 ? 'conteúdo ainda não foi conferido' : 'conteúdos ainda não foram conferidos'}; aqui aparecem até 30, sorteados.</p>
        {pendentes.length === 0
          ? <p className="ac-mut">{total === 0 ? 'Nenhum conteúdo esperando conferência.' : 'Esta leva foi conferida.'}</p>
          : <div>{pendentes.map(c => (
            <div key={c.id} className="ac-lin">
              <div className="tx">
                <b>{quem(c)}</b>
                <small>{resumoConteudo(c)} · <a className="ac-a" href={c.url} target="_blank" rel="noopener noreferrer nofollow">abrir o link</a></small>
              </div>
              <button type="button" className="ac-btn sm" disabled={ocupado === c.id} onClick={() => conferir(c, true)}>Confere</button>
              <button type="button" className="ac-btn sm red" disabled={ocupado === c.id} onClick={() => conferir(c, false)}>Não confere</button>
            </div>
          ))}</div>}
      </div>

      <div className="ac-box">
        <h3 className="ac-h3">Marcados como não confere</h3>
        {reprovados.length === 0
          ? <p className="ac-mut">Nenhum conteúdo foi reprovado.</p>
          : <div>{reprovados.map(c => (
            <div key={c.id} className="ac-lin">
              <div className="tx">
                <b>{quem(c)}</b>
                <small>{[resumoConteudo(c), c.nota ? `"${c.nota}"` : ''].filter(Boolean).join(' · ')} · <a className="ac-a" href={c.url} target="_blank" rel="noopener noreferrer nofollow">abrir o link</a></small>
              </div>
              <button type="button" className="ac-btn sm" disabled={ocupado === c.id} onClick={() => desfazer(c)}>{ocupado === c.id ? 'Desfazendo...' : 'Desfazer'}</button>
            </div>
          ))}</div>}
      </div>
    </>
  )
}
