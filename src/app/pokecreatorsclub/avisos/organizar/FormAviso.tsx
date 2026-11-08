'use client'

// Formulario de aviso (wireframe de 08/11/2026, quadros O6 e O7). Serve ao
// organizador (conta dele) e ao /admin (chave de servico): quem usa passa
// onSalvar e subirImagem. As regras de verdade ficam no banco.

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { comprimirImagem } from '@/lib/comprimirImagem'
import { CATEGORIAS, ORDEM_CATEGORIAS, palavraCapa, semEmoji, type Aviso, type AvisoOrg, type CategoriaAviso } from '@/lib/pcc/avisos'
import { MESES } from '@/lib/pcc/datas'
import { Ico } from '../../amigo-secreto/estilo'
import { AV_CSS } from '../comum'
import { CapaAviso } from '../capa'

export type EventoOpcao = { id: string; titulo: string; inicio_data: string }
export type DadosAviso = {
  titulo: string; corpo: string; importante: string; imagens: string[]
  links: { rotulo: string; url: string }[]; prazoData: string; prazoHora: string; fixado: boolean; evento_id: string
  categoria: CategoriaAviso; agenda_mes: string
  temEnquete: boolean; pergunta: string; regra: string; multipla: boolean; opcoes: string[]
}
export type AcaoAviso = 'rascunho' | 'publicar' | 'salvar'

export const avisoVazio = (): DadosAviso => ({
  titulo: '', corpo: '', importante: '', imagens: [], links: [{ rotulo: '', url: '' }], prazoData: '', prazoHora: '',
  fixado: false, evento_id: '', categoria: 'aviso', agenda_mes: '', temEnquete: false, pergunta: '', regra: '', multipla: false, opcoes: ['', ''],
})

const partesPrazo = (iso: string | null) => {
  if (!iso) return { prazoData: '', prazoHora: '' }
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).reduce<Record<string, string>>((m, x) => { m[x.type] = x.value; return m }, {})
  return { prazoData: `${p.year}-${p.month}-${p.day}`, prazoHora: `${p.hour}:${p.minute}` }
}

export const deAviso = (a: AvisoOrg): DadosAviso => ({
  titulo: a.titulo, corpo: a.corpo || '', importante: a.importante || '', imagens: a.imagens,
  links: a.links.length ? a.links.map(l => ({ rotulo: l.rotulo || '', url: l.url })) : [{ rotulo: '', url: '' }],
  ...partesPrazo(a.prazo_em), fixado: a.fixado, evento_id: a.evento_id || '',
  categoria: a.categoria || 'aviso', agenda_mes: a.agenda_mes ? a.agenda_mes.slice(0, 7) : '',
  temEnquete: !!a.enquete, pergunta: a.enquete?.pergunta || '', regra: a.enquete?.regra || '',
  multipla: !!a.enquete?.multipla, opcoes: a.enquete?.opcoes?.length ? a.enquete.opcoes : ['', ''],
})

/** Duplicar: tudo menos imagens, prazo e fixado (cada aviso tem as suas imagens). */
export const duplicarAviso = (a: AvisoOrg): DadosAviso => ({ ...deAviso(a), imagens: [], prazoData: '', prazoHora: '', fixado: false })

/** Meses para ligar o aviso a Agenda: o atual e os 5 seguintes (mais o ja escolhido, se for antigo). */
function mesesAgenda(atual: string): string[] {
  const hoje = new Date()
  const out: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  if (atual && !out.includes(atual)) out.unshift(atual)
  return out
}

/** O que vai para o banco: prazo no fuso de Brasilia (sem horario de verao: -03:00). */
export function payload(d: DadosAviso) {
  return {
    titulo: d.titulo, corpo: d.corpo, importante: d.importante, imagens: d.imagens,
    links: d.links.filter(l => l.url.trim()).map(l => ({ rotulo: l.rotulo.trim(), url: l.url.trim() })),
    prazo_em: d.prazoData ? `${d.prazoData}T${d.prazoHora || '23:59'}:00-03:00` : '',
    fixado: d.fixado, evento_id: d.evento_id, categoria: d.categoria, agenda_mes: d.agenda_mes ? `${d.agenda_mes}-01` : '',
    enquete: d.temEnquete ? { pergunta: d.pergunta, regra: d.regra, multipla: d.multipla, opcoes: d.opcoes.map(o => o.trim()).filter(Boolean) } : null,
  }
}

export function FormAviso({ titulo, inicial, estado, votos, eventos, urlImagem, onSalvar, subirImagem, onVoltar }: {
  titulo: string; inicial: DadosAviso; estado: Aviso['status'] | null; votos: number; eventos: EventoOpcao[]
  urlImagem: (p: string) => string
  onSalvar: (d: DadosAviso, acao: AcaoAviso) => Promise<string | null>
  subirImagem: (f: File) => Promise<string | null>
  onVoltar: () => void
}) {
  const [d, setD] = useState<DadosAviso>(inicial)
  const [ocupado, setOcupado] = useState<AcaoAviso | 'imagem' | null>(null)
  const [erro, setErro] = useState('')
  const entrada = useRef<HTMLInputElement | null>(null)
  const topo = useRef<HTMLDivElement | null>(null)
  const novo = estado === null
  const travaEnquete = votos > 0

  useEffect(() => { topo.current?.scrollIntoView({ block: 'start' }) }, [])
  const set = <K extends keyof DadosAviso>(k: K, v: DadosAviso[K]) => setD(x => ({ ...x, [k]: v }))

  async function salvar(acao: AcaoAviso) {
    setErro('')
    if (semEmoji(d.titulo).length < 3) { setErro('Dê um título ao aviso, de 3 a 80 caracteres.'); return }
    if (!semEmoji(d.corpo)) { setErro('Escreva o texto do aviso.'); return }
    if (d.temEnquete && (!d.pergunta.trim() || d.opcoes.filter(o => o.trim()).length < 2)) { setErro('A enquete precisa da pergunta e de pelo menos 2 opções.'); return }
    setOcupado(acao)
    const msg = await onSalvar(d, acao)
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
    const path = await subirImagem(await comprimirImagem(f, { maxLado: 1600 }))
    setOcupado(null)
    if (!path) { setErro('Não conseguimos subir a imagem. Tente outra.'); return }
    set('imagens', [...d.imagens, path])
  }

  // Previa: a linha da lista como o membro ve, ja sem emoji.
  const previa: Aviso = {
    id: 'previa', slug: 'previa', titulo: semEmoji(d.titulo) || 'Título do aviso',
    resumo: semEmoji(d.corpo).replace(/\*/g, '').replace(/\s+/g, ' ').slice(0, 180), imagens: d.imagens, links: [],
    prazo_em: d.prazoData ? `${d.prazoData}T${d.prazoHora || '23:59'}:00-03:00` : null, fixado: d.fixado,
    status: 'publicado', publicado_em: new Date().toISOString(), editado_em: null, autor: null, tem_atualizacoes: false,
    categoria: d.categoria, agenda_mes: null,
    enquete: d.temEnquete ? { pergunta: d.pergunta, regra: d.regra || null, multipla: d.multipla, opcoes: d.opcoes, aberta: true, meu_voto: null, total: 0 } : null,
  }

  return (
    <div ref={topo} className="fa">
      <div className="ag-topo">
        <h1 className="as-h2">{titulo}</h1>
        <button type="button" className="as-btn sm" onClick={onVoltar}>Voltar</button>
      </div>
      {estado === 'rascunho' && <div className="as-note">Rascunho: só a organização vê.</div>}

      <div className="fa-grade">
        <div className="fa-col">
          <label className="as-f"><span className="as-lb">Título</span>
            <input className="as-in" value={d.titulo} maxLength={80} onChange={e => set('titulo', e.target.value)} />
            <span className="as-hint">Curto e direto. {d.titulo.length}/80.</span></label>

          <div className="as-f"><span className="as-lb">Categoria</span>
            <div className="fa-cats" role="radiogroup" aria-label="Categoria">
              {ORDEM_CATEGORIAS.map(c => (
                <button key={c} type="button" role="radio" aria-checked={d.categoria === c} className={`as-chip fa-cat${d.categoria === c ? ' fill' : ''}`} onClick={() => set('categoria', c)}>
                  <Ico n={CATEGORIAS[c].ico} s={14} />{CATEGORIAS[c].rotulo}
                </button>
              ))}
            </div>
            <span className="as-hint">Aviso sem foto ganha a capa da categoria, com “{palavraCapa({ titulo: d.titulo || 'Aviso', categoria: d.categoria })}” em destaque.</span></div>

          <label className="as-f"><span className="as-lb">Texto</span>
            <textarea className="as-in fa-ta" value={d.corpo} maxLength={3000} onChange={e => set('corpo', e.target.value)} />
            <span className="as-hint">Igual ao WhatsApp: *negrito*, “- ” no começo da linha vira lista e link com https:// vira link. Emoji sai ao salvar. {d.corpo.length}/3000.</span></label>

          <label className="as-f"><span className="as-lb">Destaque “Importante” (opcional)</span>
            <input className="as-in" value={d.importante} maxLength={300} onChange={e => set('importante', e.target.value)} />
            <span className="as-hint">Uma regra ou alerta que não pode passar batido.</span></label>

          <div className="as-f">
            <span className="as-lb">Imagens (até 3, opcional)</span>
            {d.imagens.length > 0 && (
              <div className="fa-imgs">
                {d.imagens.map(p => (
                  <div key={p} className="fa-img">
                    <Image src={urlImagem(p)} alt="" fill sizes="120px" />
                    <button type="button" className="as-ib" aria-label="Tirar imagem" onClick={() => set('imagens', d.imagens.filter(x => x !== p))}><Ico n="x" s={16} /></button>
                  </div>
                ))}
              </div>
            )}
            {d.imagens.length < 3 && <button type="button" className="as-btn sm fa-auto" disabled={ocupado !== null} onClick={() => entrada.current?.click()}>{ocupado === 'imagem' ? 'Subindo...' : 'Subir imagem'}</button>}
            <input ref={entrada} type="file" accept="image/*" hidden onChange={aoEscolher} />
          </div>

          <div className="as-f">
            <span className="as-lb">Botões de link (até 3, opcional)</span>
            {d.links.map((l, i) => (
              <div key={i} className="fa-link">
                <input className="as-in" placeholder="Texto do botão, ex.: Pagar R$ 59,90" maxLength={40} value={l.rotulo} onChange={e => set('links', d.links.map((x, j) => j === i ? { ...x, rotulo: e.target.value } : x))} />
                <input className="as-in" placeholder="https://" inputMode="url" value={l.url} onChange={e => set('links', d.links.map((x, j) => j === i ? { ...x, url: e.target.value.trim() } : x))} />
                {d.links.length > 1 && <button type="button" className="as-btn lnk sm fa-auto" onClick={() => set('links', d.links.filter((_, j) => j !== i))}>Tirar este link</button>}
              </div>
            ))}
            {d.links.length < 3 && <button type="button" className="as-btn lnk sm fa-auto" onClick={() => set('links', [...d.links, { rotulo: '', url: '' }])}>+ outro link</button>}
            <span className="as-hint">Link de pagamento de fora (pag.ae, Mercado Pago, PicPay) aparece com o aviso “fora da Bynx”.</span>
          </div>

          <div className="as-two">
            <label className="as-f"><span className="as-lb">Prazo (opcional)</span>
              <input type="date" className="as-in" value={d.prazoData} onChange={e => set('prazoData', e.target.value)} /></label>
            <label className="as-f"><span className="as-lb">Até que horas</span>
              <input type="time" className="as-in" value={d.prazoHora} placeholder="23:59" onChange={e => set('prazoHora', e.target.value)} /></label>
          </div>
          <span className="as-hint" style={{ marginTop: -4 }}>Horário de Brasília. Sem hora, vale até 23h59. Depois do prazo, o aviso vai para Encerrados e a enquete fecha.</span>

          {(eventos.length > 0 || d.evento_id) && (
            <label className="as-f"><span className="as-lb">Evento da Agenda (opcional)</span>
              <select className="as-in" value={d.evento_id} onChange={e => set('evento_id', e.target.value)}>
                <option value="">Nenhum</option>
                {/* Evento ja ligado que passou ou foi cancelado sai da lista, mas o vinculo continua. */}
                {d.evento_id && !eventos.some(ev => ev.id === d.evento_id) && <option value={d.evento_id}>Evento atual (já passou ou foi cancelado)</option>}
                {eventos.map(ev => <option key={ev.id} value={ev.id}>{ev.inicio_data.slice(8, 10)}/{ev.inicio_data.slice(5, 7)} · {ev.titulo}</option>)}
              </select>
              <span className="as-hint">O aviso ganha o botão “Ver na Agenda”.</span></label>
          )}

          <label className="as-f"><span className="as-lb">Mês da Agenda (opcional)</span>
            <select className="as-in" value={d.agenda_mes} onChange={e => set('agenda_mes', e.target.value)}>
              <option value="">Nenhum</option>
              {mesesAgenda(d.agenda_mes).map(m => <option key={m} value={m}>{MESES[Number(m.slice(5, 7)) - 1]} de {m.slice(0, 4)}</option>)}
            </select>
            <span className="as-hint">Para o aviso do calendário do mês: a página lista os eventos da Agenda daquele mês.</span></label>

          <label className="as-chk"><input type="checkbox" checked={d.fixado} onChange={e => set('fixado', e.target.checked)} /><span>Fixar no topo. Para regras e boas-vindas; no máximo 3 fixados.</span></label>

          <label className="as-chk"><input type="checkbox" checked={d.temEnquete} disabled={travaEnquete} onChange={e => set('temEnquete', e.target.checked)} /><span>Tem enquete</span></label>
          {d.temEnquete && (
            <div className="fa-enq">
              {travaEnquete && <div className="as-note">A enquete já tem {votos} {votos === 1 ? 'voto' : 'votos'}: as opções não podem mudar.</div>}
              <label className="as-f"><span className="as-lb">Pergunta</span>
                <input className="as-in" maxLength={120} value={d.pergunta} onChange={e => set('pergunta', e.target.value)} placeholder="Qual tamanho você quer?" /></label>
              <label className="as-f"><span className="as-lb">Regra acima das opções (opcional)</span>
                <input className="as-in" maxLength={160} value={d.regra} onChange={e => set('regra', e.target.value)} placeholder="Votar confirma o pedido de 1 camiseta." /></label>
              <div className="as-f">
                <span className="as-lb">Opções (2 a 8)</span>
                {d.opcoes.map((o, i) => (
                  <div key={i} className="fa-opc">
                    <input className="as-in" maxLength={60} value={o} disabled={travaEnquete} placeholder={`Opção ${i + 1}`} onChange={e => set('opcoes', d.opcoes.map((x, j) => j === i ? e.target.value : x))} />
                    {!travaEnquete && d.opcoes.length > 2 && <button type="button" className="as-ib" aria-label={`Tirar opção ${i + 1}`} onClick={() => set('opcoes', d.opcoes.filter((_, j) => j !== i))}><Ico n="x" s={16} /></button>}
                  </div>
                ))}
                {!travaEnquete && d.opcoes.length < 8 && <button type="button" className="as-btn lnk sm fa-auto" onClick={() => set('opcoes', [...d.opcoes, ''])}>+ opção</button>}
              </div>
              <div className="pc-abas fa-tipo" role="radiogroup" aria-label="Tipo de escolha">
                <button type="button" role="radio" aria-checked={!d.multipla} className={!d.multipla ? 'on' : ''} disabled={travaEnquete} onClick={() => set('multipla', false)}>Escolha única</button>
                <button type="button" role="radio" aria-checked={d.multipla} className={d.multipla ? 'on' : ''} disabled={travaEnquete} onClick={() => set('multipla', true)}>Várias</button>
              </div>
            </div>
          )}
        </div>

        <div className="fa-lado">
          <div className="fa-previa">
            <div className="as-k">Prévia para o membro</div>
            <div className="fa-prev-card" aria-hidden="true">
              <span className="m"><CapaAviso a={previa} sizes="360px" /></span>
              <span className="b"><span className="c">{CATEGORIAS[d.categoria].rotulo}</span><b>{previa.titulo}</b><span className="r">{previa.resumo || 'O começo do texto aparece aqui.'}</span></span>
            </div>
          </div>
          {erro && <div className="as-erro" role="alert">{erro}</div>}
          {(novo || estado === 'rascunho') ? (
            <>
              <button type="button" className="as-btn pri" disabled={ocupado !== null} onClick={() => salvar('publicar')}>{ocupado === 'publicar' ? 'Publicando...' : 'Publicar'}</button>
              <button type="button" className="as-btn" disabled={ocupado !== null} onClick={() => salvar('rascunho')}>{ocupado === 'rascunho' ? 'Salvando...' : 'Salvar rascunho'}</button>
            </>
          ) : (
            <button type="button" className="as-btn pri" disabled={ocupado !== null} onClick={() => salvar('salvar')}>{ocupado === 'salvar' ? 'Salvando...' : 'Salvar alterações'}</button>
          )}
        </div>
      </div>
      <style>{AV_CSS + FA_CSS}</style>
    </div>
  )
}

const FA_CSS = `
.fa{display:flex;flex-direction:column;gap:14px;scroll-margin-top:72px}
.fa-grade{display:flex;flex-direction:column;gap:14px;min-width:0}
.fa-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.fa-ta{min-height:180px;resize:vertical;line-height:1.5}
.fa-auto{width:auto;align-self:flex-start}
.fa-imgs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.fa-img{position:relative;width:96px;height:96px;border-radius:10px;overflow:hidden;border:1px solid var(--bx-border)}
.fa-img img{object-fit:cover}
.fa-img .as-ib{position:absolute;top:2px;right:2px;background:var(--bx-scrim)}
.fa-link{display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid var(--bx-border);border-radius:12px;margin-bottom:6px}
.fa-enq{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px dashed var(--bx-border-2);border-radius:12px}
.fa-opc{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.pc-abas.fa-tipo{display:grid}
.fa-lado{display:flex;flex-direction:column;gap:8px}
.fa-previa{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px dashed var(--bx-border-2);border-radius:12px}
.fa-prev-card{display:flex;flex-direction:column;border-radius:14px;overflow:hidden;border:1px solid var(--bx-border);background:var(--bx-surface)}
.fa-prev-card .m{position:relative;display:block;aspect-ratio:16/9;background:var(--bx-bg-elev)}
.fa-prev-card .b{display:flex;flex-direction:column;gap:4px;padding:10px 12px 12px}
.fa-prev-card .c{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ac-1)}
.fa-prev-card b{font-size:16px;line-height:1.25}
.fa-prev-card .r{font-size:13px;color:var(--bx-text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.fa-cats{display:flex;flex-wrap:wrap;gap:8px}
.fa-cat{height:auto;min-height:44px;padding:0 14px;font-size:13px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.fa select.as-in{appearance:auto}
@media (min-width:1024px){
  .fa-grade{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:32px;align-items:start}
  .fa-lado{position:sticky;top:88px}
}
`
