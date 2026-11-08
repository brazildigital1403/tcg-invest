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
import { diaNoAno, erroAniversario, instagramUrl, ordenarProximos, type Aniversariante, type ListaAniversarios, type Proximo } from '@/lib/pcc/aniversarios'
import { MESES, MESES_CURTOS, diasDoMes, hojeBrasilia, quandoTexto, trocarMes } from '@/lib/pcc/datas'
import { ANIVERSARIANTES, ANIVERSARIANTES_ORGANIZAR, CLUB } from '@/lib/pcc/rotas'
import { AS_CSS, Ico, SeloFrente, VoltarClub } from '../amigo-secreto/estilo'
import { Abas, BlocoData, CAL_CSS, CalendarioMes, Folha, NavMes } from '../_comum/calendario'

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
  const [organiza, setOrganiza] = useState(false)
  const hoje = useMemo(() => hojeBrasilia(), [])
  const [mesVisto, setMesVisto] = useState({ ano: hoje.ano, mes: hoje.mes })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    setFalhou(false)
    const [{ data, error }, papeis] = await Promise.all([supabase.rpc('club_aniversarios_lista'), supabase.rpc('club_meus_papeis')])
    if (error) { setFalhou(true); return }
    setDados(data as ListaAniversarios)
    // Organizador do Club (08/11/2026): botao para remover foto impropria.
    setOrganiza(Array.isArray(papeis.data) && papeis.data.includes('aniversariantes'))
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
          <SeloFrente frente="aniversariantes" />
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
  const abrirMinha = () => { setPronto(false); setFolha('form') }

  const colProximos = (
    <div className={`pc-col${aba === 'proximos' ? ' on' : ''}`}>
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
    <div className={`pc-col${aba === 'calendario' ? ' on' : ''}`}>
      <NavMes ano={mesVisto.ano} mes={mesVisto.mes} onTrocar={delta => setMesVisto(m => trocarMes(m, delta))} />
      <CalendarioMes ano={mesVisto.ano} mes={mesVisto.mes} hoje={hoje} itensDoDia={noMes} onDia={setDiaAberto}
        marca={quem => <Rosto p={quem[0]} tam={26} />}
        nome={quem => `@${quem[0].instagram}`}
        rotulo={(d, quem) => `Dia ${d}: ${quem.map(q => `@${q.instagram}`).join(', ')}`} />
      {doMes.length === 0
        ? <div className="as-center pc-vazio"><span className="as-meta">Ninguém neste mês.</span></div>
        : <div className="as-mob-cal"><div className="as-k">Neste mês</div>{ordenarProximos(doMes, hoje).map(p => <Linha key={p.instagram} p={p} onMinha={abrirMinha} />)}</div>}
    </div>
  )

  return (
    <Casca logado onEntrar={() => {}}>
      <div className="an-topo">
        <h1 className="as-h2">Aniversariantes do Club</h1>
        {organiza && <Link href={ANIVERSARIANTES_ORGANIZAR} className="as-btn sm">Organizar</Link>}
      </div>
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
          <div className="as-center pc-vazio"><span className="as-meta">Ninguém na lista ainda.</span></div>
          <button type="button" className="as-btn pri" onClick={abrirMinha}>Entrar na lista</button>
        </>
      ) : (
        <>
          <Abas valor={aba} onTrocar={setAba} opcoes={[{ id: 'proximos', rotulo: 'Próximos' }, { id: 'calendario', rotulo: 'Calendário' }]} />
          <div className="pc-grade">{colCalendario}{colProximos}</div>
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
      <style>{AS_CSS + CAL_CSS + AN_CSS}</style>
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
      <BlocoData dia={String(p.diaExibido).padStart(2, '0')} mes={MESES_CURTOS[p.mes - 1]} />
      <Rosto p={p} />
      <span className="pc-nm"><b>@{p.instagram}</b><small>{p.eu ? 'Você' : quandoTexto(p.emDias)}</small></span>
    </>
  )
  if (p.eu) return <button type="button" className="pc-linha me" onClick={onMinha}>{corpo}<Ico n="chev" className="arr" /></button>
  return (
    <div className="pc-linha">
      {corpo}
      {comBotao && p.emDias === 0 && <a className="as-btn pri sm" href={instagramUrl(p.instagram)} target="_blank" rel="noopener noreferrer">Dar parabéns</a>}
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
.an-carta{gap:8px;padding:18px 16px}
.an-carta .at{margin-top:0}
.an-em{font-size:22px}
.an-rosto img{object-fit:cover}
.pc-linha.me{padding:6px 10px;border:1px solid rgba(var(--ac-1-rgb),.4);border-radius:12px;background:rgba(var(--ac-1-rgb),.06);cursor:pointer;margin-top:4px}
.an-foto{display:flex;align-items:center;gap:10px}
.an-foto .as-btn{width:auto}
.an-previa{width:128px;height:128px;border-radius:50%;object-fit:cover;display:block}
.an .as-center .as-btn{width:100%}
.an-topo{display:flex;align-items:center;justify-content:space-between;gap:12px}
.an-topo .as-btn{width:auto;flex:none}
.an select.as-in{appearance:auto}
`
