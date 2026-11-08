'use client'

// Avisos do Club (wireframe aprovado em 08/11/2026, quadros V01, V02, V09 e
// D8). Fixados no topo, feed do mais novo para o mais antigo, encerrados no
// fim. So quem esta logado ve. "Novo" e guardado no navegador.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { marcarVisita, pedeResposta, prazoPassou, ultimaVisita, type ListaAvisos } from '@/lib/pcc/avisos'
import { AVISOS, AVISOS_ORGANIZAR, CLUB } from '@/lib/pcc/rotas'
import { SeloFrente } from '../amigo-secreto/estilo'
import { Casca } from '../agenda/comum'
import { AV_CSS, FixadoCompacto, LinhaAviso } from './comum'

const ROTA = AVISOS

export default function AvisosClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [dados, setDados] = useState<ListaAvisos | null>(null)
  const [falhou, setFalhou] = useState(false)
  // Marca da visita anterior: o que veio depois dela e "Novo" nesta visita.
  const [visto, setVisto] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const { data, error } = await supabase.rpc('club_avisos_lista')
    if (error) { setFalhou(true); return }
    const anterior = ultimaVisita()
    setVisto(anterior ?? Date.now())
    marcarVisita()
    setDados(data as ListaAvisos)
  }, [])

  // Busca quando a sessao aparece; o setFalhou(false) do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])

  const casca = (filhos: React.ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={() => openLogin({ next: ROTA, cta: 'Entrar no Club' })} voltar={CLUB} titulo="Avisos">
      {filhos}
      <style>{AV_CSS + LISTA_CSS}</style>
    </Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)
  if (uid === null) {
    const entrar = () => openLogin({ next: ROTA, cta: 'Entrar no Club' })
    return casca(
      <div className="as-center">
        <SeloFrente frente="avisos" />
        <h1 className="as-h2">Avisos do Club</h1>
        <p className="as-p">Entre para ver os avisos.</p>
        <button type="button" className="as-btn pri cta" style={{ maxWidth: 320, width: '100%' }} onClick={entrar}>Entrar</button>
        <Link href={`/cadastro?next=${encodeURIComponent(ROTA)}`} className="as-btn" style={{ maxWidth: 320, width: '100%' }}>Criar conta</Link>
      </div>, false)
  }
  if (falhou && !dados) {
    return casca(<>
      <h1 className="as-h2">Avisos do Club</h1>
      <div className="as-erro" role="alert">Não conseguimos carregar os avisos.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!dados) return casca(<div className="as-center"><span className="as-meta">Abrindo os avisos...</span></div>)

  const organiza = dados.papeis.includes('avisos')
  const fixados = dados.avisos.filter(a => a.fixado)
  const resto = dados.avisos.filter(a => !a.fixado)
  const recentes = resto.filter(a => !prazoPassou(a))
  const encerrados = resto.filter(a => prazoPassou(a))
  const comPrazo = recentes.filter(a => a.prazo_em || pedeResposta(a))

  return casca(<>
    <div className="ag-topo">
      <div>
        <h1 className="as-h2">Avisos do Club</h1>
        <p className="as-meta ag-sub">O que a organização precisa que você saiba.</p>
      </div>
      {organiza && <Link href={AVISOS_ORGANIZAR} className="as-btn sm">Organizar</Link>}
    </div>

    {dados.avisos.length === 0 ? (
      <div className="ag-vazio"><span className="as-meta">Nenhum aviso por enquanto.</span><span className="as-meta">Quando a organização publicar, aparece aqui.</span></div>
    ) : (
      <div className="av-grade">
        <div className="av-col">
          <div className="av-so-mob">{fixados.map(a => <FixadoCompacto key={a.id} a={a} />)}</div>
          {recentes.length > 0 && <div className="as-k">Recentes</div>}
          {recentes.map(a => <LinhaAviso key={a.id} a={a} visto={visto} />)}
          {encerrados.length > 0 && <div className="as-k">Encerrados</div>}
          {encerrados.map(a => <LinhaAviso key={a.id} a={a} visto={visto} />)}
        </div>
        <div className="av-col av-lado">
          {fixados.length > 0 && <div className="as-k">Fixados</div>}
          {fixados.map(a => <FixadoCompacto key={a.id} a={a} />)}
          {comPrazo.length > 0 && <div className="as-k">Com prazo</div>}
          {comPrazo.map(a => <LinhaAviso key={a.id} a={a} visto={visto} />)}
        </div>
      </div>
    )}
  </>)
}

const LISTA_CSS = `
.av-grade{display:flex;flex-direction:column;gap:16px;min-width:0}
.av-col{display:flex;flex-direction:column;gap:8px;min-width:0}
.av-so-mob{display:flex;flex-direction:column;gap:8px}
.av-lado{display:none}
@media (min-width:1024px){
  .av-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:32px;align-items:start}
  .av-so-mob{display:none}
  .av-lado{display:flex;position:sticky;top:88px}
}
`
