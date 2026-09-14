'use client'

// Landing da campanha Presente. Tres momentos numa pagina so:
//   1. fechado: booster com o nome da pessoa e o contador ate sexta 23h59
//   2. aberto: as cartas mais colecionadas + os planos como raridade (50%)
//   3. um passo: senha, nascimento e aceite -> checkout da Stripe com o cupom
//
// Quem ja tem conta entra pelo login normal e volta pra ca com sessao.
// O desconto so sai com o token do convite (validado no servidor).

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { trackProUpgradeInitiated, trackSignUp } from '@/lib/analytics'
import {
  OFERTA_PRESENTE, PLANOS_PRESENTE, ofertaPresenteAtiva, precoPresente, type PlanoPresente,
} from '@/lib/ofertaPresente'
import {
  IconArrowRight, IconClock, IconClose, IconCollection, IconChart, IconScan, IconStar,
  IconShield, IconEye, IconEyeOff, IconCheck,
} from '@/components/ui/Icons'

// As 5 cartas presentes em mais colecoes da Bynx (user_cards, usuarios distintos, 13/09/2026).
const LEQUE = [
  { nome: 'Raticate', img: 'https://images.scrydex.com/pokemon/me3-99/small' },
  { nome: 'Meowth', img: 'https://images.pokemontcg.io/me2/106.png' },
  { nome: 'Mega Charizard X ex', img: 'https://images.pokemontcg.io/me2/125.png' },
  { nome: 'Clefairy', img: 'https://images.scrydex.com/pokemon/me3-94/small' },
  { nome: 'Mega Diancie ex', img: 'https://images.pokemontcg.io/me2/41.png' },
]

const PERKS = [
  { Icon: IconCollection, t: 'Coleção sem limite', d: 'Cartas e pastas à vontade' },
  { Icon: IconChart, t: 'Preço em real', d: 'Quanto vale cada carta hoje' },
  { Icon: IconScan, t: 'ScanIA', d: 'A câmera cataloga por você' },
  { Icon: IconStar, t: 'Master Sets', d: 'Saiba o que falta para fechar' },
]

const FIM = Date.parse(OFERTA_PRESENTE.fimISO)
const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const p2 = (n: number) => String(n).padStart(2, '0')

function partes(agora: number) {
  const d = Math.max(0, FIM - agora)
  return {
    dias: Math.floor(d / 86400000),
    horas: Math.floor((d % 86400000) / 3600000),
    min: Math.floor((d % 3600000) / 60000),
    seg: Math.floor((d % 60000) / 1000),
  }
}

interface Props {
  token: string | null
  nome: string
  primeiroNome: string
  email: string
  jaTemConta: boolean
}

export default function PresenteClient({ token, nome, primeiroNome, email, jaTemConta }: Props) {
  const { openLogin } = useAuthModal()
  const [agora, setAgora] = useState<number | null>(null)
  const [aberto, setAberto] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [plano, setPlano] = useState<PlanoPresente>('anual')
  const [folha, setFolha] = useState(false)
  const [encerradaServidor, setEncerradaServidor] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  // formulario
  const [fNome, setFNome] = useState(nome)
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [nasc, setNasc] = useState('')
  const [termos, setTermos] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [campoErro, setCampoErro] = useState('')

  useEffect(() => {
    setAgora(Date.now())
    const i = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  // Voltou do login (ou ja estava logado): pula direto pro presente aberto.
  useEffect(() => {
    if (!token) return
    supabase.auth.getSession().then(({ data }) => { if (data.session) setAberto(true) })
  }, [token])

  const encerrada = encerradaServidor || (agora !== null && !ofertaPresenteAtiva(agora))
  const t = agora === null ? null : partes(agora)
  const relogioCurto = !t ? '--' : t.dias > 0 ? `${t.dias}d ${p2(t.horas)}h ${p2(t.min)}m` : `${p2(t.horas)}:${p2(t.min)}:${p2(t.seg)}`
  const escolhido = useMemo(() => PLANOS_PRESENTE.find(p => p.id === plano)!, [plano])

  function abrirPresente() {
    const reduzir = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (token) {
      fetch('/api/presente/evento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, etapa: 'presente_aberto' }), keepalive: true,
      }).catch(() => {})
    }
    if (reduzir) { setAberto(true); return }
    setAbrindo(true)
    setTimeout(() => { setAberto(true); setAbrindo(false); window.scrollTo({ top: 0 }) }, 420)
  }

  async function irParaCheckout(accessToken: string) {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ plano, oferta: OFERTA_PRESENTE.id, t: token }),
    })
    const d = await res.json().catch(() => ({}))
    if (d.url) { window.location.href = d.url; return true }
    if (res.status === 410) { setEncerradaServidor(true); return false }
    setErro(d.error || 'Não conseguimos abrir o pagamento. Tente de novo em instantes.')
    return false
  }

  async function quero() {
    setErro('')
    if (!ofertaPresenteAtiva()) { setEncerradaServidor(true); return }
    trackProUpgradeInitiated(plano === 'plus' ? 'mensal' : plano)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      setCarregando(true)
      try { await irParaCheckout(session.access_token) } finally { setCarregando(false) }
      return
    }
    if (jaTemConta) { openLogin({ next: `/presente?t=${token}` }); return }
    setFolha(true)
  }

  async function criarContaEPagar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCampoErro('')
    if (!termos) { setCampoErro('termos'); setErro('Aceite os Termos de Uso e a Política de Privacidade.'); return }
    setCarregando(true)
    try {
      const res = await fetch('/api/presente/cadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, nome: fNome, senha, nascimento: nasc, termos, marketing }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.status === 410) { setEncerradaServidor(true); return }
      if (d.code === 'JA_TEM_CONTA' || d.entrar) { setFolha(false); openLogin({ next: `/presente?t=${token}` }); return }
      if (!res.ok || !d.tokenHash) { setCampoErro(d.campo || ''); setErro(d.error || 'Não conseguimos criar sua conta.'); return }

      const { data: v, error: vErr } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' })
      if (vErr || !v.session) { setFolha(false); openLogin({ next: `/presente?t=${token}` }); return }

      trackSignUp({ metodo: 'convite', utm_source: 'email', utm_medium: 'convite', utm_campaign: OFERTA_PRESENTE.campanha })
      fetch('/api/email/welcome', { method: 'POST', headers: { Authorization: `Bearer ${v.session.access_token}` } }).catch(() => {})
      await irParaCheckout(v.session.access_token)
    } catch {
      setErro('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  const Topo = (
    <header className="pr-top">
      <div className="bx-gutter pr-top-row">
        <img src="/logo_BYNX.png" alt="Bynx" className="pr-logo" />
        {aberto && !encerrada
          ? <span className="pr-tag">Termina em <b>{relogioCurto}</b></span>
          : <span className="pr-tag">Presente para você</span>}
      </div>
      {!aberto && !encerrada && token && (
        <div className="pr-timer" aria-live="off">
          <span>Termina em</span>
          {([['dias', t?.dias], ['horas', t?.horas], ['min', t?.min], ['seg', t?.seg]] as const).map(([rot, v]) => (
            <span key={rot} className="pr-tbox"><b>{v === undefined ? '--' : p2(v)}</b><i>{rot.toUpperCase()}</i></span>
          ))}
        </div>
      )}
    </header>
  )

  if (encerrada) {
    return (
      <div className="pr-root">
        <style>{CSS}</style>
        {Topo}
        <main className="bx-gutter">
          <div className="pr-wrap pr-center">
            <span className="pr-ic pr-ic-lg"><IconClock size={24} /></span>
            <h1 className="pr-h2">O presente encerrou.</h1>
            <p className="pr-p">Ele valia até sexta, 18/09, às 23h59. Você ainda pode conhecer a Bynx de graça.</p>
            <a className="pr-cta" href="/?auth=signup">Criar conta grátis</a>
          </div>
        </main>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="pr-root">
        <style>{CSS}</style>
        {Topo}
        <main className="bx-gutter">
          <div className="pr-wrap pr-center">
            <span className="pr-ic pr-ic-lg"><IconStar size={24} /></span>
            <h1 className="pr-h2">Este presente é pessoal.</h1>
            <p className="pr-p">Ele chega por e-mail, com um link só seu. Abra a mensagem da Bynx e toque em “Abrir meu presente”.</p>
            <a className="pr-ghost" href="/#planos">Ver os planos da Bynx</a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="pr-root">
      <style>{CSS}</style>
      {Topo}

      {!aberto ? (
        <main className="bx-gutter">
          <div className="pr-wrap pr-hero">
            {primeiroNome && <p className="pr-hi">Oi, <b>{primeiroNome}</b></p>}
            <h1 className="pr-h">Esse booster tem <span>o seu nome.</span></h1>
            <p className="pr-sub">Separamos um presente para a sua coleção. Toque para abrir.</p>

            <div className="pr-stage" aria-hidden="true">
              <i className="pr-spark" style={{ top: 34, left: '22%' }} />
              <i className="pr-spark" style={{ top: 86, right: '20%', animationDelay: '.6s' }} />
              <i className="pr-spark" style={{ bottom: 44, left: '26%', animationDelay: '1.2s' }} />
              <i className="pr-spark" style={{ bottom: 70, right: '24%', animationDelay: '1.8s' }} />
              <div className={`pr-pack${abrindo ? ' pr-abrindo' : ''}`}>
                <span className="pr-crimp pr-crimp-t" />
                <img src="/logo_BYNX.png" alt="" className="pr-pack-logo" />
                <div className="pr-band"><small>PRESENTE</small><b>-{OFERTA_PRESENTE.descontoPct}%</b></div>
                <div className="pr-pack-nome">Edição especial<b>{primeiroNome || 'Colecionador'}</b></div>
                <span className="pr-crimp pr-crimp-b" />
              </div>
            </div>

            <button className="pr-cta" onClick={abrirPresente} disabled={abrindo}>
              Abrir meu presente <IconArrowRight size={18} strokeWidth={2.4} />
            </button>
            <p className="pr-hint">Nada é cobrado ao abrir.</p>
          </div>
        </main>
      ) : (
        <>
          <main className="bx-gutter">
            <div className="pr-wrap pr-aberto">
              <h1 className="pr-h2 pr-tc">Saiu tudo isso no seu booster</h1>
              <p className="pr-p pr-tc">As cartas mais colecionadas na Bynx cabem na sua coleção</p>

              <div className="pr-fan">
                {LEQUE.map((c, i) => (
                  <div key={c.nome} className={`pr-fan-card pr-fan-${i}`}>
                    <Image src={c.img} alt={c.nome} width={i === 2 ? 120 : 100} height={i === 2 ? 167 : 139} sizes={i === 2 ? '120px' : '100px'} priority />
                  </div>
                ))}
              </div>

              <ul className="pr-perks">
                {PERKS.map(({ Icon, t: tt, d }) => (
                  <li key={tt}><span className="pr-ic pr-ic-sm"><Icon size={16} /></span><b>{tt}</b><small>{d}</small></li>
                ))}
              </ul>

              <h2 className="pr-rar-h">Escolha a raridade do seu plano</h2>
              <div className="pr-plans" role="radiogroup" aria-label="Plano">
                {PLANOS_PRESENTE.map(p => {
                  const on = p.id === plano
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={on} className={`pr-plan${on ? ' pr-on' : ''}`} onClick={() => setPlano(p.id)}>
                      {p.id === 'anual' && <span className="pr-ribbon">Mais completo</span>}
                      <span className="pr-plan-l">
                        <span className="pr-rar">{'★'.repeat(p.estrelas)} {p.raridade}</span>
                        <span className="pr-plan-nome">{p.nome}</span>
                        <span className="pr-plan-d">{p.descricao}</span>
                      </span>
                      <span className="pr-plan-r">
                        <s>R$ {brl(p.cheio)}</s>
                        <b>R$ {brl(precoPresente(p.cheio))}</b>
                        <small>{p.periodo === 'ano' ? 'no 1º ano' : 'no 1º mês'}</small>
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="pr-risk">
                <span className="pr-ic pr-ic-green"><IconShield size={18} /></span>
                <p><strong>Não curtiu? Devolvemos tudo.</strong> Você tem 7 dias para desistir e recebe 100% de volta.</p>
              </div>

              {erro && !folha && <p className="pr-erro" role="alert">{erro}</p>}

              <footer className="pr-fine">
                Presente: {OFERTA_PRESENTE.descontoPct}% de desconto na primeira cobrança dos planos Plus, Pro e Pro Anual, para assinaturas feitas até 18/09/2026 às 23h59 (horário de Brasília), uma por conta e só para quem ainda não assinou a Bynx. A partir da segunda cobrança, o plano renova pelo valor integral (Pro Anual R$ 249/ano, Pro R$ 29,90/mês, Plus R$ 14,90/mês) até você cancelar em Minha Conta, sem multa. Arrependimento em até 7 dias da contratação, com devolução integral. Assinatura para maiores de 18 anos.
                <br /><br />
                <a href="/termos">Termos de Uso</a> · <a href="/privacidade">Privacidade</a>
              </footer>
            </div>
          </main>

          <div className="pr-sticky">
            <div className="pr-sticky-in">
              <div className="pr-mini"><span>{escolhido.nome} · R$ {brl(precoPresente(escolhido.cheio))} {escolhido.periodo === 'ano' ? 'no 1º ano' : 'no 1º mês'}</span><span>fecha em <b>{relogioCurto}</b></span></div>
              <button className="pr-cta pr-cta-flat" onClick={quero} disabled={carregando}>
                {carregando ? 'Abrindo pagamento...' : `Quero o ${escolhido.nome}`}
              </button>
            </div>
          </div>
        </>
      )}

      {folha && (
        <div className="pr-sheet" role="dialog" aria-modal="true" aria-labelledby="pr-folha-h" onClick={() => !carregando && setFolha(false)}>
          <form className="pr-panel" onClick={e => e.stopPropagation()} onSubmit={criarContaEPagar}>
            <button type="button" className="pr-x" onClick={() => setFolha(false)} aria-label="Fechar"><IconClose size={16} /></button>
            <h2 id="pr-folha-h" className="pr-panel-h">Falta só a sua senha{primeiroNome ? `, ${primeiroNome}` : ''}</h2>
            <p className="pr-p">Já preenchemos o resto. Depois disso você vai direto para o pagamento com o desconto aplicado.</p>
            <div className="pr-sum"><span>{escolhido.nome} · presente</span><span><s>R$ {brl(escolhido.cheio)}</s> <b>R$ {brl(precoPresente(escolhido.cheio))}</b></span></div>

            <label className="pr-fld">
              <span>Nome</span>
              <input value={fNome} onChange={e => setFNome(e.target.value)} autoComplete="name" className={campoErro === 'nome' ? 'pr-inv' : ''} required />
            </label>
            <label className="pr-fld">
              <span>E-mail <em><IconCheck size={11} strokeWidth={2.6} /> confirmado pelo link</em></span>
              <input value={email} readOnly className="pr-lock" autoComplete="email" />
            </label>
            <div className="pr-two">
              <label className="pr-fld">
                <span>Crie sua senha</span>
                <span className="pr-pass">
                  <input type={verSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" className={campoErro === 'senha' ? 'pr-inv' : ''} required />
                  <button type="button" onClick={() => setVerSenha(v => !v)} aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}>
                    {verSenha ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </span>
              </label>
              <label className="pr-fld">
                <span>Nascimento</span>
                <input type="date" value={nasc} onChange={e => setNasc(e.target.value)} className={campoErro === 'nascimento' ? 'pr-inv' : ''} required />
              </label>
            </div>
            <p className="pr-dica">Senha com 8 ou mais caracteres, maiúscula, minúscula, número e símbolo.</p>

            <label className={`pr-chk${campoErro === 'termos' ? ' pr-chk-inv' : ''}`}>
              <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} />
              <span>Tenho 18 anos ou mais. Li e aceito os <a href="/termos" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
            </label>
            <label className="pr-chk">
              <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
              <span>Quero receber novidades da Bynx por e-mail (opcional).</span>
            </label>

            {erro && <p className="pr-erro" role="alert">{erro}</p>}
            <button type="submit" className="pr-cta" disabled={carregando}>
              {carregando ? 'Preparando seu pagamento...' : `Ir para o pagamento com ${OFERTA_PRESENTE.descontoPct}%`}
            </button>
            <p className="pr-nota">Pagamento seguro pela Stripe, com cartão, Apple Pay ou Google Pay.</p>
          </form>
        </div>
      )}
    </div>
  )
}

const CSS = `
.pr-root{min-height:100dvh;background:var(--bx-bg);color:var(--bx-text)}
.pr-wrap{max-width:560px;margin:0 auto}
.pr-tc{text-align:center}

.pr-top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bx-bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--bx-border)}
.pr-top-row{display:flex;align-items:center;justify-content:space-between;height:56px;max-width:608px;margin:0 auto}
.pr-logo{height:26px;width:auto;display:block}
.pr-tag{font-size:12px;font-weight:600;color:var(--bx-text-2)}
.pr-tag b{color:var(--ac-1);font-variant-numeric:tabular-nums}
.pr-timer{display:flex;justify-content:center;align-items:center;gap:6px;padding:8px 0;font-size:12px;color:var(--bx-text-2);background:rgba(var(--ac-2-rgb),0.10);border-top:1px solid rgba(var(--ac-2-rgb),0.2)}
.pr-tbox{display:inline-flex;flex-direction:column;align-items:center;min-width:36px;padding:3px 4px;border-radius:8px;background:var(--bx-bg);border:1px solid var(--bx-border-2)}
.pr-tbox b{font-size:15px;font-weight:800;line-height:1.1;color:var(--ac-1);font-variant-numeric:tabular-nums}
.pr-tbox i{font-style:normal;font-size:9px;letter-spacing:.06em;color:var(--bx-text-3)}

.pr-hero{text-align:center;padding:24px 0 32px;background:radial-gradient(90% 60% at 50% 22%,rgba(var(--ac-1-rgb),0.16),transparent 70%)}
.pr-hi{margin:0;font-size:15px;color:var(--bx-text-2)}
.pr-hi b{color:var(--bx-text)}
.pr-h{font-size:clamp(30px,8vw,40px);line-height:1.08;font-weight:800;letter-spacing:-0.03em;margin:8px 0 6px;text-wrap:balance}
.pr-h span{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.pr-h2{font-size:24px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;margin:0 0 6px;text-wrap:balance}
.pr-sub{font-size:15px;line-height:1.5;color:var(--bx-text-2);margin:0 auto;max-width:34ch}
.pr-p{font-size:14px;line-height:1.5;color:var(--bx-text-2);margin:0 0 14px}

.pr-stage{position:relative;height:300px;margin:16px 0 8px;display:grid;place-items:center}
.pr-pack{position:relative;width:172px;height:252px;border-radius:14px;overflow:hidden;background:linear-gradient(160deg,rgba(255,255,255,.2),transparent 38%),linear-gradient(180deg,var(--bx-bg-elev),var(--bx-bg));border:1px solid rgba(var(--ac-1-rgb),0.55);box-shadow:0 20px 60px rgba(var(--ac-2-rgb),0.25);animation:pr-float 3.2s ease-in-out infinite;transition:transform .4s ease,opacity .4s ease}
.pr-pack::before{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.26) 46%,transparent 60%);animation:pr-shine 3.4s ease-in-out infinite}
.pr-abrindo{animation:none;transform:scale(1.18) rotate(-4deg);opacity:0}
.pr-crimp{position:absolute;left:0;right:0;height:14px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 6px,transparent 6px 12px)}
.pr-crimp-t{top:0}.pr-crimp-b{bottom:0}
.pr-pack-logo{position:absolute;top:32px;left:50%;transform:translateX(-50%);height:20px;width:auto}
.pr-band{position:absolute;left:0;right:0;top:94px;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--ac-grad);color:var(--bx-brand-ink)}
.pr-band small{font-size:10px;font-weight:700;letter-spacing:.14em;opacity:.8}
.pr-band b{font-size:27px;font-weight:800;line-height:1}
.pr-pack-nome{position:absolute;left:0;right:0;bottom:34px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-2)}
.pr-pack-nome b{display:block;font-size:15px;letter-spacing:0;text-transform:none;color:var(--bx-text);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px}
.pr-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:var(--ac-1);box-shadow:0 0 12px var(--ac-1);animation:pr-tw 2.4s ease-in-out infinite}
@keyframes pr-float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
@keyframes pr-shine{0%{transform:translateX(-120%)}60%,100%{transform:translateX(120%)}}
@keyframes pr-tw{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}

.pr-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:56px;border:0;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.pr-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(var(--ac-2-rgb),.35)}
.pr-cta:disabled{opacity:.7;cursor:progress}
.pr-cta:focus-visible,.pr-plan:focus-visible,.pr-ghost:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.pr-cta-flat{margin:0}
.pr-hint{font-size:12px;color:var(--bx-text-3);margin:10px 0 0}
.pr-ghost{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font-weight:600;font-size:15px;text-decoration:none}

.pr-aberto{padding:22px 0 0}
.pr-fan{position:relative;height:196px;margin:6px 0 10px;background:radial-gradient(60% 70% at 50% 60%,rgba(var(--ac-1-rgb),0.16),transparent 70%)}
.pr-fan-card{position:absolute;top:24px;left:50%;border-radius:7px;overflow:hidden;line-height:0;box-shadow:0 14px 30px rgba(0,0,0,.6)}
.pr-fan-card img{display:block;width:100%;height:auto}
.pr-fan-0{width:100px;transform:translateX(calc(-50% - 112px)) translateY(18px) rotate(-13deg);z-index:1}
.pr-fan-1{width:100px;transform:translateX(calc(-50% - 58px)) translateY(6px) rotate(-6deg);z-index:2}
.pr-fan-2{width:120px;top:6px;transform:translateX(-50%);z-index:3;box-shadow:0 0 0 2px rgba(var(--ac-1-rgb),.7),0 18px 40px rgba(var(--ac-2-rgb),.35)}
.pr-fan-3{width:100px;transform:translateX(calc(-50% + 58px)) translateY(6px) rotate(6deg);z-index:2}
.pr-fan-4{width:100px;transform:translateX(calc(-50% + 112px)) translateY(18px) rotate(13deg);z-index:1}

.pr-perks{list-style:none;margin:0 0 20px;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pr-perks li{min-width:0;display:flex;flex-direction:column;gap:2px;padding:10px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.pr-perks b{font-size:13.5px;font-weight:600;margin-top:6px}
.pr-perks small{font-size:12px;line-height:1.35;color:var(--bx-text-2)}
.pr-ic{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:rgba(var(--ac-1-rgb),0.10);color:var(--ac-1);flex-shrink:0}
.pr-ic-sm{width:30px;height:30px;border-radius:9px}
.pr-ic-lg{width:52px;height:52px;border-radius:14px;margin:0 auto 18px}
.pr-ic-green{color:var(--bx-green);background:color-mix(in srgb,var(--bx-green) 12%,transparent)}

.pr-rar-h{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--bx-text-3);font-weight:700;margin:0 0 10px}
.pr-plans{display:grid;gap:10px}
.pr-plan{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;min-height:72px;padding:13px 14px;border-radius:14px;text-align:left;font:inherit;color:var(--bx-text);background:var(--bx-surface);border:1px solid var(--bx-border-2);cursor:pointer;transition:border-color .15s ease,background .15s ease}
.pr-plan:hover{background:var(--bx-surface-2)}
.pr-on{border-color:rgba(var(--ac-1-rgb),.8);background:linear-gradient(180deg,rgba(var(--ac-1-rgb),.12),rgba(var(--ac-2-rgb),.05))}
.pr-plan-l{min-width:0;display:flex;flex-direction:column}
.pr-rar{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.pr-on .pr-rar{color:var(--ac-1)}
.pr-plan-nome{font-size:15px;font-weight:700;margin-top:2px}
.pr-plan-d{font-size:12px;line-height:1.35;color:var(--bx-text-2);margin-top:2px}
.pr-plan-r{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
.pr-plan-r s{font-size:12px;color:var(--bx-text-3)}
.pr-plan-r b{font-size:19px;font-weight:800;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.pr-plan-r small{font-size:11px;color:var(--bx-text-3)}
.pr-ribbon{position:absolute;top:-9px;right:12px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink)}

.pr-risk{display:grid;grid-template-columns:36px minmax(0,1fr);gap:12px;align-items:center;margin-top:16px;padding:12px;border-radius:12px;background:color-mix(in srgb,var(--bx-green) 6%,transparent);border:1px solid color-mix(in srgb,var(--bx-green) 28%,transparent)}
.pr-risk p{margin:0;font-size:13px;line-height:1.45}
.pr-erro{margin:12px 0 0;font-size:13px;line-height:1.45;color:var(--bx-red);text-align:center}
.pr-fine{margin-top:18px;padding:14px 0 150px;border-top:1px solid var(--bx-border);font-size:11.5px;line-height:1.6;color:var(--bx-text-3)}
.pr-fine a{color:var(--bx-text-2)}

.pr-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bx-bg) 32%)}
.pr-sticky-in{max-width:560px;margin:0 auto}
.pr-mini{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--bx-text-2);margin-bottom:8px}
.pr-mini b{color:var(--ac-1);font-variant-numeric:tabular-nums}

.pr-center{min-height:calc(100dvh - 57px);display:flex;flex-direction:column;justify-content:center;text-align:center;padding:32px 0}

.pr-sheet{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center}
.pr-panel{position:relative;width:100%;max-width:560px;max-height:92dvh;overflow:auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-bottom:0;border-radius:22px 22px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));display:grid;gap:10px}
.pr-x{position:absolute;top:10px;right:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;border:0;background:transparent;color:var(--bx-text-2);cursor:pointer}
.pr-panel-h{font-size:21px;font-weight:800;letter-spacing:-0.02em;margin:0;padding-right:40px}
.pr-panel .pr-p{margin:0}
.pr-sum{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px;border-radius:12px;font-size:13px;background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.28)}
.pr-sum s{color:var(--bx-text-3);font-size:12.5px}
.pr-sum b{font-size:16px;font-variant-numeric:tabular-nums}
.pr-fld{display:flex;flex-direction:column;gap:5px;min-width:0}
.pr-fld > span:first-child{display:flex;justify-content:space-between;gap:6px;font-size:12px;font-weight:500;color:var(--bx-text-2)}
.pr-fld em{display:inline-flex;align-items:center;gap:3px;font-style:normal;font-size:11px;color:var(--bx-green)}
.pr-fld input{width:100%;min-height:48px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);padding:0 12px;font:inherit;font-size:16px;color-scheme:dark}
.pr-fld input:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.7)}
.pr-lock{color:var(--bx-text-2)!important;background:var(--bx-surface-2)!important}
.pr-inv{border-color:var(--bx-red)!important}
.pr-pass{position:relative;display:block}
.pr-pass input{padding-right:46px}
.pr-pass button{position:absolute;top:2px;right:2px;width:44px;height:44px;display:grid;place-items:center;border:0;background:transparent;color:var(--bx-text-3);cursor:pointer}
.pr-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.pr-dica{margin:-2px 0 0;font-size:11.5px;color:var(--bx-text-3)}
.pr-chk{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;align-items:start;min-height:44px;padding-top:4px;font-size:12.5px;line-height:1.45;color:var(--bx-text-2);cursor:pointer}
.pr-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--ac-1)}
.pr-chk a{color:var(--ac-1)}
.pr-chk-inv span{color:var(--bx-red)}
.pr-nota{margin:0;font-size:11.5px;color:var(--bx-text-3);text-align:center}

@media (prefers-reduced-motion:reduce){.pr-pack,.pr-pack::before,.pr-spark{animation:none}.pr-cta,.pr-plan,.pr-pack{transition:none}}
`
