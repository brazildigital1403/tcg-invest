'use client'

// Fila da Protecao Bynx: reclamacoes de pedidos de LEILAO.
// "Decidir agora" = loja respondeu ou ficou em silencio depois do prazo (a
// decisao do silencio e a favor do comprador). Horarios de Brasilia.
// Dinheiro: os botoes chamam /api/admin/reclamacoes/[rid]/decidir, que estorna
// na Stripe ANTES de gravar e e idempotente (clicar de novo reaproveita o
// mesmo estorno).

import { useCallback, useEffect, useState } from 'react'
import { fmtBRL } from '@/lib/comissao'
import { IconClock, IconCheck, IconWarning } from '@/components/ui/Icons'
import {
  MOTIVOS, STATUS_RECLAMACAO, RESPOSTAS_LOJA, DECISOES, fmtPrazo,
  type MotivoReclamacao, type StatusReclamacao, type RespostaLoja, type Decisao,
} from '@/lib/leilao-reclamacao'

type Linha = {
  id: string
  pedido_id: string
  motivo: MotivoReclamacao
  descricao: string
  video_url: string | null
  status: StatusReclamacao
  resposta_tipo: RespostaLoja | null
  resposta_loja: string | null
  contraproposta_cents: number | null
  respondida_em: string | null
  prazo_loja_ate: string
  prazo_decisao_ate: string | null
  decisao: Decisao | null
  decisao_nota: string | null
  valor_estornado_cents: number
  stripe_refund_id: string | null
  decidido_em: string | null
  created_at: string
  pedido: {
    numero: number; status: string; item_nome: string; rastreio: string | null; pago_em: string | null
    enviado_em: string | null; entregue_em: string | null; recebido_automatico: boolean
    total_comprador_cents: number; valor_reembolsado_cents: number
  } | null
  loja: { nome: string; slug: string | null } | null
  comprador: { name: string | null; email: string | null } | null
  fotos_url: string[]
  sem_resposta: boolean
  pode_decidir: boolean
  restante_cents: number
}

type Seg = 'agora' | 'loja' | 'fim' | 'tudo'
const SEGS: { k: Seg; l: string }[] = [
  { k: 'agora', l: 'Decidir agora' },
  { k: 'loja', l: 'Com a loja' },
  { k: 'fim', l: 'Encerradas' },
  { k: 'tudo', l: 'Tudo' },
]
function segDe(r: Linha): Seg {
  if (r.status === 'resolvida' || r.status === 'improcedente') return 'fim'
  return r.pode_decidir ? 'agora' : 'loja'
}

export default function AdminReclamacoesPage() {
  const [rows, setRows] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState(false)
  const [seg, setSeg] = useState<Seg>('agora')
  const [aberta, setAberta] = useState<string | null>(null)
  const [valor, setValor] = useState('')
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/reclamacoes', { cache: 'no-store' })
      if (!r.ok) { setErro(true); return }
      const d = await r.json()
      setErro(false)
      setRows(d.reclamacoes || [])
    } catch { setErro(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function decidir(r: Linha, decisao: Decisao) {
    const cents = decisao === 'estorno_parcial' ? Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100) : null
    const concluiDevolucao = decisao === 'devolucao' && r.status === 'aguardando_devolucao'
    const resumo = decisao === 'estorno_total' || concluiDevolucao ? `estornar ${fmtBRL(r.restante_cents)} ao comprador`
      : decisao === 'estorno_parcial' ? `estornar ${fmtBRL(cents || 0)} ao comprador`
      : decisao === 'devolucao' ? 'pedir a devolução (sem estorno agora)'
      : 'encerrar sem estorno'
    if (!window.confirm(`Pedido #${r.pedido?.numero}: ${resumo}. Confirmar?`)) return
    setSalvando(r.id); setMsg(null)
    try {
      const res = await fetch(`/api/admin/reclamacoes/${r.id}/decidir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, valor_cents: cents, nota: nota.trim() || null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Falha ao decidir.')
      setMsg({ tipo: 'ok', texto: j.valor_estornado_cents > 0 ? `Decidido. Estornado ${fmtBRL(j.valor_estornado_cents)}.` : 'Decidido.' })
      setValor(''); setNota(''); setAberta(null)
      await load()
    } catch (e) {
      setMsg({ tipo: 'erro', texto: (e as Error).message })
    } finally {
      setSalvando(null)
    }
  }

  const visiveis = (rows || []).filter(r => seg === 'tudo' || segDe(r) === seg)

  return (
    <div className="ar-wrap">
      <style>{CSS}</style>
      <h1 className="ar-h1">Reclamações de leilão</h1>
      <p className="ar-sub">Proteção Bynx. A loja tem 3 dias úteis para responder; sem resposta, a decisão é a favor do comprador. A Bynx decide em até 5 dias úteis. Horários de Brasília.</p>

      <div className="ar-segs">
        {SEGS.map(s => {
          const n = rows ? (s.k === 'tudo' ? rows.length : rows.filter(r => segDe(r) === s.k).length) : null
          return (
            <button key={s.k} type="button" className={`ar-seg${seg === s.k ? ' ar-seg-on' : ''}`} onClick={() => setSeg(s.k)}>
              {s.l}{n !== null && <b>{n}</b>}
            </button>
          )
        })}
      </div>

      {msg && <div className={`ar-msg ar-msg-${msg.tipo}`}>{msg.texto}</div>}

      {erro ? (
        <div className="ar-vazio"><p>Não deu para carregar a fila.</p><button type="button" className="ar-bt" onClick={load}>Tentar de novo</button></div>
      ) : !rows ? (
        <p className="ar-vazio">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <div className="ar-vazio"><IconCheck size={20} color="var(--bx-green)" /><p>Nada neste grupo.</p></div>
      ) : (
        <div className="ar-lista">
          {visiveis.map(r => {
            const p = r.pedido
            const exp = aberta === r.id
            return (
              <div key={r.id} className={`ar-item${r.pode_decidir ? ' ar-item-agora' : ''}`}>
                <button type="button" className="ar-linha" onClick={() => { setAberta(exp ? null : r.id); setValor(''); setNota(''); setMsg(null) }}>
                  <span className="ar-num">#{p?.numero ?? ''}</span>
                  <span className="ar-meio">
                    <b>{p?.item_nome || 'Pedido'} · {r.loja?.nome || 'Loja'}</b>
                    <span>{MOTIVOS[r.motivo]} · {r.comprador?.name || r.comprador?.email || 'Comprador'} · {p ? fmtBRL(p.total_comprador_cents) : ''}</span>
                  </span>
                  <span className="ar-dir">
                    <span className={`ar-pill${r.pode_decidir ? ' ar-pill-agora' : ''}`}>
                      {r.sem_resposta ? <><IconWarning size={11} color="currentColor" />Loja sem resposta</> : <>{r.pode_decidir && <IconClock size={11} color="currentColor" />}{STATUS_RECLAMACAO[r.status]}</>}
                    </span>
                    <small>{fmtPrazo(r.created_at)}</small>
                  </span>
                </button>

                {exp && (
                  <div className="ar-det">
                    <div className="ar-grid">
                      <div><span>Pago</span>{fmtPrazo(p?.pago_em) || '-'}</div>
                      <div><span>Enviado</span>{fmtPrazo(p?.enviado_em) || '-'}</div>
                      <div><span>Entregue</span>{p?.entregue_em ? `${fmtPrazo(p.entregue_em)}${p.recebido_automatico ? ' (automático)' : ''}` : '-'}</div>
                      <div><span>Rastreio</span>{p?.rastreio ? <code>{p.rastreio}</code> : '-'}</div>
                      <div><span>Status do pedido</span>{p?.status || '-'}</div>
                      <div><span>Já estornado</span>{fmtBRL(p?.valor_reembolsado_cents || 0)} · resta {fmtBRL(r.restante_cents)}</div>
                      <div><span>Prazo da loja</span>{fmtPrazo(r.prazo_loja_ate)}</div>
                      <div><span>Prazo da Bynx</span>{fmtPrazo(r.prazo_decisao_ate) || '-'}</div>
                    </div>

                    <div className="ar-bloco">
                      <div className="ar-rot">Comprador ({r.comprador?.email || 'sem e-mail'})</div>
                      <p className="ar-cit">{r.descricao}</p>
                      {r.fotos_url.length > 0 && (
                        <div className="ar-fotos">
                          {r.fotos_url.map((u, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <a key={i} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`Foto ${i + 1}`} /></a>
                          ))}
                        </div>
                      )}
                      {r.video_url && <a className="ar-a" href={r.video_url} target="_blank" rel="noopener noreferrer nofollow">Abrir o vídeo</a>}
                    </div>

                    <div className="ar-bloco">
                      <div className="ar-rot">Loja</div>
                      {r.resposta_tipo ? (
                        <>
                          <p className="ar-cit"><b>{RESPOSTAS_LOJA[r.resposta_tipo]}</b>{r.contraproposta_cents ? ` · propõe ${fmtBRL(r.contraproposta_cents)}` : ''}{r.respondida_em ? ` · ${fmtPrazo(r.respondida_em)}` : ''}</p>
                          {r.resposta_loja && <p className="ar-cit">{r.resposta_loja}</p>}
                        </>
                      ) : (
                        <p className="ar-cit">{r.sem_resposta ? 'Não respondeu no prazo: decisão a favor do comprador.' : 'Ainda no prazo para responder.'}</p>
                      )}
                    </div>

                    {r.decisao && (
                      <div className="ar-bloco">
                        <div className="ar-rot">Decisão</div>
                        <p className="ar-cit"><b>{DECISOES[r.decisao]}</b>{r.valor_estornado_cents > 0 ? ` · ${fmtBRL(r.valor_estornado_cents)}` : ''}{r.stripe_refund_id ? ` · ${r.stripe_refund_id}` : ''}{r.decidido_em ? ` · ${fmtPrazo(r.decidido_em)}` : ''}</p>
                        {r.decisao_nota && <p className="ar-cit">{r.decisao_nota}</p>}
                      </div>
                    )}

                    {r.pode_decidir && (
                      <div className="ar-acoes">
                        <textarea className="ar-input" value={nota} maxLength={2000} onChange={e => setNota(e.target.value)} placeholder="Observação (vai no e-mail das duas partes)" />
                        {r.status === 'aguardando_devolucao' ? (
                          <div className="ar-bts">
                            <button type="button" className="ar-bt ar-bt-pri" disabled={!!salvando} onClick={() => decidir(r, 'devolucao')}>Carta devolvida: estornar {fmtBRL(r.restante_cents)}</button>
                            <button type="button" className="ar-bt" disabled={!!salvando} onClick={() => decidir(r, 'improcedente')}>Improcedente</button>
                          </div>
                        ) : (
                          <>
                            <div className="ar-bts">
                              <button type="button" className="ar-bt ar-bt-pri" disabled={!!salvando} onClick={() => decidir(r, 'estorno_total')}>Estorno total ({fmtBRL(r.restante_cents)})</button>
                              <button type="button" className="ar-bt" disabled={!!salvando} onClick={() => decidir(r, 'devolucao')}>Devolução</button>
                              <button type="button" className="ar-bt" disabled={!!salvando} onClick={() => decidir(r, 'improcedente')}>Improcedente</button>
                            </div>
                            <div className="ar-bts">
                              <input className="ar-input ar-valor" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder={r.contraproposta_cents ? `R$ (loja propõe ${fmtBRL(r.contraproposta_cents)})` : 'Valor em R$'} />
                              <button type="button" className="ar-bt" disabled={!!salvando || !valor.trim()} onClick={() => decidir(r, 'estorno_parcial')}>Estorno parcial</button>
                            </div>
                          </>
                        )}
                        {salvando === r.id && <p className="ar-cit">Processando...</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const CSS = `
.ar-wrap{padding:32px 24px;max-width:1100px;margin:0 auto;font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text)}
.ar-h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0 0 6px}
.ar-sub{font-size:13px;color:var(--bx-text-3);margin:0 0 20px;max-width:720px;line-height:1.5}
.ar-segs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px}
.ar-seg{display:flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.ar-seg b{opacity:.65}
.ar-seg-on{background:var(--bx-surface-2);border-color:var(--bx-border-2);color:var(--bx-text)}
.ar-msg{font-size:13px;border-radius:10px;padding:10px 14px;margin-bottom:12px}
.ar-msg-ok{color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 10%,transparent)}
.ar-msg-erro{color:var(--bx-red);background:color-mix(in srgb,var(--bx-red) 10%,transparent)}
.ar-lista{display:grid;gap:8px}
.ar-item{border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface);overflow:hidden}
.ar-item-agora{border-left:2px solid var(--ac-1)}
.ar-linha{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 18px;background:transparent;border:none;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .15s ease}
.ar-linha:hover{background:var(--bx-surface-2)}
.ar-num{font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:var(--bx-text-2)}
.ar-meio{min-width:0}
.ar-meio b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ar-meio span{display:block;font-size:12px;color:var(--bx-text-3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ar-dir{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.ar-dir small{font-size:11px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.ar-pill{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:999px;white-space:nowrap;color:var(--bx-text-3);background:var(--bx-surface-2)}
.ar-pill-agora{color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12)}
.ar-det{padding:0 18px 18px;display:grid;gap:14px}
.ar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px 16px;font-size:12.5px}
.ar-grid span{display:block;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--bx-text-3)}
.ar-grid code{font-size:12px}
.ar-bloco{border-top:1px solid var(--bx-border);padding-top:12px}
.ar-rot{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--bx-text-3);margin-bottom:6px}
.ar-cit{margin:4px 0;font-size:13px;line-height:1.55;color:var(--bx-text-2);white-space:pre-wrap;overflow-wrap:anywhere}
.ar-fotos{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.ar-fotos img{width:110px;height:150px;object-fit:cover;border-radius:8px;border:1px solid var(--bx-border);display:block}
.ar-a{color:var(--ac-1);font-size:12.5px;font-weight:700}
.ar-acoes{border-top:1px solid var(--bx-border);padding-top:12px;display:grid;gap:8px}
.ar-bts{display:flex;gap:8px;flex-wrap:wrap}
.ar-input{box-sizing:border-box;width:100%;background:var(--bx-surface-2);border:1px solid var(--bx-border);border-radius:8px;padding:10px 12px;color:var(--bx-text);font:inherit;font-size:13px;outline:none;min-height:40px}
.ar-valor{width:auto;flex:1;min-width:160px}
.ar-bt{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:opacity .15s ease}
.ar-bt:disabled{opacity:.5;cursor:not-allowed}
.ar-bt-pri{border-color:rgba(var(--ac-1-rgb),.5);background:rgba(var(--ac-1-rgb),.14);color:var(--ac-1)}
.ar-vazio{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px 20px;border-radius:14px;border:1px dashed var(--bx-border-2);text-align:center;color:var(--bx-text-3);font-size:14px}
.ar-vazio p{margin:0}
@media (max-width:640px){
  .ar-wrap{padding:20px 16px}
  .ar-linha{grid-template-columns:minmax(0,1fr) auto;padding:12px 14px}
  .ar-num{grid-column:1 / -1}
  .ar-det{padding:0 14px 14px}
}
`
