'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { GRADUADORAS, GRADUADORA_MAP, tierNome, notaCurta, isNotaTop } from '@/lib/graduadoras'

/**
 * "Monte o seu slab" da /colecionadores (13/09/2026, mockup B aprovado pelo Du).
 *
 * ★ POR QUE EXISTE. Carta graduada e o eixo em que a Bynx mais se distancia dos
 * concorrentes (o FAQ de um deles admite que cadastrar graduada "ainda nao esta
 * pronto") e era um cartao de texto entre 7 na grade de Ferramentas. A secao
 * vira brinquedo: escolher graduadora, nota, subnotas e Black Label, e ver o
 * slab mudar -- a pessoa se imagina com a propria carta.
 *
 * ★ AS REGRAS NAO SAO COPIADAS: nivel (tierNome), rotulo (notaCurta), brilho
 * (isNotaTop), cores e quem tem subnota ou Black Label saem de lib/graduadoras,
 * o mesmo arquivo que desenha o slab no CardItem. Mudou la, muda aqui.
 *
 * ★ A copy afirma so o que o produto faz. Nao promete o valor da graduada no
 * total das pastas: as RPCs de pasta ainda nao leem valor_graduada (#178).
 * Nao mostra numero de certificado: seria um registro inventado na tela.
 */

const SIGNUP = '/colecionadores?auth=signup&next=/minha-colecao'
const OURO = '#e8c878' // mesmo dourado do Black Label no CardItem
const IMG = (id: string) => `https://images.pokemontcg.io/${id}.png`

const CARTAS = [
  { img: 'base1/4', nome: 'Charizard · Base Set' },
  { img: 'swsh7/215', nome: 'Umbreon VMAX · Evolving Skies' },
  { img: 'ex8/107', nome: 'Rayquaza Gold Star · EX Deoxys' },
]

const SUBNOTAS = [
  ['centro', 'Centro'],
  ['cantos', 'Cantos'],
  ['bordas', 'Bordas'],
  ['superficie', 'Superf.'],
] as const
type Subnota = (typeof SUBNOTAS)[number][0]

const ITENS: [string, string][] = [
  ['10 graduadoras', ', 6 internacionais e 4 brasileiras'],
  ['Nota e nível', ', de Played a Gem Mint e Pristine'],
  ['Subnotas', ' de centro, cantos, bordas e superfície'],
  ['Black Label', ' da BGS, com moldura preta e dourada'],
  ['Número do certificado', ' guardado junto da carta'],
  ['Valor da peça graduada', ', separado do preço da carta crua'],
]

export default function MonteSeuSlab({ guiaHref }: { guiaHref?: string } = {}) {
  const [slug, setSlug] = useState('psa')
  const [nota, setNota] = useState(10)
  const [blackLabel, setBlackLabel] = useState(false)
  const [carta, setCarta] = useState(0)
  const [subs, setSubs] = useState<Record<Subnota, number>>({ centro: 10, cantos: 10, bordas: 9.5, superficie: 10 })
  // Troca a key do slab pra reiniciar a animacao de brilho so nos momentos certos.
  const [brilho, setBrilho] = useState(0)

  const g = GRADUADORA_MAP[slug]
  const bl = blackLabel && g.temBlackLabel
  const top = isNotaTop(nota, bl)
  const cor = bl ? '#0a0a0a' : g.cor
  const tinta = bl ? OURO : '#fff'
  const nivel = tierNome(slug, nota, bl)
  const c = CARTAS[carta]

  function brilhar() { setBrilho(b => b + 1) }

  return (
    <div className="mss">
      <style>{CSS}</style>

      <div className="mss-head">
        <span className="mss-eyebrow"><i />Cartas graduadas</span>
        <h2 className="mss-title">Monte o slab da <span className="mss-grad">sua melhor carta.</span></h2>
        <p className="mss-sub">
          É assim que uma graduada aparece na sua coleção da Bynx. Escolha a graduadora e a nota.
        </p>
      </div>

      <div className="mss-grid">
        <div className="mss-painel">
          <div className="mss-passo">
            <div className="mss-rot">Graduadora <b>{g.curto}</b></div>
            <div className="mss-gpick" role="group" aria-label="Graduadora">
              {GRADUADORAS.map(x => (
                <button
                  key={x.slug}
                  type="button"
                  className="mss-gbtn"
                  aria-pressed={x.slug === slug}
                  style={{ ['--g' as string]: x.cor }}
                  onClick={() => { setSlug(x.slug); if (!x.temBlackLabel) setBlackLabel(false); if (top) brilhar() }}
                >
                  <i />
                  {x.curto}
                  <small>{x.pais === 'br' ? 'Brasil' : 'Intl.'}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="mss-passo">
            <div className="mss-rot">Nota</div>
            <div className="mss-nota-row">
              <span className="mss-nota-big">{notaCurta(nota, bl)}</span>
              <span className="mss-tier">{nivel}</span>
            </div>
            <input
              type="range" min={1} max={10} step={0.5} value={nota} disabled={bl}
              aria-label="Nota"
              onChange={e => {
                const n = Number(e.target.value)
                if (n >= 10 && nota < 10) brilhar()
                setNota(n)
              }}
            />
          </div>

          {g.temSubnota && (
            <div className="mss-passo">
              <div className="mss-rot">Subnotas</div>
              <div className="mss-subs">
                {SUBNOTAS.map(([k, lbl]) => (
                  <div key={k} className="mss-sub1">
                    <label htmlFor={`mss-${k}`}>{lbl}<b>{notaCurta(subs[k], false)}</b></label>
                    <input
                      id={`mss-${k}`} type="range" min={1} max={10} step={0.5} value={subs[k]}
                      onChange={e => setSubs(s => ({ ...s, [k]: Number(e.target.value) }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="mss-toggle" htmlFor="mss-bl">
            <span>
              Black Label
              <small>{g.temBlackLabel ? 'Nota perfeita da BGS' : 'Só existe na BGS'}</small>
            </span>
            <input
              id="mss-bl" type="checkbox" className="mss-sw"
              checked={bl} disabled={!g.temBlackLabel}
              onChange={e => { setBlackLabel(e.target.checked); if (e.target.checked) brilhar() }}
            />
          </label>

          <div className="mss-passo">
            <div className="mss-rot">Carta</div>
            <div className="mss-cartas">
              {CARTAS.map((x, i) => (
                <button
                  key={x.img} type="button" className="mss-cbtn"
                  aria-pressed={i === carta} aria-label={x.nome}
                  onClick={() => { setCarta(i); if (top) brilhar() }}
                >
                  <Image src={IMG(x.img)} alt="" width={245} height={342} sizes="52px" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mss-palco">
          <div
            key={brilho}
            className={`mss-slab${top ? ' top' : ''}${bl ? ' bl' : ''}${brilho > 0 && top ? ' brilha' : ''}`}
            style={{ ['--g' as string]: cor }}
          >
            <div className="mss-lab" style={{ color: tinta }}>
              <div className="mss-lab-l">
                <div className="mss-sig">{g.curto}</div>
                <div className="mss-nome">{c.nome}</div>
              </div>
              <div className="mss-lab-r">
                <div className="mss-nota">{notaCurta(nota, bl)}</div>
                <div className="mss-nivel">{nivel}</div>
              </div>
            </div>
            <div className="mss-win">
              <Image
                src={IMG(c.img)} alt={`${c.nome} graduada ${g.curto} ${notaCurta(nota, bl)}`}
                width={245} height={342} sizes="(max-width: 860px) 70vw, 290px"
              />
            </div>
          </div>

          {g.temSubnota && (
            <div className="mss-ficha">
              {SUBNOTAS.map(([k, lbl]) => (
                <div key={k}><small>{lbl}</small><b>{notaCurta(subs[k], false)}</b></div>
              ))}
            </div>
          )}

          <p className="mss-cap">Exemplo ilustrativo. Na coleção, a carta ganha a moldura na cor da graduadora.</p>
          <Link href={SIGNUP} className="mss-cta">Cadastrar minha graduada →</Link>
          {guiaHref && <Link href={guiaHref} className="mss-guia">Guia completo das cartas graduadas →</Link>}
        </div>
      </div>

      <ul className="mss-lista">
        {ITENS.map(([forte, resto]) => (
          <li key={forte}>
            <span className="mss-ck" aria-hidden="true">
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                <path d="M16.5 6.5L8 15l-4.5-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span><b>{forte}</b>{resto}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const CSS = `
.mss{--mss-ouro:${OURO}}
.mss-head{text-align:center;margin:0 auto 40px;max-width:720px;display:flex;flex-direction:column;align-items:center;gap:12px}
.mss-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1)}
.mss-eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--ac-1);box-shadow:0 0 10px var(--ac-1)}
.mss-title{font-size:clamp(28px,3.6vw,40px);font-weight:800;letter-spacing:-.03em;line-height:1.15;margin:0;color:var(--bx-text);text-wrap:balance}
.mss-grad{background:var(--bx-brand);-webkit-background-clip:text;background-clip:text;color:transparent}
.mss-sub{font-size:16px;color:var(--bx-text-2);line-height:1.6;max-width:580px;margin:0}

.mss-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);gap:32px;align-items:start}
.mss-painel{background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-radius:18px;padding:22px;display:grid;gap:20px}
.mss-passo{display:grid;gap:10px}
.mss-rot{display:flex;justify-content:space-between;align-items:baseline;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.mss-rot b{font-size:12px;color:var(--bx-text-2);letter-spacing:0;text-transform:none;font-weight:600}

.mss-gpick{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
.mss-gbtn{min-height:48px;border-radius:11px;background:var(--bx-surface);border:1px solid var(--bx-border);color:var(--bx-text);font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px 2px;transition:border-color .15s ease,background .15s ease,transform .15s ease}
.mss-gbtn i{width:22px;height:4px;border-radius:9px;background:var(--g)}
.mss-gbtn small{font-size:9px;font-weight:600;color:var(--bx-text-3);letter-spacing:.04em}
.mss-gbtn:hover{background:var(--bx-surface-2);border-color:var(--bx-border-2);transform:translateY(-2px)}
.mss-gbtn[aria-pressed="true"]{border-color:var(--g);background:color-mix(in srgb,var(--g) 14%,transparent);box-shadow:0 0 0 1px var(--g)}

.mss-nota-row{display:flex;align-items:center;gap:14px}
.mss-nota-big{font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1;min-width:74px;font-variant-numeric:tabular-nums;color:var(--bx-text)}
.mss-tier{font-size:13px;font-weight:800;color:var(--ac-1);text-transform:uppercase;letter-spacing:.06em}
.mss input[type=range]{width:100%;accent-color:var(--ac-1);height:32px;margin:0}
.mss input[type=range]:disabled{opacity:.35}

.mss-subs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px}
.mss-sub1{display:grid;gap:2px}
.mss-sub1 label{display:flex;justify-content:space-between;font-size:12.5px;color:var(--bx-text-2)}
.mss-sub1 label b{color:var(--bx-text);font-variant-numeric:tabular-nums}

.mss-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:8px 12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border);cursor:pointer}
.mss-toggle>span{font-size:13.5px;font-weight:700;color:var(--bx-text)}
.mss-toggle small{display:block;font-size:11.5px;font-weight:500;color:var(--bx-text-3)}
.mss-sw{appearance:none;-webkit-appearance:none;width:44px;height:26px;border-radius:99px;background:rgba(255,255,255,.14);position:relative;cursor:pointer;flex:none;margin:0;transition:background .15s ease}
.mss-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .15s ease}
.mss-sw:checked{background:var(--mss-ouro)}
.mss-sw:checked::after{transform:translateX(18px)}
.mss-sw:disabled{opacity:.35;cursor:not-allowed}

.mss-cartas{display:flex;gap:8px}
.mss-cbtn{width:52px;border-radius:9px;overflow:hidden;border:1px solid var(--bx-border);background:none;padding:0;cursor:pointer;transition:transform .15s ease,border-color .15s ease}
.mss-cbtn img{display:block;width:100%;height:auto}
.mss-cbtn:hover{transform:translateY(-2px)}
.mss-cbtn[aria-pressed="true"]{border-color:var(--ac-1);box-shadow:0 0 0 1px var(--ac-1)}

.mss-palco{display:flex;flex-direction:column;align-items:center;gap:14px;position:sticky;top:88px}
.mss-slab{position:relative;width:min(290px,100%);border-radius:16px;padding:11px;
  background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.04) 40%,rgba(255,255,255,.08));
  border:1px solid rgba(255,255,255,.24);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 26px 60px rgba(0,0,0,.6);
  transition:box-shadow .2s ease}
.mss-slab.top{box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 26px 60px rgba(0,0,0,.6),0 0 48px -6px var(--g)}
.mss-slab.bl{border-color:rgba(232,200,120,.55)}
.mss-slab.bl.top{box-shadow:inset 0 0 0 1px rgba(232,200,120,.2),0 26px 60px rgba(0,0,0,.6),0 0 48px -6px rgba(232,200,120,.55)}
.mss-lab{display:flex;justify-content:space-between;align-items:center;gap:8px;border-radius:9px;padding:8px 11px;background:var(--g);margin-bottom:9px;min-height:58px;transition:background .2s ease}
.mss-slab.bl .mss-lab{border:1px solid rgba(232,200,120,.45)}
.mss-lab-l{min-width:0}
.mss-sig{font-size:16px;font-weight:800;letter-spacing:.04em;line-height:1}
.mss-nome{font-size:10.5px;font-weight:600;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px;max-width:160px}
.mss-lab-r{text-align:right;flex:none}
.mss-nota{font-size:32px;font-weight:800;line-height:.95;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.mss-nivel{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.9;margin-top:3px}
.mss-win{border-radius:9px;background:#0b0d12;border:1px solid rgba(255,255,255,.08);padding:9px}
.mss-win img{display:block;width:100%;height:auto;border-radius:7px}
.mss-slab::after{content:"";position:absolute;inset:0;border-radius:16px;pointer-events:none;
  background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.28) 50%,transparent 62%);
  background-size:260% 100%;background-position:130% 0;opacity:0}
.mss-slab.brilha::after{animation:mss-brilho 1.1s cubic-bezier(.22,.61,.36,1) 1}
@keyframes mss-brilho{0%{opacity:1;background-position:130% 0}100%{opacity:1;background-position:-30% 0}}

.mss-ficha{width:min(290px,100%);display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.mss-ficha div{background:var(--bx-surface);border:1px solid var(--bx-border);border-radius:9px;padding:6px 4px;text-align:center}
.mss-ficha small{display:block;font-size:9.5px;color:var(--bx-text-3);text-transform:uppercase;letter-spacing:.05em}
.mss-ficha b{font-size:14px;font-variant-numeric:tabular-nums;color:var(--bx-text)}
.mss-cap{font-size:12.5px;color:var(--bx-text-3);text-align:center;margin:0}
.mss-cta{display:inline-flex;align-items:center;justify-content:center;min-height:48px;font-size:15px;font-weight:800;padding:13px 22px;border-radius:12px;background:var(--bx-brand);color:var(--bx-brand-ink);text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.mss-cta:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(239,68,68,.35)}
.mss-guia{display:inline-flex;align-items:center;min-height:44px;font-size:14px;font-weight:700;color:var(--ac-1);text-decoration:none}
.mss button:focus-visible,.mss input:focus-visible,.mss-cta:focus-visible{outline:2px solid var(--ac-1);outline-offset:2px}

.mss-lista{list-style:none;padding:0;margin:44px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px 22px}
.mss-lista li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--bx-text-2);line-height:1.45}
.mss-lista b{color:var(--bx-text)}
.mss-ck{flex:none;width:22px;height:22px;border-radius:7px;background:rgba(var(--ac-1-rgb),.12);color:var(--ac-1);display:flex;align-items:center;justify-content:center;margin-top:1px}

@media(max-width:860px){
  .mss-grid{grid-template-columns:minmax(0,1fr)}
  .mss-palco{position:static;order:-1}
}
@media(max-width:480px){
  .mss-painel{padding:16px}
  .mss-gpick{gap:5px}
  .mss-gbtn{font-size:11px}
  .mss-gbtn small{display:none}
}
@media(prefers-reduced-motion:reduce){
  .mss *{transition:none!important;animation:none!important}
}
`
