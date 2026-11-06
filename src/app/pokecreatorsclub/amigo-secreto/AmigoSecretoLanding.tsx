'use client'

// Landing publica do Amigo Secreto: regras, prova social (@ de quem entrou) e
// o cadastro em um passo (folha). Quem ja tem conta entra pelo AuthModal e
// cai na sala. Quem acabou de criar a conta vai direto para a sala.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import Turnstile from '@/components/auth/Turnstile'
import { trackSignUp } from '@/lib/analytics'
import { SENHA_REGRA_MSG } from '@/lib/senha'
import {
  AMIGO_SECRETO_SLUG, brl, dataCurta, dataHora, horaCurta, type EdicaoPublica,
} from '@/lib/amigoSecreto'
import { AMIGO_SECRETO_SALA, CLUB } from '@/lib/pcc/rotas'
import { AS_CSS, Avatar, Ico, VoltarClub } from './estilo'

const SALA = AMIGO_SECRETO_SALA

// Perguntas (Como funciona, Quem ve o que, Quem pode participar, Quem paga o
// frete, Precisa de ajuda) ocultas por enquanto, pedido do Du em 05/11. O texto
// fica aqui para voltar trocando para true.
const MOSTRAR_PERGUNTAS = false

export default function AmigoSecretoLanding() {
  const router = useRouter()
  const { openLogin } = useAuthModal()
  const [edicao, setEdicao] = useState<EdicaoPublica | null | undefined>(undefined)
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const [falhou, setFalhou] = useState(false)
  const [folha, setFolha] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    supabase.rpc('amigo_secreto_edicao_publica', { p_slug: AMIGO_SECRETO_SLUG })
      .then(({ data, error }) => {
        if (error) { setFalhou(true); setEdicao(null); return }
        const e = (data as EdicaoPublica | null) ?? null
        setEdicao(e)
        setAberto(!!e && e.estado === 'inscricoes' && Date.parse(e.inscricoes_ate) > Date.now())
      })
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session))
    // No desktop o "Como funciona" abre as 3 respostas lado a lado (sem acordeao).
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = () => setDesktop(mq.matches)
    onMq(); mq.addEventListener('change', onMq)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => { sub.subscription.unsubscribe(); mq.removeEventListener('change', onMq) }
  }, [])

  const inscricoesAbertas = aberto

  function participar() {
    if (logado) { router.push(SALA); return }
    setFolha(true)
  }

  const fecharFolha = useCallback(() => setFolha(false), [])

  // O mesmo CTA aparece no hero (desktop) e abaixo das regras (celular); o CSS
  // mostra um de cada vez (.as-hero-cta / .as-mob). E um no de JSX, nao um
  // componente: criado aqui, seria recriado a cada render.
  const cta = inscricoesAbertas ? (
    <>
      <button type="button" className="as-btn pri cta" onClick={participar} disabled={logado === undefined}>{logado ? 'Abrir a sala' : 'Quero participar'}</button>
      {logado === false && (
        <button type="button" className="as-btn lnk" onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}>Já tenho conta na Bynx. Entrar</button>
      )}
    </>
  ) : logado
    ? <Link href={SALA} className="as-btn pri cta">Abrir a sala</Link>
    : <button type="button" className="as-btn cta" onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}>Já participo. Entrar</button>
  // Pertencimento ao grupo (D1, 04/11): nesta edicao a barreira e a copy.
  const avisoGrupo = <div className="as-grupo">Edição para quem recebeu o link no grupo Poké Creators Club. Não encaminhe o link para fora do grupo.</div>

  return (
    <div className="as">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Amigo Secreto</span>
          {logado
            ? <Link href={SALA} className="as-ib sq" aria-label="Abrir a sala"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-ib sq" aria-label="Entrar" onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}><Ico n="user" s={22} /></button>}
        </div>
      </header>

      <main className="bx-gutter as-main-hero">
        <div className="as-wrap as-bd">
          <section className="as-hero">
            <span className="as-eyebrow"><Ico n="gift" s={14} />{edicao ? `Edição de ${new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(edicao.revelacao_em))} · convite do grupo` : 'Poké Creators Club'}</span>
            <div className="as-hero-g">
              <div className="tx">
                <h1 className="as-h1">Amigo Secreto do <em>Poké Creators Club</em></h1>
                <p className="as-p">Uma troca de presentes entre criadores de Pokémon TCG. No sorteio, você descobre quem vai presentear. Quem tirou você só aparece na revelação, se os dois quiserem.</p>
                {edicao && <><div className="as-hero-cta">{cta}</div><div className="as-hero-cta" style={{ marginTop: 0 }}>{avisoGrupo}</div></>}
              </div>
              <div className="as-verso tilt sm" aria-hidden="true"><Ico n="gift" s={28} /></div>
            </div>
            {edicao && (
              <div className="as-hero-side">
                <div className="as-verso tilt" aria-hidden="true"><Ico n="gift" s={40} /></div>
                <QuemEntrou edicao={edicao} convite={inscricoesAbertas && logado !== true} />
              </div>
            )}
          </section>

          {edicao === undefined && (
            <div className="as-card" aria-busy="true">
              <div className="as-k">Carregando a edição...</div>
              {[0, 1, 2, 3, 4].map(i => <div key={i} className="as-row static"><span className="as-meta">&nbsp;</span></div>)}
            </div>
          )}
          {edicao === null && falhou && (
            <div className="as-erro" role="alert">Não conseguimos carregar a edição. Recarregue a página.</div>
          )}
          {edicao === null && !falhou && (
            <div className="as-note">Esta edição ainda não está aberta. Volte em breve.</div>
          )}

          {edicao && (
            <>
              <div className="as-card as-rules">
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="gift" s={16} /></span><span>Presente até <strong>{brl(edicao.teto_cents)}</strong><small>frete à parte</small></span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="cal" s={16} /></span><span>Inscrições até {dataCurta(edicao.inscricoes_ate)}<small>{horaCurta(edicao.inscricoes_ate)}, horário de Brasília</small></span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="clock" s={16} /></span><span>Sorteio em {dataHora(edicao.sorteio_em)}<small>horário de Brasília</small></span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="box" s={16} /></span><span>Envio até {dataCurta(edicao.postar_ate)}<small>tente cumprir o prazo</small></span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="eye" s={16} /></span><span>Revelação em {dataHora(edicao.revelacao_em)}<small>se os dois aceitarem</small></span></span></div>
              </div>

              <div className="as-mob"><QuemEntrou edicao={edicao} convite={inscricoesAbertas && logado !== true} /></div>

              {inscricoesAbertas ? (
                <div className="as-mob" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{cta}{avisoGrupo}</div>
              ) : (
                <>
                  <div className="as-note strong"><strong>As inscrições encerraram.</strong> {edicao.estado === 'inscricoes' ? 'O prazo passou.' : 'O sorteio já aconteceu.'} Quem entrou acompanha tudo pela sala.</div>
                  <div className="as-mob" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{cta}</div>
                </>
              )}

              {MOSTRAR_PERGUNTAS && <div className="as-faq">
                <details open={desktop || undefined}>
                  <summary>Como funciona<Ico n="down" /></summary>
                  <p>Você cria a conta, informa o seu @ do Instagram, o endereço de entrega e uma pista do que gostaria de ganhar. No sorteio, você descobre quem vai presentear, compra um presente de até {brl(edicao.teto_cents)} e tenta postar até {dataCurta(edicao.postar_ate)}. O sorteio acontece com pelo menos {Math.max(3, edicao.minimo)} participantes e com o perfil de todo mundo completo.</p>
                </details>
                <details open={desktop || undefined}>
                  <summary>Quem vê o quê<Ico n="down" /></summary>
                  <p>Seu @ e o Pokémon escolhido aparecem na lista pública de participantes desta edição. Dentro da sala, seu endereço aparece apenas para quem vai enviar o seu presente, e para a organização quando for preciso resolver um problema da edição. A pista do presente só quem tirar você lê. Dados mantidos no seu perfil Bynx seguem a Política de Privacidade.</p>
                </details>
                <details open={desktop || undefined}>
                  <summary>Quem pode participar<Ico n="down" /></summary>
                  <p>Criadores de conteúdo de Pokémon TCG do Poké Creators Club, com perfil no Instagram e endereço no Brasil. O link circula no grupo; quem recebeu pode entrar.</p>
                </details>
                <details open={desktop || undefined}>
                  <summary>Quem paga o frete<Ico n="down" /></summary>
                  <p>Quem envia. O frete não entra no teto de {brl(edicao.teto_cents)}. Na hora de postar, você informa o código de rastreio e a pessoa acompanha sem saber quem mandou. Entrega em mãos também vale.</p>
                </details>
                <details open={desktop || undefined}>
                  <summary>Precisa de ajuda<Ico n="down" /></summary>
                  <p>Mudou de ideia, encontrou um problema ou não vai conseguir cumprir o prazo? Fale com a organização no grupo, em privado. Não publique dados pessoais no mural.</p>
                </details>
              </div>}
            </>
          )}

          <footer className="as-foot">
            <span>Bynx</span>
            <span><Link href="/termos">Termos</Link> · <Link href="/privacidade">Privacidade</Link></span>
          </footer>
        </div>
      </main>

      {folha && <FolhaCadastro onFechar={fecharFolha} onJaTemConta={() => { setFolha(false); openLogin({ next: SALA, cta: 'Entrar para abrir a sala' }) }} />}

      <style>{AS_CSS}</style>
    </div>
  )
}

function FolhaCadastro({ onFechar, onJaTemConta }: { onFechar: () => void; onJaTemConta: () => void }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [termos, setTermos] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [campoErro, setCampoErro] = useState('')
  const [semSessao, setSemSessao] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onFechar])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCampoErro('')
    if (!termos) { setCampoErro('termos'); setErro('Aceite os Termos de Uso e a Política de Privacidade.'); return }
    setCarregando(true)
    try {
      const res = await fetch('/api/amigo-secreto/cadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, termos, captcha }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.code === 'JA_TEM_CONTA') { onJaTemConta(); return }
      if (!res.ok) {
        setCampoErro(d.campo || ''); setErro(d.error || 'Não conseguimos criar sua conta.')
        setCaptchaReset(n => n + 1)
        return
      }
      trackSignUp({ metodo: 'amigo-secreto', utm_source: 'whatsapp', utm_medium: 'grupo', utm_campaign: AMIGO_SECRETO_SLUG })
      // A conta ja existe. Se a sessao nao abrir sozinha, a pessoa entra com
      // e-mail e senha em vez de cair na sala deslogada sem explicacao.
      if (!d.tokenHash) { setSemSessao(true); return }
      const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' })
      if (vErr) { console.error('[amigo-secreto] verifyOtp falhou:', vErr.message); setSemSessao(true); return }
      router.push(SALA)
    } catch {
      setErro('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="as-sheet-bg" onClick={onFechar}>
      <div className="as-sheet" role="dialog" aria-modal="true" aria-labelledby="as-cad-t" onClick={e => e.stopPropagation()}>
        <div className="as-handle" />
        <div className="as-sh">
          <h3 id="as-cad-t" className="as-h3">Entrar no Amigo Secreto</h3>
          <button type="button" className="as-ib" onClick={onFechar} aria-label="Fechar"><Ico n="x" s={22} /></button>
        </div>
        {semSessao ? (
          <>
            <div className="as-note strong"><strong>Sua conta foi criada</strong>, mas não conseguimos abrir a sala automaticamente. Entre com o seu e-mail e a senha que você acabou de escolher para continuar.</div>
            <button type="button" className="as-btn pri cta" onClick={onJaTemConta}>Entrar com e-mail e senha</button>
          </>
        ) : (
        <>
        <p className="as-meta">Um passo. A conta nasce confirmada e você já cai na sala.</p>
        <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="as-f">
            <span className="as-lb">Nome completo</span>
            <input className={`as-in${campoErro === 'nome' ? ' err' : ''}`} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" placeholder="Como está no documento" required />
            <span className="as-hint">Vai só na etiqueta dos Correios. Na sala você aparece pelo seu @.</span>
          </label>
          <label className="as-f">
            <span className="as-lb">E-mail</span>
            <input className={`as-in${campoErro === 'email' ? ' err' : ''}`} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" placeholder="voce@exemplo.com" required />
          </label>
          <div className="as-f">
            <span className="as-lb">Senha</span>
            <div className="as-two">
              <input className={`as-in${campoErro === 'senha' ? ' err' : ''}`} type={verSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" placeholder="mínimo de 8 caracteres" required aria-label="Senha" />
              <button type="button" className="as-btn sm" style={{ flex: '0 0 auto' }} onClick={() => setVerSenha(v => !v)}>{verSenha ? 'ocultar' : 'mostrar'}</button>
            </div>
            <span className="as-hint">{SENHA_REGRA_MSG.replace('Senha fraca. ', '')}</span>
          </div>
          <label className={`as-chk${campoErro === 'termos' ? ' err' : ''}`}>
            <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} />
            <span>Li e aceito os <Link href="/termos" target="_blank">Termos de Uso</Link> e a <Link href="/privacidade" target="_blank">Política de Privacidade</Link> da Bynx.</span>
          </label>
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          {erro && <div className="as-erro" role="alert">{erro}</div>}
          <button type="submit" className="as-btn pri cta" disabled={carregando}>{carregando ? 'Criando a conta...' : 'Criar conta e entrar na sala'}</button>
          <div className="as-note">Dentro da sala você informa o seu @ do Instagram, o endereço e uma pista do presente. Seu @ e o Pokémon escolhido aparecem na lista pública de participantes; o endereço e a pista, só para quem tirar você.</div>
          <button type="button" className="as-btn lnk" onClick={onJaTemConta}>Já tenho conta. Entrar</button>
        </form>
        </>
        )}
      </div>
    </div>
  )
}

function QuemEntrou({ edicao, convite }: { edicao: EdicaoPublica; convite: boolean }) {
  const n = edicao.participantes
  const min = Math.max(3, edicao.minimo)
  const faltam = Math.max(0, min - n)
  return (
    <div className="as-card">
      <div className="as-k">Quem já entrou</div>
      <div className="as-meta">
        {n === 0 ? `Seja o primeiro a entrar. O sorteio acontece com pelo menos ${min} criadores.`
          : faltam > 0 ? `${n} de ${min} criadores na brincadeira. ${faltam === 1 ? 'Falta 1' : `Faltam ${faltam}`} para o sorteio acontecer.`
          : `${n} criadores já entraram. O sorteio já tem quórum.`}
      </div>
      {(edicao.lista.length > 0 || convite) && (
        <div className="as-hs">
          {edicao.lista.slice(0, 8).map(p => (
            <span key={p.instagram} className="as-h"><Avatar instagram={p.instagram} pokemon={p.pokemon} tam={24} />@{p.instagram}</span>
          ))}
          {n > 8 && <span className="as-h more">e mais {n - 8}</span>}
          {convite && <span className="as-h more">Seu @ pode estar aqui</span>}
        </div>
      )}
    </div>
  )
}
