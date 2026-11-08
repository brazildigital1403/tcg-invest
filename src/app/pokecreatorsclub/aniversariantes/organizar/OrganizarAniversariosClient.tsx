'use client'

// Organizador dos Aniversariantes (wireframe de 08/11/2026, quadro O4). A lista
// que todo membro ja ve, com "Remover foto" em quem tem foto. A pessoa continua
// na lista, com o Pokemon ou a inicial no lugar, e fica registrado quem removeu.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import type { Aniversariante, ListaAniversarios } from '@/lib/pcc/aniversarios'
import { ANIVERSARIANTES, ANIVERSARIANTES_ORGANIZAR } from '@/lib/pcc/rotas'
import { AS_CSS, VoltarClub } from '../../amigo-secreto/estilo'
import { CAL_CSS, Folha } from '../../_comum/calendario'
import { Rosto } from '../AniversariantesClient'

const dm = (d: number, m: number) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`

export default function OrganizarAniversariosClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [papel, setPapel] = useState<boolean | null>(null)
  const [lista, setLista] = useState<Aniversariante[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [alvo, setAlvo] = useState<Aniversariante | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const { data: p } = await supabase.rpc('club_meus_papeis')
    const tem = Array.isArray(p) && p.includes('aniversariantes')
    setPapel(tem)
    if (!tem) return
    const { data, error } = await supabase.rpc('club_aniversarios_lista')
    if (error) { setFalhou(true); return }
    setLista((data as ListaAniversarios).lista)
  }, [])

  // Busca quando a sessao aparece; os resets do inicio sao da propria tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (uid) carregar() }, [uid, carregar])

  const casca = (filhos: React.ReactNode) => (
    <div className="as an">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={ANIVERSARIANTES} rotulo="Aniversariantes" />
          <span className="t">Organizar</span>
          <span style={{ width: 44 }} />
        </div>
      </header>
      <main className="bx-gutter"><div className="as-wrap as-bd">{filhos}</div></main>
      <style>{AS_CSS + CAL_CSS + OA_CSS}</style>
    </div>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>)
  if (uid === null) {
    return casca(<div className="as-center">
      <h1 className="as-h2">Organizar aniversários</h1>
      <button type="button" className="as-btn pri" style={{ maxWidth: 320, width: '100%' }} onClick={() => openLogin({ next: ANIVERSARIANTES_ORGANIZAR, cta: 'Entrar no Club' })}>Entrar</button>
    </div>)
  }
  if (papel === false) {
    return casca(<>
      <h1 className="as-h2">Organizar aniversários</h1>
      <div className="as-note">Só a organização do Club pode remover fotos da lista.</div>
      <Link href={ANIVERSARIANTES} className="as-btn">Ver os aniversariantes</Link>
    </>)
  }
  if (falhou && !lista) {
    return casca(<>
      <div className="as-erro" role="alert">Não conseguimos carregar a lista.</div>
      <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
    </>)
  }
  if (!lista) return casca(<div className="as-center"><span className="as-meta">Abrindo a lista...</span></div>)

  const comFoto = lista.filter(p => p.foto_path).length
  return casca(<>
    <h1 className="as-h2">Organizar aniversários</h1>
    <p className="as-meta" style={{ margin: 0 }}>{lista.length} na lista · {comFoto} com foto. Foto imprópria sai daqui na hora.</p>
    {aviso && <div className="as-note strong" role="status">{aviso}</div>}
    {lista.length === 0 && <div className="pc-vazio as-center"><span className="as-meta">Ninguém na lista ainda.</span></div>}
    {lista.map(p => (
      <div key={p.instagram} className="pc-linha">
        <Rosto p={p} />
        <span className="pc-nm"><b>@{p.instagram}</b><small>{dm(p.dia, p.mes)}</small></span>
        {p.foto_path && <button type="button" className="as-btn sm oa-rem" onClick={() => setAlvo(p)}>Remover foto</button>}
      </div>
    ))}
    {alvo && <FolhaRemover p={alvo} onFechar={() => setAlvo(null)} onFeito={async msg => { setAlvo(null); setAviso(msg); await carregar() }} />}
  </>)
}

function FolhaRemover({ p, onFechar, onFeito }: { p: Aniversariante; onFechar: () => void; onFeito: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function remover() {
    setOcupado(true); setErro('')
    const r = await authFetch('/api/pcc/aniversariantes/remover-foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instagram: p.instagram }) })
    const d = await r.json().catch(() => ({}))
    setOcupado(false)
    if (!r.ok) {
      setErro(d.error === 'sem_papel' ? 'Só a organização do Club pode remover fotos.' : /sem_foto|pessoa_nao_encontrada/.test(d.error || '') ? 'Esta foto já saiu da lista.' : 'Não conseguimos remover. Tente de novo.')
      return
    }
    onFeito(`Foto de @${p.instagram} removida.`)
  }
  return (
    <Folha titulo="Remover foto" onFechar={onFechar}>
      <div className="oa-quem"><Rosto p={p} tam={56} /><b>@{p.instagram}</b></div>
      <p className="as-meta">A pessoa continua na lista, com o Pokémon ou a inicial no lugar da foto. Fica registrado que você removeu.</p>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="button" className="as-btn pri" disabled={ocupado} onClick={remover}>{ocupado ? 'Removendo...' : 'Remover foto'}</button>
      <button type="button" className="as-btn" disabled={ocupado} onClick={onFechar}>Voltar</button>
    </Folha>
  )
}

const OA_CSS = `
.an-rosto img{object-fit:cover}
.oa-rem{width:auto;flex:none;color:var(--bx-red);border-color:color-mix(in srgb,var(--bx-red) 30%,transparent)}
.oa-quem{display:flex;align-items:center;gap:12px;font-size:16px}
`
