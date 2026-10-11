'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { fmtBRL } from '@/lib/comissao'
import { comprimirImagem } from '@/lib/comprimirImagem'
import {
  IconShield, IconCamera, IconCheck, IconWarning, IconClock, IconBox, IconTruck, IconLoja, IconCard, IconLocation, IconCopy,
  IconChevronDown, IconChevronRight,
} from '@/components/ui/Icons'
import {
  MOTIVOS, LISTA_MOTIVOS, SLOTS_FOTO, ROTULO_SLOT, STATUS_RECLAMACAO, RESPOSTAS_LOJA, DECISOES,
  ROTULO_BOTAO_PROBLEMA, TEXTO_PROTECAO, DIAS_UTEIS_ENVIO, DIAS_POSTAR_DEVOLUCAO, motivoExigeFoto, podeReclamar,
  podeCancelarPorAtraso, podeDesistir, podeInformarPostagem, validarRastreio, prazoEnvio,
  fmtPrazo, type MotivoReclamacao, type SlotFoto, type StatusReclamacao, type RespostaLoja, type Decisao,
} from '@/lib/leilao-reclamacao'

/**
 * Protecao Bynx no /pedido/[id] -- SO pedido de leilao, SO o comprador.
 * (A pagina ja confere LEILAO_ATIVO e souComprador antes de montar.)
 *
 *   pago     -> prazo de envio da loja (DIAS_UTEIS_ENVIO); passado, o botao de
 *               cancelar com estorno integral.
 *   enviado / entregue dentro de DIAS_RECLAMAR -> "Tive um problema com este pedido"
 *               e o formulario (motivo, descricao, 3 fotos quando o motivo
 *               pede, video opcional).
 *   com reclamacao -> o estado dela (resposta da loja, decisao, valor).
 *
 * Fotos: comprime no navegador (webp 1600px), pede a URL assinada a
 * /api/pedidos/[id]/reclamacao/upload-url e sobe direto no bucket privado.
 * O servidor confere que cada arquivo existe antes de gravar.
 *
 * DESISTENCIA (art. 49 do CDC, /api/pedidos/[id]/desistir):
 *   pago      -> "Desistir da compra": estorno integral na hora;
 *   enviado / entregue dentro de DIAS_RECLAMAR -> confirmacao (3 passos +
 *               "devolvo no estado em que recebi") e abre a devolucao;
 *   aberta    -> endereco da loja, prazo e campo do rastreio; depois o
 *               andamento (postada, entregue na loja, contestada, estornada).
 */

export interface PedidoProtecao {
  id: string
  status: string
  leilao_id?: string | null
  pago_em: string | null
  enviado_em: string | null
  entregue_em?: string | null
  prazo_reclamacao_ate?: string | null
  reclamacao_aberta?: boolean | null
  recebido_automatico?: boolean | null
  em_disputa?: boolean | null
  total_comprador_cents?: number
}

interface Reclamacao {
  id: string
  motivo: MotivoReclamacao
  descricao: string
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
  postar_ate: string | null
  devolucao_rastreio: string | null
  devolucao_postada_em: string | null
  devolucao_entregue_em: string | null
  contestar_ate: string | null
  contestada_em: string | null
}

interface EnderecoLoja { nome: string; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null }

type Fotos = Partial<Record<SlotFoto, File>>

type Passo = { rotulo: string; Icone: typeof IconBox }
const PASSOS_CONFIRMAR: Passo[] = [
  { rotulo: 'Embale', Icone: IconBox },
  { rotulo: `Poste em ${DIAS_POSTAR_DEVOLUCAO} dias`, Icone: IconTruck },
  { rotulo: 'Loja recebe', Icone: IconLoja },
  { rotulo: 'Estorno integral', Icone: IconCard },
]
const PASSOS_ANDAMENTO: Passo[] = [
  { rotulo: 'Desistência', Icone: IconCheck },
  { rotulo: 'Postar', Icone: IconTruck },
  { rotulo: 'Loja recebe', Icone: IconLoja },
  { rotulo: 'Estorno', Icone: IconCard },
]

const PASSOS_RECLAMACAO: Passo[] = [
  { rotulo: 'Você contou', Icone: IconCheck },
  { rotulo: 'Loja responde', Icone: IconLoja },
  { rotulo: 'Bynx decide', Icone: IconShield },
  { rotulo: 'Resultado', Icone: IconCard },
]

/** Seta de volta (desistir): nao existe no Icons.tsx. */
function IconVolta({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  )
}

/** "18/10" em Brasilia. */
function fmtData(v: string | null | undefined): string {
  return fmtPrazo(v).split(' ')[0] || ''
}

/**
 * Linha do tempo da devolucao. `etapa` = indice da etapa atual (as anteriores
 * aparecem feitas); -1 = so explica o caminho, nada aceso.
 */
function LinhaDevolucao({ passos, etapa, rotulo = 'Etapas da devolução' }: { passos: Passo[]; etapa: number; rotulo?: string }) {
  return (
    <ol className="pb-tl" aria-label={rotulo}>
      {passos.map((p, i) => {
        const feito = etapa >= 0 && i < etapa
        const atual = i === etapa
        const Ic = feito ? IconCheck : p.Icone
        return (
          <li key={p.rotulo} className={`pb-tl-p${feito ? ' pb-tl-feito' : ''}${atual ? ' pb-tl-atual' : ''}`} aria-current={atual ? 'step' : undefined}>
            <span className="pb-tl-ic"><Ic size={18} color="currentColor" /></span>
            <span className="pb-tl-rot">{p.rotulo}</span>
          </li>
        )
      })}
    </ol>
  )
}

export default function ProtecaoBynx({ pedido, onMudou }: { pedido: PedidoProtecao; onMudou: () => void }) {
  const [ehLeilao, setEhLeilao] = useState<boolean | null>(pedido.leilao_id ? true : null)
  const [recls, setRecls] = useState<Reclamacao[]>([])
  const [aberto, setAberto] = useState(false)
  const [motivo, setMotivo] = useState<MotivoReclamacao | null>(null)
  const [descricao, setDescricao] = useState('')
  const [video, setVideo] = useState('')
  const [fotos, setFotos] = useState<Fotos>({})
  const [enviando, setEnviando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [confirmaCancelar, setConfirmaCancelar] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const [desistindo, setDesistindo] = useState(false)
  const [confirmo, setConfirmo] = useState(false)
  const [rastreio, setRastreio] = useState('')
  const [endereco, setEndereco] = useState<EnderecoLoja | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from('pedido_reclamacoes')
      .select('id, motivo, descricao, status, resposta_tipo, resposta_loja, contraproposta_cents, prazo_loja_ate, prazo_decisao_ate, decisao, decisao_nota, valor_estornado_cents, created_at, postar_ate, devolucao_rastreio, devolucao_postada_em, devolucao_entregue_em, contestar_ate, contestada_em')
      .eq('pedido_id', pedido.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setRecls((data || []) as Reclamacao[])
    setAgora(Date.now())
  }, [pedido.id])

  useEffect(() => {
    let ativo = true
    ;(async () => {
      if (!pedido.leilao_id) {
        const { data } = await supabase.from('pedido_itens').select('id').eq('pedido_id', pedido.id).not('leilao_id', 'is', null).limit(1)
        if (!ativo) return
        setEhLeilao((data?.length ?? 0) > 0)
      }
      await carregar()
    })()
    return () => { ativo = false }
  }, [pedido.id, pedido.leilao_id, carregar])

  const devolucaoAberta = recls[0]?.motivo === 'arrependimento' && recls[0]?.status === 'aguardando_devolucao' && !recls[0]?.devolucao_postada_em
  useEffect(() => {
    if (!devolucaoAberta || endereco) return
    let ativo = true
    ;(async () => {
      const r = await authFetch(`/api/pedidos/${pedido.id}/desistir`)
      const j = await r.json().catch(() => ({}))
      if (ativo && r.ok && j.loja) setEndereco(j.loja as EnderecoLoja)
    })()
    return () => { ativo = false }
  }, [devolucaoAberta, endereco, pedido.id])

  if (!ehLeilao) return null

  // 'cancelando': uma tentativa de cancelamento por atraso caiu no meio. O
  // card segue como pago para o comprador poder repetir (o estorno e reaproveitado).
  const emCancelamento = pedido.status === 'cancelando'
  const base = { ...pedido, status: emCancelamento ? 'pago' : pedido.status, ehLeilao: true }
  const pode = podeReclamar(base, agora)
  const cancelar = podeCancelarPorAtraso(base, agora)
  const limiteEnvio = prazoEnvio(base)
  const atual = recls[0] || null
  const desist = podeDesistir(base, agora)
  const ehDesistencia = atual?.motivo === 'arrependimento'
  const rastreioOk = !!validarRastreio(rastreio)
  const temAjuda = pode.pode || (desist.pode && !cancelar.pode)
  const protecaoAte = pode.pode ? pode.ate : desist.pode && desist.modo === 'devolucao' ? desist.ate : null
  // Formulario aberto (reclamar ou desistir) mantem o bloco aberto.
  const ajudaVisivel = ajudaAberta || aberto || desistindo
  // Avisa so quando ja tem tamanho de codigo e nao bate (antes disso, ainda digitando).
  const rastreioInvalido = !rastreioOk && rastreio.replace(/[\s.-]/g, '').length >= 13
  const exigeFoto = motivo ? motivoExigeFoto(motivo) : false
  const fotosOk = !exigeFoto || SLOTS_FOTO.every(s => fotos[s])
  const podeEnviar = !!motivo && descricao.trim().length >= 10 && fotosOk && !enviando

  async function enviar() {
    if (!motivo) return
    setErro(null)
    try {
      const paths: string[] = []
      if (exigeFoto || Object.keys(fotos).length) {
        const slots = SLOTS_FOTO.filter(s => fotos[s])
        for (let i = 0; i < slots.length; i++) {
          const slot = slots[i]
          setEnviando(`Enviando foto ${i + 1} de ${slots.length}`)
          const arq = await comprimirImagem(fotos[slot]!)
          const r = await authFetch(`/api/pedidos/${pedido.id}/reclamacao/upload-url`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot, mime: arq.type }),
          })
          const u = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(u.error || 'Não foi possível enviar a foto.')
          const { error } = await supabase.storage.from('reclamacoes').uploadToSignedUrl(u.path, u.token, arq, { contentType: arq.type })
          if (error) throw new Error('A foto não subiu. Confira sua conexão e tente de novo.')
          paths.push(u.path)
        }
      }
      setEnviando('Registrando a reclamação')
      const r = await authFetch(`/api/pedidos/${pedido.id}/reclamacao`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo, descricao: descricao.trim(), fotos: paths, video_url: video.trim() || null }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não foi possível registrar a reclamação.')
      setOk(true); setAberto(false)
      await carregar()
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  async function desistir() {
    setErro(null); setEnviando('Registrando')
    try {
      const r = await authFetch(`/api/pedidos/${pedido.id}/desistir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmo }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não foi possível registrar a desistência.')
      setDesistindo(false); setConfirmo(false)
      await carregar()
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  async function informarPostagem() {
    setErro(null); setEnviando('Enviando')
    try {
      const r = await authFetch(`/api/pedidos/${pedido.id}/desistir/postagem`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rastreio }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não foi possível registrar a postagem.')
      setRastreio('')
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  async function pedirCancelamento() {
    setErro(null); setEnviando('Cancelando')
    try {
      const r = await authFetch(`/api/pedidos/${pedido.id}/cancelar-atraso`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não foi possível cancelar.')
      setConfirmaCancelar(false)
      onMudou()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEnviando(null)
    }
  }

  return (
    <div className="pb-wrap">
      <style>{CSS}</style>

      {/* Pago: prazo de envio da loja / cancelamento por atraso */}
      {(pedido.status === 'pago' || emCancelamento) && (
        cancelar.pode ? (
          <div className="pb-card pb-alerta">
            <div className="pb-head"><IconWarning size={18} color="var(--bx-amber)" /><b>A loja não enviou no prazo</b></div>
            <p className="pb-txt">O prazo de {DIAS_UTEIS_ENVIO} dias úteis para o envio terminou{limiteEnvio ? ` em ${fmtPrazo(limiteEnvio)}` : ''}. Você pode cancelar e receber o valor de volta, integralmente.</p>
            {confirmaCancelar ? (
              <div className="pb-linha">
                <button type="button" className="pb-bt pb-bt-perigo" disabled={!!enviando} onClick={pedirCancelamento}>{enviando || 'Confirmar cancelamento'}</button>
                <button type="button" className="pb-bt pb-bt-ghost" onClick={() => setConfirmaCancelar(false)}>Voltar</button>
              </div>
            ) : (
              <button type="button" className="pb-bt pb-bt-perigo" onClick={() => setConfirmaCancelar(true)}>Cancelar e receber o estorno</button>
            )}
          </div>
        ) : null
      )}

      {/* Desistencia com devolucao em andamento */}
      {atual && ehDesistencia && (() => {
        const etapa = atual.status === 'resolvida' ? 4
          : atual.devolucao_entregue_em || atual.status === 'em_analise' ? 3
          : atual.devolucao_postada_em ? 2
          : 1
        const aPostar = atual.status === 'aguardando_devolucao' && !atual.devolucao_postada_em
        const enderecoTxt = endereco
          ? [endereco.endereco, [endereco.cidade, endereco.estado].filter(Boolean).join(' - '), endereco.cep].filter(Boolean).join(' · ')
          : ''
        return (
          <div className={`pb-card${atual.status === 'resolvida' ? ' pb-ok' : aPostar ? ' pb-alerta' : ''}`}>
            <div className="pb-titulo">
              {atual.status === 'resolvida' ? 'Devolução concluída'
                : atual.status === 'improcedente' ? 'Desistência encerrada'
                : atual.status === 'em_analise' ? 'Devolução em análise'
                : atual.devolucao_entregue_em ? 'A loja está conferindo'
                : atual.devolucao_postada_em ? 'Devolução a caminho'
                : <>Poste até <span className="pb-dest">{fmtData(atual.postar_ate)}</span></>}
            </div>

            {atual.status !== 'improcedente' && <LinhaDevolucao passos={PASSOS_ANDAMENTO} etapa={etapa} />}

            {aPostar && (
              <>
                {endereco && (
                  <div className="pb-end">
                    <IconLocation size={18} color="var(--bx-text-3)" />
                    <div className="pb-end-txt">
                      <b>{endereco.nome}</b>
                      <span>{enderecoTxt}</span>
                    </div>
                    <button type="button" className="pb-copiar" aria-label="Copiar endereço"
                      onClick={() => { navigator.clipboard?.writeText(`${endereco.nome}\n${enderecoTxt}`).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1600) }).catch(() => {}) }}>
                      {copiado ? <IconCheck size={16} color="var(--bx-green)" /> : <IconCopy size={16} color="currentColor" />}
                    </button>
                  </div>
                )}
                <div className="pb-dica"><IconBox size={15} color="var(--bx-text-3)" />Embale como recebeu: sleeve, toploader e envelope com proteção.</div>
                {podeInformarPostagem(atual, agora) && (
                  <div className="pb-postar">
                    <label className="pb-rot" htmlFor="pb-rastreio">Código de rastreio</label>
                    <div className="pb-campo">
                      <IconTruck size={17} color="var(--bx-text-3)" />
                      <input id="pb-rastreio" value={rastreio} onChange={e => setRastreio(e.target.value.toUpperCase())}
                        placeholder="AA123456789BR" autoCapitalize="characters" autoComplete="off" maxLength={20} />
                    </div>
                    {rastreioInvalido && <div className="pb-aviso-campo">Confira o código: são 2 letras, 9 números e 2 letras.</div>}
                    <button type="button" className="pb-bt pb-bt-pri pb-full" disabled={!rastreioOk || !!enviando} onClick={informarPostagem}>{enviando || 'Informar postagem'}</button>
                  </div>
                )}
                <div className="pb-rodape">Sem postagem até {fmtPrazo(atual.postar_ate)}, a desistência expira e a compra continua valendo.</div>
              </>
            )}

            {atual.devolucao_rastreio && (
              <div className="pb-linha-info"><IconTruck size={15} color="var(--bx-text-3)" /><span>Rastreio</span><b>{atual.devolucao_rastreio}</b></div>
            )}
            {atual.status === 'aguardando_devolucao' && atual.devolucao_postada_em && !atual.devolucao_entregue_em && (
              <p className="pb-txt">Quando a loja receber e conferir, o estorno integral sai no seu cartão.</p>
            )}
            {atual.status === 'aguardando_devolucao' && atual.devolucao_entregue_em && atual.contestar_ate && (
              <p className="pb-txt">Sem contestação até {fmtPrazo(atual.contestar_ate)}, o estorno sai sozinho.</p>
            )}
            {atual.status === 'em_analise' && (
              <p className="pb-txt">A loja contestou. A Bynx analisa as provas{atual.prazo_decisao_ate ? ` e decide até ${fmtPrazo(atual.prazo_decisao_ate)}` : ''}.</p>
            )}
            {(atual.status === 'resolvida' || atual.status === 'improcedente') && (
              <div className="pb-quadro">
                {atual.valor_estornado_cents > 0 ? <div>Estornado <b>{fmtBRL(atual.valor_estornado_cents)}</b></div> : null}
                {atual.decisao_nota && <div className="pb-cit">{atual.decisao_nota}</div>}
              </div>
            )}
          </div>
        )
      })()}

      {/* Estado da reclamacao mais recente */}
      {atual && !ehDesistencia && (
        <div className={`pb-card${atual.status === 'resolvida' ? ' pb-ok' : ''}`}>
          <div className="pb-head">
            {atual.status === 'resolvida' ? <IconCheck size={17} color="var(--bx-green)" /> : <IconClock size={17} color="var(--bx-amber)" />}
            <b>Sua reclamação: {STATUS_RECLAMACAO[atual.status] || atual.status}</b>
          </div>
          <LinhaDevolucao passos={PASSOS_RECLAMACAO} rotulo="Etapas da reclamação"
            etapa={atual.status === 'resolvida' || atual.status === 'improcedente' ? 4 : atual.status === 'aguardando_loja' ? 1 : 2} />
          <p className="pb-txt"><span className="pb-mut">Motivo:</span> {MOTIVOS[atual.motivo]}</p>
          {atual.status === 'aguardando_loja' && (
            <p className="pb-txt">A loja tem até {fmtPrazo(atual.prazo_loja_ate)} (horário de Brasília) para responder. Sem resposta, a decisão fica a seu favor.</p>
          )}
          {atual.resposta_tipo && (
            <div className="pb-quadro">
              <div className="pb-mut">Resposta da loja: {RESPOSTAS_LOJA[atual.resposta_tipo]}</div>
              {atual.resposta_loja && <div className="pb-cit">{atual.resposta_loja}</div>}
              {atual.contraproposta_cents ? <div>Proposta: <b>{fmtBRL(atual.contraproposta_cents)}</b></div> : null}
            </div>
          )}
          {atual.status === 'em_analise' && atual.prazo_decisao_ate && (
            <p className="pb-txt">A Bynx decide até {fmtPrazo(atual.prazo_decisao_ate)} (horário de Brasília).</p>
          )}
          {atual.status === 'aguardando_devolucao' && (
            <p className="pb-txt">A decisão foi pela devolução. A Bynx combina o envio com você e o estorno sai quando a carta chegar de volta à loja.</p>
          )}
          {atual.decisao && (atual.status === 'resolvida' || atual.status === 'improcedente') && (
            <div className="pb-quadro">
              <div>Decisão: <b>{DECISOES[atual.decisao]}</b>{atual.valor_estornado_cents > 0 ? <> · estornado <b>{fmtBRL(atual.valor_estornado_cents)}</b></> : null}</div>
              {atual.decisao_nota && <div className="pb-cit">{atual.decisao_nota}</div>}
            </div>
          )}
        </div>
      )}

      {ok && !atual && <div className="pb-card pb-ok"><IconCheck size={16} color="var(--bx-green)" /> Reclamação registrada. A loja foi avisada.</div>}

      {/* Precisa de ajuda? (11/10): reclamar e desistir ficam recolhidos; a
          faixa do topo diz de quem e a vez. Abre sozinho com um formulario aberto. */}
      {temAjuda && (
        <div className="pb-ajuda">
          <button type="button" className="pb-ajuda-topo" aria-expanded={ajudaVisivel}
            onClick={() => { if (ajudaVisivel) { setAjudaAberta(false); setAberto(false); setDesistindo(false); setErro(null) } else setAjudaAberta(true) }}>
            <IconShield size={18} color="var(--bx-text-2)" />
            <span className="pb-ajuda-tit">Precisa de ajuda?
              {!ajudaVisivel && <span className="pb-ajuda-sub">{[pode.pode ? 'Tive um problema' : null, desist.pode && !cancelar.pode ? 'Desistir da compra' : null].filter(Boolean).join(' · ')}</span>}
            </span>
            <span className={`pb-gira${ajudaVisivel ? ' pb-gira-on' : ''}`}><IconChevronDown size={16} color="var(--bx-text-3)" /></span>
          </button>
          {ajudaVisivel && (
            <div className="pb-ajuda-corpo">
              {protecaoAte && !aberto && !desistindo && (
                <p className="pb-txt pb-sem-topo">Proteção Bynx: até <b>{fmtPrazo(protecaoAte)}</b> você pode reclamar ou desistir.</p>
              )}
              {!aberto && !desistindo && (
                <>
                  {pode.pode && (
                    <button type="button" className="pb-opcao" onClick={() => setAberto(true)}>
                      <span className="pb-opcao-ic pb-opcao-alerta"><IconWarning size={19} color="var(--bx-amber)" /></span>
                      <span className="pb-opcao-txt"><b>Tive um problema com a carta</b><span>Não chegou, veio diferente, danificada ou com suspeita de falsificação</span></span>
                      <IconChevronRight size={16} color="var(--bx-text-3)" />
                    </button>
                  )}
                  {desist.pode && !cancelar.pode && (
                    <button type="button" className="pb-opcao" onClick={() => setDesistindo(true)}>
                      <span className="pb-opcao-ic"><IconVolta size={19} color="var(--bx-text-2)" /></span>
                      <span className="pb-opcao-txt"><b>Desistir da compra</b><span>{desist.modo === 'antes_do_envio'
                        ? 'Antes do envio: o pedido é cancelado e o estorno integral sai na hora'
                        : 'Sem explicar o motivo. Você devolve a carta e recebe o estorno integral'}</span></span>
                      <IconChevronRight size={16} color="var(--bx-text-3)" />
                    </button>
                  )}
                </>
              )}
              {aberto && pode.pode && (
            <div className="pb-form">
              <div className="pb-head"><IconShield size={17} color="var(--ac-1)" /><b>{ROTULO_BOTAO_PROBLEMA}</b></div>
              <p className="pb-txt pb-mut">{TEXTO_PROTECAO}</p>

              <div className="pb-rot">O que aconteceu?</div>
              <div className="pb-motivos">
                {LISTA_MOTIVOS.map(m => (
                  <button key={m} type="button" className={`pb-motivo${motivo === m ? ' pb-motivo-on' : ''}`} onClick={() => setMotivo(m)} aria-pressed={motivo === m}>
                    {MOTIVOS[m]}
                  </button>
                ))}
              </div>

              <label className="pb-rot" htmlFor="pb-desc">Conte os detalhes</label>
              <textarea id="pb-desc" className="pb-input pb-area" value={descricao} maxLength={2000}
                onChange={e => setDescricao(e.target.value)} placeholder="Descreva o problema com o máximo de detalhes." />

              {motivo && motivoExigeFoto(motivo) && (
                <>
                  <div className="pb-rot">Fotos obrigatórias</div>
                  <div className="pb-fotos">
                    {SLOTS_FOTO.map(s => (
                      <label key={s} className={`pb-foto${fotos[s] ? ' pb-foto-on' : ''}`}>
                        <input type="file" accept="image/jpeg,image/png,image/webp" hidden
                          onChange={e => { const f = e.target.files?.[0]; if (f) setFotos(v => ({ ...v, [s]: f })) }} />
                        {fotos[s] ? <IconCheck size={18} color="var(--bx-green)" /> : <IconCamera size={18} color="var(--bx-text-3)" />}
                        <span>{ROTULO_SLOT[s]}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <label className="pb-rot" htmlFor="pb-video">Vídeo (opcional)</label>
              <input id="pb-video" className="pb-input" value={video} onChange={e => setVideo(e.target.value)}
                placeholder="Link do vídeo, começando com https://" inputMode="url" />

              {erro && <div className="pb-erro">{erro}</div>}
              <div className="pb-linha">
                <button type="button" className="pb-bt pb-bt-pri" disabled={!podeEnviar} onClick={enviar}>{enviando || 'Enviar reclamação'}</button>
                <button type="button" className="pb-bt pb-bt-ghost" disabled={!!enviando} onClick={() => { setAberto(false); setErro(null) }}>Voltar</button>
              </div>
            </div>
              )}
              {desistindo && desist.pode && desist.modo === 'antes_do_envio' && (
                <div className="pb-form">
                  <div className="pb-titulo">Desistir da compra</div>
                  <p className="pb-txt">O pedido é cancelado agora e {pedido.total_comprador_cents ? <>o valor de <b>{fmtBRL(pedido.total_comprador_cents)}</b></> : 'o valor integral'} é estornado no seu cartão. Não dá para desfazer.</p>
                  <div className="pb-linha">
                    <button type="button" className="pb-bt pb-bt-perigo" disabled={!!enviando} onClick={desistir}>{enviando || 'Confirmar desistência'}</button>
                    <button type="button" className="pb-bt pb-bt-ghost" disabled={!!enviando} onClick={() => { setDesistindo(false); setErro(null) }}>Voltar</button>
                  </div>
                </div>
              )}
              {desistindo && desist.pode && desist.modo === 'devolucao' && (
            <div className="pb-form">
              <div className="pb-titulo">Desistir da compra</div>
              <p className="pb-txt pb-mut">Não precisa explicar o motivo.</p>
              <LinhaDevolucao passos={PASSOS_CONFIRMAR} etapa={-1} />
              <label className="pb-check">
                <input type="checkbox" checked={confirmo} onChange={e => setConfirmo(e.target.checked)} />
                <span>Devolvo a carta como recebi.</span>
              </label>
              <div className="pb-linha">
                <button type="button" className="pb-bt pb-bt-perigo" disabled={!confirmo || !!enviando} onClick={desistir}>{enviando || 'Confirmar desistência'}</button>
                <button type="button" className="pb-bt pb-bt-ghost" disabled={!!enviando} onClick={() => { setDesistindo(false); setConfirmo(false); setErro(null) }}>Voltar</button>
              </div>
            </div>
              )}
            </div>
          )}
        </div>
      )}

      {erro && !aberto && <div className="pb-erro">{erro}</div>}
    </div>
  )
}

const CSS = `
.pb-wrap{display:grid;gap:12px;margin-top:16px}
.pb-card{border:1px solid var(--bx-border);background:var(--bx-surface);border-radius:16px;padding:16px;color:var(--bx-text)}
.pb-alerta{border-color:color-mix(in srgb,var(--bx-amber) 40%,transparent);background:color-mix(in srgb,var(--bx-amber) 6%,transparent)}
.pb-ok{border-color:color-mix(in srgb,var(--bx-green) 35%,transparent);display:block}
.pb-head{display:flex;align-items:center;gap:8px;font-size:14.5px}
.pb-txt{font-size:12.5px;line-height:1.55;color:var(--bx-text-2);margin:8px 0 0}
.pb-mut{color:var(--bx-text-3)}
.pb-quadro{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--bx-surface-2);font-size:12.5px;line-height:1.5;display:grid;gap:4px}
.pb-cit{color:var(--bx-text-2);white-space:pre-wrap;overflow-wrap:anywhere}
.pb-form{display:grid;gap:8px}
.pb-rot{font-size:12px;font-weight:700;color:var(--bx-text-2);margin-top:6px}
.pb-motivos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.pb-motivo{min-height:44px;padding:8px 10px;border-radius:10px;border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;text-align:left;transition:background .15s ease,border-color .15s ease}
.pb-motivo-on{border-color:rgba(var(--ac-1-rgb),.55);background:rgba(var(--ac-1-rgb),.1);color:var(--bx-text)}
.pb-input{width:100%;box-sizing:border-box;background:var(--bx-surface-2);border:1px solid var(--bx-border);border-radius:10px;padding:11px 12px;color:var(--bx-text);font:inherit;font-size:13px;outline:none}
.pb-input:focus{border-color:var(--bx-border-2)}
.pb-area{min-height:90px;resize:vertical}
.pb-fotos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.pb-foto{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:76px;border:1px dashed var(--bx-border-2);border-radius:10px;font-size:11.5px;color:var(--bx-text-3);cursor:pointer;text-align:center;padding:6px;transition:border-color .15s ease}
.pb-foto-on{border-style:solid;border-color:color-mix(in srgb,var(--bx-green) 45%,transparent);color:var(--bx-text-2)}
.pb-linha{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.pb-bt{min-height:44px;padding:0 16px;border-radius:11px;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:opacity .15s ease,background .15s ease}
.pb-bt:disabled{opacity:.55;cursor:not-allowed}
.pb-bt-pri{flex:1;border:none;background:var(--ac-grad);color:var(--bx-brand-ink)}
.pb-bt-sec{width:100%;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text)}
.pb-bt-ghost{border:1px solid var(--bx-border);background:transparent;color:var(--bx-text-2)}
.pb-bt-perigo{flex:1;margin-top:10px;border:1px solid color-mix(in srgb,var(--bx-red) 50%,transparent);background:color-mix(in srgb,var(--bx-red) 12%,transparent);color:var(--bx-red)}
.pb-linha .pb-bt-perigo{margin-top:0}
.pb-full{width:100%}
.pb-ajuda{border:1px solid var(--bx-border);background:var(--bx-surface);border-radius:14px;color:var(--bx-text)}
.pb-ajuda-topo{width:100%;min-height:56px;padding:8px 14px;border:none;background:transparent;color:inherit;font:inherit;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer}
.pb-ajuda-topo svg{flex-shrink:0}
.pb-ajuda-tit{flex:1;min-width:0;font-size:14px;font-weight:700;display:flex;flex-direction:column;gap:2px}
.pb-ajuda-sub{font-size:12px;font-weight:500;color:var(--bx-text-3)}
.pb-gira{display:inline-flex;transition:transform .2s ease}
.pb-gira-on{transform:rotate(180deg)}
.pb-ajuda-corpo{padding:0 14px 14px;display:grid;gap:10px}
.pb-sem-topo{margin-top:0}
.pb-opcao{min-height:64px;width:100%;border-radius:12px;padding:12px;border:1px solid var(--bx-border);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;display:flex;gap:12px;align-items:center;text-align:left;cursor:pointer;transition:border-color .15s ease,background .15s ease}
.pb-opcao:hover{border-color:var(--bx-border-2)}
.pb-opcao>svg{flex-shrink:0}
.pb-opcao-ic{width:40px;height:40px;border-radius:10px;background:var(--bx-surface-3);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pb-opcao-alerta{background:color-mix(in srgb,var(--bx-amber) 10%,transparent)}
.pb-opcao-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.pb-opcao-txt b{font-size:14px}
.pb-opcao-txt span{font-size:12px;line-height:1.45;color:var(--bx-text-3)}
@media (prefers-reduced-motion:reduce){.pb-gira,.pb-opcao{transition:none}}
.pb-titulo{font-size:16px;font-weight:800;color:var(--bx-text);line-height:1.3}
.pb-dest{color:var(--ac-1)}
.pb-tl{list-style:none;margin:14px 0 4px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));position:relative}
.pb-tl::before{content:'';position:absolute;top:18px;left:12.5%;right:12.5%;height:1px;background:var(--bx-border-2)}
.pb-tl-p{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0}
.pb-tl-ic{width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--bx-surface-2);border:1px solid var(--bx-border-2);color:var(--bx-text-3);transition:background .15s ease,border-color .15s ease,color .15s ease}
.pb-tl-rot{font-size:11.5px;line-height:1.3;color:var(--bx-text-3);font-weight:600}
.pb-tl-feito .pb-tl-ic{color:var(--bx-green);border-color:color-mix(in srgb,var(--bx-green) 45%,transparent);background:color-mix(in srgb,var(--bx-green) 10%,var(--bx-surface-2))}
.pb-tl-atual .pb-tl-ic{color:var(--ac-1);border-color:rgba(var(--ac-1-rgb),.6);background:rgba(var(--ac-1-rgb),.12)}
.pb-tl-atual .pb-tl-rot{color:var(--bx-text)}
.pb-end{display:flex;align-items:center;gap:10px;margin-top:12px;padding:12px;border-radius:12px;background:var(--bx-surface-2);border:1px solid var(--bx-border)}
.pb-end-txt{display:grid;gap:2px;min-width:0;flex:1;font-size:13px;line-height:1.45}
.pb-end-txt span{color:var(--bx-text-2);overflow-wrap:anywhere}
.pb-copiar{width:44px;height:44px;flex-shrink:0;border-radius:10px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text-2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s ease}
.pb-copiar:hover{background:var(--bx-surface-3)}
.pb-dica{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12.5px;line-height:1.5;color:var(--bx-text-2)}
.pb-dica svg{flex-shrink:0;margin-top:2px}
.pb-postar{display:grid;gap:8px;margin-top:12px}
.pb-campo{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;background:var(--bx-surface-2);border:1px solid var(--bx-border);transition:border-color .15s ease}
.pb-campo:focus-within{border-color:var(--bx-border-2)}
.pb-campo input{flex:1;min-width:0;min-height:46px;background:transparent;border:none;outline:none;color:var(--bx-text);font:inherit;font-size:16px;letter-spacing:.04em}
.pb-aviso-campo{font-size:12.5px;color:var(--bx-amber)}
.pb-rodape{margin-top:12px;font-size:11.5px;line-height:1.5;color:var(--bx-text-3)}
.pb-linha-info{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--bx-text-2)}
.pb-linha-info b{margin-left:auto;color:var(--bx-text);letter-spacing:.04em}
@media (prefers-reduced-motion:reduce){.pb-tl-ic,.pb-copiar,.pb-campo{transition:none}}
.pb-rot0{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.pb-check{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;line-height:1.5;color:var(--bx-text-2);cursor:pointer;margin-top:4px}
.pb-check input{width:18px;height:18px;margin-top:1px;flex-shrink:0;accent-color:var(--ac-1)}
.pb-erro{font-size:12.5px;color:var(--bx-red);background:color-mix(in srgb,var(--bx-red) 8%,transparent);border:1px solid color-mix(in srgb,var(--bx-red) 25%,transparent);border-radius:10px;padding:9px 12px}
@media (max-width:420px){.pb-fotos{grid-template-columns:1fr}.pb-motivos{grid-template-columns:1fr}}
`
