'use client'

// Feed do Club no /admin (27/11/2026, pedido do Du). So o Du entra aqui. Mostra cada post do feed
// com o estado da capa (capturada de hora em hora pela Mia Servidor), quantas pessoas apoiaram e as
// denuncias abertas; a cota de capas de hoje e o freio de cada rede. Modera pela mesma funcao que a
// organizacao usa dentro do feed. Nada carrega imagem da rede: a capa vem do nosso bucket.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminFaixa, AdminPage, AdminVazio } from '@/components/admin/AdminPage'
import { supabase } from '@/lib/supabaseClient'
import { BUCKET_CAPAS } from '@/lib/pcc/trends'
import { FORMATOS, MOTIVOS_DENUNCIA, MOTIVOS_TIRAR, REDES, TEMAS, linkFeed, motivoFora, type Formato, type MotivoTirar, type Rede, type Tema } from '@/lib/pcc/feed'

type Post = {
  id: string; arroba: string | null; rede: Rede; formato: Formato; tema: Tema | null; url: string; feed_em: string
  oculto: boolean; oculto_motivo: string | null; oculto_nota: string | null; conferir_arroba: string | null
  capa: { path: string | null; status: 'pendente' | 'ok' | 'falhou'; tentativas: number; tentou_em: string | null; erro: string | null }
  apoiaram: number
  denuncias: Record<string, number> | null
}
type Freio = { rede: Rede; bloqueado_ate: string | null; motivo: string | null; ocorrencias: string[] }
type Dados = { lista: Post[]; cota: Record<string, number>; freio: Freio[]; tetos: { rede: number; total: number } }
type Filtro = 'todos' | 'capa_falhou' | 'capa_pendente' | 'denunciados' | 'fora' | 'conferir'

const quando = (iso: string | null) => iso
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  : ''
const urlCapa = (path: string) => supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl
const ESTADO_CAPA: Record<Post['capa']['status'], string> = { ok: 'Capa capturada', pendente: 'Capa na fila', falhou: 'Capa falhou' }

export default function AdminClubFeedPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [tirando, setTirando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<MotivoTirar>('spam')
  const [nota, setNota] = useState('')
  // Hora da ultima leitura: decide se o freio de cada rede ainda vale (fora do render, que tem que ser puro).
  const [lidoEm, setLidoEm] = useState(0)
  const [lendo, setLendo] = useState(false)

  const load = useCallback(async () => {
    setErro(''); setLendo(true)
    const res = await fetch('/api/admin/club-feed')
    const d = await res.json().catch(() => ({}))
    setLendo(false)
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return }
    setDados(d as Dados)
    setLidoEm(Date.now())
  }, [])
  // Busca ao abrir; o setErro('') do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function enviar(chave: string, corpo: object, msg: string) {
    setOcupado(chave); setErro(''); setOk('')
    const res = await fetch('/api/admin/club-feed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const d = await res.json().catch(() => ({}))
    setOcupado(null)
    if (!res.ok) { setErro(d.error || `Erro ${res.status}`); return false }
    setOk(msg)
    await load()
    return true
  }

  const lista = useMemo(() => dados?.lista ?? [], [dados])
  const conta = useMemo(() => ({
    todos: lista.length,
    capa_falhou: lista.filter(p => p.capa.status === 'falhou').length,
    capa_pendente: lista.filter(p => p.capa.status === 'pendente').length,
    denunciados: lista.filter(p => p.denuncias).length,
    fora: lista.filter(p => p.oculto).length,
    conferir: lista.filter(p => p.conferir_arroba && !p.oculto).length,
  }), [lista])
  const visiveis = lista.filter(p =>
    filtro === 'todos' ? true
      : filtro === 'capa_falhou' ? p.capa.status === 'falhou'
      : filtro === 'capa_pendente' ? p.capa.status === 'pendente'
      : filtro === 'denunciados' ? !!p.denuncias
      : filtro === 'fora' ? p.oculto
      : !!p.conferir_arroba && !p.oculto)

  const freioAtivo = (dados?.freio ?? []).filter(f => f.bloqueado_ate && new Date(f.bloqueado_ate).getTime() > lidoEm)

  // Saude da tarefa da Mia Servidor: a ultima tentativa de captura e a rodada mais recente que se ve
  // daqui. Post de rede liberada esperando ha mais de 2 h sem nenhuma tentativa = a tarefa pode ter parado.
  const ultimaRodada = lista.reduce<string | null>((m, p) => p.capa.tentou_em && (!m || p.capa.tentou_em > m) ? p.capa.tentou_em : m, null)
  const parados = lista.filter(p => p.capa.status === 'pendente' && p.capa.tentativas === 0 && !p.oculto
    && !freioAtivo.some(f => f.rede === p.rede) && lidoEm - new Date(p.feed_em).getTime() > 2 * 3600_000).length

  return (
    <AdminPage titulo="Feed do Club" largura="larga"
      subtitulo="Poké Creators Club. Os posts do feed, as capas que a Mia Servidor captura de hora em hora e as denúncias. A organização com o papel Feed modera pelo próprio feed; aqui você vê tudo e modera também."
      acao={<button type="button" className="cf-btn" disabled={lendo || !!ocupado} onClick={() => { setOk(''); load() }}>{lendo ? 'Atualizando...' : 'Atualizar'}</button>}>
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}
      {dados === null && !erro && <AdminVazio>Carregando...</AdminVazio>}

      {dados && (
        <>
          <section className="cf-grade" aria-label="Resumo">
            <div className="cf-num"><b>{conta.todos}</b><span>posts no feed</span></div>
            <div className="cf-num"><b>{conta.capa_pendente}</b><span>capa na fila</span></div>
            <div className={`cf-num${conta.capa_falhou ? ' alerta' : ''}`}><b>{conta.capa_falhou}</b><span>capa falhou</span></div>
            <div className={`cf-num${conta.denunciados ? ' alerta' : ''}`}><b>{conta.denunciados}</b><span>com denúncia aberta</span></div>
          </section>

          <section className="cf-box" aria-label="Capas">
            <div className="cf-t">Capas de hoje</div>
            <p className="cf-ajuda">Última rodada da Mia Servidor: {ultimaRodada ? quando(ultimaRodada) : 'nenhuma ainda'}.</p>
            {parados > 0 && (
              <AdminFaixa tom="erro">
                {parados === 1 ? '1 post espera' : `${parados} posts esperam`} há mais de 2 horas sem nenhuma tentativa de capa. A tarefa &quot;Bynx Capas Feed&quot; da Mia Servidor pode ter parado.
              </AdminFaixa>
            )}
            <div className="cf-redes">
              {(Object.keys(REDES) as Rede[]).map(r => {
                const f = freioAtivo.find(x => x.rede === r)
                return (
                  <div key={r} className={`cf-rede${f ? ' parada' : ''}`}>
                    <b>{REDES[r].nome}</b>
                    <span>{dados.cota[r] ?? 0} de {dados.tetos.rede}</span>
                    {f
                      ? <>
                          <small>Parada até {quando(f.bloqueado_ate)}{f.motivo ? ` · ${f.motivo}` : ''}</small>
                          <button type="button" className="cf-btn" disabled={!!ocupado}
                            onClick={() => window.confirm(`Liberar o ${REDES[r].nome} agora? Se o bloqueio for real, a captura volta a bater na rede e o freio liga de novo, por mais tempo.`)
                              && enviar(`freio-${r}`, { acao: 'liberar_freio', rede: r }, `${REDES[r].nome} liberado.`)}>Liberar</button>
                        </>
                      : <small>Liberada</small>}
                  </div>
                )
              })}
            </div>
            <p className="cf-ajuda">Total de hoje: {dados.cota.total ?? 0} de {dados.tetos.total}. Cada post tem até 3 tentativas, uma por hora; depois fica com a capa de texto.</p>
          </section>

          <div className="cf-filtros" role="group" aria-label="Filtrar posts">
            {([
              ['todos', 'Todos'], ['denunciados', 'Denunciados'], ['capa_falhou', 'Capa falhou'],
              ['capa_pendente', 'Capa na fila'], ['conferir', 'Conferir o @'], ['fora', 'Fora do feed'],
            ] as [Filtro, string][]).map(([id, rotulo]) => (
              <button key={id} type="button" className={`cf-chip${filtro === id ? ' on' : ''}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                {rotulo} <em>{conta[id]}</em>
              </button>
            ))}
          </div>

          {visiveis.length === 0 && <AdminVazio>{filtro === 'todos' ? 'Ninguém postou no feed ainda.' : 'Nenhum post neste filtro.'}</AdminVazio>}

          {visiveis.length > 0 && (
            <div className="cf-box cf-lista">
              {visiveis.map(p => {
                const href = linkFeed(p.url)
                return (
                  <article key={p.id} className="cf-item">
                    <div className="cf-capa">
                      {p.capa.path && p.capa.status === 'ok'
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={urlCapa(p.capa.path)} alt="" loading="lazy" />
                        : <span>{REDES[p.rede].nome}</span>}
                    </div>
                    <div className="cf-tx">
                      <b>@{p.arroba || 'sem @'} · {p.tema && p.tema !== 'outro' ? TEMAS[p.tema] : FORMATOS[p.formato]}</b>
                      <small>{REDES[p.rede].nome} · {quando(p.feed_em)} · {p.apoiaram === 1 ? '1 pessoa apoiou' : `${p.apoiaram} pessoas apoiaram`}</small>
                      <div className="cf-tags">
                        <span className={`cf-tag ${p.capa.status}`}>{ESTADO_CAPA[p.capa.status]}{p.capa.status !== 'ok' && p.capa.tentativas ? ` · ${p.capa.tentativas} de 3` : ''}</span>
                        {p.oculto && <span className="cf-tag falhou">Fora do feed: {motivoFora(p.oculto_motivo)}</span>}
                        {p.conferir_arroba && !p.oculto && <span className="cf-tag pendente">Vídeo de @{p.conferir_arroba}</span>}
                        {p.denuncias && Object.entries(p.denuncias).map(([m, n]) => (
                          <span key={m} className="cf-tag falhou">{n} {n === 1 ? 'denúncia' : 'denúncias'}: {MOTIVOS_DENUNCIA.find(x => x.m === m)?.rotulo ?? m}</span>
                        ))}
                      </div>
                      {p.capa.erro && p.capa.status !== 'ok' && <small className="cf-erro">Último erro da captura: {p.capa.erro}</small>}
                      {p.oculto_nota && <small>Nota interna: {p.oculto_nota}</small>}

                      <div className="cf-acoes">
                        {href && <a className="cf-btn" href={href} target="_blank" rel="noopener noreferrer">Abrir</a>}
                        {(p.capa.status === 'falhou' || (p.capa.status === 'pendente' && p.capa.tentativas > 0)) && (
                          <button type="button" className="cf-btn" disabled={!!ocupado}
                            onClick={() => enviar(`capa-${p.id}`, { acao: 'capa_de_novo', id: p.id }, 'Capa volta para a fila. A Mia Servidor tenta na próxima hora.')}>Tentar a capa de novo</button>
                        )}
                        {p.denuncias && !p.oculto && (
                          <button type="button" className="cf-btn" disabled={!!ocupado} onClick={() => enviar(`manter-${p.id}`, { acao: 'moderar', id: p.id, tipo: 'manter' }, 'Denúncias resolvidas. O post continua no feed.')}>Manter</button>
                        )}
                        {p.conferir_arroba && !p.oculto && (
                          <button type="button" className="cf-btn" disabled={!!ocupado} onClick={() => enviar(`arroba-${p.id}`, { acao: 'moderar', id: p.id, tipo: 'arroba_ok' }, '@ conferido.')}>O @ está certo</button>
                        )}
                        {p.oculto
                          ? <button type="button" className="cf-btn" disabled={!!ocupado} onClick={() => enviar(`devolver-${p.id}`, { acao: 'moderar', id: p.id, tipo: 'devolver' }, 'Post de volta ao feed.')}>Devolver ao feed</button>
                          : <button type="button" className="cf-btn pri" disabled={!!ocupado} onClick={() => { setTirando(tirando === p.id ? null : p.id); setMotivo('spam'); setNota('') }}>Tirar do feed</button>}
                      </div>

                      {tirando === p.id && (
                        <div className="cf-tirar">
                          <label className="cf-f"><span>Motivo (o autor vê)</span>
                            <select value={motivo} onChange={e => setMotivo(e.target.value as MotivoTirar)}>
                              {MOTIVOS_TIRAR.map(m => <option key={m.m} value={m.m}>{m.rotulo}</option>)}
                            </select>
                          </label>
                          <label className="cf-f"><span>Nota interna (opcional)</span>
                            <input value={nota} maxLength={300} onChange={e => setNota(e.target.value)} placeholder="Só a organização lê." />
                          </label>
                          <button type="button" className="cf-btn pri" disabled={!!ocupado}
                            onClick={async () => { if (await enviar(`tirar-${p.id}`, { acao: 'moderar', id: p.id, tipo: 'tirar', motivo, nota }, 'Post tirado do feed. Continua no portfólio da pessoa.')) setTirando(null) }}>
                            {ocupado === `tirar-${p.id}` ? 'Tirando...' : 'Confirmar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      <style>{`
        .cf-grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .cf-num{border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:12px;display:flex;flex-direction:column;gap:4px}
        .cf-num b{font-size:26px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--bx-text)}
        .cf-num span{font-size:12.5px;color:var(--bx-text-2)}
        .cf-num.alerta{border-color:rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.06)}
        .cf-box{border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);padding:16px;display:flex;flex-direction:column;gap:12px}
        .cf-t{font-size:15px;font-weight:700;color:var(--bx-text)}
        .cf-redes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
        .cf-rede{border:1px solid var(--bx-border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--bx-text-2)}
        .cf-rede b{color:var(--bx-text);font-size:14px}
        .cf-rede small{font-size:12px}
        .cf-rede.parada{border-color:color-mix(in srgb,var(--bx-red) 40%,transparent);background:color-mix(in srgb,var(--bx-red) 6%,transparent)}
        .cf-ajuda{margin:0;font-size:12.5px;color:var(--bx-text-2)}
        .cf-filtros{display:flex;gap:6px;flex-wrap:wrap}
        .cf-chip{min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease}
        .cf-chip em{font-style:normal;color:var(--bx-text-3);margin-left:4px}
        .cf-chip.on{background:rgba(var(--ac-1-rgb),.12);border-color:rgba(var(--ac-1-rgb),.5);color:var(--bx-text)}
        .cf-lista{gap:0;padding:0 16px}
        .cf-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--bx-border)}
        .cf-item:last-child{border-bottom:0}
        .cf-capa{width:54px;height:96px;flex:none;border-radius:8px;overflow:hidden;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--bx-text-3);text-align:center}
        .cf-capa img{width:100%;height:100%;object-fit:cover;display:block}
        .cf-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
        .cf-tx b{font-size:14px;color:var(--bx-text);overflow-wrap:anywhere}
        .cf-tx small{font-size:12.5px;color:var(--bx-text-2);overflow-wrap:anywhere}
        .cf-erro{color:var(--bx-red) !important}
        .cf-tags{display:flex;gap:6px;flex-wrap:wrap}
        .cf-tag{font-size:12px;font-weight:700;padding:3px 8px;border-radius:999px;border:1px solid var(--bx-border-2);color:var(--bx-text-2)}
        .cf-tag.ok{border-color:color-mix(in srgb,var(--bx-green) 40%,transparent);color:var(--bx-green)}
        .cf-tag.pendente{border-color:rgba(var(--ac-1-rgb),.45);color:var(--ac-1)}
        .cf-tag.falhou{border-color:color-mix(in srgb,var(--bx-red) 40%,transparent);color:var(--bx-red)}
        .cf-acoes{display:flex;gap:6px;flex-wrap:wrap}
        .cf-btn{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;text-decoration:none;transition:background .15s ease}
        .cf-btn:hover:not(:disabled){background:var(--bx-surface-2)}
        .cf-btn.pri{background:var(--ac-grad);border-color:transparent;color:var(--bx-brand-ink)}
        .cf-btn:disabled{opacity:.45;cursor:default}
        .cf-tirar{display:flex;flex-direction:column;gap:10px;border:1px dashed var(--bx-border-2);border-radius:10px;padding:12px}
        .cf-tirar .cf-btn{align-self:flex-start}
        .cf-f{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:700;color:var(--bx-text-2)}
        .cf-f select,.cf-f input{min-height:48px;border:1px solid var(--bx-border-2);border-radius:10px;padding:10px 12px;background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:16px;font-weight:400}
        @media (min-width:768px){
          .cf-grade{grid-template-columns:repeat(4,minmax(0,1fr))}
          .cf-redes{grid-template-columns:repeat(4,minmax(0,1fr))}
        }
        @media (prefers-reduced-motion:reduce){ .cf-chip,.cf-btn{transition:none} }
      `}</style>
    </AdminPage>
  )
}
