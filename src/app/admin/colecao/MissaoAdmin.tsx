'use client'

// Missao como dado no /admin (Fase 2, fatia 1). Tres blocos: "Nova edicao", "Nova carta" e a
// missao de uma carta que ja existe. A regra e escolhida em lista (tipo, fonte, minimo), nunca
// digitada: o banco valida de novo (club_regra_valida) e so aceita o que esta no catalogo.
// So da para criar carta e mexer em regra com a edicao em rascunho e fora da edicao 1, que
// continua na regra da Fase 1.

import { useState } from 'react'
import { nn } from '@/lib/pcc/album'
import {
  FONTES, ICONES_MISSAO, PAPEIS_EDICAO, REGRAS, TRILHAS, erroAdminAlbum, resumoRegra,
  type CartaAdmin, type EdicaoAdmin, type PapelEdicao, type RegraTipo, type TrilhaEdicao,
} from '@/lib/pcc/albumAdmin'
import { chamar } from './api'

type Aviso = { onMudou: () => void; onErro: (m: string) => void; onOk: (m: string) => void }

/** O formulario da regra, em texto: vira o parametro so na hora de enviar. */
type Regra = {
  tipo: RegraTipo
  fonte: string; minimo: string; n: string; ref: string
  todas: boolean; chaves: string
  formato: string; tema: string; rede: string
  semanas: string
  desde: boolean
  titulo: string; icone: string; botao: string; href: string
  como: string
}

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function regraDaCarta(c?: CartaAdmin): Regra {
  const p = c?.regra_param || {}
  return {
    tipo: c?.regra_tipo || 'sinal',
    fonte: txt(p.fonte) || FONTES[0].id, minimo: txt(p.minimo) || '1', n: txt(p.n), ref: txt(p.ref),
    todas: p.todas === true || !Array.isArray(p.chaves), chaves: Array.isArray(p.chaves) ? p.chaves.join(', ') : '',
    formato: txt(p.formato), tema: txt(p.tema), rede: txt(p.rede),
    semanas: txt(p.semanas) || '4',
    desde: !!c?.regra_desde_abertura,
    titulo: c?.missao_titulo || '', icone: c?.missao_icone || 'star', botao: c?.missao_botao || '', href: c?.missao_href || '',
    como: c?.como_ganhar || '',
  }
}

const num = (s: string) => (/^[0-9]{1,3}$/.test(s.trim()) ? Number(s.trim()) : null)

/** O corpo que a rota espera. Nulo quando falta um numero: a tela avisa antes de chamar. */
function corpoDaRegra(r: Regra): Record<string, unknown> | null {
  let param: Record<string, unknown> = {}
  const minimo = num(r.minimo)
  if (r.tipo === 'sinal') {
    const f = FONTES.find(x => x.id === r.fonte)
    if (!f || minimo === null) return null
    param = { fonte: f.id, minimo }
    if (f.n) { const n = num(r.n); if (n === null) return null; param.n = n }
    if (f.id === 'aceite') param.ref = r.ref.trim()
  } else if (r.tipo === 'cartas_da_edicao') {
    if (minimo === null) return null
    param = r.todas ? { todas: true, minimo } : { chaves: r.chaves.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean), minimo }
  } else if (r.tipo === 'conteudos') {
    if (minimo === null) return null
    param = { minimo }
    for (const k of ['formato', 'tema', 'rede'] as const) if (r[k].trim()) param[k] = r[k].trim()
  } else if (r.tipo === 'conteudos_sequencia') {
    const s = num(r.semanas)
    if (s === null) return null
    param = { semanas: s }
  }
  return {
    regra_tipo: r.tipo, regra_param: param,
    regra_desde_abertura: r.tipo === 'manual' || r.tipo === 'cartas_da_edicao' ? false : r.desde,
    missao_titulo: r.titulo, missao_icone: r.icone, missao_botao: r.botao, missao_href: r.href,
    como_ganhar: r.como,
  }
}

function RegraCampos({ id, r, set, travado }: { id: string; r: Regra; set: (p: Partial<Regra>) => void; travado: boolean }) {
  const fonte = FONTES.find(x => x.id === r.fonte)
  const comData = r.tipo === 'sinal' ? !fonte?.semData : r.tipo === 'conteudos' || r.tipo === 'conteudos_sequencia'
  return (
    <>
      <div className="ac-f">
        <label className="ac-lb" htmlFor={`${id}-como`}>Como ganhar (o membro lê isto)</label>
        <input id={`${id}-como`} className="ac-in" value={r.como} maxLength={80} disabled={travado} onChange={e => set({ como: e.target.value })} />
      </div>
      <div className="ac-f">
        <label className="ac-lb" htmlFor={`${id}-tipo`}>Tipo de regra</label>
        <select id={`${id}-tipo`} className="ac-in" value={r.tipo} disabled={travado} onChange={e => set({ tipo: e.target.value as RegraTipo })}>
          {(Object.keys(REGRAS) as RegraTipo[]).map(t => <option key={t} value={t}>{REGRAS[t]}</option>)}
        </select>
      </div>

      {r.tipo === 'sinal' && (
        <>
          <div className="ac-2">
            <div className="ac-f">
              <label className="ac-lb" htmlFor={`${id}-fonte`}>Fonte</label>
              <select id={`${id}-fonte`} className="ac-in" value={r.fonte} disabled={travado} onChange={e => set({ fonte: e.target.value })}>
                {FONTES.map(f => <option key={f.id} value={f.id}>{f.nome}{f.fatia2 ? ' (chega com o portfólio)' : ''}</option>)}
              </select>
            </div>
            <div className="ac-f">
              <label className="ac-lb" htmlFor={`${id}-min`}>Mínimo</label>
              <input id={`${id}-min`} className="ac-in" inputMode="numeric" value={r.minimo} disabled={travado} onChange={e => set({ minimo: e.target.value })} />
            </div>
          </div>
          {fonte?.n && (
            <div className="ac-f">
              <label className="ac-lb" htmlFor={`${id}-n`}>{fonte.n}</label>
              <input id={`${id}-n`} className="ac-in" inputMode="numeric" value={r.n} disabled={travado} onChange={e => set({ n: e.target.value })} />
            </div>
          )}
          {fonte?.id === 'aceite' && (
            <div className="ac-f">
              <label className="ac-lb" htmlFor={`${id}-ref`}>Termo (letras minúsculas, números e hífen)</label>
              <input id={`${id}-ref`} className="ac-in" value={r.ref} maxLength={40} disabled={travado} onChange={e => set({ ref: e.target.value })} placeholder="jogo-limpo-v1" />
            </div>
          )}
          {fonte?.fatia2 && <span className="ac-hint">Essa fonte só começa a conferir quando o portfólio entrar. Até lá a carta não chega para ninguém.</span>}
        </>
      )}

      {r.tipo === 'cartas_da_edicao' && (
        <>
          <label className="ac-tg">
            <input type="checkbox" checked={r.todas} disabled={travado} onChange={e => set({ todas: e.target.checked })} />
            <span>Contar todas as outras cartas desta edição</span>
          </label>
          {!r.todas && (
            <div className="ac-f">
              <label className="ac-lb" htmlFor={`${id}-chaves`}>Chaves das missões que contam (separadas por vírgula)</label>
              <input id={`${id}-chaves`} className="ac-in" value={r.chaves} disabled={travado} onChange={e => set({ chaves: e.target.value })} placeholder="mira_feita, primeira_pasta" />
            </div>
          )}
          <div className="ac-f">
            <label className="ac-lb" htmlFor={`${id}-min`}>Quantas precisa ter</label>
            <input id={`${id}-min`} className="ac-in" inputMode="numeric" value={r.minimo} disabled={travado} onChange={e => set({ minimo: e.target.value })} />
          </div>
        </>
      )}

      {r.tipo === 'conteudos' && (
        <>
          <div className="ac-3">
            <div className="ac-f"><label className="ac-lb" htmlFor={`${id}-fmt`}>Formato</label><input id={`${id}-fmt`} className="ac-in" value={r.formato} disabled={travado} onChange={e => set({ formato: e.target.value })} placeholder="qualquer" /></div>
            <div className="ac-f"><label className="ac-lb" htmlFor={`${id}-tema`}>Tema</label><input id={`${id}-tema`} className="ac-in" value={r.tema} disabled={travado} onChange={e => set({ tema: e.target.value })} placeholder="qualquer" /></div>
            <div className="ac-f"><label className="ac-lb" htmlFor={`${id}-min`}>Mínimo</label><input id={`${id}-min`} className="ac-in" inputMode="numeric" value={r.minimo} disabled={travado} onChange={e => set({ minimo: e.target.value })} /></div>
          </div>
          <span className="ac-hint">Conteúdos só começam a conferir quando o portfólio entrar. Até lá a carta não chega para ninguém.</span>
        </>
      )}

      {r.tipo === 'conteudos_sequencia' && (
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`${id}-sem`}>Semanas seguidas (2 a 12)</label>
          <input id={`${id}-sem`} className="ac-in" inputMode="numeric" value={r.semanas} disabled={travado} onChange={e => set({ semanas: e.target.value })} />
          <span className="ac-hint">Só começa a conferir quando o portfólio entrar.</span>
        </div>
      )}

      {comData && (
        <label className="ac-tg">
          <input type="checkbox" checked={r.desde} disabled={travado} onChange={e => set({ desde: e.target.checked })} />
          <span>Só vale depois da abertura do capítulo</span>
        </label>
      )}

      <div className="ac-2">
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`${id}-tit`}>Título da missão</label>
          <input id={`${id}-tit`} className="ac-in" value={r.titulo} maxLength={30} disabled={travado} onChange={e => set({ titulo: e.target.value })} placeholder="De olho" />
        </div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`${id}-ico`}>Ícone</label>
          <select id={`${id}-ico`} className="ac-in" value={r.icone} disabled={travado} onChange={e => set({ icone: e.target.value })}>
            {ICONES_MISSAO.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
      </div>
      <div className="ac-2">
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`${id}-bot`}>Texto do botão (opcional)</label>
          <input id={`${id}-bot`} className="ac-in" value={r.botao} maxLength={24} disabled={travado} onChange={e => set({ botao: e.target.value })} placeholder="Abrir coleção" />
        </div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`${id}-href`}>Botão leva para</label>
          <input id={`${id}-href`} className="ac-in" value={r.href} maxLength={120} disabled={travado} onChange={e => set({ href: e.target.value })} placeholder="/minha-colecao" />
        </div>
      </div>
    </>
  )
}

/** A missao de uma carta que ja existe: resumo sempre; formulario so em rascunho e fora da edicao 1. */
export function MissaoBloco({ carta, ed, onMudou, onErro, onOk }: { carta: CartaAdmin; ed: EdicaoAdmin } & Aviso) {
  const editavel = ed.motor === 2 && ed.status === 'rascunho'
  const [aberto, setAberto] = useState(false)
  const [r, setR] = useState<Regra>(() => regraDaCarta(carta))
  const [ocupado, setOcupado] = useState(false)
  const [apagar, setApagar] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (p: Partial<Regra>) => { setMsg(''); setR(a => ({ ...a, ...p })) }

  async function salvar() {
    const dados = corpoDaRegra(r)
    if (!dados) { setMsg('Confira os números da regra.'); return }
    setOcupado(true); setMsg(''); onErro(''); onOk('')
    const res = await chamar({ acao: 'carta_regra', id: ed.id, numero: carta.numero, dados })
    setOcupado(false)
    if (!res.ok) { setMsg(erroAdminAlbum(res.d.error, res.d.detalhe)); return }
    onOk(`Missão da carta ${nn(carta.numero)} salva.`)
    setAberto(false)
    onMudou()
  }

  async function apagarCarta() {
    setOcupado(true); setMsg(''); onErro(''); onOk('')
    const res = await chamar({ acao: 'carta_apagar', id: ed.id, numero: carta.numero })
    setOcupado(false)
    if (!res.ok) { setMsg(erroAdminAlbum(res.d.error, res.d.detalhe)); setApagar(false); return }
    onOk(`Carta ${nn(carta.numero)} apagada.`)
    onMudou()
  }

  return (
    <div className="ac-missao">
      <div className="ac-row sp">
        <span className="ac-hint"><b>Missão:</b> {resumoRegra(carta)}{carta.missao ? ` · chave ${carta.missao}` : ''}</span>
        {editavel && <button type="button" className="ac-btn sm" onClick={() => { setAberto(a => !a); setApagar(false); setMsg('') }}>{aberto ? 'Fechar' : 'Editar missão'}</button>}
      </div>
      {!editavel && ed.motor === 1 && <span className="ac-hint">A edição 1 segue a regra da Fase 1: a missão não muda por aqui.</span>}
      {!editavel && ed.motor === 2 && ed.status !== 'rascunho' && <span className="ac-hint">Para mudar a missão, recolha a edição.</span>}
      {aberto && editavel && (
        <div className="ac-sub">
          <RegraCampos id={`ms-${carta.numero}`} r={r} set={set} travado={ocupado} />
          {msg && <div className="ac-msg erro" role="alert">{msg}</div>}
          <div className="ac-row">
            <button type="button" className="ac-btn pri sm" disabled={ocupado} onClick={salvar}>{ocupado ? 'Salvando...' : 'Salvar missão'}</button>
            {!apagar && <button type="button" className="ac-btn red sm" disabled={ocupado || carta.donos > 0} onClick={() => setApagar(true)}>Apagar carta</button>}
            {apagar && <><span className="ac-hint">Apagar a carta {nn(carta.numero)}? Não tem volta.</span><button type="button" className="ac-btn red sm" disabled={ocupado} onClick={apagarCarta}>Sim, apagar</button><button type="button" className="ac-btn sm" disabled={ocupado} onClick={() => setApagar(false)}>Não</button></>}
          </div>
        </div>
      )}
    </div>
  )
}

/** Carta nova numa edicao em rascunho. O rosto (nome, arte, texto) e preenchido depois, no cartao dela. */
export function NovaCarta({ ed, onFechar, onMudou, onErro, onOk }: { ed: EdicaoAdmin; onFechar: () => void } & Aviso) {
  const usados = new Set(ed.cartas.map(c => c.numero))
  let proximo = 1
  while (usados.has(proximo)) proximo += 1
  const [numero, setNumero] = useState(String(proximo))
  const [missao, setMissao] = useState('')
  const [secreta, setSecreta] = useState(false)
  const [r, setR] = useState<Regra>(() => regraDaCarta())
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (p: Partial<Regra>) => { setMsg(''); setR(a => ({ ...a, ...p })) }

  async function criar() {
    const dados = corpoDaRegra(r)
    const n = num(numero)
    if (!dados || n === null) { setMsg('Confira o número da carta e os números da regra.'); return }
    setOcupado(true); setMsg(''); onErro(''); onOk('')
    const res = await chamar({ acao: 'carta_criar', id: ed.id, dados: { ...dados, numero: n, missao: missao.trim(), secreta } })
    setOcupado(false)
    if (!res.ok) { setMsg(erroAdminAlbum(res.d.error, res.d.detalhe)); return }
    onOk(`Carta ${nn(n)} criada. Agora preencha o nome, o texto e a arte dela.`)
    onFechar()
    onMudou()
  }

  return (
    <section className="ac-box">
      <div className="ac-row sp"><h3 className="ac-h3">Nova carta</h3><button type="button" className="ac-btn sm" onClick={onFechar}>Fechar</button></div>
      <div className="ac-2">
        <div className="ac-f">
          <label className="ac-lb" htmlFor="nc-num">Número</label>
          <input id="nc-num" className="ac-in" inputMode="numeric" value={numero} disabled={ocupado} onChange={e => { setMsg(''); setNumero(e.target.value) }} />
        </div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor="nc-missao">Chave da missão</label>
          <input id="nc-missao" className="ac-in" value={missao} maxLength={40} disabled={ocupado} onChange={e => { setMsg(''); setMissao(e.target.value) }} placeholder="de_olho" autoCapitalize="none" />
          <span className="ac-hint">Letras minúsculas, números e sublinhado. Não muda depois e não aparece para o membro.</span>
        </div>
      </div>
      <RegraCampos id="nc" r={r} set={set} travado={ocupado} />
      <label className="ac-tg">
        <input type="checkbox" checked={secreta} disabled={ocupado} onChange={e => setSecreta(e.target.checked)} />
        <span>Carta secreta: o membro só vê &quot;Surpresa&quot; até ganhar</span>
      </label>
      {msg && <div className="ac-msg erro" role="alert">{msg}</div>}
      <div className="ac-row"><button type="button" className="ac-btn pri" disabled={ocupado} onClick={criar}>{ocupado ? 'Criando...' : 'Criar carta'}</button></div>
    </section>
  )
}

/** Edicao nova, em rascunho. Nada aparece para o membro ate publicar. */
export function NovaEdicao({ onFechar, onCriada, onErro, onOk }: { onFechar: () => void; onCriada: (slug: string) => void; onErro: (m: string) => void; onOk: (m: string) => void }) {
  const [f, setF] = useState({ titulo: '', slug: '', papel: 'capitulo' as PapelEdicao, trilha: 'creator' as TrilhaEdicao | '', total: '9', tiragem: '0' })
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const set = (p: Partial<typeof f>) => { setMsg(''); setF(a => ({ ...a, ...p })) }

  async function criar() {
    setOcupado(true); setMsg(''); onErro(''); onOk('')
    const res = await chamar<{ edicao?: { slug: string; edicao: number } }>({
      acao: 'edicao_criar',
      dados: { titulo: f.titulo, slug: f.slug.trim(), papel: f.papel, ...(f.trilha ? { trilha: f.trilha } : {}), total_previsto: f.total.trim(), tiragem_fisica: f.tiragem.trim() },
    })
    setOcupado(false)
    if (!res.ok || !res.d.edicao) { setMsg(erroAdminAlbum(res.d.error, res.d.detalhe)); return }
    onOk(`Edição ${res.d.edicao.edicao} criada em rascunho. Agora crie as cartas dela.`)
    onFechar()
    onCriada(res.d.edicao.slug)
  }

  return (
    <section className="ac-box">
      <div className="ac-row sp"><h3 className="ac-h3">Nova edição</h3><button type="button" className="ac-btn sm" onClick={onFechar}>Fechar</button></div>
      <p className="ac-mut">Nasce em rascunho. Nenhum membro vê até você publicar, e publicar exige todas as cartas completas.</p>
      <div className="ac-2">
        <div className="ac-f"><label className="ac-lb" htmlFor="ne-tit">Título</label><input id="ne-tit" className="ac-in" value={f.titulo} maxLength={80} disabled={ocupado} onChange={e => set({ titulo: e.target.value })} placeholder="Bynx na mão" /></div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor="ne-slug">Endereço</label>
          <input id="ne-slug" className="ac-in" value={f.slug} maxLength={60} disabled={ocupado} onChange={e => set({ slug: e.target.value })} placeholder="bynx-na-mao" autoCapitalize="none" />
          <span className="ac-hint">Letras minúsculas, números e hífen. Não muda depois.</span>
        </div>
      </div>
      <div className="ac-2">
        <div className="ac-f">
          <label className="ac-lb" htmlFor="ne-papel">Papel</label>
          <select id="ne-papel" className="ac-in" value={f.papel} disabled={ocupado} onChange={e => set({ papel: e.target.value as PapelEdicao })}>
            {(['capitulo', 'especial'] as PapelEdicao[]).map(p => <option key={p} value={p}>{PAPEIS_EDICAO[p]}</option>)}
          </select>
        </div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor="ne-trilha">Trilha</label>
          <select id="ne-trilha" className="ac-in" value={f.trilha} disabled={ocupado} onChange={e => set({ trilha: e.target.value as TrilhaEdicao | '' })}>
            <option value="">Sem trilha</option>
            {(Object.keys(TRILHAS) as TrilhaEdicao[]).map(t => <option key={t} value={t}>{TRILHAS[t]}</option>)}
          </select>
        </div>
      </div>
      <div className="ac-2">
        <div className="ac-f"><label className="ac-lb" htmlFor="ne-total">Total de cartas</label><input id="ne-total" className="ac-in" inputMode="numeric" value={f.total} disabled={ocupado} onChange={e => set({ total: e.target.value })} /></div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor="ne-tir">Tiragem do set físico</label>
          <input id="ne-tir" className="ac-in" inputMode="numeric" value={f.tiragem} disabled={ocupado} onChange={e => set({ tiragem: e.target.value })} />
          <span className="ac-hint">Zero = capítulo só digital, sem pedido de set.</span>
        </div>
      </div>
      {msg && <div className="ac-msg erro" role="alert">{msg}</div>}
      <div className="ac-row"><button type="button" className="ac-btn pri" disabled={ocupado} onClick={criar}>{ocupado ? 'Criando...' : 'Criar edição'}</button></div>
    </section>
  )
}
