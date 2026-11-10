'use client'

// Sala do Amigo Secreto (UI 2 aprovada em 04/11/2026). Uma URL, um cartao de
// missao que troca de estado, folhas de baixo e o mural com remetente
// sempre anonimo. O navegador nunca le as tabelas: tudo vem das funcoes
// amigo_secreto_* (supabase/migrations/20261104100000_amigo_secreto.sql),
// que devolvem so o que o proprio usuario pode ver.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  AMIGO_SECRETO_SLUG, DESEJO_MAX_CHARS, INSTAGRAM_RE, MENSAGENS_PRONTAS, MURAL_MAX_CHARS, MURAL_MAX_DIA,
  POKEMON_PERFIL, brl, cepBonito, dataCurta, dataHora, diasAte, erroAmigoSecreto, faltaNaPista, finalDoTexto, horaCurta, limparInstagram, rotuloDia,
  nomePokemon, spritePokemon, type EdicaoPublica, type Eu, type MensagemMural, type MinhaSala, type Tirou,
} from '@/lib/amigoSecreto'
import { AMIGO_SECRETO, AMIGO_SECRETO_SALA, CLUB } from '@/lib/pcc/rotas'
import { AS_CSS, Avatar, Ico, VoltarClub } from '../estilo'

const SALA = AMIGO_SECRETO_SALA
const SLUG = AMIGO_SECRETO_SLUG
const CHAVE_ABRI = `bynx_as_abri_${SLUG}`

type Folha = 'dados' | 'endereco' | 'desejo' | 'pokemon' | 'tirou' | 'rastreio' | 'escrever' | 'recebi' | 'ajuda' | null
type Json = Record<string, unknown>

function lerAbri(): boolean { try { return localStorage.getItem(CHAVE_ABRI) === '1' } catch { return false } }
function gravarAbri() { try { localStorage.setItem(CHAVE_ABRI, '1') } catch {} }

// Pista depois do sorteio: "Esta bom assim" esconde o aviso neste aparelho, e a
// ultima abertura do envelope decide se o selo "Pista atualizada" aparece.
const CHAVE_PISTA_OK = `bynx_as_pista_ok_${SLUG}`
const CHAVE_PISTA_VISTA = `bynx_as_pista_vista_${SLUG}`
function lerNum(k: string): number { try { return Number(localStorage.getItem(k) || 0) } catch { return 0 } }
function gravarNum(k: string, v: number) { try { localStorage.setItem(k, String(v)) } catch {} }

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
  const [muralAberto, setMuralAberto] = useState(true)
  const [pistaOk, setPistaOk] = useState(() => lerNum(CHAVE_PISTA_OK) > 0)
  const [pistaVista, setPistaVista] = useState(() => lerNum(CHAVE_PISTA_VISTA))
  const [salvouPista, setSalvouPista] = useState(false)

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
    else {
      const ms = m.data as MinhaSala
      setSala(ms)
      // O mural abre 60 min depois do sorteio executado (v2): antes disso o
      // banco recusa o feed com mural_aguardando e a tela mostra a hora.
      setMuralAberto(!(ms.inscrito && ms.mural_abre_em && Date.parse(ms.mural_abre_em) > Date.now()))
    }
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

  /** Abre o envelope de quem eu tirei e marca a pista como vista. */
  function abrirTirou() {
    gravarAbri(); setAbri(true); setFolha('tirou')
    const agora = Date.now()
    gravarNum(CHAVE_PISTA_VISTA, agora); setPistaVista(agora)
  }

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
          <Link href={AMIGO_SECRETO} className="as-btn lnk">Ainda não participo</Link>
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
        <Cabeca chip={chipFase} n={edicao?.participantes} onAjuda={() => setFolha('ajuda')} />
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
            <Link href={AMIGO_SECRETO} className="as-btn">Voltar</Link>
          </div>
        )}
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <QuemEntrou edicao={edicao} minimo={3} />
        {folha === 'ajuda' && <FolhaAjuda antes onFechar={fechar} />}
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
  // Pista depois do sorteio: editavel ate o prazo de entrega.
  const pistaAberta = estado !== 'encerrado' && Date.now() <= Date.parse(sala.postar_ate)
  const falta = faltaNaPista(eu!)
  const nSug = (eu!.sugestoes || []).length
  const resumoPista = [
    eu!.me_surpreenda ? 'escolha livre' : `${falta === 'cortado' ? 'texto cortado · ' : ''}${nSug} de 3 sugestões`,
    eu!.pista_atualizada_em ? `atualizada ${dataHora(eu!.pista_atualizada_em)}` : null,
    pistaAberta ? `editável até ${dataCurta(sala.postar_ate)}` : `fechada em ${dataCurta(sala.postar_ate)}`,
  ].filter(Boolean).join(' · ')
  const pistaMudou = !!tirou?.pista_atualizada_em && Date.parse(tirou.pista_atualizada_em) > pistaVista
  const revelado = sala.revelado

  return (
    <Casca>
      <div className="as-sala">
      <div className="as-sala-main">
      <Cabeca chip={chipFase} n={edicao?.participantes} onAjuda={() => setFolha('ajuda')} />

      {estado === 'inscricoes' && (
        <div className="as-meta">Sorteio em <strong>{dataHora(sala.sorteio_em)}</strong>. {diasAte(sala.sorteio_em) === 0 ? 'É hoje.' : `Faltam ${diasAte(sala.sorteio_em)} dias.`}</div>
      )}
      {(estado === 'sorteado' || estado === 'entregas') && (
        <div className="as-meta">Entrega até <strong>{dataCurta(sala.postar_ate)}</strong>. {diasAte(sala.postar_ate) === 0 ? 'Último dia.' : `Faltam ${diasAte(sala.postar_ate)} dias.`}</div>
      )}

      {erro && <div className="as-erro" role="alert">{erro}</div>}

      {/* ── Cartao de missao ── */}
      {estado === 'inscricoes' ? (
        <div className="as-mis">
          <div className="as-eye-row">
            <div className="as-eye"><Ico n="star" s={14} />Sua missão agora</div>
            {eu!.perfil_completo && <span className="as-chip ok">Perfil pronto</span>}
          </div>
          <h3 className="as-h3">{eu!.perfil_completo ? 'Seu perfil está pronto' : 'Complete o perfil para entrar no sorteio'}</h3>
          <p className="as-meta">
            {eu!.perfil_completo
              ? `Agora é só aguardar o sorteio. Ele acontece com pelo menos ${sala.minimo} criadores e com o perfil de todo mundo completo.`
              : 'Você já deixou tudo que seu amigo secreto precisa quando os três itens estiverem marcados. O Pokémon é opcional.'}
          </p>
          <Energia rotulo="3 itens obrigatórios · 1 opcional" segs={energiaPerfil} />
          <div>
            <button type="button" className="as-row" onClick={() => setFolha('dados')}><span className="l"><span className="as-st ok"><Ico n="check" s={13} /></span><span>Meu @ e WhatsApp<small>como você aparece na sala</small></span></span><Ico n="chev" className="arr" /></button>
            <button type="button" className="as-row" onClick={() => setFolha('endereco')}><span className="l"><span className={`as-st${temEndereco ? ' ok' : ''}`}>{temEndereco && <Ico n="check" s={13} />}</span><span>Endereço para receber<small>visível só para quem envia</small></span></span><Ico n="chev" className="arr" /></button>
            <button type="button" className="as-row" onClick={() => setFolha('desejo')}><span className="l"><span className={`as-st${temDesejo ? ' ok' : ''}`}>{temDesejo && <Ico n="check" s={13} />}</span><span>Minha pista de presente<small>até {brl(sala.teto_cents)}, frete à parte</small></span></span><Ico n="chev" className="arr" /></button>
            <button type="button" className="as-row" onClick={() => setFolha('pokemon')}><span className="l"><span className={`as-st${eu!.pokemon ? ' ok' : ' opt'}`}>{eu!.pokemon && <Ico n="check" s={13} />}</span><span>Escolher meu Pokémon<small>opcional, deixa a sala mais sua</small></span></span><Ico n="chev" className="arr" /></button>
          </div>
          {!eu!.perfil_completo && (
            <button type="button" className="as-btn pri" onClick={() => setFolha(!temEndereco ? 'endereco' : 'desejo')}>
              {!temEndereco ? 'Continuar: endereço para receber' : 'Continuar: minha pista de presente'}
            </button>
          )}
          {eu!.perfil_completo && inscricoesAbertas && <span className="as-btn dis"><Ico n="clock" s={16} />Aguardar o sorteio: {dataHora(sala.sorteio_em)}</span>}
          {eu!.perfil_completo && !inscricoesAbertas && <p className="as-meta">As inscrições encerraram. O sorteio sai em {dataHora(sala.sorteio_em)}.</p>}
        </div>
      ) : (
        <div className="as-mis">
          <div className="as-eye"><Ico n="star" s={14} />{estado === 'encerrado' ? 'Edição encerrada' : 'Sua missão agora'}</div>
          <h3 className="as-h3">{estado === 'encerrado' ? 'Obrigado por participar' : !tirou ? 'Sorteio em preparação' : eu!.recebido_em ? 'Presente recebido' : eu!.postado_em ? 'Presente a caminho' : 'Você tirou alguém!'}</h3>
          {estado !== 'encerrado' && tirou && !eu!.postado_em && <p className="as-meta">Agora é preparar um presente legal e manter o mistério. O presente precisa chegar até <strong>{dataCurta(sala.postar_ate)}</strong>. Poste com antecedência.</p>}
          {estado !== 'encerrado' && <Energia rotulo="Energia da entrega" segs={energiaEntrega} />}

          <div className="as-lane envio first">
            {tirou ? (
              <>
                <button type="button" className="as-verso tilt" aria-label="Ver quem eu tirei" onClick={abrirTirou}><Ico n="gift" s={28} /></button>
                <div className="tx">
                  <div className="as-k">Eu envio</div>
                  {eu!.postado_em ? (
                    <>
                      <div style={{ fontSize: 13.5 }}>Envio registrado em <strong>{dataCurta(eu!.postado_em)}</strong>{eu!.rastreio ? <> · <span style={{ fontFamily: 'monospace' }}>{eu!.rastreio}</span></> : <> · em mãos ou sem rastreio</>}</div>
                      {Date.parse(eu!.postado_em) > Date.parse(sala.postar_ate) && <div className="as-note">A postagem foi registrada depois do prazo combinado. Avise a organização se precisar de ajuda com a entrega.</div>}
                      <button type="button" className="as-btn sm" onClick={() => setFolha('rastreio')}>{eu!.rastreio ? 'Editar envio' : 'Editar envio'}</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="as-btn pri sm" onClick={abrirTirou}><Ico n="eye" s={16} />Ver quem eu tirei</button>
                      <div className="as-meta">O @, a pista e o endereço aparecem só para você, dentro do envelope.</div>
                    </>
                  )}
                  {pistaMudou && (
                    <div className="as-pista-nova">
                      <span className="as-chip fill"><Ico n="spark" s={12} />Pista atualizada</span>
                      <span className="as-meta">A pista mudou em {dataHora(tirou.pista_atualizada_em!)}. Confira antes de comprar.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="tx"><div className="as-k">Eu envio</div><div className="as-meta">O sorteio ainda está sendo preparado.</div></div>
            )}
          </div>

          <div className="as-lane">
            <div className="as-k">Eu recebo</div>
            {pistaAberta && falta && !pistaOk && !sala.recebo?.postado_em && (
              <div className="as-ajuda">
                <div className="as-eye"><Ico n="gift" s={14} />Ajude quem tirou você</div>
                <p className="as-meta" style={{ margin: 0 }}>
                  {falta === 'cortado'
                    ? <>Sua pista parou no meio, em <strong>{finalDoTexto(eu!.desejo || '')}</strong>. Agora cabem {DESEJO_MAX_CHARS} caracteres: termine a frase.</>
                    : falta === 'curto'
                      ? <>Sua pista diz só <strong>{(eu!.desejo || '').trim()}</strong>. Conte um Pokémon favorito ou um tipo de item, e quem tirou você acerta mais fácil.</>
                      : <>Sua pista ainda não tem sugestão. Uma carta, um sleeve ou um link já ajudam quem vai escolher o seu presente.</>}
                </p>
                <Energia rotulo="Sugestões na pista" segs={[nSug >= 1, nSug >= 2, nSug >= 3]} />
                <div className="acoes">
                  <button type="button" className="as-btn sm" onClick={() => { setSalvouPista(false); setFolha('desejo') }}>
                    {falta === 'cortado' ? 'Terminar minha pista' : falta === 'curto' ? 'Completar minha pista' : 'Adicionar sugestões'}
                  </button>
                  <button type="button" className="as-btn lnk sm" style={{ width: 'auto' }} onClick={() => { gravarNum(CHAVE_PISTA_OK, Date.now()); setPistaOk(true) }}>Está bom assim</button>
                </div>
              </div>
            )}
            <button type="button" className="as-row" disabled={!pistaAberta} onClick={() => { setSalvouPista(false); setFolha('desejo') }}>
              <span className="l">
                <span className={`as-st${falta ? '' : ' ok'}`}>{!falta && <Ico n="check" s={13} />}</span>
                <span>Minha pista de presente<small>{resumoPista}</small></span>
              </span>
              {pistaAberta && <Ico n="chev" className="arr" />}
            </button>
            {salvouPista && <div className="as-note">Pista salva. Quem tirou você vai ver o selo &quot;Pista atualizada&quot; ao abrir o envelope.</div>}
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
                ) : <div className="as-meta">Sem código de rastreio: pode ter sido entregue em mãos.</div>}
                <div className="as-meta">A consulta nos Correios mostra a cidade de postagem. Se quiser manter a surpresa, não consulte.</div>
              </>
            ) : (
              <div className="as-meta">Alguém tirou você. Quando essa pessoa registrar o envio, o código de rastreio aparece aqui.</div>
            )}
            {eu!.recebido_em ? (
              <div className="as-meta">Você confirmou o recebimento em {dataCurta(eu!.recebido_em)}{eu!.recebido_em_maos ? ', em mãos' : ''}.</div>
            ) : estado !== 'encerrado' && (
              sala.recebo?.postado_em
                ? <button type="button" className="as-btn" disabled={ocupado} onClick={() => setFolha('recebi')}><Ico n="box" s={16} />Meu presente chegou</button>
                : <button type="button" className="as-btn lnk" style={{ alignSelf: 'flex-start', paddingLeft: 0, width: 'auto' }} disabled={ocupado} onClick={() => setFolha('recebi')}>Recebi em mãos</button>
            )}
          </div>

          <div className="as-lane">
            <div className="as-k">Revelação final · {dataHora(sala.revelacao_em)}</div>
            {revelado ? (
              <div className="as-meta">{sala.recebo?.revelado ? 'A troca foi revelada: veja em "Eu recebo" quem mandou o seu presente.' : 'A revelação ficou guardada: um dos lados preferiu manter o segredo.'}</div>
            ) : (
              <>
                <h4 className="as-h3" style={{ fontSize: 16 }}>Quer revelar esta troca?</h4>
                <p className="as-meta">Quem recebeu só descobre quem mandou se os dois lados aceitarem. Se alguém preferir manter o segredo, a identidade continua protegida.</p>
                <div className="as-two as-rev">
                  <div className={`as-rev-box${eu!.quer_revelar ? ' ok' : ''}`}><b>Você</b><span>{eu!.quer_revelar ? 'Aceitou revelar esta troca.' : 'Ainda não escolheu.'}</span></div>
                  <div className={`as-rev-box${sala.recebo?.outro_aceitou ? ' ok' : ''}`}><b>Quem tirou você</b><span>{sala.recebo?.outro_aceitou ? 'Aceitou revelar.' : 'Ainda não escolheu.'}</span></div>
                </div>
                <label className="as-chk">
                  <input type="checkbox" checked={eu!.quer_revelar} disabled={ocupado} onChange={e => chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: { quer_revelar: e.target.checked } })} />
                  <span><strong style={{ color: 'var(--bx-text)' }}>Aceito revelar esta troca.</strong> Na data final, quem recebeu o presente descobre quem mandou, se os dois aceitarem. Dá para mudar de ideia até lá.</span>
                </label>
                {tirou && <div className="as-meta">Quem você tirou {tirou.aceitou ? 'já aceitou' : 'ainda não escolheu'} revelar o lado dela.</div>}
              </>
            )}
          </div>
        </div>
      )}

      </div>

      {/* ── Mural (no desktop, coluna fixa a direita) ── */}
      <aside className="as-mural" aria-label="Mural">
        <Mural feed={feed} estado={estado} eu={eu!} tirou={tirou} edicao={edicao} hoje={sala.mensagens_hoje} ligado={sala.feed_ligado} aberto={muralAberto} abreEm={sala.mural_abre_em} minimo={sala.minimo} sorteioEm={sala.sorteio_em} onEscrever={() => setFolha('escrever')} />
      </aside>
      </div>

      {/* ── Folhas ── */}
      {folha === 'dados' && <FolhaDados eu={eu} nome={sessao.nome} ocupado={ocupado} onFechar={fechar} onSalvar={async d => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d })) { setFolha(temEndereco ? null : 'endereco'); carregar() } }} />}
      {folha === 'endereco' && <FolhaEndereco eu={eu!} nome={sessao.nome} ocupado={ocupado} travado={!!tirou} onFechar={fechar} onSalvar={async d => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d })) { setFolha(temDesejo ? null : 'desejo') } }} />}
      {folha === 'desejo' && <FolhaDesejo eu={eu!} teto={sala.teto_cents} ocupado={ocupado} onFechar={fechar}
        depois={estado === 'inscricoes' ? undefined : { prazo: sala.postar_ate, aCaminho: !!sala.recebo?.postado_em }}
        onSalvar={async d => {
          if (!(await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: d }))) return
          if (estado === 'inscricoes') setFolha(eu!.pokemon ? null : 'pokemon')
          else { setFolha(null); setSalvouPista(true) }
        }} />}
      {folha === 'pokemon' && <FolhaPokemon eu={eu!} ocupado={ocupado} onFechar={fechar} onSalvar={async p => { if (await chamar('amigo_secreto_salvar_perfil', { p_slug: SLUG, p: { pokemon: p || '' } })) { setFolha(null); carregar() } }} />}
      {folha === 'tirou' && tirou && <FolhaTirou tirou={tirou} postarAte={sala.postar_ate} postado={!!eu!.postado_em} onFechar={fechar} onPostei={() => setFolha('rastreio')} onAjuda={() => setFolha('ajuda')} />}
      {folha === 'rastreio' && tirou && <FolhaRastreio eu={eu!} tirou={tirou} postarAte={sala.postar_ate} ocupado={ocupado} onFechar={fechar} onSalvar={async r => { if (await chamar('amigo_secreto_postei', { p_slug: SLUG, p_rastreio: r })) setFolha(null) }} />}
      {folha === 'recebi' && <FolhaRecebi postado={!!sala.recebo?.postado_em} ocupado={ocupado} onFechar={fechar} onConfirmar={async emMaos => { if (await chamar('amigo_secreto_recebi', { p_slug: SLUG, p_em_maos: emMaos })) setFolha(null) }} />}
      {folha === 'ajuda' && <FolhaAjuda antes={estado === 'inscricoes'} onFechar={fechar} />}
      {folha === 'escrever' && tirou && <FolhaEscrever tirou={tirou} hoje={sala.mensagens_hoje} ocupado={ocupado} onFechar={fechar} onEnviar={async (texto, pronta) => { if (await chamar('amigo_secreto_enviar_mensagem', { p_slug: SLUG, p_texto: texto, p_pronta: pronta })) { setFolha(null); carregar() } }} />}
    </Casca>
  )
}

// ── Blocos ──────────────────────────────────────────────────────────────────

function Casca({ children }: { children: React.ReactNode }) {
  return (
    <div className="as">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Amigo Secreto</span>
          <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
        </div>
      </header>
      <main className="bx-gutter"><div className="as-wrap as-bd">{children}</div></main>
      <style>{AS_CSS}</style>
    </div>
  )
}

function Cabeca({ chip, n, onAjuda }: { chip: string; n?: number; onAjuda?: () => void }) {
  return (
    <>
      <div className="as-eye-row">
        <div className="as-chips">
          <span className="as-chip fill">{chip}</span>
          {typeof n === 'number' && <span className="as-chip"><Ico n="users" s={14} />{n} {n === 1 ? 'criador' : 'criadores'}</span>}
        </div>
        {onAjuda && <button type="button" className="as-btn lnk sm" style={{ minHeight: 44 }} onClick={onAjuda}>Preciso de ajuda</button>}
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

function QuemEntrou({ edicao, minimo, sorteioEm, nota }: { edicao: EdicaoPublica | null; minimo: number; sorteioEm?: string; nota?: string }) {
  if (!edicao) return null
  const faltam = Math.max(0, Math.max(3, minimo) - edicao.participantes)
  return (
    <>
      <div className="as-eye">Status da edição</div>
      <div className="as-fh"><h3 className="as-h3">Quem já entrou</h3><span className="as-meta">{edicao.participantes} {edicao.participantes === 1 ? 'criador' : 'criadores'}</span></div>
      <p className="as-meta">{nota || 'O mural de recados abre depois do sorteio. Por enquanto, veja quem está na brincadeira.'}</p>
      <div className="as-feed">
        {edicao.lista.map(p => (
          <div key={p.instagram} className="as-fi"><Avatar instagram={p.instagram} pokemon={p.pokemon} /><div className="bub"><div className="who">@{p.instagram}</div><div className="as-meta">entrou na sala</div></div></div>
        ))}
        {faltam > 0 && <div className="as-fi sys"><div className="bub">{faltam === 1 ? 'Falta 1 criador' : `Faltam ${faltam} criadores`} para liberar a rodada.</div></div>}
      </div>
      {sorteioEm && <div className="as-fh" style={{ borderTop: '1px solid var(--bx-border)', paddingTop: 8 }}><span className="as-meta">Sorteio em <strong>{dataHora(sorteioEm)}</strong></span><span className="as-chip wait">aguardando</span></div>}
    </>
  )
}

function Mural({ feed, estado, eu, tirou, edicao, hoje, ligado, aberto, abreEm, minimo, sorteioEm, onEscrever }: {
  feed: MensagemMural[]; estado: string; eu: Eu; tirou: Tirou | null; edicao: EdicaoPublica | null; hoje: number; ligado: boolean
  aberto: boolean; abreEm: string | null; minimo: number; sorteioEm: string; onEscrever: () => void
}) {
  const antes = estado === 'inscricoes'
  const grupos = useMemo(() => {
    const m = new Map<string, MensagemMural[]>()
    for (const x of feed) { if (!m.has(x.dia)) m.set(x.dia, []); m.get(x.dia)!.push(x) }
    return [...m.entries()]
  }, [feed])
  const paraMim = feed.filter(x => x.para_mim).length

  if (antes) return (
    <>
      <QuemEntrou edicao={edicao} minimo={minimo} sorteioEm={sorteioEm} />
      <div className="as-comp">
        <span className="fake" aria-disabled="true">Você deixa pistas para quem tirar, depois do sorteio</span>
        <span className="as-btn dis sm">Escrever</span>
      </div>
    </>
  )

  if (!aberto) return (
    <>
      <QuemEntrou edicao={edicao} minimo={minimo} nota={`O mural abre às ${abreEm ? horaCurta(abreEm) : '...'}, uma hora depois do sorteio, para ninguém entregar o par pelo horário. Enquanto isso, veja quem está na sala.`} />
      <div className="as-comp">
        <span className="fake" aria-disabled="true">O mural abre às {abreEm ? horaCurta(abreEm) : '...'}</span>
        <span className="as-btn dis sm">Escrever</span>
      </div>
    </>
  )

  const restam = Math.max(0, MURAL_MAX_DIA - hoje)
  return (
    <>
      <div className="as-eye">Pistas anônimas</div>
      <div className="as-fh"><h3 className="as-h3">Recados anônimos</h3><span className="as-meta">{paraMim > 0 ? `${paraMim} para você` : `${feed.length} ${feed.length === 1 ? 'recado' : 'recados'}`}</span></div>
      <p className="as-meta">O mural é para manter o suspense vivo. Sem nome, @, link ou cidade.</p>
      <div className="as-card as-prot">
        <div className="as-k">Proteção do mistério</div>
        <div className="as-h3">Você escreve como &quot;Seu amigo secreto&quot;.</div>
        <p className="as-meta">Todo mundo da sala pode ler, mas ninguém vê quem publicou. O limite é de {MURAL_MAX_DIA} recados por dia, e os recados ficam no mural até a revelação final.</p>
        {tirou && <div className="as-fh" style={{ minHeight: 0 }}><span className="as-meta">Recados restantes hoje</span><span className="as-dots" aria-label={`${restam} de ${MURAL_MAX_DIA}`}>{Array.from({ length: MURAL_MAX_DIA }, (_, i) => <i key={i} className={i < restam ? 'on' : ''} />)}</span></div>}
      </div>
      <div className="as-feed">
        {edicao && <div className="as-fi sys"><div className="bub">Sorteio realizado em {dataHora(edicao.sorteio_em)}. {edicao.participantes} pares formados. O mural está aberto.</div></div>}
        {feed.length === 0 && <div className="as-fi sys"><div className="bub">Ninguém escreveu ainda. Seja o primeiro a deixar uma pista para quem você tirou.</div></div>}
        {grupos.map(([dia, lista]) => (
          <div key={dia} className="as-feed">
            <div className="as-dia">{rotuloDia(dia)}{rotuloDia(dia) === 'Hoje' ? ' · recados embaralhados' : ''}</div>
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
          <button type="button" className="fake live" onClick={onEscrever}>Deixar uma pista para @{tirou.instagram}</button>
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

function Folha({ titulo, eyebrow, onFechar, children }: { titulo: string; eyebrow?: string; onFechar: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Foco entra na folha e volta para quem a abriu ao fechar.
    const antes = document.activeElement as HTMLElement | null
    const alvo = ref.current?.querySelector<HTMLElement>('input, textarea, button:not([aria-label="Fechar"])')
    ;(alvo || ref.current)?.focus()
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; antes?.focus() }
  }, [onFechar])
  return (
    <div className="as-sheet-bg" onClick={onFechar}>
      <div ref={ref} tabIndex={-1} className="as-sheet" role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <div className="as-handle" />
        <div className="as-sh"><div>{eyebrow && <div className="as-eye" style={{ marginBottom: 2 }}>{eyebrow}</div>}<h3 className="as-h3">{titulo}</h3></div><button type="button" className="as-ib" onClick={onFechar} aria-label="Fechar"><Ico n="x" s={22} /></button></div>
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
          <div className={`as-pre${erro ? ' err' : ''}`}><span>@</span><input className="as-in" value={ig} onChange={e => { setIg(e.target.value); setErro('') }} autoCapitalize="none" autoCorrect="off" inputMode="text" placeholder="seuperfil" aria-label="Seu @ do Instagram" aria-invalid={!!erro} required /></div>
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
            <input className={`as-in${campo === 'cep' ? ' err' : ''}`} value={f.cep} onChange={e => set('cep', e.target.value)} inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" aria-label="CEP" aria-invalid={campo === 'cep'} disabled={travado} />
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

function FolhaDesejo({ eu, teto, ocupado, depois, onFechar, onSalvar }: {
  eu: Eu; teto: number; ocupado: boolean
  /** Depois do sorteio: prazo para editar e se o presente ja esta a caminho. */
  depois?: { prazo: string; aCaminho: boolean }
  onFechar: () => void; onSalvar: (d: Json) => void
}) {
  const [desejo, setDesejo] = useState(eu.desejo || '')
  const [sug, setSug] = useState<string[]>((eu.sugestoes || []).length ? [...eu.sugestoes] : [''])
  const [surp, setSurp] = useState(eu.me_surpreenda)
  const [erro, setErro] = useState('')
  // Uma pista basta: o 2o e o 3o campo so aparecem se a pessoa pedir.
  const addPista = () => setSug(x => x.length < 3 ? [...x, ''] : x)
  return (
    <Folha titulo="Que presente combina com você?" eyebrow={depois ? 'Pista de presente' : 'Etapa 3 de 3 · pista de presente'} onFechar={onFechar}>
      <p className="as-meta">{!depois
        ? `Deixe uma pista para quem cair com você. O presente vai até ${brl(teto)}, e o frete fica por conta de quem envia.`
        : depois.aCaminho
          ? 'Seu presente já está a caminho. Ainda dá para ajustar a pista, mas quem tirou você já fez o envio.'
          : `Quem tirou você ainda está escolhendo. Quanto mais clara a pista, mais certeiro o presente. O valor vai até ${brl(teto)}, e o frete fica por conta de quem envia.`}</p>
      <form onSubmit={e => { e.preventDefault(); if (!surp && !desejo.trim()) { setErro('Escreva em poucas palavras ou marque "Pode escolher por mim".'); return } onSalvar({ desejo: desejo.trim(), sugestoes: sug.map(s => s.trim()).filter(Boolean), me_surpreenda: surp }) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="as-f">
          <span className="as-lb">Em poucas palavras, o que você curte?</span>
          <textarea className="as-in ta" value={desejo} maxLength={DESEJO_MAX_CHARS} onChange={e => { setDesejo(e.target.value); setErro('') }} placeholder="Cartas de Pokémon TCG, sleeves com arte diferente e acessórios para organizar a coleção." />
          <span className="as-hint">A pista aparece somente para quem tirar você · {desejo.length} de {DESEJO_MAX_CHARS} caracteres</span>
        </label>
        <label className="as-chk">
          <input type="checkbox" checked={surp} onChange={e => { setSurp(e.target.checked); setErro('') }} />
          <span><strong style={{ color: 'var(--bx-text)' }}>Pode escolher por mim.</strong> Se quiser deixar a surpresa totalmente nas mãos do seu amigo secreto, marque esta opção.</span>
        </label>
        {!surp && (
          <div className="as-f">
            <span className="as-lb">Até 3 pistas, nome ou link</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sug.map((v, i) => <input key={i} className="as-in" value={v} onChange={e => setSug(x => x.map((o, j) => j === i ? e.target.value : o))} placeholder={i === 0 ? 'Uma carta, sleeve ou acessório que você gostaria de ganhar' : `Pista ${i + 1}`} aria-label={`Pista ${i + 1}`} maxLength={120} />)}
              {sug.length < 3 && <button type="button" className="as-btn sm" style={{ alignSelf: 'flex-start', borderStyle: 'dashed' }} onClick={addPista}>Adicionar outra pista</button>}
            </div>
            <span className="as-hint">Link do Marketplace da Bynx ou de qualquer loja.</span>
          </div>
        )}
        {erro && <div className="as-erro" role="alert">{erro}</div>}
        <div className="as-fh" style={{ minHeight: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span className="as-meta">{depois ? `Você pode editar até ${dataCurta(depois.prazo)}.` : 'Você pode editar até o sorteio.'}</span>
          {depois && <span className="as-meta">Quem tirou você vê só que a pista mudou. Ninguém fica sabendo quem é.</span>}
        </div>
        <button type="submit" className="as-btn pri" disabled={ocupado}>Salvar minha pista</button>
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

function FolhaTirou({ tirou, postarAte, postado, onFechar, onPostei, onAjuda }: { tirou: Tirou; postarAte: string; postado: boolean; onFechar: () => void; onPostei: () => void; onAjuda: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const [enderecoAberto, setEnderecoAberto] = useState(false)
  const e = tirou.endereco
  const endereco = e
    ? [tirou.nome_completo, `${e.logradouro || ''}${e.numero ? `, ${e.numero}` : ''}${e.complemento ? `, ${e.complemento}` : ''}`, `${e.bairro ? `${e.bairro}, ` : ''}${e.cidade || ''}${e.uf ? `, ${e.uf}` : ''}`, `CEP ${cepBonito(e.cep)}`].filter(Boolean).join('\n')
    : ''
  async function copiar() {
    try { await navigator.clipboard.writeText(endereco); setCopiado(true); setTimeout(() => setCopiado(false), 1500) } catch {}
  }
  const pk = nomePokemon(tirou.pokemon)
  return (
    <Folha titulo="Você tirou..." eyebrow="Envelope aberto" onFechar={onFechar}>
      {/* Camada 1: contexto (quem e, o que curte). */}
      <div className="as-frente">
        <Avatar instagram={tirou.instagram} pokemon={tirou.pokemon} tam={52} />
        <div className="at">@{tirou.instagram}</div>
        <div className="as-meta">Criador de Pokémon TCG{pk ? ` · ${pk} como avatar` : ''}</div>
        <a className="ln" href={`https://instagram.com/${tirou.instagram}`} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={14} />Abrir no Instagram, para conhecer o conteúdo</a>
      </div>
      <div className="as-card" style={{ gap: 6, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div className="as-k">O que gostaria de ganhar</div>
          {tirou.pista_atualizada_em && <span className="as-chip fill"><Ico n="spark" s={12} />Pista atualizada · {dataCurta(tirou.pista_atualizada_em)}</span>}
        </div>
        {tirou.me_surpreenda && <div style={{ fontSize: 14 }}><strong>Pode escolher por mim.</strong> Escolha livre, até o teto.</div>}
        {tirou.desejo && <div style={{ fontSize: 14, overflowWrap: 'anywhere' }}>{tirou.desejo}</div>}
        {tirou.sugestoes.length > 0 && (
          <div className="as-chips">
            {tirou.sugestoes.map((s, i) => /^https?:\/\//.test(s)
              ? <a key={i} className="as-chip" href={s} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', maxWidth: '100%' }}><Ico n="ext" s={12} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.replace(/^https?:\/\/(www\.)?/, '')}</span></a>
              : <span key={i} className="as-chip">{s}</span>)}
          </div>
        )}
      </div>
      {/* Camada 2: endereco, fechado ate a pessoa pedir. */}
      {endereco ? (
        <div className="as-addr-lock">
          <button type="button" className="as-row" onClick={() => setEnderecoAberto(v => !v)} aria-expanded={enderecoAberto}>
            <span className="l"><Ico n="lock" s={18} /><span>Endereço protegido<small>{enderecoAberto ? 'Só aqui e só para você. Não tire print nem compartilhe.' : 'Toque para abrir o endereço completo quando for separar o envio.'}</small></span></span>
            <Ico n={enderecoAberto ? 'down' : 'chev'} className="arr" />
          </button>
          {enderecoAberto && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 0 10px' }}>
              <div className="as-addr"><b>Endereço de entrega (etiqueta)</b>{endereco}</div>
              <button type="button" className="as-btn" onClick={copiar}><Ico n="copy" s={16} />{copiado ? 'Copiado' : 'Copiar endereço'}</button>
              <div className="as-meta">Na etiqueta, só o nome, sem o seu @. Ao fechar, o endereço some da tela; você reabre pelo cartão da missão.</div>
            </div>
          )}
        </div>
      ) : <div className="as-note">O endereço desta pessoa não está mais disponível. Fale com a organização.</div>}
      <div className="as-card" style={{ gap: 6, padding: '10px 12px' }}>
        <div className="as-k">Prazo de entrega</div>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Chegar até {dataCurta(postarAte)}{diasAte(postarAte) > 0 ? <span className="as-meta" style={{ fontWeight: 500 }}> · faltam {diasAte(postarAte)} dias</span> : ''}</div>
        <div className="as-meta">Poste com antecedência. O código de rastreio é opcional, e também dá para registrar uma entrega em mãos.</div>
      </div>
      <button type="button" className="as-btn pri" onClick={onPostei}>{postado ? 'Editar envio' : 'Registrar envio'}</button>
      <button type="button" className="as-btn" onClick={onAjuda}>Preciso de ajuda</button>
    </Folha>
  )
}

function FolhaRastreio({ eu, tirou, postarAte, ocupado, onFechar, onSalvar }: { eu: Eu; tirou: Tirou; postarAte: string; ocupado: boolean; onFechar: () => void; onSalvar: (r: string) => void }) {
  const [cod, setCod] = useState(eu.rastreio || '')
  const [meio, setMeio] = useState<'correios' | 'transportadora' | 'maos'>(eu.postado_em && !eu.rastreio ? 'maos' : 'correios')
  const [atrasado] = useState(() => Date.now() > Date.parse(postarAte))
  return (
    <Folha titulo="Registrar envio" onFechar={onFechar}>
      <p className="as-meta">Dentro da Bynx, @{tirou.instagram} vê só o código e o andamento, nunca o seu @ nem o seu nome.</p>
      <form onSubmit={e => { e.preventDefault(); onSalvar(meio === 'maos' ? '' : cod.trim().toUpperCase()) }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="as-f">
          <span className="as-lb">Como foi o envio</span>
          <div className="as-opts" role="radiogroup" aria-label="Como foi o envio">
            {([['correios', 'Correios'], ['transportadora', 'Transportadora'], ['maos', 'Em mãos']] as const).map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={meio === k} className={`as-btn sm${meio === k ? ' on' : ''}`} onClick={() => setMeio(k)}>{l}</button>
            ))}
          </div>
        </div>
        {meio !== 'maos' && (
          <label className="as-f">
            <span className="as-lb">Código de rastreio (opcional)</span>
            <input className="as-in" value={cod} onChange={e => setCod(e.target.value)} autoCapitalize="characters" placeholder={meio === 'correios' ? 'AA123456789BR' : 'código da transportadora'} maxLength={40} style={{ fontFamily: 'monospace' }} />
            <span className="as-hint">Pode deixar em branco se o envio não tem rastreio.</span>
          </label>
        )}
        {meio === 'correios' && <div className="as-note strong">A consulta no site dos Correios mostra a <strong>cidade de postagem</strong>, e a <strong>etiqueta física</strong> leva o nome de quem postou. Dica: na etiqueta, só o nome, sem o @.</div>}
        {atrasado && !eu.postado_em && <div className="as-note">Depois do prazo combinado ({dataCurta(postarAte)}): o envio fica registrado como atrasado. Avise a organização se precisar de ajuda com a entrega.</div>}
        <button type="submit" className="as-btn pri" disabled={ocupado}>{eu.postado_em ? 'Salvar' : 'Registrar envio'}</button>
      </form>
    </Folha>
  )
}

function FolhaEscrever({ tirou, hoje, ocupado, onFechar, onEnviar }: { tirou: Tirou; hoje: number; ocupado: boolean; onFechar: () => void; onEnviar: (texto: string, pronta: number | null) => void }) {
  const [texto, setTexto] = useState('')
  const [pronta, setPronta] = useState<number | null>(null)
  const restam = MURAL_MAX_DIA - hoje
  return (
    <Folha titulo="Deixar uma pista" eyebrow="Recado anônimo" onFechar={onFechar}>
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
          <span className="as-hint">{texto.length} de {MURAL_MAX_CHARS}. A Bynx não mostra seu @, mas o texto pode dar pistas: sem nome, @, link, telefone ou cidade. Mantenha o mistério.</span>
        </label>
        <div className="as-note">Você ainda pode publicar <strong>{restam === 1 ? '1 mensagem' : `${restam} mensagens`} hoje</strong> ({hoje} de {MURAL_MAX_DIA} usadas). O limite reinicia à meia-noite.</div>
        <button type="submit" className="as-btn pri" disabled={ocupado || !texto.trim() || restam <= 0}><Ico n="send" s={16} />Publicar no mural</button>
      </form>
    </Folha>
  )
}

function FolhaRecebi({ postado, ocupado, onFechar, onConfirmar }: { postado: boolean; ocupado: boolean; onFechar: () => void; onConfirmar: (emMaos: boolean) => void }) {
  return (
    <Folha titulo="Meu presente chegou" onFechar={onFechar}>
      <div className="as-note strong"><strong>Confirme somente quando o presente estiver com você.</strong> Se foi uma entrega em mãos, escolha essa opção.</div>
      {!postado && <p className="as-meta">Quem tirou você ainda não registrou o envio, então só a entrega em mãos pode ser confirmada agora.</p>}
      <button type="button" className="as-btn pri" disabled={ocupado || !postado} onClick={() => onConfirmar(false)}><Ico n="box" s={16} />Chegou pelo correio ou transportadora</button>
      <button type="button" className="as-btn" disabled={ocupado} onClick={() => onConfirmar(true)}>Recebi em mãos</button>
      <button type="button" className="as-btn lnk" onClick={onFechar}>Ainda não chegou</button>
    </Folha>
  )
}

function FolhaAjuda({ antes, onFechar }: { antes: boolean; onFechar: () => void }) {
  return (
    <Folha titulo="Preciso de ajuda" onFechar={onFechar}>
      {antes ? (
        <div className="as-note strong">Mudou de ideia, encontrou um problema ou não vai conseguir cumprir o prazo? <strong>Fale com a organização no grupo antes do sorteio.</strong> Depois do sorteio, a sua saída desfaz um par.</div>
      ) : (
        <div className="as-note strong">Problema com endereço, envio ou entrega? <strong>Fale com a organização em privado.</strong> Não publique dados pessoais no mural.</div>
      )}
      <p className="as-meta">A organização é quem mandou o link no grupo do Poké Creators Club. Dentro da Bynx, o seu WhatsApp fica visível só para ela.</p>
      <button type="button" className="as-btn" onClick={onFechar}>Voltar para a sala</button>
    </Folha>
  )
}
