'use client'

// Meu portfólio (Fase 2 do Álbum do Club, fatia 2). O membro cola o link do próprio conteúdo,
// escolhe o formato e a data, e a carta que a ação valeu aparece na hora. Na mesma tela: a ficha
// de criador e o compromisso do criador (Jogo Limpo), que também valem carta. O portfólio é
// público (decisão de 21/11/2026): o aviso fica antes do botão de registrar. Nada da rede carrega
// aqui dentro: o link abre em outra aba.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { nn } from '@/lib/pcc/album'
import { ALBUM, CLUB, PORTFOLIO, criadorUrl } from '@/lib/pcc/rotas'
import {
  FORMATOS, HABILIDADES, MAX_FICHA, PRODUZ, REDES, TEMAS, TERMO_JOGO_LIMPO,
  aceitarTermo, carregarPortfolio, dataBrCurta, hojeBr, redeDoLink, removerConteudo, salvarConteudo, salvarFicha,
  type CartaChegou, type Conteudo, type Ficha, type Formato, type Portfolio, type Tema,
} from '@/lib/pcc/portfolio'
import { AS_CSS, Ico, VoltarClub } from '../amigo-secreto/estilo'

type Fase = 'lendo' | 'ok' | 'nao_membro' | 'falhou'

export default function PortfolioClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [fase, setFase] = useState<Fase>('lendo')
  const [pf, setPf] = useState<Portfolio | null>(null)
  // As cartas que a última ação valeu: ficam no topo até a próxima ação.
  const [chegaram, setChegaram] = useState<CartaChegou[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const ler = useCallback(async () => {
    const r = await carregarPortfolio()
    if (!r.ok) { setFase(r.codigo.includes('nao_membro') ? 'nao_membro' : 'falhou'); return }
    setPf(r.d)
    setFase('ok')
  }, [])

  useEffect(() => {
    if (!uid) return
    let vivo = true
    carregarPortfolio().then(r => {
      if (!vivo) return
      if (!r.ok) { setFase(r.codigo.includes('nao_membro') ? 'nao_membro' : 'falhou'); return }
      setPf(r.d)
      setFase('ok')
    })
    return () => { vivo = false }
  }, [uid])

  const entrar = () => openLogin({ next: PORTFOLIO, cta: 'Entrar' })

  const casca = (filhos: React.ReactNode) => (
    <div className="as pf">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Meu portfólio</span>
          {uid
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm" style={{ minHeight: 44, width: 'auto' }} onClick={entrar}>Entrar</button>}
        </div>
      </header>
      <main className="bx-gutter"><div className="as-wrap as-bd">{filhos}</div></main>
      <style>{AS_CSS + PF_CSS}</style>
    </div>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>)
  if (uid === null) {
    return casca(
      <div className="as-center">
        <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="video" s={40} /></span>
        <h1 className="as-h2">Meu portfólio</h1>
        <p className="as-p">Entre para registrar os seus conteúdos.</p>
        <button type="button" className="as-btn pri cta" style={{ maxWidth: 320 }} onClick={entrar}>Entrar</button>
      </div>,
    )
  }
  if (fase === 'lendo') return casca(<div className="as-center"><span className="as-meta">Abrindo o portfólio...</span></div>)
  if (fase === 'nao_membro') {
    return casca(
      <div className="as-center">
        <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="video" s={40} /></span>
        <h1 className="as-h2">Meu portfólio</h1>
        <p className="as-p">O portfólio é dos membros do Club. Entrar leva um minuto.</p>
        <Link href={`${CLUB}?entrar=1`} className="as-btn pri cta" style={{ maxWidth: 320 }}>Entrar no Club</Link>
      </div>,
    )
  }
  if (fase === 'falhou' || !pf) {
    return casca(<>
      <h1 className="as-h2">Meu portfólio</h1>
      <div className="as-erro" role="alert">Não conseguimos abrir o portfólio.</div>
      <button type="button" className="as-btn" onClick={() => { setFase('lendo'); ler() }}>Tentar de novo</button>
    </>)
  }

  const ativos = pf.conteudos.filter(c => c.status === 'ativo')
  return casca(<>
    <h1 className="as-h2">Meu portfólio</h1>
    <p className="as-p">Registre os seus conteúdos de Pokémon TCG. Cada registro pode valer uma carta do álbum.</p>

    {chegaram.length > 0 && (
      <div className="as-note strong pf-chegou" role="status">
        <strong>{chegaram.length === 1 ? 'Você ganhou uma carta.' : `Você ganhou ${chegaram.length} cartas.`}</strong>
        {chegaram.map(c => (
          <Link key={`${c.slug}-${c.numero}`} href={c.papel === 'base' ? ALBUM : `${ALBUM}?c=${c.slug}`} className="pf-carta">
            Carta {nn(c.numero)} · {c.papel === 'base' ? 'Base' : c.titulo}<Ico n="chev" s={14} />
          </Link>
        ))}
      </div>
    )}

    <Registrar restam={pf.hoje_restam} onFeito={cartas => { setChegaram(cartas); ler() }} />

    <section className="as-card pf-sec">
      <div className="as-eye-row">
        <h2 className="as-h3">Seus conteúdos</h2>
        <span className="as-meta">{ativos.length} {ativos.length === 1 ? 'registrado' : 'registrados'}</span>
      </div>
      <p className="as-meta">Semanas seguidas com registro: <b>{pf.semanas_seguidas}</b>. Vale a semana em que você registra, de segunda a domingo.</p>
      {pf.conteudos.length === 0
        ? <p className="as-meta">Nenhum conteúdo ainda. O primeiro registro já vale.</p>
        : pf.conteudos.map(c => <Linha key={c.id} c={c} onRemovido={() => { setChegaram([]); ler() }} />)}
      {ativos.length > 0 && (pf.instagram
        ? <Link href={criadorUrl(pf.instagram)} className="as-btn lnk pf-pub" target="_blank">Ver a minha página pública<Ico n="ext" s={14} /></Link>
        : <p className="as-hint">Confirme o seu @ do Instagram no Club para ter a sua página pública.</p>)}
    </section>

    <FichaBloco ficha={pf.ficha} onFeito={cartas => { setChegaram(cartas); ler() }} />
    <Compromisso aceito={pf.aceites.includes(TERMO_JOGO_LIMPO)} onFeito={cartas => { setChegaram(cartas); ler() }} />
  </>)
}

function Registrar({ restam, onFeito }: { restam: number; onFeito: (cartas: CartaChegou[]) => void }) {
  const [url, setUrl] = useState('')
  const [formato, setFormato] = useState<Formato | ''>('')
  const [tema, setTema] = useState<Tema | ''>('')
  const [data, setData] = useState(hojeBr)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const rede = redeDoLink(url)
  const pode = !ocupado && restam > 0 && !!url.trim() && !!formato && !!data

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!pode || !formato) return
    setOcupado(true); setErro('')
    const r = await salvarConteudo({ url: url.trim(), formato, tema: tema || null, publicado_em: data })
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    setUrl(''); setTema('')
    onFeito(r.d.cartas)
  }

  return (
    <form className="as-card pf-sec" onSubmit={enviar} noValidate>
      <h2 className="as-h3">Registrar conteúdo</h2>
      <div className="as-f">
        <label className="as-lb" htmlFor="pf-url">Link do conteúdo</label>
        <input id="pf-url" className="as-in" value={url} onChange={e => { setUrl(e.target.value); setErro('') }} inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://www.instagram.com/reel/..." aria-describedby="pf-url-dica" />
        <span id="pf-url-dica" className="as-hint">{rede ? `Link do ${REDES[rede]}.` : 'Post do Instagram, TikTok, YouTube ou Twitch. Cole o link completo.'}</span>
      </div>
      <div className="pf-2">
        <div className="as-f">
          <label className="as-lb" htmlFor="pf-formato">Formato</label>
          <select id="pf-formato" className="as-in" value={formato} onChange={e => { setFormato(e.target.value as Formato | ''); setErro('') }}>
            <option value="">Escolha</option>
            {(Object.keys(FORMATOS) as Formato[]).map(f => <option key={f} value={f}>{FORMATOS[f]}</option>)}
          </select>
        </div>
        <div className="as-f">
          <label className="as-lb" htmlFor="pf-data">Publicado em</label>
          <input id="pf-data" type="date" className="as-in" value={data} max={hojeBr()} onChange={e => { setData(e.target.value); setErro('') }} />
        </div>
      </div>
      <div className="as-f">
        <label className="as-lb" htmlFor="pf-tema">Sobre o que é (opcional)</label>
        <select id="pf-tema" className="as-in" value={tema} onChange={e => setTema(e.target.value as Tema | '')}>
          <option value="">Não informar</option>
          {(Object.keys(TEMAS) as Tema[]).map(t => <option key={t} value={t}>{TEMAS[t]}</option>)}
        </select>
      </div>
      <div className="as-note">O que você registra aqui aparece na sua página pública de criador, com o seu @. Registre só conteúdo seu.</div>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="submit" className="as-btn pri" disabled={!pode}>{ocupado ? 'Registrando...' : 'Registrar'}</button>
      <span className="as-hint">{restam > 0 ? `Cabem mais ${restam} hoje.` : 'Você já registrou 5 conteúdos hoje. Amanhã cabem mais.'}</span>
    </form>
  )
}

function Linha({ c, onRemovido }: { c: Conteudo; onRemovido: () => void }) {
  const [confirma, setConfirma] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function remover() {
    setOcupado(true); setErro('')
    const r = await removerConteudo(c.id)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); setConfirma(false); return }
    onRemovido()
  }
  return (
    <div className="pf-lin">
      <div className="pf-lin-tx">
        <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="pf-lk">{REDES[c.rede]} · {FORMATOS[c.formato]}<Ico n="ext" s={13} /></a>
        <small>{c.tema ? `${TEMAS[c.tema]} · ` : ''}Publicado em {dataBrCurta(c.publicado_em)}{c.status === 'reprovado' ? ' · não conferiu' : ''}</small>
        {erro && <small className="pf-err" role="alert">{erro}</small>}
      </div>
      {c.status === 'ativo' && (confirma
        ? <span className="pf-conf"><button type="button" className="as-btn sm" disabled={ocupado} onClick={remover}>{ocupado ? 'Removendo...' : 'Sim, remover'}</button><button type="button" className="as-btn lnk sm" disabled={ocupado} onClick={() => setConfirma(false)}>Não</button></span>
        : <button type="button" className="as-btn lnk sm" onClick={() => setConfirma(true)} aria-label={`Remover o conteúdo de ${dataBrCurta(c.publicado_em)}`}>Remover</button>)}
    </div>
  )
}

function Marcas({ id, titulo, opcoes, valor, onMuda }: { id: string; titulo: string; opcoes: Record<string, string>; valor: string[]; onMuda: (v: string[]) => void }) {
  const cheio = valor.length >= MAX_FICHA
  return (
    <fieldset className="pf-fs">
      <legend className="as-lb">{titulo}</legend>
      <div className="pf-chips">
        {Object.keys(opcoes).map(k => {
          const on = valor.includes(k)
          return (
            <label key={k} className={`pf-chip${on ? ' on' : ''}${!on && cheio ? ' off' : ''}`} htmlFor={`${id}-${k}`}>
              <input id={`${id}-${k}`} type="checkbox" checked={on} disabled={!on && cheio} onChange={() => onMuda(on ? valor.filter(x => x !== k) : [...valor, k])} />
              {opcoes[k]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function FichaBloco({ ficha, onFeito }: { ficha: Ficha | null; onFeito: (cartas: CartaChegou[]) => void }) {
  const [f, setF] = useState<Ficha>(() => ficha ?? { produz: [], ensina: [], aprende: [], bio: null })
  const [bio, setBio] = useState(ficha?.bio ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<{ tom: 'erro' | 'ok'; texto: string } | null>(null)

  async function salvar() {
    setOcupado(true); setMsg(null)
    const r = await salvarFicha({ produz: f.produz, ensina: f.ensina, aprende: f.aprende, bio: bio.trim() || null })
    setOcupado(false)
    if (!r.ok) { setMsg({ tom: 'erro', texto: r.msg }); return }
    setMsg({ tom: 'ok', texto: 'Ficha salva.' })
    onFeito(r.d.cartas)
  }

  return (
    <section className="as-card pf-sec">
      <h2 className="as-h3">Ficha de criador</h2>
      <p className="as-meta">Ajuda o Club a juntar quem pode gravar junto e quem pode ensinar. Até {MAX_FICHA} em cada lista.</p>
      <Marcas id="fp" titulo="O que você produz" opcoes={PRODUZ} valor={f.produz} onMuda={v => { setMsg(null); setF(a => ({ ...a, produz: v })) }} />
      <Marcas id="fe" titulo="O que você sabe ensinar" opcoes={HABILIDADES} valor={f.ensina} onMuda={v => { setMsg(null); setF(a => ({ ...a, ensina: v })) }} />
      <Marcas id="fa" titulo="O que você quer aprender" opcoes={HABILIDADES} valor={f.aprende} onMuda={v => { setMsg(null); setF(a => ({ ...a, aprende: v })) }} />
      <div className="as-f">
        <label className="as-lb" htmlFor="pf-bio">Bio em uma linha: o que você faz e para quem</label>
        <input id="pf-bio" className="as-in" value={bio} maxLength={120} onChange={e => { setBio(e.target.value); setMsg(null) }} placeholder="Abro boosters e conto a história de cada carta." />
        <span className="as-hint">{bio.length}/120. Aparece na sua página pública, junto do que você produz.</span>
      </div>
      {msg && <div className={msg.tom === 'erro' ? 'as-erro' : 'as-note'} role={msg.tom === 'erro' ? 'alert' : 'status'}>{msg.texto}</div>}
      <button type="button" className="as-btn" disabled={ocupado} onClick={salvar}>{ocupado ? 'Salvando...' : 'Salvar ficha'}</button>
    </section>
  )
}

function Compromisso({ aceito, onFeito }: { aceito: boolean; onFeito: (cartas: CartaChegou[]) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function aceitar() {
    setOcupado(true); setErro('')
    const r = await aceitarTermo(TERMO_JOGO_LIMPO)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    onFeito(r.d.cartas)
  }
  return (
    <section className="as-card pf-sec">
      <div className="as-eye-row">
        <h2 className="as-h3">Compromisso do criador</h2>
        {aceito && <span className="as-chip ok"><Ico n="check" s={13} />Assinado</span>}
      </div>
      <ul className="pf-termo">
        <li>Quando o conteúdo tiver produto recebido, parceria paga ou link com comissão, eu digo isso de forma clara, no próprio conteúdo.</li>
        <li>Não divulgo aposta, rifa nem sorteio pago.</li>
        <li>Não pressiono criança ou adolescente a comprar e não prometo ganho com cartas.</li>
        <li>Dou crédito à fonte e corrijo em público quando erro.</li>
      </ul>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      {!aceito && <button type="button" className="as-btn" disabled={ocupado} onClick={aceitar}>{ocupado ? 'Registrando...' : 'Assinar o compromisso'}</button>}
    </section>
  )
}

const PF_CSS = `
.pf-sec{gap:12px;padding:14px}
.pf-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pf-chegou{display:flex;flex-direction:column;gap:6px}
.pf-carta{display:inline-flex;align-items:center;gap:4px;min-height:36px;font-weight:700;text-decoration:underline;text-underline-offset:3px}
.pf-lin{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--bx-border)}
.pf-lin-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.pf-lin-tx small{font-size:12px;color:var(--bx-text-3)}
.pf-lin-tx small.pf-err{color:var(--bx-red)}
.pf-lk{display:inline-flex;align-items:center;gap:5px;font-weight:700;font-size:14px;text-decoration:none;min-height:28px}
.pf-lk:hover{text-decoration:underline}
.pf-conf{display:flex;align-items:center;gap:4px;flex:none}
.pf-pub{align-self:flex-start;width:auto;min-height:44px;padding:0;gap:6px}
.pf-fs{border:0;padding:0;margin:0;min-width:0}
.pf-chips{display:flex;flex-wrap:wrap;gap:6px}
.pf-chip{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--bx-border-2);font-size:13px;font-weight:600;color:var(--bx-text-2);cursor:pointer;transition:background .15s ease,border-color .15s ease}
.pf-chip input{position:absolute;opacity:0;width:1px;height:1px}
.pf-chip.on{border-color:rgba(var(--ac-1-rgb),.5);background:rgba(var(--ac-1-rgb),.1);color:var(--bx-text)}
.pf-chip.off{opacity:.4;cursor:default}
.pf-chip:focus-within{outline:2px solid rgba(var(--ac-1-rgb),.6);outline-offset:2px}
.pf-termo{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;color:var(--bx-text-2);line-height:1.45}
@media (max-width:420px){.pf-2{grid-template-columns:1fr}}
@media (min-width:1024px){.pf .as-wrap.as-bd{max-width:640px}}
`
