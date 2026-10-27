'use client'

// Modal de Halloween (27 a 31/10/2026): 50% OFF no primeiro ano do Pro Anual.
// Mockup aprovado pelo Du em 27/10 (artifact Qx6faLpMmvcpMWC8vHFNtY).
//
// QUEM VE e decidido no AppLayout (toda conta Gratis). Aqui so cuida de
// QUANDO e de exibir:
// - uma vez por dia (data de Brasilia) por aparelho, ate o fim da oferta;
// - some sozinho no fimISO da oferta, mesmo com a pagina aberta;
// - o desconto e aplicado pelo servidor (/api/stripe/checkout com
//   oferta:'halloween'), que tambem recusa depois do prazo.
//
// As cartas sao so a arte (as mais sombrias do momento). A promocao e de
// Halloween, nao do set.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import {
  OFERTAS_EVENTO, PRECO_CHEIO, ofertaEventoAtiva, precoComDesconto, brlOferta,
} from '@/lib/ofertasEvento'
import { IconCheck, IconClock, IconClose } from '@/components/ui/Icons'

const O = OFERTAS_EVENTO.halloween
const CHAVE = 'bynx_oferta_halloween26'
const FIM = Date.parse(O.fimISO)

const ARTE = {
  chandelure: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/PBL-Mega-Chandelure-ex--115-084--115.jpg',
  darkrai: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/PBL-Mega-Darkrai-ex--120-084--120.jpg',
}

type Registro = { dia?: string; clicou?: boolean }

function ler(): Registro {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {} } catch { return {} }
}
function gravar(r: Registro) {
  try { localStorage.setItem(CHAVE, JSON.stringify(r)) } catch {}
}

/** Data de Brasilia (AAAA-MM-DD): o modal abre uma vez por dia. */
function diaBrasilia(agora: number): string {
  return new Date(agora - 3 * 3600_000).toISOString().slice(0, 10)
}

function deveAbrir(agora: number): boolean {
  if (!ofertaEventoAtiva('halloween', agora)) return false
  return ler().dia !== diaBrasilia(agora)
}

export default function OfertaHalloweenModal() {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const agora = Date.now()
    if (!deveAbrir(agora)) return
    gravar({ ...ler(), dia: diaBrasilia(agora) })
    setAberto(true)
  }, [])

  // Sai do ar no fim da promocao, mesmo com a pagina aberta.
  useEffect(() => {
    if (!aberto) return
    const falta = FIM - Date.now()
    if (falta <= 0) { setAberto(false); return }
    const t = window.setTimeout(() => setAberto(false), Math.min(falta, 2_147_000_000))
    return () => window.clearTimeout(t)
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [aberto])

  if (!aberto) return null

  const fechar = () => setAberto(false)

  async function garantir() {
    if (carregando) return
    setErro(null)
    setCarregando(true)
    gravar({ ...ler(), clicou: true })
    trackProUpgradeInitiated('anual')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setErro('Sua sessão expirou. Entre de novo para garantir o desconto.'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plano: 'anual', oferta: O.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.url) { window.location.href = d.url; return }
      if (res.status === 410) { setAberto(false); return }
      setErro(d.error || 'Não conseguimos abrir o pagamento. Tente de novo em instantes.')
    } catch {
      setErro('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  const cheio = PRECO_CHEIO.anual
  const comDesconto = precoComDesconto(cheio, O.descontoPct)

  return (
    <div className="hw-raiz">
      <style>{CSS}</style>
      <div className="hw-scrim" onClick={fechar} />
      <section className="hw-modal" role="dialog" aria-modal="true" aria-labelledby="hw-titulo">
        <div className="hw-arte" aria-hidden="true">
          <div className="hw-carta hw-dk"><Image src={ARTE.darkrai} alt="" fill sizes="170px" /></div>
          <div className="hw-carta hw-ch"><Image src={ARTE.chandelure} alt="" fill sizes="200px" priority /></div>
          <div className="hw-legenda">Mega Chandelure ex e Mega Darkrai ex</div>
        </div>
        <button type="button" className="hw-x" aria-label="Fechar" onClick={fechar}>
          <IconClose size={18} strokeWidth={1.6} />
        </button>
        <div className="hw-ct">
          <span className="hw-selo"><i />Halloween na Bynx</span>
          <h2 className="hw-titulo" id="hw-titulo"><em>{O.descontoPct}% OFF</em><br />no Pro Anual</h2>
          <p className="hw-frase">Seu fichário vai ficar assustadoramente completo.</p>
          <div className="hw-preco">
            <s>De R$ {brlOferta(cheio)}</s>
            <div><strong>R$ {brlOferta(comDesconto)}</strong><span>no primeiro ano</span></div>
          </div>
          <div className="hw-prazo">
            <IconClock size={16} strokeWidth={1.5} />
            <span>Até 31/10/2026, às 23h59, horário de Brasília.</span>
          </div>
          <div className="hw-bens">
            <span><IconCheck size={13} strokeWidth={2} />Coleção sem limite</span>
            <span><IconCheck size={13} strokeWidth={2} />Scan IA ilimitado</span>
            <span><IconCheck size={13} strokeWidth={2} />Master Sets</span>
          </div>
          {erro && <p className="hw-erro" role="alert">{erro}</p>}
          <div className="hw-acoes">
            <button type="button" className="hw-cta" onClick={garantir} disabled={carregando}>
              {carregando ? 'Abrindo o pagamento...' : `Garantir meu ${O.descontoPct}% OFF`}
            </button>
            <button type="button" className="hw-nao" onClick={fechar}>Agora não</button>
          </div>
          <p className="hw-letra">Só na primeira assinatura. Depois de 12 meses, renova por R$&nbsp;{brlOferta(cheio).replace(',00', '')}.</p>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.hw-raiz{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;font-family:var(--font-dm-sans),'DM Sans',system-ui,sans-serif}
.hw-scrim{position:absolute;inset:0;background:rgba(0,0,0,0.85);animation:hw-fade .2s ease both}
.hw-modal{position:relative;width:860px;max-width:100%;max-height:calc(100dvh - 48px);display:grid;grid-template-columns:340px minmax(0,1fr);overflow:hidden;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-radius:22px;box-shadow:var(--bx-shadow);animation:hw-fade .2s ease both}
.hw-arte{position:relative;overflow:hidden;isolation:isolate;min-height:540px;border-right:1px solid var(--bx-border);background:radial-gradient(42% 46% at 44% 58%,rgba(var(--ac-1-rgb),0.30),transparent 70%),radial-gradient(70% 40% at 50% 108%,rgba(var(--ac-2-rgb),0.18),transparent 70%),var(--bx-bg)}
.hw-arte::after{content:"";position:absolute;inset:0;z-index:3;pointer-events:none;background:linear-gradient(to bottom,var(--bx-bg) 0%,transparent 22%),linear-gradient(to top,var(--bx-bg) 0%,transparent 26%)}
.hw-carta{position:absolute;border-radius:7px;overflow:hidden}
.hw-carta img{object-fit:cover}
.hw-dk{z-index:1;width:168px;height:234px;left:150px;top:112px;transform:rotate(9deg);filter:brightness(.38) saturate(.6);box-shadow:0 0 0 1px var(--bx-border),0 18px 36px rgba(0,0,0,.7)}
.hw-ch{z-index:2;width:196px;height:273px;left:56px;top:150px;transform:rotate(-6deg);box-shadow:0 0 0 1px var(--bx-border-2),0 24px 48px rgba(0,0,0,.7),0 0 64px rgba(var(--ac-1-rgb),.35)}
.hw-legenda{position:absolute;z-index:4;left:0;right:0;bottom:18px;text-align:center;font-size:11px;color:var(--bx-text-3)}
.hw-x{position:absolute;z-index:5;top:18px;right:18px;width:44px;height:44px;border-radius:99px;display:grid;place-items:center;border:1px solid var(--bx-border-2);background:rgba(13,15,20,.7);color:var(--bx-text);cursor:pointer;transition:background .15s ease}
.hw-x:hover{background:var(--bx-surface-3)}
.hw-ct{display:flex;flex-direction:column;gap:14px;min-width:0;padding:52px 44px 32px;justify-content:center;overflow-y:auto}
.hw-selo{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--ac-1)}
.hw-selo i{width:7px;height:7px;border-radius:99px;background:var(--ac-1);box-shadow:0 0 0 5px rgba(var(--ac-1-rgb),.14),0 0 16px rgba(var(--ac-1-rgb),.6)}
.hw-titulo{margin:0;font-size:56px;font-weight:900;letter-spacing:-.03em;line-height:.98;color:var(--bx-text)}
.hw-titulo em{font-style:normal;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.hw-frase{margin:0;color:var(--bx-text-2);font-size:16px}
.hw-preco{display:flex;flex-direction:column;gap:2px}
.hw-preco s{color:var(--bx-text-2);font-size:14px;text-decoration-color:rgba(var(--ac-2-rgb),.8)}
.hw-preco div{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.hw-preco strong{font-size:40px;font-weight:900;letter-spacing:-.03em;line-height:1;color:var(--bx-text);font-variant-numeric:tabular-nums}
.hw-preco span{color:var(--bx-text-2);font-size:14px}
.hw-prazo{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:12px;border:1px solid rgba(var(--ac-1-rgb),.22);background:rgba(var(--ac-1-rgb),.07);color:var(--bx-text);font-size:13px}
.hw-prazo svg{flex:none;margin-top:1px;color:var(--ac-1)}
.hw-prazo svg *{stroke:currentColor}
.hw-bens{display:flex;flex-wrap:wrap;gap:6px}
.hw-bens span{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:99px;border:1px solid var(--bx-border);background:var(--bx-surface-2);color:var(--bx-text-2);font-size:12px}
.hw-bens svg *{stroke:var(--bx-green)}
.hw-erro{margin:0;font-size:13px;color:var(--bx-red)}
.hw-acoes{display:flex;align-items:center;gap:12px}
.hw-cta{flex:1;height:52px;border:0;border-radius:14px;background:var(--ac-grad);color:var(--bx-brand-ink);font:800 16px var(--font-dm-sans),'DM Sans',sans-serif;cursor:pointer;box-shadow:0 12px 28px rgba(var(--ac-2-rgb),.22);transition:transform .15s ease,box-shadow .15s ease}
.hw-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 16px 34px rgba(var(--ac-2-rgb),.32)}
.hw-cta:disabled{opacity:.7;cursor:wait}
.hw-nao{height:44px;padding:0 12px;border:0;background:transparent;color:var(--bx-text-2);font:500 14px var(--font-dm-sans),'DM Sans',sans-serif;cursor:pointer}
.hw-nao:hover{color:var(--bx-text)}
.hw-cta:focus-visible,.hw-nao:focus-visible,.hw-x:focus-visible{outline:2px solid var(--ac-1);outline-offset:3px}
.hw-letra{margin:0;color:var(--bx-text-3);font-size:11.5px;text-align:center}
@keyframes hw-fade{from{opacity:0}to{opacity:1}}
@keyframes hw-sobe{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (max-width:767px){
  .hw-raiz{align-items:flex-end;padding:0}
  .hw-modal{width:100%;max-height:92dvh;grid-template-columns:1fr;border-radius:22px 22px 0 0;border-bottom:0;overflow-y:auto;animation:hw-sobe .2s ease both;padding-bottom:env(safe-area-inset-bottom,0px)}
  .hw-arte{min-height:0;height:214px;border-right:0}
  .hw-arte::after{background:linear-gradient(to bottom,var(--bx-bg) 0%,transparent 26%),linear-gradient(to top,var(--bx-bg-elev) 0%,transparent 34%)}
  .hw-dk{width:112px;height:156px;left:52%;top:26px}
  .hw-ch{width:132px;height:184px;left:calc(50% - 98px);top:38px}
  .hw-legenda{display:none}
  .hw-x{top:12px;right:12px}
  .hw-ct{padding:0 20px 18px;margin-top:-8px;position:relative;z-index:4;overflow:visible}
  .hw-titulo{font-size:38px}
  .hw-acoes{flex-direction:column;align-items:stretch;gap:2px}
  .hw-cta{flex:none}
}
@media (prefers-reduced-motion:reduce){.hw-scrim,.hw-modal{animation:none}.hw-cta,.hw-x{transition:none}}
`
