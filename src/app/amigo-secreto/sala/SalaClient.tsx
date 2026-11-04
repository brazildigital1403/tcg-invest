'use client'

// Sala do Amigo Secreto (UI 2 aprovada em 04/11/2026). Uma URL, um cartao de
// missao que troca de estado, folhas de baixo e o mural com remetente
// sempre anonimo. O navegador nunca le as tabelas: tudo vem das funcoes
// amigo_secreto_* (supabase/migrations/20261104100000_amigo_secreto.sql),
// que devolvem so o que o proprio usuario pode ver.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  AMIGO_SECRETO_SLUG, DESEJO_MAX_CHARS, INSTAGRAM_RE, MENSAGENS_PRONTAS, MURAL_MAX_CHARS, MURAL_MAX_DIA,
  POKEMON_PERFIL, brl, cepBonito, dataCurta, dataHora, diasAte, erroAmigoSecreto, limparInstagram, rotuloDia,
  spritePokemon, type EdicaoPublica, type Eu, type MensagemMural, type MinhaSala, type Tirou,
} from '@/lib/amigoSecreto'
import { AS_CSS, Avatar, Ico, LOGO_PCC } from '../estilo'

const SALA = '/amigo-secreto/sala'
const SLUG = AMIGO_SECRETO_SLUG
const CHAVE_ABRI = `bynx_as_abri_${SLUG}`

type Folha = 'dados' | 'endereco' | 'desejo' | 'pokemon' | 'tirou' | 'rastreio' | 'escrever' | null
type Json = Record<string, unknown>

function lerAbri(): boolean { try { return localStorage.getItem(CHAVE_ABRI) === '1' } catch { return false } }
function gravarAbri() { try { localStorage.setItem(CHAVE_ABRI, '1') } catch {} }

export default function SalaClient() {
  const { openLogin } = useAuthModal()
  const [sessao, setSessao] = useState<{ uid: string; nome: string } | null | undefined>(undefined)
  const [edicao, setEdicao] = useState<EdicaoPublica | null>(null)
  const [sala, setSala] = useState<MinhaSala | null>(null)
  const [feed, setFeed] = useState<MensagemMural[]>([])
  const [folha, setFolha] = useState<Folha>(null)
  const [erro, setErro] = useState('')
  const [abri, setAbri] = useState(lerAbri)
  const [ocupado, setOcupado] = useState(false)
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      setSessao(u ? { uid: u.id, nome: String(u.user_metadata?.name || '') } : null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      const u = s?.user
      setSessao(u ? { uid: u.id, nome: String(u.user_metadata?.name || '') } : null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    const [e, m, f] = await Promise.all([
      supabase.rpc('amigo_secreto_edicao_publica', { p_slug: SLUG }),
      supabase.rpc('amigo_secreto_meu', { p_slug: SLUG }),
      supabase.rpc('amigo_secreto_feed', { p_slug: SLUG, p_limit: 80 }),
    ])
    const ed = (e.data as EdicaoPublica | null) ?? null
    setEdicao(ed)
    setAberto(!!ed && ed.estado === 'inscricoes' && Date.parse(ed.inscricoes_ate) > Date.now())
    if (m.error) setErro(erroAmigoSecreto(m.error.message))
    else setSala(m.data as MinhaSala)
    if (!f.error) setFeed((f.data as MensagemMural[]) || [])
  }, [])

  useEffect(() => { if (sessao) carregar() }, [sessao, carregar])

  /** Chama uma funcao do banco e, se ela devolver a sala, atualiza. */
  async function chamar(fn: string, args: Json): Promise<boolean> {
    setErro(''); setOcupado(true)
    try {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) { setErro(erroAmigoSecreto(error.message)); return false }
      if (data && typeof data === 'object' && 'inscrito' in (data as Json)) setSala(data as MinhaSala)
      return true
    } finally { setOcupado(false) }
  }

  const fechar = useCallback(() => setFolha(null), [])

  // ── Estados de entrada ────────────────────────────────────────────────────

  if (sessao === undefined || (sessao && !sala && !erro)) {
    return <Casca><div className="as-center"><span className="as-meta">Abrindo a sala...</span></div></Casca>
  }

  if (sessao === null) {
    return (
      <Casca>
        <div className="as-center">
          <div className="as-verso tilt" aria-hidden="true"><Ico n="gift" s={28} /></div>
          <h2 className="as-h2">Entre para abrir a sala</h2>
          <p className="as-p">A sala do Amigo Secreto é só de quem está dentro.</p>
          <button type="button" className="as-btn pri cta" style={{ maxWidth: 320 }} onClick={() => openLogin({ next: SALA, cta: 'Entrar para abrir a sala' })}>Entrar na minha conta</button>
          <Link href="/amigo-secreto" className="as-btn lnk">Ainda não participo</Link>
        </div>
      </Casca>
    )
  }

  if (!sala) {
    return <Casca><div className="as-center"><div className="as-erro" role="alert">{erro}</div><button type="button" className="as-btn" style={{ maxWidth: 320 }} onClick={carregar}>Tentar de novo</button></div></Casca>
  }

  const estado = sala.estado
  const inscricoesAbertas = estado === 'inscricoes' && aberto
  const tirou: Tirou | null = sala.inscrito ? sala.tirou : null
  const eu: Eu | null = sala.inscrito ? sala.eu : null
  const chipFase = estado === 'inscricoes' ? (inscricoesAbertas ? 'Inscrições abertas' : 'Inscrições encerradas')
    : estado === 'sorteado' ? 'Sorteio feito' : estado === 'entregas' ? 'Entregas' : 'Encerrado'

  // ── Nao inscrito ──────────────────────────────────────────────────────────

  if (!sala.inscrito) {
    return (
      <Casca>
        <Cabeca chip={chipFase} n={edicao?.participantes} />
        {inscricoesAbertas ? (
          <div className="as-mis">
            <div className="as-eye"><Ico n="star" s={14} />Sua missão agora</div>
            <h3 className="as-h3">Entrar na sala com o seu @</h3>
            <p className="as-meta">No Poké Creators Club você é o seu @. É assim que os outros criadores vão ver você na sala.</p>
            <button type="button" className="as-btn pri" onClick={() => setFolha('dados')}>Começar: meu @ e WhatsApp</button>
          </div>
        ) : (
          <div className="as-mis">
            <div className="as-eye"><Ico n="alert" s={14} />Inscrições encerradas</div>
            <h3 className="as-h3">Esta edição já fechou</h3>
            <p className="as-meta">{estado === 'inscricoes' ? 'O prazo de inscrição passou.' : 'O sorteio já aconteceu e a sala está fechada para quem não entrou.'} Fique de olho no grupo para a próxima.</p>
            <Link href="/amigo-secreto" className="as-btn">Voltar</Link>
          </div>
        )}
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <QuemEntrou edicao={edicao} />
        {folha === 'dados' && (
          <FolhaDados eu={null} nome={sessao.nome} ocupado={ocupado} onFechar={fechar}
            onSalvar={async d => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d })) { setFolha('endereco'); carregar() } }} />
        )}
      </Casca>
    )
  }

  // ── Inscrito ──────────────────────────────────────────────────────────────

  const temEndereco = !!(eu!.cep && eu!.numero)
  const temDesejo = eu!.me_surpreenda || !!(eu!.desejo && eu!.desejo.trim())
  const energiaPerfil = [true, temEndereco, temDesejo]
  const energiaEntrega = [abri, !!eu!.postado_em, !!eu!.recebido_em]
  const revelado = sala.revelado

  return (
    <Casca>
      <Cabeca chip={chipFase} n={edicao?.participantes} />

      {estado === 'inscricoes' && (
        <div className="as-meta">Sorteio em <strong>{dataHora(sala.sorteio_em)}</strong>. {diasAte(sala.sorteio_em) === 0 ? 'É hoje.' : `Faltam ${diasAte(sala.sorteio_em)} dias.`}</div>
      )}
      {(estado === 'sorteado' || estado === 'entregas') && (
        <div className="as-meta">Postagem até <strong>{dataCurta(sala.postar_ate)}</strong>. {diasAte(sala.postar_ate) === 0 ? 'Último dia.' : `Faltam ${diasAte(sala.postar_ate)} dias.`}</div>
      )}

      {erro && <div className="as-erro" role="alert">{erro}</div>}

      {/* ── Cartao de missao ── */}
      {estado === 'inscricoes' ? (
        <div className="as-mis">
          <div className="as-eye"><Ico n="star" s={14} />Sua missão agora</div>
          <h3 className="as-h3">{eu!.perfil_completo ? 'Você está no sorteio' : 'Completar o perfil para entrar no sorteio'}</h3>
          <Energia rotulo="Energia do perfil" segs={energiaPerfil} />
          <div>
            <button type="button" className="as-row" onClick={() => setFolha('dados')}><span className="l"><span className="as-st ok"><Ico n="check" s={13} /></span>Meu @ e WhatsApp</span><Ico n="chev" className="arr" /></button>
            <button type="button" className="as-row" onClick={() => setFolha('endereco')}><span className="l"><span className={`as-st${temEndereco ? ' ok' : ''}`}>{temEndereco && <Ico n="check" s={13} />}</span>Endereço de entrega</span><Ico n="chev" className="arr" /></button>
            <button type="button" className="as-row" onClick={() => setFolha('desejo')}><span className="l"><span className={`as-st${temDesejo ? ' ok' : ''}`}>{temDesejo && <Ico n="check" s={13} />}</span>O que eu gostaria de ganhar</span><Ico n="chev" className="arr" /></button>
            <button type="button" className="as-row" onClick={() => setFolha('pokemon')}><span className="l"><span className={`as-st${eu!.pokemon ? ' ok' : ' opt'}`}>{eu!.pokemon && <Ico n="check" s={13} />}</span><span>Foto de perfil Pokémon <span className="as-meta">(opcional)</span></span></span><Ico n="chev" className="arr" /></button>
          </div>
          {!eu!.perfil_completo && (
            <button type="button" className="as-btn pri" onClick={() => setFolha(!temEndereco ? 'endereco' : 'desejo')}>
              {!temEndereco ? 'Continuar: endereço de entrega' : 'Continuar: o que eu gostaria de ganhar'}
            </button>
          )}
          {eu!.perfil_completo && !inscricoesAbertas && <p className="as-meta">As inscrições encerraram. O sorteio sai em {dataHora(sala.sorteio_em)}.</p>}
        </div>
      ) : (
        <div className="as-mis">
          <div className="as-eye"><Ico n="star" s={14} />{estado === 'encerrado' ? 'Edição encerrada' : 'Sua missão agora'}</div>
          <h3 className="as-h3">{estado === 'encerrado' ? 'Obrigado por participar' : eu!.recebido_em ? 'Presente recebido' : eu!.postado_em ? 'Presente a caminho' : 'Você tirou alguém'}</h3>
          {estado !== 'encerrado' && <Energia rotulo="Energia da entrega" segs={energiaEntrega} />}

          <div className="as-lane envio first">
            {tirou ? (
              <>
                <button type="button" className="as-verso tilt" aria-label="Ver quem eu tirei" onClick={() => { gravarAbri(); setAbri(true); setFolha('tirou') }}><Ico n="gift" s={28} /></button>
                <div className="tx">
                  <div className="as-k">Eu envio</div>
                  {eu!.postado_em ? (
                    <>
                      <div style={{ fontSize: 13.5 }}>Postado em <strong>{dataCurta(eu!.postado_em)}</strong>{eu!.rastreio ? <> · <span style={{ fontFamily: 'monospace' }}>{eu!.rastreio}</span></> : ''}</div>
                      <button type="button" className="as-btn sm" onClick={() => setFolha('rastreio')}>{eu!.rastreio ? 'Editar rastreio' : 'Informar rastreio'}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="as-btn pri sm" onClick={() => { gravarAbri(); setAbri(true); setFolha('tirou') }}><Ico n="eye" s={16} />Ver quem eu tirei</button>
                      <div className="as-meta">O @, o desejo e o endereço aparecem só para você, dentro do cartão.</div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="tx"><div className="as-k">Eu envio</div><div className="as-meta">O sorteio ainda está sendo preparado.</div></div>
            )}
          </div>

          <div className="as-lane">
            <div className="as-k">Eu recebo</div>
            {sala.recebo?.revelado ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar instagram={sala.recebo.revelado.instagram} pokemon={sala.recebo.revelado.pokemon} tam={36} />
                <div style={{ fontSize: 14 }}>Quem mandou o seu presente: <strong>@{sala.recebo.revelado.instagram}</strong></div>
              </div>
            ) : sala.recebo?.postado_em ? (
              <>
                <div style={{ fontSize: 13.5 }}>Seu amigo secreto postou em <strong>{dataCurta(sala.recebo.postado_em)}</strong>.</div>
                {sala.recebo.rastreio ? (
                  <div className="as-two">
                    <div className="as-addr" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sala.recebo.rastreio}</div>
                    <a className="as-btn sm" style={{ flex: '0 0 auto' }} href={`https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(sala.recebo.rastreio)}`} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={16} />Rastrear</a>
                  </div>
                ) : <div className="as-meta">Sem código de rastreio: foi entregue em mãos ou sem rastreio.</div>}
                <div className="as-meta">A consulta nos Correios mostra a cidade de postagem. Se quiser manter a surpresa, não consulte.</div>
              </>
            ) : (
              <div className="as-meta">Alguém tirou você. Quando essa pessoa postar, o código de rastreio aparece aqui.</div>
            )}
            {eu!.recebido_em ? (
              <div className="as-meta">Você confirmou o recebimento em {dataCurta(eu!.recebido_em)}.</div>
            ) : estado !== 'encerrado' && (
              <button type="button" className="as-btn" disabled={ocupado} onClick={async () => { if (window.confirm('Confirmar que o seu presente chegou?')) await chamar('amigo_secreto_recebi', { p_slug: SLUG }) }}><Ico n="box" s={16} />Meu presente chegou</button>
            )}
          </div>

          <div className="as-lane">
            <div className="as-k">Revelação final{revelado ? '' : ` em ${dataCurta(sala.revelacao_em)}`}</div>
            <label className="as-chk" style={{ minHeight: 0, padding: 0 }}>
              <input type="checkbox" checked={eu!.quer_revelar} disabled={ocupado} onChange={e => chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: { quer_revelar: e.target.checked } })} />
              <span>Quero revelar quem eu tirei na revelação final. Só aparece se os dois lados aceitarem.</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Mural ── */}
      <Mural feed={feed} estado={estado} eu={eu!} tirou={tirou} edicao={edicao} hoje={sala.mensagens_hoje} ligado={sala.feed_ligado} onEscrever={() => setFolha('escrever')} />

      {/* ── Folhas ── */}
      {folha === 'dados' && <FolhaDados eu={eu} nome={sessao.nome} ocupado={ocupado} onFechar={fechar} onSalvar={async d => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d })) { setFolha(temEndereco ? null : 'endereco'); carregar() } }} />}
      {folha === 'endereco' && <FolhaEndereco eu={eu!} nome={sessao.nome} ocupado={ocupado} travado={!!tirou} onFechar={fechar} onSalvar={async d => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d })) { setFolha(temDesejo ? null : 'desejo') } }} />}
      {folha === 'desejo' && <FolhaDesejo eu={eu!} teto={sala.teto_cents} ocupado={ocupado} onFechar={fechar} onSalvar={async d => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d })) { setFolha(eu!.pokemon ? null : 'pokemon') } }} />}
      {folha === 'pokemon' && <FolhaPokemon eu={eu!} ocupado={ocupado} onFechar={fechar} onSalvar={async p => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: { pokemon: p || '' } })) { setFolha(null); carregar() } }} />}
      {folha === 'tirou' && tirou && <FolhaTirou tirou={tirou} postarAte={sala.postar_ate} postado={!!eu!.postado_em} onFechar={fechar} onPostei={() => setFolha('rastreio')} />}
      {folha === 'rastreio' && tirou && <FolhaRastreio eu={eu!} tirou={tirou} ocupado={ocupado} onFechar={fechar} onSalvar={async r => { if (await chamar('amigo_secreto_postei', { p_slug: SLUG, p_rastreio: r })) setFolha(null) }} />}
      {folha === 'escrever' && tirou && <FolhaEscrever tirou={tirou} hoje={sala.mensagens_hoje} ocupado={ocupado} onFechar={fechar} onEnviar={async (texto, pronta) => { if (await chamar('amigo_secreto_enviar_mensagem', { p_slug: SLUG, p_texto: texto, p_pronta: pronta })) { setFolha(null); carregar() } }} />}
    </Casca>
  )
}

// ── Blocos ──────────────────────────────────────────────────────────────────

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="as">
      <header className="as-top bx-gutter">
        <div className="as-in">
          <Link href="/amigo-secreto" aria-label="Amigo Secreto"><Image src={LOGO_PCC} alt="Poké Creators Club" width={438} height={218} className="as-logo" priority /></Link>
          <span className="t">Amigo Secreto</span>
          <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
        </div>
      </header>
      <main className="bx-gutter"><div className="as-in as-bd">{children}</div></main>
      <style>{AS_CSS}</style>
    </div>
  )
}

function Cabeca({ chip, n }: { chip: string; n?: number }) {
  return (
    <>
      <div className="as-chips">
        <span className="as-chip fill">{chip}</span>
        {typeof n === 'number' && <span className="as-chip"><Ico n="users" s={14} />{n} {n === 1 ? 'criador' : 'criadores'}</span>}
      </div>
      <h2 className="as-h2">Sala do Amigo Secreto</h2>
    </>
  )
}

function Energia({ rotulo, segs }: { rotulo: string; segs: boolean[] }) {
  const n = segs.filter(Boolean).length
  return (
    <div className="as-hp">
      <div className="lb"><span>{rotulo}</span><span>{n} de {segs.length}</span></div>
      <div className="seg">{segs.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}</div>
    </div>
  )
}

function QuemEntrou({ edicao }: { edicao: EdicaoPublica | null }) {
  if (!edicao) return null
  return (
    <>
      <div className="as-fh"><h3 className="as-h3">Mural</h3><span className="as-meta">abre depois do sorteio</span></div>
      <div className="as-feed">
        <div className="as-fi sys"><div className="bub">Depois do sorteio, cada pessoa escreve recados anônimos para quem tirou. Até lá, veja quem está na sala.</div></div>
        {edicao.lista.map(p => (
          <div key={p.instagram} className="as-fi"><Avatar instagram={p.instagram} pokemon={p.pokemon} /><div className="bub"><div className="who">@{p.instagram} entrou na sala</div></div></div>
        ))}
      </div>
    </>
  )
}

function Mural({ feed, estado, eu, tirou, edicao, hoje, ligado, onEscrever }: {
  feed: MensagemMural[]; estado: string; eu: Eu; tirou: Tirou | null; edicao: EdicaoPublica | null; hoje: number; ligado: boolean; onEscrever: () => void
}) {
  const antes = estado === 'inscricoes'
  const grupos = useMemo(() => {
    const m = new Map<string, MensagemMural[]>()
    for (const x of feed) { if (!m.has(x.dia)) m.set(x.dia, []); m.get(x.dia)!.push(x) }
    return [...m.entries()]
  }, [feed])
  const paraMim = feed.filter(x => x.para_mim).length

  if (antes) return <QuemEntrou edicao={edicao} />

  return (
    <>
      <div className="as-fh"><h3 className="as-h3">Mural</h3><span className="as-meta">{paraMim > 0 ? `${paraMim} para você` : `${feed.length} ${feed.length === 1 ? 'recado' : 'recados'}`}</span></div>
      <div className="as-feed">
        {edicao && <div className="as-fi sys"><div className="bub">Sorteio realizado em {dataHora(edicao.sorteio_em)}. {edicao.participantes} pares formados. O mural está aberto.</div></div>}
        {feed.length === 0 && <div className="as-fi sys"><div className="bub">Ninguém escreveu ainda. Seja o primeiro a deixar um recado para quem você tirou.</div></div>}
        {grupos.map(([dia, lista]) => (
          <div key={dia} className="as-feed">
            <div className="as-dia">{rotuloDia(dia)}</div>
            {lista.map(m => (
              <div key={m.id} className={`as-fi${m.para_mim ? ' me' : ''}`}>
                <span className="as-av" style={{ width: 32, height: 32, fontSize: 13 }}>?</span>
                <div className="bub">
                  <div className="who"><span style={{ color: 'inherit', fontWeight: 700 }}>{m.para_mim ? `Para você, @${m.para.instagram}` : `Para @${m.para.instagram}`}</span></div>
                  <div className="tx">{m.texto}</div>
                  <div className="sig">Seu amigo secreto</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {tirou && ligado && estado !== 'encerrado' && (
        <div className="as-comp">
          <button type="button" className="fake live" onClick={onEscrever}>Escrever para @{tirou.instagram}</button>
          <span className="cnt-d">{hoje} de {MURAL_MAX_DIA} hoje</span>
          <button type="button" className="as-btn pri sm" onClick={onEscrever} disabled={hoje >= MURAL_MAX_DIA}>Escrever</button>
        </div>
      )}
      {!ligado && <div className="as-note">O mural está fechado no momento.</div>}
      {!tirou && eu && <div className="as-note">Seu par ainda não foi definido.</div>}
    </>
  )
}

// ── Folhas ──────────────────────────────────────────────────────────────────

function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onFechar])
  return (
    <div className="as-sheet-bg" onClick={onFechar}>
      <div className="as-sheet" role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <div className="as-handle" />
        <div className="as-sh"><h3 className="as-h3">{titulo}</h3><button type="button" className="as-ib" onClick={onFechar} aria-label="Fechar"><Ico n="x" s={22} /></button></div>
        {children}
      </div>
    </div>
  )
}

function FolhaDados({ eu, nome, ocupado, onFechar, onSalvar }: { eu: Eu | null; nome: string; ocupado: boolean; onFechar: () => void; onSalvar: (d: Json) => void }) {
  const [ig, setIg] = useState(eu?.instagram || '')
  const [whats, setWhats] = useState(eu?.whatsapp || '')
  const [erro, setErro] = useState('')
  const igLimpo = limparInstagram(ig)
  const igOk = INSTAGRAM_RE.test(igLimpo)
  return (
    <Folha titulo="Meu @ e WhatsApp" onFechar={onFechar}>
      <form onSubmit={e => { e.preventDefault(); if (!igOk) { setErro('Confira o seu @: só letras, números, ponto e sublinhado, sem espaço.'); return } onSalvar({ instagram: igLimpo, whatsapp: whats.trim(), nome_completo: eu?.nome_completo || nome }) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="as-f">
          <span className="as-lb">Seu @ do Instagram (obrigatório)</span>
          <div className={`as-pre${erro ? ' err' : ''}`}><span>@</span><input className="as-in" value={ig} onChange={e => { setIg(e.target.value); setErro('') }} autoCapitalize="none" autoCorrect="off" inputMode="text" placeholder="seuperfil" required /></div>
          <span className={`as-hint${erro ? ' err' : ''}`}>{erro || 'É como você aparece na sala, no mural e na revelação. Letras, números, ponto e sublinhado, sem espaço.'}</span>
          {igOk && <a className="as-btn lnk" style={{ alignSelf: 'flex-start', paddingLeft: 0, width: 'auto' }} href={`https://instagram.com/${igLimpo}`} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={14} />Conferir @{igLimpo} no Instagram</a>}
        </div>
        <label className="as-f">
          <span className="as-lb">WhatsApp</span>
          <input className="as-in" value={whats} onChange={e => setWhats(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 9 0000-0000" />
          <span className="as-hint">Só a organização vê. Usado se houver problema com a entrega.</span>
        </label>
        <button type="submit" className="as-btn pri" disabled={ocupado}>{eu ? 'Salvar' : 'Salvar e ir para o endereço'}</button>
      </form>
    </Folha>
  )
}

function FolhaEndereco({ eu, nome, ocupado, travado, onFechar, onSalvar }: { eu: Eu; nome: string; ocupado: boolean; travado: boolean; onFechar: () => void; onSalvar: (d: Json) => void }) {
  const [f, setF] = useState({
    nome_completo: eu.nome_completo || nome, cep: cepBonito(eu.cep), logradouro: eu.logradouro || '', numero: eu.numero || '',
    complemento: eu.complemento || '', bairro: eu.bairro || '', cidade: eu.cidade || '', uf: eu.uf || '',
  })
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState('')
  const [campo, setCampo] = useState('')
  const set = (k: keyof typeof f, v: string) => setF(x => ({ ...x, [k]: v }))

  async function buscarCep() {
    const d = f.cep.replace(/\D/g, '')
    if (d.length !== 8) { setCampo('cep'); setErro('CEP tem 8 números.'); return }
    setBuscando(true); setErro(''); setCampo('')
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (j.erro) { setCampo('cep'); setErro('CEP não encontrado. Confira o número.'); return }
      setF(x => ({ ...x, logradouro: j.logradouro || x.logradouro, bairro: j.bairro || x.bairro, cidade: j.localidade || x.cidade, uf: j.uf || x.uf }))
    } catch { setErro('Não deu para consultar o CEP agora. Preencha o endereço.') }
    finally { setBuscando(false) }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const cep = f.cep.replace(/\D/g, '')
    if (f.nome_completo.trim().length < 2) { setCampo('nome'); setErro('Informe o nome completo para a etiqueta.'); return }
    if (cep.length !== 8) { setCampo('cep'); setErro('CEP tem 8 números.'); return }
    if (!f.logradouro.trim()) { setCampo('logradouro'); setErro('Informe a rua.'); return }
    if (!f.numero.trim()) { setCampo('numero'); setErro('Informe o número.'); return }
    if (!f.cidade.trim() || f.uf.trim().length !== 2) { setCampo('uf'); setErro('Informe cidade e UF.'); return }
    onSalvar({ ...f, cep, uf: f.uf.toUpperCase() })
  }

  return (
    <Folha titulo="Endereço de entrega" onFechar={onFechar}>
      <div className="as-note strong"><strong>Só quem tirar você</strong> vai ver este endereço, e só depois do sorteio. Ele não aparece no mural nem para os outros participantes.</div>
      {travado && <div className="as-note">O sorteio já aconteceu: o endereço fica travado, porque quem tirou você pode já ter copiado. Se mudou, avise a organização.</div>}
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="as-f"><span className="as-lb">Nome completo (para a etiqueta)</span><input className={`as-in${campo === 'nome' ? ' err' : ''}`} value={f.nome_completo} onChange={e => set('nome_completo', e.target.value)} autoComplete="name" /></label>
        <div className="as-f">
          <span className="as-lb">CEP</span>
          <div className="as-two">
            <input className={`as-in${campo === 'cep' ? ' err' : ''}`} value={f.cep} onChange={e => set('cep', e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" disabled={travado} />
            <button type="button" className="as-btn sm" style={{ flex: '0 0 auto' }} onClick={buscarCep} disabled={buscando || travado}><Ico n="search" s={16} />{buscando ? '...' : 'Buscar'}</button>
          </div>
          <span className="as-hint">Rua, bairro, cidade e UF preenchidos pelo CEP. Confira o número.</span>
        </div>
        <div className="as-two">
          <label className="as-f" style={{ flex: 2 }}><span className="as-lb">Rua</span><input className={`as-in${campo === 'logradouro' ? ' err' : ''}`} value={f.logradouro} onChange={e => set('logradouro', e.target.value)} autoComplete="address-line1" disabled={travado} /></label>
          <label className="as-f"><span className="as-lb">Número</span><input className={`as-in${campo === 'numero' ? ' err' : ''}`} value={f.numero} onChange={e => set('numero', e.target.value)} inputMode="numeric" placeholder="obrigatório" disabled={travado} /></label>
        </div>
        <label className="as-f"><span className="as-lb">Complemento</span><input className="as-in" value={f.complemento} onChange={e => set('complemento', e.target.value)} placeholder="apto, bloco, referência" disabled={travado} /></label>
        <div className="as-two">
          <label className="as-f" style={{ flex: 2 }}><span className="as-lb">Bairro</span><input className="as-in" value={f.bairro} onChange={e => set('bairro', e.target.value)} disabled={travado} /></label>
          <label className="as-f"><span className="as-lb">UF</span><input className={`as-in${campo === 'uf' ? ' err' : ''}`} value={f.uf} onChange={e => set('uf', e.target.value.toUpperCase().slice(0, 2))} maxLength={2} placeholder="SP" disabled={travado} /></label>
        </div>
        <label className="as-f"><span className="as-lb">Cidade</span><input className={`as-in${campo === 'uf' ? ' err' : ''}`} value={f.cidade} onChange={e => set('cidade', e.target.value)} autoComplete="address-level2" disabled={travado} /></label>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="submit" className="as-btn pri" disabled={ocupado}>Salvar endereço</button>
      </form>
    </Folha>
  )
}

function FolhaDesejo({ eu, teto, ocupado, onFechar, onSalvar }: { eu: Eu; teto: number; ocupado: boolean; onFechar: () => void; onSalvar: (d: Json) => void }) {
  const [desejo, setDesejo] = useState(eu.desejo || '')
  const [sug, setSug] = useState<string[]>([...(eu.sugestoes || []), '', '', ''].slice(0, 3))
  const [surp, setSurp] = useState(eu.me_surpreenda)
  const [erro, setErro] = useState('')
  return (
    <Folha titulo="O que eu gostaria de ganhar" onFechar={onFechar}>
      <p className="as-meta">Ajude quem tirar você. O presente vai até {brl(teto)}.</p>
      <form onSubmit={e => { e.preventDefault(); if (!surp && !desejo.trim()) { setErro('Escreva em poucas palavras ou marque "Me surpreenda".'); return } onSalvar({ desejo: desejo.trim(), sugestoes: sug.map(s => s.trim()).filter(Boolean), me_surpreenda: surp }) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="as-f">
          <span className="as-lb">Em poucas palavras</span>
          <textarea className="as-in ta" value={desejo} maxLength={DESEJO_MAX_CHARS} onChange={e => { setDesejo(e.target.value); setErro('') }} placeholder="Ex.: coleciono Eevee, jogo o deck de Charizard, gosto de sleeves..." />
          <span className="as-hint">{desejo.length} de {DESEJO_MAX_CHARS} caracteres. Só quem tirar você lê isto.</span>
        </label>
        <label className="as-chk">
          <input type="checkbox" checked={surp} onChange={e => { setSurp(e.target.checked); setErro('') }} />
          <span><strong style={{ color: 'var(--bx-text)' }}>Me surpreenda</strong>: quem tirar você escolhe livremente.</span>
        </label>
        <div className="as-f">
          <span className="as-lb">Sugestões (até 3, teto de {brl(teto)} cada)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sug.map((s, i) => <input key={i} className="as-in" value={s} onChange={e => setSug(x => x.map((v, j) => j === i ? e.target.value : v))} placeholder={`Sugestão ${i + 1} (nome ou link)`} maxLength={120} />)}
          </div>
          <span className="as-hint">Link do Marketplace da Bynx ou de qualquer loja.</span>
        </div>
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <button type="submit" className="as-btn pri" disabled={ocupado}>Salvar</button>
      </form>
    </Folha>
  )
}

function FolhaPokemon({ eu, ocupado, onFechar, onSalvar }: { eu: Eu; ocupado: boolean; onFechar: () => void; onSalvar: (p: string | null) => void }) {
  const [sel, setSel] = useState<string | null>(eu.pokemon)
  return (
    <Folha titulo="Foto de perfil Pokémon" onFechar={onFechar}>
      <p className="as-meta">Aparece ao lado do seu @ na sala e no mural. Opcional: um toque e pronto, ou fique com a inicial.</p>
      <div className="as-pk-grid">
        {POKEMON_PERFIL.map(p => (
          <button key={p.slug} type="button" className={`as-pk${sel === p.slug ? ' on' : ''}`} onClick={() => setSel(p.slug)} aria-pressed={sel === p.slug}>
            <Image src={spritePokemon(p.slug)!} alt="" width={44} height={44} unoptimized referrerPolicy="no-referrer" loading="lazy" />
            <span>{p.nome}</span>
          </button>
        ))}
      </div>
      <div className="as-two">
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => onSalvar(null)}>Pular</button>
        <button type="button" className="as-btn pri" disabled={ocupado || !sel} onClick={() => onSalvar(sel)}>Salvar</button>
      </div>
    </Folha>
  )
}

function FolhaTirou({ tirou, postarAte, postado, onFechar, onPostei }: { tirou: Tirou; postarAte: string; postado: boolean; onFechar: () => void; onPostei: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const e = tirou.endereco
  const endereco = e
    ? [tirou.nome_completo, `${e.logradouro || ''}${e.numero ? `, ${e.numero}` : ''}${e.complemento ? `, ${e.complemento}` : ''}`, `${e.bairro ? `${e.bairro}, ` : ''}${e.cidade || ''}${e.uf ? `, ${e.uf}` : ''}`, `CEP ${cepBonito(e.cep)}`].filter(Boolean).join('\n')
    : ''
  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch {}
  }
  return (
    <Folha titulo="Você tirou..." onFechar={onFechar}>
      <div className="as-frente">
        <Avatar instagram={tirou.instagram} pokemon={tirou.pokemon} tam={52} />
        <div className="at">@{tirou.instagram}</div>
        <a className="ln" href={`https://instagram.com/${tirou.instagram}`} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={14} />Abrir no Instagram, para conhecer o conteúdo</a>
      </div>
      <div className="as-card" style={{ gap: 6, padding: '10px 12px' }}>
        <div className="as-k">O que gostaria de ganhar</div>
        {tirou.me_surpreenda && <div style={{ fontSize: 14 }}><strong>Me surpreenda.</strong> Escolha livre.</div>}
        {tirou.desejo && <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{tirou.desejo}</div>}
        {tirou.sugestoes.map((s, i) => /^https?:\/\//.test(s)
          ? <a key={i} className="as-row" href={s} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.replace(/^https?:\/\//, '')}</span><span className="as-meta" style={{ color: 'var(--ac-1)' }}>link</span></a>
          : <div key={i} className="as-row static"><span>{s}</span></div>)}
      </div>
      {endereco ? (
        <>
          <div className="as-addr"><b>Endereço de entrega (etiqueta)</b>{endereco}</div>
          <button type="button" className="as-btn" onClick={copiar}><Ico n="copy" s={16} />{copiado ? 'Copiado' : 'Copiar endereço'}</button>
          <div className="as-note strong">O nome completo e o endereço aparecem <strong>só aqui e só para você</strong>. Não tire print nem compartilhe. Ao fechar, somem da tela; você reabre pelo cartão da missão.</div>
        </>
      ) : <div className="as-note">O endereço desta pessoa já foi apagado (30 dias após a revelação).</div>}
      <div className="as-meta">Prazo de postagem: <strong>{dataCurta(postarAte)}</strong>{diasAte(postarAte) > 0 ? ` (faltam ${diasAte(postarAte)} dias)` : ''}</div>
      <button type="button" className="as-btn pri" onClick={onPostei}>{postado ? 'Editar código de rastreio' : 'Já postei: informar código de rastreio'}</button>
    </Folha>
  )
}

function FolhaRastreio({ eu, tirou, ocupado, onFechar, onSalvar }: { eu: Eu; tirou: Tirou; ocupado: boolean; onFechar: () => void; onSalvar: (r: string) => void }) {
  const [cod, setCod] = useState(eu.rastreio || '')
  return (
    <Folha titulo="Código de rastreio" onFechar={onFechar}>
      <p className="as-meta">Dentro da Bynx, @{tirou.instagram} vê só o código e o andamento, nunca o seu @ nem o seu nome.</p>
      <form onSubmit={e => { e.preventDefault(); onSalvar(cod.trim().toUpperCase()) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="as-f">
          <span className="as-lb">Código (Correios ou transportadora)</span>
          <input className="as-in" value={cod} onChange={e => setCod(e.target.value)} autoCapitalize="characters" placeholder="AA123456789BR" maxLength={40} style={{ fontFamily: 'monospace' }} />
          <span className="as-hint">Pode deixar em branco se entregou em mãos ou sem rastreio.</span>
        </label>
        <div className="as-note strong">O código dos Correios não mostra o nome de quem postou, mas a consulta no site deles mostra a <strong>cidade de postagem</strong>, e a <strong>etiqueta física</strong> leva o nome de quem postou. Dica: na etiqueta, só o nome, sem o @.</div>
        <button type="submit" className="as-btn pri" disabled={ocupado}>{eu.postado_em ? 'Salvar' : 'Confirmar que postei'}</button>
      </form>
    </Folha>
  )
}

function FolhaEscrever({ tirou, hoje, ocupado, onFechar, onEnviar }: { tirou: Tirou; hoje: number; ocupado: boolean; onFechar: () => void; onEnviar: (texto: string, pronta: number | null) => void }) {
  const [texto, setTexto] = useState('')
  const [pronta, setPronta] = useState<number | null>(null)
  const restam = MURAL_MAX_DIA - hoje
  return (
    <Folha titulo="Escrever no mural" onFechar={onFechar}>
      <div className="as-card" style={{ gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
          <span className="as-pill-lock"><Avatar instagram={tirou.instagram} pokemon={tirou.pokemon} tam={24} />Para @{tirou.instagram}<Ico n="lock" s={14} /></span>
          <span className="as-meta">quem você tirou; não dá para mudar</span>
        </div>
        <div className="as-meta">Assinado como <strong>Seu amigo secreto</strong>. Todo mundo na sala lê, ninguém vê o seu @.</div>
      </div>
      <form onSubmit={e => { e.preventDefault(); if (texto.trim()) onEnviar(texto.trim(), pronta) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="as-f">
          <span className="as-lb">Mensagens prontas</span>
          <div className="as-chips">
            {MENSAGENS_PRONTAS.map((m, i) => <button key={i} type="button" className={`as-btn sm${pronta === i ? ' on' : ''}`} onClick={() => { setPronta(i); setTexto(m) }}>{m}</button>)}
          </div>
        </div>
        <label className="as-f">
          <span className="as-lb">Ou escreva a sua</span>
          <textarea className="as-in ta" value={texto} maxLength={MURAL_MAX_CHARS} onChange={e => { setTexto(e.target.value); setPronta(null) }} placeholder={`Até ${MURAL_MAX_CHARS} caracteres`} />
          <span className="as-hint">{texto.length} de {MURAL_MAX_CHARS}. Sem o seu nome, sem o seu @, sem link, sem a cidade de onde você manda.</span>
        </label>
        <div className="as-note">Você ainda pode publicar <strong>{restam === 1 ? '1 mensagem' : `${restam} mensagens`} hoje</strong> ({hoje} de {MURAL_MAX_DIA} usadas). O limite reinicia à meia-noite.</div>
        <button type="submit" className="as-btn pri" disabled={ocupado || !texto.trim() || restam <= 0}><Ico n="send" s={16} />Publicar no mural</button>
      </form>
    </Folha>
  )
}
