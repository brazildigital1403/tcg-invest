'use client'

// Admin do Amigo Secreto: a edicao em curso, quem entrou, quem esta com o
// perfil incompleto, o botao de sortear e o avanco de fase. O admin NAO ve
// os pares (quem tirou quem) pela tela: isso so no banco, se precisar.

import { useEffect, useState } from 'react'
import { dataCurta, dataHora } from '@/lib/amigoSecreto'
import { AdminPage, AdminVazio, AdminFaixa } from '@/components/admin/AdminPage'

type Edicao = {
  slug: string; nome: string; teto_cents: number; estado: string; minimo: number; feed_ligado: boolean
  inscricoes_ate: string; sorteio_em: string; postar_ate: string; revelacao_em: string; dados_apagados_em: string | null
}
type Participante = {
  instagram: string; whatsapp: string | null; nome_completo: string | null; pokemon: string | null
  cidade: string | null; uf: string | null; created_at: string; email: string | null
  completo: boolean; cpf_ok: boolean; tem_par: boolean; postado_em: string | null; rastreio: string | null; recebido_em: string | null; quer_revelar: boolean
}

export default function AdminAmigoSecretoPage() {
  const [edicao, setEdicao] = useState<Edicao | null | undefined>(undefined)
  const [lista, setLista] = useState<Participante[]>([])
  const [mensagens, setMensagens] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function load() {
    setErro('')
    const res = await fetch('/api/admin/amigo-secreto')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setEdicao(d.edicao || null); setLista(d.participantes || []); setMensagens(d.mensagens)
  }
  useEffect(() => { load() }, [])

  async function acao(corpo: Record<string, unknown>, confirmar: string) {
    if (!window.confirm(confirmar)) return
    setOcupado(true); setErro(''); setOk('')
    try {
      const res = await fetch('/api/admin/amigo-secreto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
      setOk(corpo.acao === 'sortear' ? `Sorteio feito: ${d.n} pares. E-mail "A pokébola abriu": ${d.emails?.enviados ?? 0} enviados${d.emails?.falhas ? `, ${d.emails.falhas < 0 ? 'falhou' : `${d.emails.falhas} falharam`}` : ''}.` : corpo.acao === 'remover' ? `@${corpo.instagram} removido.` : 'Fase atualizada.')
      await load()
    } finally { setOcupado(false) }
  }

  const incompletos = lista.filter(p => !p.completo)
  const postaram = lista.filter(p => p.postado_em).length
  const receberam = lista.filter(p => p.recebido_em).length

  return (
    <AdminPage titulo="Amigo Secreto" subtitulo="Poké Creators Club. O admin não vê os pares; o sorteio é anônimo até no banco (só por SQL).">
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}

      {edicao === undefined && <AdminVazio>Carregando...</AdminVazio>}
      {edicao === null && <AdminVazio>Nenhuma edição com o slug atual. Crie a linha em amigo_secreto_edicoes.</AdminVazio>}

      {edicao && (
        <>
          <div className="am-box">
            <div className="am-title">{edicao.nome} <span className="am-tag">{edicao.estado}</span></div>
            <div className="am-grid">
              <div><b>Inscrições até</b>{dataHora(edicao.inscricoes_ate)}</div>
              <div><b>Sorteio</b>{dataHora(edicao.sorteio_em)}</div>
              <div><b>Postar até</b>{dataCurta(edicao.postar_ate)}</div>
              <div><b>Revelação</b>{dataCurta(edicao.revelacao_em)}</div>
              <div><b>Teto</b>R$ {(edicao.teto_cents / 100).toFixed(0)}</div>
              <div><b>Mínimo</b>{edicao.minimo}</div>
              <div><b>Participantes</b>{lista.length}</div>
              <div><b>Incompletos</b>{incompletos.length}</div>
              <div><b>Postaram</b>{postaram}</div>
              <div><b>Receberam</b>{receberam}</div>
              <div><b>Recados no mural</b>{mensagens ?? '...'}</div>
              <div><b>Dados apagados</b>{edicao.dados_apagados_em ? dataCurta(edicao.dados_apagados_em) : 'não'}</div>
            </div>
            <div className="am-acoes">
              {edicao.estado === 'inscricoes' && (
                <button className="am-btn" disabled={ocupado || incompletos.length > 0 || lista.length < Math.max(3, edicao.minimo)} onClick={() => acao({ acao: 'sortear' }, `Sortear agora com ${lista.length} participantes? Não dá para desfazer.`)}>
                  Sortear agora
                </button>
              )}
              {edicao.estado === 'sorteado' && <button className="am-btn2" disabled={ocupado} onClick={() => acao({ acao: 'estado', estado: 'entregas' }, 'Marcar a fase de entregas?')}>Fase: entregas</button>}
              {(edicao.estado === 'sorteado' || edicao.estado === 'entregas') && <button className="am-btn2" disabled={ocupado} onClick={() => acao({ acao: 'estado', estado: 'encerrado' }, 'Encerrar a edição?')}>Encerrar edição</button>}
            </div>
            {edicao.estado === 'inscricoes' && (incompletos.length > 0 || lista.length < Math.max(3, edicao.minimo)) && (
              <p className="am-nota">O sorteio só libera com todo mundo completo (endereço e desejo) e pelo menos {Math.max(3, edicao.minimo)} participantes.</p>
            )}
          </div>

          <div className="am-box">
            <div className="am-title">Participantes ({lista.length})</div>
            <div className="am-scroll">
              <table className="am-table">
                <thead><tr><th>Instagram</th><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Cidade</th><th>Perfil</th><th>CPF</th><th>Postou</th><th>Recebeu</th><th>Entrou</th>{edicao.estado === 'inscricoes' && <th></th>}</tr></thead>
                <tbody>
                  {lista.map(p => (
                    <tr key={p.instagram}>
                      <td><a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer">@{p.instagram}</a></td>
                      <td>{p.nome_completo || '—'}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.whatsapp || '—'}</td>
                      <td>{p.cidade ? `${p.cidade}/${p.uf}` : '—'}</td>
                      <td>{p.completo ? 'completo' : <span className="am-warn">incompleto</span>}</td>
                      <td>{p.cpf_ok ? 'preenchido' : <span className="am-warn">pendente</span>}</td>
                      <td>{p.postado_em ? `${dataCurta(p.postado_em)}${p.rastreio ? ` · ${p.rastreio}` : ''}` : '—'}</td>
                      <td>{p.recebido_em ? dataCurta(p.recebido_em) : '—'}</td>
                      <td>{dataCurta(p.created_at)}</td>
                      {edicao.estado === 'inscricoes' && <td><button type="button" className="am-btn2 am-sm" disabled={ocupado} onClick={() => acao({ acao: 'remover', instagram: p.instagram }, `Remover @${p.instagram} desta edição? A conta Bynx continua; só a inscrição sai.`)}>Remover</button></td>}
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={11}>Ninguém entrou ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        .am-nota{font-size:13px;line-height:1.5;color:var(--bx-text-3);margin:0}
        .am-box{border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:16px;display:flex;flex-direction:column;gap:12px}
        .am-title{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
        .am-tag{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:4px 10px;border-radius:999px;background:rgba(var(--ac-1-rgb),.12);border:1px solid rgba(var(--ac-1-rgb),.28);color:var(--ac-1)}
        .am-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;font-size:13px}
        .am-grid b{display:block;font-size:11px;color:var(--bx-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
        .am-acoes{display:flex;gap:8px;flex-wrap:wrap}
        .am-btn{min-height:44px;padding:0 20px;border-radius:12px;border:0;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-size:15px;font-weight:800;cursor:pointer;transition:transform .15s ease}
        .am-btn:hover{transform:translateY(-2px)}
        .am-btn:disabled{opacity:.45;cursor:default;transform:none}
        .am-btn2{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
        .am-sm{min-height:44px;padding:0 12px;border-radius:8px;font-size:12px;font-weight:700;color:var(--bx-red);border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.12)}
        .am-btn2:disabled{opacity:.45;cursor:default}
        .am-warn{color:var(--ac-1);font-weight:700}
        .am-scroll{overflow-x:auto;border:1px solid var(--bx-border);border-radius:14px}
        .am-table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}
        .am-table th{text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--bx-text-3);padding:11px 10px;border-bottom:1px solid var(--bx-border)}
        .am-table td{padding:11px 10px;border-top:1px solid rgba(255,255,255,.05)}
        .am-table tr:first-child td{border-top:0}
        @media (prefers-reduced-motion: reduce){.am-btn{transition:none}.am-btn:hover{transform:none}}
        .am-table a{color:var(--ac-1);text-decoration:none}
      `}</style>
    </AdminPage>
  )
}
