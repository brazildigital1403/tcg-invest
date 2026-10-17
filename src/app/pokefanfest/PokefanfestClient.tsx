'use client'

// Landing da oferta Poke Fan Fest 4. Uma rolagem so, CTA fixo no rodape do celular.
// Molde da /tcgcon (Quadro #318) com duas diferencas pedidas pelo Du em 17/10:
// o desconto e 50% e vale para os TRES planos de usuario (escolha como
// raridade, igual a Campanha Presente), e o evento aparece em texto, sem logo.
//
// Fluxo:
//   deslogado -> modal de cadastro ja no plano escolhido com oferta='pokefanfest'
//                (confirmacao de e-mail -> /auth/pos-cadastro -> checkout)
//   logado    -> POST /api/stripe/checkout { plano, oferta:'pokefanfest' }
// O servidor aplica o cupom, zera o trial da conta nova e recusa depois do prazo.

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { trackProUpgradeInitiated } from '@/lib/analytics'
import {
  OFERTAS_EVENTO, PRECO_CHEIO, NOME_PLANO, ofertaEventoAtiva, precoComDesconto, brlOferta,
  type PlanoOferta,
} from '@/lib/ofertasEvento'
import ARTES_LENDARIAS from '@/lib/paginas-lendarias-artes.json'
import {
  IconScan, IconCollection, IconStar, IconShield, IconClock, IconArrowRight,
  IconLocation, IconChart, IconCard, IconMarketplace, IconDashboard,
  IconImage, IconTag, IconDownload,
} from '@/components/ui/Icons'

const O = OFERTAS_EVENTO.pokefanfest

// Hero mostra a Bynx inteira, sem eleger um recurso (pedido do Du na TCG CON).
const PILARES = [
  { Icon: IconCollection, t: 'Coleção organizada', d: 'Cartas e pastas no seu ritmo' },
  { Icon: IconChart, t: 'Preço em real', d: 'Quanto vale cada carta' },
  { Icon: IconScan, t: 'ScanIA', d: 'Cataloga pela câmera' },
  { Icon: IconMarketplace, t: 'Mercado', d: 'Anúncios e lojas parceiras' },
  { Icon: IconStar, t: 'Master Sets', d: 'Todos liberados no Anual' },
  { Icon: IconDashboard, t: 'Dashboard', d: 'Sua coleção em números' },
]

// As 5 cartas presentes em mais colecoes da Bynx (user_cards, usuarios distintos,
// medido em 17/10/2026). Retrato fixo de proposito: a pagina vive dois dias.
// O centro e a mais forte visualmente; as pontas, os iniciais.
const LEQUE = [
  { nome: 'Charmander', img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/MEP-Charmander.jpg' },
  { nome: 'Squirtle', img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/MEP-Squirtle.jpg' },
  { nome: 'Mega Charizard X ex', img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/MEP-Mega-Charizard-X-ex-023.jpg' },
  { nome: 'Bulbasaur', img: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/MEP-Bulbasaur.jpg' },
  { nome: 'Meowth', img: 'https://images.pokemontcg.io/me2/106.png' },
]

// Previa da tela de Master Sets: sets ativos reais, progresso ilustrativo.
const SETS_PREVIA = [
  { nome: 'Equilíbrio Perfeito', logo: 'https://images.scrydex.com/pokemon/me3-logo/logo', total: 124, tenho: 88 },
  { nome: 'Caos Ascendente', logo: 'https://pokecardex.b-cdn.net/assets/images/logos/US/CRI.png', total: 122, tenho: 41 },
  { nome: 'Estrelas Radiantes', logo: 'https://images.scrydex.com/pokemon/swsh9-logo/logo', total: 186, tenho: 152 },
]

// Previa da Pagina Lendaria: a do Meowth, a carta presente em mais colecoes.
const PAGINA_ARTE = (ARTES_LENDARIAS as Record<string, string>)['meowth-pf']
const PAGINA_HEROI = 'https://images.pokemontcg.io/me2/106.png'

const SEPARADORES_PREVIA = [
  { id: 25, nome: 'Pikachu', gen: 'GEN 1', cor: '#e74c3c' },
  { id: 197, nome: 'Umbreon', gen: 'GEN 2', cor: '#f39c12' },
  { id: 448, nome: 'Lucario', gen: 'GEN 4', cor: '#2980b9' },
]
const artwork = (id: number) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

// Os planos como raridade, o Anual marcado (sem salto de preco no mes 2).
const PLANOS: { id: PlanoOferta; raridade: string; estrelas: number; descricao: string; periodo: 'ano' | 'mês' }[] = [
  { id: 'anual', raridade: 'Rara secreta', estrelas: 3, descricao: 'Tudo liberado por 12 meses, com Master Sets e Páginas Lendárias', periodo: 'ano' },
  { id: 'mensal', raridade: 'Ultra rara', estrelas: 2, descricao: 'Scan e coleção sem limite, mês a mês', periodo: 'mês' },
  { id: 'plus', raridade: 'Rara', estrelas: 1, descricao: 'Até 500 cartas e dashboard', periodo: 'mês' },
]

const FIM = Date.parse(O.fimISO)
const brl = brlOferta
const fmtInt = (n: number) => n.toLocaleString('pt-BR')

function contagem(agora: number): string {
  const d = Math.max(0, FIM - agora)
  const p = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(d / 3600000)
  return `${p(h)}:${p(Math.floor((d % 3600000) / 60000))}:${p(Math.floor((d % 60000) / 1000))}`
}

export default function PokefanfestClient({ colecionadores, cartas }: { colecionadores: number; cartas: number }) {
  const { openSignup, openLogin } = useAuthModal()
  const [agora, setAgora] = useState<number | null>(null)
  const [encerradaServidor, setEncerradaServidor] = useState(false)
  const [plano, setPlano] = useState<PlanoOferta>('anual')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    setAgora(Date.now())
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const encerrada = encerradaServidor || (agora !== null && !ofertaEventoAtiva(O.id, agora))
  const relogio = agora === null ? '--:--:--' : contagem(agora)
  const escolhido = useMemo(() => PLANOS.find(p => p.id === plano)!, [plano])
  const precoEscolhido = precoComDesconto(PRECO_CHEIO[plano], O.descontoPct)
  const periodoTxt = escolhido.periodo === 'ano' ? 'no 1º ano' : 'no 1º mês'

  async function garantir() {
    setErro('')
    if (!ofertaEventoAtiva(O.id)) { setEncerradaServidor(true); return }
    trackProUpgradeInitiated(plano)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      openSignup({ plan: plano, next: O.landing, oferta: O.id, cta: `pokefanfest:${plano}` })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plano, oferta: O.id }),
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
      await navigator.clipboard.writeText(O.codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* clipboard bloqueado: o codigo continua visivel na tela */ }
  }

  return (
    <div className="pf-root">
      <style>{CSS}</style>

      <header className="pf-top">
        <div className="bx-gutter pf-top-row">
          {/* O evento entra em texto: nao ha logo, decisao do Du em 17/10. */}
          <div className="pf-brands">
            <img src="/logo_BYNX.png" alt="Bynx" className="pf-logo" />
            <span className="pf-x" aria-hidden="true">×</span>
            <span className="pf-evento"><b>POKE FAN FEST</b><small>4ª edição · Curitiba</small></span>
          </div>
          <span className="pf-live"><span className="pf-dot" aria-hidden="true" />Oferta do evento</span>
        </div>
        {!encerrada && (
          <div className="pf-timer" aria-live="off">
            Oferta fecha em <b>{relogio}</b>
          </div>
        )}
      </header>

      {encerrada ? (
        <main className="bx-gutter">
          <div className="pf-wrap pf-exp">
            <span className="pf-ic pf-ic-lg"><IconClock size={24} /></span>
            <h1 className="pf-exp-h">A oferta da {O.eventoCurto} encerrou.</h1>
            <p className="pf-exp-p">Ela valia só durante o evento. Você ainda pode conhecer a Bynx de graça e testar o Pro por 7 dias.</p>
            <button className="pf-cta" onClick={() => openSignup({ next: '/dashboard-financeiro', cta: 'pokefanfest:encerrada' })}>Criar conta grátis</button>
            <a className="pf-ghost" href="/#planos">Ver planos</a>
          </div>
        </main>
      ) : (
        <>
          <main className="bx-gutter">
            <div className="pf-wrap">
              <section className="pf-hero">
                <div className="pf-hero-head">
                  <span className="pf-eyebrow"><IconLocation size={13} />Para quem está na {O.eventoCurto} este fim de semana</span>
                  <h1 className="pf-h">Metade do preço <span>em qualquer plano.</span></h1>
                </div>

                <figure className="pf-fan-wrap">
                  <div className="pf-fan">
                    {LEQUE.map((c, i) => (
                      <div key={c.nome} className={`pf-fan-card pf-fan-${i}`}>
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

                <p className="pf-sub">Saiu do evento com cartas novas? Catalogue pela câmera, veja quanto vale cada uma em real e acompanhe o mercado brasileiro. {O.descontoPct}% na primeira cobrança, até domingo.</p>

                <ul className="pf-pillars" aria-label="O que a Bynx faz">
                  {PILARES.map(({ Icon, t, d }) => (
                    <li key={t}>
                      <span className="pf-ic"><Icon size={18} /></span>
                      <b>{t}</b>
                      <small>{d}</small>
                    </li>
                  ))}
                </ul>

                <div className="pf-price">
                  <h2 className="pf-rar-h">Escolha a raridade do seu plano</h2>
                  <div className="pf-plans" role="radiogroup" aria-label="Plano">
                    {PLANOS.map(p => {
                      const on = p.id === plano
                      const preco = precoComDesconto(PRECO_CHEIO[p.id], O.descontoPct)
                      return (
                        <button key={p.id} type="button" role="radio" aria-checked={on} className={`pf-plan${on ? ' pf-on' : ''}`} onClick={() => setPlano(p.id)}>
                          {p.id === 'anual' && <span className="pf-ribbon">Mais completo</span>}
                          <span className="pf-plan-l">
                            <span className="pf-rar">{'★'.repeat(p.estrelas)} {p.raridade}</span>
                            <span className="pf-plan-nome">{NOME_PLANO[p.id]}</span>
                            <span className="pf-plan-d">{p.descricao}</span>
                          </span>
                          <span className="pf-plan-r">
                            <s>R$ {brl(PRECO_CHEIO[p.id])}</s>
                            <b>R$ {brl(preco)}</b>
                            <small>{p.periodo === 'ano' ? 'no 1º ano' : 'no 1º mês'}</small>
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  <p className="pf-disc">
                    {escolhido.periodo === 'ano'
                      ? <>Cobrança única de R$ {brl(precoEscolhido)} por 12 meses. Depois renova por R$ {brl(PRECO_CHEIO.anual)}/ano, e você cancela quando quiser.</>
                      : <>R$ {brl(precoEscolhido)} no primeiro mês. Depois renova por R$ {brl(PRECO_CHEIO[plano])}/mês, e você cancela quando quiser.</>}
                    {' '}Essa oferta não tem período grátis: o plano libera quando o pagamento confirma.
                  </p>
                  <button className="pf-cta" onClick={garantir} disabled={loading}>
                    {loading ? 'Abrindo pagamento...' : <>Quero o {NOME_PLANO[plano]} com {O.descontoPct}% <IconArrowRight size={18} strokeWidth={2.4} /></>}
                  </button>
                  {erro && <p className="pf-erro" role="alert">{erro}</p>}
                  <div className="pf-assure"><IconShield size={14} />Cartão, Apple Pay ou Google Pay · 7 dias para desistir</div>

                  <div className="pf-code">
                    <div>
                      <span className="pf-code-l">Não consegue fechar agora?</span>
                      <span className="pf-code-t">Use o código em qualquer plano até domingo, 23h59</span>
                    </div>
                    <button className="pf-code-b" onClick={copiarCodigo} aria-label={`Copiar código ${O.codigo}`}>
                      <b>{O.codigo}</b>
                      <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </section>

              <section className="pf-sec">
                <h2>E no Pro Anual ainda vem</h2>

                <div className="pf-prevs">
                  <article className="pf-prev">
                    <div className="pf-prev-txt">
                      <span className="pf-ic"><IconStar size={18} /></span>
                      <p>Todos os Master Sets<small>Veja carta a carta o que falta para fechar cada set. Avulso, cada um é pago.</small></p>
                    </div>
                    <div className="pf-prev-vis" role="img" aria-label="Prévia da tela de Master Sets">
                      <div className="pf-ms">
                        {SETS_PREVIA.map(s => {
                          const pct = Math.round((s.tenho / s.total) * 100)
                          return (
                            <div key={s.nome} className="pf-ms-card">
                              <div className="pf-ms-logo">
                                <Image src={s.logo} alt="" width={84} height={34} sizes="84px" />
                              </div>
                              <b>{s.nome}</b>
                              <small>{s.total} cartas</small>
                              <div className="pf-ms-bar"><i style={{ width: `${pct}%` }} /></div>
                              <span className="pf-ms-num">{s.tenho}/{s.total}</span>
                              <span className="pf-ms-pill">Incluso no anual</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </article>

                  <article className="pf-prev">
                    <div className="pf-prev-txt">
                      <span className="pf-ic"><IconImage size={18} /></span>
                      <p>Todas as Páginas Lendárias<small>A arte da carta se estende pela página inteira do fichário. Avulso, cada uma é paga.</small></p>
                    </div>
                    <div className="pf-prev-vis" role="img" aria-label="Prévia de uma Página Lendária do Meowth">
                      <div className="pf-pl">
                        {PAGINA_ARTE && (
                          <Image src={PAGINA_ARTE} alt="" fill sizes="(max-width: 520px) 60vw, 256px" className="pf-pl-arte" />
                        )}
                        <div className="pf-pl-grid">
                          {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className={`pf-pl-bolso${i === 4 ? ' pf-pl-heroi' : ''}`}>
                              {i === 4 && <Image src={PAGINA_HEROI} alt="" fill sizes="64px" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="pf-prev">
                    <div className="pf-prev-txt">
                      <span className="pf-ic"><IconTag size={18} /></span>
                      <p>Separadores liberados<small>No tamanho exato da carta, prontos para imprimir e organizar suas pastas.</small></p>
                    </div>
                    <div className="pf-prev-vis" role="img" aria-label="Prévia dos Separadores de fichário">
                      <div className="pf-sep">
                        {SEPARADORES_PREVIA.map(p => (
                          <div key={p.id} className="pf-sep-card">
                            <span className="pf-sep-gen" style={{ color: p.cor }}>{p.gen}</span>
                            <img src="/bynx_perfil.png" alt="" className="pf-sep-badge" />
                            <div className="pf-sep-img">
                              <img src={artwork(p.id)} alt="" loading="lazy" />
                            </div>
                            <div className="pf-sep-nome">
                              <b>{p.nome}</b>
                              <small>#{String(p.id).padStart(4, '0')}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </div>

                <ul className="pf-feat">
                  <li><span className="pf-ic"><IconDownload size={18} /></span><p>Exportar PDF e CSV<small>Sua coleção inteira em uma planilha</small></p></li>
                </ul>

                <div className="pf-proof">
                  <div><b>{fmtInt(colecionadores)}</b><span>colecionadores na Bynx</span></div>
                  <div><b>{fmtInt(cartas)}</b><span>cartas catalogadas</span></div>
                  <div><b className="pf-proof-word">Lojas</b><span>parceiras pelo Brasil</span></div>
                </div>

                <div className="pf-risk">
                  <span className="pf-ic pf-ic-green"><IconShield size={20} /></span>
                  <p><strong>Não curtiu? Devolvemos tudo.</strong> Você tem 7 dias para desistir e recebe 100% de volta.</p>
                </div>

                <p className="pf-login">
                  <IconCard size={14} />Já tem conta na Bynx?{' '}
                  <button onClick={() => openLogin({ next: O.landing, cta: 'pokefanfest:entrar' })}>Entrar</button>
                </p>
              </section>

              <footer className="pf-fine">
                Oferta válida de 17 a 18/10/2026, até 23h59 de domingo (horário de Brasília), uma por conta e só para quem nunca assinou a Bynx. O desconto de {O.descontoPct}% vale para a 1ª cobrança dos planos Plus, Pro e Pro Anual (Pro Anual R$ {brl(precoComDesconto(PRECO_CHEIO.anual, O.descontoPct))}, pagamento único referente a 12 meses; Pro R$ {brl(precoComDesconto(PRECO_CHEIO.mensal, O.descontoPct))} e Plus R$ {brl(precoComDesconto(PRECO_CHEIO.plus, O.descontoPct))} no primeiro mês). Renovação automática pelo valor integral (Pro Anual R$ {brl(PRECO_CHEIO.anual)}/ano, Pro R$ {brl(PRECO_CHEIO.mensal)}/mês, Plus R$ {brl(PRECO_CHEIO.plus)}/mês); você cancela a renovação quando quiser em Minha Conta, sem multa, e mantém o acesso até o fim do período pago. Arrependimento: até 7 dias após a compra, devolvemos 100% do valor (CDC art. 49). Esta oferta não inclui teste grátis: a conta é liberada após o pagamento. Compra permitida só para maiores de 18 anos ou com autorização do responsável legal. A Bynx não tem vínculo com a organização do evento.
                <br /><br />
                <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a>
              </footer>
            </div>
          </main>

          <div className="pf-sticky">
            <div className="pf-sticky-in">
              <div className="pf-mini"><span>{NOME_PLANO[plano]} · R$ {brl(precoEscolhido)} {periodoTxt}</span><span>fecha em <b>{relogio}</b></span></div>
              <button className="pf-cta pf-cta-flat" onClick={garantir} disabled={loading}>
                {loading ? 'Abrindo pagamento...' : `Quero o ${NOME_PLANO[plano]} com ${O.descontoPct}%`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const CSS = `
.pf-root{min-height:100dvh;background:var(--bx-bg);color:var(--bx-text)}
.pf-wrap{max-width:560px;margin:0 auto}

.pf-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bx-bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--bx-border)}
.pf-top-row{display:flex;align-items:center;justify-content:space-between;height:56px;max-width:608px;margin:0 auto}
.pf-logo{height:26px;width:auto;display:block}
.pf-brands{display:flex;align-items:center;gap:10px;min-width:0}
.pf-x{font-size:14px;color:var(--bx-text-3);line-height:1}
.pf-evento{display:flex;flex-direction:column;line-height:1.05;min-width:0}
.pf-evento b{font-size:13px;font-weight:800;letter-spacing:.06em;white-space:nowrap}
.pf-evento small{font-size:10.5px;color:var(--bx-text-3);margin-top:2px;white-space:nowrap}
.pf-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--bx-text-2);white-space:nowrap}
.pf-dot{width:8px;height:8px;border-radius:50%;background:var(--bx-red);animation:pf-pulse 1.6s ease infinite}
@keyframes pf-pulse{0%{box-shadow:0 0 0 0 rgba(var(--ac-2-rgb),.55)}70%{box-shadow:0 0 0 8px rgba(var(--ac-2-rgb),0)}100%{box-shadow:0 0 0 0 rgba(var(--ac-2-rgb),0)}}
.pf-timer{background:rgba(var(--ac-2-rgb),0.10);border-top:1px solid rgba(var(--ac-2-rgb),0.2);text-align:center;font-size:13px;padding:8px 0;color:var(--bx-text)}
.pf-timer b{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ac-1);letter-spacing:.02em}

.pf-hero{padding:22px 0 0;background:var(--bx-hero-wash)}
.pf-hero-head{display:flex;flex-direction:column;align-items:center;text-align:center}
.pf-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ac-1);background:rgba(var(--ac-1-rgb),0.10);border:1px solid rgba(var(--ac-1-rgb),0.25);padding:5px 10px;border-radius:999px}
.pf-h{font-size:clamp(30px,8vw,40px);line-height:1.08;font-weight:800;letter-spacing:-0.03em;margin:14px 0 0;text-wrap:balance;text-align:center}
.pf-h span{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.pf-sub{font-size:15px;line-height:1.5;color:var(--bx-text-2);margin:14px 0 0;text-align:center}

.pf-fan-wrap{margin:16px 0 0}
.pf-fan{position:relative;height:178px;background:radial-gradient(60% 70% at 50% 60%,rgba(var(--ac-1-rgb),0.16),transparent 70%)}
.pf-fan-card{position:absolute;top:22px;left:50%;border-radius:6px;overflow:hidden;box-shadow:0 12px 28px rgba(0,0,0,0.55);line-height:0}
.pf-fan-card img{display:block;width:100%;height:auto}
.pf-fan-0{width:96px;transform:translateX(calc(-50% - 108px)) translateY(16px) rotate(-12deg);z-index:1}
.pf-fan-1{width:96px;transform:translateX(calc(-50% - 56px)) translateY(4px) rotate(-6deg);z-index:2}
.pf-fan-2{width:116px;top:6px;transform:translateX(-50%);z-index:3;box-shadow:0 16px 36px rgba(0,0,0,0.6),0 0 0 1px rgba(var(--ac-1-rgb),0.45)}
.pf-fan-3{width:96px;transform:translateX(calc(-50% + 56px)) translateY(4px) rotate(6deg);z-index:2}
.pf-fan-4{width:96px;transform:translateX(calc(-50% + 108px)) translateY(16px) rotate(12deg);z-index:1}
.pf-fan-wrap figcaption{text-align:center;font-size:12px;color:var(--bx-text-3);margin-top:6px}

.pf-pillars{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pf-pillars li{min-width:0;display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.pf-pillars .pf-ic{width:32px;height:32px;border-radius:9px;margin-bottom:8px}
.pf-pillars b{font-size:14px;font-weight:600;line-height:1.25}
.pf-pillars small{font-size:12px;line-height:1.35;color:var(--bx-text-2)}
@media (min-width:520px){.pf-pillars{grid-template-columns:repeat(3,minmax(0,1fr))}}

.pf-price{margin-top:18px;border-radius:18px;padding:18px;border:1px solid rgba(var(--ac-1-rgb),0.35);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),0.10),rgba(var(--ac-2-rgb),0.04))}
.pf-rar-h{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--bx-text-3);font-weight:700;margin:0 0 10px}
.pf-plans{display:grid;gap:10px}
.pf-plan{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;min-height:72px;padding:13px 14px;border-radius:14px;text-align:left;font:inherit;color:var(--bx-text);background:var(--bx-surface);border:1px solid var(--bx-border-2);cursor:pointer;transition:border-color .15s ease,background .15s ease}
.pf-plan:hover{background:var(--bx-surface-2)}
.pf-on{border-color:rgba(var(--ac-1-rgb),.8);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.12),rgba(var(--ac-2-rgb),.05))}
.pf-plan-l{min-width:0;display:flex;flex-direction:column}
.pf-rar{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.pf-on .pf-rar{color:var(--ac-1)}
.pf-plan-nome{font-size:15px;font-weight:700;margin-top:2px}
.pf-plan-d{font-size:12px;line-height:1.35;color:var(--bx-text-2);margin-top:2px}
.pf-plan-r{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
.pf-plan-r s{font-size:12px;color:var(--bx-text-3)}
.pf-plan-r b{font-size:19px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.pf-plan-r small{font-size:11px;color:var(--bx-text-3)}
.pf-ribbon{position:absolute;top:-9px;right:12px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink)}
.pf-disc{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--bx-text-3)}

.pf-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;margin-top:16px;border:0;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:16px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.pf-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(var(--ac-2-rgb),.35)}
.pf-cta:disabled{opacity:.7;cursor:progress}
.pf-cta:focus-visible,.pf-code-b:focus-visible,.pf-ghost:focus-visible,.pf-login button:focus-visible,.pf-plan:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.pf-cta-flat{margin-top:0}
.pf-erro{margin:10px 0 0;font-size:13px;line-height:1.45;color:var(--bx-red);text-align:center}
.pf-assure{display:flex;justify-content:center;gap:6px;align-items:center;margin-top:10px;font-size:12.5px;color:var(--bx-text-2);text-align:center}

.pf-code{margin-top:16px;padding-top:14px;border-top:1px dashed var(--bx-border-2);display:flex;align-items:center;justify-content:space-between;gap:12px}
.pf-code > div{min-width:0}
.pf-code-l{display:block;font-size:13px;font-weight:600}
.pf-code-t{display:block;font-size:12px;color:var(--bx-text-2);margin-top:2px}
.pf-code-b{flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;min-width:112px;padding:6px 12px;border-radius:10px;border:1px dashed rgba(var(--ac-1-rgb),0.55);background:rgba(var(--ac-1-rgb),0.08);color:var(--bx-text);font:inherit;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.pf-code-b:hover{background:rgba(var(--ac-1-rgb),0.14)}
.pf-code-b b{font-size:15px;letter-spacing:.06em}
.pf-code-b span{font-size:11px;color:var(--ac-1);font-weight:600}

.pf-sec{padding-top:28px}
.pf-sec h2{font-size:17px;font-weight:700;margin:0 0 12px;letter-spacing:-0.01em}
.pf-feat{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}
.pf-feat li{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.pf-feat p,.pf-prev-txt p{margin:0;font-size:14px;font-weight:600}
.pf-feat small,.pf-prev-txt small{display:block;font-weight:400;color:var(--bx-text-2);font-size:12.5px;line-height:1.4;margin-top:2px}
.pf-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),0.10);color:var(--ac-1);flex-shrink:0}
.pf-ic-lg{width:52px;height:52px;border-radius:14px;margin-bottom:18px}
.pf-ic-green{width:40px;height:40px;color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}

.pf-prevs{display:grid;gap:10px}
.pf-prev{border-radius:16px;border:1px solid var(--bx-border);background:var(--bx-surface);overflow:hidden}
.pf-prev-vis{position:relative;padding:16px 12px;background:var(--bx-bg-elev);border-top:1px solid var(--bx-border);display:flex;justify-content:center;overflow:hidden}
.pf-prev-txt{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;padding:12px}

.pf-ms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;width:100%}
.pf-ms-card{min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 6px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border);text-align:center}
.pf-ms-logo{height:36px;width:100%;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.pf-ms-logo img{max-height:34px;max-width:100%;width:auto;height:auto;object-fit:contain}
.pf-ms-card b{font-size:11px;font-weight:600;line-height:1.2;max-width:100%;min-height:2.4em;display:flex;align-items:center;justify-content:center;overflow-wrap:anywhere}
.pf-ms-card small{font-size:10px;color:var(--bx-text-3)}
.pf-ms-bar{width:100%;height:4px;border-radius:100px;background:var(--bx-surface-3);overflow:hidden;margin-top:6px}
.pf-ms-bar i{display:block;height:100%;background:var(--bx-green)}
.pf-ms-num{font-size:10px;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.pf-ms-pill{margin-top:4px;font-size:9.5px;font-weight:600;color:var(--ac-1);background:rgba(var(--ac-1-rgb),0.12);padding:2px 6px;border-radius:6px;white-space:nowrap}

.pf-pl{position:relative;width:min(62%,220px);aspect-ratio:195/270;border-radius:8px;overflow:hidden;box-shadow:0 14px 32px rgba(0,0,0,0.5)}
.pf-pl-arte{object-fit:cover}
.pf-pl-grid{position:absolute;inset:6%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:3%}
.pf-pl-bolso{position:relative;border-radius:3px;border:1px solid rgba(255,255,255,0.24);background:rgba(10,8,6,0.18);overflow:hidden}
.pf-pl-heroi{border-color:rgba(255,255,255,0.7);box-shadow:0 6px 16px rgba(0,0,0,0.45)}
.pf-pl-heroi img{object-fit:cover}

.pf-sep{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:min(100%,300px)}
.pf-sep-card{position:relative;aspect-ratio:63/88;border-radius:6px;background:#fff;border:1px solid #2a2a2a;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,0.45)}
.pf-sep-gen{position:absolute;top:5%;left:6%;font-size:8px;font-weight:800;letter-spacing:.04em;line-height:1;font-family:system-ui,-apple-system,sans-serif}
.pf-sep-badge{position:absolute;top:3%;right:5%;width:16px;height:16px;border-radius:50%;object-fit:cover}
.pf-sep-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:18% 12% 4%}
.pf-sep-img img{width:100%;height:100%;object-fit:contain}
.pf-sep-nome{border-top:0.5px solid #e0e0e0;padding:5% 6% 7%;display:flex;flex-direction:column;align-items:center;gap:1px}
.pf-sep-nome b{font-size:11px;font-weight:900;color:#111;line-height:1.1;font-family:'Arial Black','Helvetica Neue',system-ui,sans-serif}
.pf-sep-nome small{font-size:9px;color:#666;font-family:system-ui,-apple-system,sans-serif}

.pf-proof{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}
.pf-proof div{min-width:0;text-align:center;padding:12px 4px;border-radius:12px;border:1px solid var(--bx-border)}
.pf-proof b{display:block;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}
.pf-proof b.pf-proof-word{font-size:16px;letter-spacing:-0.01em}
.pf-proof span{font-size:11.5px;color:var(--bx-text-3)}

.pf-risk{display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;align-items:center;margin-top:14px;padding:14px;border-radius:12px;background:color-mix(in srgb,var(--bx-green) 6%,transparent);border:1px solid color-mix(in srgb,var(--bx-green) 28%,transparent)}
.pf-risk p{margin:0;font-size:13.5px;line-height:1.45}

.pf-login{display:flex;align-items:center;justify-content:center;gap:6px;margin:18px 0 0;font-size:13px;color:var(--bx-text-2)}
.pf-login button{min-height:44px;padding:0 6px;background:none;border:0;color:var(--ac-1);font:inherit;font-weight:700;cursor:pointer}

.pf-fine{margin-top:18px;padding:14px 0 150px;border-top:1px solid var(--bx-border);font-size:11.5px;line-height:1.6;color:var(--bx-text-3)}
.pf-fine a{color:var(--bx-text-2)}

.pf-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bx-bg) 32%)}
.pf-sticky-in{max-width:560px;margin:0 auto}
.pf-mini{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--bx-text-2);margin-bottom:8px}
.pf-mini b{color:var(--ac-1);font-variant-numeric:tabular-nums}

.pf-exp{min-height:calc(100dvh - 57px);display:flex;flex-direction:column;justify-content:center;padding:32px 0}
.pf-exp-h{font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;margin:0 0 10px;text-wrap:balance}
.pf-exp-p{font-size:15px;color:var(--bx-text-2);line-height:1.5;margin:0 0 8px}
.pf-ghost{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:10px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font-weight:600;font-size:15px;text-decoration:none;transition:background .15s ease}
.pf-ghost:hover{background:var(--bx-surface-2)}

@media (prefers-reduced-motion:reduce){.pf-dot{animation:none}.pf-cta,.pf-plan{transition:none}}
`
