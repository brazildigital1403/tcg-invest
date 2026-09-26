'use client'

// Pagina do cliente: acompanhar um pedido de restauracao / pre-grading.
//
// O que a pessoa faz aqui depende do status:
//   orcado   -> ve o orcamento (com o motivo de cada carta recusada), le o
//               termo e aprova, ou recusa
//   aceito   -> ve o endereco e o guia de embalagem e informa o rastreio
//   depois   -> acompanha: custodia, fotos de entrada e saida, laudo, rastreio
// A leitura vem de GET /api/servicos/[id] (so o dono); as acoes usam as rotas
// /aceitar e /rastreio, que conferem dono e status no servidor.

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { authFetch } from '@/lib/authFetch'
import {
  STATUS_SERVICO, SERVICOS, TERMO_V1, GUIA_EMBALAGEM, CAMPOS_LAUDO, brl, numeroServico, fmtDataHoraBRT, turnoServico,
} from '@/lib/servicos'
import { IconCheck, IconClose, IconTruck, IconShield, IconWarning, IconBox } from '@/components/ui/Icons'

type Sol = {
  id: string; numero: number; servico: string; prazo: string; status: string
  valor_declarado_cents: number; orcamento_cents: number | null; seguro_cents: number | null
  frete_volta_cents: number | null; total_cents: number | null; orcamento_obs: string | null
  pago_em: string | null; termo_aceito_em: string | null; rastreio_ida: string | null; rastreio_volta: string | null; created_at: string
}
type Item = {
  id: string; nome: string; card_id: string | null; queixas: string[]; valor_declarado_cents: number
  custodia: string | null; aceito: boolean | null; recusa_motivo: string | null; laudo: Record<string, string> | null
}
type Evento = { id: string; status: string; nota: string | null; created_at: string }
type Midia = { id: string; item_id: string | null; tipo: string; mime: string; url: string | null }
type Dados = { solicitacao: Sol; itens: Item[]; eventos: Evento[]; midias: Midia[]; endereco: string | null }

// Linha de etapas: onde o pedido esta, em linguagem do cliente.
const ETAPAS = [
  { t: 'Orçamento', status: ['aguardando_orcamento', 'orcado'] },
  { t: 'Envio', status: ['aceito'] },
  { t: 'Na bancada', status: ['recebida', 'em_bancada', 'descansando'] },
  { t: 'Pronta', status: ['pronta'] },
  { t: 'A caminho', status: ['enviada'] },
  { t: 'Entregue', status: ['entregue'] },
]
const ROTULO_MIDIA: Record<string, string> = {
  cliente_frente: 'Sua foto · frente', cliente_verso: 'Sua foto · verso', cliente_extra: 'Sua foto',
  entrada_difusa: 'Entrada', entrada_rasante: 'Entrada · rasante', saida_difusa: 'Saída', saida_rasante: 'Saída · rasante',
  video_abertura: 'Abertura do pacote', embalagem: 'Embalagem', laudo: 'Laudo',
}
const reais = (c: number | null | undefined) => (c == null ? '—' : `R$ ${brl(c / 100)}`)

export default function ServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <AppLayout>
      <Pedido id={id} />
    </AppLayout>
  )
}

function Pedido({ id }: { id: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [termo, setTermo] = useState(false)
  const [rastreio, setRastreio] = useState('')

  const carregar = useCallback(async () => {
    try {
      const r = await authFetch(`/api/servicos/${id}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(r.status === 401 ? 'Entre na sua conta para ver este pedido.' : d.error || 'Não conseguimos abrir o pedido.'); return }
      setErro('')
      setDados(d)
    } catch { setErro('Sem conexão. Tente de novo em instantes.') }
  }, [id])
  useEffect(() => { carregar() }, [carregar])

  async function postar(rota: string, body: object, ok: string) {
    setOcupado(true); setMsg(null)
    try {
      const r = await authFetch(`/api/servicos/${id}/${rota}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ ok: false, t: d.error || 'Não deu certo. Tente de novo.' }); return }
      setMsg({ ok: true, t: ok })
      await carregar()
    } catch { setMsg({ ok: false, t: 'Sem conexão. Tente de novo.' }) }
    finally { setOcupado(false) }
  }

  if (erro) return <div className="sp"><style>{CSS}</style><div className="sp-card sp-vazio"><IconShield size={24} /><p>{erro}</p><Link className="sp-bt" href="/compras">Minhas compras</Link></div></div>
  if (!dados) return <div className="sp"><style>{CSS}</style><p className="sp-muted">Carregando...</p></div>

  const { solicitacao: s, itens, eventos, midias, endereco } = dados
  const etapaAtual = ETAPAS.findIndex(e => e.status.includes(s.status))
  const encerrado = turnoServico(s.status) === 'fim' && s.status !== 'entregue'
  const aceitas = itens.filter(i => i.aceito !== false)

  return (
    <div className="sp">
      <style>{CSS}</style>
      <PageHeader
        trilha={[INICIO, { name: 'Compras', href: '/compras' }, { name: numeroServico(s.numero), href: `/servico/${s.id}` }]}
        titulo={`${SERVICOS.find(x => x.id === s.servico)?.nome || 'Serviço'} ${numeroServico(s.numero)}`}
        selo={<span className={`sp-pill${encerrado ? ' sp-pill-fim' : ''}`}>{STATUS_SERVICO[s.status] || s.status}</span>}
        descricao={`Pedido feito em ${fmtDataHoraBRT.format(new Date(s.created_at))}. ${itens.length} ${itens.length === 1 ? 'carta' : 'cartas'}.`}
      />

      {!encerrado && (
        <ol className="sp-etapas" aria-label="Andamento do pedido">
          {ETAPAS.map((e, i) => (
            <li key={e.t} className={i < etapaAtual ? 'feito' : i === etapaAtual ? 'agora' : ''}>
              <span>{i < etapaAtual ? <IconCheck size={12} strokeWidth={2.6} /> : i + 1}</span>{e.t}
            </li>
          ))}
        </ol>
      )}

      {msg && <p className={msg.ok ? 'sp-ok' : 'sp-erro'} role="status">{msg.t}</p>}

      <div className="sp-grid">
        <div className="sp-col">

          {s.status === 'aguardando_orcamento' && (
            <section className="sp-card">
              <h2>Estamos analisando as suas fotos</h2>
              <p className="sp-muted">Você recebe o orçamento por e-mail e ele aparece aqui. Não envie a carta ainda: o endereço só aparece depois da aprovação.</p>
            </section>
          )}

          {s.status === 'orcado' && (
            <section className="sp-card sp-card-acao">
              <h2>Seu orçamento</h2>
              <dl className="sp-dl">
                <div><dt>Serviço</dt><dd>{reais(s.orcamento_cents)}</dd></div>
                {s.seguro_cents ? <div><dt>Seguro</dt><dd>{reais(s.seguro_cents)}</dd></div> : null}
                {s.frete_volta_cents ? <div><dt>Frete de volta</dt><dd>{reais(s.frete_volta_cents)}</dd></div> : null}
                <div className="sp-total"><dt>Total</dt><dd>{reais(s.total_cents)}</dd></div>
              </dl>
              {s.orcamento_obs && <p className="sp-obs">{s.orcamento_obs}</p>}
              {itens.some(i => i.aceito === false) && (
                <p className="sp-muted">{aceitas.length === 1 ? 'Uma carta entra' : `${aceitas.length} cartas entram`} no serviço. As recusadas estão abaixo, com o motivo.</p>
              )}
              <div className="sp-termo">
                <b>Termo de ciência</b>
                <ul>{TERMO_V1.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
              <label className="sp-chk">
                <input type="checkbox" checked={termo} onChange={e => setTermo(e.target.checked)} />
                <span>Li o termo e aprovo o orçamento de {reais(s.total_cents)}.</span>
              </label>
              <div className="sp-acoes">
                <button type="button" className="sp-bt sp-bt-pri" disabled={!termo || ocupado} onClick={() => postar('aceitar', { termo_aceito: true }, 'Orçamento aprovado. Veja abaixo como enviar a carta.')}>
                  Aprovar e ver o endereço
                </button>
                <button type="button" className="sp-bt sp-bt-perigo" disabled={ocupado} onClick={() => confirm('Recusar o orçamento? O pedido será encerrado.') && postar('aceitar', { recusar: true }, 'Orçamento recusado.')}>
                  Recusar orçamento
                </button>
              </div>
            </section>
          )}

          {s.status === 'aceito' && (
            <section className="sp-card sp-card-acao">
              <h2>Como enviar a sua carta</h2>
              {endereco ? (
                <div className="sp-endereco">
                  <span>Envie para</span>
                  <p>{endereco}</p>
                  <small>Escreva &quot;Pedido {numeroServico(s.numero)}&quot; do lado de fora do pacote.</small>
                </div>
              ) : (
                <p className="sp-aviso"><IconWarning size={15} /> O endereço de envio chega por e-mail ou WhatsApp em seguida.</p>
              )}
              <ol className="sp-guia">{GUIA_EMBALAGEM.map(g => <li key={g}>{g}</li>)}</ol>
              <div className="sp-rastreio">
                <label htmlFor="sp-rastreio">{s.rastreio_ida ? `Rastreio informado: ${s.rastreio_ida}` : 'Código de rastreio da postagem'}</label>
                <div>
                  <input id="sp-rastreio" value={rastreio} onChange={e => setRastreio(e.target.value.toUpperCase())} placeholder="AA123456789BR" maxLength={30} autoCapitalize="characters" />
                  <button type="button" className="sp-bt sp-bt-pri" disabled={ocupado || rastreio.replace(/\W/g, '').length < 8} onClick={async () => { await postar('rastreio', { codigo: rastreio }, 'Rastreio registrado.'); setRastreio('') }}>
                    {s.rastreio_ida ? 'Corrigir' : 'Informar'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {s.rastreio_volta && (
            <section className="sp-card">
              <h2><IconTruck size={18} /> Sua carta está a caminho</h2>
              <p className="sp-muted">Rastreio: <b className="sp-cod">{s.rastreio_volta}</b></p>
            </section>
          )}

          {midias.some(m => !m.item_id) && (
            <section className="sp-card">
              <h2>Chegada e embalagem</h2>
              <div className="sp-midias">{midias.filter(m => !m.item_id).map(m => <Miniatura key={m.id} m={m} />)}</div>
            </section>
          )}

          <section className="sp-card">
            <h2>{itens.length === 1 ? 'Sua carta' : 'Suas cartas'}</h2>
            <div className="sp-itens">
              {itens.map(it => (
                <article key={it.id} className={`sp-item${it.aceito === false ? ' sp-item-fora' : ''}`}>
                  <div className="sp-item-topo">
                    <div><b>{it.nome}</b><small>declarado {reais(it.valor_declarado_cents)}</small></div>
                    {it.custodia && <span className="sp-custodia" title="Número de custódia">{it.custodia}</span>}
                  </div>
                  {it.aceito === false && <p className="sp-recusa"><IconClose size={13} /> Fora do serviço: {it.recusa_motivo}</p>}
                  <div className="sp-midias">{midias.filter(m => m.item_id === it.id).map(m => <Miniatura key={m.id} m={m} />)}</div>
                  {it.laudo && (
                    <dl className="sp-dl sp-laudo">
                      {CAMPOS_LAUDO.filter(c => it.laudo?.[c.k]).map(c => <div key={c.k}><dt>{c.rotulo}</dt><dd>{it.laudo![c.k]}</dd></div>)}
                    </dl>
                  )}
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="sp-col">
          <section className="sp-card">
            <h2>Linha do tempo</h2>
            <ol className="sp-tl">
              {[...eventos].reverse().map(e => (
                <li key={e.id}>
                  <b>{e.status === 'fotos_completas' ? 'Fotos recebidas' : STATUS_SERVICO[e.status] || e.status}</b>
                  {e.nota && <span>{e.nota}</span>}
                  <small>{fmtDataHoraBRT.format(new Date(e.created_at))}</small>
                </li>
              ))}
            </ol>
          </section>
          <section className="sp-card sp-garantia">
            <IconBox size={18} />
            <p>Cada etapa com a sua carta deixa registro: vídeo da abertura, fotos na mesma luz na entrada e na saída, e o número de custódia.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Miniatura({ m }: { m: Midia }) {
  const rotulo = ROTULO_MIDIA[m.tipo] || m.tipo
  if (!m.url) return null
  return (
    <a className="sp-mini" href={m.url} target="_blank" rel="noopener">
      {m.mime.startsWith('image/')
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.url} alt={rotulo} loading="lazy" />
        : <span className="sp-mini-arq">{m.mime.startsWith('video/') ? 'Vídeo' : 'PDF'}</span>}
      <small>{rotulo}</small>
    </a>
  )
}

const CSS = `
.sp{color:var(--bx-text);padding-bottom:48px}
.sp-muted{font-size:14px;line-height:1.55;color:var(--bx-text-2);margin:0}
.sp-pill{font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12)}
.sp-pill-fim{color:var(--bx-text-3);background:var(--bx-surface-2)}
.sp-etapas{list-style:none;margin:0 0 18px;padding:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.sp-etapas::-webkit-scrollbar{display:none}
.sp-etapas li{flex:1 0 auto;display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border-radius:10px;background:var(--bx-surface);border:1px solid var(--bx-border);font-size:12.5px;font-weight:600;color:var(--bx-text-3);white-space:nowrap}
.sp-etapas li span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;background:var(--bx-surface-2)}
.sp-etapas li.feito{color:var(--bx-text-2)}
.sp-etapas li.feito span{background:color-mix(in srgb,var(--bx-green) 16%,transparent);color:var(--bx-green)}
.sp-etapas li.agora{color:var(--bx-text);border-color:rgba(var(--ac-1-rgb),.5)}
.sp-etapas li.agora span{background:var(--ac-grad);color:var(--bx-brand-ink)}
.sp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
.sp-col{display:grid;gap:16px;min-width:0}
.sp-card{border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface);padding:18px;display:grid;gap:12px;min-width:0}
.sp-card h2{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;margin:0}
.sp-card-acao{border-color:rgba(var(--ac-1-rgb),.4)}
.sp-vazio{justify-items:center;text-align:center;padding:40px 20px;color:var(--bx-text-3)}
.sp-vazio p{margin:0}
.sp-dl{display:grid;gap:8px;margin:0}
.sp-dl div{display:flex;justify-content:space-between;gap:12px;font-size:14px}
.sp-dl dt{color:var(--bx-text-2)}
.sp-dl dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.sp-total{padding-top:8px;border-top:1px solid var(--bx-border);font-weight:800;font-size:16px}
.sp-obs{margin:0;padding:12px 14px;border-radius:10px;background:var(--bx-surface-2);font-size:14px;line-height:1.55;white-space:pre-wrap}
.sp-termo{padding:14px;border-radius:10px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.sp-termo b{font-size:13px}
.sp-termo ul{margin:8px 0 0;padding-left:18px;display:grid;gap:6px;font-size:13px;line-height:1.5;color:var(--bx-text-2)}
.sp-chk{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;font-size:14px;line-height:1.5;cursor:pointer}
.sp-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ac-1)}
.sp-acoes{display:flex;flex-wrap:wrap;gap:10px}
.sp-bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:48px;padding:0 18px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s ease,transform .15s ease}
.sp-bt:disabled{opacity:.5;cursor:not-allowed}
.sp-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.sp-bt-pri:hover:not(:disabled){transform:translateY(-2px)}
.sp-bt-perigo{background:transparent;color:var(--bx-red);border-color:color-mix(in srgb,var(--bx-red) 40%,transparent)}
.sp-endereco{padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid rgba(var(--ac-1-rgb),.4)}
.sp-endereco span{font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1)}
.sp-endereco p{margin:6px 0;font-size:15px;line-height:1.55;white-space:pre-wrap}
.sp-endereco small{font-size:12.5px;color:var(--bx-text-2)}
.sp-aviso{display:flex;gap:8px;align-items:flex-start;margin:0;font-size:14px;color:var(--bx-text-2)}
.sp-aviso svg{flex-shrink:0;margin-top:2px;color:var(--ac-1)}
.sp-guia{margin:0;padding-left:20px;display:grid;gap:6px;font-size:14px;line-height:1.5;color:var(--bx-text-2)}
.sp-rastreio{display:grid;gap:6px}
.sp-rastreio label{font-size:13px;font-weight:600;color:var(--bx-text-2)}
.sp-rastreio > div{display:flex;gap:8px}
.sp-rastreio input{flex:1;min-width:0;min-height:48px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text);padding:0 12px;font:inherit;font-size:16px;letter-spacing:.04em;color-scheme:dark}
.sp-rastreio input:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.7)}
.sp-cod{font-variant-numeric:tabular-nums;color:var(--bx-text)}
.sp-ok{font-size:14px;color:var(--bx-green);margin:0 0 14px}
.sp-erro{font-size:14px;color:var(--bx-red);margin:0 0 14px}
.sp-itens{display:grid;gap:12px}
.sp-item{display:grid;gap:10px;padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.sp-item-fora{opacity:.8}
.sp-item-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.sp-item-topo b{display:block;font-size:15px}
.sp-item-topo small{font-size:12.5px;color:var(--bx-text-3)}
.sp-custodia{font-size:12px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:8px;border:1px solid rgba(var(--ac-1-rgb),.45);color:var(--ac-1);white-space:nowrap}
.sp-recusa{display:flex;gap:6px;align-items:flex-start;margin:0;font-size:13.5px;line-height:1.5;color:var(--bx-red)}
.sp-recusa svg{flex-shrink:0;margin-top:3px}
.sp-midias{display:flex;flex-wrap:wrap;gap:8px}
.sp-mini{display:flex;flex-direction:column;gap:4px;width:88px;text-decoration:none;color:var(--bx-text-3)}
.sp-mini img,.sp-mini-arq{width:88px;height:123px;border-radius:8px;object-fit:cover;border:1px solid var(--bx-border);background:var(--bx-surface-2)}
.sp-mini-arq{display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--bx-text-2)}
.sp-mini small{font-size:11px;line-height:1.3}
.sp-laudo{padding-top:10px;border-top:1px solid var(--bx-border)}
.sp-tl{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.sp-tl li{display:grid;gap:2px;padding-left:12px;border-left:2px solid var(--bx-border-2)}
.sp-tl li:first-child{border-left-color:var(--ac-1)}
.sp-tl b{font-size:14px}
.sp-tl span{font-size:13px;color:var(--bx-text-2);line-height:1.45}
.sp-tl small{font-size:11.5px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.sp-garantia{grid-template-columns:24px minmax(0,1fr);align-items:start;color:var(--bx-green)}
.sp-garantia p{margin:0;font-size:13px;line-height:1.55;color:var(--bx-text-2)}
@media (max-width:980px){ .sp-grid{grid-template-columns:1fr} }
@media (max-width:640px){
  .sp-acoes > .sp-bt{flex:1 1 100%}
  .sp-rastreio > div{flex-direction:column}
}
@media (prefers-reduced-motion:reduce){ .sp-bt{transition:none} .sp-bt-pri:hover:not(:disabled){transform:none} }
`
