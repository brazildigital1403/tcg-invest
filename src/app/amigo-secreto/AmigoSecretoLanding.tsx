'use client'

// Landing publica do Amigo Secreto: regras, prova social (@ de quem entrou) e
// o cadastro em um passo (folha). Quem ja tem conta entra pelo AuthModal e
// cai na sala. Quem acabou de criar a conta vai direto para a sala.

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import Turnstile from '@/components/auth/Turnstile'
import { trackSignUp } from '@/lib/analytics'
import { SENHA_REGRA_MSG } from '@/lib/senha'
import {
  AMIGO_SECRETO_SLUG, brl, dataCurta, dataHora, type EdicaoPublica,
} from '@/lib/amigoSecreto'
import { AS_CSS, Avatar, Ico, LOGO_PCC } from './estilo'

const SALA = '/amigo-secreto/sala'

export default function AmigoSecretoLanding() {
  const router = useRouter()
  const { openLogin } = useAuthModal()
  const [edicao, setEdicao] = useState<EdicaoPublica | null | undefined>(undefined)
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const [falhou, setFalhou] = useState(false)
  const [folha, setFolha] = useState(false)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    supabase.rpc('amigo_secreto_edicao_publica', { p_slug: AMIGO_SECRETO_SLUG })
      .then(({ data, error }) => {
        if (error) { setFalhou(true); setEdicao(null); return }
        const e = (data as EdicaoPublica | null) ?? null
        setEdicao(e)
        setAberto(!!e && e.estado === 'inscricoes' && Date.parse(e.inscricoes_ate) > Date.now())
      })
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const inscricoesAbertas = aberto

  function participar() {
    if (logado) { router.push(SALA); return }
    setFolha(true)
  }

  const fecharFolha = useCallback(() => setFolha(false), [])

  return (
    <div className="as">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <Image src={LOGO_PCC} alt="Poké Creators Club" width={438} height={218} className="as-logo" priority />
          <span className="t">Amigo Secreto</span>
          {logado
            ? <Link href={SALA} className="as-ib sq" aria-label="Abrir a sala"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-ib sq" aria-label="Entrar" onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}><Ico n="user" s={22} /></button>}
        </div>
      </header>

      <main className="bx-gutter">
        <div className="as-wrap as-bd">
          <section className="as-hero">
            <span className="as-eyebrow"><Ico n="gift" s={14} />{edicao ? `Edição de ${new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(edicao.revelacao_em))}` : 'Poké Creators Club'}</span>
            <div className="as-hero-g">
              <div className="tx">
                <h1 className="as-h1">Amigo Secreto do <em>Poké Creators Club</em></h1>
                <p className="as-p">Uma troca de presentes entre criadores de conteúdo de Pokémon TCG. Ninguém sabe quem tirou quem até o fim.</p>
              </div>
              <div className="as-verso tilt sm" aria-hidden="true"><Ico n="gift" s={28} /></div>
            </div>
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
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="gift" s={16} /></span><span>Presente até <strong>{brl(edicao.teto_cents)}</strong></span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="cal" s={16} /></span><span>Inscrições até {dataCurta(edicao.inscricoes_ate)}</span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="clock" s={16} /></span><span>Sorteio em {dataHora(edicao.sorteio_em)}</span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="box" s={16} /></span><span>Postagem até {dataCurta(edicao.postar_ate)}</span></span></div>
                <div className="as-row static"><span className="l"><span className="as-ri"><Ico n="eye" s={16} /></span><span>Revelação em {dataCurta(edicao.revelacao_em)}</span></span></div>
              </div>

              <div className="as-card">
                <div className="as-k">
                  {edicao.participantes === 0 ? 'Seja o primeiro a entrar'
                    : edicao.participantes === 1 ? '1 criador já entrou'
                    : `${edicao.participantes} criadores já entraram`}
                </div>
                {edicao.lista.length > 0 && (
                  <div className="as-hs">
                    {edicao.lista.slice(0, 8).map(p => (
                      <span key={p.instagram} className="as-h"><Avatar instagram={p.instagram} pokemon={p.pokemon} tam={24} />@{p.instagram}</span>
                    ))}
                    {edicao.participantes > 8 && <span className="as-h more">e mais {edicao.participantes - 8}</span>}
                  </div>
                )}
              </div>

              {inscricoesAbertas ? (
                <>
                  <button type="button" className="as-btn pri cta" onClick={participar} disabled={logado === undefined}>{logado ? 'Abrir a sala' : 'Quero participar'}</button>
                  {logado === false && (
                    <button type="button" className="as-btn lnk" onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}>Já tenho conta na Bynx. Entrar</button>
                  )}
                </>
              ) : (
                <>
                  <div className="as-note strong"><strong>As inscrições encerraram.</strong> {edicao.estado === 'inscricoes' ? 'O prazo passou.' : 'O sorteio já aconteceu.'} Quem entrou acompanha tudo pela sala.</div>
                  {logado
                    ? <Link href={SALA} className="as-btn pri cta">Abrir a sala</Link>
                    : <button type="button" className="as-btn cta" onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}>Já participo. Entrar</button>}
                </>
              )}

              <div className="as-faq">
                <details>
                  <summary>Como funciona<Ico n="down" /></summary>
                  <p>Você cria a conta, informa o seu @ do Instagram, o endereço de entrega e o que gostaria de ganhar. No dia do sorteio, você descobre quem tirou, compra um presente de até {brl(edicao.teto_cents)} e posta até {dataCurta(edicao.postar_ate)}. Só quem tirou você vê o seu endereço, e só depois do sorteio.</p>
                </details>
                <details>
                  <summary>Quem pode participar<Ico n="down" /></summary>
                  <p>Criadores de conteúdo de Pokémon TCG do Poké Creators Club, com perfil no Instagram e endereço no Brasil. O link circula no grupo; quem recebeu pode entrar.</p>
                </details>
                <details>
                  <summary>Quem paga o frete<Ico n="down" /></summary>
                  <p>Quem envia. O frete não entra no teto de {brl(edicao.teto_cents)}. Na hora de postar, você informa o código de rastreio e a pessoa acompanha sem saber quem mandou.</p>
                </details>
              </div>
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
      if (d.tokenHash) {
        const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' })
        if (vErr) console.error('[amigo-secreto] verifyOtp falhou:', vErr.message)
      }
      trackSignUp({ metodo: 'amigo-secreto', utm_source: 'whatsapp', utm_medium: 'grupo', utm_campaign: AMIGO_SECRETO_SLUG })
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
          <div className="as-note">Dentro da sala você informa o seu @ do Instagram, o endereço e o que quer ganhar. O endereço só aparece para quem tirar você.</div>
          <button type="button" className="as-btn lnk" onClick={onJaTemConta}>Já tenho conta. Entrar</button>
        </form>
      </div>
    </div>
  )
}
