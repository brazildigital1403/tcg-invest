'use client'

// Um pedido do servico de bancada, do orcamento a entrega.
//
// Em cima: quem e o cliente e como falar com ele (WhatsApp so aparece como
// atalho se ele consentiu). Depois: a acao que o status atual pede (orcar,
// registrar aceite, receber, mover na bancada, enviar), o pagamento Pix, as
// cartas (fotos do cliente, custodia, midias de entrada/saida e laudo) e a
// linha do tempo. Enquanto a pagina do cliente (F9) nao existe, o aceite
// combinado por WhatsApp e registrado aqui.

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  STATUS_SERVICO, TRANSICOES_ADMIN, MIDIAS_ADMIN, CAMPOS_LAUDO, SERVICOS, PRECOS, brl, numeroServico, fmtDataHoraBRT, turnoServico,
} from '@/lib/servicos'
import { IconChevronLeft, IconWhatsApp, IconCheck, IconClose, IconUpload, IconWarning } from '@/components/ui/Icons'

type Sol = {
  id: string; numero: number; servico: string; prazo: string; status: string
  valor_declarado_cents: number; orcamento_cents: number | null; seguro_cents: number | null
  frete_volta_cents: number | null; total_cents: number | null; orcamento_obs: string | null
  pagamento_metodo: string | null; pago_em: string | null; whatsapp: string | null; whatsapp_consentido: boolean
  rastreio_ida: string | null; rastreio_volta: string | null; lacre_volta: string | null; created_at: string
}
type Item = {
  id: string; nome: string; card_id: string | null; queixas: string[]; obs: string | null
  valor_declarado_cents: number; custodia: string | null; aceito: boolean | null; recusa_motivo: string | null
  laudo: Record<string, string> | null
}
type Evento = { id: string; status: string; nota: string | null; created_at: string }
type Midia = { id: string; item_id: string | null; tipo: string; mime: string; tamanho: number; url: string | null }
type Dados = { solicitacao: Sol; cliente: { name: string; email: string } | null; itens: Item[]; eventos: Evento[]; midias: Midia[] }

const ROTULO_MIDIA: Record<string, string> = {
  cliente_frente: 'Frente (cliente)', cliente_verso: 'Verso (cliente)', cliente_extra: 'Extra (cliente)',
  ...Object.fromEntries(MIDIAS_ADMIN.map(m => [m.tipo, m.rotulo])),
}

function reais(cents: number | null | undefined) { return cents == null ? '—' : `R$ ${brl(cents / 100)}` }
function paraCents(v: string) {
  const n = Number(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN
}
function formatarWhats(d: string) { return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d }

export default function AdminServicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [dados, setDados] = useState<Dados | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; t: string } | null>(null)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/servicos/${id}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErroCarga(d.error || 'Não deu para carregar o pedido.'); return }
      setErroCarga('')
      setDados(d)
    } catch { setErroCarga('Sem conexão com o servidor.') }
  }, [id])
  useEffect(() => { carregar() }, [carregar])

  async function acao(payload: Record<string, unknown>, rotulo: string, sucesso: string) {
    setOcupado(rotulo); setMsg(null)
    try {
      const r = await fetch(`/api/admin/servicos/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ tipo: 'erro', t: d.error || 'Não deu certo.' }); return false }
      setMsg({ tipo: 'ok', t: sucesso })
      await carregar()
      return true
    } catch { setMsg({ tipo: 'erro', t: 'Sem conexão com o servidor.' }); return false }
    finally { setOcupado('') }
  }

  async function subirMidia(tipo: string, itemId: string | null, file: File) {
    setOcupado(`midia-${tipo}-${itemId}`); setMsg(null)
    try {
      const r = await fetch(`/api/admin/servicos/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'midia_url', tipo, item_id: itemId, mime: file.type }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ tipo: 'erro', t: d.error || 'Não deu para preparar o envio.' }); return }
      const { error } = await supabase.storage.from('servico-midias').uploadToSignedUrl(d.path, d.token, file, { contentType: file.type })
      if (error) { setMsg({ tipo: 'erro', t: 'O arquivo não subiu. Tente de novo.' }); return }
      await acao({ acao: 'midia_confirmar', tipo, item_id: itemId, path: d.path }, `midia-${tipo}-${itemId}`, 'Arquivo enviado.')
    } catch { setMsg({ tipo: 'erro', t: 'Sem conexão com o servidor.' }) }
    finally { setOcupado('') }
  }

  if (erroCarga) return <div className="sv-adm"><style>{CSS}</style><p className="ad-erro">{erroCarga}</p><button type="button" className="ad-bt" onClick={carregar}>Tentar de novo</button></div>
  if (!dados) return <div className="sv-adm"><style>{CSS}</style><p className="ad-muted">Carregando...</p></div>

  const { solicitacao: s, cliente, itens, eventos, midias } = dados
  const vez = turnoServico(s.status)

  return (
    <div className="sv-adm">
      <style>{CSS}</style>
      <Link href="/admin/servicos" className="ad-voltar"><IconChevronLeft size={16} /> Serviços</Link>

      <header className="ad-topo">
        <div>
          <h1>{numeroServico(s.numero)} <span className={`ad-pill ad-pill-${vez}`}>{STATUS_SERVICO[s.status] || s.status}</span></h1>
          <p className="ad-muted">
            {SERVICOS.find(x => x.id === s.servico)?.nome} · {itens.length} {itens.length === 1 ? 'carta' : 'cartas'} · prazo {s.prazo === 'expresso' ? 'expresso' : 'padrão'} · pedido em {fmtDataHoraBRT.format(new Date(s.created_at))}
          </p>
        </div>
        <div className="ad-cliente">
          <b>{cliente?.name || 'Cliente'}</b>
          <a href={`mailto:${cliente?.email}`}>{cliente?.email}</a>
          {s.whatsapp && (s.whatsapp_consentido
            ? <a className="ad-bt ad-bt-whats" href={`https://wa.me/55${s.whatsapp}`} target="_blank" rel="noopener"><IconWhatsApp size={15} /> {formatarWhats(s.whatsapp)}</a>
            : <span className="ad-muted">{formatarWhats(s.whatsapp)} (sem consentimento para WhatsApp)</span>)}
        </div>
      </header>

      {msg && <p className={msg.tipo === 'ok' ? 'ad-ok' : 'ad-erro'} role="status">{msg.t}</p>}

      <div className="ad-grid">
        <div className="ad-col">
          {['aguardando_orcamento', 'orcado'].includes(s.status) && (
            <Orcamento sol={s} itens={itens} ocupado={!!ocupado} enviar={p => acao({ acao: 'orcar', ...p }, 'orcar', 'Orçamento salvo.')} />
          )}

          <section className="ad-card">
            <h2>Cartas</h2>
            <div className="ad-itens">
              {itens.map((it, i) => (
                <CartaAdmin
                  key={it.id}
                  idx={i}
                  item={it}
                  midias={midias.filter(m => m.item_id === it.id)}
                  ocupado={ocupado}
                  subir={(tipo, f) => subirMidia(tipo, it.id, f)}
                  salvarLaudo={laudo => acao({ acao: 'laudo', item_id: it.id, laudo }, `laudo-${it.id}`, 'Laudo salvo.')}
                />
              ))}
            </div>
          </section>

          <section className="ad-card">
            <h2>Arquivos do pedido</h2>
            <div className="ad-midias">
              {midias.filter(m => !m.item_id).map(m => <Miniatura key={m.id} m={m} />)}
              {!midias.some(m => !m.item_id) && <p className="ad-muted" style={{ margin: 0 }}>Nenhum ainda.</p>}
            </div>
            <div className="ad-uploads">
              {MIDIAS_ADMIN.filter(m => !m.porItem).map(m => (
                <BotaoUpload key={m.tipo} rotulo={m.rotulo} ocupado={ocupado === `midia-${m.tipo}-null`} aceitar={m.tipo === 'video_abertura' ? 'video/mp4,video/quicktime' : 'image/*'} onFile={f => subirMidia(m.tipo, null, f)} />
              ))}
            </div>
          </section>
        </div>

        <aside className="ad-col">
          <Acoes sol={s} ocupado={ocupado} mover={(para, extra) => acao({ acao: 'status', para, ...extra }, `status-${para}`, `Status: ${STATUS_SERVICO[para]}.`)} />

          <section className="ad-card">
            <h2>Valores</h2>
            <dl className="ad-dl">
              <div><dt>Declarado</dt><dd>{reais(s.valor_declarado_cents)}</dd></div>
              <div><dt>Serviço</dt><dd>{reais(s.orcamento_cents)}</dd></div>
              <div><dt>Seguro</dt><dd>{reais(s.seguro_cents)}</dd></div>
              <div><dt>Frete de volta</dt><dd>{reais(s.frete_volta_cents)}</dd></div>
              <div className="ad-total"><dt>Total</dt><dd>{reais(s.total_cents)}</dd></div>
            </dl>
            {s.orcamento_obs && <p className="ad-obs">{s.orcamento_obs}</p>}
            {s.pago_em
              ? <p className="ad-ok" style={{ margin: 0 }}><IconCheck size={14} /> Pago via Pix em {fmtDataHoraBRT.format(new Date(s.pago_em))}</p>
              : s.total_cents != null && ['orcado', 'aceito', 'recebida', 'em_bancada', 'descansando', 'pronta'].includes(s.status) && (
                <button type="button" className="ad-bt" disabled={!!ocupado} onClick={() => confirm('Confirmar que o Pix deste pedido caiu?') && acao({ acao: 'pagamento' }, 'pagamento', 'Pagamento registrado.')}>
                  Registrar pagamento via Pix
                </button>
              )}
            {(s.rastreio_ida || s.rastreio_volta) && (
              <dl className="ad-dl" style={{ marginTop: 12 }}>
                {s.rastreio_ida && <div><dt>Rastreio ida</dt><dd>{s.rastreio_ida}</dd></div>}
                {s.rastreio_volta && <div><dt>Rastreio volta</dt><dd>{s.rastreio_volta}</dd></div>}
                {s.lacre_volta && <div><dt>Lacre</dt><dd>{s.lacre_volta}</dd></div>}
              </dl>
            )}
          </section>

          <section className="ad-card">
            <h2>Linha do tempo</h2>
            <ol className="ad-tl">
              {[...eventos].reverse().map(e => (
                <li key={e.id}>
                  <b>{STATUS_SERVICO[e.status] || (e.status === 'fotos_completas' ? 'Fotos recebidas' : e.status)}</b>
                  {e.nota && <span>{e.nota}</span>}
                  <small>{fmtDataHoraBRT.format(new Date(e.created_at))}</small>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

// ── Orcamento ───────────────────────────────────────────────────────────────

function Orcamento({ sol, itens, ocupado, enviar }: {
  sol: Sol; itens: Item[]; ocupado: boolean
  enviar: (p: Record<string, unknown>) => Promise<boolean>
}) {
  const sugestaoSeguro = PRECOS ? Math.round(sol.valor_declarado_cents * PRECOS.seguroPct / 100) : null
  const [decisao, setDecisao] = useState<Record<string, { aceito: boolean; motivo: string }>>(() =>
    Object.fromEntries(itens.map(i => [i.id, { aceito: i.aceito !== false, motivo: i.recusa_motivo || '' }])))
  const [servico, setServico] = useState(sol.orcamento_cents != null ? brl(sol.orcamento_cents / 100) : '')
  const [seguro, setSeguro] = useState(sol.seguro_cents != null ? brl(sol.seguro_cents / 100) : sugestaoSeguro != null ? brl(sugestaoSeguro / 100) : '')
  const [frete, setFrete] = useState(sol.frete_volta_cents != null ? brl(sol.frete_volta_cents / 100) : '')
  const [obs, setObs] = useState(sol.orcamento_obs || '')

  const todasRecusadas = itens.every(i => decisao[i.id]?.aceito === false)
  const total = useMemo(() => {
    const v = [servico, seguro, frete].map(x => (x ? paraCents(x) : 0))
    return v.some(Number.isNaN) ? null : v.reduce((a, b) => a + b, 0)
  }, [servico, seguro, frete])

  return (
    <section className="ad-card ad-card-acao">
      <h2>{sol.status === 'orcado' ? 'Revisar orçamento' : 'Orçar'}</h2>
      <p className="ad-muted" style={{ marginTop: -6 }}>Recuse a carta que precisaria de tinta, cola ou corte, e diga o porquê. O cliente vê o motivo.</p>
      <div className="ad-orc-itens">
        {itens.map((i, k) => {
          const d = decisao[i.id]
          return (
            <div key={i.id} className="ad-orc-item">
              <div className="ad-orc-l"><b>{k + 1}. {i.nome}</b><small>declarado {reais(i.valor_declarado_cents)}</small></div>
              <div className="ad-toggle">
                <button type="button" className={d.aceito ? 'on' : ''} onClick={() => setDecisao(x => ({ ...x, [i.id]: { ...d, aceito: true } }))}><IconCheck size={13} /> Tratar</button>
                <button type="button" className={!d.aceito ? 'on off' : ''} onClick={() => setDecisao(x => ({ ...x, [i.id]: { ...d, aceito: false } }))}><IconClose size={13} /> Recusar</button>
              </div>
              {!d.aceito && (
                <input className="ad-in ad-orc-motivo" placeholder="Motivo da recusa (o cliente vê)" value={d.motivo} maxLength={300}
                  onChange={e => setDecisao(x => ({ ...x, [i.id]: { ...d, motivo: e.target.value } }))} />
              )}
            </div>
          )
        })}
      </div>

      {!todasRecusadas && (
        <div className="ad-valores">
          <label><span>Serviço</span><input className="ad-in" inputMode="decimal" placeholder="0,00" value={servico} onChange={e => setServico(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
          <label><span>Seguro{PRECOS ? ` (${PRECOS.seguroPct}%)` : ''}</span><input className="ad-in" inputMode="decimal" placeholder="0,00" value={seguro} onChange={e => setSeguro(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
          <label><span>Frete de volta</span><input className="ad-in" inputMode="decimal" placeholder="0,00" value={frete} onChange={e => setFrete(e.target.value.replace(/[^\d.,]/g, ''))} /></label>
          <div className="ad-total-orc"><span>Total</span><b>{total == null ? 'valor inválido' : reais(total)}</b></div>
        </div>
      )}
      <textarea className="ad-in" rows={3} placeholder="Observação para o cliente (opcional)" value={obs} maxLength={2000} onChange={e => setObs(e.target.value)} />
      <button
        type="button"
        className={`ad-bt ad-bt-pri${todasRecusadas ? ' ad-bt-perigo' : ''}`}
        disabled={ocupado || (!todasRecusadas && (!servico || total == null))}
        onClick={() => {
          if (todasRecusadas && !confirm('Recusar o pedido inteiro? Nenhuma carta será tratada.')) return
          enviar({
            itens: itens.map(i => ({ id: i.id, aceito: decisao[i.id].aceito, recusa_motivo: decisao[i.id].motivo })),
            orcamento_cents: servico ? paraCents(servico) : null,
            seguro_cents: seguro ? paraCents(seguro) : null,
            frete_volta_cents: frete ? paraCents(frete) : null,
            obs,
          })
        }}
      >
        {todasRecusadas ? 'Recusar o pedido' : sol.status === 'orcado' ? 'Atualizar orçamento' : 'Salvar orçamento'}
      </button>
      {sol.status === 'aguardando_orcamento' && (
        <p className="ad-muted" style={{ margin: 0 }}>Depois de salvar, mande o orçamento para o cliente por e-mail ou WhatsApp. O e-mail automático ainda não existe.</p>
      )}
    </section>
  )
}

// ── Acoes de status ─────────────────────────────────────────────────────────

const ROTULO_ACAO: Record<string, string> = {
  aceito: 'Registrar aceite do cliente',
  recusado_cliente: 'Cliente recusou',
  recebida: 'Carta chegou',
  em_bancada: 'Levar para a bancada',
  descansando: 'Em descanso',
  pronta: 'Pronta',
  enviada: 'Enviar de volta',
  entregue: 'Entregue',
  devolvida_sem_servico: 'Devolver sem serviço',
  cancelado: 'Cancelar pedido',
}
const PERIGO = ['cancelado', 'recusado_cliente', 'devolvida_sem_servico']

function Acoes({ sol, ocupado, mover }: {
  sol: Sol; ocupado: string
  mover: (para: string, extra?: Record<string, unknown>) => Promise<boolean>
}) {
  const [nota, setNota] = useState('')
  const [rastreio, setRastreio] = useState('')
  const [lacre, setLacre] = useState('')
  const opcoes = TRANSICOES_ADMIN[sol.status] || []
  if (!opcoes.length) return null

  return (
    <section className="ad-card ad-card-acao">
      <h2>Próximo passo</h2>
      {sol.status === 'aceito' && !sol.rastreio_ida && (
        <p className="ad-muted" style={{ marginTop: -6 }}>O cliente ainda não informou o rastreio de ida.</p>
      )}
      {opcoes.includes('recebida') && (
        <p className="ad-aviso"><IconWarning size={14} /> Ao marcar a chegada, cada carta aceita ganha o número de custódia. Filme a abertura do pacote antes.</p>
      )}
      {opcoes.includes('enviada') && (
        <div className="ad-valores">
          <label><span>Rastreio da volta</span><input className="ad-in" value={rastreio} onChange={e => setRastreio(e.target.value)} placeholder="AA123456789BR" /></label>
          <label><span>Lacre</span><input className="ad-in" value={lacre} onChange={e => setLacre(e.target.value)} placeholder="opcional" /></label>
        </div>
      )}
      <input className="ad-in" value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota para a linha do tempo (opcional)" maxLength={500} />
      <div className="ad-acoes">
        {opcoes.map(para => (
          <button
            key={para}
            type="button"
            className={`ad-bt${PERIGO.includes(para) ? ' ad-bt-perigo' : ' ad-bt-pri'}`}
            disabled={!!ocupado || (para === 'enviada' && !rastreio.trim())}
            onClick={async () => {
              if (PERIGO.includes(para) && !confirm(`${ROTULO_ACAO[para]}? Isso encerra o pedido.`)) return
              const ok = await mover(para, { nota, rastreio_volta: rastreio, lacre_volta: lacre })
              if (ok) { setNota(''); setRastreio(''); setLacre('') }
            }}
          >
            {ocupado === `status-${para}` ? 'Salvando...' : ROTULO_ACAO[para] || STATUS_SERVICO[para]}
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Uma carta ───────────────────────────────────────────────────────────────

function CartaAdmin({ idx, item, midias, ocupado, subir, salvarLaudo }: {
  idx: number; item: Item; midias: Midia[]; ocupado: string
  subir: (tipo: string, f: File) => void
  salvarLaudo: (laudo: Record<string, string>) => Promise<boolean>
}) {
  const [laudo, setLaudo] = useState<Record<string, string>>(item.laudo || {})
  const [abrirLaudo, setAbrirLaudo] = useState(!!item.laudo)

  return (
    <article className={`ad-item${item.aceito === false ? ' ad-item-recusado' : ''}`}>
      <div className="ad-item-topo">
        <div>
          <b>{idx + 1}. {item.nome}</b>
          <small>
            declarado {reais(item.valor_declarado_cents)}
            {item.card_id && <> · <a href={`/carta/${item.card_id}`} target="_blank" rel="noopener">ver no catálogo</a></>}
          </small>
        </div>
        {item.custodia && <span className="ad-custodia">{item.custodia}</span>}
      </div>
      {item.aceito === false && <p className="ad-erro" style={{ margin: 0 }}>Recusada: {item.recusa_motivo}</p>}
      {(item.queixas.length > 0 || item.obs) && (
        <p className="ad-queixas">{item.queixas.join(' · ')}{item.obs ? `${item.queixas.length ? ' — ' : ''}${item.obs}` : ''}</p>
      )}

      <div className="ad-midias">
        {midias.map(m => <Miniatura key={m.id} m={m} />)}
      </div>

      {item.aceito !== false && (
        <>
          <div className="ad-uploads">
            {MIDIAS_ADMIN.filter(m => m.porItem).map(m => (
              <BotaoUpload key={m.tipo} rotulo={m.rotulo} ocupado={ocupado === `midia-${m.tipo}-${item.id}`} aceitar={m.tipo === 'laudo' ? 'image/*,application/pdf' : 'image/*'} onFile={f => subir(m.tipo, f)} />
            ))}
          </div>

          <button type="button" className="ad-link" onClick={() => setAbrirLaudo(v => !v)}>{abrirLaudo ? 'Fechar laudo' : item.laudo ? 'Ver laudo' : 'Escrever laudo'}</button>
          {abrirLaudo && (
            <div className="ad-laudo">
              {CAMPOS_LAUDO.map(c => (
                <label key={c.k} className={c.k === 'caderno' ? 'ad-laudo-largo' : ''}>
                  <span>{c.rotulo}</span>
                  {c.k === 'caderno'
                    ? <textarea className="ad-in" rows={3} placeholder={c.ex} value={laudo[c.k] || ''} onChange={e => setLaudo(l => ({ ...l, [c.k]: e.target.value }))} />
                    : <input className="ad-in" placeholder={c.ex} value={laudo[c.k] || ''} onChange={e => setLaudo(l => ({ ...l, [c.k]: e.target.value }))} />}
                </label>
              ))}
              <button type="button" className="ad-bt ad-bt-pri ad-laudo-largo" disabled={!!ocupado} onClick={() => salvarLaudo(laudo)}>
                {ocupado === `laudo-${item.id}` ? 'Salvando...' : 'Salvar laudo'}
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}

function Miniatura({ m }: { m: Midia }) {
  const rotulo = ROTULO_MIDIA[m.tipo] || m.tipo
  if (!m.url) return <span className="ad-mini ad-mini-vazia">{rotulo}</span>
  return (
    <a className="ad-mini" href={m.url} target="_blank" rel="noopener" title={`${rotulo} · ${(m.tamanho / 1024).toFixed(0)} KB`}>
      {m.mime.startsWith('image/')
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.url} alt={rotulo} loading="lazy" />
        : <span className="ad-mini-arq">{m.mime.startsWith('video/') ? 'Vídeo' : 'PDF'}</span>}
      <small>{rotulo}</small>
    </a>
  )
}

function BotaoUpload({ rotulo, ocupado, aceitar, onFile }: { rotulo: string; ocupado: boolean; aceitar: string; onFile: (f: File) => void }) {
  return (
    <label className={`ad-up${ocupado ? ' ad-up-ocupado' : ''}`}>
      <input type="file" accept={aceitar} disabled={ocupado} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      <IconUpload size={14} /> {ocupado ? 'Enviando...' : rotulo}
    </label>
  )
}

const CSS = `
.sv-adm{padding:28px 24px 64px;max-width:1200px;margin:0 auto;font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text)}
.ad-voltar{display:inline-flex;align-items:center;gap:4px;min-height:36px;font-size:13px;color:var(--bx-text-2);text-decoration:none;margin-bottom:8px}
.ad-topo{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;margin-bottom:18px}
.ad-topo h1{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0 0 6px;font-variant-numeric:tabular-nums}
.ad-cliente{display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:13px;text-align:right}
.ad-cliente a{color:var(--bx-text-2)}
.ad-muted{font-size:13px;color:var(--bx-text-3);margin:0 0 4px;line-height:1.5}
.ad-pill{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;letter-spacing:0}
.ad-pill-bynx{color:var(--ac-1);background:rgba(var(--ac-1-rgb),.12)}
.ad-pill-cliente{color:var(--bx-blue);background:color-mix(in srgb,var(--bx-blue) 12%,transparent)}
.ad-pill-fim{color:var(--bx-text-3);background:var(--bx-surface-2)}
.ad-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start}
.ad-col{display:grid;gap:16px;min-width:0}
.ad-card{border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface);padding:18px;display:grid;gap:12px;min-width:0}
.ad-card h2{font-size:15px;font-weight:800;margin:0}
.ad-card-acao{border-color:rgba(var(--ac-1-rgb),.35)}
.ad-in{width:100%;min-height:40px;border-radius:9px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text);padding:9px 11px;font:inherit;font-size:14px;color-scheme:dark}
.ad-in:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.7)}
textarea.ad-in{resize:vertical}
.ad-bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:9px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;transition:opacity .15s ease}
.ad-bt:disabled{opacity:.5;cursor:not-allowed}
.ad-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.ad-bt-perigo{background:transparent;color:var(--bx-red);border-color:color-mix(in srgb,var(--bx-red) 40%,transparent)}
.ad-bt-whats{min-height:34px;font-size:12.5px}
.ad-link{justify-self:start;min-height:32px;padding:0;border:0;background:none;color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.ad-acoes{display:flex;flex-wrap:wrap;gap:8px}
.ad-ok{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--bx-green);margin:0 0 12px}
.ad-erro{font-size:13px;color:var(--bx-red);margin:0 0 12px}
.ad-aviso{display:flex;gap:6px;align-items:flex-start;font-size:12.5px;line-height:1.45;color:var(--bx-text-2);margin:0}
.ad-aviso svg{flex-shrink:0;margin-top:2px;color:var(--ac-1)}
.ad-obs{font-size:13px;line-height:1.5;color:var(--bx-text-2);margin:0;padding:10px 12px;border-radius:9px;background:var(--bx-surface-2);white-space:pre-wrap}

.ad-orc-itens{display:grid;gap:8px}
.ad-orc-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 12px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.ad-orc-l b{display:block;font-size:14px}
.ad-orc-l small{font-size:12px;color:var(--bx-text-3)}
.ad-orc-motivo{grid-column:1 / -1}
.ad-toggle{display:flex;border-radius:9px;overflow:hidden;border:1px solid var(--bx-border-2)}
.ad-toggle button{display:inline-flex;align-items:center;gap:4px;min-height:34px;padding:0 10px;border:0;background:transparent;color:var(--bx-text-3);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.ad-toggle button.on{background:color-mix(in srgb,var(--bx-green) 14%,transparent);color:var(--bx-green)}
.ad-toggle button.on.off{background:color-mix(in srgb,var(--bx-red) 14%,transparent);color:var(--bx-red)}
.ad-valores{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;align-items:end}
.ad-valores label{display:grid;gap:4px;font-size:12px;font-weight:600;color:var(--bx-text-2)}
.ad-total-orc{display:grid;gap:4px;font-size:12px;color:var(--bx-text-2);padding-bottom:9px}
.ad-total-orc b{font-size:18px;color:var(--bx-text);font-variant-numeric:tabular-nums}

.ad-dl{display:grid;gap:6px;margin:0}
.ad-dl div{display:flex;justify-content:space-between;gap:10px;font-size:13.5px}
.ad-dl dt{color:var(--bx-text-3)}
.ad-dl dd{margin:0;font-variant-numeric:tabular-nums;text-align:right}
.ad-total{padding-top:6px;border-top:1px solid var(--bx-border);font-weight:800}

.ad-itens{display:grid;gap:12px}
.ad-item{display:grid;gap:10px;padding:14px;border-radius:12px;background:var(--bx-bg);border:1px solid var(--bx-border)}
.ad-item-recusado{opacity:.75}
.ad-item-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.ad-item-topo b{display:block;font-size:15px}
.ad-item-topo small{font-size:12px;color:var(--bx-text-3)}
.ad-item-topo a{color:var(--bx-text-2)}
.ad-custodia{font-size:12px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:8px;border:1px solid rgba(var(--ac-1-rgb),.45);color:var(--ac-1);font-variant-numeric:tabular-nums;white-space:nowrap}
.ad-queixas{font-size:13px;color:var(--bx-text-2);margin:0}
.ad-midias{display:flex;flex-wrap:wrap;gap:8px}
.ad-mini{display:flex;flex-direction:column;gap:4px;width:92px;text-decoration:none;color:var(--bx-text-3)}
.ad-mini img,.ad-mini-arq{width:92px;height:128px;border-radius:8px;object-fit:cover;border:1px solid var(--bx-border);background:var(--bx-surface-2)}
.ad-mini-arq{display:grid;place-items:center;font-size:12px;font-weight:700;color:var(--bx-text-2)}
.ad-mini small{font-size:10.5px;line-height:1.3}
.ad-mini-vazia{font-size:11px;color:var(--bx-text-3)}
.ad-uploads{display:flex;flex-wrap:wrap;gap:6px}
.ad-up{position:relative;display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 10px;border-radius:8px;border:1px dashed var(--bx-border-2);font-size:12px;font-weight:600;color:var(--bx-text-2);cursor:pointer}
.ad-up:hover{border-color:rgba(var(--ac-1-rgb),.6);color:var(--bx-text)}
.ad-up input{position:absolute;inset:0;opacity:0;cursor:pointer}
.ad-up-ocupado{opacity:.6;cursor:progress}
.ad-laudo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ad-laudo label{display:grid;gap:4px;font-size:12px;font-weight:600;color:var(--bx-text-2)}
.ad-laudo-largo{grid-column:1 / -1}

.ad-tl{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.ad-tl li{display:grid;gap:2px;padding-left:12px;border-left:2px solid var(--bx-border-2)}
.ad-tl li:first-child{border-left-color:var(--ac-1)}
.ad-tl b{font-size:13.5px}
.ad-tl span{font-size:12.5px;color:var(--bx-text-2);line-height:1.45}
.ad-tl small{font-size:11px;color:var(--bx-text-3);font-variant-numeric:tabular-nums}

@media (max-width:980px){ .ad-grid{grid-template-columns:1fr} }
@media (max-width:640px){
  .sv-adm{padding:20px 16px 48px}
  .ad-cliente{align-items:flex-start;text-align:left}
  .ad-laudo{grid-template-columns:1fr}
}
`
