'use client'

// Landing da oferta TCG CON. Uma rolagem so, CTA fixo no rodape do celular.
//
// Fluxo:
//   deslogado -> modal de cadastro ja no Pro Anual com oferta='tcgcon'
//                (confirmacao de e-mail -> /auth/pos-cadastro -> checkout)
//   logado    -> POST /api/stripe/checkout { plano:'anual', oferta:'tcgcon' }
// O servidor aplica o cupom, zera o trial da conta nova e recusa depois das 23h59.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import { OFERTA_TCGCON, ofertaTcgconAtiva } from '@/lib/ofertaTcgcon'
import {
  IconScan, IconCollection, IconStar, IconShield, IconClock, IconArrowRight,
  IconLocation, IconChart, IconCard, IconMarketplace, IconPokedex, IconDashboard,
  IconImage, IconTag, IconDownload,
} from '@/components/ui/Icons'

// Hero mostra a Bynx inteira, sem eleger um recurso (pedido do Du).
const PILARES = [
  { Icon: IconCollection, t: 'Coleção sem limite', d: 'Cartas e pastas ilimitadas' },
  { Icon: IconChart, t: 'Preço em real', d: 'Quanto vale cada carta' },
  { Icon: IconScan, t: 'ScanIA ilimitado', d: 'Cataloga pela câmera' },
  { Icon: IconMarketplace, t: 'Mercado', d: 'Anúncios ilimitados e lojas' },
  { Icon: IconPokedex, t: 'Pokédex completa', d: 'Todo o catálogo liberado' },
  { Icon: IconDashboard, t: 'Dashboard', d: 'Sua coleção em números' },
]

const FIM = Date.parse(OFERTA_TCGCON.fimISO)
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const POR_MES = brl(Math.floor((OFERTA_TCGCON.precoOferta / 12) * 100) / 100)

function contagem(agora: number): string {
  const d = Math.max(0, FIM - agora)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(d / 3600000))}:${p(Math.floor((d % 3600000) / 60000))}:${p(Math.floor((d % 60000) / 1000))}`
}

export default function TcgconClient() {
  const { openSignup, openLogin } = useAuthModal()
  // null ate montar: o HTML do servidor nao sabe a hora do visitante.
  const [agora, setAgora] = useState<number | null>(null)
  const [encerradaServidor, setEncerradaServidor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setAgora(Date.now())
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const encerrada = encerradaServidor || (agora !== null && !ofertaTcgconAtiva(agora))
  const relogio = agora === null ? '--:--:--' : contagem(agora)

  async function garantir() {
    setErro('')
    if (!ofertaTcgconAtiva()) { setEncerradaServidor(true); return }
    trackProUpgradeInitiated('anual')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      openSignup({ plan: 'anual', next: '/tcgcon', oferta: OFERTA_TCGCON.id })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plano: 'anual', oferta: OFERTA_TCGCON.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.url) { window.location.href = d.url; return }
      if (res.status === 410) { setEncerradaServidor(true); return }
      setErro(d.error || 'Não conseguimos abrir o pagamento. Tente de novo em instantes.')
    } catch {
      setErro('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(OFERTA_TCGCON.codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard bloqueado: o codigo continua visivel na tela */ }
  }

  return (
    <div className="tc-root">
      <style>{CSS}</style>

      <header className="tc-top">
        <div className="bx-gutter tc-top-row">
          <img src="/logo_BYNX.png" alt="Bynx" className="tc-logo" />
          <span className="tc-live"><span className="tc-dot" aria-hidden="true" />Oferta TCG CON</span>
        </div>
        {!encerrada && (
          <div className="tc-timer" aria-live="off">
            Oferta fecha em <b>{relogio}</b>
          </div>
        )}
      </header>

      {encerrada ? (
        <main className="bx-gutter">
          <div className="tc-wrap tc-exp">
            <span className="tc-ic tc-ic-lg"><IconClock size={24} /></span>
            <h1 className="tc-exp-h">A oferta da TCG CON encerrou.</h1>
            <p className="tc-exp-p">Ela valia só durante o evento. Você ainda pode conhecer a Bynx de graça e testar o Pro por 7 dias.</p>
            <button className="tc-cta" onClick={() => openSignup({ next: '/dashboard-financeiro' })}>Criar conta grátis</button>
            <a className="tc-ghost" href="/#planos">Ver planos</a>
          </div>
        </main>
      ) : (
        <>
          <main className="bx-gutter">
            <div className="tc-wrap">
              <section className="tc-hero">
                <span className="tc-eyebrow"><IconLocation size={13} />Pra quem está na TCG CON hoje</span>
                <h1 className="tc-h">Pro Anual <span>pelo preço do Plus.</span></h1>
                <p className="tc-sub">A Bynx inteira liberada por 12 meses, sem limite: sua coleção, o preço de cada carta em real, o scan, o mercado e tudo que vier no ano.</p>

                <ul className="tc-pillars" aria-label="O que a Bynx faz">
                  {PILARES.map(({ Icon, t, d }) => (
                    <li key={t}>
                      <span className="tc-ic"><Icon size={18} /></span>
                      <b>{t}</b>
                      <small>{d}</small>
                    </li>
                  ))}
                </ul>

                <div className="tc-price">
                  <div className="tc-plan">Bynx Pro Anual <span className="tc-off">-{OFERTA_TCGCON.descontoPct}% TCG CON</span></div>
                  <div className="tc-old">R$ {brl(OFERTA_TCGCON.precoCheio)}</div>
                  <div className="tc-new"><b>R$ {brl(OFERTA_TCGCON.precoOferta)}</b><span>/ano</span></div>
                  <div className="tc-permo">Dá <strong>R$ {POR_MES} por mês</strong>, menos que o Plus mensal.</div>
                  <p className="tc-disc">
                    Cobrança única de R$ {brl(OFERTA_TCGCON.precoOferta)} por 12 meses. Depois renova por R$ {brl(OFERTA_TCGCON.precoCheio)}/ano, e você cancela quando quiser. Essa oferta não tem período grátis: o Pro libera quando o pagamento confirma.
                  </p>
                  <button className="tc-cta" onClick={garantir} disabled={loading}>
                    {loading ? 'Abrindo pagamento...' : <>Garantir meu Pro Anual <IconArrowRight size={18} strokeWidth={2.4} /></>}
                  </button>
                  {erro && <p className="tc-erro" role="alert">{erro}</p>}
                  <div className="tc-assure"><IconShield size={14} />Cartão, Apple Pay ou Google Pay · 7 dias pra desistir</div>

                  <div className="tc-code">
                    <div>
                      <span className="tc-code-l">Não dá pra fechar agora?</span>
                      <span className="tc-code-t">Use o código no Pro Anual até 23h59</span>
                    </div>
                    <button className="tc-code-b" onClick={copiarCodigo} aria-label={`Copiar código ${OFERTA_TCGCON.codigo}`}>
                      <b>{OFERTA_TCGCON.codigo}</b>
                      <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </section>

              <section className="tc-sec">
                <h2>E ainda vem no Pro Anual</h2>
                <ul className="tc-feat">
                  <li><span className="tc-ic"><IconStar size={18} /></span><p>Todos os Master Sets<small>Inclusos no anual. Avulso eles são pagos</small></p></li>
                  <li><span className="tc-ic"><IconImage size={18} /></span><p>Todas as Páginas Lendárias<small>Inclusas no anual. Avulso elas são pagas</small></p></li>
                  <li><span className="tc-ic"><IconTag size={18} /></span><p>Separadores liberados<small>Pra imprimir e organizar suas pastas</small></p></li>
                  <li><span className="tc-ic"><IconDownload size={18} /></span><p>Exportar PDF e CSV<small>Sua coleção inteira numa planilha</small></p></li>
                </ul>

                <div className="tc-proof">
                  <div><b>400+</b><span>colecionadores</span></div>
                  <div><b>70 mil</b><span>cartas com preço</span></div>
                  <div><b>12</b><span>lojas parceiras</span></div>
                </div>

                <div className="tc-risk">
                  <span className="tc-ic tc-ic-green"><IconShield size={20} /></span>
                  <p><strong>Não curtiu? Devolvemos tudo.</strong> Você tem 7 dias pra desistir e recebe 100% de volta.</p>
                </div>

                <p className="tc-login">
                  <IconCard size={14} />Já tem conta na Bynx?{' '}
                  <button onClick={() => openLogin({ next: '/tcgcon' })}>Entrar</button>
                </p>
              </section>

              <footer className="tc-fine">
                Oferta válida só em 13/09/2026, até 23h59 (horário de Brasília), uma por conta e só para quem nunca assinou a Bynx. O desconto de 30% vale para a 1ª cobrança do plano Pro Anual (R$ 174,30, pagamento único referente a 12 meses). Renovação automática: depois de 12 meses, cobramos R$ 249/ano; você cancela a renovação quando quiser em Minha Conta, sem multa, e mantém o acesso até o fim do período pago. Arrependimento: até 7 dias após a compra, devolvemos 100% do valor (CDC art. 49). Esta oferta não inclui teste grátis: a conta é liberada após o pagamento. Compra permitida só para maiores de 18 anos ou com autorização do responsável legal.
                <br /><br />
                Pokémon e seus nomes e marcas são propriedade de The Pokémon Company, Nintendo, Creatures e GAME FREAK. A Bynx é independente e não é afiliada, patrocinada nem endossada por essas empresas. Ação independente da Bynx, sem vínculo com a organização da TCG CON.{' '}
                <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a>
              </footer>
            </div>
          </main>

          <div className="tc-sticky">
            <div className="tc-sticky-in">
              <div className="tc-mini"><span>R$ {brl(OFERTA_TCGCON.precoOferta)}/ano · -{OFERTA_TCGCON.descontoPct}%</span><span>fecha em <b>{relogio}</b></span></div>
              <button className="tc-cta tc-cta-flat" onClick={garantir} disabled={loading}>
                {loading ? 'Abrindo pagamento...' : 'Garantir meu Pro Anual'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const CSS = `
.tc-root{min-height:100dvh;background:var(--bx-bg);color:var(--bx-text)}
.tc-wrap{max-width:560px;margin:0 auto}

.tc-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bx-bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--bx-border)}
.tc-top-row{display:flex;align-items:center;justify-content:space-between;height:56px;max-width:608px;margin:0 auto}
.tc-logo{height:26px;width:auto;display:block}
.tc-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--bx-text-2)}
.tc-dot{width:8px;height:8px;border-radius:50%;background:var(--bx-red);animation:tc-pulse 1.6s ease infinite}
@keyframes tc-pulse{0%{box-shadow:0 0 0 0 rgba(var(--ac-2-rgb),.55)}70%{box-shadow:0 0 0 8px rgba(var(--ac-2-rgb),0)}100%{box-shadow:0 0 0 0 rgba(var(--ac-2-rgb),0)}}
.tc-timer{background:rgba(var(--ac-2-rgb),0.10);border-top:1px solid rgba(var(--ac-2-rgb),0.2);text-align:center;font-size:13px;padding:8px 0;color:var(--bx-text)}
.tc-timer b{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ac-1);letter-spacing:.02em}

.tc-hero{padding:22px 0 0;background:var(--bx-hero-wash)}
.tc-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ac-1);background:rgba(var(--ac-1-rgb),0.10);border:1px solid rgba(var(--ac-1-rgb),0.25);padding:5px 10px;border-radius:999px}
.tc-h{font-size:clamp(30px,8vw,40px);line-height:1.08;font-weight:800;letter-spacing:-0.03em;margin:14px 0 10px;text-wrap:balance}
.tc-h span{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.tc-sub{font-size:15px;line-height:1.5;color:var(--bx-text-2);margin:0}

.tc-pillars{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.tc-pillars li{min-width:0;display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.tc-pillars .tc-ic{width:32px;height:32px;border-radius:9px;margin-bottom:8px}
.tc-pillars b{font-size:14px;font-weight:600;line-height:1.25}
.tc-pillars small{font-size:12px;line-height:1.35;color:var(--bx-text-2)}
@media (min-width:520px){.tc-pillars{grid-template-columns:repeat(3,minmax(0,1fr))}}

.tc-price{margin-top:18px;border-radius:18px;padding:18px;border:1px solid rgba(var(--ac-1-rgb),0.35);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),0.10),rgba(var(--ac-2-rgb),0.04))}
.tc-plan{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--bx-text-2)}
.tc-off{font-size:12px;font-weight:800;color:var(--bx-brand-ink);background:var(--ac-grad);padding:4px 9px;border-radius:999px;white-space:nowrap}
.tc-old{margin-top:10px;font-size:15px;color:var(--bx-text-3);text-decoration:line-through;font-variant-numeric:tabular-nums}
.tc-new{display:flex;align-items:baseline;gap:8px;margin-top:2px}
.tc-new b{font-size:42px;font-weight:800;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.tc-new span{font-size:14px;color:var(--bx-text-2)}
.tc-permo{font-size:13px;color:var(--bx-text-2);margin-top:2px}
.tc-permo strong{color:var(--bx-text)}
.tc-disc{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--bx-text-3)}

.tc-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;margin-top:16px;border:0;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:16px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.tc-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(var(--ac-2-rgb),.35)}
.tc-cta:disabled{opacity:.7;cursor:progress}
.tc-cta:focus-visible,.tc-code-b:focus-visible,.tc-ghost:focus-visible,.tc-login button:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.tc-cta-flat{margin-top:0}
.tc-erro{margin:10px 0 0;font-size:13px;line-height:1.45;color:var(--bx-red);text-align:center}
.tc-assure{display:flex;justify-content:center;gap:6px;align-items:center;margin-top:10px;font-size:12.5px;color:var(--bx-text-2);text-align:center}

.tc-code{margin-top:16px;padding-top:14px;border-top:1px dashed var(--bx-border-2);display:flex;align-items:center;justify-content:space-between;gap:12px}
.tc-code > div{min-width:0}
.tc-code-l{display:block;font-size:13px;font-weight:600}
.tc-code-t{display:block;font-size:12px;color:var(--bx-text-2);margin-top:2px}
.tc-code-b{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;min-width:112px;padding:6px 12px;border-radius:10px;border:1px dashed rgba(var(--ac-1-rgb),0.55);background:rgba(var(--ac-1-rgb),0.08);color:var(--bx-text);font:inherit;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.tc-code-b:hover{background:rgba(var(--ac-1-rgb),0.14)}
.tc-code-b b{font-size:15px;letter-spacing:.06em}
.tc-code-b span{font-size:11px;color:var(--ac-1);font-weight:600}

.tc-sec{padding-top:28px}
.tc-sec h2{font-size:17px;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em}
.tc-feat{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.tc-feat li{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.tc-feat p{margin:0;font-size:14px;font-weight:600}
.tc-feat small{display:block;font-weight:400;color:var(--bx-text-2);font-size:12.5px;margin-top:2px}
.tc-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),0.10);color:var(--ac-1)}
.tc-ic-lg{width:52px;height:52px;border-radius:14px;margin-bottom:18px}
.tc-ic-green{width:40px;height:40px;color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}

.tc-proof{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
.tc-proof div{text-align:center;padding:12px 6px;border-radius:12px;border:1px solid var(--bx-border)}
.tc-proof b{display:block;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.tc-proof span{font-size:11.5px;color:var(--bx-text-3)}

.tc-risk{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;align-items:center;margin-top:14px;padding:14px;border-radius:12px;background:color-mix(in srgb,var(--bx-green) 6%,transparent);border:1px solid color-mix(in srgb,var(--bx-green) 28%,transparent)}
.tc-risk p{margin:0;font-size:13.5px;line-height:1.45}

.tc-login{display:flex;align-items:center;justify-content:center;gap:6px;margin:18px 0 0;font-size:13px;color:var(--bx-text-2)}
.tc-login button{min-height:44px;padding:0 6px;background:none;border:0;color:var(--ac-1);font:inherit;font-weight:700;cursor:pointer}

.tc-fine{margin-top:18px;padding:14px 0 150px;border-top:1px solid var(--bx-border);font-size:11.5px;line-height:1.6;color:var(--bx-text-3)}
.tc-fine a{color:var(--bx-text-2)}

.tc-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bx-bg) 32%)}
.tc-sticky-in{max-width:560px;margin:0 auto}
.tc-mini{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--bx-text-2);margin-bottom:8px}
.tc-mini b{color:var(--ac-1);font-variant-numeric:tabular-nums}

.tc-exp{min-height:calc(100dvh - 57px);display:flex;flex-direction:column;justify-content:center;padding:32px 0}
.tc-exp-h{font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;margin:0 0 10px;text-wrap:balance}
.tc-exp-p{font-size:15px;color:var(--bx-text-2);line-height:1.5;margin:0 0 8px}
.tc-ghost{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:10px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font-weight:600;font-size:15px;text-decoration:none;transition:background .15s ease}
.tc-ghost:hover{background:var(--bx-surface-2)}

@media (min-width:768px){.tc-top-row{max-width:608px}}
@media (prefers-reduced-motion:reduce){.tc-dot{animation:none}.tc-cta{transition:none}}
`
