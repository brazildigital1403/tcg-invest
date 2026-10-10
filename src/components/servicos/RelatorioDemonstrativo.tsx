'use client'

// Demonstrativo do relatorio de bancada impresso, com dados ficticios. Cada
// exemplo e uma pasta de WebP estaticas em public/servicos/, renderizadas do
// mockup aprovado; <img> direto (sem next/image) para nao gastar Image
// Optimization. O numero de paginas sai da lista, nunca de numero cravado.
//
//   pre_grading -> relatorio-pre-grading (pedido #S-0003, so pre-grading)
//   completo    -> relatorio-exemplo (pedido #S-0002, restauracao + pre-grading)
//
// O exemplo vai por chave (string) e nao por objeto porque a pagina e server
// component: icone e funcao e nao atravessa a fronteira como prop.
//
// Palco: a pagina ativa na frente, as duas seguintes em leque atras. No
// desktop, passar o mouse (ou o foco) numa linha da lista troca a pagina do
// palco; clicar abre ampliada. No celular, tocar na linha abre direto.
// O lightbox segue o comportamento do GaleriaMidias: setas, teclado, swipe,
// Esc fecha, scroll travado.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  IconArticle, IconCamera, IconCheck, IconBox, IconSearch, IconChevronLeft, IconChevronRight, IconClose,
} from '@/components/ui/Icons'

const W = 1240
const H = 1754

interface Exemplo {
  pasta: string
  intro: string
  fotos: { t: string; d: string }
  paginas: { t: string; d: string }[]
}

const EXEMPLOS = {
  pre_grading: {
    pasta: '/servicos/relatorio-pre-grading',
    intro: 'Relatório de um pedido de pré-grading de um Charizard do Base Set. Escolha uma página para ver a composição em tamanho grande.',
    fotos: { t: 'Registro de entrada', d: 'Mesma luz, mesmo enquadramento.' },
    paginas: [
      { t: 'Capa e resumo', d: 'A frente na chegada em tamanho real, a faixa provável, a graduadora recomendada e o próximo passo. O essencial cabe em uma folha.' },
      { t: 'Identificação e ficha', d: 'A carta identificada e a condição de cada pilar, frente e verso, com cada dano localizado. Tudo registrado na chegada.' },
      { t: 'Laudo de pré-grading', d: 'Centralização medida em milímetros, mapa de imperfeições e faixa provável, com a graduadora indicada e o porquê do próximo passo.' },
      { t: 'Registro de entrada', d: 'Frente, verso, cantos e bordas fotografados na chegada, mais ângulo e luz rasante, que revela o que a foto comum esconde.' },
      { t: 'Valores e linha do tempo', d: 'O que você pagou, a custódia, o rastreio e cada etapa do pedido com data e hora de Brasília.' },
      { t: 'Termos e conferência', d: 'O termo que você aceitou, as ressalvas e a conferência da bancada com o número de custódia.' },
    ],
  },
  completo: {
    pasta: '/servicos/relatorio-exemplo',
    intro: 'Relatório de um pedido de restauração + pré-grading de um Charizard do Base Set. Escolha uma página para ver a composição em tamanho grande.',
    fotos: { t: 'Chegada e saída', d: 'Mesma luz, mesmo enquadramento.' },
    paginas: [
      { t: 'Capa e resumo', d: 'Chegada e saída lado a lado, faixa provável, graduadora recomendada e próximo passo. O essencial cabe em uma folha.' },
      { t: 'Ficha de condição', d: 'Cada pilar avaliado na chegada e na saída, e cada dano com o estado final. Tudo lado a lado, ponto por ponto.' },
      { t: 'Proposta de tratamento', d: 'Cada procedimento com problema, risco e alternativa. Só fazemos o que você aprovou, e o que você recusou fica registrado.' },
      { t: 'Antes e depois', d: 'Frente, verso e os quatro cantos fotografados na chegada e na saída, com a mesma luz e o mesmo enquadramento.' },
      { t: 'Detalhe e luz rasante', d: 'Cantos do verso, bordas, ângulo e luz rasante, que revela na superfície o que a foto comum esconde.' },
      { t: 'Laudo de pré-grading', d: 'Centralização medida em milímetros, mapa de imperfeições e faixa provável, com a graduadora indicada para a carta.' },
      { t: 'Valores e linha do tempo', d: 'Cada valor pago, a custódia, o rastreio e cada etapa do pedido com data e hora de Brasília.' },
      { t: 'Termos e conferência', d: 'Os termos que você aceitou, as ressalvas e a conferência da bancada com o número de custódia.' },
    ],
  },
} satisfies Record<string, Exemplo>

export type ExemploRelatorio = keyof typeof EXEMPLOS

export default function RelatorioDemonstrativo({ exemplo }: { exemplo: ExemploRelatorio }) {
  const { pasta, intro, fotos, paginas: PAGINAS } = EXEMPLOS[exemplo]
  const TOTAL = PAGINAS.length
  const grande = (i: number) => `${pasta}/pagina-${i + 1}.webp`
  const mini = (i: number) => `${pasta}/pagina-${i + 1}-560.webp`
  const srcSet = (i: number) => `${mini(i)} 560w, ${grande(i)} 1240w`
  const alt = (i: number) => `Página ${i + 1} de ${TOTAL} do relatório de exemplo, com o texto borrado: ${PAGINAS[i].t.toLowerCase()}`
  const DESTAQUES = [
    { Ic: IconArticle, t: `${TOTAL} páginas por carta`, d: 'Impressas em A4.' },
    { Ic: IconCamera, ...fotos },
    { Ic: IconCheck, t: 'Conferido na bancada', d: 'Com data e número de custódia.' },
    { Ic: IconBox, t: 'Volta com a carta', d: 'Impresso, na embalagem lacrada.' },
  ]

  const [ativa, setAtiva] = useState(0)
  const [aberta, setAberta] = useState<number | null>(null)
  const toque = useRef<{ x: number; y: number } | null>(null)
  const origem = useRef<HTMLElement | null>(null)
  const botaoFechar = useRef<HTMLButtonElement>(null)

  const abrir = useCallback((i: number) => {
    origem.current = document.activeElement as HTMLElement | null
    setAtiva(i)
    setAberta(i)
  }, [])
  const fechar = useCallback(() => setAberta(null), [])
  // Navegar no modal tambem move o palco, para a pagina vista ficar na frente ao fechar.
  const ir = useCallback((passo: number) => {
    if (aberta === null) return
    const n = (aberta + passo + TOTAL) % TOTAL
    setAberta(n)
    setAtiva(n)
  }, [aberta, TOTAL])
  const proximo = useCallback(() => ir(1), [ir])
  const anterior = useCallback(() => ir(-1), [ir])

  const estaAberto = aberta !== null
  useEffect(() => {
    if (!estaAberto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    botaoFechar.current?.focus()
    const volta = origem.current
    return () => {
      document.body.style.overflow = prev
      volta?.focus?.()
    }
  }, [estaAberto])

  useEffect(() => {
    if (!estaAberto) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar()
      else if (e.key === 'ArrowRight') proximo()
      else if (e.key === 'ArrowLeft') anterior()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [estaAberto, fechar, proximo, anterior])

  // Pre-carrega as vizinhas para a seta nao piscar.
  useEffect(() => {
    if (aberta === null) return
    for (const j of [(aberta + 1) % TOTAL, (aberta - 1 + TOTAL) % TOTAL]) {
      const im = new Image()
      im.src = `${pasta}/pagina-${j + 1}.webp`
    }
  }, [aberta, TOTAL, pasta])

  const atras1 = (ativa + 1) % TOTAL
  const atras2 = (ativa + 2) % TOTAL

  return (
    <div className="rd">
      <style>{CSS}</style>

      <ul className="rd-dest">
        {DESTAQUES.map(({ Ic, t, d }) => (
          <li key={t}>
            <span className="sv-ic"><Ic size={18} /></span>
            <div><b>{t}</b><span>{d}</span></div>
          </li>
        ))}
      </ul>

      <div className="rd-grid">
        <div className="rd-palco-w">
          <div className="rd-selo-w">
            <span className="rd-selo"><i aria-hidden />Exemplo com dados fictícios</span>
            <p className="rd-selo-nota">Texto borrado de propósito. O relatório completo é exclusivo de quem envia a carta para a Bynx.</p>
          </div>
          <button type="button" className="rd-palco" onClick={() => abrir(ativa)} aria-label={`Ampliar a página ${ativa + 1}: ${PAGINAS[ativa].t}`}>
            <span className="rd-folha rd-f3" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mini(atras2)} alt="" width={W} height={H} loading="lazy" decoding="async" />
            </span>
            <span className="rd-folha rd-f2" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mini(atras1)} alt="" width={W} height={H} loading="lazy" decoding="async" />
            </span>
            <span className="rd-folha rd-f1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={ativa}
                src={grande(ativa)}
                srcSet={srcSet(ativa)}
                sizes="(max-width: 900px) 64vw, 420px"
                alt={alt(ativa)}
                width={W}
                height={H}
                loading="lazy"
                decoding="async"
              />
            </span>
            <span className="rd-ampliar"><IconSearch size={16} strokeWidth={2} /> Ampliar</span>
          </button>
          <p className="rd-legenda">
            <b>Página {ativa + 1} de {TOTAL}</b> · {PAGINAS[ativa].t}
          </p>
        </div>

        <div className="rd-lado">
          <p className="rd-intro">{intro}</p>
          <ol className="rd-lista">
            {PAGINAS.map((p, i) => (
              <li key={p.t}>
                <button
                  type="button"
                  className={i === ativa ? 'rd-item on' : 'rd-item'}
                  aria-current={i === ativa ? 'true' : undefined}
                  onMouseEnter={() => setAtiva(i)}
                  onFocus={() => setAtiva(i)}
                  onClick={() => abrir(i)}
                >
                  <span className="rd-n">{i + 1}</span>
                  <span className="rd-txt"><b>{p.t}</b><span>{p.d}</span></span>
                  <IconChevronRight size={18} />
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {aberta !== null && (
        <div
          className="rd-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Relatório de exemplo, página ${aberta + 1} de ${TOTAL}`}
          onClick={fechar}
          onTouchStart={e => {
            toque.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
          }}
          onTouchEnd={e => {
            const t0 = toque.current
            toque.current = null
            if (!t0 || e.touches.length > 0) return
            const dx = e.changedTouches[0].clientX - t0.x
            const dy = e.changedTouches[0].clientY - t0.y
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) proximo(); else anterior() }
          }}
        >
          <div className="rd-m-topo" onClick={e => e.stopPropagation()}>
            <div className="rd-m-tit">
              <b>{PAGINAS[aberta].t}</b>
              <span><span className="rd-m-cont">{aberta + 1} / {TOTAL}</span> Exemplo fictício, texto borrado</span>
            </div>
            <button ref={botaoFechar} type="button" className="rd-m-x" onClick={fechar} aria-label="Fechar"><IconClose size={20} /></button>
          </div>

          <div className="rd-m-palco">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={aberta}
              src={grande(aberta)}
              alt={alt(aberta)}
              width={W}
              height={H}
              decoding="async"
              onClick={e => e.stopPropagation()}
            />
          </div>

          <div className="rd-m-base" onClick={e => e.stopPropagation()}>
            <button type="button" className="rd-m-nav" onClick={anterior} aria-label="Página anterior"><IconChevronLeft size={22} /></button>
            <p>{PAGINAS[aberta].d} <a href={grande(aberta)} target="_blank" rel="noopener">Abrir em tamanho real</a></p>
            <button type="button" className="rd-m-nav" onClick={proximo} aria-label="Próxima página"><IconChevronRight size={22} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.rd{display:flex;flex-direction:column;gap:48px;min-width:0}

/* Destaques de confianca */
.rd-dest{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.rd-dest li{display:flex;gap:12px;align-items:flex-start;padding:16px;border-radius:14px;background:var(--bx-surface);border:1px solid var(--bx-border);min-width:0}
.rd-dest b{display:block;font-size:14.5px;font-weight:700;margin:1px 0 3px}
.rd-dest div span{display:block;font-size:13px;line-height:1.45;color:var(--bx-text-2)}

.rd-grid{display:grid;grid-template-columns:minmax(0,0.95fr) minmax(0,1.05fr);gap:56px;align-items:center}

/* Palco: pagina ativa na frente, duas em leque atras */
.rd-palco-w{position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;min-width:0;padding:8px 0}
.rd-palco-w::before{content:"";position:absolute;inset:6% -4% 12%;background:radial-gradient(55% 55% at 50% 50%,rgba(var(--ac-1-rgb),0.16),transparent 70%);pointer-events:none}
.rd-selo{position:relative;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.04em;padding:6px 12px;border-radius:999px;background:var(--bx-surface-2);border:1px solid var(--bx-border-2);color:var(--bx-text-2)}
.rd-selo i{width:7px;height:7px;border-radius:50%;background:var(--ac-grad)}
.rd-selo-w{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;max-width:340px;text-align:center}
.rd-selo-nota{margin:0;font-size:12.5px;line-height:1.45;color:var(--bx-text-3)}
.rd-palco{position:relative;display:block;width:min(100%,420px);aspect-ratio:${W}/${H};padding:0;border:0;background:none;cursor:zoom-in;font:inherit;color:inherit}
.rd-folha{position:absolute;inset:0;border-radius:6px;overflow:hidden;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);box-shadow:var(--bx-shadow);transition:transform .2s ease}
.rd-folha img{display:block;width:100%;height:100%;object-fit:cover}
.rd-f3{transform:translate(-15%,4%) rotate(-9deg) scale(.92)}
.rd-f2{transform:translate(13%,2%) rotate(7deg) scale(.96)}
.rd-f3 img{filter:brightness(.62)}
.rd-f2 img{filter:brightness(.78)}
.rd-f1 img{animation:rd-entra .2s ease}
@keyframes rd-entra{from{opacity:.4}to{opacity:1}}
.rd-palco:hover .rd-f1{transform:translateY(-2px)}
.rd-palco:hover .rd-f3{transform:translate(-17%,4%) rotate(-10.5deg) scale(.92)}
.rd-palco:hover .rd-f2{transform:translate(15%,2%) rotate(8.5deg) scale(.96)}
.rd-palco:focus-visible{outline:none}
.rd-palco:focus-visible .rd-f1{outline:2px solid var(--bx-text);outline-offset:4px}
.rd-ampliar{position:absolute;right:10px;bottom:10px;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink);font-size:14px;font-weight:700;box-shadow:0 8px 22px rgba(0,0,0,.35)}
.rd-legenda{position:relative;margin:0;font-size:13.5px;color:var(--bx-text-2);text-align:center}
.rd-legenda b{color:var(--bx-text);font-weight:700;font-variant-numeric:tabular-nums}

/* Lista das paginas */
.rd-lado{display:flex;flex-direction:column;gap:16px;min-width:0}
.rd-intro{margin:0;font-size:14.5px;line-height:1.6;color:var(--bx-text-2)}
.rd-lista{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.rd-item{width:100%;display:grid;grid-template-columns:36px minmax(0,1fr) 18px;gap:14px;align-items:center;min-height:44px;padding:12px 14px;border-radius:12px;border:1px solid transparent;background:none;color:var(--bx-text);font:inherit;text-align:left;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.rd-item > svg{color:var(--bx-text-3);transition:color .15s ease}
.rd-item:hover,.rd-item.on{background:var(--bx-surface);border-color:var(--bx-border)}
.rd-item.on > svg{color:var(--ac-1)}
.rd-item:focus-visible{outline:2px solid var(--bx-text);outline-offset:2px}
.rd-n{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;background:var(--bx-surface-2);color:var(--bx-text-2);border:1px solid var(--bx-border-2);transition:background .15s ease,color .15s ease}
.rd-item.on .rd-n{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.rd-txt b{display:block;font-size:15px;font-weight:700;margin-bottom:3px}
.rd-txt span{display:block;font-size:13.5px;line-height:1.5;color:var(--bx-text-2)}

/* Modal */
.rd-modal{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:var(--bx-bg);color:var(--bx-text)}
.rd-m-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 8px 8px 18px;padding-top:max(8px,env(safe-area-inset-top))}
.rd-m-tit{display:flex;flex-direction:column;gap:2px;min-width:0}
.rd-m-tit b{font-size:15px;font-weight:700}
.rd-m-tit > span{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--bx-text-2)}
.rd-m-cont{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--bx-surface-2);color:var(--bx-text);font-variant-numeric:tabular-nums}
.rd-m-x{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);cursor:pointer;transition:background .15s ease}
.rd-m-x:hover{background:var(--bx-surface-2)}
.rd-m-palco{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:4px 16px}
.rd-m-palco img{display:block;width:auto;height:auto;max-width:100%;max-height:100%;max-height:calc(100dvh - 150px);border-radius:6px;box-shadow:var(--bx-shadow);background:var(--bx-surface-2);animation:rd-entra .2s ease}
.rd-m-base{display:grid;grid-template-columns:48px minmax(0,1fr) 48px;gap:12px;align-items:center;width:100%;max-width:820px;margin:0 auto;padding:10px 12px;padding-bottom:max(12px,env(safe-area-inset-bottom))}
.rd-m-base p{margin:0;font-size:13.5px;line-height:1.5;color:var(--bx-text-2);text-align:center}
.rd-m-base a{color:var(--bx-text);font-weight:600;text-decoration:underline;text-decoration-color:var(--bx-border-2);text-underline-offset:3px;white-space:nowrap}
.rd-m-nav{width:48px;height:48px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);cursor:pointer;transition:background .15s ease}
.rd-m-nav:hover{background:var(--bx-surface-2)}
.rd-m-x:focus-visible,.rd-m-nav:focus-visible,.rd-m-base a:focus-visible{outline:2px solid var(--bx-text);outline-offset:2px}

@media (max-width:1024px){
  .rd-dest{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:900px){
  .rd{gap:36px}
  .rd-grid{grid-template-columns:minmax(0,1fr);gap:36px}
  .rd-palco{width:min(64%,300px)}
}
@media (max-width:480px){
  .rd-dest{gap:8px}
  .rd-dest li{flex-direction:column;gap:10px;padding:14px}
  .rd-item{grid-template-columns:36px minmax(0,1fr);padding:12px 10px}
  .rd-item > svg{display:none}
  .rd-ampliar{right:8px;bottom:8px;padding:0 12px;font-size:13px}
  .rd-m-base p{font-size:12.5px}
  .rd-m-palco{padding:4px 8px}
}
@media (prefers-reduced-motion:reduce){
  .rd-folha,.rd-item,.rd-n,.rd-m-x,.rd-m-nav{transition:none}
  .rd-f1 img,.rd-m-palco img{animation:none}
  .rd-palco:hover .rd-f1{transform:none}
  .rd-palco:hover .rd-f3{transform:translate(-15%,4%) rotate(-9deg) scale(.92)}
  .rd-palco:hover .rd-f2{transform:translate(13%,2%) rotate(7deg) scale(.96)}
}
`
