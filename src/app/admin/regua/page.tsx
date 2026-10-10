'use client'

// Regua de e-mail: os 20 templates (E01..E20) e as variantes (E01B, E03B...) com a previa de cada um, montada
// pelo /api/admin/email-preview com os dados de exemplo do proprio template.
// O painel do motor (MotorRegua) mostra gatilho, publico e contagem de cada um;
// nos editoriais, o disparo com confirmacao dupla (so com REGUA_ATIVA=1).

import { useCallback, useEffect, useState } from 'react'
import { IconDesktop, IconPhone, IconLink } from '@/components/ui/Icons'
import MotorRegua from '@/components/admin/MotorRegua'

type ItemRegua = {
  id: string
  nome: string
  trilha: string
  categoria: string
  variantes: string[]
}

const CATEGORIA: Record<string, string> = {
  transacional: 'Transacional',
  colecao: 'Coleção',
  mercado: 'Mercado',
  novidades: 'Novidades',
  radar: 'Radar',
}

const LARGURA = { celular: 375, desktop: 600 } as const
type Tela = keyof typeof LARGURA

function nomeVariante(v: string): string {
  if (!v) return 'Principal'
  if (v === '5mais') return '5 ou mais'
  return v.length === 1 ? `Variante ${v.toUpperCase()}` : v
}

function urlPrevia(id: string, variante: string): string {
  const q = new URLSearchParams({ tpl: id })
  if (variante) q.set('variante', variante)
  return `/api/admin/email-preview?${q.toString()}`
}

export default function AdminReguaPage() {
  const [itens, setItens] = useState<ItemRegua[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [atual, setAtual] = useState<string>('')
  const [variante, setVariante] = useState<string>('')
  const [tela, setTela] = useState<Tela>('celular')
  const [altura, setAltura] = useState(900)
  const [carregandoPrevia, setCarregandoPrevia] = useState(true)

  const load = useCallback(async () => {
    setErro(null)
    try {
      const res = await fetch('/api/admin/email-preview?tpl=lista', { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Sessão de admin expirada. Entre de novo.' : `Erro ${res.status}`)
      const d = await res.json()
      const lista: ItemRegua[] = d.templates || []
      setItens(lista)
      let inicial = ''
      try { inicial = decodeURIComponent(window.location.hash.slice(1)).toUpperCase() } catch {}
      setAtual(lista.some((t) => t.id === inicial) ? inicial : (lista[0]?.id ?? ''))
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível carregar a régua.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    try {
      const salva = localStorage.getItem('adm-regua-tela')
      if (salva === 'celular' || salva === 'desktop') setTela(salva)
    } catch {}
  }, [])

  function escolher(id: string) {
    if (id === atual) return
    setAtual(id)
    setVariante('')
    setCarregandoPrevia(true)
    try { history.replaceState(null, '', `#${id}`) } catch {}
    if (window.matchMedia('(max-width: 1023px)').matches) {
      document.getElementById('rg-previa')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function trocarTela(t: Tela) {
    setTela(t)
    try { localStorage.setItem('adm-regua-tela', t) } catch {}
  }

  const item = itens.find((t) => t.id === atual)
  const src = item ? urlPrevia(item.id, variante) : ''

  return (
    <div className="rg-page" style={{ maxWidth: 1280, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 4px', color: 'var(--bx-text)' }}>
          Régua de e-mail
        </h1>
        <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.5 }}>
          Os 20 e-mails da régua com os dados de exemplo de cada um e a Seleção Bynx do momento. A contagem não envia nada; o disparo dos editoriais só sai com a régua ligada e confirmação dupla.
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--bx-text-3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
      ) : erro ? (
        <div className="rg-card" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--bx-red)', margin: '0 0 12px' }}>{erro}</p>
          <button type="button" className="rg-btn-sec" onClick={() => { setLoading(true); load() }}>Tentar de novo</button>
        </div>
      ) : (
        <div className="rg-grid">

          {/* Lista dos 20 */}
          <nav className="rg-lista" aria-label="Templates da régua">
            {itens.map((t) => {
              const ativo = t.id === atual
              return (
                <button key={t.id} type="button" className={`rg-item${ativo ? ' ativo' : ''}`}
                  aria-current={ativo ? 'true' : undefined} onClick={() => escolher(t.id)}>
                  <span className="rg-id">{t.id}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="rg-nome">{t.nome}</span>
                    <span className="rg-meta">
                      {t.trilha}
                      <span aria-hidden="true"> · </span>
                      <span className={t.categoria === 'transacional' ? 'rg-transacional' : undefined}>
                        {CATEGORIA[t.categoria] ?? t.categoria}
                      </span>
                      {t.variantes.length > 0 && (
                        <>
                          <span aria-hidden="true"> · </span>
                          {t.variantes.length + 1} versões
                        </>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Previa */}
          {item && (
            <section id="rg-previa" className="rg-card rg-previa" aria-label={`Prévia do ${item.id}`}>
              <div className="rg-previa-topo">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="rg-rotulo" style={{ margin: '0 0 4px' }}>{item.id} · {CATEGORIA[item.categoria] ?? item.categoria}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--bx-text)', margin: 0, lineHeight: 1.35 }}>{item.nome}</p>
                </div>
                <div className="rg-telas" role="group" aria-label="Largura da prévia">
                  <button type="button" className={`rg-tela${tela === 'celular' ? ' ativa' : ''}`} aria-pressed={tela === 'celular'} onClick={() => trocarTela('celular')}>
                    <IconPhone size={16} color="currentColor" /> Celular
                  </button>
                  <button type="button" className={`rg-tela${tela === 'desktop' ? ' ativa' : ''}`} aria-pressed={tela === 'desktop'} onClick={() => trocarTela('desktop')}>
                    <IconDesktop size={16} color="currentColor" /> Desktop
                  </button>
                </div>
              </div>

              <MotorRegua key={item.id} id={item.id} />

              {item.variantes.length > 0 && (
                <div className="rg-variantes" role="group" aria-label="Versão do exemplo">
                  {['', ...item.variantes].map((v) => (
                    <button key={v || 'principal'} type="button" className={`rg-chip${variante === v ? ' ativa' : ''}`}
                      aria-pressed={variante === v}
                      onClick={() => { if (v !== variante) { setVariante(v); setCarregandoPrevia(true) } }}>
                      {nomeVariante(v)}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, margin: '14px 0 8px' }}>
                <span className="rg-rotulo">{LARGURA[tela]} px{carregandoPrevia ? ' · carregando' : ''}</span>
                <a href={src} target="_blank" rel="noopener noreferrer" className="rg-link">
                  <IconLink size={14} color="currentColor" /> Abrir em nova aba
                </a>
              </div>

              <div className="rg-moldura">
                <iframe
                  key={`${src}|${tela}`}
                  title={`Prévia do e-mail ${item.id}`}
                  src={src}
                  sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  onLoad={(e) => {
                    setCarregandoPrevia(false)
                    try {
                      const h = e.currentTarget.contentDocument?.documentElement?.scrollHeight
                      if (h) setAltura(h + 8)
                    } catch {}
                  }}
                  style={{ width: LARGURA[tela], maxWidth: '100%', height: altura, border: 0, display: 'block', margin: '0 auto', background: 'var(--bx-bg)' }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: '10px 2px 0', lineHeight: 1.6 }}>
                Imagens pessoais (rota de imagem) saem no modo exemplo. O rodapé usa links de exemplo: o Descadastrar daqui não descadastra ninguém.
              </p>
            </section>
          )}
        </div>
      )}

      <style>{`
        .rg-page { padding: 24px 16px; }
        @media (min-width: 768px) { .rg-page { padding: 32px 24px; } }

        .rg-card { background: var(--bx-surface); border: 1px solid var(--bx-border); border-radius: 12px; padding: 16px; }
        .rg-rotulo { font-size: 11px; font-weight: 700; color: var(--bx-text-3); text-transform: uppercase; letter-spacing: 0.07em; }

        .rg-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (min-width: 1024px) {
          .rg-grid { grid-template-columns: 340px minmax(0, 1fr); }
          .rg-lista { position: sticky; top: 76px; max-height: calc(100vh - 96px); overflow-y: auto; }
        }

        .rg-lista { display: flex; flex-direction: column; gap: 6px; }
        .rg-item {
          display: flex; align-items: flex-start; gap: 12px; width: 100%; min-height: 44px; text-align: left;
          padding: 10px 12px; border-radius: 12px; border: 1px solid var(--bx-border);
          background: var(--bx-surface); color: var(--bx-text); font-family: inherit; cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .rg-item:hover { border-color: var(--bx-border-2); }
        .rg-item.ativo { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.10); }
        .rg-item:focus-visible, .rg-tela:focus-visible, .rg-chip:focus-visible, .rg-link:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .rg-id {
          flex-shrink: 0; min-width: 44px; height: 24px; padding: 0 8px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; background: var(--bx-surface-2); color: var(--bx-text-2);
        }
        .rg-item.ativo .rg-id { background: var(--ac-grad); color: var(--bx-brand-ink, #0a0a0a); }
        .rg-nome { display: block; font-size: 14px; font-weight: 700; line-height: 1.35; color: var(--bx-text); }
        .rg-meta { display: block; margin-top: 2px; font-size: 12px; line-height: 1.4; color: var(--bx-text-3); }
        .rg-transacional { color: var(--ac-1); font-weight: 700; }

        .rg-previa { scroll-margin-top: 76px; }
        .rg-previa-topo { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .rg-telas { display: inline-flex; gap: 4px; padding: 3px; border-radius: 12px; border: 1px solid var(--bx-border); background: var(--bx-surface-2); }
        .rg-tela {
          display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 12px; border-radius: 9px;
          border: 0; background: transparent; color: var(--bx-text-2); font-size: 13px; font-weight: 700;
          font-family: inherit; cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
        }
        .rg-tela.ativa { background: var(--bx-surface); color: var(--bx-text); }

        .rg-variantes { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
        .rg-chip {
          display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px;
          border: 1px solid var(--bx-border); background: var(--bx-surface); color: var(--bx-text-2);
          font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .rg-chip:hover { border-color: var(--bx-border-2); }
        .rg-chip.ativa { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.10); color: var(--bx-text); }

        .rg-link { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-size: 13px; font-weight: 700; color: var(--ac-1); text-decoration: none; }
        .rg-link:hover { text-decoration: underline; }

        .rg-moldura { border: 1px solid var(--bx-border); border-radius: 12px; background: var(--bx-bg); overflow: hidden; }

        .rg-btn-sec {
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px;
          border-radius: 12px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2);
          color: var(--bx-text); font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: background 0.15s ease;
        }
        .rg-btn-sec:hover { background: var(--bx-surface-3); }

        @media (prefers-reduced-motion: reduce) {
          .rg-item, .rg-tela, .rg-chip, .rg-btn-sec { transition: none; }
        }
      `}</style>
    </div>
  )
}
