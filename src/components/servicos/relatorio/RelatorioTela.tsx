'use client'

// Tela do relatorio de bancada no admin: busca o dado, mostra a barra de
// impressao (some no papel) e o documento. O botao "Imprimir" so habilita com
// a paginacao medida, nenhuma pagina estourada e todas as fotos decodificadas.
// A URL assinada das fotos vale 10 min: "Recarregar fotos" refaz o GET.
//
// As fotos da bancada sao WebP, e o PDF nao tem WebP: o Chrome regrava cada
// uma sem compressao com perda (5 MB por foto, ~80 MB por carta). Antes de
// desenhar, cada foto vira um JPEG de ate 1400 px no lado maior (mais de
// 400 dpi na maior moldura do papel, 63 x 88 mm), que o PDF embute como esta.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import RelatorioImpresso, { type EstadoImpressao } from '@/components/servicos/relatorio/RelatorioImpresso'
import type { RelatorioDados } from '@/lib/servicosRelatorio'
import { IconChevronLeft, IconWarning } from '@/components/ui/Icons'

const LADO_MAX_PX = 1400
const QUALIDADE_JPEG = 0.86

async function paraJpeg(url: string): Promise<string | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    const bmp = await createImageBitmap(await r.blob())
    const esc = Math.min(1, LADO_MAX_PX / Math.max(bmp.width, bmp.height))
    const cv = document.createElement('canvas')
    cv.width = Math.max(1, Math.round(bmp.width * esc))
    cv.height = Math.max(1, Math.round(bmp.height * esc))
    const ctx = cv.getContext('2d')
    if (!ctx) return null
    // JPEG nao tem transparencia: fundo branco de papel, senao o transparente vira preto.
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.drawImage(bmp, 0, 0, cv.width, cv.height)
    bmp.close()
    const blob = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/jpeg', QUALIDADE_JPEG))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

/** Copia do dado com cada foto trocada pelo JPEG local (null quando falhou: o papel mostra e trava a impressao). */
async function prepararFotos(d: RelatorioDados, criadas: string[]): Promise<RelatorioDados> {
  const fotos = d.cartas.flatMap(c => c.fotos).filter(f => f.url)
  const novo = new Map<string, string | null>()
  let i = 0
  const trabalhador = async () => {
    while (i < fotos.length) {
      const url = fotos[i++].url!
      const j = await paraJpeg(url)
      if (j) criadas.push(j)
      novo.set(url, j)
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabalhador))
  return { ...d, cartas: d.cartas.map(c => ({ ...c, fotos: c.fotos.map(f => ({ ...f, url: f.url ? novo.get(f.url) ?? null : null })) })) }
}

export function RelatorioTela({ id, dados, recarregar, carregando, erro, pendencias }: {
  id: string
  dados: RelatorioDados | null
  recarregar: () => void
  carregando: boolean
  erro?: string
  pendencias?: string[]
}) {
  const [estado, setEstado] = useState<EstadoImpressao | null>(null)
  const [preparado, setPreparado] = useState<{ de: RelatorioDados; dados: RelatorioDados } | null>(null)
  const anteriores = useRef<string[]>([])

  useEffect(() => {
    if (!dados) return
    let vivo = true
    const criadas: string[] = []
    prepararFotos(dados, criadas).then(d => {
      if (!vivo) { criadas.forEach(u => URL.revokeObjectURL(u)); return }
      anteriores.current.forEach(u => URL.revokeObjectURL(u))
      anteriores.current = criadas
      setPreparado({ de: dados, dados: d })
    })
    return () => { vivo = false }
  }, [dados])
  useEffect(() => () => anteriores.current.forEach(u => URL.revokeObjectURL(u)), [])

  const emPreparo = !!dados && preparado?.de !== dados
  const pronto = !!estado?.pronto && estado.estouro.length === 0 && estado.fotos === 'ok' && !carregando && !emPreparo

  let situacao = 'Montando as páginas...'
  if (emPreparo) situacao = 'Preparando as fotos para impressão...'
  else if (estado?.pronto) {
    if (estado.estouro.length) situacao = `Conteúdo passou da página ${estado.estouro.join(', ')}. Não imprimir.`
    else if (estado.fotos === 'carregando') situacao = `${estado.paginas} páginas. Carregando as fotos...`
    else if (estado.fotos === 'erro') situacao = 'Alguma foto não carregou (o link vale 10 minutos). Recarregue as fotos.'
    else situacao = `${estado.paginas} páginas prontas.`
  }

  return (
    <div className="rel-raiz">
      <style>{CSS_TELA}</style>
      <div className="rel-tela" data-theme="light">
        <div className="rel-barra">
          <Link href={`/admin/servicos/${id}`} className="rel-voltar"><IconChevronLeft size={16} /> Pedido</Link>
          {dados && (
            <>
              <div className="rel-barra-acoes">
                <button type="button" className="rel-bt rel-bt-pri" disabled={!pronto} onClick={() => window.print()}>Imprimir / Salvar PDF</button>
                <button type="button" className="rel-bt" disabled={carregando} onClick={recarregar}>{carregando ? 'Recarregando...' : 'Recarregar fotos'}</button>
              </div>
              <p className="rel-instrucao">
                No Chrome: destino <b>Salvar como PDF</b>, papel <b>A4</b>, margens <b>Nenhuma</b>, escala <b>100%</b> (padrão) e <b>Gráficos de plano de fundo</b> ligado.
              </p>
              <p className={`rel-situacao${estado?.estouro.length || estado?.fotos === 'erro' ? ' rel-ruim' : ''}`} role="status">{situacao}</p>
            </>
          )}
        </div>

        {erro && (
          <div className="rel-erro">
            <p><IconWarning size={15} /> {erro}</p>
            {pendencias && pendencias.length > 0 && <ul>{pendencias.map(p => <li key={p}>{p}</li>)}</ul>}
            <button type="button" className="rel-bt" onClick={recarregar}>Tentar de novo</button>
          </div>
        )}
        {!dados && !erro && <p className="rel-carregando">Carregando o relatório...</p>}
        {preparado && <RelatorioImpresso dados={preparado.dados} onEstado={setEstado} />}
      </div>
    </div>
  )
}

export default function RelatorioPagina({ id }: { id: string }) {
  const [dados, setDados] = useState<RelatorioDados | null>(null)
  const [erro, setErro] = useState<{ t: string; pendencias?: string[] } | null>(null)
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch(`/api/admin/servicos/${id}/relatorio`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setErro({ t: r.status === 409 && d.pendencias ? 'O relatório ainda não pode sair. Falta:' : d.error || 'Não deu para montar o relatório.', pendencias: d.pendencias })
        return
      }
      setErro(null)
      setDados(d as RelatorioDados)
    } catch {
      setErro({ t: 'Sem conexão com o servidor.' })
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    let vivo = true
    // Busca inicial; o estado muda so quando a resposta chega.
    Promise.resolve().then(() => { if (vivo) carregar() })
    return () => { vivo = false }
  }, [carregar])

  return <RelatorioTela id={id} dados={dados} recarregar={carregar} carregando={carregando} erro={erro?.t} pendencias={erro?.pendencias} />
}

// A raiz fica no escopo ESCURO (tokens do :root) e captura as cores das faixas
// de marca em --ink*; a partir de .rel-tela vale o bloco claro do globals.css.
const CSS_TELA = `
.rel-raiz{--ink:var(--bx-bg);--ink-text:var(--bx-text);--ink-text-2:var(--bx-text-2);--ink-border:var(--bx-border-2);--ink-surface:var(--bx-surface-2);
  width:100%;flex:1}
.rel-tela{min-height:100vh;background:var(--bx-surface-3);color:var(--bx-text);padding:0 0 24mm;font-family:var(--font-dm-sans),system-ui,sans-serif}
.rel-barra{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:12px 16px;margin-bottom:10mm;
  background:var(--bx-bg-elev);border-bottom:1px solid var(--bx-border)}
.rel-voltar{display:inline-flex;align-items:center;gap:4px;min-height:40px;font-size:13px;font-weight:700;color:var(--bx-text-2);text-decoration:none}
.rel-barra-acoes{display:flex;flex-wrap:wrap;gap:8px}
.rel-bt{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border-radius:9px;border:1px solid var(--bx-border-2);
  background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s ease}
.rel-bt:disabled{opacity:.5;cursor:not-allowed}
.rel-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.rel-instrucao{flex-basis:100%;margin:0;font-size:12.5px;color:var(--bx-text-2)}
.rel-instrucao b{color:var(--bx-text)}
.rel-situacao{flex-basis:100%;margin:0;font-size:12.5px;font-weight:700;color:var(--bx-text)}
.rel-situacao.rel-ruim{color:var(--bx-red)}
.rel-erro{max-width:210mm;margin:0 auto;padding:16px;display:grid;gap:10px;font-size:14px}
.rel-erro p{display:flex;gap:6px;align-items:center;margin:0;font-weight:700;color:var(--bx-red)}
.rel-erro ul{margin:0;padding-left:20px;color:var(--bx-text-2)}
.rel-erro .rel-bt{justify-self:start}
.rel-carregando{max-width:210mm;margin:0 auto;padding:16px;font-size:14px;color:var(--bx-text-2)}
@media print{
  body>*:not(.rel-raiz):not(:has(.rel-raiz)){display:none!important}
  html,body{background:none!important}
  .rel-tela{background:none;padding:0;min-height:0}
  .rel-barra,.rel-erro,.rel-carregando{display:none!important}
}
`
