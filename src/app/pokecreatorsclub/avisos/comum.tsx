'use client'

// Pecas dos Avisos do Club (08/11/2026, wireframe aprovado): linha da lista,
// fixado compacto, chips de estado, enquete e imagem em tela cheia.

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { chipPrazo, dataCurta, erroAviso, pedeResposta, ehNovo, type Aviso, type EnqueteAviso } from '@/lib/pcc/avisos'
import { avisoUrl } from '@/lib/pcc/rotas'
import { Ico } from '../amigo-secreto/estilo'

const BUCKET = 'club-fotos'
export const urlImagem = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

export function ChipsAviso({ a, visto, comFixado }: { a: Aviso; visto: number | null; comFixado?: boolean }) {
  const prazo = chipPrazo(a)
  const chips = [
    comFixado && a.fixado ? <span key="f" className="as-chip"><Ico n="tachinha" s={13} />Fixado</span> : null,
    a.status === 'rascunho' ? <span key="r" className="as-chip">Rascunho</span> : null,
    a.status === 'arquivado' ? <span key="a" className="as-chip">Arquivado</span> : null,
    prazo ? <span key="p" className={`as-chip${prazo.forte ? ' wait' : ''}`}>{prazo.texto}</span> : null,
    pedeResposta(a) ? <span key="e" className="as-chip fill">Responder</span> : null,
    ehNovo(a, visto) ? <span key="n" className="as-chip ok">Novo</span> : null,
  ].filter(Boolean)
  return chips.length ? <div className="as-chips av-chips">{chips}</div> : null
}

export function LinhaAviso({ a, visto, href }: { a: Aviso; visto: number | null; href?: string }) {
  return (
    <Link href={href || avisoUrl(a.slug)} className="av-linha">
      {a.imagens[0]
        ? <span className="av-mini"><Image src={urlImagem(a.imagens[0])} alt="" fill sizes="56px" /></span>
        : <span className="av-mini av-mini-ico" aria-hidden="true"><Ico n={a.enquete ? 'enquete' : 'megafone'} s={22} /></span>}
      <span className="av-tx">
        <b>{a.titulo}</b>
        <small className="av-res">{a.resumo}</small>
        <small className="av-meta">{a.autor ? `por @${a.autor}` : 'Organização do Club'}{a.publicado_em ? ` · ${dataCurta(a.publicado_em)}` : ''}{a.tem_atualizacoes ? ' · atualizado' : ''}</small>
        <ChipsAviso a={a} visto={visto} />
      </span>
      <Ico n="chev" className="arr" />
    </Link>
  )
}

export function FixadoCompacto({ a }: { a: Aviso }) {
  return (
    <Link href={avisoUrl(a.slug)} className="av-fixado">
      {/* Fixado tambem mostra prazo e "Responder": senao a enquete some da lista. */}
      <ChipsAviso a={a} visto={null} comFixado />
      <b>{a.titulo}</b>
      <small className="av-res">{a.resumo}</small>
      <span className="av-ler">Ler tudo</span>
    </Link>
  )
}

/** Enquete do aviso: vota (escolha unica ou varias) e mostra o resultado depois do voto. */
export function Enquete({ avisoId, enquete, onAtualizar }: { avisoId: string; enquete: EnqueteAviso; onAtualizar: (a: Aviso) => void }) {
  const [mudando, setMudando] = useState(false)
  const [escolha, setEscolha] = useState<number[]>(enquete.meu_voto || [])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const votou = !!enquete.meu_voto
  const votando = enquete.aberta && (!votou || mudando)

  function alternar(i: number) {
    setEscolha(e => enquete.multipla ? (e.includes(i) ? e.filter(x => x !== i) : [...e, i]) : [i])
  }
  async function votar() {
    if (!escolha.length) { setErro('Escolha uma opção.'); return }
    setOcupado(true); setErro('')
    const { data, error } = await supabase.rpc('club_aviso_votar', { p_aviso: avisoId, p_opcoes: escolha })
    setOcupado(false)
    if (error) { setErro(erroAviso(error.message)); return }
    setMudando(false)
    onAtualizar(data as Aviso)
  }

  const contagem = enquete.contagem || []
  const total = enquete.total || 0
  return (
    <section className="av-enq" aria-label="Enquete">
      <div className="as-k"><Ico n="enquete" s={14} />Enquete{enquete.aberta ? '' : ' · Encerrada'}{total ? ` · ${total} ${total === 1 ? 'voto' : 'votos'}` : ''}</div>
      <h2 className="as-h3">{enquete.pergunta}</h2>
      {enquete.regra && <div className="as-note strong">{enquete.regra}</div>}
      {votando ? (
        <>
          <div role={enquete.multipla ? 'group' : 'radiogroup'} aria-label={enquete.pergunta} className="av-opcs">
            {enquete.opcoes.map((o, idx) => {
              const i = idx + 1
              const on = escolha.includes(i)
              return (
                <button key={i} type="button" role={enquete.multipla ? 'checkbox' : 'radio'} aria-checked={on} className={`av-opc${on ? ' on' : ''}`} onClick={() => alternar(i)}>
                  <span className={`av-marca${enquete.multipla ? ' q' : ''}`}>{on && <Ico n="check" s={14} />}</span>{o}
                </button>
              )
            })}
          </div>
          {enquete.multipla && <span className="as-hint">Pode marcar mais de uma.</span>}
          {erro && <div className="as-erro" role="alert">{erro}</div>}
          <button type="button" className="as-btn pri" disabled={ocupado || !escolha.length} onClick={votar}>{ocupado ? 'Enviando...' : votou ? 'Salvar voto' : 'Votar'}</button>
          {mudando && <button type="button" className="as-btn lnk" onClick={() => { setMudando(false); setEscolha(enquete.meu_voto || []) }}>Cancelar</button>}
        </>
      ) : (
        <>
          <div className="av-barras">
            {enquete.opcoes.map((o, idx) => {
              const n = contagem[idx] || 0
              const p = total ? Math.round((n / total) * 100) : 0
              const meu = !!enquete.meu_voto?.includes(idx + 1)
              return (
                <div key={idx} className={`av-barra${meu ? ' meu' : ''}`}>
                  <div className="t"><span>{o}{meu && <em> · Seu voto</em>}</span><span>{n} · {p}%</span></div>
                  <div className="b"><i style={{ width: `${p}%` }} /></div>
                </div>
              )
            })}
          </div>
          {!votou && !enquete.aberta && <span className="as-hint">Você não votou.</span>}
          {votou && enquete.aberta && <button type="button" className="as-btn" onClick={() => setMudando(true)}>Mudar voto</button>}
        </>
      )}
    </section>
  )
}

/** Imagem em tela cheia: tabela de medidas e arte vertical nao cabem legiveis em 375 px. */
export function TelaCheia({ imagens, inicio, onFechar }: { imagens: string[]; inicio: number; onFechar: () => void }) {
  const [i, setI] = useState(inicio)
  const ref = useRef<HTMLDivElement | null>(null)
  // Ao fechar, o foco volta para a imagem que abriu a tela cheia.
  useEffect(() => {
    const origem = document.activeElement as HTMLElement | null
    return () => origem?.focus()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
      if (e.key === 'Tab' && ref.current) {
        // Foco preso dentro da tela cheia.
        const fs = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
        if (!fs.length) return
        const atual = fs.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        fs[(atual + (e.shiftKey ? -1 : 1) + fs.length) % fs.length].focus()
      }
      if (e.key === 'ArrowRight') setI(x => Math.min(x + 1, imagens.length - 1))
      if (e.key === 'ArrowLeft') setI(x => Math.max(x - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onFechar, imagens.length])
  return (
    <div ref={ref} tabIndex={-1} className="av-cheia" role="dialog" aria-modal="true" aria-label="Imagem do aviso">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urlImagem(imagens[i])} alt="" />
      <div className="av-cheia-bar">
        {imagens.length > 1 && <button type="button" className="as-btn sm" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>}
        {imagens.length > 1 && <span className="as-meta">{i + 1} de {imagens.length}</span>}
        {imagens.length > 1 && <button type="button" className="as-btn sm" disabled={i === imagens.length - 1} onClick={() => setI(i + 1)}>Próxima</button>}
        <button type="button" className="as-btn pri sm" onClick={onFechar}>Fechar</button>
      </div>
    </div>
  )
}

export const AV_CSS = `
.av-linha{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--bx-border);color:var(--bx-text);text-decoration:none;transition:background .15s ease}
.av-linha:hover{background:var(--bx-surface)}
.av-linha .arr{color:var(--bx-text-3);margin-top:16px;flex:none}
.av-mini{position:relative;width:56px;height:56px;border-radius:10px;overflow:hidden;flex:none;border:1px solid var(--bx-border);background:var(--bx-surface-2)}
.av-mini img{object-fit:cover}
.av-mini-ico{display:inline-flex;align-items:center;justify-content:center;color:var(--ac-1)}
.av-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.av-tx b{font-size:15px;font-weight:700;line-height:1.3}
.av-res{font-size:13px;color:var(--bx-text-2);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.av-meta{font-size:12px;color:var(--bx-text-3)}
.av-chips{margin-top:4px}
.av-chips .as-chip,.av-topo-chips .as-chip{display:inline-flex;align-items:center;gap:4px}
.av-fixado{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:14px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);text-decoration:none;transition:background .15s ease}
.av-fixado:hover{background:var(--bx-surface-2)}
.av-fixado .as-chip{align-self:flex-start;display:inline-flex;align-items:center;gap:4px}
.av-fixado b{font-size:15px}
.av-ler{font-size:13px;font-weight:700;color:var(--ac-1);min-height:28px;display:inline-flex;align-items:center}
.av-enq{display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;border:1px solid var(--bx-border-2);background:var(--bx-surface)}
.av-enq .as-k{display:inline-flex;align-items:center;gap:6px}
.av-opcs{display:flex;flex-direction:column;gap:8px}
.av-opc{min-height:48px;display:flex;align-items:center;gap:12px;padding:0 14px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14px;text-align:left;cursor:pointer;transition:border-color .15s ease,background .15s ease}
.av-opc.on{border-color:var(--ac-1);background:rgba(var(--ac-1-rgb),.08);font-weight:700}
.av-marca{width:22px;height:22px;border-radius:50%;border:2px solid var(--bx-border-2);display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--bx-brand-ink)}
.av-marca.q{border-radius:6px}
.av-opc.on .av-marca{background:var(--ac-1);border-color:var(--ac-1)}
.av-barras{display:flex;flex-direction:column;gap:10px}
.av-barra .t{display:flex;justify-content:space-between;gap:8px;font-size:13.5px;margin-bottom:4px}
.av-barra .t em{font-style:normal;color:var(--ac-1);font-weight:700}
.av-barra .b{height:10px;border-radius:999px;background:var(--bx-surface-3);overflow:hidden}
.av-barra .b i{display:block;height:100%;background:var(--bx-text-3);border-radius:999px;transition:width .2s ease}
.av-barra.meu .b i{background:var(--ac-grad)}
.av-cheia{position:fixed;inset:0;z-index:80;background:var(--bx-scrim);backdrop-filter:blur(6px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;touch-action:pinch-zoom}
.av-cheia img{max-width:100%;max-height:calc(100dvh - 120px);object-fit:contain}
.av-cheia-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center}
.av-cheia-bar .as-btn{width:auto}
.av-cheia-bar .as-meta{color:var(--bx-text-2)}
/* Capa (foto ou automatica). O pai define o tamanho. */
.av-capa{position:absolute;inset:0;display:block;overflow:hidden}
.av-capa img{object-fit:cover}
.av-poster .bg{object-fit:cover;filter:blur(28px) saturate(1.2) brightness(.55);transform:scale(1.2)}
.av-poster .fg{object-fit:contain !important;padding:16px}
.av-auto{background:radial-gradient(circle at 85% 20%,rgba(var(--ac-1-rgb),.40),transparent 50%),radial-gradient(circle at 10% 100%,rgba(var(--ac-2-rgb),.30),transparent 55%),var(--bx-bg-elev)}
.av-auto-negocios,.av-auto-pedido{background:repeating-linear-gradient(135deg,var(--bx-surface) 0 14px,transparent 14px 28px),radial-gradient(circle at 85% 20%,rgba(var(--ac-1-rgb),.40),transparent 50%),radial-gradient(circle at 10% 100%,rgba(var(--ac-2-rgb),.30),transparent 55%),var(--bx-bg-elev)}
.av-auto-com{background:radial-gradient(circle at 80% 15%,rgba(var(--ac-2-rgb),.35),transparent 55%),radial-gradient(circle at 15% 90%,rgba(var(--ac-1-rgb),.30),transparent 55%),var(--bx-bg-elev)}
.av-auto .word{position:absolute;left:16px;bottom:12px;max-width:calc(100% - 32px);font-size:clamp(28px,12cqw,56px);font-weight:800;letter-spacing:-.04em;line-height:.95;color:var(--bx-text);overflow-wrap:anywhere}
.av-auto .word small{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac-1);margin-bottom:8px;font-weight:800}
.av-auto .big{position:absolute;right:-10px;top:12px;color:var(--ac-1);opacity:.9}
.av-auto .big .as-ico{width:min(150px,45cqw);height:min(150px,45cqw);stroke-width:1.2}
.av-auto .selo{position:absolute;right:4%;top:6%;width:min(150px,42%);height:auto}
.av-auto .pcc{position:absolute;right:12px;bottom:12px;width:min(64px,18%);opacity:.9}
.av-auto-com .logo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(74%,320px)}
.av-auto-com .sl{position:absolute;width:min(38%,170px)}
.av-auto-com .sl.a{left:-6%;bottom:-8%}
.av-auto-com .sl.b{right:-6%;top:-8%}
.av-capa{container-type:inline-size}

/* Secao e fileira "Vem ai" (lista e detalhe). */
.av-sec{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:28px 0 12px}
.av-sec h2{margin:0;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--bx-text-2)}
.av-sec .sub{margin:4px 0 0;font-size:12px;color:var(--bx-text-3)}
.av-sec a{font-size:13px;font-weight:600;color:var(--ac-1);min-height:44px;display:inline-flex;align-items:center;margin:-14px 0;text-decoration:none}
.av-rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-left:16px;margin:0 -16px;padding:0 16px 4px;scrollbar-width:none}
.av-rail::-webkit-scrollbar{display:none}
.av-ev{scroll-snap-align:start;flex:0 0 142px;min-height:172px;border-radius:18px;background:var(--bx-surface);border:1px solid var(--bx-border);padding:12px;position:relative;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:var(--bx-text);transition:transform .2s ease,border-color .2s ease}
.av-ev:hover{transform:translateY(-2px);border-color:var(--bx-border-2)}
.av-ev .d{font-size:40px;font-weight:800;letter-spacing:-.04em;line-height:.9;font-variant-numeric:tabular-nums}
.av-ev .dm{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1);margin-top:6px}
.av-ev .soon{align-self:flex-start;margin-top:8px;height:24px}
.av-ev .t4{font-size:14px;font-weight:700;line-height:1.25;margin-top:auto;padding-top:10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.av-ev .t{font-size:12px;color:var(--bx-text-3);margin-top:4px;display:flex;align-items:center;gap:4px}
.av-ev .ico{position:absolute;right:12px;top:12px;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),.10);color:var(--ac-1);border:1px solid rgba(var(--ac-1-rgb),.25)}
.av-ev.next{border-color:rgba(var(--ac-1-rgb),.45);background:linear-gradient(160deg,rgba(var(--ac-1-rgb),.12),var(--bx-surface) 60%)}
.av-ev.big{border-color:rgba(var(--ac-2-rgb),.35);background:linear-gradient(160deg,rgba(var(--ac-2-rgb),.14),var(--bx-surface) 65%)}
.av-ev.big .dm{color:var(--ac-2)}
.av-ev.all{justify-content:space-between;background:var(--bx-bg-elev);border-style:dashed;border-color:var(--bx-border-2)}
.av-ev.all .ico{position:static}
.av-ev.all .t4{margin-top:0;font-size:15px}
.av-ev.all .t{color:var(--ac-1);font-weight:700;font-size:13px}
@media (min-width:1024px){
  .av-sec{padding:40px 0 14px}
  .av-rail{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px;overflow:visible;margin:0;padding:0}
  .av-ev{min-height:200px;padding:16px}
  .av-ev .d{font-size:52px}
  .av-ev .t4{font-size:16px}
}
@media (prefers-reduced-motion:reduce){.av-linha,.av-fixado,.av-opc,.av-barra .b i,.av-ev{transition:none}}
`
