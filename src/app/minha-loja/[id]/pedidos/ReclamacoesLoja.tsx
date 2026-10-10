'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { fmtBRL } from '@/lib/comissao'
import { IconShield, IconClock, IconCheck } from '@/components/ui/Icons'
import GaleriaMidias from '@/components/servicos/GaleriaMidias'
import {
  MOTIVOS, STATUS_RECLAMACAO, RESPOSTAS_LOJA, DECISOES, DIAS_RECLAMAR, fmtPrazo, fotosParaGaleria,
  type MotivoReclamacao, type StatusReclamacao, type RespostaLoja, type Decisao,
} from '@/lib/leilao-reclamacao'

/**
 * Reclamacoes de pedidos de LEILAO no painel de pedidos da loja (Protecao
 * Bynx). A pagina so monta com LEILAO_ATIVO; se a rota responder 404 (flag
 * desligada no servidor), nada aparece.
 *
 * A loja responde em DIAS_UTEIS_LOJA dias uteis: aceitar o estorno, propor um acordo (valor)
 * ou enviar provas (texto com rastreio/links). Dinheiro nao se move aqui --
 * quem estorna e a Bynx.
 *
 * DESISTENCIA (motivo 'arrependimento', art. 49 do CDC): nao e reclamacao e
 * nao pesa na reputacao. Depois que o comprador posta a devolucao, a loja
 * confere: "Recebi a carta certa" estorna na hora; "Contestar" leva o caso
 * para a Bynx com o texto e o video. As fotos que a loja tirou no envio
 * aparecem aqui como referencia.
 */

interface Recl {
  id: string
  pedido_id: string
  motivo: MotivoReclamacao
  descricao: string
  video_url: string | null
  status: StatusReclamacao
  resposta_tipo: RespostaLoja | null
  resposta_loja: string | null
  contraproposta_cents: number | null
  prazo_loja_ate: string
  prazo_decisao_ate: string | null
  decisao: Decisao | null
  decisao_nota: string | null
  valor_estornado_cents: number
  created_at: string
  pedido: { numero: number; item_nome: string; rastreio: string | null; total_comprador_cents: number } | null
  fotos_url: string[]
  envio_fotos_url: string[]
  pode_responder: boolean
  sem_resposta: boolean
  pode_contestar: boolean
  postar_ate: string | null
  devolucao_rastreio: string | null
  devolucao_postada_em: string | null
  devolucao_entregue_em: string | null
  contestar_ate: string | null
  contestada_em: string | null
  contestacao_video_url: string | null
}

export default function ReclamacoesLoja({ lojaId }: { lojaId: string }) {
  const [lista, setLista] = useState<Recl[]>([])
  const [aberta, setAberta] = useState<string | null>(null)
  const [tipo, setTipo] = useState<RespostaLoja | null>(null)
  const [texto, setTexto] = useState('')
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [verFechadas, setVerFechadas] = useState(false)
  const [devAcao, setDevAcao] = useState<'liberar' | 'contestar' | null>(null)
  const [video, setVideo] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token || ''
    const r = await fetch(`/api/lojas/${lojaId}/reclamacoes`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' })
    if (!r.ok) return
    const j = await r.json().catch(() => ({}))
    setLista(j.reclamacoes || [])
  }, [lojaId])

  useEffect(() => { carregar() }, [carregar])

  async function responder(r: Recl) {
    if (!tipo) return
    setSalvando(true); setErro(null)
    try {
      const { data } = await supabase.auth.getSession()
      const cents = Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100)
      const res = await fetch(`/api/lojas/${lojaId}/reclamacoes/${r.id}/responder`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, texto: texto.trim(), contraproposta_cents: tipo === 'contraproposta' ? cents : null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Não foi possível responder.')
      setAberta(null); setTipo(null); setTexto(''); setValor('')
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function devolucao(r: Recl) {
    if (!devAcao) return
    setSalvando(true); setErro(null)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch(`/api/lojas/${lojaId}/reclamacoes/${r.id}/devolucao`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(devAcao === 'liberar' ? { acao: 'liberar' } : { acao: 'contestar', texto: texto.trim(), video_url: video.trim() || null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Não foi possível registrar.')
      setAberta(null); setDevAcao(null); setTexto(''); setVideo('')
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  if (!lista.length) return null
  const abertas = lista.filter(r => r.status === 'aguardando_loja' || r.status === 'em_analise' || r.status === 'aguardando_devolucao')
  const fechadas = lista.filter(r => !abertas.includes(r))
  const visiveis = verFechadas ? lista : abertas

  // Funcao que devolve JSX (nao componente): declarada aqui dentro, um
  // componente remontaria a cada tecla e o campo de texto perderia o foco.
  function cardDesistencia(r: Recl) {
    const aqui = aberta === r.id
    const aguardando = r.status === 'aguardando_devolucao'
    return (
      <div key={r.id} className={`rl-card${r.pode_contestar ? ' rl-urgente' : ''}`}>
        <div className="rl-head">
          <div style={{ minWidth: 0 }}>
            <b>Pedido #{r.pedido?.numero ?? ''} · {r.pedido?.item_nome ?? ''}</b>
            <span>{MOTIVOS.arrependimento}</span>
          </div>
          <span className={`rl-pill${r.pode_contestar ? ' rl-pill-hot' : ''}`}>
            {r.status === 'resolvida' ? <IconCheck size={11} color="currentColor" /> : aguardando ? <IconClock size={11} color="currentColor" /> : null}
            {aguardando
              ? (r.devolucao_entregue_em ? 'Entregue a você' : r.devolucao_postada_em ? 'Devolução postada' : 'Aguardando postagem')
              : STATUS_RECLAMACAO[r.status]}
          </span>
        </div>
        <p className="rl-desc">O comprador usou o direito de desistir em até {DIAS_RECLAMAR} dias. Isso não é reclamação e não afeta a sua reputação.</p>

        {aguardando && !r.devolucao_postada_em && r.postar_ate && (
          <p className="rl-mut rl-p">O comprador tem até {fmtPrazo(r.postar_ate)} para postar. Se não postar, a desistência expira e a venda continua valendo.</p>
        )}
        {r.devolucao_rastreio && (
          <div className="rl-quadro">
            <div className="rl-par"><span className="rl-mut">Rastreio da devolução</span><b>{r.devolucao_rastreio}</b></div>
            {r.devolucao_entregue_em && <div className="rl-par"><span className="rl-mut">Entregue na loja</span><span>{fmtPrazo(r.devolucao_entregue_em)}</span></div>}
          </div>
        )}
        {aguardando && r.devolucao_entregue_em && r.contestar_ate && r.pode_contestar && (
          <div className="rl-aviso">
            <b>O estorno sai sozinho em {fmtPrazo(r.contestar_ate)}</b>
            <span>Se a carta voltou trocada ou danificada, conteste antes disso com o vídeo da abertura do pacote. Sem contestação, o comprador recebe o estorno integral.</span>
          </div>
        )}
        {r.envio_fotos_url.length > 0 && (
          <>
            <div className="rl-rot">Fotos que você tirou no envio</div>
            <GaleriaMidias midias={fotosParaGaleria(r.envio_fotos_url)} tamanho={72} />
          </>
        )}
        {r.contestada_em && (
          <div className="rl-quadro">
            <div>Sua contestação</div>
            {r.resposta_loja && <div className="rl-cit">{r.resposta_loja}</div>}
            {r.contestacao_video_url && <a className="rl-link" href={r.contestacao_video_url} target="_blank" rel="noopener noreferrer nofollow">Ver o vídeo enviado</a>}
            {r.status === 'em_analise' && r.prazo_decisao_ate && <div className="rl-mut">A Bynx decide até {fmtPrazo(r.prazo_decisao_ate)}.</div>}
          </div>
        )}
        {r.decisao && (r.status === 'resolvida' || r.status === 'improcedente') && (
          <div className="rl-quadro">
            <div>{r.status === 'resolvida' ? 'Devolução concluída' : 'Encerrada'}{r.valor_estornado_cents > 0 ? <> · {fmtBRL(r.valor_estornado_cents)} estornado</> : null}</div>
            {r.decisao_nota && <div className="rl-cit">{r.decisao_nota}</div>}
          </div>
        )}

        {r.pode_contestar && (aqui && devAcao ? (
          <div className="rl-form">
            {devAcao === 'liberar' ? (
              <p className="rl-desc">Confirma que recebeu a carta certa, no estado em que enviou? O estorno integral sai agora e não dá para desfazer.</p>
            ) : (
              <>
                <textarea className="rl-input rl-area" value={texto} maxLength={2000} onChange={e => setTexto(e.target.value)}
                  placeholder="O que voltou diferente? Descreva a carta que chegou." />
                <input className="rl-input" value={video} onChange={e => setVideo(e.target.value)} inputMode="url"
                  placeholder="Link do vídeo da abertura do pacote, começando com https://" />
              </>
            )}
            {erro && <div className="rl-erro">{erro}</div>}
            <div className="rl-linha">
              <button type="button" className={`rl-bt ${devAcao === 'liberar' ? 'rl-bt-pri' : 'rl-bt-perigo'}`}
                disabled={salvando || (devAcao === 'contestar' && texto.trim().length < 10)} onClick={() => devolucao(r)}>
                {salvando ? 'Enviando…' : devAcao === 'liberar' ? 'Confirmar e estornar' : 'Enviar contestação'}
              </button>
              <button type="button" className="rl-bt" onClick={() => { setDevAcao(null); setErro(null) }}>Voltar</button>
            </div>
          </div>
        ) : (
          <div className="rl-form">
            <button type="button" className="rl-bt rl-bt-pri rl-full" onClick={() => { setAberta(r.id); setDevAcao('liberar'); setErro(null) }}>Recebi a carta certa, liberar estorno</button>
            <button type="button" className="rl-bt rl-bt-perigo rl-full" onClick={() => { setAberta(r.id); setDevAcao('contestar'); setTexto(''); setVideo(''); setErro(null) }}>Contestar: voltou diferente</button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="rl-wrap">
      <style>{CSS}</style>
      <div className="rl-topo">
        <div className="rl-tit"><IconShield size={16} color="var(--bx-amber)" />Reclamações e desistências de leilão</div>
        {fechadas.length > 0 && (
          <button type="button" className="rl-link" onClick={() => setVerFechadas(v => !v)}>
            {verFechadas ? 'Só as abertas' : `Ver encerradas (${fechadas.length})`}
          </button>
        )}
      </div>
      {!visiveis.length && <p className="rl-vazio">Nenhuma reclamação aberta.</p>}

      {visiveis.map(r => {
        if (r.motivo === 'arrependimento') return cardDesistencia(r)
        const urgente = r.pode_responder
        return (
          <div key={r.id} className={`rl-card${urgente ? ' rl-urgente' : ''}`}>
            <div className="rl-head">
              <div style={{ minWidth: 0 }}>
                <b>Pedido #{r.pedido?.numero ?? ''} · {r.pedido?.item_nome ?? ''}</b>
                <span>{MOTIVOS[r.motivo]}</span>
              </div>
              <span className={`rl-pill${urgente ? ' rl-pill-hot' : ''}`}>
                {urgente ? <IconClock size={11} color="currentColor" /> : r.status === 'resolvida' ? <IconCheck size={11} color="currentColor" /> : null}
                {r.sem_resposta ? 'Prazo encerrado' : STATUS_RECLAMACAO[r.status]}
              </span>
            </div>
            <p className="rl-desc">{r.descricao}</p>
            {r.fotos_url.length > 0 && (
              <GaleriaMidias midias={fotosParaGaleria(r.fotos_url)} tamanho={72} />
            )}
            {r.video_url && <a className="rl-link" href={r.video_url} target="_blank" rel="noopener noreferrer nofollow">Ver o vídeo enviado</a>}

            {urgente && <p className="rl-prazo">Responda até {fmtPrazo(r.prazo_loja_ate)} (horário de Brasília). Sem resposta, a decisão fica a favor do comprador.</p>}
            {r.sem_resposta && <p className="rl-prazo">O prazo para responder terminou. A Bynx vai decidir o caso.</p>}

            {r.resposta_tipo && (
              <div className="rl-quadro">
                <div>Sua resposta: <b>{RESPOSTAS_LOJA[r.resposta_tipo]}</b>{r.contraproposta_cents ? <> · {fmtBRL(r.contraproposta_cents)}</> : null}</div>
                {r.resposta_loja && <div className="rl-cit">{r.resposta_loja}</div>}
                {r.status === 'em_analise' && r.prazo_decisao_ate && <div className="rl-mut">A Bynx decide até {fmtPrazo(r.prazo_decisao_ate)}.</div>}
              </div>
            )}
            {r.decisao && (r.status === 'resolvida' || r.status === 'improcedente') && (
              <div className="rl-quadro">
                <div>Decisão da Bynx: <b>{DECISOES[r.decisao]}</b>{r.valor_estornado_cents > 0 ? <> · {fmtBRL(r.valor_estornado_cents)} estornado</> : null}</div>
                {r.decisao_nota && <div className="rl-cit">{r.decisao_nota}</div>}
              </div>
            )}

            {urgente && (aberta === r.id ? (
              <div className="rl-form">
                <div className="rl-opcoes">
                  {(Object.keys(RESPOSTAS_LOJA) as RespostaLoja[]).map(k => (
                    <button key={k} type="button" className={`rl-op${tipo === k ? ' rl-op-on' : ''}`} aria-pressed={tipo === k} onClick={() => setTipo(k)}>
                      {RESPOSTAS_LOJA[k]}
                    </button>
                  ))}
                </div>
                {tipo === 'contraproposta' && (
                  <input className="rl-input" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
                    placeholder="Valor que você propõe devolver, em R$" />
                )}
                <textarea className="rl-input rl-area" value={texto} maxLength={2000} onChange={e => setTexto(e.target.value)}
                  placeholder={tipo === 'aceitar' ? 'Mensagem ao comprador (opcional)' : 'Explique e cole o rastreio ou links das suas provas'} />
                {erro && <div className="rl-erro">{erro}</div>}
                <div className="rl-linha">
                  <button type="button" className="rl-bt rl-bt-pri" disabled={!tipo || salvando} onClick={() => responder(r)}>{salvando ? 'Enviando…' : 'Enviar resposta'}</button>
                  <button type="button" className="rl-bt" onClick={() => { setAberta(null); setErro(null) }}>Voltar</button>
                </div>
              </div>
            ) : (
              <button type="button" className="rl-bt rl-bt-pri rl-full" onClick={() => { setAberta(r.id); setTipo(null); setTexto(''); setValor(''); setErro(null) }}>Responder</button>
            ))}
          </div>
        )
      })}
    </section>
  )
}

const CSS = `
.rl-wrap{display:grid;gap:10px;margin-bottom:20px}
.rl-topo{display:flex;align-items:center;justify-content:space-between;gap:10px}
.rl-tit{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--bx-text)}
.rl-link{background:none;border:none;padding:0;color:var(--ac-1);font:inherit;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none}
.rl-vazio{font-size:12.5px;color:var(--bx-text-3);margin:0}
.rl-card{border:1px solid var(--bx-border);background:var(--bx-surface);border-radius:14px;padding:14px;display:grid;gap:8px;color:var(--bx-text)}
.rl-urgente{border-color:color-mix(in srgb,var(--bx-amber) 45%,transparent)}
.rl-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.rl-head b{display:block;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rl-head span{font-size:12px;color:var(--bx-text-3)}
.rl-pill{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;font-size:10.5px;font-weight:800;padding:4px 9px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text-2) !important}
.rl-pill-hot{background:color-mix(in srgb,var(--bx-amber) 14%,transparent);color:var(--bx-amber) !important}
.rl-desc{margin:0;font-size:12.5px;line-height:1.55;color:var(--bx-text-2);white-space:pre-wrap;overflow-wrap:anywhere}
.rl-prazo{margin:0;font-size:12px;color:var(--bx-amber)}
.rl-quadro{padding:10px 12px;border-radius:10px;background:var(--bx-surface-2);font-size:12.5px;line-height:1.5;display:grid;gap:4px}
.rl-cit{color:var(--bx-text-2);white-space:pre-wrap;overflow-wrap:anywhere}
.rl-mut{color:var(--bx-text-3)}
.rl-form{display:grid;gap:8px}
.rl-opcoes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.rl-op{min-height:44px;padding:6px 8px;border-radius:10px;border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.rl-op-on{border-color:rgba(var(--ac-1-rgb),.55);background:rgba(var(--ac-1-rgb),.1);color:var(--bx-text)}
.rl-input{width:100%;box-sizing:border-box;background:var(--bx-surface-2);border:1px solid var(--bx-border);border-radius:10px;padding:11px 12px;color:var(--bx-text);font:inherit;font-size:13px;outline:none}
.rl-area{min-height:80px;resize:vertical}
.rl-erro{font-size:12.5px;color:var(--bx-red)}
.rl-linha{display:flex;gap:8px}
.rl-bt{min-height:44px;padding:0 16px;border-radius:11px;border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s ease}
.rl-bt:disabled{opacity:.55;cursor:not-allowed}
.rl-bt-pri{flex:1;border:none;background:var(--ac-grad);color:var(--bx-text)}
.rl-full{width:100%}
.rl-bt-perigo{flex:1;border:1px solid color-mix(in srgb,var(--bx-red) 45%,transparent);background:color-mix(in srgb,var(--bx-red) 8%,transparent);color:var(--bx-red)}
.rl-p{margin:0;font-size:12.5px;line-height:1.5}
.rl-par{display:flex;justify-content:space-between;gap:10px}
.rl-rot{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.rl-aviso{display:grid;gap:4px;padding:10px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--bx-amber) 30%,transparent);background:color-mix(in srgb,var(--bx-amber) 8%,transparent);font-size:12.5px;line-height:1.5;color:var(--bx-text-2)}
.rl-aviso b{color:var(--bx-amber)}
@media (max-width:480px){.rl-opcoes{grid-template-columns:1fr}}
`
