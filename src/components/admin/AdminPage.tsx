'use client'

// Casca padrao de uma tela do /admin: wrapper com margem, titulo, subtitulo e
// a acao do cabecalho. Nasceu em 07/11/2026 porque a .adm-content do layout
// nao tem padding e cada tela trazia o proprio wrapper (21 copias, cinco
// larguras). Amigo Secreto, Aniversariantes, Leiloes e Convites eram as
// telas sem wrapper nenhum: o conteudo encostava na borda em 375 px.
//
// O /admin crava valores proprios (nao usa --ac-*): aqui ficam os que as
// outras telas ja repetem (32px 24px, h1 26/800/-0.03em, subtitulo 13px).

import type { ReactNode } from 'react'

const LARGURAS = { estreita: 1100, media: 1280, larga: 1380 } as const

export function AdminPage({ titulo, subtitulo, acao, largura = 'estreita', children }: {
  titulo: string
  subtitulo?: ReactNode
  acao?: ReactNode
  largura?: keyof typeof LARGURAS
  children: ReactNode
}) {
  return (
    <div className="adm-page" style={{ maxWidth: LARGURAS[largura] }}>
      <div className="adm-page-head">
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 className="adm-page-h1">{titulo}</h1>
          {subtitulo && <p className="adm-page-sub">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
      <style>{`
        .adm-page{padding:32px 24px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
        .adm-page-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:4px}
        .adm-page-h1{font-size:26px;font-weight:800;letter-spacing:-0.03em;margin:0 0 6px;color:#f0f0f0}
        .adm-page-sub{font-size:13px;line-height:1.5;color:rgba(255,255,255,0.45);margin:0}
        .adm-vazio{border:1px dashed rgba(255,255,255,0.14);border-radius:14px;padding:40px 20px;text-align:center;font-size:14px;color:rgba(255,255,255,0.6)}
        .adm-faixa{font-size:13px;border-radius:10px;padding:10px 12px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.03);color:#f0f0f0}
        .adm-faixa-erro{color:#ef4444;border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.08)}
        .adm-faixa-ok{color:#22c55e;border-color:rgba(34,197,94,0.35);background:rgba(34,197,94,0.08)}
        @media (max-width:640px){.adm-page{padding:20px 16px}}
      `}</style>
    </div>
  )
}

/** Estado vazio, carregando ou erro de lista: bloco tracejado centralizado. */
export function AdminVazio({ children }: { children: ReactNode }) {
  return <div className="adm-vazio">{children}</div>
}

/** Faixa de retorno (erro / ok / neutra), a mesma nas telas do admin. */
export function AdminFaixa({ tom = 'neutro', children }: { tom?: 'neutro' | 'erro' | 'ok'; children: ReactNode }) {
  return <div role={tom === 'erro' ? 'alert' : undefined} className={`adm-faixa${tom === 'erro' ? ' adm-faixa-erro' : tom === 'ok' ? ' adm-faixa-ok' : ''}`}>{children}</div>
}
