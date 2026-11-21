'use client'

// As 12 cartas da edicao no /admin (21/11/2026): nome, tipo, raridade, texto, homenagem, "como
// ganhar", previa e a arte. O cartao mostra a carta como o membro vai ver (mesmo componente
// do album). A arte sobe pela rota (o servidor confere o tipo pelo conteudo e apaga a anterior).
// A previa libera o rosto da carta para todos os membros antes de ganhar: so com nome e arte.

import { useState } from 'react'
import { MISSOES, nn, type CartaAlbum } from '@/lib/pcc/album'
import { erroAdminAlbum, type CartaAdmin, type EdicaoAdmin } from '@/lib/pcc/albumAdmin'
import { CartaFrente } from '@/app/pokecreatorsclub/album/CartaClub'
import { chamar, enviarArte } from './api'

type Aviso = { onMudou: () => void; onErro: (m: string) => void; onOk: (m: string) => void }

const TIPOS_ARTE = ['image/png', 'image/jpeg', 'image/webp']
const MAX_ARTE = 4 * 1024 * 1024

/** Chave do formulario: so o que o formulario edita. A arte fica de fora para o envio nao apagar o que se digitou. */
const chave = (c: CartaAdmin) => [c.id, c.nome, c.tipo, c.raridade, c.texto_efeito, c.homenageado, c.como_ganhar, c.previa].join('|')

export default function CartasAdmin({ ed, onMudou, onErro, onOk }: { ed: EdicaoAdmin } & Aviso) {
  const encerrada = ed.status === 'encerrada'
  return (
    <div className="ac-cartas">
      {ed.cartas.map(c => <CartaForm key={chave(c)} carta={c} ed={ed} travada={encerrada} onMudou={onMudou} onErro={onErro} onOk={onOk} />)}
    </div>
  )
}

function CartaForm({ carta, ed, travada, onMudou, onErro, onOk }: { carta: CartaAdmin; ed: EdicaoAdmin; travada: boolean } & Aviso) {
  const [f, setF] = useState({
    nome: carta.nome ?? '', tipo: carta.tipo ?? '', raridade: carta.raridade ?? '', texto: carta.texto_efeito ?? '',
    homenageado: carta.homenageado ?? '', como: carta.como_ganhar, previa: carta.previa,
  })
  const [ocupado, setOcupado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ tom: 'erro' | 'ok'; texto: string } | null>(null)
  const m = MISSOES[carta.missao]
  const falta = ed.faltando.find(x => x.numero === carta.numero)?.campos || []
  const mudou = f.nome !== (carta.nome ?? '') || f.tipo !== (carta.tipo ?? '') || f.raridade !== (carta.raridade ?? '') || f.texto !== (carta.texto_efeito ?? '')
    || f.homenageado !== (carta.homenageado ?? '') || f.como !== carta.como_ganhar || f.previa !== carta.previa
  const previaPossivel = !carta.secreta && !!f.nome.trim() && !!carta.arte_path

  // A carta como o membro a ve, com o que esta digitado agora.
  const mostra: CartaAlbum = {
    numero: carta.numero, estado: 'ganha', modo: carta.modo, secreta: carta.secreta, previa: f.previa, como_ganhar: f.como, missao: carta.missao,
    nome: f.nome.trim() || null, tipo: f.tipo.trim() || null, raridade: f.raridade.trim() || null, texto_efeito: f.texto.trim() || null,
    homenageado: f.homenageado.trim() || null, arte_path: carta.arte_path,
  }

  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setMsg(null); setF(a => ({ ...a, [k]: e.target.value })) }

  async function salvar() {
    const dados: Record<string, unknown> = {}
    if (f.nome !== (carta.nome ?? '')) dados.nome = f.nome
    if (f.tipo !== (carta.tipo ?? '')) dados.tipo = f.tipo
    if (f.raridade !== (carta.raridade ?? '')) dados.raridade = f.raridade
    if (f.texto !== (carta.texto_efeito ?? '')) dados.texto_efeito = f.texto
    if (f.homenageado !== (carta.homenageado ?? '')) dados.homenageado = f.homenageado
    if (f.como !== carta.como_ganhar) dados.como_ganhar = f.como
    if (f.previa !== carta.previa) dados.previa = f.previa
    setOcupado(true); setMsg(null); onErro(''); onOk('')
    const r = await chamar({ acao: 'carta', id: ed.id, numero: carta.numero, dados })
    setOcupado(false)
    if (!r.ok) { setMsg({ tom: 'erro', texto: erroAdminAlbum(r.d.error, r.d.detalhe) }); return }
    onOk(`Carta ${nn(carta.numero)} salva.`)
    onMudou()
  }

  async function trocarArte(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0]
    e.target.value = ''
    if (!arq) return
    if (!TIPOS_ARTE.includes(arq.type)) { setMsg({ tom: 'erro', texto: erroAdminAlbum('arte_tipo') }); return }
    if (arq.size > MAX_ARTE) { setMsg({ tom: 'erro', texto: erroAdminAlbum('arte_tamanho') }); return }
    setEnviando(true); setMsg(null); onErro(''); onOk('')
    const r = await enviarArte(ed.id, carta.numero, arq)
    setEnviando(false)
    if (!r.ok) { setMsg({ tom: 'erro', texto: erroAdminAlbum(r.d.error, r.d.detalhe) }); return }
    onOk(`Arte da carta ${nn(carta.numero)} enviada.`)
    onMudou()
  }

  return (
    <article className="ac-carta" id={`carta-${carta.numero}`}>
      <div className="ac-prev">
        <div className="pv"><CartaFrente carta={mostra} total={ed.total_cartas} tam="md" /></div>
        <label className="ac-btn sm" style={{ cursor: travada || enviando ? 'default' : 'pointer', opacity: travada || enviando ? 0.5 : 1 }}>
          {enviando ? 'Enviando...' : carta.arte_path ? 'Trocar arte' : 'Enviar arte'}
          <input type="file" accept={TIPOS_ARTE.join(',')} hidden disabled={travada || enviando} onChange={trocarArte} />
        </label>
      </div>
      <div className="ac-campos">
        <div className="ac-cab">
          <b>{nn(carta.numero)} · {m?.titulo || 'Carta'}</b>
          <span>{carta.modo === 'manual' ? 'Manual: a organização confere' : carta.secreta ? 'Secreta: vem das outras' : 'Automática'} · {carta.donos} {carta.donos === 1 ? 'pessoa tem' : 'pessoas têm'}{carta.donos > 0 ? `, ${carta.viradas} ${carta.viradas === 1 ? 'virou' : 'viraram'}` : ''}</span>
        </div>
        {falta.length > 0 && <span className="ac-hint" style={{ color: '#f59e0b' }}>Falta: {falta.join(', ')}</span>}
        <div className="ac-f"><label className="ac-lb" htmlFor={`nome-${carta.numero}`}>Nome da carta</label><input id={`nome-${carta.numero}`} className="ac-in" value={f.nome} maxLength={60} disabled={travada} onChange={campo('nome')} /></div>
        <div className="ac-2">
          <div className="ac-f"><label className="ac-lb" htmlFor={`tipo-${carta.numero}`}>Tipo</label><input id={`tipo-${carta.numero}`} className="ac-in" value={f.tipo} maxLength={30} disabled={travada} onChange={campo('tipo')} /></div>
          <div className="ac-f"><label className="ac-lb" htmlFor={`rar-${carta.numero}`}>Raridade</label><input id={`rar-${carta.numero}`} className="ac-in" value={f.raridade} maxLength={30} disabled={travada} onChange={campo('raridade')} /></div>
        </div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`txt-${carta.numero}`}>Texto do efeito</label>
          <textarea id={`txt-${carta.numero}`} className="ac-in ta" value={f.texto} maxLength={280} disabled={travada} onChange={campo('texto')} />
          <span className="ac-hint">{f.texto.length}/280</span>
        </div>
        <div className="ac-f"><label className="ac-lb" htmlFor={`hom-${carta.numero}`}>Homenagem (opcional)</label><input id={`hom-${carta.numero}`} className="ac-in" value={f.homenageado} maxLength={80} disabled={travada} onChange={campo('homenageado')} placeholder="Quem a carta homenageia" /></div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor={`como-${carta.numero}`}>Como ganhar (o membro lê isto)</label>
          <input id={`como-${carta.numero}`} className="ac-in" value={f.como} maxLength={80} disabled={travada} onChange={campo('como')} />
          {carta.secreta && <span className="ac-hint">Na carta secreta o membro só vê &quot;Surpresa&quot; até ganhar.</span>}
        </div>
        <label className={`ac-tg${previaPossivel && !travada ? '' : ' off'}`}>
          <input type="checkbox" checked={f.previa} disabled={travada || (!previaPossivel && !f.previa)} onChange={e => { setMsg(null); setF(a => ({ ...a, previa: e.target.checked })) }} />
          <span>Prévia: todos os membros veem nome e arte, mesmo antes de ganhar a carta</span>
        </label>
        {!previaPossivel && !carta.secreta && <span className="ac-hint">A prévia precisa de nome e de arte.</span>}
        {msg && <div className={`ac-msg ${msg.tom}`} role={msg.tom === 'erro' ? 'alert' : undefined}>{msg.texto}</div>}
        <div className="ac-row">
          <button type="button" className="ac-btn pri sm" disabled={!mudou || ocupado || travada} onClick={salvar}>{ocupado ? 'Salvando...' : 'Salvar carta'}</button>
          {mudou && !ocupado && <span className="ac-hint">Alterações ainda não salvas.</span>}
        </div>
      </div>
    </article>
  )
}
