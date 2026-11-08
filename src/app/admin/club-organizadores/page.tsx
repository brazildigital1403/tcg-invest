'use client'

// Organizadores do Club no /admin (wireframe de 08/11/2026, quadro AD0). So o Du
// entra aqui. Adiciona uma conta da Bynx pelo @ ou pelo e-mail e marca os
// papeis; tirar vale na hora. Amigo Secreto nao e papel: fica so com o Du.

import { useCallback, useEffect, useState } from 'react'
import { AdminFaixa, AdminPage, AdminVazio } from '@/components/admin/AdminPage'

type Org = {
  user_id: string; papeis: string[]; created_at: string
  conta: { instagram: string | null; username: string | null; name: string | null; email: string | null } | null
}
const PAPEIS: { id: string; rotulo: string; ajuda: string }[] = [
  { id: 'agenda', rotulo: 'Agenda', ajuda: 'cria, edita, adia e cancela eventos' },
  { id: 'aniversariantes', rotulo: 'Aniversariantes', ajuda: 'remove foto imprópria' },
]
const quem = (o: Org) => o.conta?.instagram ? `@${o.conta.instagram}` : o.conta?.username ? `@${o.conta.username}` : o.conta?.email || o.user_id
const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))

export default function AdminClubOrganizadoresPage() {
  const [lista, setLista] = useState<Org[] | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [conta, setConta] = useState('')
  const [novos, setNovos] = useState<string[]>(['agenda'])
  const [ocupado, setOcupado] = useState(false)

  const load = useCallback(async () => {
    setErro('')
    const res = await fetch('/api/admin/club-organizadores')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setLista(d.lista || [])
  }, [])
  // Busca ao abrir; o setErro('') do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function enviar(corpo: object, msg: string | ((d: { nome?: string }) => string)) {
    setOcupado(true); setErro(''); setOk('')
    const res = await fetch('/api/admin/club-organizadores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const d = await res.json().catch(() => ({}))
    setOcupado(false)
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return false }
    setOk(typeof msg === 'function' ? msg(d) : msg)
    await load()
    return true
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!conta.trim() || novos.length === 0) return
    if (await enviar({ acao: 'adicionar', conta, papeis: novos }, d => `${d.nome || conta.trim()} agora organiza o Club.`)) { setConta(''); setNovos(['agenda']) }
  }

  function trocar(o: Org, papel: string) {
    const papeis = o.papeis.includes(papel) ? o.papeis.filter(p => p !== papel) : [...o.papeis, papel]
    if (papeis.length === 0 && !window.confirm(`Sem nenhum papel, ${quem(o)} deixa de organizar. Continuar?`)) return
    enviar({ acao: 'papeis', user_id: o.user_id, papeis }, papeis.length ? `Papéis de ${quem(o)} atualizados.` : `${quem(o)} não organiza mais.`)
  }

  function remover(o: Org) {
    if (!window.confirm(`Tirar ${quem(o)} da organização do Club? Vale na hora.`)) return
    enviar({ acao: 'remover', user_id: o.user_id }, `${quem(o)} não organiza mais.`)
  }

  return (
    <AdminPage titulo="Organizadores do Club"
      subtitulo="Poké Creators Club. O organizador entra com a conta normal da Bynx e organiza dentro do Club. Nunca vê o /admin. O Amigo Secreto fica só com você.">
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}

      <form className="co-box" onSubmit={adicionar}>
        <div className="co-t">Adicionar organizador</div>
        <label className="co-f">
          <span>@ ou e-mail da conta na Bynx</span>
          <input value={conta} onChange={e => setConta(e.target.value)} placeholder="@perfil ou email@exemplo.com" autoCapitalize="none" autoCorrect="off" />
        </label>
        <div className="co-papeis">
          {PAPEIS.map(p => (
            <label key={p.id} className="co-chk">
              <input type="checkbox" checked={novos.includes(p.id)} onChange={() => setNovos(n => n.includes(p.id) ? n.filter(x => x !== p.id) : [...n, p.id])} />
              <span><b>{p.rotulo}</b> · {p.ajuda}</span>
            </label>
          ))}
        </div>
        <button type="submit" className="co-btn pri" disabled={ocupado || !conta.trim() || novos.length === 0}>Adicionar</button>
      </form>

      {lista === null && !erro && <AdminVazio>Carregando...</AdminVazio>}
      {lista && lista.length === 0 && <AdminVazio>Ninguém organiza o Club além de você.</AdminVazio>}
      {lista && lista.length > 0 && (
        <div className="co-box co-lista">
          {lista.map(o => (
            <div key={o.user_id} className="co-item">
              <div className="co-quem">
                <b>{quem(o)}</b>
                <small>{o.conta?.name || ''}{o.conta?.name ? ' · ' : ''}desde {data(o.created_at)}</small>
              </div>
              <div className="co-papeis">
                {PAPEIS.map(p => (
                  <label key={p.id} className="co-chk">
                    <input type="checkbox" checked={o.papeis.includes(p.id)} disabled={ocupado} onChange={() => trocar(o, p.id)} />
                    <span>{p.rotulo}</span>
                  </label>
                ))}
              </div>
              <button type="button" className="co-btn red" disabled={ocupado} onClick={() => remover(o)}>Remover</button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .co-box{border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.02);padding:16px;display:flex;flex-direction:column;gap:12px}
        .co-t{font-size:15px;font-weight:700;color:#f0f0f0}
        .co-f{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:rgba(255,255,255,0.6)}
        .co-f input{min-height:48px;border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,0.04);color:#f0f0f0;font:inherit;font-size:16px;font-weight:400;outline:none}
        .co-papeis{display:flex;gap:6px 18px;flex-wrap:wrap}
        .co-chk{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px;color:rgba(255,255,255,0.75);cursor:pointer}
        .co-chk input{width:20px;height:20px;accent-color:#f59e0b}
        .co-chk b{color:#f0f0f0}
        .co-btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:transparent;color:#f0f0f0;font:inherit;font-size:14px;font-weight:700;cursor:pointer;align-self:flex-start}
        .co-btn.pri{background:linear-gradient(135deg,#f59e0b,#ef4444);border-color:transparent;color:#0d0d0d}
        .co-btn.red{color:#ef4444;border-color:rgba(239,68,68,0.3)}
        .co-btn:disabled{opacity:.45;cursor:default}
        .co-lista{gap:0;padding:0 16px}
        .co-item{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06)}
        .co-item:last-child{border-bottom:0}
        .co-quem{flex:1;min-width:180px;display:flex;flex-direction:column}
        .co-quem b{color:#f0f0f0;font-size:14px}
        .co-quem small{color:rgba(255,255,255,0.45);font-size:12px}
        .co-item .co-btn{align-self:center}
      `}</style>
    </AdminPage>
  )
}
