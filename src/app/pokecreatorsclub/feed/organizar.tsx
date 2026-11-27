'use client'

// Organizar o feed (papel 'feed', wireframe v3 quadros 25, 27 e 28). Um modo do proprio feed:
// primeiro post de quem chega (meta interna: alguem da organizacao apoia de verdade em ate 1 hora),
// denuncias, @ do TikTok para conferir e o que esta fora do feed. Nada mexe em carta do Album e
// tudo vai para o log da organizacao. A segunda-feira traz o tema e a mensagem para o WhatsApp.
// A escolha da semana (27/11/2026): um post do feed, nunca o proprio, com a frase de por que foi escolhido,
// gravados juntos com o tema pela club_feed_semana_salvar_v2.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Folha } from '../_comum/calendario'
import { Ico } from '../amigo-secreto/estilo'
import { MOTIVOS_DENUNCIA, MOTIVOS_TIRAR, REDES, TEMAS, erroFeed, haQuanto, linkFeed, motivoFora, type Destaques, type ListaFeed, type ListaOrganizar, type MotivoTirar, type PostFeed } from '@/lib/pcc/feed'
import { JanelaCarta, tituloPost } from './comum'

const URL_FEED = 'https://bynx.gg/pokecreatorsclub/feed'

function mensagemDaSemana(tema: string | null): string {
  return [
    'Feed do Club, semana nova.',
    tema ? `Tema da semana: ${tema}.` : '',
    'Tem post de gente nova no feed. Passe por lá, apoie quantos quiser e comente sobre o conteúdo. Ninguém deve nada a ninguém.',
    URL_FEED,
  ].filter(Boolean).join('\n\n')
}

export default function Organizar({ agora, onMudou }: { agora: number; onMudou: () => void }) {
  const [dados, setDados] = useState<ListaOrganizar | null>(null)
  const [falhou, setFalhou] = useState('')
  const [tirando, setTirando] = useState<{ id: string; arroba: string } | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')
  const [tema, setTema] = useState('')
  const [copiado, setCopiado] = useState(false)
  // Escolha da semana: o post e a frase (o que esta no banco e o que a pessoa esta editando).
  const [candidatos, setCandidatos] = useState<PostFeed[]>([])
  const [escolha, setEscolha] = useState<string | null>(null)
  const [frase, setFrase] = useState('')
  const [salvo, setSalvo] = useState<{ escolha: string | null; frase: string }>({ escolha: null, frase: '' })

  const carregar = useCallback(async () => {
    setFalhou('')
    const [o, dst, rec] = await Promise.all([
      supabase.rpc('club_feed_organizar_lista'),
      supabase.rpc('club_feed_destaques'),
      supabase.rpc('club_feed_lista', { p_aba: 'recentes', p_limite: 30 }),
    ])
    if (o.error) { setFalhou(erroFeed(o.error.message)); return }
    const d = o.data as ListaOrganizar
    setDados(d)
    setTema(d.semana.tema ?? '')
    const fraseAtual = (!dst.error && (dst.data as Destaques).escolha?.id === d.semana.escolha && (dst.data as Destaques).escolha?.frase) || ''
    setEscolha(d.semana.escolha); setFrase(fraseAtual); setSalvo({ escolha: d.semana.escolha, frase: fraseAtual })
    // Quem organiza nao escolhe o proprio post (o banco recusa).
    setCandidatos(rec.error ? [] : ((rec.data as ListaFeed).itens ?? []).filter(p => !p.meu))
  }, [])
  // Busca ao abrir; o setFalhou('') do inicio e o reset da tentativa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function agir(id: string, acao: 'devolver' | 'manter' | 'arroba_ok' | 'tirar', motivo?: MotivoTirar, nota?: string) {
    setOcupado(id + acao); setAviso('')
    const { error } = await supabase.rpc('club_feed_moderar', { p_id: id, p_acao: acao, p_motivo: motivo ?? null, p_nota: nota ?? null })
    setOcupado(null)
    if (error) { setAviso(erroFeed(error.message)); return false }
    await carregar(); onMudou()
    return true
  }

  async function salvarSemana() {
    setOcupado('semana'); setAviso('')
    const { error } = await supabase.rpc('club_feed_semana_salvar_v2', { p_tema: tema.trim() || null, p_escolha: escolha, p_frase: escolha ? frase.trim() || null : null })
    setOcupado(null)
    if (error) { setAviso(erroFeed(error.message)); return }
    await carregar(); onMudou()
  }

  async function copiar() {
    try { await navigator.clipboard.writeText(mensagemDaSemana(dados?.semana.tema ?? null)); setCopiado(true); setTimeout(() => setCopiado(false), 2500) }
    catch { setAviso('Não deu para copiar. Selecione o texto e copie.') }
  }

  if (falhou) return <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{falhou}<button type="button" className="as-btn sm" onClick={carregar}>Tentar de novo</button></div>
  if (!dados) return <p className="as-meta">Carregando a fila...</p>

  const nada = !dados.primeiros.length && !dados.denunciados.length && !dados.conferir_arroba.length
  return (
    <div className="fd-cab" style={{ gap: 12 }}>
      {aviso && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{aviso}</div>}

      <section className="as-card" aria-label="Fila da organização">
        <div className="as-k">Fila</div>
        {nada && <p className="as-p" style={{ margin: 0 }}>Nada esperando a organização agora.</p>}
        {dados.primeiros.map(p => {
          const href = linkFeed(p.url)
          return (
            <div key={p.id} className="fd-q">
              <span className="as-ri"><Ico n="spark" s={16} /></span>
              <div className="tx">
                <b>Primeiro post de @{p.arroba}</b>
                <span className="fd-relogio"><Ico n="clock" s={14} />{haQuanto(p.feed_em, agora)} · {p.apoiaram === 0 ? 'ninguém apoiou ainda' : p.apoiaram === 1 ? '1 pessoa apoiou' : `${p.apoiaram} pessoas apoiaram`}</span>
                <span className="as-meta">{REDES[p.rede].nome}{p.tema ? ` · ${TEMAS[p.tema]}` : ''}</span>
                {href && <div className="acts"><a className="as-btn pri" href={href} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={14} />Abrir no {REDES[p.rede].nome}</a></div>}
              </div>
            </div>
          )
        })}
        {dados.denunciados.map(d => {
          const href = linkFeed(d.url)
          const motivos = Object.entries(d.motivos ?? {}).map(([m, n]) => `${n} ${n === 1 ? 'denúncia' : 'denúncias'}: ${MOTIVOS_DENUNCIA.find(x => x.m === m)?.rotulo ?? m}`)
          return (
            <div key={d.id} className="fd-q">
              <span className="as-ri"><Ico n="bandeira" s={16} /></span>
              <div className="tx">
                <b>Denunciado · @{d.arroba}{d.oculto ? ' · fora do feed' : ''}</b>
                {motivos.map(m => <span key={m} className="as-meta">{m}</span>)}
                <div className="acts">
                  {href && <a className="as-btn" href={href} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={14} />Abrir</a>}
                  {d.oculto
                    ? <button type="button" className="as-btn" disabled={!!ocupado} onClick={() => agir(d.id, 'devolver')}>Devolver ao feed</button>
                    : <button type="button" className="as-btn" disabled={!!ocupado} onClick={() => agir(d.id, 'manter')}>Manter</button>}
                  <button type="button" className="as-btn pri" disabled={!!ocupado} onClick={() => setTirando({ id: d.id, arroba: d.arroba })}>Tirar do feed</button>
                </div>
              </div>
            </div>
          )
        })}
        {dados.conferir_arroba.map(c => {
          const href = linkFeed(c.url)
          return (
            <div key={c.id} className="fd-q">
              <span className="as-ri"><Ico n="tiktok" s={16} /></span>
              <div className="tx">
                <b>Conferir o @ (TikTok)</b>
                <span className="as-meta">@{c.arroba} postou um vídeo de @{c.arroba_video} e disse que é dele</span>
                <div className="acts">
                  {href && <a className="as-btn" href={href} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={14} />Abrir</a>}
                  <button type="button" className="as-btn" disabled={!!ocupado} onClick={() => agir(c.id, 'arroba_ok')}>Está certo</button>
                  <button type="button" className="as-btn pri" disabled={!!ocupado} onClick={() => setTirando({ id: c.id, arroba: c.arroba })}>Tirar do feed</button>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="as-card" aria-label="Escolha da semana">
        <div className="as-k">Escolha da semana</div>
        <p className="as-hint" style={{ margin: 0 }}>Um post que merece destaque nesta semana. Aparece no topo do feed com a fita e a sua frase. Nunca o seu próprio post.</p>
        <div role="radiogroup" aria-label="Post escolhido">
          <button type="button" role="radio" aria-checked={escolha === null} className="fd-radio" onClick={() => setEscolha(null)}>
            <span className={`fd-rd${escolha === null ? ' on' : ''}`} />Nenhuma escolha nesta semana
          </button>
          {candidatos.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={escolha === p.id} className="fd-radio" onClick={() => setEscolha(p.id)}>
              <span className={`fd-rd${escolha === p.id ? ' on' : ''}`} />
              <span className="fd-minicarta" style={{ flex: 1 }}>
                <span className="fd-cx"><span className="fd-jan"><JanelaCarta p={p} /></span></span>
                <span className="tx"><b>@{p.arroba}</b>{tituloPost(p)} · {REDES[p.rede].nome}{agora ? ` · ${haQuanto(p.feed_em, agora)}` : ''}</span>
              </span>
            </button>
          ))}
          {escolha && !candidatos.some(p => p.id === escolha) && (
            <p className="as-hint" style={{ margin: '8px 0 0' }}>O post escolhido é mais antigo que os 30 últimos do feed. Ele continua escolhido até você trocar.</p>
          )}
        </div>
        {escolha && (
          <>
            <label className="as-k" htmlFor="fd-frase">Por que escolhemos (aparece no feed)</label>
            <textarea id="fd-frase" className="as-in ta" maxLength={160} value={frase} onChange={e => setFrase(e.target.value)}
              placeholder="Ex.: A edição conta a história inteira em poucos segundos. Vale ver até o fim." />
            <p className="as-hint" style={{ margin: 0 }}>{frase.trim().length} de 160. Opcional: sem frase, o destaque mostra só o post.</p>
          </>
        )}
        <button type="button" className="as-btn pri" disabled={ocupado === 'semana' || (escolha === salvo.escolha && frase.trim() === salvo.frase.trim())} onClick={salvarSemana}>
          {ocupado === 'semana' ? 'Salvando...' : 'Salvar a escolha'}
        </button>
      </section>

      <section className="as-card" aria-label="Segunda-feira">
        <div className="as-k">Tema da semana</div>
        <input className="as-in" maxLength={40} placeholder="Ex.: Natal no TCG" value={tema} onChange={e => setTema(e.target.value)} aria-label="Tema da semana" />
        <button type="button" className="as-btn" disabled={ocupado === 'semana'} onClick={salvarSemana}>{ocupado === 'semana' ? 'Salvando...' : 'Salvar o tema'}</button>
        <div className="as-k">Mensagem para a comunidade</div>
        <div className="fd-wa"><div className="fd-bub">{mensagemDaSemana(dados.semana.tema)}</div></div>
        <button type="button" className="as-btn pri" onClick={copiar}><Ico n="copy" s={16} />{copiado ? 'Copiada' : 'Copiar a mensagem'}</button>
        <p className="as-hint">Uma mensagem por semana no lugar da sala de links. Ela não aponta post para apoiar nem marca horário.</p>
      </section>

      {dados.fora.length > 0 && (
        <section className="as-card" aria-label="Fora do feed">
          <div className="as-k">Fora do feed</div>
          {dados.fora.map(f => (
            <div key={f.id} className="fd-q">
              <span className="as-ri"><Ico n={REDES[f.rede].ico} s={16} /></span>
              <div className="tx">
                <b>@{f.arroba}</b>
                <span className="as-meta">{motivoFora(f.motivo)}{f.nota ? ` · ${f.nota}` : ''}</span>
                <div className="acts"><button type="button" className="as-btn" disabled={!!ocupado} onClick={() => agir(f.id, 'devolver')}>Devolver ao feed</button></div>
              </div>
            </div>
          ))}
        </section>
      )}

      {tirando && <FolhaTirar arroba={tirando.arroba} onFechar={() => setTirando(null)} onTirar={async (m, n) => { if (await agir(tirando.id, 'tirar', m, n)) setTirando(null) }} />}
    </div>
  )
}

function FolhaTirar({ arroba, onFechar, onTirar }: { arroba: string; onFechar: () => void; onTirar: (m: MotivoTirar, nota: string) => Promise<void> }) {
  const [motivo, setMotivo] = useState<MotivoTirar | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [nota, setNota] = useState('')
  return (
    <Folha titulo="Tirar do feed" eyebrow={`Post de @${arroba}`} onFechar={onFechar}>
      <div className="as-k">Motivo (o autor vê)</div>
      <div role="radiogroup" aria-label="Motivo">
        {MOTIVOS_TIRAR.map(m => (
          <button key={m.m} type="button" role="radio" aria-checked={motivo === m.m} className="fd-radio" onClick={() => setMotivo(m.m)}>
            <span className={`fd-rd${motivo === m.m ? ' on' : ''}`} />{m.rotulo}
          </button>
        ))}
      </div>
      <label className="as-k" htmlFor="fd-nota">Nota interna (opcional)</label>
      <textarea id="fd-nota" className="as-in ta" maxLength={300} value={nota} onChange={e => setNota(e.target.value)} placeholder="Só a organização lê." />
      <p className="as-hint">O post sai só do feed. Continua no portfólio da pessoa e não mexe no Álbum. Dá para devolver em &quot;Fora do feed&quot;.</p>
      <button type="button" className="as-btn pri cta" disabled={!motivo || ocupado} onClick={async () => { if (!motivo) return; setOcupado(true); await onTirar(motivo, nota); setOcupado(false) }}>{ocupado ? 'Tirando...' : 'Tirar do feed'}</button>
    </Folha>
  )
}
