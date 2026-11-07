'use client'

// Admin dos Aniversariantes do Poke Creators Club (05/11/2026): quem esta na
// lista e o botao de remover foto impropria. A remocao vale na hora, sem
// aprovacao previa, e a pessoa continua na lista.

import { useEffect, useState } from 'react'
import { AdminPage, AdminVazio, AdminFaixa } from '@/components/admin/AdminPage'

type Linha = { instagram: string; dia: number; mes: number; foto_path: string | null; foto_url: string | null; created_at: string; updated_at: string }

const dm = (d: number, m: number) => `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`

export default function AdminAniversariantesPage() {
  const [lista, setLista] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function load() {
    setErro('')
    const res = await fetch('/api/admin/aniversariantes')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setLista(d.lista || [])
  }
  useEffect(() => { load() }, [])

  async function removerFoto(instagram: string) {
    if (!window.confirm(`Remover a foto de @${instagram}? A pessoa continua na lista, com o Pokémon ou a inicial no lugar.`)) return
    setOcupado(true); setErro(''); setOk('')
    try {
      const res = await fetch('/api/admin/aniversariantes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'remover_foto', instagram }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
      setOk(d.arquivo_apagado ? `Foto de @${instagram} removida.` : `Foto de @${instagram} saiu da lista, mas o arquivo ficou no armazenamento. Veja o log.`)
      await load()
    } finally { setOcupado(false) }
  }

  const comFoto = (lista || []).filter(l => l.foto_url).length

  return (
    <AdminPage titulo="Aniversariantes" subtitulo="Poké Creators Club. Qualquer pessoa logada vê esta lista. Foto imprópria sai daqui na hora.">
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}
      {lista === null && !erro && <AdminVazio>Carregando...</AdminVazio>}

      {lista && (
        <div className="an-box">
          <div className="an-rotulo">Na lista: {lista.length} · com foto: {comFoto}</div>
          {lista.length === 0 && <AdminVazio>Ninguém entrou na lista ainda.</AdminVazio>}
          <div className="an-grid">
            {lista.map(l => (
              <div key={l.instagram} className="an-item">
                {l.foto_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.foto_url} alt={`Foto de @${l.instagram}`} className="an-foto" />
                  : <span className="an-foto an-sem">{l.instagram.slice(0, 1).toUpperCase()}</span>}
                <div className="an-tx">
                  <a href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noopener noreferrer">@{l.instagram}</a>
                  <span>{dm(l.dia, l.mes)}</span>
                </div>
                {l.foto_url && <button type="button" className="an-btn" disabled={ocupado} onClick={() => removerFoto(l.instagram)}>Remover foto</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .an-box{border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:16px;display:flex;flex-direction:column;gap:12px}
        .an-rotulo{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--bx-text-3)}
        .an-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
        .an-item{display:flex;align-items:center;gap:10px;background:var(--bx-surface);border:1px solid var(--bx-border);border-radius:12px;padding:12px 14px;min-width:0}
        .an-foto{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none;background:var(--bx-surface-3)}
        .an-sem{display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:var(--bx-text-2)}
        .an-tx{flex:1;min-width:0;display:flex;flex-direction:column;font-size:13px}
        .an-tx a{color:var(--ac-1);text-decoration:none;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .an-tx span{color:var(--bx-text-3)}
        .an-btn{min-height:44px;padding:0 12px;border-radius:8px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.12);color:var(--bx-red);font:inherit;font-size:12px;font-weight:700;cursor:pointer;flex:none}
        .an-btn:disabled{opacity:.45;cursor:default}
      `}</style>
    </AdminPage>
  )
}
