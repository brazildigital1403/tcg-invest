'use client'

// Orcamento pelas fotos, numa tela so (sem passo a passo):
//   1. servico (3 opcoes)
//   2. cartas: quantidade + por carta nome (busca no catalogo), fotos, o que
//      incomoda e valor declarado
//   3. contato e ciencia: prazo, WhatsApp opcional (mascara + validacao),
//      consentimento e ciencia de recusa
// Resumo + botao de envio ficam numa coluna lateral fixa no desktop e no fim
// da pagina no celular.
//
// Login: as fotos so aparecem para quem entrou. Sem conta o status nao tem
// onde viver, e pedir login DEPOIS das fotos perderia as imagens no redirect
// do Google. O servico e a quantidade voltam preservados pela URL.
//
// Envio (F8), em 3 tempos: POST /api/servicos cria o pedido e devolve uma URL
// assinada por foto; o navegador sobe cada foto direto no bucket privado
// (repete com URL nova se falhar); POST /api/servicos/[id]/fotos confere tudo
// no bucket e fecha o pedido. Se cair no meio, a nova tentativa so sobe o que
// faltou, sem criar outro pedido. SERVICOS_FORM_ATIVO = false desliga o envio.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { authFetch } from '@/lib/authFetch'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  IconCheck, IconMinus, IconPlus, IconUpload, IconClose, IconWhatsApp, IconWarning, IconAccount,
} from '@/components/ui/Icons'
import {
  SERVICOS, SERVICOS_FORM_ATIVO, PRECOS, PRAZOS, LINKS, QUEIXAS, FOTO_SLOTS, MAX_CARTAS_POR_SOLICITACAO,
  precoDoServico, brl, type ServicoId, type FotoSlotId,
} from '@/lib/servicos'

interface Foto { file: File; url: string }
interface CartaForm {
  nome: string
  cardId: string | null
  fotos: Partial<Record<FotoSlotId, Foto>>
  queixas: string[]
  obs: string
  valor: string
}
interface Upload { idx: number; item_id: string; slot: FotoSlotId; path: string; token: string }
interface Envio { id: string; numero: string; uploads: Upload[]; feitos: { item_id: string; slot: FotoSlotId; path: string }[] }
interface Sugestao { ref: string; label: string; sublabel: string; image: string | null; price: number | null }

const novaCarta = (): CartaForm => ({ nome: '', cardId: null, fotos: {}, queixas: [], obs: '', valor: '' })
const MAX_BYTES = 10 * 1024 * 1024
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp']

function paramServico(s: ServicoId) { return s === 'pre_grading' ? 'pre-grading' : s }
function valorNum(v: string) { return Number(v.replace(/\./g, '').replace(',', '.')) || 0 }

// ── WhatsApp: mascara (11) 91234-5678 e validacao ───────────────────────────

function soDigitos(v: string) {
  let d = v.replace(/\D/g, '')
  // Colou com +55 ou 55 na frente: tira o codigo do pais.
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  return d.slice(0, 11)
}

export function mascaraWhats(v: string) {
  const d = soDigitos(v)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** '' quando valido (ou vazio, o campo e opcional); senao, a mensagem de erro. */
export function erroWhats(v: string) {
  const d = soDigitos(v)
  if (d.length === 0) return ''
  if (d.length < 11) return 'Número incompleto. Use DDD + 9 dígitos.'
  const ddd = Number(d.slice(0, 2))
  if (ddd < 11 || d[1] === '0') return 'DDD inválido.'
  if (d[2] !== '9') return 'Celular começa com 9 depois do DDD.'
  return ''
}

export default function AgendarClient({ servicoInicial, qtdInicial }: { servicoInicial: ServicoId; qtdInicial: number }) {
  const { openSignup, openLogin } = useAuthModal()
  const [servico, setServico] = useState<ServicoId>(servicoInicial)
  const [qtd, setQtd] = useState(qtdInicial)
  const [logado, setLogado] = useState<boolean | null>(null)
  const [cartas, setCartas] = useState<CartaForm[]>(() => Array.from({ length: qtdInicial }, novaCarta))
  const [prazo, setPrazo] = useState<'padrao' | 'expresso'>('padrao')
  const [whats, setWhats] = useState('')
  const [whatsTocado, setWhatsTocado] = useState(false)
  const [whatsOk, setWhatsOk] = useState(false)
  const [ciente, setCiente] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [aviso, setAviso] = useState('')
  const [numero, setNumero] = useState<string | null>(null)
  const [pedidoId, setPedidoId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState('')
  const [erroEnvio, setErroEnvio] = useState('')
  // Pedido ja criado numa tentativa anterior: a nova tentativa so sobe o que faltou.
  const envioRef = useRef<Envio | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Libera as URLs de preview quando a pagina fecha.
  const cartasRef = useRef(cartas)
  useEffect(() => { cartasRef.current = cartas }, [cartas])
  useEffect(() => () => {
    cartasRef.current.forEach(c => Object.values(c.fotos).forEach(f => f && URL.revokeObjectURL(f.url)))
  }, [])

  function mudarQtd(delta: number) {
    const q = Math.min(MAX_CARTAS_POR_SOLICITACAO, Math.max(1, qtd + delta))
    if (q === qtd) return
    if (q < cartas.length) cartas.slice(q).forEach(c => Object.values(c.fotos).forEach(f => f && URL.revokeObjectURL(f.url)))
    setQtd(q)
    setCartas(cs => (q >= cs.length ? [...cs, ...Array.from({ length: q - cs.length }, novaCarta)] : cs.slice(0, q)))
  }

  const atualizar = useCallback((i: number, p: Partial<CartaForm>) => {
    setCartas(cs => cs.map((c, j) => (j === i ? { ...c, ...p } : c)))
  }, [])

  const voltarPara = `/restauracao-de-cartas/agendar?servico=${paramServico(servico)}&qtd=${qtd}`
  const erroW = erroWhats(whats)

  // Pendencias em linguagem de gente, na ordem da tela.
  const pendencias = useMemo(() => {
    const p: string[] = []
    if (!logado) { p.push('Entre na sua conta para mandar as fotos'); return p }
    cartas.forEach((c, i) => {
      const n = cartas.length > 1 ? ` da carta ${i + 1}` : ''
      if (!c.nome.trim()) p.push(`Falta o nome${n}`)
      if (!c.fotos.frente) p.push(`Falta a frente${n}`)
      if (!c.fotos.verso) p.push(`Falta o verso${n}`)
      if (valorNum(c.valor) <= 0) p.push(`Falta o valor declarado${n}`)
    })
    if (erroW) p.push('Confira o WhatsApp')
    if (!ciente) p.push('Marque a ciência sobre recusa')
    return p
  }, [logado, cartas, erroW, ciente])

  const precoUnit = precoDoServico(servico)
  const totalDeclarado = cartas.reduce((s, c) => s + valorNum(c.valor), 0)

  async function enviar() {
    setTentou(true)
    setWhatsTocado(true)
    setErroEnvio('')
    if (!logado) { openSignup({ next: voltarPara }); return }
    if (pendencias.length) {
      document.querySelector('.ag-inv, .ag-chk-inv, .ag-erro')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!SERVICOS_FORM_ATIVO) {
      setAviso('O envio pelo site abre em breve. Suas fotos continuam aqui.')
      return
    }
    if (enviando) return

    try {
      // 1. Cria o pedido (uma vez so). Nada de arquivo aqui: so os dados e o tipo de cada foto.
      if (!envioRef.current) {
        setEnviando('Registrando o pedido...')
        const r = await authFetch('/api/servicos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            servico,
            prazo,
            whatsapp: soDigitos(whats) || null,
            whatsapp_consentido: whatsOk,
            ciente,
            cartas: cartas.map(c => ({
              nome: c.nome,
              card_id: c.cardId,
              queixas: c.queixas,
              obs: c.obs,
              valor_declarado_cents: Math.round(valorNum(c.valor) * 100),
              fotos: Object.fromEntries(Object.entries(c.fotos).map(([slot, f]) => [slot, f!.file.type])),
            })),
          }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) { setErroEnvio(d.error || 'Não conseguimos registrar o pedido. Tente de novo.'); return }
        envioRef.current = { id: d.id, numero: d.numero, uploads: d.uploads, feitos: [] }
      }

      // 2. Sobe cada foto direto no bucket privado, pela URL assinada.
      const e = envioRef.current
      const pendentes = e.uploads.filter(u => !e.feitos.some(f => f.item_id === u.item_id && f.slot === u.slot))
      for (let k = 0; k < pendentes.length; k++) {
        let u = pendentes[k]
        setEnviando(`Enviando ${e.feitos.length + 1} de ${e.uploads.length} fotos`)
        const foto = cartas[u.idx]?.fotos[u.slot]
        if (!foto) { setErroEnvio('Uma foto foi removida depois do envio começar. Recarregue a página e mande de novo.'); return }
        let { error } = await supabase.storage.from('servico-midias').uploadToSignedUrl(u.path, u.token, foto.file, { contentType: foto.file.type })
        if (error) {
          // URL vencida ou falha no meio: pede uma nova so para esta foto e tenta mais uma vez.
          const r = await authFetch(`/api/servicos/${e.id}/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: u.item_id, slot: u.slot, mime: foto.file.type }),
          })
          const nova = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(nova.error || 'upload-url')
          u = { ...u, path: nova.path, token: nova.token }
          e.uploads = e.uploads.map(x => (x.item_id === u.item_id && x.slot === u.slot ? u : x))
          ;({ error } = await supabase.storage.from('servico-midias').uploadToSignedUrl(u.path, u.token, foto.file, { contentType: foto.file.type }))
          if (error) throw error
        }
        e.feitos.push({ item_id: u.item_id, slot: u.slot, path: u.path })
      }

      // 3. Confirma: o servidor confere cada arquivo no bucket antes de registrar.
      setEnviando('Conferindo as fotos...')
      const r = await authFetch(`/api/servicos/${e.id}/fotos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotos: e.feitos }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErroEnvio(d.error || 'Não conseguimos conferir as fotos. Tente de novo.'); return }
      if (!d.completa) {
        const rej = new Set<string>(d.rejeitadas || [])
        e.feitos = e.feitos.filter(f => !rej.has(f.path))
        setErroEnvio('Algumas fotos não chegaram direito. Toque em enviar de novo para mandar só o que faltou.')
        return
      }
      setNumero(e.numero)
      setPedidoId(e.id)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErroEnvio('Sem conexão. Suas fotos continuam aqui, é só tentar de novo.')
    } finally {
      setEnviando('')
    }
  }

  if (numero) {
    return (
      <section className="sv-band">
        <style>{AG_CSS}</style>
        <div className="bx-gutter sv-container">
          <div className="ag-ok">
            <span className="sv-ic sv-ic-ok ag-ok-ic"><IconCheck size={24} strokeWidth={2} /></span>
            <span className="sv-eyebrow">Solicitação registrada</span>
            <h2 className="sv-h1">{numero}</h2>
            <p className="sv-sub">Recebemos as fotos. O orçamento chega em até {PRAZOS.orcamento || 'poucos dias úteis'}, no seu e-mail e na página do pedido.</p>
            <p className="ag-alerta"><IconWarning size={16} /> Não envie a carta ainda. O endereço aparece depois que você aprova o orçamento.</p>
            <a className="sv-cta" href={pedidoId ? `/servico/${pedidoId}` : '/compras'}>Acompanhar o pedido</a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="sv-band-alt ag-band">
      <style>{AG_CSS}</style>
      <div className="bx-gutter sv-container ag-grid">
        <div className="ag-form">

          {/* 1. Servico */}
          <div className="sv-card ag-bloco">
            <div className="ag-bloco-h"><span className="ag-n">1</span><h2 className="sv-h3">Qual serviço você quer?</h2></div>
            <div className="ag-opts" role="radiogroup" aria-label="Serviço">
              {SERVICOS.map(s => {
                const on = s.id === servico
                const preco = precoDoServico(s.id)
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={on} className={`sv-opt${on ? ' sv-opt-on' : ''}`} onClick={() => setServico(s.id)}>
                    <span className="sv-opt-dot">{on && <IconCheck size={13} strokeWidth={2.6} />}</span>
                    <span className="sv-opt-l"><b>{s.nome}</b><small>{s.curto}</small></span>
                    {preco != null && <span className="sv-opt-r">R$ {brl(preco)}<small>por carta</small></span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Cartas */}
          <div className="sv-card ag-bloco">
            <div className="ag-bloco-h ag-bloco-h-row">
              <div className="ag-bloco-h"><span className="ag-n">2</span><h2 className="sv-h3">{qtd === 1 ? 'Sua carta' : 'Suas cartas'}</h2></div>
              <div className="ag-stepper">
                <button type="button" onClick={() => mudarQtd(-1)} disabled={qtd <= 1} aria-label="Menos uma carta"><IconMinus size={18} /></button>
                <output aria-live="polite">{qtd} {qtd === 1 ? 'carta' : 'cartas'}</output>
                <button type="button" onClick={() => mudarQtd(1)} disabled={qtd >= MAX_CARTAS_POR_SOLICITACAO} aria-label="Mais uma carta"><IconPlus size={18} /></button>
              </div>
            </div>
            {qtd >= MAX_CARTAS_POR_SOLICITACAO && (
              <p className="sv-small" style={{ marginTop: 0 }}>Lote grande? {LINKS.whatsapp ? <a href={LINKS.whatsapp} className="ag-a">Fale com a gente</a> : 'Fale com a gente'} e combinamos o envio.</p>
            )}

            {logado === false ? (
              <div className={`ag-login${tentou ? ' ag-login-inv' : ''}`}>
                <span className="sv-ic sv-ic-lg"><IconAccount size={20} /></span>
                <div>
                  <b>Entre para mandar as fotos</b>
                  <span>É na sua conta que aparecem o orçamento, o vídeo da chegada, as fotos de cada etapa e o rastreio de volta. O serviço e a quantidade que você escolheu continuam aqui.</span>
                </div>
                <div className="ag-login-bt">
                  <button type="button" className="sv-cta" onClick={() => openSignup({ next: voltarPara })}>Criar conta grátis</button>
                  <button type="button" className="sv-ghost" onClick={() => openLogin({ next: voltarPara })}>Já tenho conta</button>
                </div>
              </div>
            ) : logado ? (
              <>
                <p className="sv-p ag-dica-topo">Frente e verso bastam para o orçamento. Luz de janela, sem sleeve, fundo liso.</p>
                <div className="ag-cartas">
                  {cartas.map((c, i) => (
                    <CartaBloco key={i} idx={i} total={cartas.length} carta={c} tentou={tentou} onChange={p => atualizar(i, p)} />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* 3. Contato e ciencia */}
          <div className="sv-card ag-bloco">
            <div className="ag-bloco-h"><span className="ag-n">3</span><h2 className="sv-h3">Prazo e contato</h2></div>

            {PRECOS?.expresso != null ? (
              <div className="ag-opts ag-opts-2" role="radiogroup" aria-label="Prazo">
                {(['padrao', 'expresso'] as const).map(p => {
                  const on = p === prazo
                  return (
                    <button key={p} type="button" role="radio" aria-checked={on} className={`sv-opt${on ? ' sv-opt-on' : ''}`} onClick={() => setPrazo(p)}>
                      <span className="sv-opt-dot">{on && <IconCheck size={13} strokeWidth={2.6} />}</span>
                      <span className="sv-opt-l">
                        <b>{p === 'padrao' ? 'Padrão' : 'Expresso'}</b>
                        <small>{p === 'padrao'
                          ? (PRAZOS.padraoDiasUteis ? `${PRAZOS.padraoDiasUteis} dias úteis após a chegada` : 'Prazo informado no orçamento')
                          : (PRAZOS.expressoDias ? `${PRAZOS.expressoDias} dias corridos após a chegada` : 'Prioridade na bancada')}</small>
                      </span>
                      <span className="sv-opt-r">{p === 'padrao' ? 'Sem custo' : `+ R$ ${brl(PRECOS!.expresso!)}`}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="sv-p ag-dica-topo">{PRAZOS.padraoDiasUteis ? `Prazo de ${PRAZOS.padraoDiasUteis} dias úteis após a chegada da carta.` : 'O prazo vem no orçamento, contado a partir da chegada da carta.'}</p>
            )}

            <div className="ag-dois">
              <div className="ag-fld">
                <label htmlFor="ag-whats">WhatsApp <em>opcional</em></label>
                <input
                  id="ag-whats"
                  className={whatsTocado && erroW ? 'ag-inv' : ''}
                  value={whats}
                  onChange={e => setWhats(mascaraWhats(e.target.value))}
                  onBlur={() => setWhatsTocado(true)}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 91234-5678"
                  maxLength={15}
                  aria-invalid={whatsTocado && !!erroW}
                  aria-describedby="ag-whats-msg"
                />
                <small id="ag-whats-msg" className={whatsTocado && erroW ? 'ag-erro ag-erro-sm' : 'ag-dica'}>
                  {whatsTocado && erroW ? erroW : 'Só para falar sobre este orçamento.'}
                </small>
              </div>
              <div className="ag-chks">
                {soDigitos(whats).length > 0 && (
                  <label className="ag-chk">
                    <input type="checkbox" checked={whatsOk} onChange={e => setWhatsOk(e.target.checked)} />
                    <span>Pode me chamar no WhatsApp sobre este orçamento.</span>
                  </label>
                )}
                <label className={`ag-chk${tentou && !ciente ? ' ag-chk-inv' : ''}`}>
                  <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} />
                  <span>Sei que o orçamento pode recusar cartas que precisariam de repintura, recolagem ou corte.</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Resumo: lateral fixa no desktop, fim da pagina no celular */}
        <aside className="ag-lado">
          <div className="sv-card ag-resumo">
            <span className="sv-eyebrow">Resumo</span>
            <div className="ag-linhas">
              <div><span>Serviço</span><b>{SERVICOS.find(s => s.id === servico)?.nome}</b></div>
              <div><span>Cartas</span><b>{qtd}</b></div>
              <div><span>Valor declarado</span><b>R$ {brl(totalDeclarado)}</b></div>
              {precoUnit != null && <div><span>Estimativa</span><b>R$ {brl(precoUnit * qtd)}</b></div>}
            </div>
            {tentou && pendencias.length > 0 && (
              <ul className="ag-pend" role="alert">
                {pendencias.slice(0, 4).map(p => <li key={p}>{p}</li>)}
                {pendencias.length > 4 && <li>e mais {pendencias.length - 4}</li>}
              </ul>
            )}
            <button type="button" className="sv-cta" onClick={enviar} disabled={logado === null || !!enviando} aria-busy={!!enviando}>
              {enviando || (logado === false ? 'Entrar e mandar as fotos' : 'Enviar para orçamento')}
            </button>
            {erroEnvio && <p className="ag-erro" role="alert" style={{ margin: 0 }}>{erroEnvio}</p>}
            {aviso && (
              <div className="ag-aviso" role="status">
                <p>{aviso}</p>
                {LINKS.whatsapp && <a className="sv-ghost" href={LINKS.whatsapp}><IconWhatsApp size={18} /> Pedir pelo WhatsApp</a>}
              </div>
            )}
            <p className="sv-small" style={{ textAlign: 'center', margin: 0 }}>Nada é cobrado agora. O preço final vem no orçamento.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}

// ── Uma carta ────────────────────────────────────────────────────────────────

function CartaBloco({ idx, total, carta, tentou, onChange }: {
  idx: number; total: number; carta: CartaForm; tentou: boolean; onChange: (p: Partial<CartaForm>) => void
}) {
  const [sug, setSug] = useState<Sugestao[]>([])
  const [aberto, setAberto] = useState(false)
  const [erroFoto, setErroFoto] = useState<Partial<Record<FotoSlotId, string>>>({})
  const [comprimindo, setComprimindo] = useState<FotoSlotId | null>(null)

  useEffect(() => {
    const t = carta.nome.trim()
    if (carta.cardId || t.length < 2) return
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(t)}`)
        const d = await r.json()
        setSug(((d.results || []) as (Sugestao & { kind: string })[]).filter(x => x.kind === 'card').slice(0, 5))
        setAberto(true)
      } catch { /* sem sugestao, digitacao livre segue valendo */ }
    }, 250)
    return () => clearTimeout(id)
  }, [carta.nome, carta.cardId])

  // Com carta escolhida ou busca curta, a lista antiga nao aparece (derivado, sem setState no efeito).
  const sugVisiveis = carta.cardId || carta.nome.trim().length < 2 ? [] : sug

  function escolher(s: Sugestao) {
    const p: Partial<CartaForm> = { nome: `${s.label}${s.sublabel ? ` · ${s.sublabel}` : ''}`, cardId: s.ref }
    if (!carta.valor && s.price) p.valor = brl(s.price)
    onChange(p)
    setAberto(false)
  }

  async function aoEscolherFoto(slot: FotoSlotId, arquivo: File | undefined) {
    if (!arquivo) return
    setErroFoto(e => ({ ...e, [slot]: undefined }))
    if (arquivo.size > MAX_BYTES) { setErroFoto(e => ({ ...e, [slot]: 'Foto acima de 10 MB. Tente uma menor.' })); return }
    setComprimindo(slot)
    const final = await comprimirImagem(arquivo, { maxLado: 1600 })
    setComprimindo(null)
    if (!TIPOS_OK.includes(final.type)) {
      setErroFoto(e => ({ ...e, [slot]: 'Não conseguimos ler essa foto. Exporte em JPG ou tire um print dela.' }))
      return
    }
    const antiga = carta.fotos[slot]
    if (antiga) URL.revokeObjectURL(antiga.url)
    onChange({ fotos: { ...carta.fotos, [slot]: { file: final, url: URL.createObjectURL(final) } } })
  }

  function tirarFoto(slot: FotoSlotId) {
    const f = carta.fotos[slot]
    if (f) URL.revokeObjectURL(f.url)
    const fotos = { ...carta.fotos }
    delete fotos[slot]
    onChange({ fotos })
  }

  function alternarQueixa(q: string) {
    onChange({ queixas: carta.queixas.includes(q) ? carta.queixas.filter(x => x !== q) : [...carta.queixas, q] })
  }

  const inv = (cond: boolean) => (tentou && cond ? ' ag-inv' : '')

  return (
    <fieldset className="ag-carta">
      {total > 1 && <legend>Carta {idx + 1}</legend>}

      <div className="ag-carta-l">
        <div className="ag-fld ag-busca">
          <label htmlFor={`ag-nome-${idx}`}>Nome da carta</label>
          <input
            id={`ag-nome-${idx}`}
            className={inv(!carta.nome.trim())}
            value={carta.nome}
            onChange={e => onChange({ nome: e.target.value, cardId: null })}
            onFocus={() => sugVisiveis.length > 0 && setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            placeholder="Ex.: Umbreon VMAX"
            autoComplete="off"
            role="combobox"
            aria-expanded={aberto && sugVisiveis.length > 0}
            aria-controls={`ag-sug-${idx}`}
          />
          {carta.cardId && <em className="ag-ok-txt"><IconCheck size={12} strokeWidth={2.6} /> Encontrada no catálogo</em>}
          {aberto && sugVisiveis.length > 0 && (
            <ul className="ag-sug" id={`ag-sug-${idx}`} role="listbox">
              {sugVisiveis.map(s => (
                <li key={s.ref} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => escolher(s)}>
                    {s.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={s.image} alt="" width={30} height={42} loading="lazy" />
                      : <span className="ag-sug-ph" />}
                    <span><b>{s.label}</b><small>{s.sublabel}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ag-fld">
          <span>O que incomoda na carta</span>
          <div className="ag-chips">
            {QUEIXAS.map(q => {
              const on = carta.queixas.includes(q)
              return (
                <button key={q} type="button" className={`sv-chip${on ? ' sv-chip-on' : ''}`} aria-pressed={on} onClick={() => alternarQueixa(q)}>{q}</button>
              )
            })}
          </div>
          <textarea value={carta.obs} onChange={e => onChange({ obs: e.target.value })} rows={2} placeholder="Quer contar mais? (opcional)" maxLength={500} />
        </div>

        <div className="ag-fld">
          <label htmlFor={`ag-valor-${idx}`}>Valor declarado <em>base do seguro</em></label>
          <span className="ag-rs">
            <b>R$</b>
            <input id={`ag-valor-${idx}`} className={inv(valorNum(carta.valor) <= 0)} value={carta.valor} onChange={e => onChange({ valor: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="0,00" />
          </span>
          {carta.cardId && <small className="ag-dica">Preenchido com o preço do Mercado Brasileiro. Ajuste se a sua carta vale mais ou menos.</small>}
        </div>
      </div>

      <div className="ag-fld ag-carta-r">
        <span>Fotos</span>
        <div className="ag-fotos">
          {FOTO_SLOTS.map(s => {
            const f = carta.fotos[s.id]
            const falta = s.obrigatoria && !f
            return (
              <div key={s.id} className="ag-slot-w">
                {f ? (
                  <div className="sv-slot sv-slot-cheio">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={`${s.rotulo} da carta ${idx + 1}`} />
                    <button type="button" className="ag-tirar" onClick={() => tirarFoto(s.id)} aria-label={`Remover ${s.rotulo.toLowerCase()}`}><IconClose size={14} strokeWidth={2.2} /></button>
                  </div>
                ) : (
                  <label className={`sv-slot${inv(falta)}`}>
                    <input type="file" accept="image/*" onChange={e => { aoEscolherFoto(s.id, e.target.files?.[0]); e.target.value = '' }} />
                    {comprimindo === s.id ? <span className="ag-slot-txt">Preparando...</span> : (
                      <>
                        <IconUpload size={20} />
                        <span className="ag-slot-txt">{s.rotulo}</span>
                        <small>{s.obrigatoria ? 'obrigatória' : 'opcional'}</small>
                      </>
                    )}
                  </label>
                )}
                {erroFoto[s.id] && <p className="ag-erro ag-erro-sm">{erroFoto[s.id]}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}

const AG_CSS = `
.ag-band{padding:56px 0 96px}
.ag-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
.ag-form{display:grid;gap:16px;min-width:0}
.ag-lado{position:sticky;top:84px;min-width:0}
.ag-bloco{display:grid;gap:18px;padding:24px}
.ag-bloco-h{display:flex;align-items:center;gap:12px}
.ag-bloco-h-row{justify-content:space-between;flex-wrap:wrap;gap:12px}
.ag-n{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:800;background:var(--ac-grad);color:var(--bx-brand-ink);flex-shrink:0}
.ag-dica-topo{margin:0;font-size:14px}

.ag-opts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ag-opts-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.sv-opt{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px 12px;align-items:start;width:100%;min-height:68px;padding:14px;border-radius:14px;text-align:left;font:inherit;color:var(--bx-text);background:var(--bx-bg);border:1px solid var(--bx-border-2);cursor:pointer;transition:border-color .15s ease,background .15s ease}
.sv-opt:hover{background:var(--bx-surface-2)}
.sv-opt-on{border-color:rgba(var(--ac-1-rgb),.8);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.10),rgba(var(--ac-2-rgb),.04))}
.sv-opt-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--bx-border-2);color:var(--bx-brand-ink)}
.sv-opt-on .sv-opt-dot{background:var(--ac-grad);border-color:transparent}
.sv-opt-l{min-width:0;display:flex;flex-direction:column;gap:3px}
.sv-opt-l b{font-size:15px}
.sv-opt-l small{font-size:12.5px;line-height:1.4;color:var(--bx-text-2)}
.sv-opt-r{grid-column:2;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}
.sv-opt-r small{font-weight:400;font-size:11px;color:var(--bx-text-3);margin-left:4px}

.ag-stepper{display:grid;grid-template-columns:48px minmax(96px,auto) 48px;align-items:center;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-bg);overflow:hidden}
.ag-stepper button{height:48px;border:0;background:transparent;color:var(--bx-text);display:grid;place-items:center;cursor:pointer}
.ag-stepper button:disabled{color:var(--bx-text-faint);cursor:not-allowed}
.ag-stepper output{text-align:center;font-weight:700;font-size:15px;font-variant-numeric:tabular-nums;padding:0 8px}

.ag-login{display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;padding:18px;border-radius:14px;background:var(--bx-bg);border:1px dashed var(--bx-border-2)}
.ag-login-inv{border-color:rgba(var(--ac-1-rgb),.8)}
.ag-login b{display:block;font-size:15px;margin:2px 0 4px}
.ag-login span:not(.sv-ic){display:block;font-size:14px;line-height:1.55;color:var(--bx-text-2)}
.ag-login-bt{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:10px}

.ag-cartas{display:grid;gap:14px}
.ag-carta{margin:0;padding:18px;border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-bg);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px 24px;min-width:0}
.ag-carta legend{padding:0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.ag-carta-l{display:grid;gap:16px;align-content:start;min-width:0}

.ag-fld{display:flex;flex-direction:column;gap:6px;min-width:0}
.ag-fld > span:first-child,.ag-fld > label{display:flex;justify-content:space-between;gap:6px;font-size:12.5px;font-weight:600;color:var(--bx-text-2)}
.ag-fld em{font-style:normal;font-weight:400;color:var(--bx-text-3)}
.ag-fld input,.ag-fld textarea{width:100%;min-height:48px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);padding:12px;font:inherit;font-size:16px;color-scheme:dark}
.ag-fld textarea{min-height:0;resize:vertical}
.ag-fld input:focus,.ag-fld textarea:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.7)}
.ag-inv{border-color:var(--bx-red) !important}
.ag-ok-txt{display:inline-flex;align-items:center;gap:4px;font-style:normal;font-size:12px;color:var(--bx-green)}
.ag-dica{font-size:12px;line-height:1.4;color:var(--bx-text-3)}
.ag-dois{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px 24px;align-items:start}
.ag-chks{display:grid;gap:4px}

.ag-busca{position:relative}
.ag-sug{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:10;list-style:none;margin:0;padding:6px;border-radius:12px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.ag-sug button{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:var(--bx-text);font:inherit;text-align:left;cursor:pointer}
.ag-sug button:hover{background:var(--bx-surface-2)}
.ag-sug img,.ag-sug-ph{width:30px;height:42px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--bx-surface-2)}
.ag-sug b{display:block;font-size:14px}
.ag-sug small{display:block;font-size:12px;color:var(--bx-text-3)}

.ag-fotos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.ag-carta-r .ag-fotos{grid-template-columns:repeat(2,minmax(0,1fr))}
.ag-slot-w{min-width:0}
.sv-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;aspect-ratio:5/7;border-radius:10px;border:1.5px dashed var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text-2);cursor:pointer;text-align:center;padding:4px;transition:border-color .15s ease,background .15s ease}
.sv-slot:hover{border-color:rgba(var(--ac-1-rgb),.6);background:var(--bx-surface-2)}
.sv-slot input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.sv-slot small{font-size:10.5px;color:var(--bx-text-3)}
.ag-slot-txt{font-size:12px;font-weight:600;line-height:1.2}
.sv-slot-cheio{border-style:solid;border-color:var(--bx-border);padding:0;overflow:hidden;cursor:default}
.sv-slot-cheio img{width:100%;height:100%;object-fit:cover}
.ag-tirar{position:absolute;top:4px;right:4px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(8,10,15,.78);color:#fff;cursor:pointer}

.ag-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px}
.sv-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text-2);font:inherit;font-size:14px;cursor:pointer;transition:border-color .15s ease,background .15s ease,color .15s ease}
.sv-chip-on{border-color:rgba(var(--ac-1-rgb),.8);background:rgba(var(--ac-1-rgb),.10);color:var(--bx-text)}

.ag-rs{display:flex;align-items:center;gap:8px}
.ag-rs b{font-size:15px;color:var(--bx-text-2)}

.ag-chk{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;padding:10px 0;font-size:14px;line-height:1.5;color:var(--bx-text-2);cursor:pointer}
.ag-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ac-1)}
.ag-chk-inv span{color:var(--bx-red)}

.ag-resumo{display:grid;gap:16px;padding:22px;background:var(--bx-bg-elev);box-shadow:var(--bx-shadow)}
.ag-resumo .sv-cta{display:flex;width:100%}
.ag-linhas{display:grid;gap:10px}
.ag-linhas div{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.ag-linhas span{color:var(--bx-text-2)}
.ag-linhas b{font-variant-numeric:tabular-nums;text-align:right}
.ag-pend{margin:0;padding:12px 14px 12px 30px;border-radius:12px;background:color-mix(in srgb,var(--bx-red) 8%,transparent);border:1px solid color-mix(in srgb,var(--bx-red) 26%,transparent);font-size:13px;line-height:1.6;color:var(--bx-text)}

.ag-erro{margin:6px 0 0;font-size:13px;line-height:1.45;color:var(--bx-red)}
.ag-erro-sm{font-size:12px;margin-top:0}
.ag-aviso{padding:14px;border-radius:12px;background:var(--bx-surface-2);display:grid;gap:10px}
.ag-aviso p{margin:0;font-size:14px;line-height:1.5}
.ag-a{color:var(--bx-text);text-decoration:underline}

.ag-ok{max-width:560px;margin:0 auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.ag-ok-ic{width:56px;height:56px;border-radius:16px}
.ag-alerta{display:flex;gap:8px;align-items:flex-start;text-align:left;margin:0;padding:12px 14px;border-radius:12px;font-size:14px;line-height:1.5;background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.3)}
.ag-alerta svg{flex-shrink:0;margin-top:2px;color:var(--ac-1)}

@media (max-width:1024px){
  .ag-grid{grid-template-columns:1fr}
  .ag-lado{position:static}
}
@media (max-width:768px){
  .ag-band{padding:32px 0 64px}
  .ag-bloco{padding:18px;gap:16px}
  .ag-opts,.ag-opts-2,.ag-dois{grid-template-columns:1fr}
  .ag-carta{grid-template-columns:1fr;padding:14px}
  .ag-carta-r .ag-fotos{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ag-login{grid-template-columns:1fr}
  .ag-login-bt > *{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){ .sv-opt,.sv-slot,.sv-chip{transition:none} }
`
