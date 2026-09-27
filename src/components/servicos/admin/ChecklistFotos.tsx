'use client'

// Checklist do protocolo fotografico: um espaco numerado por foto obrigatoria
// (frente, verso, cantos, bordas, angulo), na ordem da lista em lib/servicos.
//
// Fluxo rapido (27/09/2026): o operador fotografa tudo na ordem dos numeros e
// seleciona as fotos DE UMA VEZ (ou arrasta, no computador). Elas caem nos
// espacos vazios na ordem do protocolo e ficam em revisao: da para conferir e
// trocar duas de lugar antes de enviar, porque a ordem que o seletor do
// celular devolve e a unica coisa que pode sair errada. Depois do "Enviar",
// sobem em paralelo (3 por vez), comprimidas no navegador, e a pagina so
// recarrega UMA vez, no fim do lote.
//
// Alvo explicito (tocar num espaco, "Trocar", "Fotografar a proxima") envia
// na hora: ali nao ha ordem para conferir.
//
// Nao existe exclusao de midia no servidor. Trocar a foto de um espaco sobe
// outra com o mesmo tipo + posicao, e o checklist mostra a MAIS RECENTE
// (as midias chegam ordenadas por created_at).

import { Fragment, useEffect, useRef, useState, type DragEvent } from 'react'
import type { SlotFoto } from '@/lib/servicos'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { IconUpload, IconCheck, IconCamera, IconEdit, IconClose, IconWarning, IconImage } from '@/components/ui/Icons'

type MidiaSlot = { id: string; tipo: string; posicao: string | null; url: string | null }
type Estado = 'revisao' | 'fila' | 'preparando' | 'enviando' | 'ok' | 'erro'
type Local = { file: File; preview: string; estado: Estado; erro?: string }
type Lote = { total: number; feitos: number; falhas: number; ok: string[] }
type Progresso = Lote & { fim: boolean }

// 3 por vez: cada foto de 12 MP decodificada ocupa ~48 MB de memoria durante
// a compressao. Com 3 o Safari do iPhone aguenta, e o envio ja satura o 4G.
const CONCORRENCIA = 3
// Foto de documentacao da condicao: precisa mostrar canto e borda de perto.
// 2400 px no maior lado preserva o detalhe e deixa o arquivo em ~0,5 a 1 MB.
const COMPRESSAO = { maxLado: 2400, qualidade: 0.85 }

const chaveDe = (s: { tipo: string; posicao: string | null }) => `${s.tipo}:${s.posicao || ''}`
const OCUPADO: Estado[] = ['fila', 'preparando', 'enviando']

function curto(rotulo: string) {
  return rotulo
    .replace('superior', 'sup.').replace('inferior', 'inf.')
    .replace('esquerdo', 'esq.').replace('direito', 'dir.')
}

function grupo(s: SlotFoto) {
  if (s.tipo.endsWith('_difusa')) return 'Frente e verso'
  if (s.tipo.endsWith('_canto')) return s.posicao.startsWith('verso') ? 'Cantos do verso' : 'Cantos da frente'
  if (s.tipo.endsWith('_borda')) return 'Bordas'
  return 'Superfície'
}

const ROTULO_ESTADO: Partial<Record<Estado, string>> = {
  fila: 'Na fila', preparando: 'Preparando', enviando: 'Enviando', ok: 'Enviada',
}

export default function ChecklistFotos({ titulo, slots, midias, enviar, aoConcluir }: {
  titulo: string
  slots: SlotFoto[]
  midias: MidiaSlot[]
  /** Envia UMA foto para o slot. Lanca erro se falhar. Nao recarrega a pagina. */
  enviar: (slot: SlotFoto, f: File) => Promise<void>
  /** Chamado uma vez quando o lote termina (recarrega o pedido). */
  aoConcluir: () => Promise<void> | void
}) {
  const [locais, setLocais] = useState<Record<string, Local>>({})
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [aviso, setAviso] = useState('')
  const [arrastando, setArrastando] = useState(false)

  const locaisRef = useRef<Record<string, Local>>({})
  const filaRef = useRef<string[]>([])
  const ativosRef = useRef(0)
  const loteRef = useRef<Lote>({ total: 0, feitos: 0, falhas: 0, ok: [] })

  // A mais recente de cada slot (a lista vem por created_at crescente).
  const doServidor = new Map<string, MidiaSlot>()
  for (const m of midias) if (m.url) doServidor.set(chaveDe(m), m)

  const feitas = slots.filter(s => doServidor.has(chaveDe(s))).length
  const completo = feitas === slots.length
  const livres = slots.filter(s => !doServidor.has(chaveDe(s)) && !locais[chaveDe(s)])
  const proximo = livres[0]
  const emRevisao = slots.filter(s => locais[chaveDe(s)]?.estado === 'revisao')
  const rodando = !!progresso && !progresso.fim

  function mudar(fn: (p: Record<string, Local>) => Record<string, Local>) {
    locaisRef.current = fn(locaisRef.current)
    setLocais(locaisRef.current)
  }
  function remover(chaves: string[]) {
    mudar(p => {
      const n = { ...p }
      for (const k of chaves) { if (n[k]) URL.revokeObjectURL(n[k].preview); delete n[k] }
      return n
    })
  }
  function marcar(k: string, file: File, estado: Estado, erro?: string) {
    mudar(p => (p[k]?.file === file ? { ...p, [k]: { ...p[k], estado, erro } } : p))
  }

  // Sair da pagina no meio do lote perde as fotos que nao subiram.
  useEffect(() => {
    if (!rodando) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [rodando])

  useEffect(() => () => {
    for (const l of Object.values(locaisRef.current)) URL.revokeObjectURL(l.preview)
  }, [])

  // ---- fila com concorrencia limitada ----
  async function processar(slot: SlotFoto, k: string, file: File) {
    marcar(k, file, 'preparando')
    try {
      const leve = await comprimirImagem(file, COMPRESSAO)
      marcar(k, file, 'enviando')
      await enviar(slot, leve)
      marcar(k, file, 'ok')
      loteRef.current.feitos++
      loteRef.current.ok.push(k)
    } catch (e) {
      const t = e instanceof Error && e.message ? e.message : 'Não deu certo.'
      marcar(k, file, 'erro', t === 'Failed to fetch' || t === 'Load failed' ? 'Sem conexão com o servidor.' : t)
      loteRef.current.falhas++
    }
    setProgresso({ ...loteRef.current, fim: false })
  }

  function bombear() {
    while (ativosRef.current < CONCORRENCIA && filaRef.current.length) {
      const k = filaRef.current.shift() as string
      const slot = slots.find(s => chaveDe(s) === k)
      const loc = locaisRef.current[k]
      if (!slot || !loc) continue
      ativosRef.current++
      void processar(slot, k, loc.file).finally(() => {
        ativosRef.current--
        if (!filaRef.current.length && !ativosRef.current) void concluir()
        else bombear()
      })
    }
  }

  async function concluir() {
    const lote = loteRef.current
    loteRef.current = { total: 0, feitos: 0, falhas: 0, ok: [] }
    if (lote.feitos > 0) await aoConcluir()
    // So agora tira as locais enviadas: a versao do servidor ja chegou.
    remover(lote.ok.filter(k => locaisRef.current[k]?.estado === 'ok'))
    if (!filaRef.current.length && !ativosRef.current) setProgresso({ ...lote, fim: true })
  }

  function enfileirar(chaves: string[]) {
    if (!chaves.length) return
    if (!ativosRef.current && !filaRef.current.length) loteRef.current = { total: 0, feitos: 0, falhas: 0, ok: [] }
    mudar(p => {
      const n = { ...p }
      for (const k of chaves) if (n[k]) n[k] = { ...n[k], estado: 'fila', erro: undefined }
      return n
    })
    filaRef.current.push(...chaves)
    loteRef.current.total += chaves.length
    setProgresso({ ...loteRef.current, fim: false })
    bombear()
  }

  // ---- entradas ----
  const soImagens = (lista: FileList | File[] | null | undefined) => Array.from(lista || []).filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))

  /** Varias fotos: caem nos espacos vazios, na ordem do protocolo, e ficam em revisao. */
  function distribuir(lista: FileList | File[] | null | undefined) {
    const fotos = soImagens(lista)
    setAviso('')
    if (!fotos.length) return
    if (!livres.length) { setAviso('Todos os espaços já têm foto. Para trocar uma, use o botão de trocar na própria foto.'); return }
    const usadas = fotos.slice(0, livres.length)
    mudar(p => {
      const n = { ...p }
      usadas.forEach((f, i) => { n[chaveDe(livres[i])] = { file: f, preview: URL.createObjectURL(f), estado: 'revisao' } })
      return n
    })
    const sobra = fotos.length - usadas.length
    if (sobra > 0) setAviso(`${sobra} ${sobra === 1 ? 'foto ficou' : 'fotos ficaram'} de fora: só havia ${livres.length} ${livres.length === 1 ? 'espaço vazio' : 'espaços vazios'}.`)
  }

  /** Uma foto com destino certo: envia na hora. */
  function enviarNoSlot(s: SlotFoto, f: File) {
    const k = chaveDe(s)
    setAviso('')
    mudar(p => {
      if (p[k]) URL.revokeObjectURL(p[k].preview)
      return { ...p, [k]: { file: f, preview: URL.createObjectURL(f), estado: 'fila' } }
    })
    enfileirar([k])
  }

  function tocarRevisao(k: string) {
    if (!selecionado) { setSelecionado(k); return }
    if (selecionado === k) { setSelecionado(null); return }
    const a = selecionado
    mudar(p => {
      const n = { ...p }
      const pa = p[a], pb = p[k]
      if (pb) n[a] = pb; else delete n[a]
      if (pa) n[k] = pa
      return n
    })
    setSelecionado(null)
  }

  function enviarRevisao() {
    setSelecionado(null)
    enfileirar(emRevisao.map(chaveDe))
  }

  // ---- arrastar e soltar (computador) ----
  const temArquivo = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  function sobre(e: DragEvent) {
    if (!temArquivo(e)) return
    e.preventDefault()
    if (!arrastando) setArrastando(true)
  }
  function saiu(e: DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastando(false)
  }
  function soltou(e: DragEvent) {
    if (!temArquivo(e)) return
    e.preventDefault()
    setArrastando(false)
    distribuir(e.dataTransfer.files)
  }
  function soltouNoSlot(e: DragEvent, s: SlotFoto) {
    if (!temArquivo(e)) return
    const fotos = soImagens(e.dataTransfer.files)
    if (fotos.length !== 1) return // varias: deixa o container distribuir
    e.preventDefault(); e.stopPropagation()
    setArrastando(false)
    enviarNoSlot(s, fotos[0])
  }

  return (
    <div className={`cf${arrastando ? ' cf-arrastando' : ''}`} onDragEnter={sobre} onDragOver={sobre} onDragLeave={saiu} onDrop={soltou}>
      <div className="cf-topo">
        <b>{titulo}</b>
        <span className={completo ? 'cf-ok' : ''}>{completo ? <><IconCheck size={12} /> completo</> : `${feitas} de ${slots.length}`}</span>
      </div>

      {!completo && !emRevisao.length && (
        <div className="cf-barra">
          <label className="cf-bt cf-bt-pri">
            <input type="file" accept="image/*" multiple onChange={e => { distribuir(e.target.files); e.target.value = '' }} />
            <IconImage size={16} /> Selecionar fotos
          </label>
          {proximo && (
            <label className="cf-bt cf-camera">
              <input type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) enviarNoSlot(proximo, f); e.target.value = '' }} />
              <IconCamera size={16} /> Fotografar nº {slots.indexOf(proximo) + 1}
            </label>
          )}
          <p className="cf-dica">
            Fotografe na ordem dos números e selecione todas de uma vez. Elas ocupam os espaços vazios nessa ordem.
            <span className="cf-so-desk"> Também dá para arrastar as fotos para cá.</span>
          </p>
        </div>
      )}

      {emRevisao.length > 0 && (
        <div className="cf-revisao" role="region" aria-label="Revisão antes do envio">
          <p>
            <b>Confira a ordem antes de enviar.</b>{' '}
            {selecionado ? 'Agora toque na foto ou no espaço de destino.' : 'Para trocar duas fotos de lugar, toque em uma e depois na outra.'}
          </p>
          <div className="cf-acoes">
            <button type="button" className="cf-bt cf-bt-pri" onClick={enviarRevisao}>
              <IconUpload size={16} /> Enviar {emRevisao.length} {emRevisao.length === 1 ? 'foto' : 'fotos'}
            </button>
            <button type="button" className="cf-bt" onClick={() => { setSelecionado(null); remover(emRevisao.map(chaveDe)) }}>Descartar</button>
          </div>
        </div>
      )}

      {progresso && (
        <div className="cf-prog" role="status" aria-live="polite">
          <div className="cf-prog-txt">
            {progresso.fim
              ? progresso.falhas
                ? <span className="cf-txt-erro"><IconWarning size={13} /> {progresso.feitos} de {progresso.total} enviadas. {progresso.falhas === 1 ? '1 falhou' : `${progresso.falhas} falharam`}: toque em Tentar de novo na foto.</span>
                : <span className="cf-txt-ok"><IconCheck size={13} /> {progresso.total === 1 ? 'Foto enviada.' : `${progresso.total} fotos enviadas.`}</span>
              : <>Enviadas {progresso.feitos} de {progresso.total}{progresso.falhas > 0 && <span className="cf-txt-erro"> · {progresso.falhas} com falha</span>}</>}
          </div>
          {!progresso.fim && <div className="cf-prog-trilho"><i style={{ width: `${Math.round(((progresso.feitos + progresso.falhas) / Math.max(1, progresso.total)) * 100)}%` }} /></div>}
        </div>
      )}

      {aviso && <p className="cf-aviso">{aviso}</p>}

      <div className="cf-grade">
        {slots.map((s, i) => {
          const k = chaveDe(s)
          const srv = doServidor.get(k)
          const loc = locais[k]
          const ocupado = !!loc && OCUPADO.includes(loc.estado)
          const g = grupo(s)
          const cabecalho = i === 0 || grupo(slots[i - 1]) !== g ? g : ''
          const alvoTroca = !!selecionado && selecionado !== k && !srv && (!loc || loc.estado === 'revisao')
          const cls = ['cf-slot',
            loc ? `cf-s-${loc.estado}` : srv ? 'cf-s-servidor' : 'cf-s-vazio',
            selecionado === k ? 'cf-s-sel' : '', alvoTroca ? 'cf-s-alvo' : ''].filter(Boolean).join(' ')
          const legenda = <span className="cf-leg"><b>{i + 1}</b> {curto(s.rotulo)}</span>
          const img = loc?.preview || srv?.url

          let foto
          if (loc?.estado === 'revisao' || (alvoTroca && !loc)) {
            foto = (
              <button type="button" className="cf-foto" onClick={() => tocarRevisao(k)} aria-pressed={selecionado === k} aria-label={`${i + 1} ${s.rotulo}${loc ? '' : ' (vazio)'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {loc && <img src={loc.preview} alt="" />}
                {!loc && <span className="cf-num">{i + 1}</span>}
              </button>
            )
          } else if (!loc && srv?.url) {
            foto = (
              <a className="cf-foto" href={srv.url} target="_blank" rel="noopener" aria-label={`Ver ${s.rotulo}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={srv.url} alt="" loading="lazy" />
              </a>
            )
          } else if (!loc) {
            foto = (
              <label className="cf-foto">
                <input type="file" accept="image/*" aria-label={`Enviar ${s.rotulo}`} onChange={e => { const f = e.target.files?.[0]; if (f) enviarNoSlot(s, f); e.target.value = '' }} />
                <span className="cf-num">{i + 1}</span>
                <IconUpload size={15} />
              </label>
            )
          } else {
            foto = (
              <div className="cf-foto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img && <img src={img} alt="" />}
                {loc.estado === 'erro' ? (
                  <span className="cf-veu cf-veu-erro" title={loc.erro}>
                    <IconWarning size={14} />
                    <button type="button" className="cf-retry" onClick={() => enfileirar([k])}>Tentar de novo</button>
                  </span>
                ) : (
                  <span className={`cf-veu${loc.estado === 'ok' ? ' cf-veu-ok' : ''}`}>
                    {loc.estado === 'ok' ? <IconCheck size={14} /> : <i className="cf-pulso" />}
                    {ROTULO_ESTADO[loc.estado]}
                  </span>
                )}
              </div>
            )
          }

          return (
            <Fragment key={k}>
              {cabecalho && <span className="cf-grupo">{cabecalho}</span>}
              <div className={cls} onDragOver={e => { if (!ocupado) sobre(e) }} onDrop={e => { if (!ocupado && loc?.estado !== 'revisao') soltouNoSlot(e, s) }}>
                {foto}
                {/* Trocar: so em foto ja enviada e parada. Sobe outra no mesmo slot. */}
                {!loc && srv?.url && !selecionado && (
                  <label className="cf-canto" title="Trocar esta foto">
                    <input type="file" accept="image/*" aria-label={`Trocar ${s.rotulo}`} onChange={e => { const f = e.target.files?.[0]; if (f) enviarNoSlot(s, f); e.target.value = '' }} />
                    <span><IconEdit size={14} /></span>
                  </label>
                )}
                {(loc?.estado === 'revisao' || loc?.estado === 'erro') && (
                  <button type="button" className="cf-canto" aria-label={`Tirar a foto de ${s.rotulo}`} onClick={() => { if (selecionado === k) setSelecionado(null); remover([k]) }}>
                    <span><IconClose size={14} /></span>
                  </button>
                )}
                {legenda}
              </div>
            </Fragment>
          )
        })}
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.cf{display:grid;gap:10px;border-radius:12px;outline:2px dashed transparent;outline-offset:4px;transition:outline-color .15s ease}
.cf-arrastando{outline-color:rgba(var(--ac-1-rgb),.7)}
.cf-topo{display:flex;justify-content:space-between;align-items:center;font-size:13.5px}
.cf-topo span{font-size:11.5px;font-weight:700;color:var(--bx-red);display:inline-flex;align-items:center;gap:4px}
.cf-topo span.cf-ok{color:var(--bx-green)}

.cf-barra{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.cf-bt{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 16px;border-radius:9px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;overflow:hidden;transition:opacity .15s ease,border-color .15s ease}
.cf-bt:hover{border-color:rgba(var(--ac-1-rgb),.6)}
.cf-bt-pri{background:var(--ac-grad);color:var(--bx-brand-ink);border-color:transparent}
.cf-bt input,.cf-foto input,.cf-canto input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.cf-camera{display:none}
.cf-dica{flex-basis:100%;margin:0;font-size:12px;line-height:1.45;color:var(--bx-text-3)}
@media (hover:none) and (pointer:coarse){
  .cf-camera{display:inline-flex}
  .cf-so-desk{display:none}
}

.cf-revisao{display:grid;gap:10px;padding:12px;border-radius:10px;border:1px solid rgba(var(--ac-1-rgb),.4);background:rgba(var(--ac-1-rgb),.07)}
.cf-revisao p{margin:0;font-size:13px;line-height:1.45;color:var(--bx-text-2)}
.cf-revisao b{color:var(--bx-text)}
.cf-acoes{display:flex;flex-wrap:wrap;gap:8px}

.cf-prog{display:grid;gap:6px;font-size:12.5px;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.cf-prog-txt span{display:inline-flex;align-items:center;gap:4px}
.cf-txt-ok{color:var(--bx-green)}
.cf-txt-erro{color:var(--bx-red)}
.cf-prog-trilho{height:4px;border-radius:999px;background:var(--bx-surface-3);overflow:hidden}
.cf-prog-trilho i{display:block;height:100%;background:var(--ac-grad);transition:width .2s ease}
.cf-aviso{margin:0;font-size:12.5px;color:var(--bx-amber)}

.cf-grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px 8px}
.cf-grupo{grid-column:1/-1;margin-top:4px;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-3)}
.cf-slot{position:relative;display:grid;gap:4px;align-content:start;min-width:0}
.cf-foto{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;aspect-ratio:5/7;padding:0;border-radius:9px;border:1.5px dashed var(--bx-border-2);background:var(--bx-bg);color:var(--bx-text-3);font:inherit;cursor:pointer;overflow:hidden;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease}
.cf-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cf-s-vazio .cf-foto:hover{border-color:rgba(var(--ac-1-rgb),.6);color:var(--bx-text-2)}
.cf-num{font-size:22px;font-weight:800;line-height:1;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.cf-s-servidor .cf-foto,.cf-s-ok .cf-foto{border-style:solid;border-color:color-mix(in srgb,var(--bx-green) 45%,transparent)}
.cf-s-revisao .cf-foto{border-style:solid;border-color:rgba(var(--ac-1-rgb),.55)}
.cf-s-fila .cf-foto,.cf-s-preparando .cf-foto,.cf-s-enviando .cf-foto{border-style:solid;border-color:var(--bx-border-2);cursor:progress}
.cf-s-erro .cf-foto{border-style:solid;border-color:var(--bx-red);cursor:default}
.cf-s-sel .cf-foto{border-color:var(--ac-1);box-shadow:0 0 0 3px rgba(var(--ac-1-rgb),.35)}
.cf-s-alvo .cf-foto{border-color:rgba(var(--ac-1-rgb),.8);border-style:dashed}

.cf-veu{position:absolute;inset:auto 0 0 0;display:flex;align-items:center;justify-content:center;gap:5px;min-height:28px;padding:4px;background:color-mix(in srgb,var(--bx-bg) 82%,transparent);color:var(--bx-text);font-size:11px;font-weight:700}
.cf-veu-ok{color:var(--bx-green)}
.cf-veu-erro{inset:0;flex-direction:column;background:color-mix(in srgb,var(--bx-bg) 78%,transparent);color:var(--bx-red)}
.cf-retry{min-height:44px;padding:0 10px;border-radius:8px;border:1px solid color-mix(in srgb,var(--bx-red) 50%,transparent);background:var(--bx-surface);color:var(--bx-text);font:inherit;font-size:11.5px;font-weight:700;cursor:pointer}
.cf-pulso{width:8px;height:8px;border-radius:50%;background:var(--ac-1);animation:cf-pulso 1s ease-in-out infinite alternate}
@keyframes cf-pulso{from{opacity:.25}to{opacity:1}}

.cf-canto{position:absolute;top:0;right:0;width:44px;height:44px;display:flex;align-items:flex-start;justify-content:flex-end;padding:5px;border:0;background:none;cursor:pointer;color:var(--bx-text)}
.cf-canto span{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:color-mix(in srgb,var(--bx-bg) 80%,transparent);border:1px solid var(--bx-border-2);transition:border-color .15s ease}
.cf-canto:hover span{border-color:rgba(var(--ac-1-rgb),.7)}

.cf-leg{font-size:11px;line-height:1.3;color:var(--bx-text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cf-leg b{color:var(--bx-text);font-variant-numeric:tabular-nums;margin-right:2px}

@media (prefers-reduced-motion:reduce){
  .cf,.cf-bt,.cf-foto,.cf-canto span,.cf-prog-trilho i{transition:none}
  .cf-pulso{animation:none;opacity:1}
}
`
