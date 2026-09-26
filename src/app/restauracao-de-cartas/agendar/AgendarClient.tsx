'use client'

// Orcamento pelas fotos, em 4 passos:
//   1. servico + quantidade de cartas (sem login)
//   2. login/cadastro (so se nao houver sessao; volta pra ca com ?servico=&qtd=)
//   3. por carta: nome (busca no catalogo), fotos, o que incomoda, valor declarado
//   4. prazo, WhatsApp opcional e ciencia de recusa
//
// O login vem ANTES das fotos: sem conta o status nao tem onde viver, e pedir
// login depois das fotos perderia as imagens no redirect do Google.
//
// ★ SERVICOS_FORM_ATIVO = false: tudo funciona no navegador (fotos comprimidas,
// validacao, estados), mas o envio nao sai. Liga na F8, com a tabela e as APIs.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  IconCheck, IconMinus, IconPlus, IconUpload, IconClose, IconArrowRight, IconChevronLeft,
  IconWhatsApp, IconWarning, IconAccount,
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
interface Sugestao { ref: string; label: string; sublabel: string; image: string | null; price: number | null }

const novaCarta = (): CartaForm => ({ nome: '', cardId: null, fotos: {}, queixas: [], obs: '', valor: '' })
const MAX_BYTES = 10 * 1024 * 1024
const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp']

function paramServico(s: ServicoId) { return s === 'pre_grading' ? 'pre-grading' : s }
function valorNum(v: string) { return Number(v.replace(/\./g, '').replace(',', '.')) || 0 }

export default function AgendarClient({ servicoInicial, qtdInicial }: { servicoInicial: ServicoId; qtdInicial: number }) {
  const { openSignup, openLogin } = useAuthModal()
  const [passo, setPasso] = useState(1)
  const [servico, setServico] = useState<ServicoId>(servicoInicial)
  const [qtd, setQtd] = useState(qtdInicial)
  const [logado, setLogado] = useState<boolean | null>(null)
  const [cartas, setCartas] = useState<CartaForm[]>(() => Array.from({ length: qtdInicial }, novaCarta))
  const [prazo, setPrazo] = useState<'padrao' | 'expresso'>('padrao')
  const [whats, setWhats] = useState('')
  const [whatsOk, setWhatsOk] = useState(false)
  const [ciente, setCiente] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [aviso, setAviso] = useState('')
  const [numero] = useState<string | null>(null)
  const topo = useRef<HTMLDivElement>(null)

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

  function mudarQtd(n: number) {
    const q = Math.min(MAX_CARTAS_POR_SOLICITACAO, Math.max(1, n))
    setQtd(q)
    setCartas(cs => {
      if (q >= cs.length) return [...cs, ...Array.from({ length: q - cs.length }, novaCarta)]
      cs.slice(q).forEach(c => Object.values(c.fotos).forEach(f => f && URL.revokeObjectURL(f.url)))
      return cs.slice(0, q)
    })
  }

  const atualizar = useCallback((i: number, p: Partial<CartaForm>) => {
    setCartas(cs => cs.map((c, j) => (j === i ? { ...c, ...p } : c)))
  }, [])

  function irPara(n: number) {
    setPasso(n)
    setTentou(false)
    topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const voltarPara = `/restauracao-de-cartas/agendar?servico=${paramServico(servico)}&qtd=${qtd}`

  function seguirDoPasso1() {
    if (logado) irPara(3)
    else irPara(2)
  }

  // Primeira pendencia das cartas, em linguagem de gente ("Falta o verso da carta 2").
  const pendenciaCartas = useMemo(() => {
    for (let i = 0; i < cartas.length; i++) {
      const c = cartas[i]
      const n = cartas.length > 1 ? ` da carta ${i + 1}` : ''
      if (!c.nome.trim()) return `Falta o nome${n}`
      if (!c.fotos.frente) return `Falta a frente${n}`
      if (!c.fotos.verso) return `Falta o verso${n}`
      if (valorNum(c.valor) <= 0) return `Falta o valor declarado${n}`
    }
    return ''
  }, [cartas])

  function enviar() {
    setTentou(true)
    if (!ciente) return
    if (!SERVICOS_FORM_ATIVO) {
      setAviso('O envio pelo site abre em breve. Suas fotos continuam aqui.')
      return
    }
    // F8: POST /api/servicos + upload das fotos por URL assinada entram aqui.
  }

  if (numero) {
    return (
      <div className="sv-wrap ag-ok">
        <style>{AG_CSS}</style>
        <span className="sv-ic sv-ic-ok ag-ok-ic"><IconCheck size={24} strokeWidth={2} /></span>
        <p className="sv-kicker">Solicitação</p>
        <h1 className="sv-h1" style={{ fontSize: 36 }}>{numero}</h1>
        <p className="sv-sub">Orçamento em até {PRAZOS.orcamento || 'poucos dias'}, no seu e-mail e na sua conta.</p>
        <p className="ag-alerta"><IconWarning size={16} /> Não envie a carta ainda. O endereço aparece depois que você aprova o orçamento.</p>
        <a className="sv-cta" href="/compras">Acompanhar solicitação</a>
      </div>
    )
  }

  return (
    <div className="sv-wrap ag" ref={topo}>
      <style>{AG_CSS}</style>
      <div className="ag-head">
        {passo > 1 && (
          <button type="button" className="ag-voltar" onClick={() => irPara(passo === 3 ? 1 : passo - 1)} aria-label="Voltar">
            <IconChevronLeft size={18} />
          </button>
        )}
        <div>
          <p className="sv-kicker" style={{ margin: 0 }}>Orçamento pelas fotos · passo {passo} de 4</p>
          <div className="ag-barra"><span style={{ width: `${(passo / 4) * 100}%` }} /></div>
        </div>
      </div>

      {passo === 1 && (
        <section>
          <h1 className="sv-h2">Qual serviço você quer?</h1>
          <p className="sv-p">O orçamento é grátis. Você só envia a carta depois de aprovar o preço.</p>
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

          <h2 className="sv-h3" style={{ margin: '24px 0 10px' }}>Quantas cartas?</h2>
          <div className="ag-stepper">
            <button type="button" onClick={() => mudarQtd(qtd - 1)} disabled={qtd <= 1} aria-label="Menos uma carta"><IconMinus size={18} /></button>
            <output aria-live="polite">{qtd} {qtd === 1 ? 'carta' : 'cartas'}</output>
            <button type="button" onClick={() => mudarQtd(qtd + 1)} disabled={qtd >= MAX_CARTAS_POR_SOLICITACAO} aria-label="Mais uma carta"><IconPlus size={18} /></button>
          </div>
          {qtd >= MAX_CARTAS_POR_SOLICITACAO && (
            <p className="sv-small">Lote grande? {LINKS.whatsapp ? <a href={LINKS.whatsapp} className="ag-a">Fale com a gente</a> : 'Fale com a gente'} e combinamos o envio.</p>
          )}

          <button type="button" className="sv-cta" style={{ marginTop: 24 }} onClick={seguirDoPasso1} disabled={logado === null}>
            Continuar <IconArrowRight size={18} strokeWidth={2.2} />
          </button>
        </section>
      )}

      {passo === 2 && (
        <section>
          {logado ? (
            <>
              <h1 className="sv-h2">Tudo certo, você já entrou.</h1>
              <button type="button" className="sv-cta" style={{ marginTop: 16 }} onClick={() => irPara(3)}>Mandar as fotos <IconArrowRight size={18} strokeWidth={2.2} /></button>
            </>
          ) : (
            <>
              <span className="sv-ic" style={{ marginBottom: 14 }}><IconAccount size={18} /></span>
              <h1 className="sv-h2">Crie sua conta para acompanhar a sua carta</h1>
              <p className="sv-p">É na sua conta que aparecem o orçamento, o vídeo da chegada, as fotos de cada etapa e o rastreio de volta. Leva menos de um minuto e é grátis.</p>
              <button type="button" className="sv-cta" onClick={() => openSignup({ next: voltarPara })}>Criar conta grátis</button>
              <button type="button" className="sv-ghost" style={{ marginTop: 10 }} onClick={() => openLogin({ next: voltarPara })}>Já tenho conta</button>
            </>
          )}
        </section>
      )}

      {passo === 3 && (
        <section>
          <h1 className="sv-h2">{cartas.length === 1 ? 'Sua carta' : 'Suas cartas'}</h1>
          <p className="sv-p">Frente e verso bastam para o orçamento. Luz de janela, sem sleeve, fundo liso.</p>
          <div className="ag-cartas">
            {cartas.map((c, i) => (
              <CartaBloco key={i} idx={i} total={cartas.length} carta={c} tentou={tentou} onChange={p => atualizar(i, p)} />
            ))}
          </div>
          {tentou && pendenciaCartas && <p className="ag-erro" role="alert">{pendenciaCartas}.</p>}
          <button
            type="button"
            className="sv-cta"
            style={{ marginTop: 20 }}
            onClick={() => { if (pendenciaCartas) setTentou(true); else irPara(4) }}
            aria-disabled={!!pendenciaCartas}
          >
            {pendenciaCartas || 'Continuar'} {!pendenciaCartas && <IconArrowRight size={18} strokeWidth={2.2} />}
          </button>
        </section>
      )}

      {passo === 4 && (
        <section>
          <h1 className="sv-h2">Últimos detalhes</h1>

          {PRECOS?.expresso != null ? (
            <>
              <h2 className="sv-h3" style={{ margin: '16px 0 10px' }}>Prazo</h2>
              <div className="ag-opts" role="radiogroup" aria-label="Prazo">
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
            </>
          ) : (
            <p className="sv-p">{PRAZOS.padraoDiasUteis ? `Prazo de ${PRAZOS.padraoDiasUteis} dias úteis após a chegada.` : 'O prazo vem no orçamento, contado a partir da chegada da carta.'}</p>
          )}

          <label className="ag-fld" style={{ marginTop: 18 }}>
            <span>WhatsApp <em>opcional</em></span>
            <input value={whats} onChange={e => setWhats(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" />
          </label>
          {whats.trim() && (
            <label className="ag-chk">
              <input type="checkbox" checked={whatsOk} onChange={e => setWhatsOk(e.target.checked)} />
              <span>Pode me chamar no WhatsApp sobre este orçamento.</span>
            </label>
          )}

          <label className={`ag-chk${tentou && !ciente ? ' ag-chk-inv' : ''}`} style={{ marginTop: 14 }}>
            <input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)} />
            <span>Sei que o orçamento pode recusar cartas que precisariam de repintura, recolagem ou corte.</span>
          </label>
          {tentou && !ciente && <p className="ag-erro" role="alert">Marque a caixa acima para continuar.</p>}

          <div className="ag-resumo">
            <div><span>Serviço</span><b>{SERVICOS.find(s => s.id === servico)?.nome}</b></div>
            <div><span>Cartas</span><b>{qtd}</b></div>
            <div><span>Valor declarado</span><b>R$ {brl(cartas.reduce((s, c) => s + valorNum(c.valor), 0))}</b></div>
          </div>

          <button type="button" className="sv-cta" style={{ marginTop: 18 }} onClick={enviar}>Enviar para orçamento</button>
          {aviso && (
            <div className="ag-aviso" role="status">
              <p>{aviso}</p>
              {LINKS.whatsapp && <a className="sv-ghost" href={LINKS.whatsapp}><IconWhatsApp size={18} /> Pedir pelo WhatsApp</a>}
            </div>
          )}
          <p className="sv-small" style={{ textAlign: 'center' }}>Nada é cobrado agora.</p>
        </section>
      )}
    </div>
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

      <label className="ag-fld">
        <span>Valor declarado <em>base do seguro</em></span>
        <span className="ag-rs">
          <b>R$</b>
          <input className={inv(valorNum(carta.valor) <= 0)} value={carta.valor} onChange={e => onChange({ valor: e.target.value.replace(/[^\d.,]/g, '') })} inputMode="decimal" placeholder="0,00" />
        </span>
        {carta.cardId && <small className="ag-dica">Preenchido com o preço do Mercado Brasileiro. Ajuste se a sua carta vale mais ou menos.</small>}
      </label>
    </fieldset>
  )
}

const AG_CSS = `
.ag{padding:20px 0 120px}
.ag-head{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.ag-head > div{flex:1;min-width:0}
.ag-voltar{width:44px;height:44px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);cursor:pointer}
.ag-barra{height:4px;border-radius:999px;background:var(--bx-surface-2);margin-top:8px;overflow:hidden}
.ag-barra span{display:block;height:100%;background:var(--ac-grad);transition:width .2s ease}

.ag-opts{display:grid;gap:10px}
.sv-opt{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;min-height:68px;padding:12px 14px;border-radius:14px;text-align:left;font:inherit;color:var(--bx-text);background:var(--bx-surface);border:1px solid var(--bx-border-2);cursor:pointer;transition:border-color .15s ease,background .15s ease}
.sv-opt:hover{background:var(--bx-surface-2)}
.sv-opt-on{border-color:rgba(var(--ac-1-rgb),.8);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.10),rgba(var(--ac-2-rgb),.04))}
.sv-opt-dot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--bx-border-2);color:var(--bx-brand-ink)}
.sv-opt-on .sv-opt-dot{background:var(--ac-grad);border-color:transparent}
.sv-opt-l{min-width:0;display:flex;flex-direction:column;gap:2px}
.sv-opt-l b{font-size:15px}
.sv-opt-l small{font-size:12.5px;line-height:1.35;color:var(--bx-text-2)}
.sv-opt-r{text-align:right;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}
.sv-opt-r small{display:block;font-weight:400;font-size:11px;color:var(--bx-text-3)}

.ag-stepper{display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;border-radius:14px;border:1px solid var(--bx-border-2);background:var(--bx-surface);overflow:hidden}
.ag-stepper button{height:52px;border:0;background:transparent;color:var(--bx-text);display:grid;place-items:center;cursor:pointer}
.ag-stepper button:disabled{color:var(--bx-text-faint);cursor:not-allowed}
.ag-stepper output{text-align:center;font-weight:700;font-size:16px;font-variant-numeric:tabular-nums}

.ag-cartas{display:grid;gap:14px}
.ag-carta{margin:0;padding:16px;border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface);display:grid;gap:16px;min-width:0}
.ag-carta legend{padding:0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}

.ag-fld{display:flex;flex-direction:column;gap:6px;min-width:0}
.ag-fld > span:first-child,.ag-fld > label{display:flex;justify-content:space-between;gap:6px;font-size:12.5px;font-weight:600;color:var(--bx-text-2)}
.ag-fld em{font-style:normal;font-weight:400;color:var(--bx-text-3)}
.ag-fld input,.ag-fld textarea{width:100%;min-height:48px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text);padding:12px;font:inherit;font-size:16px;color-scheme:dark}
.ag-fld textarea{min-height:0;resize:vertical}
.ag-fld input:focus,.ag-fld textarea:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.7)}
.ag-inv{border-color:var(--bx-red) !important}
.ag-ok-txt{display:inline-flex;align-items:center;gap:4px;font-style:normal;font-size:12px;color:var(--bx-green)}
.ag-dica{font-size:12px;line-height:1.4;color:var(--bx-text-3)}

.ag-busca{position:relative}
.ag-sug{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:10;list-style:none;margin:0;padding:6px;border-radius:12px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow)}
.ag-sug button{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:var(--bx-text);font:inherit;text-align:left;cursor:pointer}
.ag-sug button:hover{background:var(--bx-surface-2)}
.ag-sug img,.ag-sug-ph{width:30px;height:42px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--bx-surface-2)}
.ag-sug b{display:block;font-size:14px}
.ag-sug small{display:block;font-size:12px;color:var(--bx-text-3)}

.ag-fotos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.ag-slot-w{min-width:0}
.sv-slot{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;aspect-ratio:5/7;border-radius:10px;border:1.5px dashed var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text-2);cursor:pointer;text-align:center;padding:4px;transition:border-color .15s ease,background .15s ease}
.sv-slot:hover{border-color:rgba(var(--ac-1-rgb),.6);background:var(--bx-surface-2)}
.sv-slot input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
.sv-slot small{font-size:10.5px;color:var(--bx-text-3)}
.ag-slot-txt{font-size:12px;font-weight:600;line-height:1.2}
.sv-slot-cheio{border-style:solid;border-color:var(--bx-border);padding:0;overflow:hidden;cursor:default}
.sv-slot-cheio img{width:100%;height:100%;object-fit:cover}
.ag-tirar{position:absolute;top:4px;right:4px;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;border:0;background:rgba(8,10,15,.78);color:#fff;cursor:pointer}

.ag-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px}
.sv-chip{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text-2);font:inherit;font-size:14px;cursor:pointer;transition:border-color .15s ease,background .15s ease,color .15s ease}
.sv-chip-on{border-color:rgba(var(--ac-1-rgb),.8);background:rgba(var(--ac-1-rgb),.10);color:var(--bx-text)}

.ag-rs{display:flex;align-items:center;gap:8px}
.ag-rs b{font-size:15px;color:var(--bx-text-2)}

.ag-chk{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;padding:10px 0;font-size:14px;line-height:1.5;color:var(--bx-text-2);cursor:pointer}
.ag-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ac-1)}
.ag-chk-inv span{color:var(--bx-red)}

.ag-resumo{margin-top:18px;padding:14px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border);display:grid;gap:8px}
.ag-resumo div{display:flex;justify-content:space-between;gap:10px;font-size:14px}
.ag-resumo span{color:var(--bx-text-2)}
.ag-resumo b{font-variant-numeric:tabular-nums}

.ag-erro{margin:10px 0 0;font-size:13px;line-height:1.45;color:var(--bx-red)}
.ag-erro-sm{font-size:11.5px;margin-top:4px}
.ag-aviso{margin-top:14px;padding:14px;border-radius:12px;background:var(--bx-surface-2);display:grid;gap:10px}
.ag-aviso p{margin:0;font-size:14px;line-height:1.5}
.ag-a{color:var(--bx-text);text-decoration:underline}

.ag-ok{padding:48px 0 80px;text-align:center}
.ag-ok-ic{width:56px;height:56px;border-radius:16px;margin:0 auto 16px}
.ag-alerta{display:flex;gap:8px;align-items:flex-start;text-align:left;margin:0 0 20px;padding:12px 14px;border-radius:12px;font-size:14px;line-height:1.5;background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.3)}
.ag-alerta svg{flex-shrink:0;margin-top:2px;color:var(--ac-1)}

@media (prefers-reduced-motion:reduce){ .ag-barra span,.sv-opt,.sv-slot,.sv-chip{transition:none} }
`
