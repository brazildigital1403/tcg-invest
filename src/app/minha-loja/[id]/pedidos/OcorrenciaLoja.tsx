'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { fmtBRL } from '@/lib/comissao'
import { IconCheck, IconTruck, IconLoja, IconCard } from '@/components/ui/Icons'
import GaleriaMidias from '@/components/servicos/GaleriaMidias'
import {
  MOTIVOS, RESPOSTAS_LOJA, DECISOES, DIAS_RECLAMAR, TIPOS_CONTESTACAO, DESTINOS_CARTA, fmtPrazo, fotosParaGaleria,
  type TipoContestacao, type MotivoReclamacao, type StatusReclamacao, type RespostaLoja, type Decisao,
} from '@/lib/leilao-reclamacao'

/**
 * Reclamacao ou desistencia DENTRO do card do pedido (painel da loja, aberto).
 * Substitui o antigo bloco solto ReclamacoesLoja (11/10): o card e um caso
 * so, e a faixa "quem age / ate quando" fica no card; aqui vem o detalhe e
 * as acoes.
 *
 *   reclamacao  -> o que o comprador contou (texto, fotos, video); a loja
 *                  responde em DIAS_UTEIS_LOJA (aceitar, acordo, provas);
 *                  resposta e decisao da Bynx.
 *   desistencia -> linha do tempo, rastreio da devolucao, as fotos que a loja
 *                  tirou no envio e "Recebi a carta certa" / "Contestar".
 * Dinheiro: so o "liberar" da desistencia estorna (rota da loja); o resto
 * quem decide e a Bynx.
 */

export interface Recl {
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
  contestacao_tipo: TipoContestacao | null
  destino_carta: keyof typeof DESTINOS_CARTA | null
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}

export default function OcorrenciaLoja({ r, lojaId, onMudou }: { r: Recl; lojaId: string; onMudou: () => void }) {
  const [tipo, setTipo] = useState<RespostaLoja | null>(null)
  const [devAcao, setDevAcao] = useState<'liberar' | 'contestar' | null>(null)
  const [texto, setTexto] = useState('')
  const [valor, setValor] = useState('')
  const [video, setVideo] = useState('')
  const [contTipo, setContTipo] = useState<TipoContestacao | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function enviar(url: string, body: Record<string, unknown>) {
    setSalvando(true); setErro(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await bearer()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Não foi possível registrar.')
      setTipo(null); setDevAcao(null); setTexto(''); setValor(''); setVideo(''); setContTipo(null)
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const fechada = r.status === 'resolvida' || r.status === 'improcedente'

  // ── Desistencia ──
  if (r.motivo === 'arrependimento') {
    const etapa = r.status === 'resolvida' ? 4 : r.devolucao_entregue_em || r.contestada_em ? 2 : r.devolucao_postada_em ? 2 : 1
    return (
      <div className="oc">
        <style>{CSS}</style>
        {r.status !== 'improcedente' && (
          <ol className="oc-tl" aria-label="Etapas da devolução">
            {[
              { rot: 'Desistência', Ic: IconCheck },
              { rot: 'Postada', Ic: IconTruck },
              { rot: 'Você confere', Ic: IconLoja },
              { rot: 'Estorno', Ic: IconCard },
            ].map((p, i) => {
              const feito = i < etapa
              const atual = i === etapa
              const Ic = feito ? IconCheck : p.Ic
              return (
                <li key={p.rot} className={`oc-tl-p${feito ? ' oc-feito' : ''}${atual ? ' oc-atual' : ''}`} aria-current={atual ? 'step' : undefined}>
                  <span className="oc-tl-ic"><Ic size={17} color="currentColor" /></span>
                  <span className="oc-tl-rot">{p.rot}</span>
                </li>
              )
            })}
          </ol>
        )}

        {r.devolucao_rastreio && (
          <div className="oc-par"><IconTruck size={15} color="var(--bx-text-3)" /><span>Rastreio da devolução</span><b>{r.devolucao_rastreio}</b></div>
        )}
        {r.devolucao_entregue_em && <div className="oc-par"><span>Entregue na loja</span><b>{fmtPrazo(r.devolucao_entregue_em)}</b></div>}

        {r.envio_fotos_url.length > 0 && (
          <div className="oc-bloco">
            <div className="oc-rot">Fotos que você tirou no envio</div>
            <GaleriaMidias midias={fotosParaGaleria(r.envio_fotos_url)} tamanho={72} />
          </div>
        )}

        {r.contestada_em && (
          <div className="oc-quadro">
            <div className="oc-mut">Sua contestação{r.contestacao_tipo ? <> · {TIPOS_CONTESTACAO[r.contestacao_tipo]}</> : null}</div>
            {r.resposta_loja && <div className="oc-cit">{r.resposta_loja}</div>}
            {r.contestacao_video_url && <a className="oc-link" href={r.contestacao_video_url} target="_blank" rel="noopener noreferrer nofollow">Ver o vídeo enviado</a>}
          </div>
        )}
        {fechada && (
          <div className="oc-quadro">
            <div>{r.status === 'resolvida' ? 'Devolução concluída' : 'Desistência encerrada'}{r.valor_estornado_cents > 0 ? <> · {fmtBRL(r.valor_estornado_cents)} estornado</> : null}</div>
            {r.destino_carta && <div className="oc-cit">O que chegou: {DESTINOS_CARTA[r.destino_carta].toLowerCase()}.</div>}
            {r.decisao_nota && <div className="oc-cit">{r.decisao_nota}</div>}
          </div>
        )}

        <p className="oc-legal">Desistência em até {DIAS_RECLAMAR} dias é direito do comprador. Não é reclamação e não afeta a sua reputação.</p>

        {r.pode_contestar && (devAcao ? (
          <div className="oc-form">
            {devAcao === 'liberar' ? (
              <p className="oc-txt">Confirma que recebeu a carta certa, no estado em que enviou? O estorno integral sai agora e não dá para desfazer.</p>
            ) : (
              <>
                <div className="oc-opcoes oc-opcoes-2" role="group" aria-label="O que voltou">
                  {(Object.keys(TIPOS_CONTESTACAO) as TipoContestacao[]).map(k => (
                    <button key={k} type="button" className={`oc-op${contTipo === k ? ' oc-op-on' : ''}`} aria-pressed={contTipo === k} onClick={() => setContTipo(k)}>
                      {TIPOS_CONTESTACAO[k]}
                    </button>
                  ))}
                </div>
                {contTipo && (
                  <p className="oc-txt">{contTipo === 'dano'
                    ? 'A carta certa voltou, mas com dano novo. A Bynx decide entre estorno total ou parcial, e a carta fica com você.'
                    : 'Voltou outra carta, uma de menor valor ou nada. O vídeo da abertura do pacote é obrigatório. Comprovada a troca, não há estorno.'}</p>
                )}
                <textarea className="oc-input oc-area" value={texto} maxLength={2000} onChange={e => setTexto(e.target.value)}
                  placeholder="O que voltou diferente? Descreva a carta que chegou." aria-label="Motivo da contestação" />
                <input className="oc-input" value={video} onChange={e => setVideo(e.target.value)} inputMode="url"
                  placeholder={contTipo === 'troca' ? 'Link do vídeo da abertura do pacote (obrigatório)' : 'Link do vídeo da abertura do pacote (opcional)'} aria-label="Link do vídeo" />
              </>
            )}
            {erro && <div className="oc-erro">{erro}</div>}
            <button type="button" className={`oc-bt ${devAcao === 'liberar' ? 'oc-pri' : 'oc-perigo'}`}
              disabled={salvando || (devAcao === 'contestar' && (!contTipo || texto.trim().length < 10 || (contTipo === 'troca' && !video.trim())))}
              onClick={() => enviar(`/api/lojas/${lojaId}/reclamacoes/${r.id}/devolucao`, devAcao === 'liberar'
                ? { acao: 'liberar' }
                : { acao: 'contestar', tipo: contTipo, texto: texto.trim(), video_url: video.trim() || null })}>
              {salvando ? 'Enviando…' : devAcao === 'liberar' ? 'Confirmar e estornar' : 'Enviar contestação'}
            </button>
            <button type="button" className="oc-bt oc-ghost" disabled={salvando} onClick={() => { setDevAcao(null); setErro(null) }}>Voltar</button>
          </div>
        ) : (
          <div className="oc-form">
            <button type="button" className="oc-bt oc-pri" onClick={() => setDevAcao('liberar')}>Recebi a carta certa, liberar estorno</button>
            <button type="button" className="oc-bt oc-perigo" onClick={() => { setDevAcao('contestar'); setTexto(''); setVideo(''); setContTipo(null) }}>Contestar: voltou diferente</button>
          </div>
        ))}
      </div>
    )
  }

  // ── Reclamacao ──
  return (
    <div className="oc">
      <style>{CSS}</style>
      <div className="oc-bloco">
        <div className="oc-rot">O que o comprador contou · {MOTIVOS[r.motivo]}</div>
        <p className="oc-cit">{r.descricao}</p>
        {r.fotos_url.length > 0 && <GaleriaMidias midias={fotosParaGaleria(r.fotos_url)} tamanho={72} />}
        {r.video_url && <a className="oc-link" href={r.video_url} target="_blank" rel="noopener noreferrer nofollow">Ver o vídeo enviado</a>}
      </div>

      {r.sem_resposta && <p className="oc-alerta">O prazo para responder terminou. Sem resposta, a decisão fica a favor do comprador.</p>}

      {r.resposta_tipo && (
        <div className="oc-quadro">
          <div>Sua resposta: <b>{RESPOSTAS_LOJA[r.resposta_tipo]}</b>{r.contraproposta_cents ? <> · {fmtBRL(r.contraproposta_cents)}</> : null}</div>
          {r.resposta_loja && <div className="oc-cit">{r.resposta_loja}</div>}
        </div>
      )}
      {r.decisao && fechada && (
        <div className="oc-quadro">
          <div>Decisão da Bynx: <b>{DECISOES[r.decisao]}</b>{r.valor_estornado_cents > 0 ? <> · {fmtBRL(r.valor_estornado_cents)} estornado</> : null}</div>
          {r.decisao_nota && <div className="oc-cit">{r.decisao_nota}</div>}
        </div>
      )}

      {r.pode_responder && (
        <div className="oc-form">
          <div className="oc-rot">Sua resposta</div>
          <div className="oc-opcoes">
            {(Object.keys(RESPOSTAS_LOJA) as RespostaLoja[]).map(k => (
              <button key={k} type="button" className={`oc-op${tipo === k ? ' oc-op-on' : ''}`} aria-pressed={tipo === k} onClick={() => setTipo(k)}>
                {RESPOSTAS_LOJA[k]}
              </button>
            ))}
          </div>
          {tipo === 'contraproposta' && (
            <input className="oc-input" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
              placeholder="Valor que você propõe devolver, em R$" aria-label="Valor da proposta" />
          )}
          {tipo && (
            <textarea className="oc-input oc-area" value={texto} maxLength={2000} onChange={e => setTexto(e.target.value)}
              aria-label="Mensagem"
              placeholder={tipo === 'aceitar' ? 'Mensagem ao comprador (opcional)' : 'Explique e cole o rastreio ou links das suas provas'} />
          )}
          {erro && <div className="oc-erro">{erro}</div>}
          <button type="button" className="oc-bt oc-pri" disabled={!tipo || salvando}
            onClick={() => enviar(`/api/lojas/${lojaId}/reclamacoes/${r.id}/responder`, {
              tipo, texto: texto.trim(),
              contraproposta_cents: tipo === 'contraproposta' ? Math.round(Number(valor.replace(/\./g, '').replace(',', '.')) * 100) : null,
            })}>
            {salvando ? 'Enviando…' : 'Enviar resposta'}
          </button>
        </div>
      )}
    </div>
  )
}

const CSS = `
.oc{display:grid;gap:12px}
.oc-tl{list-style:none;margin:2px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));position:relative}
.oc-tl::before{content:'';position:absolute;top:18px;left:12.5%;right:12.5%;height:1px;background:var(--bx-border-2)}
.oc-tl-p{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0}
.oc-tl-ic{width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--bx-surface-2);border:1px solid var(--bx-border-2);color:var(--bx-text-3)}
.oc-tl-rot{font-size:11.5px;line-height:1.3;color:var(--bx-text-3);font-weight:600}
.oc-feito .oc-tl-ic{color:var(--bx-green);border-color:color-mix(in srgb,var(--bx-green) 45%,transparent);background:color-mix(in srgb,var(--bx-green) 10%,var(--bx-surface-2))}
.oc-atual .oc-tl-ic{color:var(--ac-1);border-color:rgba(var(--ac-1-rgb),.6);background:rgba(var(--ac-1-rgb),.12)}
.oc-atual .oc-tl-rot{color:var(--bx-text)}
.oc-par{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--bx-text-2)}
.oc-par b{margin-left:auto;color:var(--bx-text);letter-spacing:.03em}
.oc-bloco{display:grid;gap:8px}
.oc-rot{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.oc-cit{margin:0;font-size:13px;line-height:1.55;color:var(--bx-text-2);white-space:pre-wrap;overflow-wrap:anywhere}
.oc-txt{margin:0;font-size:13px;line-height:1.5;color:var(--bx-text-2)}
.oc-mut{color:var(--bx-text-3)}
.oc-legal{margin:0;font-size:12px;line-height:1.5;color:var(--bx-text-3)}
.oc-alerta{margin:0;font-size:12.5px;line-height:1.5;color:var(--bx-red)}
.oc-quadro{padding:10px 12px;border-radius:8px;background:var(--bx-surface-2);font-size:13px;line-height:1.5;display:grid;gap:4px}
.oc-link{color:var(--ac-1);font-size:12.5px;font-weight:700;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.oc-form{display:grid;gap:8px}
.oc-opcoes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.oc-opcoes-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.oc-op{min-height:44px;padding:6px 8px;border-radius:10px;border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.oc-op-on{border-color:rgba(var(--ac-1-rgb),.55);background:rgba(var(--ac-1-rgb),.1);color:var(--bx-text)}
.oc-input{width:100%;box-sizing:border-box;min-height:44px;background:var(--bx-surface-2);border:1px solid var(--bx-border);border-radius:10px;padding:10px 12px;color:var(--bx-text);font:inherit;font-size:16px;outline:none;transition:border-color .15s ease}
.oc-input:focus{border-color:var(--bx-border-2)}
.oc-area{min-height:88px;resize:vertical}
.oc-erro{font-size:12.5px;color:var(--bx-red)}
.oc-bt{min-height:44px;width:100%;padding:0 16px;border-radius:10px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;transition:opacity .15s ease,background .15s ease}
.oc-bt:disabled{opacity:.55;cursor:not-allowed}
.oc-pri{border:none;background:var(--ac-grad);color:var(--bx-brand-ink)}
.oc-perigo{border:1px solid color-mix(in srgb,var(--bx-red) 45%,transparent);background:color-mix(in srgb,var(--bx-red) 8%,transparent);color:var(--bx-red);font-size:13.5px;font-weight:700}
.oc-ghost{border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font-size:13px;font-weight:700}
@media (max-width:480px){.oc-opcoes{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.oc-op,.oc-input,.oc-bt{transition:none}}
`
