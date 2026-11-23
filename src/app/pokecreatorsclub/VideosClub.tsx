'use client'

// Secao de videos da casa do Club (mockup aprovado em 23/11/2026, desenho A: destaque e lista).
// Logo abaixo das Trends. O mais novo vai grande; os outros em cards menores (ao lado no desktop,
// abaixo no celular). Cada card abre o video no YouTube em outra aba: nada do YouTube carrega na
// home, so a capa, que vive no nosso bucket. Sem video publicado (ou leitura falhou), a secao some.

import { supabase } from '@/lib/supabaseClient'
import { BUCKET_CAPAS } from '@/lib/pcc/trends'
import { CANAL_YOUTUBE, dataVideoTexto, duracaoTexto, linkVideo, type VideoClub } from '@/lib/pcc/videos'
import { Ico } from './amigo-secreto/estilo'

const capaUrl = (path: string) => supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl

function IcoYoutube({ s = 16 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="4" /><path d="M10.2 9.4v5.2l4.4-2.6z" />
    </svg>
  )
}

function Cartao({ v, destaque, ano }: { v: VideoClub; destaque?: boolean; ano: number }) {
  const href = linkVideo(v.id)
  const rotulo = v.tipo === 'aula' ? 'Aula' : 'Encontro'
  const conteudo = (
    <>
      <span className="vd-cap">
        {v.capa && <img src={capaUrl(v.capa)} alt="" loading="lazy" decoding="async" />}
        <span className="vd-ply"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg></i></span>
        <span className="vd-dur">{duracaoTexto(v.duracao)}</span>
      </span>
      <span className="vd-tx">
        <b>{v.titulo}</b>
        <small>
          <span className={`vd-sel${destaque ? ' ao' : ''}`}>{destaque ? 'Mais novo' : rotulo}</span>
          <span>{destaque ? `${rotulo} · ` : ''}{dataVideoTexto(v.data, ano)}</span>
        </small>
      </span>
    </>
  )
  const cls = `vd-card${destaque ? ' dest' : ''}`
  return href
    ? <a className={cls} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Assistir ${v.titulo} no YouTube`}>{conteudo}</a>
    : <div className={cls}>{conteudo}</div>
}

export default function VideosClub({ videos }: { videos: VideoClub[] | null }) {
  if (!videos || videos.length === 0) return null
  const ano = new Date().getFullYear()
  const [novo, ...resto] = videos
  return (
    <section className="vd" aria-label="Vídeos do Club">
      <style>{VD_CSS}</style>
      <div className="vd-cab">
        <div className="as-eye"><Ico n="spark" s={14} />Vídeos</div>
        <div className="vd-linha">
          <div>
            <h2 className="vd-h2">Os encontros do Club, na íntegra</h2>
            <p className="vd-sub">Lives com criadores e aulas de TCG, gravadas no canal.</p>
          </div>
          <a className="vd-ver" href={CANAL_YOUTUBE} target="_blank" rel="noopener noreferrer"><IcoYoutube />Ver o canal</a>
        </div>
      </div>
      <div className="vd-grade">
        <Cartao v={novo} destaque ano={ano} />
        {resto.length > 0 && <div className="vd-lista">{resto.map(v => <Cartao key={v.id} v={v} ano={ano} />)}</div>}
      </div>
    </section>
  )
}

const VD_CSS = `
.vd{display:flex;flex-direction:column;gap:14px;padding-top:12px;min-width:0}
.vd-cab{display:flex;flex-direction:column;gap:6px}
.vd-linha{display:flex;gap:12px;justify-content:space-between;align-items:flex-end;flex-wrap:wrap}
.vd-h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.15;text-wrap:balance}
.vd-sub{margin:4px 0 0;font-size:14px;color:var(--bx-text-2)}
.vd-ver{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid var(--bx-border-2);border-radius:10px;background:transparent;color:var(--bx-text);font-size:13px;font-weight:700;text-decoration:none;transition:background .15s ease,border-color .15s ease}
.vd-ver:hover{background:var(--bx-surface-2)}
.vd-grade{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
.vd-lista{display:flex;flex-direction:column;gap:12px;min-width:0}
.vd-card{display:flex;flex-direction:column;gap:10px;min-width:0;color:inherit;text-decoration:none}
.vd-cap{position:relative;display:block;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:var(--bx-surface-2);border:1px solid var(--bx-border)}
.vd-cap img{width:100%;height:100%;object-fit:cover;display:block}
.vd-ply{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.55))}
.vd-ply i{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:rgba(8,10,15,.72);border:1px solid rgba(255,255,255,.35);transition:transform .15s ease,background .15s ease}
.vd-ply svg{width:22px;height:22px;margin-left:3px;fill:#fff;transition:fill .15s ease}
.vd-card:hover .vd-ply i{transform:scale(1.06);background:var(--ac-1)}
.vd-card:hover .vd-ply svg{fill:var(--bx-brand-ink)}
.vd-card:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px;border-radius:12px}
.vd-dur{position:absolute;right:8px;bottom:8px;padding:2px 7px;border-radius:6px;background:rgba(0,0,0,.78);color:#fff;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
.vd-tx b{display:block;font-size:15px;line-height:1.25;font-weight:700;text-wrap:balance}
.vd-tx small{display:flex;gap:8px;align-items:center;margin-top:4px;color:var(--bx-text-3);font-size:12.5px}
.vd-sel{display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid rgba(var(--ac-1-rgb),.45);color:var(--ac-1);font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.vd-sel.ao{background:var(--ac-1);color:var(--bx-brand-ink);border-color:var(--ac-1)}
.vd-lista .vd-card{flex-direction:row;gap:12px;align-items:flex-start;padding:10px;border:1px solid var(--bx-border);border-radius:12px;background:var(--bx-surface);transition:background .15s ease,transform .15s ease}
.vd-lista .vd-card:hover{background:var(--bx-surface-2);transform:translateY(-2px)}
.vd-lista .vd-cap{width:128px;flex:none;border-radius:8px}
.vd-lista .vd-ply i{width:34px;height:34px}
.vd-lista .vd-ply svg{width:14px;height:14px}
.vd-lista .vd-dur{font-size:10.5px;right:5px;bottom:5px;padding:1px 5px}
.vd-lista .vd-tx b{font-size:14px}
@media (min-width:1024px){
  .vd{padding-top:28px}
  .vd-grade{grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);align-items:start}
  .vd-card.dest .vd-tx b{font-size:20px}
  .vd-lista .vd-card{flex-direction:column}
  .vd-lista .vd-cap{width:100%}
  .vd-lista .vd-ply i{width:44px;height:44px}
  .vd-lista .vd-ply svg{width:18px;height:18px}
  .vd-lista .vd-dur{font-size:12px;right:8px;bottom:8px;padding:2px 7px}
}
@media (prefers-reduced-motion:reduce){
  .vd-ply i,.vd-ply svg,.vd-ver,.vd-lista .vd-card{transition:none}
  .vd-lista .vd-card:hover{transform:none}
}
`
