'use client'

// Pecas do Feed do Club (UI v3 aprovada em 26/11/2026): CSS com prefixo fd-, a capa tipografica
// do card (nada do Instagram carrega na pagina) e o card do post. A cara e a da casa do Club,
// sem pele propria: tokens --bx-* / --ac-*, AS_CSS, DM Sans e icones outline do Ico.

import { supabase } from '@/lib/supabaseClient'
import { BUCKET_CAPAS } from '@/lib/pcc/trends'
import { Ico } from '../amigo-secreto/estilo'
import { FORMATOS, PERGUNTAS, REDES, TEMAS, ehNovo, haQuanto, linkFeed, type PostFeed, type Rede, type Formato } from '@/lib/pcc/feed'

const ANGULOS = [135, 200, 160, 225, 110, 185, 150, 240]

/** Angulo da capa a partir do id, para cada post ter o seu e ele nao mudar entre renders. */
function anguloDe(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ANGULOS[h % ANGULOS.length]
}

/** A capa capturada vive no nosso bucket (copiada pela Mia Servidor); nada carrega da rede. */
const urlCapa = (path: string) => supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl

export function Capa({ id, rede, formato, arroba, capa, pequena = false }: { id: string; rede: Rede; formato: Formato; arroba: string; capa?: string | null; pequena?: boolean }) {
  return (
    <span className={`fd-capa${pequena ? ' sm' : ''}${capa ? ' foto' : ''}`} style={{ ['--a' as string]: `${anguloDe(id)}deg` }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {capa && <img className="img" src={urlCapa(capa)} alt="" loading="lazy" decoding="async" />}
      <span className="ini">{(arroba || '?').charAt(0).toUpperCase()}</span>
      <span className="rede"><Ico n={REDES[rede].ico} s={pequena ? 16 : 20} /></span>
      {!pequena && <span className="fmt">{FORMATOS[formato]}</span>}
    </span>
  )
}

/** Titulo do card: tema quando tem, senao o formato. */
export const tituloPost = (p: Pick<PostFeed, 'tema' | 'formato'>) => (p.tema && p.tema !== 'outro' ? TEMAS[p.tema] : FORMATOS[p.formato])

/** Inicial do @ para o circulo (letra, nunca ponto ou numero). */
export const inicial = (a: string) => (a.replace(/[^a-z]/gi, '').charAt(0) || a.charAt(0) || '?').toUpperCase()

/** Avatar com anel: gradiente = ainda nao viu; neutro = ja viu. Tamanhos 24, 28, 40, 64. */
export function Avatar({ arroba, t = 40, novo = false, rede }: { arroba: string; t?: 24 | 28 | 40 | 64; novo?: boolean; rede?: Rede }) {
  return (
    <span className={`fv-av s${t}${novo ? ' novo' : ''}`} aria-hidden="true">
      <span className="as-av">{inicial(arroba)}</span>
      {rede && <span className="rd"><Ico n={REDES[rede].ico} s={13} /></span>}
    </span>
  )
}

/** Um selo por vez, nesta ordem: Voce apoiou > Escolha > Primeiro post > Seu post > Novo. */
function seloDe(p: PostFeed, apoiou: boolean, novo: boolean): { cls: string; texto: string; ico?: string } | null {
  if (apoiou) return { cls: 'v', texto: 'Você apoiou', ico: 'check' }
  if (p.escolha) return { cls: 'g', texto: 'Escolha', ico: 'star' }
  if (p.primeiro && !p.meu) return { cls: 'g', texto: 'Primeiro post' }
  if (p.meu) return { cls: 'n', texto: 'Seu post' }
  if (novo) return { cls: 'g', texto: 'Novo' }
  return null
}

/** Janela 3:4 da carta: a capa do nosso bucket ou a capa de texto (inicial sobre o gradiente da casa). */
export function JanelaCarta({ p }: { p: Pick<PostFeed, 'id' | 'arroba' | 'capa'> }) {
  return p.capa
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={urlCapa(p.capa)} alt="" loading="lazy" decoding="async" />
    : <span className="fd-pa" style={{ ['--ang' as string]: `${anguloDe(p.id)}deg` }}><span className="pn">{inicial(p.arroba)}</span></span>
}

/**
 * A carta do Club (versao C aprovada em 27/11/2026): a carta inteira abre o post na rede; embaixo, o
 * balao com a pergunta e o Apoiar. Apoiar "liga energia" na carta (anel, holo uma vez, moldura que
 * acende e o selo que vira), 0,8 s, so quando acabou de marcar (ligando).
 */
export function CartaPost({ p, modo, agora, visto, ligando, onAbrir, onApoiar, onMenu, onQuemApoiou }: {
  p: PostFeed
  modo: 'visitante' | 'conta' | 'membro'
  agora: number
  /** Ja abriu o post (guardado no navegador): apaga o anel. */
  visto: boolean
  ligando: boolean
  onAbrir: (p: PostFeed, e: { preventDefault: () => void }) => void
  onApoiar: (p: PostFeed) => void
  onMenu?: (p: PostFeed) => void
  onQuemApoiou?: (p: PostFeed) => void
}) {
  const href = linkFeed(p.url)
  const rede = REDES[p.rede].nome
  const apoiou = !!p.minha_marca && p.minha_marca.length > 0
  const soVi = !!p.minha_marca && p.minha_marca.length === 0
  const novo = ehNovo(p.feed_em, agora)
  // Membro: anel enquanto nao abriu nem marcou. Fora do Club: anel nas primeiras 24 h.
  const anel = !p.meu && (modo === 'membro' ? !visto && p.minha_marca === null : novo)
  const selo = seloDe(p, apoiou, novo)
  const cls = ['fd-c', p.primeiro && !p.meu ? 'chegou' : '', apoiou ? 'ap' : '', ligando ? 'ligando' : '', href ? '' : 'off'].filter(Boolean).join(' ')

  const miolo = (
    <>
      <span className="fd-jan">
        <JanelaCarta p={p} />
        <span className="fd-holo" />
        {selo && (
          <span className="fd-selos"><span className={`fd-selo ${selo.cls}`}>{selo.ico && <Ico n={selo.ico} s={13} />}{selo.texto}</span></span>
        )}
        <span className="fd-rd"><Ico n={REDES[p.rede].ico} s={15} /></span>
        <span className="fd-quem"><span className={`fd-ini${anel ? ' on' : ''}`}>{inicial(p.arroba)}</span><b>@{p.arroba}</b></span>
      </span>
      <span className="fd-fita"><span className="tt">{href ? tituloPost(p) : 'Link indisponível'}</span>{agora > 0 && <span className="tm">{haQuanto(p.feed_em, agora)}</span>}</span>
    </>
  )

  return (
    <article className={cls} id={`post-${p.id}`}>
      {href
        ? <a className="fd-cx" href={href} target="_blank" rel="noopener noreferrer" onClick={e => onAbrir(p, e)}
            aria-label={`Abrir o post de @${p.arroba} no ${rede}, em outra aba`}>{miolo}</a>
        : <span className="fd-cx" aria-label={`Post de @${p.arroba}: link indisponível`}>{miolo}</span>}
      {p.pergunta && (
        p.pergunta === 'so_ver'
          ? <p className="fd-bal so">@{p.arroba} só quer que vejam.</p>
          : <p className="fd-bal"><span className="q">@{p.arroba} pergunta:</span><b>{PERGUNTAS[p.pergunta]}</b></p>
      )}
      <div className="fd-ac">
        {p.meu
          ? (
            <button type="button" className="fd-meus-ap" onClick={() => onQuemApoiou?.(p)}>
              {p.apoiaram === null || p.apoiaram === 0 ? 'Ninguém marcou ainda' : p.apoiaram === 1 ? '1 pessoa apoiou' : `${p.apoiaram} pessoas apoiaram`}
              <Ico n="chev" s={14} />
            </button>
          )
          : href && (
            <button type="button" className="fd-ap" onClick={() => onApoiar(p)}
              aria-label={modo !== 'membro' ? `Entrar no Club para apoiar @${p.arroba}` : apoiou ? `Editar o apoio que você marcou no post de @${p.arroba}` : `Marcar o que você fez no post de @${p.arroba}`}>
              <span className="en"><Ico n="energia" s={20} /></span>{apoiou ? 'Apoiado' : soVi ? 'Só vi' : 'Apoiar'}
            </button>
          )}
        {onMenu && !p.meu && (
          <button type="button" className="as-ib" aria-label={`Mais opções do post de @${p.arroba}`} onClick={() => onMenu(p)}><Ico n="pontos" s={20} /></button>
        )}
      </div>
    </article>
  )
}

/** Carta vazia do carregamento. */
export function CartaEsqueleto() {
  return (
    <div className="fd-c ske" aria-hidden="true">
      <span className="fd-cx"><span className="fd-jan" /><span className="fd-fita"><span className="fd-sk" style={{ width: '60%' }} /></span></span>
      <div className="fd-bal"><span className="fd-sk" style={{ width: '55%' }} /><span className="fd-sk" style={{ width: '90%' }} /></div>
      <div className="fd-ac"><span className="fd-sk" /></div>
    </div>
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
.fd-cab .lnk{color:var(--bx-text);text-decoration:underline;text-underline-offset:3px;background:none;border:0;font:inherit;padding:12px 4px;margin:-12px -4px;cursor:pointer;display:inline-block;min-width:44px;line-height:20px}
.fd-post{position:relative;border:1px solid var(--bx-border);border-radius:16px;background:var(--bx-surface);padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0;transition:border-color .15s ease,background .15s ease}
.fd-post:hover{border-color:var(--bx-border-2);background:var(--bx-surface-2)}
.fd-post.novato{border-color:transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:var(--bx-shadow)}
.fd-post.meu{background:rgba(var(--ac-1-rgb),.05);border-color:rgba(var(--ac-1-rgb),.3)}
.fd-h{display:flex;gap:12px;align-items:flex-start}
.fd-capa{position:relative;width:84px;height:112px;border-radius:12px;overflow:hidden;flex:none;border:1px solid var(--bx-border-2);background:radial-gradient(at 28% 18%,rgba(var(--ac-1-rgb),.32),transparent 55%),radial-gradient(at 82% 82%,rgba(var(--ac-2-rgb),.30),transparent 52%),linear-gradient(var(--a,135deg),var(--bx-bg-elev),var(--bx-bg))}
.fd-capa .ini{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:72px;font-weight:800;letter-spacing:-.04em;color:rgba(255,255,255,.08);line-height:1}
.fd-capa .rede{position:absolute;left:50%;top:42%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;display:grid;place-items:center;background:rgba(8,10,15,.55);border:1px solid rgba(255,255,255,.18);color:var(--bx-text)}
.fd-capa .fmt{position:absolute;left:5px;right:5px;bottom:6px;text-align:center;font-size:12px;font-weight:700;line-height:20px;border-radius:999px;background:rgba(8,10,15,.72);color:var(--bx-text);white-space:nowrap;overflow:hidden}
.fd-capa .img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.fd-capa.foto .ini{display:none}
.fd-capa.foto .rede{top:auto;bottom:34px;left:auto;right:6px;margin:0;width:28px;height:28px}
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
.fd-aside{display:none}
/* ── Versao C (27/11/2026): a sala da B com as cartas da A ───────────────── */
.fd-bd{display:flex;flex-direction:column;gap:22px;min-width:0}
.fv-av{position:relative;border-radius:50%;padding:2px;background:var(--bx-border-2);flex:none;display:inline-flex}
.fv-av.novo{background:var(--ac-grad)}
.fv-av .as-av{width:100%;height:100%;border:2px solid var(--bx-bg);background:var(--bx-surface-3);color:var(--bx-text)}
.fv-av.s40{width:40px;height:40px}.fv-av.s40 .as-av{font-size:15px}
.fv-av.s64{width:64px;height:64px;padding:2.5px}.fv-av.s64 .as-av{font-size:24px;border-width:3px}
.fv-av.s28{width:28px;height:28px;padding:1.5px}.fv-av.s28 .as-av{font-size:12px;border-width:1.5px}
.fv-av.s24{width:24px;height:24px;padding:0}.fv-av.s24 .as-av{font-size:12px;border-width:2px}
.fv-av .rd{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);display:grid;place-items:center;color:var(--bx-text)}
.fv-pile{display:inline-flex;flex:none}
.fv-pile .fv-av + .fv-av{margin-left:-8px}
.fv-conv{position:relative;border-radius:18px;padding:18px 16px 16px;background:var(--bx-hero-wash),var(--bx-surface);border:1px solid var(--bx-border);display:flex;flex-direction:column;gap:12px;overflow:hidden}
.fv-conv .eb{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1)}
.fv-conv h1{margin:0;font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.12;text-wrap:balance}
.fv-conv h1 em{font-style:normal;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.fv-conv .gente{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--bx-text-2);line-height:1.35}
.fv-conv .gente b{color:var(--bx-text)}
.fv-conv .acts{display:flex;gap:8px;align-items:center}
.fv-conv .acts .pri{flex:1}
.fv-conv .acts .as-btn{width:auto}
.fv-oi{display:flex;flex-direction:column;gap:10px}
.fv-oi .ola{font-size:15px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.fv-oi .ola span{color:var(--bx-text-2);font-weight:500}
.fv-comp{display:flex;align-items:center;gap:10px;min-height:56px;border:1px solid var(--bx-border-2);border-radius:999px;background:var(--bx-surface-2);padding:6px;cursor:pointer;width:100%;text-align:left;color:var(--bx-text-2);font:inherit;font-size:14.5px;transition:border-color .15s ease,background .15s ease}
.fv-comp:hover{border-color:rgba(var(--ac-1-rgb),.45);background:rgba(var(--ac-1-rgb),.05)}
.fv-comp .ph-t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fv-comp .mais{width:44px;height:44px;border-radius:50%;background:var(--ac-grad);color:var(--bx-brand-ink);display:grid;place-items:center;flex:none}
.fv-tema{display:flex;align-items:center;gap:8px;min-height:44px;font:inherit;font-size:13.5px;color:var(--bx-text-2);background:none;border:0;padding:0;cursor:pointer;text-align:left}
.fv-tema > svg:first-child{color:var(--ac-1)}
.fv-tema b{color:var(--bx-text)}
.fv-sec-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.fv-sec-h h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.01em}
.fv-sec-h span{font-size:12.5px;color:var(--bx-text-2)}
.fv-cheg{display:flex;flex-direction:column;gap:10px;min-width:0}
.fv-row{display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:2px 16px 4px;scroll-snap-type:x proximity;scroll-padding-inline:16px;scrollbar-width:none}
.fv-row::-webkit-scrollbar{display:none}
.fv-che{flex:none;width:76px;display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;padding:4px 0;font:inherit;color:var(--bx-text);cursor:pointer;scroll-snap-align:start;border-radius:12px;transition:transform .15s ease}
.fv-che:hover{transform:translateY(-2px)}
.fv-che .nm{font-size:12px;font-weight:600;max-width:76px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--bx-text-2)}
.fv-che.novo .nm{color:var(--bx-text)}
.fv-esc{position:relative;border-radius:18px;padding:12px;display:grid;grid-template-columns:104px minmax(0,1fr);gap:14px;border:1px solid transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:var(--bx-shadow);min-width:0}
.fv-esc .cp{position:relative;aspect-ratio:9/16;border-radius:12px;overflow:hidden;background:var(--bx-surface-3);display:block}
.fv-esc .cp img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.fv-fita{position:absolute;top:14px;left:-34px;width:132px;transform:rotate(-45deg);background:var(--ac-grad);color:var(--bx-brand-ink);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-align:center;line-height:22px;box-shadow:0 4px 12px rgba(0,0,0,.4);z-index:2}
.fv-esc .tx{display:flex;flex-direction:column;gap:8px;min-width:0;padding:2px 0}
.fv-esc .eb{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ac-1)}
.fv-esc .who{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;min-width:0}
.fv-esc .who span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fv-esc .tt{font-size:14px;line-height:1.45;color:var(--bx-text);margin:0}
.fv-esc .por{font-size:12px;color:var(--bx-text-2)}
.fv-esc .as-btn{align-self:flex-start;margin-top:auto;width:auto}
.fd-g > .fd-g-linha{grid-column:1/-1;margin:4px 0;min-width:0}
.fd-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.fv-nav{position:sticky;top:56px;z-index:15;background:color-mix(in srgb,var(--bx-bg) 92%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--bx-border);margin:0 -16px;padding:0 16px}
.fv-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.fv-tabs::-webkit-scrollbar{display:none}
.fv-tab{position:relative;min-height:44px;padding:0 10px;background:none;border:0;font:inherit;font-size:14.5px;font-weight:700;color:var(--bx-text-2);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex:none;transition:color .15s ease}
.fv-tab:first-child{margin-left:-10px}
.fv-tab.on{color:var(--bx-text)}
.fv-tab.on:after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:3px;border-radius:3px 3px 0 0;background:var(--ac-grad)}
.fv-tab:focus-visible{outline:2px solid var(--bx-text);outline-offset:-2px;border-radius:8px}
.fv-tab .dot{width:8px;height:8px;border-radius:50%;background:var(--ac-grad)}
.fv-chips{display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:4px 16px 8px;scrollbar-width:none}
.fv-chips::-webkit-scrollbar{display:none}
.fv-chips .fd-pk{flex:none}
.fv-dia{display:flex;flex-direction:column;gap:6px;margin-bottom:-8px}
.fv-dia h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
.fv-vivo{display:flex;align-items:center;gap:10px;font-size:13px;line-height:1.35;color:var(--bx-text-2);min-width:0}
.fv-vivo > span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fv-vivo b{color:var(--bx-text);font-weight:700}
.fv-fim{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:28px 12px 8px;border-top:1px solid var(--bx-border)}
.fv-fim .ok{width:64px;height:64px;border-radius:50%;background:var(--ac-grad);display:grid;place-items:center;color:var(--bx-brand-ink);box-shadow:0 10px 30px rgba(var(--ac-1-rgb),.25)}
.fv-fim h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em;text-wrap:balance}
.fv-fim p{margin:0;font-size:14px;color:var(--bx-text-2);line-height:1.5;max-width:300px}
.fv-fim .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.fv-fim .acts .as-btn{width:auto}
.fv-fab{position:fixed;right:16px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:30;height:56px;padding:0 22px 0 18px;border-radius:999px;border:0;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-size:15.5px;font-weight:800;display:inline-flex;align-items:center;gap:8px;cursor:pointer;box-shadow:0 12px 32px rgba(0,0,0,.55),0 6px 18px rgba(var(--ac-1-rgb),.25);transition:transform .2s ease,opacity .2s ease}
.fv-fab.fora{transform:translateY(96px);opacity:0;pointer-events:none}
.fv-toast{position:fixed;z-index:60;left:16px;right:16px;bottom:calc(92px + env(safe-area-inset-bottom,0px));max-width:520px;margin:0 auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-radius:14px;padding:8px 8px 8px 12px;display:flex;align-items:center;gap:10px;font-size:13px;box-shadow:var(--bx-shadow);line-height:1.35;animation:fv-toast .2s ease .8s both}
.fv-toast > svg{color:var(--ac-1);flex:none}
.fv-toast .tx{flex:1;min-width:0}
.fv-toast .tx b{color:var(--bx-text)}
.fv-toast .as-btn{width:auto;flex:none}
@keyframes fv-toast{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.fd-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 8px}
.fd-c{position:relative;min-width:0;display:flex;flex-direction:column;scroll-margin-top:170px}
.fd-cx{position:relative;display:block;padding:5px;border-radius:10px;border:1px solid var(--bx-border-2);background:linear-gradient(160deg,var(--bx-bg-elev),var(--bx-bg));box-shadow:0 6px 18px rgba(0,0,0,.45);text-decoration:none;color:inherit;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
a.fd-cx:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.22)}
.fd-cx:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.fd-jan{position:relative;display:block;aspect-ratio:3/4;border-radius:7px;overflow:hidden;background:var(--bx-surface-3)}
.fd-jan img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}
.fd-jan:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.2) 46%,transparent 62%);mix-blend-mode:soft-light;pointer-events:none}
.fd-fita{display:flex;align-items:center;justify-content:space-between;gap:6px;height:26px;padding:0 3px;font-size:12px;min-width:0}
.fd-fita .tt{font-weight:700;color:var(--bx-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.fd-fita .tm{color:var(--bx-text-2);white-space:nowrap;flex:none;font-variant-numeric:tabular-nums}
.fd-pa{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(at 28% 18%,rgba(var(--ac-1-rgb),.34),transparent 58%),radial-gradient(at 82% 84%,rgba(var(--ac-2-rgb),.28),transparent 60%),linear-gradient(var(--ang,160deg),var(--bx-bg-elev),var(--bx-bg))}
.fd-pa .pn{font-size:96px;font-weight:800;letter-spacing:-.04em;color:var(--bx-text-faint);line-height:1;margin-top:-22%}
.fd-rd{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(8,10,15,.55);border:1px solid rgba(255,255,255,.18);color:var(--bx-text);z-index:3}
.fd-selos{position:absolute;top:7px;left:7px;right:40px;z-index:3;display:flex}
.fd-selo{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.fd-selo.g{background:var(--ac-grad);color:var(--bx-brand-ink)}
.fd-selo.v{background:rgba(8,10,15,.78);border:1px solid rgba(var(--ac-1-rgb),.55);color:var(--bx-text)}
.fd-selo.v svg{color:var(--ac-1)}
.fd-selo.n{background:rgba(8,10,15,.72);border:1px solid var(--bx-border-2);color:var(--bx-text)}
.fd-quem{position:absolute;left:0;right:0;bottom:0;z-index:2;display:flex;align-items:center;gap:7px;padding:34px 8px 8px;background:linear-gradient(to top,rgba(8,10,15,.9),rgba(8,10,15,.55) 55%,transparent);min-width:0}
.fd-quem b{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;color:var(--bx-text)}
.fd-ini{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none;font-size:12px;font-weight:800;color:var(--bx-text);background:var(--bx-bg-elev);border:1px solid var(--bx-border-2)}
.fd-ini.on{border:2px solid transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box}
.fd-c.chegou .fd-cx{border-color:transparent;background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.25),0 10px 24px rgba(var(--ac-1-rgb),.18)}
.fd-c.off .fd-jan img{opacity:.35;filter:grayscale(1)}
.fd-bal{position:relative;margin:10px 0 0;padding:7px 10px 8px;border-radius:4px 12px 12px 12px;background:var(--bx-surface-2);border:1px solid var(--bx-border-2);font-size:13px;line-height:1.35}
.fd-bal:before{content:"";position:absolute;top:-6px;left:14px;width:10px;height:10px;background:var(--bx-surface-2);border-left:1px solid var(--bx-border-2);border-top:1px solid var(--bx-border-2);border-radius:2px 0 0 0;transform:rotate(45deg)}
.fd-bal .q{display:block;font-size:12px;color:var(--bx-text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-bal b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:700;color:var(--bx-text)}
.fd-bal.so{color:var(--bx-text-2);font-size:12.5px}
.fd-ac{display:flex;gap:4px;margin-top:auto;padding-top:6px;align-items:center}
.fd-ap{position:relative;flex:1;min-width:0;height:44px;border-radius:999px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text);font:inherit;font-size:13.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
.fd-ap:hover{background:var(--bx-surface-2)}
.fd-ap:focus-visible{outline:2px solid var(--bx-text);outline-offset:2px}
.fd-ap .en{position:relative;display:inline-flex;color:var(--ac-1)}
.fd-c.ap .fd-ap{background:var(--ac-grad);border-color:transparent;color:var(--bx-brand-ink)}
.fd-c.ap .fd-ap .en{color:var(--bx-brand-ink)}
.fd-meus-ap{flex:1;min-width:0;min-height:44px;display:inline-flex;align-items:center;gap:4px;background:none;border:0;padding:0 2px;font:inherit;font-size:13.5px;font-weight:700;color:var(--bx-text);cursor:pointer;text-align:left}
.fd-meus-ap svg{color:var(--bx-text-2)}
.fd-holo{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:0;mix-blend-mode:screen;background:linear-gradient(115deg,transparent 28%,rgba(var(--ac-1-rgb),.55) 40%,rgba(255,255,255,.7) 48%,rgba(var(--ac-2-rgb),.55) 56%,transparent 68%);background-size:300% 100%;background-position:100% 0}
.fd-ap .en:before,.fd-ap .en:after{content:"";position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid var(--ac-1);opacity:0;pointer-events:none}
.fd-ap .en:after{border-color:var(--ac-2)}
.fd-c.ligando .fd-ap .en:before{animation:fc-anel .2s ease-out both}
.fd-c.ligando .fd-ap .en:after{animation:fc-anel .2s ease-out .06s both}
.fd-c.ligando .fd-holo{animation:fc-holo .6s ease .12s both}
.fd-c.ligando .fd-cx{animation:fc-brilho .8s ease .1s both}
.fd-c.ligando .fd-selo{animation:cd-virar .2s ease .45s both}
@keyframes fc-anel{from{transform:scale(.8);opacity:.95}to{transform:scale(2.6);opacity:0}}
@keyframes fc-holo{0%{opacity:0;background-position:100% 0}15%{opacity:1}80%{opacity:1}100%{opacity:0;background-position:0 0}}
@keyframes fc-brilho{0%,100%{box-shadow:0 6px 18px rgba(0,0,0,.45)}35%{box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.55),0 10px 28px rgba(var(--ac-1-rgb),.35)}}
@keyframes cd-virar{from{transform:perspective(600px) rotateY(90deg)}to{transform:none}}
.fd-minicarta{display:flex;align-items:center;gap:12px;min-width:0}
.fd-minicarta .fd-cx{width:52px;padding:3px;border-radius:7px;flex:none;box-shadow:none}
.fd-minicarta .fd-jan{border-radius:4px}
.fd-minicarta .fd-pa .pn{font-size:40px}
.fd-minicarta .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--bx-text-2)}
.fd-minicarta .tx b{font-size:14px;color:var(--bx-text);overflow-wrap:anywhere}
.fd-vz{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:20px 8px 8px}
.fd-pilha{position:relative;width:180px;height:150px}
.fd-verso{position:absolute;top:8px;width:92px;aspect-ratio:63/88;border-radius:9px;border:2px solid transparent;background:repeating-linear-gradient(45deg,var(--bx-surface-3) 0 4px,transparent 4px 10px) padding-box,linear-gradient(var(--bx-surface-2),var(--bx-surface-2)) padding-box,linear-gradient(var(--bx-border-2),var(--bx-border-2)) border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.4)}
.fd-verso:before{content:"";position:absolute;inset:6px;border-radius:6px;border:1px solid var(--bx-border);background:var(--bx-bg-elev)}
.fd-verso:after{content:"";position:absolute;inset:12px;border-radius:4px;border:1px dashed var(--bx-border)}
.fd-verso img{position:relative;width:66%;z-index:1}
.fd-verso:nth-child(1){left:6px;transform:rotate(-12deg)}
.fd-verso:nth-child(2){left:44px;top:0;z-index:2}
.fd-verso:nth-child(3){left:82px;transform:rotate(12deg)}
.fd-verso.ok{background:linear-gradient(var(--bx-bg-elev),var(--bx-bg-elev)) padding-box,var(--ac-grad) border-box;box-shadow:0 0 0 1px rgba(var(--ac-1-rgb),.3),0 10px 28px rgba(var(--ac-1-rgb),.25)}
.fd-vz h3{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em;text-wrap:balance}
.fd-vz .as-p{max-width:300px;margin:0}
.fd-vz .acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.fd-vz .acts .as-btn{width:auto}
.fd-sk{background:var(--bx-surface-3);border-radius:6px;display:block;height:10px;margin:4px 0}
.fd-c.ske .fd-cx{box-shadow:none;border-color:var(--bx-border)}
.fd-c.ske .fd-jan{background:var(--bx-surface-2)}
.fd-c.ske .fd-jan:after,.fd-c.ske .fd-bal:before{display:none}
.fd-c.ske .fd-bal{border-color:var(--bx-border);background:var(--bx-surface)}
.fd-c.ske .fd-ac .fd-sk{height:44px;flex:1;border-radius:999px;margin:0}
.fd-carregando .fd-sk,.fd-carregando .fd-c.ske .fd-jan{animation:sk-pulso 1.2s ease-in-out infinite alternate}
@keyframes sk-pulso{from{opacity:1}to{opacity:.55}}
.fd-fim-espaco{height:96px}
.fd-dk-che{display:flex;align-items:center;gap:12px;min-height:52px;border:0;background:none;padding:0;font:inherit;color:var(--bx-text);text-align:left;cursor:pointer;width:100%;border-radius:10px}
.fd-dk-che .tx{flex:1;min-width:0;display:flex;flex-direction:column}
.fd-dk-che .tx b{font-size:14px;overflow-wrap:anywhere}
.fd-dk-che .tx span{font-size:12.5px;color:var(--bx-text-2)}
@media (min-width:769px) and (max-width:1023px){
  .fv-nav{margin:0 -24px;padding:0 24px}
  .fv-chips,.fv-row{margin:0 -24px;padding-left:24px;padding-right:24px}
}
@media (min-width:640px){ .fd-g{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 12px} }
@media (min-width:1024px){
  .fv-nav{top:64px;margin:0;padding:0}
  .fv-chips{margin:0;padding:4px 0 10px}
  .fv-row{margin:0;padding:2px 0 4px}
  .fd-g{grid-template-columns:repeat(3,minmax(0,1fr))}
  .fv-fab{display:none}
}
@media (min-width:1200px){ .fd-g{grid-template-columns:repeat(4,minmax(0,1fr));gap:22px 12px} }
@media (min-width:1024px){
  .fd-layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
  .fd-aside{display:flex;flex-direction:column;gap:12px;position:sticky;top:72px}
  .fd .fd-so-cel{display:none}
}
@media (prefers-reduced-motion:reduce){
  .fd-post,.fd-pk,.fd-sw,.fd-sw:after,.fv-tab,.fv-comp,.fv-che,.fv-fab,.fd-cx,.fd-ap{transition:none}
  .fd-c.ligando .fd-ap .en:before,.fd-c.ligando .fd-ap .en:after,.fd-c.ligando .fd-holo,.fd-c.ligando .fd-cx,.fd-c.ligando .fd-selo,.fv-toast,.fd-carregando .fd-sk,.fd-carregando .fd-c.ske .fd-jan{animation:none}
}
`
