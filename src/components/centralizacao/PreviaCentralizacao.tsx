'use client'

// Previa de centralizacao do usuario logado (/centralizacao). Entrega ~10% do
// Pre-grading: so a FRENTE, deteccao automatica, a proporcao do pior eixo e
// uma faixa em linguagem simples. Nenhuma graduadora, nenhuma nota, nenhum mm.
// O resto do Pre-grading aparece trancado logo abaixo do resultado.
//
// Em troca, estilo Captcha, a pessoa diz qual e a carta: vindo da Colecao ela
// ja vem escolhida; avulso, digita o numero impresso e escolhe entre as cartas
// do catalogo com aquela numeracao. Cada medicao e gravada SEM foto pela rota
// /api/centralizacao, que tambem aplica o limite de 20 por 24 h (ilimitado no
// Pro). A foto nunca sai do celular: tudo e calculado aqui, com o mesmo nucleo
// do medidor do admin (src/lib/centralizacao).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { track } from '@/lib/analytics'
import { PRECOS } from '@/lib/servicos'
import { detectarCarta, retificar, detectarMoldura, CARTA_MM, LADOS, type Pt, type Imagem } from '@/lib/centralizacao/visao'
import { medir, linhasPadrao, type Linhas } from '@/lib/centralizacao/medida'
import { faixaDe, ROTULO_FAIXA, fmtProporcao, lerNumeroImpresso, type FaixaPrevia } from '@/lib/centralizacao/previa'
import { IconCamera, IconImage, IconWarning, IconCheck, IconChevronLeft, IconArrowRight, IconClock } from '@/components/ui/Icons'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import CardItem, { type CardPrice } from '@/components/ui/CardItem'

type Carta = { id: string; name: string; name_pt: string | null; number: string | null; set_name: string | null; set_total: number | null; idioma: string | null; image_small: string | null } & CardPrice
type Situacao = { limite: number | null; usadas: number; restantes: number | null; bloqueado: boolean; liberaEm: string | null; perguntar: boolean }
type Etapa = 'carregando' | 'semLogin' | 'limite' | 'carta' | 'foto' | 'processando' | 'cantos' | 'semMoldura' | 'resultado' | 'erro'
type Resultado = {
  lr: number; tb: number; pior: number; eixo: 'lr' | 'tb'; faixa: FaixaPrevia
  retUrl: string; linhas: Linhas; confianca: number
}

const MAX_LADO = 2400
const PPM = 12
const MARGEM = 3

const IDIOMA: Record<string, string> = { pt: 'Português', en: 'Inglês', jp: 'Japonês', ja: 'Japonês', cn: 'Chinês', kr: 'Coreano', ko: 'Coreano' }

// ── foto ──────────────────────────────────────────────────────────────────────

async function carregarFoto(arquivo: Blob) {
  const bmp = await createImageBitmap(arquivo)
  const esc = Math.min(1, MAX_LADO / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * esc), h = Math.round(bmp.height * esc)
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const id = ctx.getImageData(0, 0, w, h)
  const url = await new Promise<string>((res, rej) => cv.toBlob(b => (b ? res(URL.createObjectURL(b)) : rej(new Error('blob'))), 'image/jpeg', 0.9))
  return { img: { width: w, height: h, data: id.data } as Imagem, url }
}

function imagemParaUrl(r: { width: number; height: number; data: Uint8ClampedArray }) {
  const cv = document.createElement('canvas'); cv.width = r.width; cv.height = r.height
  cv.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0)
  return new Promise<string>((res, rej) => cv.toBlob(b => (b ? res(URL.createObjectURL(b)) : rej(new Error('blob'))), 'image/jpeg', 0.9))
}

function cantosPadrao(w: number, h: number): Pt[] {
  const ch = Math.min(h * 0.8, (w * 0.8 * CARTA_MM.h) / CARTA_MM.w), cw = (ch * CARTA_MM.w) / CARTA_MM.h
  const x0 = (w - cw) / 2, y0 = (h - ch) / 2
  return [[x0, y0], [x0 + cw, y0], [x0 + cw, y0 + ch], [x0, y0 + ch]]
}

function faltaTempo(iso: string | null, agora: number) {
  if (!iso) return null
  const ms = Math.max(0, new Date(iso).getTime() - agora)
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000)
  return { ms, texto: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
}

const nomeCarta = (c: Carta) => c.name_pt || c.name

// ── componente ────────────────────────────────────────────────────────────────

export default function PreviaCentralizacao({ cartaInicial }: { cartaInicial?: string | null }) {
  const [etapa, setEtapa] = useState<Etapa>('carregando')
  const [sit, setSit] = useState<Situacao | null>(null)
  const [carta, setCarta] = useState<Carta | null>(null)
  const [origem, setOrigem] = useState<'colecao' | 'avulso'>('avulso')
  const [escolha, setEscolha] = useState<'carta' | 'nenhuma'>('carta')
  const [numero, setNumero] = useState('')
  const [numeroBuscado, setNumeroBuscado] = useState('')
  const [candidatos, setCandidatos] = useState<Carta[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [foto, setFoto] = useState<{ img: Imagem; url: string } | null>(null)
  const [cantos, setCantos] = useState<Pt[]>([])
  const [res, setRes] = useState<Resultado | null>(null)
  const [previaId, setPreviaId] = useState<string | null>(null)
  const [respondeu, setRespondeu] = useState(false)
  const [agora, setAgora] = useState(0)
  const token = useRef<string | null>(null)
  const inputCamera = useRef<HTMLInputElement | null>(null)
  const inputGaleria = useRef<HTMLInputElement | null>(null)
  const svgCantos = useRef<SVGSVGElement | null>(null)
  const arrastando = useRef<number | null>(null)
  const ajustouCantos = useRef(false)

  const api = useCallback(async (caminho: string, init?: RequestInit) => {
    const r = await fetch(caminho, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.current}`, ...(init?.headers || {}) } })
    const d = await r.json().catch(() => ({}))
    return { ok: r.ok, status: r.status, d }
  }, [])

  // ── inicio ──
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!vivo) return
      if (!data.session) { setEtapa('semLogin'); return }
      token.current = data.session.access_token
      const st = await api('/api/centralizacao?acao=status')
      if (!vivo) return
      if (!st.ok) { setAviso(st.d.error || 'Não foi possível carregar agora.'); setEtapa('erro'); return }
      setSit(st.d)
      if (st.d.bloqueado) { setEtapa('limite'); return }
      if (cartaInicial) {
        const c = await api(`/api/centralizacao?acao=carta&id=${encodeURIComponent(cartaInicial)}`)
        if (!vivo) return
        if (c.ok && c.d.carta) {
          setCarta(c.d.carta); setOrigem('colecao'); setEscolha('carta'); setEtapa('foto'); return
        }
      }
      setEtapa('carta')
    })()
    return () => { vivo = false }
  }, [api, cartaInicial])

  // Cronometro do limite.
  useEffect(() => {
    if (etapa !== 'limite') return
    const tick = () => setAgora(Date.now())
    const t0 = setTimeout(tick, 0), t = setInterval(tick, 1000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [etapa])
  const falta = agora ? faltaTempo(sit?.liberaEm ?? null, agora) : null
  useEffect(() => {
    if (etapa !== 'limite' || !falta || falta.ms > 0) return
    // Liberou: confere de novo no servidor.
    api('/api/centralizacao?acao=status').then(st => {
      if (st.ok) { setSit(st.d); if (!st.d.bloqueado) setEtapa(carta ? 'foto' : 'carta') }
    })
  }, [etapa, falta, api, carta])

  // ── escolher a carta ──
  const buscar = async () => {
    setAviso('')
    const lido = lerNumeroImpresso(numero)
    if (!lido) { setAviso('Digite o número como está na carta, por exemplo 025/198.'); return }
    setBuscando(true)
    const r = await api(`/api/centralizacao?acao=candidatos&numero=${encodeURIComponent(numero)}`)
    setBuscando(false)
    if (!r.ok) { setAviso(r.d.error || 'Não foi possível buscar agora.'); return }
    setNumeroBuscado(r.d.numero)
    setCandidatos(r.d.cartas || [])
  }
  const escolherCarta = (c: Carta) => { setCarta(c); setEscolha('carta'); setOrigem('avulso'); setEtapa('foto') }
  const nenhuma = () => { setCarta(null); setEscolha('nenhuma'); setOrigem('avulso'); setEtapa('foto') }

  // ── medir ──
  const medirCom = useCallback(async (img: Imagem, cs: Pt[], confExt: number[]) => {
    const ret = retificar(img, cs, PPM)
    const mold = detectarMoldura(ret)
    const firmes = LADOS.filter(l => mold[l].mm != null && mold[l].confianca >= 0.25).length
    if (firmes < 3) { setEtapa('semMoldura'); return }
    const linhas = linhasPadrao({ esq: mold.esq.mm, dir: mold.dir.mm, topo: mold.topo.mm, base: mold.base.mm })
    const m = medir(linhas)
    const lr = m.lr.maior, tb = m.tb.maior, pior = Math.max(lr, tb)
    const confs = [...confExt, ...LADOS.map(l => mold[l].confianca)]
    const confianca = confs.reduce((a, b) => a + b, 0) / confs.length
    const vis = retificar(img, cs, PPM, MARGEM)
    const retUrl = await imagemParaUrl(vis)
    const resultado: Resultado = { lr, tb, pior, eixo: lr >= tb ? 'lr' : 'tb', faixa: faixaDe(pior), retUrl, linhas, confianca }
    setRes(resultado)
    setEtapa('resultado')

    const r = await api('/api/centralizacao', {
      method: 'POST',
      body: JSON.stringify({
        acao: 'medir', origem, escolha, card_id: carta?.id ?? null,
        numero_digitado: origem === 'avulso' ? numeroBuscado || numero || null : null,
        candidatos_n: origem === 'avulso' ? candidatos?.length ?? null : null,
        lr, tb, confianca, ajustou_cantos: ajustouCantos.current,
      }),
    })
    if (r.status === 429) { setSit(s => (s ? { ...s, bloqueado: true, liberaEm: r.d.liberaEm } : s)); setEtapa('limite'); track({ name: 'centralizacao_limite', properties: {} }); return }
    if (r.ok) {
      setPreviaId(r.d.id); setSit(r.d.situacao)
      track({ name: 'centralizacao_medida', properties: { faixa: resultado.faixa, origem, escolha, ajustou_cantos: ajustouCantos.current } })
    }
  }, [api, carta, candidatos, escolha, numero, numeroBuscado, origem])

  const processar = async (arquivo?: File) => {
    if (!arquivo) return
    if (!arquivo.type.startsWith('image/')) { setAviso('Envie uma foto (JPG, PNG ou HEIC).'); return }
    setAviso(''); setRes(null); setPreviaId(null); setRespondeu(false); ajustouCantos.current = false
    setEtapa('processando')
    await new Promise(r => setTimeout(r, 40))
    try {
      if (foto?.url) URL.revokeObjectURL(foto.url)
      const f = await carregarFoto(arquivo)
      setFoto(f)
      const det = detectarCarta(f.img)
      if (!det.cantos || Math.min(...det.confianca) < 0.15) {
        setCantos(det.cantos ?? cantosPadrao(f.img.width, f.img.height))
        setEtapa('cantos')
        return
      }
      setCantos(det.cantos)
      await medirCom(f.img, det.cantos, det.confianca)
    } catch (e) {
      console.error('[previa centralizacao]', e)
      setAviso('Não foi possível ler esta foto. Tente outra.'); setEtapa('erro')
    }
  }

  // ── 4 cantos ──
  const pontoSvg = (ev: React.PointerEvent) => {
    const svg = svgCantos.current, ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY
    const q = p.matrixTransform(ctm.inverse())
    return [q.x, q.y] as Pt
  }
  const moverCanto = (ev: React.PointerEvent) => {
    const i = arrastando.current
    if (i == null || !foto) return
    const p = pontoSvg(ev)
    if (!p) return
    const x = Math.max(0, Math.min(foto.img.width, p[0])), y = Math.max(0, Math.min(foto.img.height, p[1]))
    setCantos(cs => cs.map((c, k) => (k === i ? [x, y] as Pt : c)))
  }
  const confirmarCantos = async () => {
    if (!foto) return
    ajustouCantos.current = true
    setEtapa('processando')
    await new Promise(r => setTimeout(r, 40))
    await medirCom(foto.img, cantos, [0.5, 0.5, 0.5, 0.5])
  }

  const responderImagem = async (ok: boolean | null) => {
    setRespondeu(true)
    if (ok === null || !previaId) return
    await api('/api/centralizacao', { method: 'POST', body: JSON.stringify({ acao: 'imagem', previa_id: previaId, ok }) })
  }

  const recomecar = () => {
    setCarta(null); setCandidatos(null); setNumero(''); setNumeroBuscado(''); setRes(null); setPreviaId(null); setAviso('')
    setEtapa(sit?.bloqueado ? 'limite' : 'carta')
  }

  const usoTexto = useMemo(() => {
    if (!sit) return ''
    if (sit.limite == null) return 'Medições ilimitadas no seu plano.'
    return `${sit.usadas} de ${sit.limite} medições nas últimas 24 horas.`
  }, [sit])

  // ── render ──
  return (
    <div className="pc">
      <style>{CSS}</style>
      <PageHeader
        trilha={[INICIO, { name: 'Centralização', href: '/centralizacao' }]}
        titulo="Medir centralização"
        descricao="Tire uma foto da frente da carta e veja se ela está bem centralizada."
      />

      {etapa === 'carregando' && <div className="pc-bloco pc-estreito pc-centro"><span className="pc-gira" aria-hidden /> Carregando...</div>}

      {etapa === 'semLogin' && (
        <div className="pc-bloco pc-estreito pc-centro">
          <b>Entre na sua conta para medir</b>
          <span className="pc-muted">A medição de centralização é grátis para quem tem conta na Bynx.</span>
        </div>
      )}

      {etapa === 'erro' && (
        <div className="pc-bloco pc-estreito pc-centro">
          <IconWarning size={22} />
          <b>{aviso || 'Algo deu errado.'}</b>
          <button type="button" className="pc-bt" onClick={recomecar}>Começar de novo</button>
        </div>
      )}

      {etapa === 'limite' && (
        <div className="pc-bloco pc-estreito pc-limite">
          <IconClock size={26} />
          <b>Você usou as {sit?.limite ?? 20} medições das últimas 24 horas</b>
          {falta && (
            <>
              <span className="pc-muted">A próxima medição libera em</span>
              <span className="pc-relogio" aria-live="polite">{falta.texto}</span>
            </>
          )}
          <span className="pc-muted">No plano Pro, as medições são ilimitadas.</span>
          <Link className="pc-bt pc-bt-pri" href="/planos">Conhecer o Pro</Link>
        </div>
      )}

      {/* ── 1. qual carta ── */}
      {etapa === 'carta' && (
        <div className="pc-bloco">
          <span className="pc-k">Qual é a carta?</span>
          <p className="pc-muted">Digite o número que está no canto de baixo da carta.</p>
          <form className="pc-busca" onSubmit={ev => { ev.preventDefault(); buscar() }}>
            <input id="pc-numero" className="pc-in" inputMode="text" autoComplete="off" placeholder="025/198" value={numero}
              onChange={ev => setNumero(ev.target.value)} aria-label="Número da carta" />
            <button type="submit" className="pc-bt pc-bt-pri" disabled={buscando}>{buscando ? 'Buscando...' : 'Buscar'}</button>
          </form>
          {aviso && <p className="pc-erro">{aviso}</p>}

          {candidatos && candidatos.length > 0 && (
            <>
              <p className="pc-muted">Toque na sua carta. Confira a arte, o set e o idioma.</p>
              <ul className="pc-cands">
                {candidatos.map(c => (
                  <li key={c.id} className="pc-cand" role="button" tabIndex={0} aria-label={`Escolher ${nomeCarta(c)}, ${c.set_name || ''}`}
                    onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); escolherCarta(c) } }}>
                    <CardItem mode="select" hidePriceTable onSelect={() => escolherCarta(c)}
                      card={{ id: c.id, name: nomeCarta(c), number: c.number ?? undefined, set_name: c.set_name ?? undefined, set_total: c.set_total ?? undefined, idioma: c.idioma ?? undefined, image_small: c.image_small ?? undefined, price: c }} />
                  </li>
                ))}
              </ul>
              <button type="button" className="pc-bt pc-bt-ghost" onClick={nenhuma}>Nenhuma destas</button>
            </>
          )}
          {candidatos && candidatos.length === 0 && (
            <div className="pc-aviso">
              <IconWarning size={16} />
              <div>
                <p><b>Não encontramos carta com o número {numeroBuscado}.</b></p>
                <p>Confira o número. Se estiver certo, você pode medir mesmo assim e a nossa equipe procura a carta.</p>
                <button type="button" className="pc-bt" onClick={nenhuma}>Medir mesmo assim</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. foto ── */}
      {etapa === 'foto' && (
        <div className="pc-bloco pc-estreito">
          {carta ? <CartaEscolhida c={carta} /> : <p className="pc-muted">Carta {numeroBuscado || 'não identificada'} · nossa equipe vai procurar no catálogo.</p>}
          <span className="pc-k">Como tirar a foto</span>
          <ul className="pc-dicas">
            {[
              ['Carta fora do sleeve e do toploader.', 'O plástico reflete e esconde a borda.'],
              ['De cima, com o celular reto.', 'A carta ocupando boa parte da tela.'],
              ['Fundo liso que contraste com a borda.', 'Borda amarela pede fundo escuro.'],
              ['Sem reflexo.', 'Luz do teto ou de lado, sem flash.'],
            ].map(([t, d]) => <li key={t}><IconCheck size={15} /><span><b>{t}</b> {d}</span></li>)}
          </ul>
          {aviso && <p className="pc-erro">{aviso}</p>}
          <div className="pc-bts pc-bts-col">
            <button type="button" className="pc-bt pc-bt-pri" onClick={() => inputCamera.current?.click()}><IconCamera size={16} /> Tirar foto da frente</button>
            <button type="button" className="pc-bt" onClick={() => inputGaleria.current?.click()}><IconImage size={16} /> Escolher da galeria</button>
          </div>
          <p className="pc-fine">A foto não sai do seu celular. A medição acontece aqui mesmo.</p>
          {origem === 'avulso' && <button type="button" className="pc-link" onClick={recomecar}><IconChevronLeft size={14} /> Trocar a carta</button>}
        </div>
      )}

      {etapa === 'processando' && (
        <div className="pc-bloco pc-estreito pc-centro"><span className="pc-gira" aria-hidden /> <b>Lendo a foto...</b><span className="pc-muted">Encontrando a carta e as bordas.</span></div>
      )}

      {/* ── 3. so quando a deteccao falha ── */}
      {etapa === 'cantos' && foto && (
        <div className="pc-bloco pc-estreito">
          <span className="pc-k">Ajustar os 4 cantos</span>
          <p className="pc-muted">Não achamos a carta inteira. Arraste cada círculo até um canto da carta e toque em Medir.</p>
          <div className="pc-palco">
            <svg ref={svgCantos} viewBox={`0 0 ${foto.img.width} ${foto.img.height}`} className="pc-svg"
              onPointerMove={moverCanto} onPointerUp={() => { arrastando.current = null }} onPointerCancel={() => { arrastando.current = null }}>
              <image href={foto.url} x={0} y={0} width={foto.img.width} height={foto.img.height} />
              <polygon points={cantos.map(c => c.join(',')).join(' ')} fill="none" style={{ stroke: 'var(--ac-1)' }} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {cantos.map(([x, y], i) => {
                const r = foto.img.width * 0.022
                return (
                  <g key={i} onPointerDown={ev => { ev.preventDefault(); svgCantos.current?.setPointerCapture(ev.pointerId); arrastando.current = i }} className="pc-alca">
                    <circle cx={x} cy={y} r={r * 2.4} fill="transparent" />
                    <circle cx={x} cy={y} r={r} style={{ fill: 'rgba(var(--ac-1-rgb), .25)', stroke: 'var(--ac-1)' }} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="pc-bts">
            <button type="button" className="pc-bt pc-bt-pri" onClick={confirmarCantos}>Medir</button>
            <button type="button" className="pc-bt" onClick={() => setEtapa('foto')}>Tirar outra foto</button>
          </div>
        </div>
      )}

      {etapa === 'semMoldura' && (
        <div className="pc-bloco pc-estreito pc-centro">
          <IconWarning size={22} />
          <b>Não encontramos a borda da impressão desta carta</b>
          <span className="pc-muted">Acontece em cartas full art, que não têm borda, ou com reflexo forte. Para essas cartas, a medição é feita no Pré-grading.</span>
          <div className="pc-bts">
            <button type="button" className="pc-bt" onClick={() => setEtapa('foto')}>Tirar outra foto</button>
            <Link className="pc-bt pc-bt-ghost" href="/pre-grading">Conhecer o Pré-grading</Link>
          </div>
        </div>
      )}

      {/* ── 4. resultado ── duas colunas a partir de 1024 px: resultado a esquerda,
          o Pre-grading trancado a direita (sticky). No celular, uma coluna. */}
      {etapa === 'resultado' && res && (
        <div className="pc-res">
          <div className="pc-res-a">
            <div className="pc-bloco">
              {carta && <CartaEscolhida c={carta} mini />}
              <span className="pc-selo">Estimativa pela foto, não é nota</span>
              <div className="pc-num">{fmtProporcao(res.pior)}</div>
              <div className="pc-muted">{res.eixo === 'lr' ? 'Esquerda e direita' : 'Topo e base'}, o lado mais descentralizado</div>
              <div className={`pc-faixa pc-f-${res.faixa}`}><i aria-hidden />{ROTULO_FAIXA[res.faixa]}</div>
              <div className="pc-termo" role="img" aria-label={`Termômetro: ${ROTULO_FAIXA[res.faixa]}`}>
                {(['bem', 'levemente', 'descentralizada'] as FaixaPrevia[]).map(f => <span key={f} className={`pc-z pc-z-${f}${f === res.faixa ? ' on' : ''}`} />)}
              </div>
              <div className="pc-termo-rot">
                {(['bem', 'levemente', 'descentralizada'] as FaixaPrevia[]).map(f => <span key={f} className={f === res.faixa ? 'on' : ''}>{ROTULO_FAIXA[f]}</span>)}
              </div>
              <p className="pc-fine">50/50 é o perfeito: a mesma borda dos dois lados. Quanto mais o primeiro número sobe, mais a impressão foi parar para um lado.</p>
            </div>

            <div className="pc-bloco pc-medido">
              <svg viewBox={`${-MARGEM} ${-MARGEM} ${CARTA_MM.w + 2 * MARGEM} ${CARTA_MM.h + 2 * MARGEM}`} role="img" aria-label="Carta com as bordas medidas">
                <image href={res.retUrl} x={-MARGEM} y={-MARGEM} width={CARTA_MM.w + 2 * MARGEM} height={CARTA_MM.h + 2 * MARGEM} preserveAspectRatio="none" />
                <rect x={0} y={0} width={CARTA_MM.w} height={CARTA_MM.h} fill="none" style={{ stroke: 'var(--bx-amber)' }} strokeWidth={1.6} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                <rect x={res.linhas.int.esq} y={res.linhas.int.topo} width={res.linhas.int.dir - res.linhas.int.esq} height={res.linhas.int.base - res.linhas.int.topo}
                  fill="none" style={{ stroke: 'var(--bx-blue)' }} strokeWidth={1.6} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="pc-leg">
                <span className="pc-k">O que foi medido</span>
                <span><i className="pc-dot pc-dot-ext" />Borda do papel</span>
                <span><i className="pc-dot pc-dot-int" />Borda da impressão</span>
                <button type="button" className="pc-link" onClick={() => { setEtapa('cantos') }}>As linhas não batem? Ajustar os 4 cantos</button>
              </div>
            </div>

            <div className="pc-outra">
              <button type="button" className="pc-bt" onClick={recomecar}>Medir outra carta</button>
              {usoTexto && <span className="pc-fine">{usoTexto}</span>}
            </div>

            {/* Pergunta de 1 toque: so avulso, com carta escolhida, e no maximo 3 por dia */}
            {origem === 'avulso' && carta?.image_small && previaId && sit?.perguntar && !respondeu && (
              <div className="pc-bloco pc-pergunta">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do catalogo */}
                <img src={carta.image_small} alt={nomeCarta(carta)} />
                <div>
                  <b>A imagem do catálogo é a da sua carta?</b>
                  <div className="pc-bts">
                    <button type="button" className="pc-bt" onClick={() => responderImagem(true)}>Sim</button>
                    <button type="button" className="pc-bt" onClick={() => responderImagem(false)}>Não</button>
                    <button type="button" className="pc-bt pc-bt-ghost" onClick={() => responderImagem(null)}>Pular</button>
                  </div>
                </div>
              </div>
            )}
            {respondeu && origem === 'avulso' && <p className="pc-fine pc-obrigado"><IconCheck size={14} /> Obrigado, isso ajuda a manter o catálogo certo.</p>}
          </div>

          <aside className="pc-res-b">
            <Trancado faixa={res.faixa} />
          </aside>
        </div>
      )}

      <input ref={inputCamera} type="file" accept="image/*" capture="environment" hidden onChange={ev => { processar(ev.target.files?.[0]); ev.target.value = '' }} />
      <input ref={inputGaleria} type="file" accept="image/*" hidden onChange={ev => { processar(ev.target.files?.[0]); ev.target.value = '' }} />
    </div>
  )
}

function CartaEscolhida({ c, mini }: { c: Carta; mini?: boolean }) {
  return (
    <div className={`pc-escolhida${mini ? ' mini' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do catalogo */}
      {c.image_small && <img src={c.image_small} alt="" />}
      <div>
        <b>{nomeCarta(c)}</b>
        <small>{[c.number && c.set_total ? `${c.number}/${c.set_total}` : c.number, c.set_name, c.idioma ? IDIOMA[c.idioma] || c.idioma.toUpperCase() : null].filter(Boolean).join(' · ')}</small>
      </div>
    </div>
  )
}

/** O resto do Pre-grading, trancado: a previa entrega so a frente. */
function Trancado({ faixa }: { faixa: FaixaPrevia }) {
  const itens = [
    'Onde cabe em cada graduadora (PSA, TAG, CGC, BGS) e quanto falta para subir',
    'O verso, que pode baixar a faixa',
    'Cantos, bordas e superfície',
    'Faixa de nota provável e graduadora recomendada',
    'Laudo com medidas em mm e fotos',
  ]
  return (
    <section className="pc-tranca" aria-label="Disponível no Pré-grading">
      <span className="pc-k pc-k-ac">No Pré-grading</span>
      <h3>O que esta prévia não mostra</h3>
      <p className="pc-muted">A centralização da frente é só o começo. A bancada da Bynx vê o resto e diz o que fazer com a carta.</p>
      <ul>
        {itens.map((t, i) => (
          <li key={t}>
            <span className="pc-cad" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <span className="pc-t">{t}</span>
            <span className={`pc-borrado pc-b${i}`} aria-hidden><i /><i /><i /></span>
          </li>
        ))}
      </ul>
      {PRECOS && <div className="pc-preco"><b>R$ {PRECOS.preGrading}</b><span>Orçamento grátis pelas fotos</span></div>}
      <Link className="pc-bt pc-bt-pri pc-bt-full" href="/pre-grading" onClick={() => track({ name: 'centralizacao_cta_pre_grading', properties: { faixa } })}>
        Ver no Pré-grading <IconArrowRight size={16} />
      </Link>
      <p className="pc-fine pc-c">Você só envia a carta depois de aprovar o preço.</p>
    </section>
  )
}

const CSS = `
.pc{max-width:1120px;display:grid;gap:12px;font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text)}
.pc > div:first-of-type{margin-bottom:12px!important}
.pc-estreito{max-width:640px}
.pc-muted{margin:0;font-size:13.5px;color:var(--bx-text-2);line-height:1.5}
.pc-fine{margin:0;font-size:12px;color:var(--bx-text-3);line-height:1.45}
.pc-c{text-align:center}
.pc-k{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.pc-k-ac{color:var(--ac-1)}
.pc-bloco{display:grid;gap:10px;padding:16px;border-radius:16px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.pc-centro{justify-items:center;text-align:center;padding:28px 16px}
.pc-bts{display:flex;flex-wrap:wrap;gap:8px}
.pc-bt{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;transition:background .15s ease,transform .15s ease}
.pc-bt:hover:not(:disabled){background:var(--bx-surface-3)}
.pc-bt:disabled{opacity:.5;cursor:not-allowed}
.pc-bt-pri{border:none;background:var(--bx-brand);color:var(--bx-brand-ink);font-weight:800}
.pc-bt-pri:hover:not(:disabled){background:var(--bx-brand);transform:translateY(-2px)}
.pc-bt-ghost{background:transparent}
.pc-bt-full{width:100%}
.pc-link{display:inline-flex;align-items:center;gap:4px;justify-self:start;min-height:44px;padding:0;border:0;background:none;color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-align:left}
.pc-link:hover{color:var(--bx-text)}
.pc-erro{margin:0;font-size:13px;color:var(--bx-red)}
.pc-gira{width:22px;height:22px;border-radius:999px;border:2px solid var(--bx-border-2);border-top-color:var(--ac-1);animation:pc-gira .8s linear infinite}
@keyframes pc-gira{to{transform:rotate(360deg)}}
.pc-busca{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
.pc-in{min-height:46px;padding:0 14px;border-radius:8px;border:1px solid var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text);font:inherit;font-size:18px;font-weight:700;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.pc-in:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.6)}
.pc-cands{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.pc-cand{min-width:0;border-radius:18px;transition:transform .15s ease}
.pc-cand:hover{transform:translateY(-2px)}
.pc-cand:focus-visible{outline:2px solid var(--ac-1);outline-offset:2px}
.pc-aviso{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:12px;font-size:13px;line-height:1.5;background:color-mix(in srgb,var(--bx-amber) 10%,transparent);border:1px solid color-mix(in srgb,var(--bx-amber) 35%,transparent)}
.pc-aviso > svg{flex:none;margin-top:2px;color:var(--bx-amber)}
.pc-aviso p{margin:0 0 6px}
.pc-escolhida{display:flex;gap:12px;align-items:center;padding-bottom:4px}
.pc-escolhida img{width:64px;aspect-ratio:63/88;object-fit:cover;border-radius:6px}
.pc-escolhida.mini img{width:44px}
.pc-escolhida b{display:block;font-size:15px}
.pc-escolhida small{font-size:12px;color:var(--bx-text-3)}
.pc-dicas{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:13px;color:var(--bx-text-2);line-height:1.45}
.pc-dicas li{display:grid;grid-template-columns:15px minmax(0,1fr);gap:8px;align-items:start}
.pc-dicas li > svg{margin-top:2px;color:var(--ac-1)}
.pc-dicas b{color:var(--bx-text)}
.pc-palco{border-radius:12px;overflow:hidden;border:1px solid var(--bx-border);background:var(--bx-bg-elev)}
.pc-svg{display:block;width:100%;height:auto;max-height:70vh;touch-action:none;user-select:none;-webkit-user-select:none}
.pc-alca{cursor:grab}
.pc-selo{justify-self:start;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;border:1px solid var(--bx-border-2);color:var(--bx-text-2)}
.pc-num{font-size:44px;font-weight:900;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
.pc-faixa{display:inline-flex;align-items:center;gap:8px;font-size:16px;font-weight:800}
.pc-faixa i{width:10px;height:10px;border-radius:999px}
.pc-f-bem i{background:var(--bx-green)} .pc-f-levemente i{background:var(--bx-amber)} .pc-f-descentralizada i{background:var(--bx-red)}
.pc-termo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;height:10px}
.pc-z{border-radius:3px;opacity:.28}
.pc-z-bem{background:var(--bx-green);border-radius:999px 3px 3px 999px} .pc-z-levemente{background:var(--bx-amber)} .pc-z-descentralizada{background:var(--bx-red);border-radius:3px 999px 999px 3px}
.pc-z.on{opacity:1}
.pc-termo-rot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;font-size:11.5px;line-height:1.3;color:var(--bx-text-3)}
.pc-termo-rot span:nth-child(2){text-align:center} .pc-termo-rot span:nth-child(3){text-align:right}
.pc-termo-rot .on{color:var(--bx-text);font-weight:800}
.pc-medido{grid-template-columns:minmax(0,1fr);justify-items:center;gap:14px}
.pc-medido svg{display:block;width:min(220px,100%);height:auto;border-radius:10px;background:var(--bx-bg-elev)}
.pc-medido .pc-leg{justify-self:stretch}
.pc-res{display:grid;gap:12px;align-items:start}
.pc-res-a{display:grid;gap:12px;min-width:0}
.pc-res-b{min-width:0}
.pc-outra{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
@media (min-width:640px){
  .pc-medido{grid-template-columns:240px minmax(0,1fr);justify-items:stretch;align-items:center}
  .pc-medido svg{width:100%}
}
@media (min-width:1024px){
  .pc-res{grid-template-columns:minmax(0,1fr) 380px;gap:20px}
  .pc-res-b{position:sticky;top:88px}
  .pc-medido{grid-template-columns:280px minmax(0,1fr)}
}
.pc-leg{display:grid;gap:8px;font-size:13px;color:var(--bx-text-2)}
.pc-dot{display:inline-block;width:9px;height:9px;border-radius:999px;margin-right:6px;vertical-align:1px}
.pc-dot-ext{background:var(--bx-amber)} .pc-dot-int{background:var(--bx-blue)}
.pc-pergunta{grid-template-columns:56px minmax(0,1fr);align-items:center}
.pc-pergunta img{width:56px;aspect-ratio:63/88;object-fit:cover;border-radius:6px}
.pc-pergunta b{display:block;margin-bottom:8px;font-size:14px}
.pc-obrigado{display:flex;align-items:center;gap:6px;color:var(--bx-green)}
.pc-tranca{display:grid;gap:10px;padding:16px;border-radius:18px;border:1px solid rgba(var(--ac-1-rgb),.32);background:var(--bx-hero-wash),var(--bx-surface)}
.pc-tranca h3{margin:0;font-size:19px;font-weight:900;letter-spacing:-.02em}
.pc-tranca ul{list-style:none;margin:4px 0 0;padding:0;display:grid;gap:8px}
.pc-tranca li{display:grid;grid-template-columns:20px minmax(0,1fr) 72px;gap:8px;align-items:center;padding:10px;border-radius:12px;border:1px solid var(--bx-border);background:var(--bx-surface)}
.pc-cad{color:var(--ac-1);display:flex}
.pc-t{font-size:13px;font-weight:700;line-height:1.35}
.pc-borrado{display:flex;align-items:flex-end;gap:4px;height:36px;padding:6px;border-radius:8px;background:var(--bx-bg-elev);filter:blur(2.5px);user-select:none;pointer-events:none}
.pc-borrado i{flex:1;border-radius:2px;background:rgba(var(--ac-1-rgb),.55)}
.pc-borrado i:nth-child(1){height:40%} .pc-borrado i:nth-child(2){height:70%} .pc-borrado i:nth-child(3){height:100%;background:var(--bx-surface-3)}
.pc-b1 i{background:var(--bx-blue)} .pc-b2 i{background:var(--bx-green)} .pc-b4 i{background:var(--bx-text-3)}
.pc-preco{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:4px}
.pc-preco b{font-size:24px;font-weight:900;letter-spacing:-.02em}
.pc-preco span{font-size:12.5px;color:var(--bx-text-2)}
.pc-limite{justify-items:center;text-align:center;padding:28px 16px}
.pc-limite > svg{color:var(--ac-1)}
.pc-relogio{font-size:40px;font-weight:900;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
@media (max-width:639px){
  .pc-bts-col{flex-direction:column}
  .pc-bts-col .pc-bt{width:100%}
  .pc-tranca li{grid-template-columns:20px minmax(0,1fr) 48px}
}
@media (prefers-reduced-motion:reduce){.pc *{animation:none!important;transition:none!important}}
`
