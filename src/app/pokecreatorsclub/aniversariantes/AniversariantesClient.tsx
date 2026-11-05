'use client'

// Aniversariantes do Club (wireframe aprovado em 05/11/2026, quadros A01 a A16 e
// D3). "Proximos" e a tela principal; o calendario fica em uma aba no celular e
// ao lado no computador. Dar parabens abre direto o Instagram da pessoa: a
// mensagem e de quem envia, e a Bynx nao sabe se foi enviada.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { INSTAGRAM_RE, limparInstagram, spritePokemon } from '@/lib/amigoSecreto'
import {
  MESES, MESES_CURTOS, diaNoAno, diasDoMes, erroAniversario, hojeBrasilia, instagramUrl, ordenarProximos, quandoTexto,
  type Aniversariante, type ListaAniversarios, type Proximo,
} from '@/lib/pcc/aniversarios'
import { ANIVERSARIANTES, CLUB } from '@/lib/pcc/rotas'
import { AS_CSS, Ico, VoltarClub } from '../amigo-secreto/estilo'

const BUCKET = 'club-fotos'
const ROTA = ANIVERSARIANTES
const urlFoto = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

type Pessoa = Pick<Aniversariante, 'instagram' | 'foto_path' | 'pokemon'>

/** Foto, se a pessoa subiu; senao o Pokemon; senao a inicial do @. */
export function Rosto({ p, tam = 40 }: { p: Pessoa; tam?: number }) {
  const sprite = spritePokemon(p.pokemon)
  if (p.foto_path) return <span className="as-av an-rosto" style={{ width: tam, height: tam }}><Image src={urlFoto(p.foto_path)} alt="" width={tam} height={tam} sizes={`${tam}px`} /></span>
  if (sprite) return <span className="as-av pk" style={{ width: tam, height: tam }}><Image src={sprite} alt="" width={tam} height={tam} unoptimized referrerPolicy="no-referrer" /></span>
  return <span className="as-av" style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.4) }}>{p.instagram.slice(0, 1).toUpperCase()}</span>
}

export default function AniversariantesClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [dados, setDados] = useState<ListaAniversarios | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [aba, setAba] = useState<'proximos' | 'calendario'>('proximos')
  const [folha, setFolha] = useState<'form' | 'sair' | null>(null)
  const [diaAberto, setDiaAberto] = useState<number | null>(null)
  const [pronto, setPronto] = useState(false)
  const hoje = useMemo(() => hojeBrasilia(), [])
  const [mesVisto, setMesVisto] = useState({ ano: hoje.ano, mes: hoje.mes })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const { data, error } = await supabase.rpc('club_aniversarios_lista')
    if (error) { setFalhou(true); return }
    setDados(data as ListaAniversarios)
  }, [])

  useEffect(() => { if (uid) carregar() }, [uid, carregar])

  const fechar = useCallback(() => setFolha(null), [])
  const fecharDia = useCallback(() => setDiaAberto(null), [])
  const proximos = useMemo(() => ordenarProximos(dados?.lista || [], hoje), [dados, hoje])
  const eu = dados?.lista.find(p => p.eu) || null

  if (uid === undefined) return <Casca logado={false} onEntrar={() => {}}><div className="as-center"><span className="as-meta">Abrindo...</span></div></Casca>

  if (uid === null) {
    return (
      <Casca logado={false} onEntrar={() => openLogin({ next: ROTA, cta: 'Entrar no Club' })}>
        <div className="as-center">
          <div className="as-verso tilt" aria-hidden="true"><Ico n="star" s={28} /></div>
          <h1 className="as-h2">Aniversariantes do Club</h1>
          <p className="as-p">Entre para ver quem faz aniversário.</p>
          <button type="button" className="as-btn pri cta" style={{ maxWidth: 320 }} onClick={() => openLogin({ next: ROTA, cta: 'Entrar no Club' })}>Entrar</button>
          <Link href={`/cadastro?next=${encodeURIComponent(ROTA)}`} className="as-btn" style={{ maxWidth: 320 }}>Criar conta</Link>
        </div>
      </Casca>
    )
  }

  if (falhou && !dados) {
    return (
      <Casca logado onEntrar={() => {}}>
        <h1 className="as-h2">Aniversariantes do Club</h1>
        <div className="as-erro" role="alert">Não conseguimos carregar a lista.</div>
        <button type="button" className="as-btn" onClick={carregar}>Tentar de novo</button>
      </Casca>
    )
  }

  if (!dados) return <Casca logado onEntrar={() => {}}><div className="as-center"><span className="as-meta">Abrindo a lista...</span></div></Casca>

  const hojeLista = proximos.filter(p => p.emDias === 0)
  const destaque = hojeLista.length ? [] : proximos.slice(0, 1).filter(p => !p.eu)
  const resto = proximos.filter(p => p.emDias !== 0 && !destaque.includes(p))
  const semana = resto.filter(p => p.emDias <= 7)
  const depois = resto.filter(p => p.emDias > 7)
  const noMes = (d: number) => dados.lista.filter(p => p.mes === mesVisto.mes && diaNoAno(p.dia, p.mes, mesVisto.ano) === d)
  const doMes = dados.lista.filter(p => p.mes === mesVisto.mes)
    .sort((a, b) => diaNoAno(a.dia, a.mes, mesVisto.ano) - diaNoAno(b.dia, b.mes, mesVisto.ano))
  const trocarMes = (delta: number) => setMesVisto(m => {
    const t = m.mes - 1 + delta
    return { ano: m.ano + Math.floor(t / 12), mes: ((t % 12) + 12) % 12 + 1 }
  })
  const abrirMinha = () => { setPronto(false); setFolha('form') }

  const colProximos = (
    <div className={`an-col${aba === 'proximos' ? ' on' : ''}`}>
      {hojeLista.map(p => <CartaHoje key={p.instagram} p={p} />)}
      {destaque.map(p => (
        <section key={p.instagram} className="as-frente an-carta">
          <Rosto p={p} tam={64} />
          <div className="at">@{p.instagram}</div>
          <div className="as-cnt an-em">{quandoTexto(p.emDias)}</div>
          <div className="as-meta">{String(p.diaExibido).padStart(2, '0')}/{String(p.mes).padStart(2, '0')}</div>
        </section>
      ))}
      {semana.length > 0 && <div className="as-k">Esta semana</div>}
      {semana.map(p => <Linha key={p.instagram} p={p} onMinha={abrirMinha} />)}
      {depois.length > 0 && <div className="as-k">Depois</div>}
      {depois.map(p => <Linha key={p.instagram} p={p} onMinha={abrirMinha} />)}
    </div>
  )

  const colCalendario = (
    <div className={`an-col an-col-cal${aba === 'calendario' ? ' on' : ''}`}>
      <div className="an-mes">
        <button type="button" className="as-ib" aria-label="Mês anterior" onClick={() => trocarMes(-1)}><svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
        <strong>{MESES[mesVisto.mes - 1]} de {mesVisto.ano}</strong>
        <button type="button" className="as-ib" aria-label="Próximo mês" onClick={() => trocarMes(1)}><Ico n="chev" /></button>
      </div>
      <Calendario ano={mesVisto.ano} mes={mesVisto.mes} hoje={hoje} noMes={noMes} onDia={setDiaAberto} />
      {doMes.length === 0
        ? <div className="as-center an-vazio"><span className="as-meta">Ninguém neste mês.</span></div>
        : <div className="as-mob-cal"><div className="as-k">Neste mês</div>{ordenarProximos(doMes, hoje).map(p => <Linha key={p.instagram} p={p} onMinha={abrirMinha} />)}</div>}
    </div>
  )

  return (
    <Casca logado onEntrar={() => {}}>
      <h1 className="as-h2">Aniversariantes do Club</h1>
      {pronto && <div className="as-note strong" role="status">Pronto, você está na lista.</div>}

      {!eu && dados.lista.length > 0 && (
        <section className="as-mis">
          <div className="as-eye">{dados.lista.length} {dados.lista.length === 1 ? 'criador' : 'criadores'} na lista</div>
          <h2 className="as-h3">Coloque sua data</h2>
          <p className="as-meta">Só dia e mês.</p>
          <button type="button" className="as-btn pri" onClick={abrirMinha}>Entrar na lista</button>
        </section>
      )}

      {dados.lista.length === 0 ? (
        <>
          <div className="as-center an-vazio"><span className="as-meta">Ninguém na lista ainda.</span></div>
          <button type="button" className="as-btn pri" onClick={abrirMinha}>Entrar na lista</button>
        </>
      ) : (
        <>
          <div className="an-abas" role="tablist">
            <button type="button" role="tab" aria-selected={aba === 'proximos'} className={aba === 'proximos' ? 'on' : ''} onClick={() => setAba('proximos')}>Próximos</button>
            <button type="button" role="tab" aria-selected={aba === 'calendario'} className={aba === 'calendario' ? 'on' : ''} onClick={() => setAba('calendario')}>Calendário</button>
          </div>
          <div className="an-grade">{colCalendario}{colProximos}</div>
        </>
      )}

      {folha === 'form' && uid && (
        <FolhaLista uid={uid} eu={eu} sugestao={dados.sugestao} onFechar={fechar} onSair={() => setFolha('sair')}
          onSalvo={d => { setDados(d); setFolha(null); setPronto(true) }} />
      )}
      {folha === 'sair' && eu && <FolhaSair eu={eu} onFechar={fechar} onSaiu={d => { setDados(d); setFolha(null); setPronto(false) }} />}
      {diaAberto !== null && (
        <Folha titulo={`${diaAberto} de ${MESES[mesVisto.mes - 1].toLowerCase()}`} onFechar={fecharDia}>
          {ordenarProximos(noMes(diaAberto), hoje).map(p => <Linha key={p.instagram} p={p} onMinha={() => { fecharDia(); abrirMinha() }} comBotao />)}
          <button type="button" className="as-btn" onClick={fecharDia}>Fechar</button>
        </Folha>
      )}
    </Casca>
  )
}

function Casca({ children, logado, onEntrar }: { children: React.ReactNode; logado: boolean; onEntrar: () => void }) {
  return (
    <div className="as an">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Aniversariantes</span>
          {logado
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm" style={{ minHeight: 44, width: 'auto' }} onClick={onEntrar}>Entrar</button>}
        </div>
      </header>
      <main className="bx-gutter"><div className="as-wrap as-bd">{children}</div></main>
      <style>{AS_CSS + AN_CSS}</style>
    </div>
  )
}

function CartaHoje({ p }: { p: Proximo }) {
  return (
    <section className="as-frente an-carta">
      <Rosto p={p} tam={64} />
      <div className="as-meta">{p.eu ? 'Hoje é o seu dia' : 'Hoje é dia de'}</div>
      <div className="at">@{p.instagram}</div>
      {p.eu
        ? <div className="as-meta">Feliz aniversário.</div>
        : <>
            <a className="as-btn pri" style={{ width: '100%' }} href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer">Dar parabéns</a>
            <div className="as-meta">Abre o Instagram</div>
          </>}
    </section>
  )
}

function Linha({ p, onMinha, comBotao }: { p: Proximo; onMinha: () => void; comBotao?: boolean }) {
  const corpo = (
    <>
      <span className="an-dt"><b>{String(p.diaExibido).padStart(2, '0')}</b><i>{MESES_CURTOS[p.mes - 1]}</i></span>
      <Rosto p={p} />
      <span className="an-nm"><b>@{p.instagram}</b><small>{p.eu ? 'Você' : quandoTexto(p.emDias)}</small></span>
    </>
  )
  if (p.eu) return <button type="button" className="an-linha me" onClick={onMinha}>{corpo}<Ico n="chev" className="arr" /></button>
  return (
    <div className="an-linha">
      {corpo}
      {comBotao && p.emDias === 0 && <a className="as-btn pri sm" href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer">Dar parabéns</a>}
    </div>
  )
}

function Calendario({ ano, mes, hoje, noMes, onDia }: {
  ano: number; mes: number; hoje: { ano: number; mes: number; dia: number }
  noMes: (d: number) => Aniversariante[]; onDia: (d: number) => void
}) {
  const inicio = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay()
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const ehHoje = (d: number) => hoje.ano === ano && hoje.mes === mes && hoje.dia === d
  return (
    <div className="an-cal">
      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} className="wd" aria-hidden="true">{d}</div>)}
      {Array.from({ length: inicio }, (_, i) => <div key={`v${i}`} />)}
      {Array.from({ length: total }, (_, i) => {
        const d = i + 1
        const quem = noMes(d)
        if (quem.length === 0) return <div key={d} className={`an-d${ehHoje(d) ? ' hoje' : ''}`}>{d}</div>
        return (
          <button key={d} type="button" className={`an-d tem${ehHoje(d) ? ' hoje' : ''}`} aria-label={`Dia ${d}: ${quem.map(q => `@${q.instagram}`).join(', ')}`} onClick={() => onDia(d)}>
            {d}
            <span className="rs"><Rosto p={quem[0]} tam={26} />{quem.length > 1 && <em>+{quem.length - 1}</em>}</span>
            <small className="nm">@{quem[0].instagram}</small>
          </button>
        )
      })}
    </div>
  )
}

function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const antes = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; antes?.focus() }
  }, [onFechar])
  return (
    <div className="as-sheet-bg" onClick={onFechar}>
      <div ref={ref} tabIndex={-1} className="as-sheet" role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <div className="as-handle" />
        <div className="as-sh"><h3 className="as-h3">{titulo}</h3><button type="button" className="as-ib" aria-label="Fechar" onClick={onFechar}><Ico n="x" s={20} /></button></div>
        {children}
      </div>
    </div>
  )
}

function FolhaLista({ uid, eu, sugestao, onFechar, onSair, onSalvo }: {
  uid: string; eu: Aniversariante | null; sugestao: ListaAniversarios['sugestao']
  onFechar: () => void; onSair: () => void; onSalvo: (d: ListaAniversarios) => void
}) {
  const [ig, setIg] = useState(eu?.instagram || sugestao?.instagram || '')
  const [dia, setDia] = useState(eu ? String(eu.dia) : '')
  const [mes, setMes] = useState(eu ? String(eu.mes) : '')
  const [aceite, setAceite] = useState(!!eu)
  const [fotoPath, setFotoPath] = useState<string | null>(eu?.foto_path || null)
  const [escolhida, setEscolhida] = useState<{ arquivo: File; url: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const entrada = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => { if (escolhida) URL.revokeObjectURL(escolhida.url) }, [escolhida])

  const igLimpo = limparInstagram(ig)
  const igOk = INSTAGRAM_RE.test(igLimpo)
  const dataFora = !!dia && !!mes && Number(dia) > diasDoMes(Number(mes))
  const dataOk = !!dia && !!mes && !dataFora
  const pessoa: Pessoa = { instagram: igLimpo || '?', foto_path: fotoPath, pokemon: eu?.pokemon ?? sugestao?.pokemon ?? null }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErro('')
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)) { setErro('Não conseguimos usar este arquivo. Escolha uma foto em JPG, PNG ou WebP.'); return }
    const comprimida = await comprimirImagem(f, { maxLado: 512 })
    setEscolhida({ arquivo: comprimida, url: URL.createObjectURL(comprimida) })
  }

  async function usarFoto() {
    if (!escolhida) return
    setOcupado(true); setErro('')
    const ext = escolhida.arquivo.type === 'image/png' ? 'png' : escolhida.arquivo.type === 'image/jpeg' ? 'jpg' : 'webp'
    const path = `${uid}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, escolhida.arquivo, { contentType: escolhida.arquivo.type, cacheControl: '31536000' })
    setOcupado(false)
    if (error) { setErro('Não conseguimos usar este arquivo. Escolha uma foto em JPG, PNG ou WebP.'); return }
    setFotoPath(path)
    setEscolhida(null)
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!igOk || !dataOk || !aceite) return
    setOcupado(true); setErro('')
    const { data, error } = await supabase.rpc('club_aniversario_salvar', {
      p_instagram: igLimpo, p_dia: Number(dia), p_mes: Number(mes), p_foto_path: fotoPath, p_aceite: aceite,
    })
    if (error) { setOcupado(false); setErro(erroAniversario(error.message)); return }
    // A foto trocada ou removida sai do armazenamento so depois de salvar.
    if (eu?.foto_path && eu.foto_path !== fotoPath) await supabase.storage.from(BUCKET).remove([eu.foto_path])
    setOcupado(false)
    onSalvo(data as ListaAniversarios)
  }

  if (escolhida) {
    return (
      <Folha titulo="Sua foto" onFechar={() => setEscolhida(null)}>
        <div className="as-frente an-carta">
          {/* Previa local (blob:) antes de subir: o otimizador nao alcanca. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={escolhida.url} alt="Foto escolhida" className="an-previa" />
          <div className="as-meta">Ela aparece redonda, ao lado do seu @.</div>
        </div>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="button" className="as-btn pri" disabled={ocupado} onClick={usarFoto}>{ocupado ? 'Enviando...' : 'Usar esta foto'}</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => entrada.current?.click()}>Escolher outra</button>
        <input ref={entrada} type="file" accept="image/*" hidden onChange={aoEscolher} />
      </Folha>
    )
  }

  return (
    <Folha titulo={eu ? 'Minha data' : 'Entrar na lista'} onFechar={onFechar}>
      <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="as-f">
          <span className="as-lb">Foto (opcional)</span>
          <div className="an-foto">
            <Rosto p={pessoa} tam={56} />
            <button type="button" className="as-btn sm" onClick={() => entrada.current?.click()}>{fotoPath ? 'Trocar foto' : 'Subir foto'}</button>
            {fotoPath && <button type="button" className="as-btn lnk sm" onClick={() => setFotoPath(null)}>Remover</button>}
            <input ref={entrada} type="file" accept="image/*" hidden onChange={aoEscolher} />
          </div>
          <span className="as-hint">Sem foto, aparece seu Pokémon ou a inicial do @.</span>
        </div>
        <label className="as-f">
          <span className="as-lb">Seu @ do Instagram</span>
          <div className="as-pre"><span>@</span><input className={`as-in${ig && !igOk ? ' err' : ''}`} value={ig} onChange={e => setIg(e.target.value)} autoCapitalize="none" autoCorrect="off" maxLength={60} /></div>
          <span className={`as-hint${ig && !igOk ? ' err' : ''}`}>{ig && !igOk ? 'Use letras, números, ponto ou sublinhado, sem espaço.' : 'É assim que você aparece.'}</span>
        </label>
        <div className="as-two">
          <label className="as-f">
            <span className="as-lb">Dia</span>
            <select className={`as-in${dataFora ? ' err' : ''}`} value={dia} onChange={e => setDia(e.target.value)}>
              <option value="">Dia</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
          <label className="as-f">
            <span className="as-lb">Mês</span>
            <select className={`as-in${dataFora ? ' err' : ''}`} value={mes} onChange={e => setMes(e.target.value)}>
              <option value="">Mês</option>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
        <span className={`as-hint${dataFora ? ' err' : ''}`} style={{ marginTop: -4 }}>{dataFora ? `${MESES[Number(mes) - 1]} tem ${diasDoMes(Number(mes))} dias.` : 'O ano a gente nem pede.'}</span>
        <label className="as-chk">
          <input type="checkbox" checked={aceite} onChange={e => setAceite(e.target.checked)} />
          <span>Quem tem conta na Bynx vê sua foto, seu @, o dia e o mês.</span>
        </label>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="submit" className="as-btn pri" disabled={ocupado || !igOk || !dataOk || !aceite}>{ocupado ? 'Salvando...' : 'Salvar'}</button>
        {eu && <button type="button" className="as-btn lnk" onClick={onSair}>Sair da lista</button>}
      </form>
    </Folha>
  )
}

function FolhaSair({ eu, onFechar, onSaiu }: { eu: Aniversariante; onFechar: () => void; onSaiu: (d: ListaAniversarios) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function sair() {
    setOcupado(true); setErro('')
    const { data, error } = await supabase.rpc('club_aniversario_sair')
    if (error) { setOcupado(false); setErro('Não conseguimos tirar você da lista. Tente de novo.'); return }
    if (eu.foto_path) await supabase.storage.from(BUCKET).remove([eu.foto_path])
    setOcupado(false)
    onSaiu(data as ListaAniversarios)
  }
  return (
    <Folha titulo="Sair da lista" onFechar={onFechar}>
      <p className="as-meta">Sua foto, seu @ e sua data saem do calendário.</p>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="button" className="as-btn pri" disabled={ocupado} onClick={sair}>Sair</button>
      <button type="button" className="as-btn" disabled={ocupado} onClick={onFechar}>Ficar</button>
    </Folha>
  )
}

const AN_CSS = `
.an-abas{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--bx-border-2);border-radius:10px;overflow:hidden}
.an-abas button{min-height:44px;background:transparent;border:0;color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease}
.an-abas button.on{background:var(--bx-surface-3);color:var(--bx-text);box-shadow:inset 0 -2px 0 var(--ac-1)}
.an-col{display:none;flex-direction:column;gap:8px;min-width:0}
.an-col.on{display:flex}
.an-grade{display:flex;flex-direction:column;gap:12px;min-width:0}
.an-carta{gap:8px;padding:18px 16px}
.an-carta .at{margin-top:0}
.an-em{font-size:22px}
.an-rosto img{object-fit:cover}
.an-linha{display:flex;align-items:center;gap:10px;min-height:64px;width:100%;padding:6px 0;background:transparent;border:0;border-bottom:1px solid var(--bx-border);color:var(--bx-text);font:inherit;text-align:left}
.an-linha.me{padding:6px 10px;border:1px solid rgba(var(--ac-1-rgb),.4);border-radius:12px;background:rgba(var(--ac-1-rgb),.06);cursor:pointer;margin-top:4px}
.an-linha .as-btn{width:auto;flex:none}
.an-linha .arr{color:var(--bx-text-3)}
.an-dt{width:44px;flex:none;text-align:center;line-height:1.05;display:flex;flex-direction:column}
.an-dt b{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.an-dt i{font-style:normal;font-size:11px;font-weight:800;color:var(--bx-text-2);text-transform:uppercase}
.an-nm{flex:1;min-width:0;display:flex;flex-direction:column}
.an-nm b{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-nm small{font-size:12.5px;color:var(--bx-text-2)}
.an-mes{display:flex;align-items:center;justify-content:space-between}
.an-mes strong{font-size:15px;font-weight:700}
.an-cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.an-cal .wd{font-size:11px;font-weight:800;color:var(--bx-text-3);text-align:center;padding:2px 0}
.an-d{min-height:54px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 0 2px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--bx-text-3);font:inherit;font-size:11.5px;font-weight:600;font-variant-numeric:tabular-nums;min-width:0}
.an-d.tem{background:var(--bx-surface);border-color:var(--bx-border);color:var(--bx-text);cursor:pointer;transition:background .15s ease,transform .15s ease}
.an-d.tem:hover{background:var(--bx-surface-2);transform:translateY(-2px)}
.an-d.hoje{border:2px solid var(--ac-1);background:rgba(var(--ac-1-rgb),.10);color:var(--ac-1);font-weight:800}
.an-d .rs{display:inline-flex;align-items:center;gap:1px}
.an-d .rs em{font-style:normal;font-size:10px;color:var(--bx-text-2)}
.an-d .nm{display:none}
.an-vazio{padding:24px 0;border:1px dashed var(--bx-border-2);border-radius:12px}
.an-foto{display:flex;align-items:center;gap:10px}
.an-foto .as-btn{width:auto}
.an-previa{width:128px;height:128px;border-radius:50%;object-fit:cover;display:block}
.an .as-center .as-btn{width:100%}
.an select.as-in{appearance:auto}
@media (prefers-reduced-motion:reduce){.an-d.tem:hover{transform:none}}
@media (min-width:1024px){
  .an-abas{display:none}
  .an-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:24px;align-items:start}
  .an-col{display:flex}
  .as-mob-cal{display:none}
  .an-cal{gap:6px}
  .an-d{min-height:88px;font-size:12px}
  .an-d .nm{display:block;max-width:100%;padding:0 4px;font-size:11.5px;font-weight:500;color:var(--bx-text-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
}
`
