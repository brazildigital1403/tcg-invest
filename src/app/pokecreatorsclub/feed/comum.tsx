'use client'

// Pecas do Feed do Club (UI v3 aprovada em 26/11/2026): CSS com prefixo fd-, a capa tipografica
// do card (nada do Instagram carrega na pagina) e o card do post. A cara e a da casa do Club,
// sem pele propria: tokens --bx-* / --ac-*, AS_CSS, DM Sans e icones outline do Ico.

import { Ico } from '../amigo-secreto/estilo'
import { FORMATOS, PERGUNTAS, REDES, TEMAS, haQuanto, linkFeed, rotuloGesto, type PostFeed, type Rede, type Formato } from '@/lib/pcc/feed'

const ANGULOS = [135, 200, 160, 225, 110, 185, 150, 240]

/** Angulo da capa a partir do id, para cada post ter o seu e ele nao mudar entre renders. */
function anguloDe(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ANGULOS[h % ANGULOS.length]
}

export function Capa({ id, rede, formato, arroba, pequena = false }: { id: string; rede: Rede; formato: Formato; arroba: string; pequena?: boolean }) {
  return (
    <span className={`fd-capa${pequena ? ' sm' : ''}`} style={{ ['--a' as string]: `${anguloDe(id)}deg` }} aria-hidden="true">
      <span className="ini">{(arroba || '?').charAt(0).toUpperCase()}</span>
      <span className="rede"><Ico n={REDES[rede].ico} s={pequena ? 16 : 20} /></span>
      {!pequena && <span className="fmt">{FORMATOS[formato]}</span>}
    </span>
  )
}

/** Titulo do card: tema quando tem, senao o formato. */
export const tituloPost = (p: Pick<PostFeed, 'tema' | 'formato'>) => (p.tema && p.tema !== 'outro' ? TEMAS[p.tema] : FORMATOS[p.formato])

export function CardPost({ p, modo, onAbrir, onApoiar, onRetorno, onMenu, onQuemApoiou, agora }: {
  p: PostFeed
  /** visitante: so abrir; membro: abrir + apoiei; conta: abrir (+ menu de denuncia). */
  modo: 'visitante' | 'conta' | 'membro'
  onAbrir: (p: PostFeed, e: { preventDefault: () => void }) => void
  onApoiar: (p: PostFeed) => void
  onRetorno: (p: PostFeed) => void
  onMenu?: (p: PostFeed) => void
  onQuemApoiou?: (p: PostFeed) => void
  agora: number
}) {
  const href = linkFeed(p.url)
  const rede = REDES[p.rede].nome
  const marcou = p.minha_marca !== null
  const apoiou = !!p.minha_marca && p.minha_marca.length > 0
  return (
    <article className={`fd-post${p.primeiro && !p.meu ? ' novato' : ''}${p.meu ? ' meu' : ''}`}>
      {(p.primeiro || p.escolha || p.tema_semana) && (
        <div className="as-chips">
          {p.primeiro && <span className="as-chip fill">Primeiro post no feed</span>}
          {p.escolha && <span className="as-chip wait"><Ico n="star" s={12} />Escolha da semana</span>}
          {p.tema_semana && <span className="as-chip">No tema da semana</span>}
        </div>
      )}
      {onMenu && !p.meu && (
        <button type="button" className="as-ib fd-mais" aria-label="Mais opções do post" onClick={() => onMenu(p)}><Ico n="pontos" s={20} /></button>
      )}
      <div className="fd-h">
        <Capa id={p.id} rede={p.rede} formato={p.formato} arroba={p.arroba} />
        <div className="fd-tx">
          <span className="fd-who">@{p.arroba}<span className="tm">{rede} · {haQuanto(p.feed_em, agora)}</span></span>
          <h3 className="fd-tt">{tituloPost(p)}</h3>
          {p.pergunta && (
            p.pergunta === 'so_ver'
              ? <p className="fd-ask">@{p.arroba} só quer que vejam.</p>
              : <p className="fd-ask">@{p.arroba} pergunta: <b>{PERGUNTAS[p.pergunta]}</b></p>
          )}
          {p.meu && p.apoiaram !== null && (
            <button type="button" className="fd-meus-apoios" onClick={() => onQuemApoiou?.(p)}>
              {p.apoiaram === 0 ? 'Ninguém marcou apoio ainda' : p.apoiaram === 1 ? '1 pessoa apoiou' : `${p.apoiaram} pessoas apoiaram`}
              <Ico n="chev" s={14} />
            </button>
          )}
          {apoiou && p.minha_marca && (
            <span className="fd-gs">{p.minha_marca.filter(g => g !== 'segui').map(g => <span key={g}><Ico n="check" s={12} />{rotuloGesto(p.rede, g)}</span>)}</span>
          )}
        </div>
      </div>
      <div className="fd-acts">
        {href
          ? <a className={`as-btn grow${modo === 'membro' && !p.meu && !marcou ? ' pri' : ''}`} href={href} target="_blank" rel="noopener noreferrer"
              onClick={e => onAbrir(p, e)} aria-label={`Abrir o post de @${p.arroba} no ${rede}, em outra aba`}>
              <Ico n="ext" s={16} />Abrir no {rede}
            </a>
          : <span className="as-btn grow" aria-disabled="true">Link indisponível</span>}
        {modo === 'membro' && !p.meu && (
          <button type="button" className={`as-btn${apoiou ? ' on' : ''}`} onClick={() => onApoiar(p)} aria-label={apoiou ? 'Editar o apoio que você marcou' : 'Marcar o que você fez no post'}>
            <Ico n={apoiou ? 'check' : 'coracao'} s={16} />{apoiou ? 'Apoiado' : marcou ? 'Só vi' : 'Apoiei'}
          </button>
        )}
      </div>
      {modo === 'membro' && !p.meu && p.retorno && (
        <div className="fd-ret">
          <span>{p.meu_retorno ? 'Você deixou retorno privado.' : 'Quem postou aceita retorno privado aqui no Club.'}</span>
          <button type="button" className="as-btn sm" onClick={() => onRetorno(p)}>{p.meu_retorno ? 'Editar' : 'Retorno'}</button>
        </div>
      )}
    </article>
  )
}

export const FD_CSS = `
.fd .as-k,.fd .as-eye{font-size:12px}
.fd .as-chip{font-size:12px}
.fd .as-hint{font-size:12.5px;color:var(--bx-text-2)}
.fd .as-meta{color:var(--bx-text-2)}
.fd .as-k{color:var(--bx-text-2)}
.fd .as-in::placeholder{color:var(--bx-text-3)}
.fd-cab{display:flex;flex-direction:column;gap:6px}
.fd-cab .as-p{font-size:14px}
.fd-cab .lnk{color:var(--bx-text);text-decoration:underline;text-underline-offset:3px;background:none;border:0;font:inherit;padding:0;cursor:pointer;min-height:44px}
.fd-tema{flex-direction:row;align-items:center;gap:12px;padding:10px 12px}
.fd-tema .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fd-tema .tx b{font-size:15.5px;font-weight:800;letter-spacing:-.01em}
.fd-tema .as-k{color:var(--ac-1)}
.fd-tema .as-btn{flex:none;width:auto}
.fd-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border-radius:14px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.fd-seg button{min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;font:inherit;font-size:13.5px;font-weight:700;color:var(--bx-text-2);background:transparent;border:0;cursor:pointer;transition:background .15s ease,color .15s ease;white-space:nowrap}
.fd-seg button.on{background:rgba(var(--ac-1-rgb),.12);color:var(--bx-text);box-shadow:inset 0 0 0 1px rgba(var(--ac-1-rgb),.45)}
.fd-seg button:focus-visible{outline:2px solid var(--bx-text);outline-offset:2px}
.fd-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--ac-grad);flex:none}
.fd-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px}
.fd-bar .as-btn{width:auto}
.fd-lista{display:flex;flex-direction:column;gap:12px}
.fd-post{position:relative;border:1px solid var(--bx-border);border-radius:16px;background:var(--bx-surface);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0;transition:border-color .15s ease,background .15s ease}
.fd-post:hover{border-color:var(--bx-border-2);background:var(--bx-surface-2)}
.fd-post.novato{border-color:transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:var(--bx-shadow)}
.fd-post.meu{background:rgba(var(--ac-1-rgb),.05);border-color:rgba(var(--ac-1-rgb),.3)}
.fd-post .fd-mais{position:absolute;top:4px;right:4px}
.fd-post:has(.fd-mais) .fd-tx{padding-right:30px}
.fd-post:has(.fd-mais) > .as-chips{padding-right:40px}
.fd-h{display:flex;gap:12px;align-items:flex-start}
.fd-capa{position:relative;width:84px;height:112px;border-radius:12px;overflow:hidden;flex:none;border:1px solid var(--bx-border-2);background:radial-gradient(at 28% 18%,rgba(var(--ac-1-rgb),.32),transparent 55%),radial-gradient(at 82% 82%,rgba(var(--ac-2-rgb),.30),transparent 52%),linear-gradient(var(--a,135deg),var(--bx-bg-elev),var(--bx-bg))}
.fd-capa .ini{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:72px;font-weight:800;letter-spacing:-.04em;color:rgba(255,255,255,.08);line-height:1}
.fd-capa .rede{position:absolute;left:50%;top:42%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;display:grid;place-items:center;background:rgba(8,10,15,.55);border:1px solid rgba(255,255,255,.18);color:var(--bx-text)}
.fd-capa .fmt{position:absolute;left:5px;right:5px;bottom:6px;text-align:center;font-size:12px;font-weight:700;line-height:20px;border-radius:999px;background:rgba(8,10,15,.72);color:var(--bx-text);white-space:nowrap;overflow:hidden}
.fd-capa.sm{width:52px;height:68px;border-radius:10px}
.fd-capa.sm .ini{font-size:44px}
.fd-capa.sm .rede{width:32px;height:32px;margin:-16px 0 0 -16px;top:50%}
.fd-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.fd-who{font-size:13.5px;font-weight:700;display:flex;gap:6px;align-items:center;flex-wrap:wrap;overflow-wrap:anywhere}
.fd-who .tm{font-weight:500;color:var(--bx-text-2);font-size:12.5px}
.fd-tt{margin:0;font-size:17px;font-weight:800;letter-spacing:-.01em;line-height:1.2}
.fd-ask{margin:0;font-size:13px;color:var(--bx-text-2);border-left:2px solid rgba(var(--ac-1-rgb),.55);padding-left:8px;line-height:1.4}
.fd-ask b{color:var(--bx-text);font-weight:700}
.fd-meus-apoios{display:inline-flex;align-items:center;gap:4px;min-height:44px;align-self:flex-start;background:none;border:0;padding:0;font:inherit;font-size:13.5px;font-weight:700;color:var(--bx-text);cursor:pointer}
.fd-acts{display:flex;gap:6px;align-items:center}
.fd-acts .as-btn{width:auto;padding:0 12px;font-size:13px;gap:5px}
.fd-acts .grow{flex:1;min-width:0}
.fd-gs{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--bx-text-2);line-height:1.5}
.fd-gs span{display:inline-flex;align-items:center;gap:5px}
.fd-gs svg{color:var(--ac-1)}
.fd-ret{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;border-top:1px dashed var(--bx-border-2);padding-top:8px;font-size:12.5px;color:var(--bx-text-2);line-height:1.4}
.fd-ret .as-btn{flex:none;width:auto}
.fd-falha{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.45;color:var(--bx-text);background:var(--bx-surface-2);border:1px solid var(--bx-border-2);border-radius:12px;padding:10px 12px}
.fd-falha svg{color:var(--ac-1);margin-top:1px;flex:none}
.fd-falha.vermelho{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.08)}
.fd-falha.vermelho svg{color:var(--bx-red)}
.fd-falha .as-btn{width:auto;margin-left:auto;flex:none}
.fd-vazio{text-align:center;padding:22px 16px;border:1px dashed var(--bx-border-2);border-radius:16px;display:flex;flex-direction:column;align-items:center;gap:10px}
.fd-vazio .as-ri{width:56px;height:56px;border-radius:50%}
.fd-vazio .as-p{font-size:13.5px;margin:0}
.fd-vazio .as-btn{width:auto}
.fd-pk{min-height:44px;border:1px solid var(--bx-border-2);border-radius:999px;padding:0 14px;display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13.5px;font-weight:600;color:var(--bx-text-2);background:var(--bx-surface-2);cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease;white-space:nowrap}
.fd-pk.on{border-color:rgba(var(--ac-1-rgb),.55);background:rgba(var(--ac-1-rgb),.12);color:var(--bx-text);font-weight:700}
.fd-pk.on svg{color:var(--ac-1)}
.fd-pick{display:flex;flex-wrap:wrap;gap:6px}
.fd-grp{display:flex;flex-direction:column;gap:8px}
.fd-grp > .as-k{display:flex;align-items:center;gap:6px}
.fd-chk{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:4px 0;font-size:13.5px;color:var(--bx-text-2);background:none;border:0;text-align:left;font-family:inherit;cursor:pointer;width:100%}
.fd-chk b{color:var(--bx-text)}
.fd-box{width:22px;height:22px;border:1.5px solid var(--bx-border-2);border-radius:6px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--bx-brand-ink);margin-top:1px}
.fd-box.on{background:var(--ac-grad);border-color:transparent}
.fd-radio{display:flex;align-items:center;gap:12px;min-height:48px;font-size:14px;border:0;border-bottom:1px solid var(--bx-border);background:none;color:var(--bx-text);font-family:inherit;width:100%;text-align:left;cursor:pointer}
.fd-radio:last-child{border-bottom:0}
.fd-rd{width:20px;height:20px;border:1.5px solid var(--bx-border-2);border-radius:50%;flex:none;position:relative}
.fd-rd.on{border-color:var(--ac-1)}
.fd-rd.on:after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--ac-grad)}
.fd-cks{display:flex;flex-direction:column;border:1px solid var(--bx-border);border-radius:14px;background:var(--bx-surface);padding:0 12px}
.fd-ck{display:flex;align-items:center;gap:12px;min-height:52px;border:0;border-bottom:1px solid var(--bx-border);background:none;font:inherit;font-size:14.5px;color:var(--bx-text-2);width:100%;text-align:left;cursor:pointer}
.fd-ck:last-child{border-bottom:0}
.fd-ck .tx{flex:1;min-width:0;line-height:1.3}
.fd-ck .tx small{display:block;font-size:12px;color:var(--bx-text-2);font-weight:500;margin-top:2px}
.fd-ck > svg{color:var(--bx-text-2)}
.fd-ck.on{color:var(--bx-text);font-weight:700}
.fd-ck.on > svg{color:var(--ac-1)}
.fd-ck.ideia{font-size:14px;color:var(--bx-text);min-height:48px;cursor:default}
.fd-ck.ideia > svg{color:var(--ac-1)}
.fd-ideia{display:inline-flex;align-items:center;gap:6px;min-height:44px;align-self:flex-start;font:inherit;font-size:13px;font-weight:600;color:var(--bx-text-2);text-decoration:underline;text-underline-offset:3px;background:none;border:0;padding:0;cursor:pointer}
.fd-ideia svg{color:var(--ac-1)}
.fd-tg{display:flex;align-items:center;gap:12px;min-height:64px;border:1px solid var(--bx-border-2);border-radius:12px;padding:10px 12px;background:var(--bx-surface);width:100%;text-align:left;font-family:inherit;color:inherit;cursor:pointer}
.fd-tg.on{border-color:rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.06)}
.fd-tg .tx{flex:1;min-width:0;font-size:12.5px;color:var(--bx-text-2);line-height:1.4}
.fd-tg .tx b{display:block;font-size:14px;color:var(--bx-text);margin-bottom:2px}
.fd-sw{width:48px;height:28px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface-3);position:relative;flex:none;transition:background .15s ease}
.fd-sw:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--bx-text-2);transition:transform .15s ease}
.fd-sw.on{background:var(--ac-grad);border-color:transparent}
.fd-sw.on:after{transform:translateX(20px);background:var(--bx-brand-ink)}
.fd-pessoa{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:64px;border-bottom:1px solid var(--bx-border);padding:6px 0}
.fd-pessoa:last-child{border-bottom:0}
.fd-pessoa .l{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.fd-pessoa .l > div{min-width:0;display:flex;flex-direction:column;gap:3px}
.fd-pessoa .l b{font-size:14px;overflow-wrap:anywhere}
.fd-pessoa .as-btn{flex:none;width:auto}
.fd-stat{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.fd-stat > div{border:1px solid var(--bx-border);border-radius:12px;padding:12px;background:var(--bx-surface);display:flex;flex-direction:column;gap:6px}
.fd-stat > div:first-child{border-color:rgba(var(--ac-1-rgb),.35);background:rgba(var(--ac-1-rgb),.06)}
.fd-regras{display:flex;flex-direction:column}
.fd-regras .r{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--bx-border);font-size:14px;line-height:1.45}
.fd-regras .r:last-child{border-bottom:0}
.fd-regras .as-ri{font-weight:800;font-size:13px;flex:none}
.fd-q{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--bx-border)}
.fd-q:last-of-type{border-bottom:0}
.fd-q .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.fd-q .tx b{font-size:14px;overflow-wrap:anywhere}
.fd-q .acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.fd-q .acts .as-btn{width:auto;font-size:13px;padding:0 12px}
.fd-relogio{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--ac-1)}
.fd-wa{background:var(--bx-surface);border:1px solid var(--bx-border);border-radius:14px;padding:12px}
.fd-bub{background:var(--bx-surface-2);border:1px solid var(--bx-border-2);border-radius:14px 14px 14px 4px;padding:10px 12px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
.fd-fixa{position:fixed;left:0;right:0;bottom:0;z-index:20;border-top:1px solid var(--bx-border);background:var(--bx-bg-elev);padding:10px max(16px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.fd-fixa .in{max-width:1120px;margin:0 auto;display:flex;gap:10px;align-items:center}
.fd-fixa .tx{flex:1;font-size:13px;color:var(--bx-text-2);line-height:1.4}
.fd-fixa .as-btn{flex:none;width:auto}
.fd-espaco{height:84px}
.fd-toast{position:fixed;z-index:60;left:16px;right:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-radius:14px;padding:8px 8px 8px 12px;display:flex;align-items:center;gap:10px;font-size:13px;box-shadow:var(--bx-shadow)}
.fd-toast.erro{border-color:rgba(239,68,68,.4)}
.fd-toast.erro > svg{color:var(--bx-red)}
.fd-toast .as-btn{width:auto;flex:none}
.fd-mais-btn{align-self:center;width:auto}
.fd-aside{display:none}
@media (min-width:1024px){
  .fd-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
  .fd-lista.duas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
  .fd-aside{display:flex;flex-direction:column;gap:12px;position:sticky;top:72px}
  .fd-so-cel{display:none}
}
@media (prefers-reduced-motion:reduce){
  .fd-post,.fd-pk,.fd-seg button,.fd-sw,.fd-sw:after{transition:none}
}
`
