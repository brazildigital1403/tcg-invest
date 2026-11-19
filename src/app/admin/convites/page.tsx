'use client'

// Admin — convite de grupo dos criadores. Um link so, sem prazo: /criadores (o convite padrao,
// codigo "criadores"); /criadores?c=<codigo> segue abrindo qualquer convite que exista.
// Mostra o link, as vagas e o funil por etapa, quem entrou (com cartas na colecao, perfil
// publico e pedido de parceria) e liga/desliga ou amplia o convite. Nao cria convite novo:
// o Du decidiu em 19/11/2026 que ficar criando link para criador nao faz sentido.
// O pedido de parceria so aparece aqui: o cupom sai em /admin/parceiros.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { IconCopy } from '@/components/ui/Icons'
import { CONVITE_PADRAO, semPrazo } from '@/lib/convitesGrupoPrazo'

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

/** O convite padrao abre em /criadores; os outros, com o codigo no link. */
const caminho = (codigo: string) => (codigo === CONVITE_PADRAO ? '/criadores' : `/criadores?c=${codigo}`)

export default function AdminConvitesPage() {
  const [convites, setConvites] = useState<Convite[] | null>(null)
  const [resgates, setResgates] = useState<Resgate[]>([])
  const [erro, setErro] = useState('')
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
    const link = `${window.location.origin}${caminho(codigo)}`
    navigator.clipboard?.writeText(link).then(() => { setCopiado(codigo); setTimeout(() => setCopiado(''), 1500) }).catch(() => {})
  }

  return (
    <div className="cg-page">
      <style>{CSS}</style>
      <div className="cg-head">
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 className="cg-h1">Convites de grupo</h1>
          <p className="cg-sub">Um link só para criadores, com 1 ano de Pro por resgate. Sem prazo: o limite são as vagas.</p>
        </div>
      </div>

      {erro && <p className="cg-erro">{erro}</p>}

      {convites === null ? <p className="cg-sub">Carregando...</p> : convites.length === 0 ? <p className="cg-sub">Nenhum convite ainda.</p> : convites.map(c => {
        const sem = semPrazo(c.expira_em)
        const vencido = !sem && Date.parse(c.expira_em) <= Date.now()
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
                <div className="cg-sub">{caminho(c.codigo)}{sem ? '' : ` · até ${dataHora(c.expira_em)}`} · {c.usos} de {c.max_usos} vagas</div>
              </div>
              <button className="cg-btn2" onClick={() => copiar(c.codigo)}><IconCopy size={14} color="currentColor" />{copiado === c.codigo ? 'Copiado' : 'Copiar link'}</button>
              {c.ativo
                ? <button className="cg-btn2" onClick={() => mudar(c.id, { ativo: false }, 'Desligar o convite? Quem abrir o link verá "Este convite encerrou". Quem já resgatou mantém o Pro.')}>Desligar</button>
                : <button className="cg-btn2" onClick={() => mudar(c.id, { ativo: true })}>Religar</button>}
              {!sem && <button className="cg-btn2" onClick={() => mudar(c.id, { mais_dias: 7 })}>+7 dias</button>}
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
.cg-page{max-width:1100px;margin:0 auto;padding:32px 24px}
@media (max-width:640px){.cg-page{padding:20px 16px}}
.cg-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.cg-h1{font-size:26px;font-weight:800;letter-spacing:-.03em;margin:0 0 4px;color:var(--bx-text)}
.cg-sub{font-size:12.5px;color:var(--bx-text-3);margin:6px 0 0}
.cg-sub a{color:var(--ac-1)}
.cg-erro{font-size:13px;color:var(--bx-red);margin:0 0 12px}
.cg-btn2{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border-radius:10px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:opacity .15s ease,background .15s ease;background:var(--bx-surface-2);color:var(--bx-text-2);border:1px solid var(--bx-border-2)}
.cg-btn2:hover{background:var(--bx-surface-3)}
.cg-box{background:var(--bx-surface);border:1px solid var(--bx-border);border-radius:12px;padding:16px;margin-bottom:16px}
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
