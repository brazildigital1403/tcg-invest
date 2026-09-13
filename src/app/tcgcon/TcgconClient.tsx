'use client'

// Landing da oferta TCG CON. Uma rolagem so, CTA fixo no rodape do celular.
//
// Fluxo:
//   deslogado -> modal de cadastro ja no Pro Anual com oferta='tcgcon'
//                (confirmacao de e-mail -> /auth/pos-cadastro -> checkout)
//   logado    -> POST /api/stripe/checkout { plano:'anual', oferta:'tcgcon' }
// O servidor aplica o cupom, zera o trial da conta nova e recusa depois das 23h59.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import { OFERTA_TCGCON, ofertaTcgconAtiva } from '@/lib/ofertaTcgcon'
import ARTES_LENDARIAS from '@/lib/paginas-lendarias-artes.json'
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

// As 5 cartas presentes em mais colecoes da Bynx (user_cards, usuarios distintos, 13/09/2026).
// Retrato fixo de proposito: a pagina vive um dia. Ordem do leque, o centro e a mais colecionada
// de visual mais forte.
const LEQUE = [
  { nome: 'Raticate', img: 'https://images.scrydex.com/pokemon/me3-99/small' },
  { nome: 'Meowth', img: 'https://images.pokemontcg.io/me2/106.png' },
  { nome: 'Mega Charizard X ex', img: 'https://images.pokemontcg.io/me2/125.png' },
  { nome: 'Clefairy', img: 'https://images.scrydex.com/pokemon/me3-94/small' },
  { nome: 'Mega Diancie ex', img: 'https://images.pokemontcg.io/me2/41.png' },
]

// Previa da tela de Master Sets: sets ativos reais, progresso ilustrativo.
const SETS_PREVIA = [
  { nome: 'Equilíbrio Perfeito', logo: 'https://images.scrydex.com/pokemon/me3-logo/logo', total: 124, tenho: 88 },
  { nome: 'Caos Ascendente', logo: 'https://pokecardex.b-cdn.net/assets/images/logos/US/CRI.png', total: 122, tenho: 41 },
  { nome: 'Estrelas Radiantes', logo: 'https://images.scrydex.com/pokemon/swsh9-logo/logo', total: 186, tenho: 152 },
]

// Previa da Pagina Lendaria: a do Meowth, que e a carta presente em mais colecoes.
const PAGINA_ARTE = (ARTES_LENDARIAS as Record<string, string>)['meowth-pf']
const PAGINA_HEROI = 'https://images.pokemontcg.io/me2/106.png'

// Previa dos Separadores: mesmas cores de geracao da tela /separadores.
const SEPARADORES_PREVIA = [
  { id: 25, nome: 'Pikachu', gen: 'GEN 1', cor: '#e74c3c' },
  { id: 197, nome: 'Umbreon', gen: 'GEN 2', cor: '#f39c12' },
  { id: 448, nome: 'Lucario', gen: 'GEN 4', cor: '#2980b9' },
]
const artwork = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

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
          {/* Logo do evento usado com autorizacao da organizacao da TCG CON (confirmado pelo Du em 13/09). */}
          <div className="tc-brands">
            <img src="/logo_BYNX.png" alt="Bynx" className="tc-logo" />
            <span className="tc-x" aria-hidden="true">×</span>
            <img src="/eventos/tcgcon-logo.svg" alt="TCG CON" width={45} height={36} className="tc-logo-evento" />
          </div>
          <span className="tc-live"><span className="tc-dot" aria-hidden="true" />Oferta do evento</span>
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
                <span className="tc-eyebrow"><IconLocation size={13} />Para quem está na TCG CON hoje</span>
                <h1 className="tc-h">Pro Anual <span>pelo preço do Plus.</span></h1>
                <p className="tc-sub">A Bynx inteira liberada por 12 meses, sem limite: sua coleção, o preço de cada carta em real, o scan, o mercado e tudo que vier no ano.</p>

                <figure className="tc-fan-wrap">
                  <div className="tc-fan">
                    {LEQUE.map((c, i) => (
                      <div key={c.nome} className={`tc-fan-card tc-fan-${i}`}>
                        <Image
                          src={c.img}
                          alt={c.nome}
                          width={i === 2 ? 116 : 96}
                          height={i === 2 ? 162 : 134}
                          sizes={i === 2 ? '116px' : '96px'}
                          priority
                        />
                      </div>
                    ))}
                  </div>
                  <figcaption>As cartas mais colecionadas na Bynx</figcaption>
                </figure>

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
                  <div className="tc-assure"><IconShield size={14} />Cartão, Apple Pay ou Google Pay · 7 dias para desistir</div>

                  <div className="tc-code">
                    <div>
                      <span className="tc-code-l">Não consegue fechar agora?</span>
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

                <div className="tc-prevs">
                  <article className="tc-prev">
                    <div className="tc-prev-vis" role="img" aria-label="Prévia da tela de Master Sets">
                      <div className="tc-ms">
                        {SETS_PREVIA.map(s => {
                          const pct = Math.round((s.tenho / s.total) * 100)
                          return (
                            <div key={s.nome} className="tc-ms-card">
                              <div className="tc-ms-logo">
                                <Image src={s.logo} alt="" width={84} height={34} sizes="84px" />
                              </div>
                              <b>{s.nome}</b>
                              <small>{s.total} cartas</small>
                              <div className="tc-ms-bar"><i style={{ width: `${pct}%` }} /></div>
                              <span className="tc-ms-num">{s.tenho}/{s.total}</span>
                              <span className="tc-ms-pill">Incluso no anual</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="tc-prev-txt">
                      <span className="tc-ic"><IconStar size={18} /></span>
                      <p>Todos os Master Sets<small>Veja carta a carta o que falta para fechar cada set. Avulso, cada um é pago.</small></p>
                    </div>
                  </article>

                  <article className="tc-prev">
                    <div className="tc-prev-vis" role="img" aria-label="Prévia de uma Página Lendária do Meowth">
                      <div className="tc-pl">
                        {PAGINA_ARTE && (
                          <Image src={PAGINA_ARTE} alt="" fill sizes="(max-width: 520px) 60vw, 256px" className="tc-pl-arte" />
                        )}
                        <div className="tc-pl-grid">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className={`tc-pl-bolso${i === 4 ? ' tc-pl-heroi' : ''}`}>
                              {i === 4 && <Image src={PAGINA_HEROI} alt="" fill sizes="64px" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="tc-prev-txt">
                      <span className="tc-ic"><IconImage size={18} /></span>
                      <p>Todas as Páginas Lendárias<small>A arte da carta se estende pela página inteira do fichário. Avulso, cada uma é paga.</small></p>
                    </div>
                  </article>

                  <article className="tc-prev">
                    <div className="tc-prev-vis" role="img" aria-label="Prévia dos Separadores de fichário">
                      <div className="tc-sep">
                        {SEPARADORES_PREVIA.map(p => (
                          <div key={p.id} className="tc-sep-card">
                            <span className="tc-sep-gen" style={{ color: p.cor }}>{p.gen}</span>
                            <img src="/bynx_perfil.png" alt="" className="tc-sep-badge" />
                            <div className="tc-sep-img">
                              <img src={artwork(p.id)} alt="" loading="lazy" />
                            </div>
                            <div className="tc-sep-nome">
                              <b>{p.nome}</b>
                              <small>#{String(p.id).padStart(4, '0')}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="tc-prev-txt">
                      <span className="tc-ic"><IconTag size={18} /></span>
                      <p>Separadores liberados<small>No tamanho exato da carta, prontos para imprimir e organizar suas pastas.</small></p>
                    </div>
                  </article>
                </div>

                <ul className="tc-feat">
                  <li><span className="tc-ic"><IconDownload size={18} /></span><p>Exportar PDF e CSV<small>Sua coleção inteira em uma planilha</small></p></li>
                </ul>

                <div className="tc-proof">
                  <div><b>850+</b><span>coleções catalogadas</span></div>
                  <div><b>70 mil</b><span>cartas com preço</span></div>
                  <div><b className="tc-proof-word">Lojas</b><span>parceiras pelo Brasil</span></div>
                </div>

                <div className="tc-risk">
                  <span className="tc-ic tc-ic-green"><IconShield size={20} /></span>
                  <p><strong>Não curtiu? Devolvemos tudo.</strong> Você tem 7 dias para desistir e recebe 100% de volta.</p>
                </div>

                <p className="tc-login">
                  <IconCard size={14} />Já tem conta na Bynx?{' '}
                  <button onClick={() => openLogin({ next: '/tcgcon' })}>Entrar</button>
                </p>
              </section>

              <footer className="tc-fine">
                Oferta válida só em 13/09/2026, até 23h59 (horário de Brasília), uma por conta e só para quem nunca assinou a Bynx. O desconto de 30% vale para a 1ª cobrança do plano Pro Anual (R$ 174,30, pagamento único referente a 12 meses). Renovação automática: depois de 12 meses, cobramos R$ 249/ano; você cancela a renovação quando quiser em Minha Conta, sem multa, e mantém o acesso até o fim do período pago. Arrependimento: até 7 dias após a compra, devolvemos 100% do valor (CDC art. 49). Esta oferta não inclui teste grátis: a conta é liberada após o pagamento. Compra permitida só para maiores de 18 anos ou com autorização do responsável legal.
                <br /><br />
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
.tc-brands{display:flex;align-items:center;gap:10px;min-width:0}
.tc-x{font-size:14px;color:var(--bx-text-3);line-height:1}
.tc-logo-evento{height:36px;width:auto;display:block}
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

.tc-fan-wrap{margin:22px 0 0}
.tc-fan{position:relative;height:178px;background:radial-gradient(60% 70% at 50% 60%,rgba(var(--ac-1-rgb),0.16),transparent 70%)}
.tc-fan-card{position:absolute;top:22px;left:50%;border-radius:6px;overflow:hidden;box-shadow:0 12px 28px rgba(0,0,0,0.55);line-height:0}
.tc-fan-card img{display:block;width:100%;height:auto}
.tc-fan-0{width:96px;transform:translateX(calc(-50% - 108px)) translateY(16px) rotate(-12deg);z-index:1}
.tc-fan-1{width:96px;transform:translateX(calc(-50% - 56px)) translateY(4px) rotate(-6deg);z-index:2}
.tc-fan-2{width:116px;top:6px;transform:translateX(-50%);z-index:3;box-shadow:0 16px 36px rgba(0,0,0,0.6),0 0 0 1px rgba(var(--ac-1-rgb),0.45)}
.tc-fan-3{width:96px;transform:translateX(calc(-50% + 56px)) translateY(4px) rotate(6deg);z-index:2}
.tc-fan-4{width:96px;transform:translateX(calc(-50% + 108px)) translateY(16px) rotate(12deg);z-index:1}
.tc-fan-wrap figcaption{text-align:center;font-size:12px;color:var(--bx-text-3);margin-top:6px}

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
.tc-feat{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}
.tc-feat li{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.tc-feat p,.tc-prev-txt p{margin:0;font-size:14px;font-weight:600}
.tc-feat small,.tc-prev-txt small{display:block;font-weight:400;color:var(--bx-text-2);font-size:12.5px;line-height:1.4;margin-top:2px}
.tc-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),0.10);color:var(--ac-1);flex-shrink:0}
.tc-ic-lg{width:52px;height:52px;border-radius:14px;margin-bottom:18px}
.tc-ic-green{width:40px;height:40px;color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}

.tc-prevs{display:grid;gap:10px}
.tc-prev{border-radius:16px;border:1px solid var(--bx-border);background:var(--bx-surface);overflow:hidden}
.tc-prev-vis{position:relative;padding:16px 12px;background:var(--bx-bg-elev);border-bottom:1px solid var(--bx-border);display:flex;justify-content:center;overflow:hidden}
.tc-prev-txt{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;padding:12px}

.tc-ms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%}
.tc-ms-card{min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 6px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border);text-align:center}
.tc-ms-logo{height:36px;width:100%;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.tc-ms-logo img{max-height:34px;max-width:100%;width:auto;height:auto;object-fit:contain}
.tc-ms-card b{font-size:11px;font-weight:600;line-height:1.2;max-width:100%;min-height:2.4em;display:flex;align-items:center;justify-content:center;overflow-wrap:anywhere}
.tc-ms-card small{font-size:10px;color:var(--bx-text-3)}
.tc-ms-bar{width:100%;height:4px;border-radius:100px;background:var(--bx-surface-3);overflow:hidden;margin-top:6px}
.tc-ms-bar i{display:block;height:100%;background:var(--bx-green)}
.tc-ms-num{font-size:10px;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.tc-ms-pill{margin-top:4px;font-size:9.5px;font-weight:600;color:var(--ac-1);background:rgba(var(--ac-1-rgb),0.12);padding:2px 6px;border-radius:6px;white-space:nowrap}

.tc-pl{position:relative;width:min(62%,220px);aspect-ratio:195/270;border-radius:8px;overflow:hidden;box-shadow:0 14px 32px rgba(0,0,0,0.5)}
.tc-pl-arte{object-fit:cover}
.tc-pl-grid{position:absolute;inset:6%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:3%}
.tc-pl-bolso{position:relative;border-radius:3px;border:1px solid rgba(255,255,255,0.24);background:rgba(10,8,6,0.18);overflow:hidden}
.tc-pl-heroi{border-color:rgba(255,255,255,0.7);box-shadow:0 6px 16px rgba(0,0,0,0.45)}
.tc-pl-heroi img{object-fit:cover}

.tc-sep{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:min(100%,300px)}
.tc-sep-card{position:relative;aspect-ratio:63/88;border-radius:6px;background:#fff;border:1px solid #2a2a2a;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,0.45)}
.tc-sep-gen{position:absolute;top:5%;left:6%;font-size:8px;font-weight:800;letter-spacing:.04em;line-height:1;font-family:system-ui,-apple-system,sans-serif}
.tc-sep-badge{position:absolute;top:3%;right:5%;width:16px;height:16px;border-radius:50%;object-fit:cover}
.tc-sep-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:18% 12% 4%}
.tc-sep-img img{width:100%;height:100%;object-fit:contain}
.tc-sep-nome{border-top:0.5px solid #e0e0e0;padding:5% 6% 7%;display:flex;flex-direction:column;align-items:center;gap:1px}
.tc-sep-nome b{font-size:11px;font-weight:900;color:#111;line-height:1.1;font-family:'Arial Black','Helvetica Neue',system-ui,sans-serif}
.tc-sep-nome small{font-size:9px;color:#666;font-family:system-ui,-apple-system,sans-serif}

.tc-proof{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
.tc-proof div{min-width:0;text-align:center;padding:12px 4px;border-radius:12px;border:1px solid var(--bx-border)}
.tc-proof b{display:block;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.tc-proof b.tc-proof-word{font-size:16px;letter-spacing:-0.01em}
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

@media (prefers-reduced-motion:reduce){.tc-dot{animation:none}.tc-cta{transition:none}}
`
