'use client'

// Formulario de evento da Agenda (wireframe de 08/11/2026, quadros AD2 e O3).
// Serve ao organizador (dentro do Club, com a conta dele) e ao /admin (chave de
// servico): quem usa passa onSalvar e subirImagem, e o formulario nao sabe o
// caminho. Todas as regras de verdade ficam no banco; aqui so o atalho visual.

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { MESES_CURTOS } from '@/lib/pcc/datas'
import { ORDEM_TIPOS, TIPOS, linhaMeta, parseDia, type Evento, type TipoEvento } from '@/lib/pcc/agenda'
import { Ico } from '../../amigo-secreto/estilo'
import { BlocoData } from '../../_comum/calendario'
import { TipoQuad } from '../comum'

export type DadosEvento = {
  tipo: TipoEvento | ''; titulo: string; descricao: string; formato: 'online' | 'presencial'
  local_nome: string; cidade: string; uf: string; link_url: string; participantes: string[]
  imagem_path: string | null; inicio_data: string; fim_data: string; hora_inicio: string; hora_fim: string
}
export type AcaoSalvar = 'rascunho' | 'publicar' | 'salvar'

export const vazio = (): DadosEvento => ({
  tipo: '', titulo: '', descricao: '', formato: 'online', local_nome: '', cidade: '', uf: '', link_url: '',
  participantes: [], imagem_path: null, inicio_data: '', fim_data: '', hora_inicio: '', hora_fim: '',
})

export const deEvento = (e: Evento): DadosEvento => ({
  tipo: e.tipo, titulo: e.titulo, descricao: e.descricao || '', formato: e.formato, local_nome: e.local_nome || '',
  cidade: e.cidade || '', uf: e.uf || '', link_url: e.link_url || '', participantes: e.participantes,
  imagem_path: e.imagem_path, inicio_data: e.inicio_data, fim_data: e.fim_data === e.inicio_data ? '' : e.fim_data,
  hora_inicio: e.hora_inicio || '', hora_fim: e.hora_fim || '',
})

/** Duplicar: tudo menos datas, imagem e estado. */
export const duplicar = (e: Evento): DadosEvento => ({ ...deEvento(e), inicio_data: '', fim_data: '', imagem_path: null })

export function FormEvento({ titulo, inicial, estado, urlImagem, onSalvar, subirImagem, onVoltar }: {
  titulo: string
  inicial: DadosEvento
  estado: Evento['status'] | null
  urlImagem: (path: string) => string
  onSalvar: (d: DadosEvento, acao: AcaoSalvar) => Promise<string | null>
  subirImagem: (arquivo: File) => Promise<string | null>
  onVoltar: () => void
}) {
  const [d, setD] = useState<DadosEvento>(inicial)
  const [diaInteiro, setDiaInteiro] = useState(!inicial.hora_inicio && !!inicial.inicio_data)
  const [variosDias, setVariosDias] = useState(!!inicial.fim_data)
  const [partTexto, setPartTexto] = useState(inicial.participantes.map(p => `@${p}`).join(', '))
  const [ocupado, setOcupado] = useState<AcaoSalvar | 'imagem' | null>(null)
  const [erro, setErro] = useState('')
  const entrada = useRef<HTMLInputElement | null>(null)
  const topo = useRef<HTMLDivElement | null>(null)
  const novo = estado === null

  useEffect(() => { topo.current?.scrollIntoView({ block: 'start' }) }, [])

  const set = <K extends keyof DadosEvento>(k: K, v: DadosEvento[K]) => setD(x => ({ ...x, [k]: v }))
  const escolherTipo = (t: TipoEvento) => setD(x => ({ ...x, tipo: t, formato: t === 'presencial' ? 'presencial' : x.formato }))

  function montar(): DadosEvento {
    const parts = partTexto.split(/[,\s]+/).map(p => p.replace(/^@/, '').trim().toLowerCase()).filter(Boolean)
    return {
      ...d,
      participantes: Array.from(new Set(parts)),
      fim_data: variosDias ? d.fim_data : '',
      hora_inicio: diaInteiro ? '' : d.hora_inicio,
      hora_fim: diaInteiro ? '' : d.hora_fim,
    }
  }

  async function salvar(acao: AcaoSalvar) {
    setErro('')
    if (!d.tipo) { setErro('Escolha o tipo.'); return }
    if (d.titulo.trim().length < 3) { setErro('Dê um título ao evento, de 3 a 60 caracteres.'); return }
    if (!d.inicio_data) { setErro('Coloque a data.'); return }
    if (d.formato === 'presencial' && !d.cidade.trim()) { setErro('Evento presencial precisa de cidade.'); return }
    setOcupado(acao)
    const msg = await onSalvar(montar(), acao)
    setOcupado(null)
    if (msg) setErro(msg)
  }

  async function aoEscolher(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    setErro('')
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)) { setErro('Escolha uma imagem em JPG, PNG ou WebP.'); return }
    setOcupado('imagem')
    const comprimida = await comprimirImagem(f, { maxLado: 1280 })
    const path = await subirImagem(comprimida)
    setOcupado(null)
    if (!path) { setErro('Não conseguimos subir a imagem. Tente outra.'); return }
    set('imagem_path', path)
  }

  const previa = montar()
  const temPrevia = !!previa.tipo && previa.titulo.trim().length >= 3 && !!previa.inicio_data
  const iniPrevia = temPrevia ? parseDia(previa.inicio_data) : null

  return (
    <div ref={topo} className="fe">
      <div className="ag-topo">
        <h1 className="as-h2">{titulo}</h1>
        <button type="button" className="as-btn sm" onClick={onVoltar}>Voltar</button>
      </div>
      {estado && estado !== 'publicado' && <div className="as-note">{estado === 'rascunho' ? 'Rascunho: só a organização vê.' : estado === 'adiado' ? 'Adiado. Coloque a nova data e toque em Publicar.' : 'Cancelado.'}</div>}

      <div className="fe-grade">
        <div className="fe-col">
          <div className="as-f">
            <span className="as-lb">Tipo</span>
            <div className="fe-tipos" role="radiogroup" aria-label="Tipo">
              {ORDEM_TIPOS.map(t => (
                <button key={t} type="button" role="radio" aria-checked={d.tipo === t} className={`fe-tipo${d.tipo === t ? ' on' : ''}`} onClick={() => escolherTipo(t)}>
                  <Ico n={TIPOS[t].ico} s={16} />{TIPOS[t].rotulo}
                </button>
              ))}
            </div>
          </div>

          <label className="as-f">
            <span className="as-lb">Título</span>
            <input className="as-in" value={d.titulo} maxLength={60} onChange={e => set('titulo', e.target.value)} />
            <span className="as-hint">Como o grupo vai chamar. {d.titulo.length}/60.</span>
          </label>

          <div className="as-two fe-datas">
            <label className="as-f"><span className="as-lb">{variosDias ? 'Começa' : 'Data'}</span>
              <input type="date" className="as-in" value={d.inicio_data} onChange={e => set('inicio_data', e.target.value)} /></label>
            {!diaInteiro && <label className="as-f"><span className="as-lb">Horário</span>
              <input type="time" className="as-in" value={d.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} /></label>}
          </div>
          {(variosDias || !diaInteiro) && (
            <div className="as-two fe-datas">
              {variosDias && <label className="as-f"><span className="as-lb">Termina</span>
                <input type="date" className="as-in" value={d.fim_data} min={d.inicio_data || undefined} onChange={e => set('fim_data', e.target.value)} /></label>}
              {!diaInteiro && <label className="as-f"><span className="as-lb">Até (opcional)</span>
                <input type="time" className="as-in" value={d.hora_fim} onChange={e => set('hora_fim', e.target.value)} /></label>}
            </div>
          )}
          <span className="as-hint" style={{ marginTop: -4 }}>
            Horário de Brasília.{!diaInteiro && d.hora_inicio && d.hora_fim && d.hora_fim < d.hora_inicio ? ' Termina no dia seguinte.' : !diaInteiro ? ' Se passar da meia-noite, coloque o horário do dia seguinte.' : ''}
          </span>
          <label className="as-chk"><input type="checkbox" checked={diaInteiro} onChange={e => setDiaInteiro(e.target.checked)} /><span>Dia inteiro, sem horário</span></label>
          <label className="as-chk"><input type="checkbox" checked={variosDias} onChange={e => setVariosDias(e.target.checked)} /><span>Mais de um dia</span></label>

          <div className="as-f">
            <span className="as-lb">Formato</span>
            <div className="pc-abas fe-formato" role="radiogroup" aria-label="Formato">
              <button type="button" role="radio" aria-checked={d.formato === 'online'} className={d.formato === 'online' ? 'on' : ''} onClick={() => set('formato', 'online')}>Online</button>
              <button type="button" role="radio" aria-checked={d.formato === 'presencial'} className={d.formato === 'presencial' ? 'on' : ''} onClick={() => set('formato', 'presencial')}>Presencial</button>
            </div>
          </div>
          {d.formato === 'presencial' && (
            <>
              <label className="as-f"><span className="as-lb">Local</span>
                <input className="as-in" value={d.local_nome} maxLength={80} placeholder="Expo Center Norte" onChange={e => set('local_nome', e.target.value)} /></label>
              <div className="as-two">
                <label className="as-f" style={{ flex: 3 }}><span className="as-lb">Cidade</span>
                  <input className="as-in" value={d.cidade} maxLength={60} onChange={e => set('cidade', e.target.value)} /></label>
                <label className="as-f" style={{ flex: 1 }}><span className="as-lb">UF</span>
                  <input className="as-in" value={d.uf} maxLength={2} autoCapitalize="characters" onChange={e => set('uf', e.target.value.toUpperCase())} /></label>
              </div>
              <span className="as-hint" style={{ marginTop: -4 }}>Aparece com o botão Ver no mapa.</span>
            </>
          )}

          <label className="as-f"><span className="as-lb">Link (opcional)</span>
            <input className="as-in" type="url" inputMode="url" value={d.link_url} placeholder="https://" onChange={e => set('link_url', e.target.value.trim())} />
            <span className="as-hint">Live, inscrição ou página do evento. Começa com https://</span></label>

          <label className="as-f"><span className="as-lb">Quem do Club participa (opcional)</span>
            <input className="as-in" value={partTexto} autoCapitalize="none" autoCorrect="off" placeholder="@bynx.gg, @helotcg" onChange={e => setPartTexto(e.target.value)} />
            <span className="as-hint">@ separados por vírgula. Até 20.</span></label>

          <label className="as-f"><span className="as-lb">Descrição (opcional)</span>
            <textarea className="as-in fe-ta" value={d.descricao} maxLength={600} onChange={e => set('descricao', e.target.value)} />
            <span className="as-hint">O essencial cabe em três linhas. {d.descricao.length}/600.</span></label>

          <div className="as-f">
            <span className="as-lb">Imagem (opcional)</span>
            {d.imagem_path && <div className="fe-img"><Image src={urlImagem(d.imagem_path)} alt="" fill sizes="480px" /></div>}
            <div className="fe-img-acoes">
              <button type="button" className="as-btn sm" disabled={ocupado !== null} onClick={() => entrada.current?.click()}>{ocupado === 'imagem' ? 'Subindo...' : d.imagem_path ? 'Trocar imagem' : 'Subir imagem'}</button>
              {d.imagem_path && <button type="button" className="as-btn lnk sm" onClick={() => set('imagem_path', null)}>Tirar imagem</button>}
            </div>
            <input ref={entrada} type="file" accept="image/*" hidden onChange={aoEscolher} />
          </div>
        </div>

        <div className="fe-lado">
          <div className="fe-previa">
            <div className="as-k">Prévia para o membro</div>
            {temPrevia && iniPrevia ? (
              <div className="pc-linha ag-linha">
                <BlocoData dia={String(iniPrevia.dia).padStart(2, '0')} mes={MESES_CURTOS[iniPrevia.mes - 1]} />
                <TipoQuad e={{ tipo: previa.tipo as TipoEvento, status: 'publicado' }} />
                <span className="pc-nm"><b>{previa.titulo}</b><small>{linhaMeta({ ...previa, tipo: previa.tipo as TipoEvento, status: 'publicado', id: '', slug: '', remarcado_em: null, nota_status: null, descricao: previa.descricao || null, local_nome: previa.local_nome || null, cidade: previa.cidade || null, uf: previa.uf || null, link_url: previa.link_url || null, fim_data: previa.fim_data || previa.inicio_data, hora_inicio: previa.hora_inicio || null, hora_fim: previa.hora_fim || null })}</small></span>
              </div>
            ) : <span className="as-meta">Escolha o tipo, o título e a data para ver.</span>}
          </div>
          {erro && <div className="as-erro" role="alert">{erro}</div>}
          {(novo || estado === 'rascunho') ? (
            <>
              <button type="button" className="as-btn pri" disabled={ocupado !== null} onClick={() => salvar('publicar')}>{ocupado === 'publicar' ? 'Publicando...' : 'Publicar'}</button>
              <button type="button" className="as-btn" disabled={ocupado !== null} onClick={() => salvar('rascunho')}>{ocupado === 'rascunho' ? 'Salvando...' : 'Salvar rascunho'}</button>
            </>
          ) : estado === 'adiado' ? (
            <button type="button" className="as-btn pri" disabled={ocupado !== null} onClick={() => salvar('publicar')}>{ocupado === 'publicar' ? 'Publicando...' : 'Publicar com a nova data'}</button>
          ) : (
            <button type="button" className="as-btn pri" disabled={ocupado !== null} onClick={() => salvar('salvar')}>{ocupado === 'salvar' ? 'Salvando...' : 'Salvar alterações'}</button>
          )}
        </div>
      </div>
      <style>{FE_CSS}</style>
    </div>
  )
}

const FE_CSS = `
.fe{display:flex;flex-direction:column;gap:14px;scroll-margin-top:72px}
.fe-grade{display:flex;flex-direction:column;gap:14px;min-width:0}
.fe-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.fe-tipos{display:flex;flex-wrap:wrap;gap:6px}
.fe-tipo{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text-2);font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:border-color .15s ease,color .15s ease}
.fe-tipo.on{border-color:var(--ac-1);color:var(--ac-1);background:rgba(var(--ac-1-rgb),.08)}
.fe-datas .as-in{min-width:0}
.pc-abas.fe-formato{display:grid}
.fe-ta{min-height:96px;resize:vertical}
.fe-img{position:relative;width:100%;max-width:480px;aspect-ratio:16/9;border-radius:12px;overflow:hidden;border:1px solid var(--bx-border);margin-bottom:8px}
.fe-img img{object-fit:cover}
.fe-img-acoes{display:flex;gap:8px;align-items:center}
.fe-img-acoes .as-btn{width:auto}
.fe-lado{display:flex;flex-direction:column;gap:8px}
.fe-previa{display:flex;flex-direction:column;gap:6px;padding:12px;border:1px dashed var(--bx-border-2);border-radius:12px}
.fe-previa .ag-linha{border-bottom:0;cursor:default}
.fe-previa .ag-linha:hover{background:transparent}
@media (min-width:1024px){
  .fe-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:32px;align-items:start}
  .fe-lado{position:sticky;top:88px}
}
`
