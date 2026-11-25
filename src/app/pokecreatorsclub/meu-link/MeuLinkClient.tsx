'use client'

// Meu link do Club (plano de 25/11/2026, mockup "Meu link do Club"). O membro vê o endereço dele,
// copia ou compartilha, e acompanha só números: visitas, cadastros e ativados. Quem chegou pelo
// link nunca aparece pelo nome. A contagem de visitas é de aberturas do link, não de pessoas.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { CLUB, MEU_LINK } from '@/lib/pcc/rotas'
import { carregarMeuLink, enderecoCurto, enderecoDoLink, type MeuLink } from '@/lib/pcc/meuLink'
import { AS_CSS, Ico, VoltarClub } from '../amigo-secreto/estilo'

type Fase = 'lendo' | 'ok' | 'nao_membro' | 'falhou'

export default function MeuLinkClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [fase, setFase] = useState<Fase>('lendo')
  const [ml, setMl] = useState<MeuLink | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const ler = useCallback(async () => {
    const r = await carregarMeuLink()
    if (!r.ok) { setFase(r.naoMembro ? 'nao_membro' : 'falhou'); return }
    setMl(r.d)
    setFase('ok')
  }, [])

  useEffect(() => {
    if (!uid) return
    let vivo = true
    carregarMeuLink().then(r => {
      if (!vivo) return
      if (!r.ok) { setFase(r.naoMembro ? 'nao_membro' : 'falhou'); return }
      setMl(r.d)
      setFase('ok')
    })
    return () => { vivo = false }
  }, [uid])

  const entrar = () => openLogin({ next: MEU_LINK, cta: 'Entrar' })

  const casca = (filhos: React.ReactNode) => (
    <div className="as ml">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Meu link</span>
          {uid
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm" style={{ minHeight: 44, width: 'auto' }} onClick={entrar}>Entrar</button>}
        </div>
      </header>
      <main className="bx-gutter"><div className="as-wrap as-bd">{filhos}</div></main>
      <style>{AS_CSS + ML_CSS}</style>
    </div>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>)
  if (uid === null) {
    return casca(
      <div className="as-center">
        <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="link" s={40} /></span>
        <h1 className="as-h2">Meu link</h1>
        <p className="as-p">Entre para ver o seu link e quantas pessoas chegaram por ele.</p>
        <button type="button" className="as-btn pri cta" style={{ maxWidth: 320 }} onClick={entrar}>Entrar</button>
      </div>,
    )
  }
  if (fase === 'lendo') return casca(<div className="as-center"><span className="as-meta">Abrindo o seu link...</span></div>)
  if (fase === 'nao_membro') {
    return casca(
      <div className="as-center">
        <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="link" s={40} /></span>
        <h1 className="as-h2">Meu link</h1>
        <p className="as-p">O link é dos membros do Club. Entrar leva um minuto.</p>
        <Link href={`${CLUB}?entrar=1`} className="as-btn pri cta" style={{ maxWidth: 320 }}>Entrar no Club</Link>
      </div>,
    )
  }
  if (fase === 'falhou' || !ml) {
    return casca(<>
      <h1 className="as-h2">Meu link</h1>
      <div className="as-erro" role="alert">Não conseguimos abrir o seu link.</div>
      <button type="button" className="as-btn" onClick={() => { setFase('lendo'); ler() }}>Tentar de novo</button>
    </>)
  }

  const vazio = ml.visitas_total === 0 && ml.cadastros === 0 && ml.ativados === 0
  return casca(<>
    <div className="ml-cab">
      <h1 className="as-h2">Meu link</h1>
      <p className="as-p">Compartilhe o seu endereço e acompanhe quantas pessoas chegaram por ele.</p>
    </div>

    <Endereco ml={ml} />

    <div className="ml-tres">
      <Numero n={ml.visitas_total} rotulo={ml.visitas_total === 1 ? 'visita' : 'visitas'} apagado={vazio} />
      <Numero n={ml.cadastros} rotulo={ml.cadastros === 1 ? 'cadastro' : 'cadastros'} apagado={vazio} />
      <Numero n={ml.ativados} rotulo={ml.ativados === 1 ? 'ativado' : 'ativados'} apagado={vazio} />
    </div>

    {vazio
      ? (
        <div className="as-card ml-dica">
          <h2 className="as-h3">Ainda ninguém abriu o seu link</h2>
          <ul>
            <li><Ico n="check" s={15} />Cole na bio do Instagram.</li>
            <li><Ico n="check" s={15} />Use o adesivo de link nos Stories.</li>
            <li><Ico n="check" s={15} />Ponha na descrição dos vídeos do YouTube.</li>
          </ul>
        </div>
      )
      : <Grafico serie={ml.visitas_14d} total={ml.visitas_total} />}

    <p className="as-meta ml-nota">
      Você vê só a contagem. Quem chegou pelo seu link nunca aparece pelo nome. As visitas contam aberturas do link, não pessoas, e um cadastro vira
      ativado depois de confirmar o e-mail, adicionar 5 cartas e esperar 7 dias.
      {ml.ativados > 0 ? ` O seu convidado com mais cartas tem ${ml.melhor_convidado_cartas}.` : ''}
    </p>
  </>)
}

function Numero({ n, rotulo, apagado }: { n: number; rotulo: string; apagado: boolean }) {
  return (
    <div className={`ml-num${apagado ? ' zero' : ''}`}>
      <b>{n}</b>
      <span>{rotulo}</span>
    </div>
  )
}

function Endereco({ ml }: { ml: MeuLink }) {
  const [aviso, setAviso] = useState('')
  // So celular e alguns navegadores tem a folha de compartilhar; no servidor e na primeira pintura nao ha.
  const compartilha = useSyncExternalStore(() => () => {}, () => typeof navigator.share === 'function', () => false)
  const href = enderecoDoLink(ml)
  const curto = enderecoCurto(ml)

  async function copiar() {
    if (!href) return
    try { await navigator.clipboard.writeText(href); setAviso('Link copiado.') }
    catch { setAviso('Não deu para copiar. Selecione o endereço e copie.') }
  }
  async function compartilhar() {
    if (!href) return
    try { await navigator.share({ title: 'Poké Creators Club', text: 'Venha para a Bynx pelo meu link.', url: href }) } catch { /* a pessoa fechou a folha */ }
  }

  if (!href) {
    return (
      <section className="as-card ml-link">
        <h2 className="as-h3">O seu link ainda não está pronto</h2>
        <p className="as-meta">A sua conta ainda não tem código de indicação. Fale com o suporte.</p>
      </section>
    )
  }
  return (
    <section className="as-card ml-link">
      <span className="ml-rot">O seu link do Club</span>
      <div className="ml-url" id="ml-url"><Ico n="link" s={18} /><span>{curto}</span></div>
      <div className="ml-bts">
        <button type="button" className="as-btn pri" onClick={copiar}><Ico n="copy" s={17} />Copiar link</button>
        {compartilha && <button type="button" className="as-btn" onClick={compartilhar}><Ico n="share" s={17} />Compartilhar</button>}
      </div>
      <span className="as-hint" role="status" aria-live="polite">{aviso}</span>
      {!ml.arroba && <span className="as-hint">Confirme o seu @ do Instagram no Club para ter o endereço com @.</span>}
    </section>
  )
}

function Grafico({ serie, total }: { serie: number[]; total: number }) {
  const max = Math.max(1, ...serie)
  return (
    <section className="as-card ml-graf">
      <div className="ml-graf-ln"><span>Visitas por dia</span><span>últimos 14 dias</span></div>
      <div className="ml-bars" role="img" aria-label={`Visitas por dia nos últimos 14 dias. Total desde o início: ${total}.`}>
        {serie.map((v, i) => (
          <i key={i} className={i === serie.length - 1 ? 'hoje' : ''} style={{ height: `${Math.max(v > 0 ? 6 : 2, Math.round((v / max) * 100))}%` }} title={`${v}`} />
        ))}
      </div>
      <div className="ml-graf-ln"><span>há 14 dias</span><span>hoje</span></div>
    </section>
  )
}

const ML_CSS = `
.ml-cab{display:flex;flex-direction:column;gap:4px}
.ml-link{gap:12px;padding:14px}
.ml-rot{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--bx-text-3)}
.ml-url{display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 12px;border-radius:10px;background:var(--bx-bg);border:1px solid var(--bx-border-2);font-weight:700;font-size:15px;min-width:0}
.ml-url svg{flex:none;color:var(--ac-1)}
.ml-url span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ml-bts{display:flex;gap:10px;flex-wrap:wrap}
.ml-bts .as-btn{flex:1 1 140px}
.ml-tres{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ml-num{display:flex;flex-direction:column;gap:2px;padding:12px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border)}
.ml-num b{font-size:26px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}
.ml-num span{font-size:12px;color:var(--bx-text-2)}
.ml-num.zero b{color:var(--bx-text-3)}
.ml-graf{gap:8px;padding:14px}
.ml-graf-ln{display:flex;justify-content:space-between;font-size:12px;color:var(--bx-text-2)}
.ml-graf-ln:last-child{color:var(--bx-text-3)}
.ml-bars{display:flex;align-items:flex-end;gap:5px;height:72px}
.ml-bars i{flex:1;background:rgba(var(--ac-1-rgb),.32);border-radius:3px 3px 0 0;min-height:2px}
.ml-bars i.hoje{background:var(--ac-1)}
.ml-dica{gap:8px;padding:14px;border-style:dashed}
.ml-dica ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;color:var(--bx-text-2);font-size:13.5px}
.ml-dica li{display:flex;gap:8px;align-items:flex-start}
.ml-dica li svg{margin-top:2px;color:var(--ac-1);flex:none}
.ml-nota{line-height:1.5}
@media (min-width:1024px){.ml .as-wrap.as-bd{max-width:640px}}
@media (prefers-reduced-motion:reduce){.ml .as-btn{transition:none}}
`
