'use client'

// Folhas do Feed do Club (wireframe v3 e UI v3 aprovados em 26/11/2026). Uma folha por gesto,
// no padrao da casa (Folha de _comum/calendario): apoiar na rede (05, 06, 07), retorno privado (08),
// postar (10, 11, 12), regras (23), denunciar (24), quem apoiou (14) e filtro (17).

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Folha } from '../_comum/calendario'
import { Ico } from '../amigo-secreto/estilo'
import { Capa, tituloPost } from './comum'
import {
  CHAVE_IDEIAS, FORMATOS, GESTOS_POR_REDE, MOTIVOS_DENUNCIA, PERGUNTAS, REDES, RESPOSTAS_BOAS, RESPOSTAS_MELHORAR, TEMAS,
  erroFeed, gravarMarca, lerLinkColado, motivoLinkRecusado, rotuloGesto, rotuloResposta,
  type Formato, type Gesto, type MotivoDenuncia, type Pergunta, type PostFeed, type QuemApoiou, type Rede, type Resposta, type Tema,
} from '@/lib/pcc/feed'

// ── 05: antes do primeiro apoio, uma vez ─────────────────────────────────────

const IDEIAS = [
  { ico: 'chat', t: 'Responda à pergunta de quem postou com a sua opinião' },
  { ico: 'clock', t: 'Cite o momento que mais funcionou para você' },
  { ico: 'star', t: 'Conte a sua história com a carta do vídeo' },
]

export function FolhaIdeias({ p, onFechar, onAbrir }: { p: PostFeed; onFechar: () => void; onAbrir?: () => void }) {
  const fechar = () => { gravarMarca(CHAVE_IDEIAS); onFechar() }
  return (
    <Folha titulo="Apoiar é do seu jeito" eyebrow="Antes de abrir" onFechar={fechar}>
      <p className="as-p" style={{ margin: 0 }}>Abra o post na rede e, se gostar, apoie como quiser. Não é obrigação nem troca: o seu post entra no feed do mesmo jeito, tenha você apoiado alguém ou não.</p>
      {p.pergunta && p.pergunta !== 'so_ver' && <div className="as-note strong"><b>@{p.arroba} pergunta:</b> {PERGUNTAS[p.pergunta]}</div>}
      <div className="as-k">Se for comentar</div>
      <div className="fd-cks">{IDEIAS.map(i => <div key={i.t} className="fd-ck ideia"><Ico n={i.ico} s={18} /><span className="tx">{i.t}</span></div>)}</div>
      <div className="as-note">Evite &quot;top&quot;, &quot;show&quot;, emoji solto e o mesmo texto em vários posts. A rede trata isso como comentário automático e o post perde alcance.</div>
      {onAbrir
        ? <button type="button" className="as-btn pri cta" onClick={() => { gravarMarca(CHAVE_IDEIAS); onAbrir() }}><Ico n="ext" s={18} />Abrir no {REDES[p.rede].nome}</button>
        : <button type="button" className="as-btn pri cta" onClick={fechar}>Entendi</button>}
    </Folha>
  )
}

// ── 06 e 07: "Fez alguma coisa por lá?" ─────────────────────────────────────

export function FolhaApoio({ p, voltando, onFechar, onMarcou, onRetorno, onIdeias }: {
  p: PostFeed
  /** A folha abriu sozinha porque a pessoa voltou do post. */
  voltando: boolean
  onFechar: () => void
  onMarcou: (p: PostFeed, gestos: Gesto[] | null) => void
  onRetorno: (p: PostFeed) => void
  onIdeias: (p: PostFeed) => void
}) {
  const opcoes = GESTOS_POR_REDE[p.rede].filter(o => o.g !== 'segui' || !p.ja_sigo || (p.minha_marca ?? []).includes('segui'))
  const [marcados, setMarcados] = useState<Gesto[]>(p.minha_marca ?? [])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const alternar = (g: Gesto) => setMarcados(m => (m.includes(g) ? m.filter(x => x !== g) : [...m, g]))

  async function salvar(gestos: Gesto[] | null) {
    setOcupado(true); setErro('')
    const { error } = gestos === null
      ? await supabase.rpc('club_feed_desmarcar', { p_id: p.id })
      : await supabase.rpc('club_feed_marcar', { p_id: p.id, p_gestos: gestos })
    setOcupado(false)
    if (error) { setErro(erroFeed(error.message)); return }
    onMarcou(p, gestos)
  }

  return (
    <Folha titulo="Fez alguma coisa por lá?" eyebrow={voltando ? `Você voltou do ${REDES[p.rede].nome} de @${p.arroba}` : `Post de @${p.arroba}`} onFechar={onFechar}>
      <p className="as-p" style={{ margin: 0 }}>Marque só o que fez. É uma declaração sua, sem print e sem prova. Não ter feito nada também está certo.</p>
      <div className="fd-cks" role="group" aria-label="O que você fez no post">
        {opcoes.map(o => {
          const on = marcados.includes(o.g)
          return (
            <button key={o.g} type="button" className={`fd-ck${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternar(o.g)}>
              <span className={`fd-box${on ? ' on' : ''}`}>{on && <Ico n="check" s={14} />}</span>
              <Ico n={o.ico} s={18} />
              <span className="tx">{o.rotulo}{o.g === 'comentei' && <small>@{p.arroba} pode confirmar que recebeu</small>}</span>
            </button>
          )
        })}
      </div>
      {erro && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{erro}</div>}
      <button type="button" className="as-btn pri cta" disabled={ocupado || marcados.length === 0} onClick={() => salvar(marcados)}>
        {ocupado ? 'Salvando...' : 'Marcar apoio'}
      </button>
      {p.retorno && marcados.length > 0 && (
        <button type="button" className="as-btn" disabled={ocupado} onClick={async () => { await salvar(marcados); onRetorno(p) }}>Marcar e deixar retorno privado</button>
      )}
      <div className="fd-two" style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="as-btn" disabled={ocupado} onClick={() => salvar([])}>Só vi</button>
        <button type="button" className="as-btn" disabled={ocupado} onClick={onFechar}>Ver depois</button>
      </div>
      {p.minha_marca !== null && <button type="button" className="as-btn lnk" disabled={ocupado} onClick={() => salvar(null)}>Desfazer a marca e voltar para Para ver</button>}
      <button type="button" className="fd-ideia" onClick={() => onIdeias(p)}><Ico n="info" s={16} />Ideias para comentar</button>
    </Folha>
  )
}

// ── 09: depois de apoiar, o proximo a um toque ───────────────────────────────

export function FolhaProximo({ proximo, onFechar, onAbrir }: { proximo: PostFeed | null; onFechar: () => void; onAbrir: (p: PostFeed) => void }) {
  if (!proximo) {
    return (
      <Folha titulo="Obrigado por ajudar" eyebrow="Apoio marcado" onFechar={onFechar}>
        <div className="fd-vazio" style={{ border: 0 }}>
          <span className="as-ri"><Ico n="check" s={26} /></span>
          <p className="as-p">Você passou por tudo o que está no feed. Quando entrar post novo, ele aparece em Para ver.</p>
        </div>
        <button type="button" className="as-btn pri cta" onClick={onFechar}>Voltar ao feed</button>
      </Folha>
    )
  }
  return (
    <Folha titulo="Apoio marcado" eyebrow="Obrigado" onFechar={onFechar}>
      <div className="as-mis">
        <div className="as-k" style={{ color: 'var(--ac-1)' }}>Próximo no feed</div>
        <div className="fd-h">
          <Capa id={proximo.id} rede={proximo.rede} formato={proximo.formato} arroba={proximo.arroba} pequena />
          <div className="fd-tx">
            <span className="fd-who">@{proximo.arroba}<span className="tm">{REDES[proximo.rede].nome}</span></span>
            <b>{tituloPost(proximo)}</b>
            {proximo.pergunta && proximo.pergunta !== 'so_ver' && <span className="fd-ask">pergunta: <b>{PERGUNTAS[proximo.pergunta]}</b></span>}
          </div>
        </div>
        <button type="button" className="as-btn pri" onClick={() => onAbrir(proximo)}><Ico n="ext" s={16} />Abrir o próximo</button>
      </div>
      <button type="button" className="as-btn" onClick={onFechar}>Voltar à fila</button>
    </Folha>
  )
}

// ── 08: retorno privado ──────────────────────────────────────────────────────

export function FolhaRetorno({ p, onFechar, onEnviou }: { p: PostFeed; onFechar: () => void; onEnviou: (p: PostFeed) => void }) {
  const [escolhas, setEscolhas] = useState<Resposta[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const alternar = (r: Resposta) => setEscolhas(e => (e.includes(r) ? e.filter(x => x !== r) : e.length >= 3 ? e : [...e, r]))
  async function enviar() {
    setOcupado(true); setErro('')
    const { error } = await supabase.rpc('club_feed_retornar', { p_id: p.id, p_respostas: escolhas })
    setOcupado(false)
    if (error) { setErro(erroFeed(error.message)); return }
    onEnviou(p)
  }
  const pilula = (r: Resposta) => (
    <button key={r} type="button" className={`fd-pk${escolhas.includes(r) ? ' on' : ''}`} aria-pressed={escolhas.includes(r)} onClick={() => alternar(r)}>
      {escolhas.includes(r) && <Ico n="check" s={14} />}{rotuloResposta(r)}
    </button>
  )
  return (
    <Folha titulo={`Retorno privado para @${p.arroba}`} eyebrow="Só quem postou vê" onFechar={onFechar}>
      {p.pergunta && p.pergunta !== 'so_ver' && <div className="as-note strong"><b>@{p.arroba} pergunta:</b> {PERGUNTAS[p.pergunta]}</div>}
      <p className="as-p" style={{ margin: 0 }}>Escolha até 3. Só @{p.arroba} vê, com o seu @. É à parte do apoio na rede e não substitui o comentário.</p>
      <div className="fd-grp"><div className="as-k">Funcionou</div><div className="fd-pick">{RESPOSTAS_BOAS.map(x => pilula(x.r))}</div></div>
      <div className="fd-grp"><div className="as-k">Pode melhorar</div><div className="fd-pick">{RESPOSTAS_MELHORAR.map(x => pilula(x.r))}</div></div>
      {erro && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{erro}</div>}
      <button type="button" className="as-btn pri cta" disabled={ocupado || escolhas.length === 0} onClick={enviar}>{ocupado ? 'Enviando...' : 'Enviar retorno'}</button>
    </Folha>
  )
}

// ── 23: regras ───────────────────────────────────────────────────────────────

const REGRAS = [
  'Apoie quantos posts quiser e poste sempre que tiver conteúdo novo. Quanto mais gente ajudando, mais longe todo mundo vai.',
  'Apoiar é escolha, não dívida. O seu post entra no feed tendo você apoiado alguém ou não.',
  'Apoio é declaração sua: sem print, sem prova. Marque só o que fez.',
  'Comente sobre o conteúdo e responda à pergunta de quem postou. "Top", "show" e emoji solto não ajudam o post.',
  'Poste só o que foi publicado pelo seu perfil.',
  'Ninguém cobra apoio nem propõe troca. Viu alguém fazendo isso? Denuncie pelo menu do post: quem cobra pode sair do feed.',
]

export function FolhaRegras({ onFechar, onAceitar }: { onFechar: () => void; onAceitar?: () => void }) {
  return (
    <Folha titulo="Regras do feed" eyebrow="Feed do Club" onFechar={onFechar}>
      <div className="fd-regras">{REGRAS.map((r, i) => <div key={i} className="r"><span className="as-ri">{i + 1}</span><span>{r}</span></div>)}</div>
      <button type="button" className="as-btn pri cta" onClick={onAceitar ?? onFechar}>Bora ajudar</button>
    </Folha>
  )
}

// ── 10, 11, 12: postar ───────────────────────────────────────────────────────

const ORDEM_PERGUNTAS: Pergunta[] = ['gancho', 'edicao', 'capa', 'tamanho', 'parte2', 'so_ver']
const ORDEM_TEMAS: Tema[] = ['abertura', 'tour_fichario', 'historia_carta', 'resposta_publico', 'colecao', 'outro']
const ORDEM_FORMATOS: Formato[] = ['video_curto', 'video_longo', 'carrossel', 'foto', 'live']

export function FolhaPostar({ arroba, temaSemana, onFechar, onPostou }: {
  arroba: string
  temaSemana: string | null
  onFechar: () => void
  onPostou: (r: { primeiro: boolean; rede: Rede }) => void
}) {
  const [url, setUrl] = useState('')
  const [tocou, setTocou] = useState(false)
  const lido = useMemo(() => lerLinkColado(url), [url])
  const [formato, setFormato] = useState<Formato | null>(null)
  const [trocandoFormato, setTrocandoFormato] = useState(false)
  const [tema, setTema] = useState<Tema | null>(null)
  const [naSemana, setNaSemana] = useState(false)
  const [pergunta, setPergunta] = useState<Pergunta | null>(null)
  const [retorno, setRetorno] = useState(true)
  const [declarou, setDeclarou] = useState(false)
  const [confirmaArroba, setConfirmaArroba] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const formatoFinal = formato ?? lido?.formato ?? null
  const arrobaDiferente = lido?.rede === 'tiktok' && lido.arroba && lido.arroba !== arroba ? lido.arroba : null
  const pronto = !!lido && !!formatoFinal && !!pergunta && declarou && (!arrobaDiferente || confirmaArroba)

  async function postar() {
    if (!lido || !formatoFinal || !pergunta) return
    setOcupado(true); setErro('')
    const { data, error } = await supabase.rpc('club_feed_postar', {
      p: { url: url.trim(), formato: formatoFinal, tema, pergunta, retorno, declarou, tema_semana: naSemana, confirmo_arroba: confirmaArroba },
    })
    setOcupado(false)
    if (error) { setErro(erroFeed(error.message)); return }
    const r = data as { post: { primeiro: boolean; rede: Rede } }
    onPostou({ primeiro: !!r.post.primeiro, rede: r.post.rede })
  }

  const linkErrado = tocou && url.trim() !== '' && !lido
  return (
    <Folha titulo="Qual post você quer mostrar?" eyebrow="Postar no feed" onFechar={onFechar}>
      <div className="fd-grp">
        <label className="as-k" htmlFor="fd-link">Link do post</label>
        <input id="fd-link" className={`as-in${linkErrado ? ' err' : ''}`} inputMode="url" autoComplete="off" placeholder="https://www.instagram.com/reel/..."
          value={url} onChange={e => { setUrl(e.target.value); setFormato(null); setConfirmaArroba(false) }} onBlur={() => setTocou(true)} />
        {linkErrado
          ? <p className="as-hint err" role="alert">{motivoLinkRecusado(url)}</p>
          : lido
            ? <p className="as-hint"><Ico n={REDES[lido.rede].ico} s={14} /> {REDES[lido.rede].nome} · {FORMATOS[formatoFinal!]} <button type="button" className="as-btn lnk sm" style={{ minHeight: 44 }} onClick={() => setTrocandoFormato(v => !v)}>Trocar formato</button></p>
            : <p className="as-hint">Post do Instagram, TikTok, YouTube ou Twitch.</p>}
        {trocandoFormato && lido && (
          <div className="fd-pick">{ORDEM_FORMATOS.map(f => (
            <button key={f} type="button" className={`fd-pk${formatoFinal === f ? ' on' : ''}`} aria-pressed={formatoFinal === f} onClick={() => { setFormato(f); setTrocandoFormato(false) }}>{FORMATOS[f]}</button>
          ))}</div>
        )}
      </div>

      {arrobaDiferente && (
        <div className="fd-falha" role="status">
          <Ico n="alert" s={16} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>O vídeo é de <b>@{arrobaDiferente}</b> e o seu @ no Club é <b>@{arroba}</b>. Se o canal é seu, confirme. A organização confere.</span>
            <button type="button" className="fd-chk" onClick={() => setConfirmaArroba(v => !v)} aria-pressed={confirmaArroba}>
              <span className={`fd-box${confirmaArroba ? ' on' : ''}`}>{confirmaArroba && <Ico n="check" s={14} />}</span>
              <span><b>@{arrobaDiferente} também é meu</b></span>
            </button>
          </div>
        </div>
      )}

      <div className="fd-grp">
        <div className="as-k">Tema</div>
        <div className="fd-pick">
          {temaSemana && (
            <button type="button" className={`fd-pk${naSemana ? ' on' : ''}`} aria-pressed={naSemana} onClick={() => setNaSemana(v => !v)}>
              <Ico n="star" s={14} />{temaSemana}
            </button>
          )}
          {ORDEM_TEMAS.map(t => (
            <button key={t} type="button" className={`fd-pk${tema === t ? ' on' : ''}`} aria-pressed={tema === t} onClick={() => setTema(tema === t ? null : t)}>{TEMAS[t]}</button>
          ))}
        </div>
      </div>

      <div className="fd-grp">
        <div className="as-k">O que você quer saber de quem comentar?</div>
        <div className="fd-pick">{ORDEM_PERGUNTAS.map(q => (
          <button key={q} type="button" className={`fd-pk${pergunta === q ? ' on' : ''}`} aria-pressed={pergunta === q} onClick={() => setPergunta(q)}>{PERGUNTAS[q]}</button>
        ))}</div>
      </div>

      <button type="button" role="switch" aria-checked={retorno} className={`fd-tg${retorno ? ' on' : ''}`} onClick={() => setRetorno(v => !v)}>
        <span className="tx"><b>Aceitar também retorno privado</b>Respostas prontas que só você vê. Dá para desligar depois.</span>
        <span className={`fd-sw${retorno ? ' on' : ''}`} aria-hidden="true" />
      </button>

      <button type="button" className="fd-chk" aria-pressed={declarou} onClick={() => setDeclarou(v => !v)}>
        <span className={`fd-box${declarou ? ' on' : ''}`}>{declarou && <Ico n="check" s={14} />}</span>
        <span>Este post foi publicado pelo meu perfil, <b>@{arroba}</b>.</span>
      </button>

      {erro && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{erro}</div>}
      <button type="button" className="as-btn pri cta" disabled={!pronto || ocupado} onClick={postar}>{ocupado ? 'Postando...' : 'Postar no feed'}</button>
    </Folha>
  )
}

export function FolhaPostado({ primeiro, onFechar }: { primeiro: boolean; onFechar: () => void }) {
  return (
    <Folha titulo="Seu post está no feed" eyebrow="Postado" onFechar={onFechar}>
      <div className="fd-vazio" style={{ border: 0 }}>
        <span className="as-ri"><Ico n="check" s={26} /></span>
        <p className="as-p">{primeiro
          ? 'É o seu primeiro post no feed. Ele aparece com destaque e a organização do Club vai passar por lá.'
          : 'Ele já aparece para todo mundo. Quando alguém marcar apoio, você recebe um aviso.'}</p>
      </div>
      <button type="button" className="as-btn pri cta" onClick={onFechar}>Ver o feed</button>
    </Folha>
  )
}

// ── 24: denunciar ────────────────────────────────────────────────────────────

export function FolhaDenunciar({ p, onFechar, onEnviou }: { p: PostFeed; onFechar: () => void; onEnviou: () => void }) {
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function enviar() {
    if (!motivo) return
    setOcupado(true); setErro('')
    const { error } = await supabase.rpc('club_feed_denunciar', { p_id: p.id, p_motivo: motivo })
    setOcupado(false)
    if (error) { setErro(erroFeed(error.message)); return }
    onEnviou()
  }
  return (
    <Folha titulo="O que tem de errado?" eyebrow={`${tituloPost(p)} · @${p.arroba}`} onFechar={onFechar}>
      <div role="radiogroup" aria-label="Motivo da denúncia">
        {MOTIVOS_DENUNCIA.map(m => (
          <button key={m.m} type="button" role="radio" aria-checked={motivo === m.m} className="fd-radio" onClick={() => setMotivo(m.m)}>
            <span className={`fd-rd${motivo === m.m ? ' on' : ''}`} />{m.rotulo}
          </button>
        ))}
      </div>
      <p className="as-hint">Exemplo do primeiro motivo: &quot;curte o meu que eu curto o seu&quot;, legenda que pede apoio do Club, mensagem cobrando quem não apoiou. Quem postou não fica sabendo quem denunciou.</p>
      {erro && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{erro}</div>}
      <button type="button" className="as-btn pri cta" disabled={!motivo || ocupado} onClick={enviar}>{ocupado ? 'Enviando...' : 'Enviar denúncia'}</button>
    </Folha>
  )
}

// ── 14: quem apoiou (so o autor) ─────────────────────────────────────────────

export function FolhaQuemApoiou({ post, dados, falhou, onFechar, onConfirmar }: {
  post: { id: string; rede: Rede; titulo: string }
  dados: QuemApoiou | null
  falhou: boolean
  onFechar: () => void
  onConfirmar: (arroba: string) => Promise<string | null>
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  async function confirmar(a: string) {
    setOcupado(a); setErro('')
    const e = await onConfirmar(a)
    setOcupado(null)
    if (e) setErro(e)
  }
  const s = dados?.soma
  return (
    <Folha titulo="Quem apoiou" eyebrow={post.titulo} onFechar={onFechar}>
      {falhou && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />Não deu para carregar agora. Feche e abra de novo.</div>}
      {!dados && !falhou && <p className="as-meta">Carregando...</p>}
      {dados && (
        <>
          {s && s.pessoas > 0 && (
            <p className="as-p" style={{ margin: 0 }}>
              <b style={{ color: 'var(--bx-text)' }}>{s.pessoas === 1 ? '1 pessoa apoiou' : `${s.pessoas} pessoas apoiaram`}</b>
              {[s.curti && `${s.curti} ${rotuloGesto(post.rede, 'curti').toLowerCase()}`, s.comentei && `${s.comentei} ${rotuloGesto(post.rede, 'comentei').toLowerCase()}`,
                s.compartilhei && `${s.compartilhei} compartilharam`, post.rede !== 'twitch' && s.salvei && `${s.salvei} ${rotuloGesto(post.rede, 'salvei').toLowerCase()}`]
                .filter(Boolean).map(t => ` · ${t}`).join('')}
            </p>
          )}
          {dados.apoios.length === 0
            ? <div className="fd-vazio"><p className="as-p">Ninguém marcou apoio ainda. O post continua no feed para todo mundo.</p></div>
            : (
              <div>
                {dados.apoios.map(a => (
                  <div key={a.arroba} className="fd-pessoa">
                    <div className="l"><div><b>@{a.arroba}</b><span className="as-meta">{a.gestos.map(g => rotuloGesto(post.rede, g)).join(' · ')}</span></div></div>
                    {a.comentou && (a.confirmado_em
                      ? <span className="as-btn on sm" aria-label={`Comentário de @${a.arroba} confirmado`}><Ico n="check" s={14} />Confirmado</span>
                      : <button type="button" className="as-btn sm" disabled={ocupado === a.arroba} onClick={() => confirmar(a.arroba)}>Recebi</button>)}
                  </div>
                ))}
              </div>
            )}
          {erro && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{erro}</div>}
          {dados.retornos.length > 0 && (
            <>
              <div className="as-k">Retorno privado</div>
              {dados.retornos.map(r => (
                <div key={r.arroba} className="fd-pessoa"><div className="l"><div><b>@{r.arroba}</b><span className="as-meta">{r.respostas.map(rotuloResposta).join(' · ')}</span></div></div></div>
              ))}
            </>
          )}
          <p className="as-hint">&quot;Recebi&quot; confirma que o comentário chegou. Quem apoiou recebe um aviso. Não existe &quot;não recebi&quot;.</p>
        </>
      )}
    </Folha>
  )
}

// ── 17: filtro ───────────────────────────────────────────────────────────────

export type Filtro = { rede: Rede | null; tema: Tema | 'semana' | null }

export function FolhaFiltro({ filtro, temaSemana, onFechar, onAplicar }: {
  filtro: Filtro; temaSemana: string | null; onFechar: () => void; onAplicar: (f: Filtro) => void
}) {
  const [f, setF] = useState<Filtro>(filtro)
  return (
    <Folha titulo="Filtrar o feed" onFechar={onFechar}>
      <div className="fd-grp">
        <div className="as-k">Rede</div>
        <div className="fd-pick">
          <button type="button" className={`fd-pk${!f.rede ? ' on' : ''}`} aria-pressed={!f.rede} onClick={() => setF({ ...f, rede: null })}>Todas</button>
          {(Object.keys(REDES) as Rede[]).map(r => (
            <button key={r} type="button" className={`fd-pk${f.rede === r ? ' on' : ''}`} aria-pressed={f.rede === r} onClick={() => setF({ ...f, rede: r })}>
              <Ico n={REDES[r].ico} s={14} />{REDES[r].nome}
            </button>
          ))}
        </div>
      </div>
      <div className="fd-grp">
        <div className="as-k">Tema</div>
        <div className="fd-pick">
          <button type="button" className={`fd-pk${!f.tema ? ' on' : ''}`} aria-pressed={!f.tema} onClick={() => setF({ ...f, tema: null })}>Todos</button>
          {temaSemana && <button type="button" className={`fd-pk${f.tema === 'semana' ? ' on' : ''}`} aria-pressed={f.tema === 'semana'} onClick={() => setF({ ...f, tema: 'semana' })}><Ico n="star" s={14} />{temaSemana}</button>}
          {ORDEM_TEMAS.map(t => (
            <button key={t} type="button" className={`fd-pk${f.tema === t ? ' on' : ''}`} aria-pressed={f.tema === t} onClick={() => setF({ ...f, tema: t })}>{TEMAS[t]}</button>
          ))}
        </div>
      </div>
      <div className="fd-two" style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="as-btn" onClick={() => onAplicar({ rede: null, tema: null })}>Limpar</button>
        <button type="button" className="as-btn pri" onClick={() => onAplicar(f)}>Ver posts</button>
      </div>
    </Folha>
  )
}
