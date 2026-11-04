'use client'

// Admin do Amigo Secreto: a edicao em curso, quem entrou, quem esta com o
// perfil incompleto, o botao de sortear e o avanco de fase. O admin NAO ve
// os pares (quem tirou quem) pela tela: isso so no banco, se precisar.

import { useEffect, useState } from 'react'
import { dataCurta, dataHora } from '@/lib/amigoSecreto'

type Edicao = {
  slug: string; nome: string; teto_cents: number; estado: string; minimo: number; feed_ligado: boolean
  inscricoes_ate: string; sorteio_em: string; postar_ate: string; revelacao_em: string; dados_apagados_em: string | null
}
type Participante = {
  instagram: string; whatsapp: string | null; nome_completo: string | null; pokemon: string | null
  cidade: string | null; uf: string | null; created_at: string; email: string | null
  completo: boolean; tem_par: boolean; postado_em: string | null; rastreio: string | null; recebido_em: string | null; quer_revelar: boolean
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
      setOk(corpo.acao === 'sortear' ? `Sorteio feito: ${d.n} pares.` : corpo.acao === 'remover' ? `@${corpo.instagram} removido.` : 'Fase atualizada.')
      await load()
    } finally { setOcupado(false) }
  }

  const incompletos = lista.filter(p => !p.completo)
  const postaram = lista.filter(p => p.postado_em).length
  const receberam = lista.filter(p => p.recebido_em).length

  return (
    <div className="am">
      <div className="am-head">
        <div>
          <h1 className="am-h1">Amigo Secreto</h1>
          <p className="am-sub">Poké Creators Club. O admin não vê os pares; o sorteio é anônimo até no banco (só por SQL).</p>
        </div>
      </div>

      {erro && <div className="am-erro">{erro}</div>}
      {ok && <div className="am-ok">{ok}</div>}

      {edicao === undefined && <p className="am-sub">Carregando...</p>}
      {edicao === null && <div className="am-box">Nenhuma edição com o slug atual. Crie a linha em amigo_secreto_edicoes.</div>}

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
              <p className="am-sub">O sorteio só libera com todo mundo completo (endereço e desejo) e pelo menos {Math.max(3, edicao.minimo)} participantes.</p>
            )}
          </div>

          <div className="am-box">
            <div className="am-title">Participantes ({lista.length})</div>
            <div className="am-scroll">
              <table className="am-table">
                <thead><tr><th>@</th><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Cidade</th><th>Perfil</th><th>Postou</th><th>Recebeu</th><th>Entrou</th>{edicao.estado === 'inscricoes' && <th></th>}</tr></thead>
                <tbody>
                  {lista.map(p => (
                    <tr key={p.instagram}>
                      <td><a href={`https://instagram.com/${p.instagram}`} target="_blank" rel="noopener noreferrer">@{p.instagram}</a></td>
                      <td>{p.nome_completo || 'sem'}</td>
                      <td>{p.email || 'sem'}</td>
                      <td>{p.whatsapp || 'sem'}</td>
                      <td>{p.cidade ? `${p.cidade}/${p.uf}` : 'sem'}</td>
                      <td>{p.completo ? 'completo' : <span className="am-warn">incompleto</span>}</td>
                      <td>{p.postado_em ? `${dataCurta(p.postado_em)}${p.rastreio ? ` · ${p.rastreio}` : ''}` : 'sem'}</td>
                      <td>{p.recebido_em ? dataCurta(p.recebido_em) : 'sem'}</td>
                      <td>{dataCurta(p.created_at)}</td>
                      {edicao.estado === 'inscricoes' && <td><button type="button" className="am-btn2 am-sm" disabled={ocupado} onClick={() => acao({ acao: 'remover', instagram: p.instagram }, `Remover @${p.instagram} desta edição? A conta Bynx continua; só a inscrição sai.`)}>Remover</button></td>}
                    </tr>
                  ))}
                  {lista.length === 0 && <tr><td colSpan={10}>Ninguém entrou ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`
        .am{display:flex;flex-direction:column;gap:16px}
        .am-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .am-h1{font-size:22px;font-weight:800;margin:0}
        .am-sub{font-size:13px;color:var(--bx-text-3);margin:4px 0 0}
        .am-box{border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:16px;display:flex;flex-direction:column;gap:12px}
        .am-title{font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
        .am-tag{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:999px;background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1)}
        .am-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;font-size:13px}
        .am-grid b{display:block;font-size:11px;color:var(--bx-text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
        .am-acoes{display:flex;gap:8px;flex-wrap:wrap}
        .am-btn{min-height:40px;padding:0 16px;border-radius:10px;border:0;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;cursor:pointer}
        .am-btn:disabled{opacity:.45;cursor:default}
        .am-btn2{min-height:40px;padding:0 16px;border-radius:10px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text);font:inherit;font-weight:700;cursor:pointer}
        .am-sm{min-height:32px;padding:0 10px;font-size:12px;font-weight:600;color:var(--bx-red)}
        .am-btn2:disabled{opacity:.45;cursor:default}
        .am-erro{font-size:13px;color:var(--bx-red);background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 12px}
        .am-ok{font-size:13px;color:var(--bx-green);background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.25);border-radius:10px;padding:10px 12px}
        .am-warn{color:var(--ac-1);font-weight:700}
        .am-scroll{overflow-x:auto}
        .am-table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}
        .am-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--bx-text-3);padding:6px 8px;border-bottom:1px solid var(--bx-border)}
        .am-table td{padding:8px;border-bottom:1px solid var(--bx-border)}
        .am-table a{color:var(--ac-1);text-decoration:none}
      `}</style>
    </div>
  )
}
