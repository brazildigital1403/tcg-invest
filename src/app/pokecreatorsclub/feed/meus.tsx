'use client'

// Meus posts e Seu apoio (wireframe v3 quadros 13 e 15). Meus posts: quantas PESSOAS apoiaram
// (nunca a soma de curtidas), comentarios para confirmar, retorno privado liga e desliga, tirar
// do feed. Seu apoio: so a propria pessoa ve, sem ranking nem comparacao.

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Ico } from '../amigo-secreto/estilo'
import { Capa, tituloPost } from './comum'
import { PERGUNTAS, REDES, erroFeed, haQuanto, linkFeed, motivoFora, type MeuApoio, type MeuPost } from '@/lib/pcc/feed'

export default function MeusPosts({ posts, apoio, arroba, agora, onQuemApoiou, onMudou, onPostar }: {
  arroba: string
  posts: MeuPost[] | null
  apoio: MeuApoio | null
  agora: number
  onQuemApoiou: (p: MeuPost) => void
  onMudou: () => void
  onPostar: () => void
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [tirarId, setTirarId] = useState<string | null>(null)

  async function retorno(p: MeuPost) {
    setOcupado(p.id); setErro('')
    const { error } = await supabase.rpc('club_feed_retorno_ligar', { p_id: p.id, p_ligado: !p.retorno })
    setOcupado(null)
    if (error) { setErro(erroFeed(error.message)); return }
    onMudou()
  }
  async function tirar(id: string) {
    setOcupado(id); setErro('')
    const { error } = await supabase.rpc('club_feed_tirar_meu', { p_id: id })
    setOcupado(null); setTirarId(null)
    if (error) { setErro(erroFeed(error.message)); return }
    onMudou()
  }

  return (
    <div className="fd-cab" style={{ gap: 12 }}>
      <section className="as-card" aria-label="Seu apoio">
        <div className="as-k">Seu apoio</div>
        {apoio && apoio.creators > 0
          ? (
            <div className="fd-stat">
              <div><span className="as-cnt">{apoio.creators}<small>{apoio.creators === 1 ? 'creator apoiado' : 'creators apoiados'}</small></span></div>
              <div><span className="as-cnt">{apoio.comentarios_confirmados}<small>{apoio.comentarios_confirmados === 1 ? 'comentário confirmado' : 'comentários confirmados'}</small></span></div>
            </div>
          )
          : <p className="as-p" style={{ margin: 0 }}>Quando você marcar apoio em um post, ele aparece aqui. Só você vê.</p>}
      </section>

      {erro && <div className="fd-falha vermelho" role="alert"><Ico n="alert" s={16} />{erro}</div>}
      {posts === null && <p className="as-meta">Carregando os seus posts...</p>}
      {posts && posts.length === 0 && (
        <div className="fd-vazio">
          <span className="as-ri"><Ico n="plus" s={24} /></span>
          <p className="as-p">Você ainda não postou no feed. Mostre um post seu para o Club.</p>
          <button type="button" className="as-btn pri" onClick={onPostar}>Postar no feed</button>
        </div>
      )}
      {posts && posts.map(p => {
        const href = linkFeed(p.url)
        return (
          <article key={p.id} className="fd-post meu">
            <div className="fd-h">
              <Capa id={p.id} rede={p.rede} formato={p.formato} arroba={arroba} />
              <div className="fd-tx">
                <span className="fd-who">{REDES[p.rede].nome}<span className="tm">{haQuanto(p.feed_em, agora)}</span></span>
                <h3 className="fd-tt">{tituloPost(p)}</h3>
                {p.pergunta && <p className="fd-ask">{p.pergunta === 'so_ver' ? 'Só quero que vejam' : <>Sua pergunta: <b>{PERGUNTAS[p.pergunta]}</b></>}</p>}
                {p.oculto
                  ? <div className="fd-falha"><Ico n="alert" s={16} />Fora do feed. {motivoFora(p.oculto_motivo)}</div>
                  : (
                    <button type="button" className="fd-meus-apoios" onClick={() => onQuemApoiou(p)}>
                      {p.apoiaram === 0 ? 'Ninguém marcou apoio ainda' : p.apoiaram === 1 ? '1 pessoa apoiou' : `${p.apoiaram} pessoas apoiaram`}
                      {p.a_confirmar > 0 && <span className="as-chip wait">{p.a_confirmar === 1 ? '1 comentário para confirmar' : `${p.a_confirmar} comentários para confirmar`}</span>}
                      <Ico n="chev" s={14} />
                    </button>
                  )}
              </div>
            </div>
            {!p.oculto && (
              <>
                <button type="button" role="switch" aria-checked={p.retorno} className={`fd-tg${p.retorno ? ' on' : ''}`} disabled={ocupado === p.id} onClick={() => retorno(p)}>
                  <span className="tx"><b>Retorno privado {p.retorno ? 'ligado' : 'desligado'}</b>{p.retornos > 0 ? `${p.retornos} ${p.retornos === 1 ? 'retorno recebido' : 'retornos recebidos'}.` : 'Respostas prontas que só você vê.'}</span>
                  <span className={`fd-sw${p.retorno ? ' on' : ''}`} aria-hidden="true" />
                </button>
                <div className="fd-acts">
                  {href && <a className="as-btn grow" href={href} target="_blank" rel="noopener noreferrer"><Ico n="ext" s={16} />Abrir no {REDES[p.rede].nome}</a>}
                  {tirarId === p.id
                    ? <button type="button" className="as-btn pri" disabled={ocupado === p.id} onClick={() => tirar(p.id)}>Confirmar</button>
                    : <button type="button" className="as-btn" onClick={() => setTirarId(p.id)}><Ico n="trash" s={16} />Tirar do feed</button>}
                </div>
                {tirarId === p.id && <p className="as-hint">O post sai do feed e continua no seu portfólio. Dá para postar de novo depois.</p>}
              </>
            )}
          </article>
        )
      })}
    </div>
  )
}
