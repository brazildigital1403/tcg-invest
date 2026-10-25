'use client'

// Admin — convites de grupo (/criadores?c=<codigo>, N dias de Pro).
// Cria o link, mostra o funil por etapa e quem entrou (com cartas na colecao,
// perfil publico e pedido de parceria), e liga/desliga ou estende o convite.
// O pedido de parceria so aparece aqui: o cupom sai em /admin/parceiros.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconCopy, IconPlus, IconClose } from '@/components/ui/Icons'

type Convite = {
  id: string; codigo: string; nome: string; campanha: string; dias_pro: number
  max_usos: number; usos: number; expira_em: string; ativo: boolean; criado_em: string
  funil: Record<string, number>
}
type Resgate = {
  convite_id: string; user_id: string; nome: string; email: string; perfil_publico: boolean
  conta_nova: boolean; pro_ate: string; instagram: string | null; quer_parceria: boolean
  parceria_pedida_em: string | null; resgatado_em: string; cartas: number
}

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
const data = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

const FORM = { codigo: 'criadores-out26', nome: 'Grupo de criadores', max_usos: '50', dias_validade: '14' }

export default function AdminConvitesPage() {
  const [convites, setConvites] = useState<Convite[] | null>(null)
  const [resgates, setResgates] = useState<Resgate[]>([])
  const [erro, setErro] = useState('')
  const [form, setForm] = useState(FORM)
  const [formAberto, setFormAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState('')

  async function load() {
    setErro('')
    const res = await fetch('/api/admin/convites-grupo')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setConvites(d.convites || [])
    setResgates(d.resgates || [])
  }
  useEffect(() => { load() }, [])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true); setErro('')
    try {
      const res = await fetch('/api/admin/convites-grupo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: form.codigo, nome: form.nome, campanha: form.codigo, max_usos: Number(form.max_usos), dias_validade: Number(form.dias_validade) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
      setFormAberto(false); setForm(FORM)
      await load()
    } finally { setSalvando(false) }
  }

  async function mudar(id: string, corpo: Record<string, unknown>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return
    const res = await fetch('/api/admin/convites-grupo', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...corpo }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    await load()
  }

  function copiar(codigo: string) {
    const link = `${window.location.origin}/criadores?c=${codigo}`
    navigator.clipboard?.writeText(link).then(() => { setCopiado(codigo); setTimeout(() => setCopiado(''), 1500) }).catch(() => {})
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <style>{CSS}</style>
      <div className="cg-head">
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 className="cg-h1">Convites de grupo</h1>
          <p className="cg-sub">Link único com ano de Pro. Hoje: criadores.</p>
        </div>
        <button className={formAberto ? 'cg-btn2' : 'cg-btn'} onClick={() => setFormAberto(v => !v)}>
          {formAberto ? <><IconClose size={14} color="currentColor" /> Fechar</> : <><IconPlus size={14} color="currentColor" /> Novo convite</>}
        </button>
      </div>

      {erro && <p className="cg-erro">{erro}</p>}

      {formAberto && (
        <form onSubmit={criar} className="cg-box cg-form">
          <label>Código do link<input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} /></label>
          <label>Nome interno<input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></label>
          <label>Vagas<input type="number" min={1} max={1000} value={form.max_usos} onChange={e => setForm(f => ({ ...f, max_usos: e.target.value }))} /></label>
          <label>Prazo do link (dias)<input type="number" min={1} max={90} value={form.dias_validade} onChange={e => setForm(f => ({ ...f, dias_validade: e.target.value }))} /></label>
          <button className="cg-btn" disabled={salvando}>{salvando ? 'Criando...' : 'Criar convite'}</button>
          <p className="cg-sub" style={{ gridColumn: '1 / -1' }}>Cada resgate dá 365 dias de Pro. Assinante pago fica fora.</p>
        </form>
      )}

      {convites === null ? <p className="cg-sub">Carregando...</p> : convites.length === 0 ? <p className="cg-sub">Nenhum convite ainda.</p> : convites.map(c => {
        const vencido = Date.parse(c.expira_em) <= Date.now()
        const cheio = c.usos >= c.max_usos
        const status = !c.ativo ? 'Desligado' : vencido ? 'Vencido' : cheio ? 'Lotado' : 'No ar'
        const lista = resgates.filter(r => r.convite_id === c.id)
        const ativados = lista.filter(r => r.cartas >= 10).length
        const etapas: [string, number][] = [
          ['Visitas', c.funil.visita || 0], ['Toques no botão', c.funil.cta || 0],
          ['Envios', c.funil.envio || 0], ['Resgates', c.usos], ['Com 10+ cartas', ativados],
        ]
        return (
          <section key={c.id} className="cg-box">
            <div className="cg-row">
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="cg-title">{c.nome} <span className={`cg-tag${status === 'No ar' ? ' on' : ''}`}>{status}</span></div>
                <div className="cg-sub">/criadores?c={c.codigo} · até {dataHora(c.expira_em)} · {c.usos} de {c.max_usos} vagas</div>
              </div>
              <button className="cg-btn2" onClick={() => copiar(c.codigo)}><IconCopy size={14} color="currentColor" />{copiado === c.codigo ? 'Copiado' : 'Copiar link'}</button>
              {c.ativo
                ? <button className="cg-btn2" onClick={() => mudar(c.id, { ativo: false }, 'Desligar o convite? Quem abrir o link verá "Este convite encerrou". Quem já resgatou mantém o Pro.')}>Desligar</button>
                : <button className="cg-btn2" onClick={() => mudar(c.id, { ativo: true })}>Religar</button>}
              <button className="cg-btn2" onClick={() => mudar(c.id, { mais_dias: 7 })}>+7 dias</button>
              <button className="cg-btn2" onClick={() => mudar(c.id, { max_usos: c.max_usos + 10 })}>+10 vagas</button>
            </div>
            <div className="cg-funil">
              {etapas.map(([k, v]) => <div key={k}><b>{v}</b><span>{k}</span></div>)}
            </div>
            {c.funil.erro ? <p className="cg-sub">Erros no cadastro: {c.funil.erro}</p> : null}
            {lista.length > 0 && (
              <div className="cg-table">
                <table>
                  <thead><tr><th>Quem</th><th>Entrou</th><th>Cartas</th><th>Perfil</th><th>Parceria</th><th>Pro até</th></tr></thead>
                  <tbody>
                    {lista.map(r => (
                      <tr key={r.user_id}>
                        <td><b>{r.nome || '—'}</b><small>{r.email}</small></td>
                        <td>{dataHora(r.resgatado_em)}<small>{r.conta_nova ? 'Conta nova' : 'Já tinha conta'}</small></td>
                        <td>{r.cartas}</td>
                        <td>{r.perfil_publico ? 'Público' : '—'}</td>
                        <td>{r.quer_parceria ? <><b>@{r.instagram}</b><small>{r.parceria_pedida_em ? dataHora(r.parceria_pedida_em) : ''}</small></> : '—'}</td>
                        <td>{data(r.pro_ate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {lista.some(r => r.quer_parceria) && (
              <p className="cg-sub">Para aprovar um pedido de parceria, crie o cupom em <Link href="/admin/parceiros">Parceiros</Link> com o e-mail da conta.</p>
            )}
          </section>
        )
      })}
    </div>
  )
}

const CSS = `
.cg-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.cg-h1{font-size:26px;font-weight:800;letter-spacing:-.03em;margin:0 0 4px;color:var(--bx-text)}
.cg-sub{font-size:12.5px;color:var(--bx-text-3);margin:6px 0 0}
.cg-sub a{color:var(--ac-1)}
.cg-erro{font-size:13px;color:var(--bx-red);margin:0 0 12px}
.cg-btn,.cg-btn2{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:opacity .15s ease,background .15s ease}
.cg-btn{background:var(--ac-grad);color:var(--bx-brand-ink);border:1px solid transparent}
.cg-btn:disabled{opacity:.6}
.cg-btn2{background:var(--bx-surface-2);color:var(--bx-text-2);border:1px solid var(--bx-border-2)}
.cg-btn2:hover{background:var(--bx-surface-3)}
.cg-box{background:var(--bx-surface);border:1px solid var(--bx-border);border-radius:12px;padding:16px;margin-bottom:16px}
.cg-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end}
.cg-form label{display:flex;flex-direction:column;gap:6px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text-3)}
.cg-form input{height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-bg-elev);color:var(--bx-text);font:inherit;font-size:14px;text-transform:none;letter-spacing:0}
.cg-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cg-title{font-size:16px;font-weight:800;color:var(--bx-text);display:flex;align-items:center;gap:8px}
.cg-tag{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:var(--bx-surface-3);color:var(--bx-text-3)}
.cg-tag.on{background:rgba(34,197,94,.14);color:var(--bx-green)}
.cg-funil{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:14px}
.cg-funil div{background:var(--bx-surface-2);border:1px solid var(--bx-border);border-radius:10px;padding:10px 12px}
.cg-funil b{display:block;font-size:20px;font-weight:800;color:var(--bx-text)}
.cg-funil span{font-size:11.5px;color:var(--bx-text-3)}
.cg-table{overflow-x:auto;margin-top:14px}
.cg-table table{width:100%;border-collapse:collapse;font-size:13px;color:var(--bx-text-2)}
.cg-table th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text-3);padding:8px;border-bottom:1px solid var(--bx-border)}
.cg-table td{padding:8px;border-bottom:1px solid var(--bx-border);vertical-align:top;white-space:nowrap}
.cg-table td b{color:var(--bx-text);font-weight:700}
.cg-table td small{display:block;font-size:11.5px;color:var(--bx-text-3)}
`
