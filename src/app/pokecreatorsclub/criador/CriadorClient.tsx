'use client'

// Página pública de um criador do Poké Creators Club (Fase 2, fatia 2). Qualquer pessoa abre,
// sem entrar. O @ vem em ?u= e o conteúdo é lido por club_portfolio_publico, que só devolve o
// @, a bio, o que a pessoa produz e os links dos conteúdos ativos. O criador é a estrela: o @
// dele grande, e a Bynx aparece só no rodapé. Nada da rede carrega aqui dentro: cada link abre em
// outra aba.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CLUB } from '@/lib/pcc/rotas'
import { FORMATOS, PRODUZ, REDES, TEMAS, carregarCriador, dataBrCurta, type CriadorPublico } from '@/lib/pcc/portfolio'
import { AS_CSS, Ico, VoltarClub } from '../amigo-secreto/estilo'

type Estado = { fase: 'lendo' } | { fase: 'falhou' } | { fase: 'ok'; d: CriadorPublico | null }

export default function CriadorClient() {
  const [estado, setEstado] = useState<Estado>({ fase: 'lendo' })

  useEffect(() => {
    let vivo = true
    const u = (new URLSearchParams(window.location.search).get('u') || '').trim().replace(/^@+/, '').toLowerCase()
    const pronto = /^[a-z0-9._]{1,30}$/.test(u) ? carregarCriador(u) : Promise.resolve({ ok: true as const, d: null })
    pronto.then(r => { if (vivo) setEstado(r.ok ? { fase: 'ok', d: r.d } : { fase: 'falhou' }) })
    return () => { vivo = false }
  }, [])

  const d = estado.fase === 'ok' ? estado.d : null

  return (
    <div className="as cr">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={CLUB} />
          <span className="t">Poké Creators Club</span>
          <span style={{ width: 44 }} aria-hidden="true" />
        </div>
      </header>
      <main className="bx-gutter">
        <div className="as-wrap as-bd">
          {estado.fase === 'lendo' && <div className="as-center"><span className="as-meta">Abrindo...</span></div>}
          {estado.fase === 'falhou' && <div className="as-erro" role="alert">Não conseguimos carregar agora. Tente de novo em instantes.</div>}
          {estado.fase === 'ok' && !d && (
            <div className="as-center">
              <span className="as-selo as-selo-ico" aria-hidden="true"><Ico n="user" s={40} /></span>
              <h1 className="as-h2">Criador não encontrado</h1>
              <p className="as-p">Esse endereço não tem um portfólio no Club.</p>
              <Link href={CLUB} className="as-btn" style={{ maxWidth: 320 }}>Conhecer o Club</Link>
            </div>
          )}
          {d && (
            <>
              <div className="cr-topo">
                <div className="as-eye"><Ico n="video" s={14} />Criador do Poké Creators Club</div>
                <h1 className="cr-arroba">@{d.criador.instagram}</h1>
                {d.criador.bio && <p className="cr-bio">{d.criador.bio}</p>}
                {d.criador.produz.length > 0 && (
                  <div className="cr-chips">{d.criador.produz.map(p => <span key={p} className="as-chip">{PRODUZ[p] || p}</span>)}</div>
                )}
                <a href={`https://www.instagram.com/${d.criador.instagram}/`} target="_blank" rel="noopener noreferrer nofollow" className="as-btn pri cr-ig"><Ico n="insta" s={18} />Ver no Instagram</a>
              </div>

              <section className="as-card cr-sec">
                <div className="as-eye-row">
                  <h2 className="as-h3">Conteúdos</h2>
                  <span className="as-meta">{d.criador.total} {d.criador.total === 1 ? 'conteúdo' : 'conteúdos'}</span>
                </div>
                {d.conteudos.map(c => (
                  <a key={c.url} href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="cr-lin">
                    <span className="cr-lin-tx">
                      <b>{c.tema && c.tema !== 'outro' ? TEMAS[c.tema] : FORMATOS[c.formato]}</b>
                      <small>{REDES[c.rede]} · {FORMATOS[c.formato]} · {dataBrCurta(c.publicado_em)}</small>
                    </span>
                    <Ico n="ext" s={16} />
                  </a>
                ))}
                {d.criador.total > d.conteudos.length && <p className="as-hint">Mostrando os {d.conteudos.length} mais recentes.</p>}
              </section>

              <p className="cr-rodape">Página de um membro do Poké Creators Club, a comunidade de criadores de Pokémon TCG da Bynx. Os links levam às redes do próprio criador.</p>
              <Link href={CLUB} className="as-btn lnk">Conhecer o Club</Link>
            </>
          )}
        </div>
      </main>
      <style>{AS_CSS + CR_CSS}</style>
    </div>
  )
}

const CR_CSS = `
.cr-topo{display:flex;flex-direction:column;gap:10px;padding:8px 0 4px}
.cr-arroba{font-size:32px;font-weight:800;letter-spacing:-.03em;line-height:1.1;overflow-wrap:anywhere}
.cr-bio{font-size:15px;color:var(--bx-text-2);line-height:1.5}
.cr-chips{display:flex;flex-wrap:wrap;gap:6px}
.cr-ig{align-self:flex-start;width:auto;padding:0 18px;gap:8px}
.cr-sec{gap:0;padding:14px}
.cr-sec .as-eye-row{padding-bottom:10px}
.cr-lin{display:flex;align-items:center;gap:10px;min-height:56px;padding:8px 0;border-top:1px solid var(--bx-border);text-decoration:none;color:var(--bx-text)}
.cr-lin:hover b{text-decoration:underline}
.cr-lin-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cr-lin-tx b{font-size:14px;font-weight:700}
.cr-lin-tx small{font-size:12px;color:var(--bx-text-3)}
.cr-lin .as-ico{color:var(--bx-text-3);flex:none}
.cr-rodape{font-size:12.5px;color:var(--bx-text-3);line-height:1.5}
@media (min-width:1024px){
  .cr .as-wrap.as-bd{max-width:1120px;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:16px 48px;align-items:start}
  .cr .as-wrap.as-bd>*{grid-column:1/-1}
  .cr-topo{grid-column:1 !important;position:sticky;top:84px}
  .cr-sec{grid-column:2 !important;grid-row:1/span 3}
  .cr-rodape{grid-column:1 !important}
  .cr .as-wrap.as-bd>.as-btn.lnk{grid-column:1 !important;justify-self:start;width:auto}
  .cr-arroba{font-size:44px}
}
`
