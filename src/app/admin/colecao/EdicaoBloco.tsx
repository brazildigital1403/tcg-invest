'use client'

// Cabecalho da edicao no /admin (21/11/2026): estado, numeros, datas e as acoes (publicar,
// recolher, encerrar, editar titulo/tiragem/datas). As regras ficam no banco; aqui ficam os
// avisos do que falta para publicar e a conta dos prazos que o publicar vai gravar.

import { useState } from 'react'
import { FASES, PAPEIS_EDICAO, TRILHAS, dataBr, dataHoraCurta, deDatetimeLocal, erroAdminAlbum, paraDatetimeLocal, type EdicaoAdmin } from '@/lib/pcc/albumAdmin'
import { nn } from '@/lib/pcc/album'
import { chamar } from './api'

type Props = {
  ed: EdicaoAdmin
  onMudou: () => void
  onErro: (m: string) => void
  onOk: (m: string) => void
  onIrParaCarta: (numero: number) => void
}

const ROTULO_FALTA: Record<string, string> = { nome: 'nome', tipo: 'tipo', raridade: 'raridade', texto: 'texto', arte: 'arte', missao: 'título da missão' }
const DIA = 24 * 60 * 60 * 1000

export default function EdicaoBloco({ ed, onMudou, onErro, onOk, onIrParaCarta }: Props) {
  const [aberto, setAberto] = useState<null | 'editar' | 'publicar'>(null)
  const [ocupado, setOcupado] = useState(false)
  const r = ed.resumo

  async function estado(como: 'recolher' | 'encerrar') {
    const texto = como === 'recolher'
      ? 'Recolher a edição? Ela some para os membros e volta para rascunho. As cartas que já foram ganhas ficam com quem ganhou.'
      : 'Encerrar a edição? Não dá mais para ganhar, conceder nem editar cartas. Os pedidos do set continuam andando. Isso não tem volta.'
    if (!window.confirm(texto)) return
    setOcupado(true); onErro(''); onOk('')
    const res = await chamar({ acao: 'estado', id: ed.id, como })
    setOcupado(false)
    if (!res.ok) { onErro(erroAdminAlbum(res.d.error, res.d.detalhe)); return }
    onOk(como === 'recolher' ? 'Edição recolhida: voltou para rascunho.' : 'Edição encerrada.')
    onMudou()
  }

  return (
    <section className="ac-box">
      <div className="ac-row sp">
        <div>
          <div className="ac-row"><h2 className="ac-h2">Edição {ed.edicao}: {ed.titulo}</h2><span className={`ac-fase ${ed.fase}`}>{FASES[ed.fase]}</span></div>
          <p className="ac-mut" style={{ marginTop: 4 }}>{PAPEIS_EDICAO[ed.papel]}{ed.trilha ? ` · trilha ${TRILHAS[ed.trilha]}` : ''} · {ed.total_cartas} de {ed.total_previsto ?? '?'} cartas{ed.tiragem_fisica === 0 ? ' · só digital, sem set físico' : ''}</p>
          {ed.status !== 'rascunho' && (
            <p className="ac-datas" style={{ marginTop: 6 }}>
              <span>Abre <b>{dataHoraCurta(ed.abre_em)}</b></span>
              <span>Ganhar cartas até <b>{dataHoraCurta(ed.fecha_em)}</b></span>
              <span>Pedir o set até <b>{dataHoraCurta(ed.pedir_set_ate)}</b></span>
            </p>
          )}
        </div>
        <div className="ac-row">
          {ed.status === 'rascunho' && <button type="button" className="ac-btn pri" disabled={ocupado} onClick={() => setAberto(aberto === 'publicar' ? null : 'publicar')}>Publicar</button>}
          {ed.status === 'publicada' && <button type="button" className="ac-btn" disabled={ocupado} onClick={() => estado('recolher')}>Recolher</button>}
          {ed.status === 'publicada' && <button type="button" className="ac-btn red" disabled={ocupado} onClick={() => estado('encerrar')}>Encerrar</button>}
          {ed.status !== 'encerrada' && <button type="button" className="ac-btn" disabled={ocupado} onClick={() => setAberto(aberto === 'editar' ? null : 'editar')}>Editar edição</button>}
        </div>
      </div>

      <div className="ac-nums">
        <div className="ac-num"><b>{r.pessoas}</b><span>pessoas com cartas</span></div>
        <div className="ac-num"><b>{r.ganhas}</b><span>cartas ganhas</span></div>
        <div className="ac-num"><b>{r.reveladas}</b><span>cartas viradas</span></div>
        <div className="ac-num"><b>{r.pedidos_ativos}{ed.tiragem_fisica != null ? `/${ed.tiragem_fisica}` : ''}</b><span>pedidos do set{ed.tiragem_fisica == null ? ' (sem teto)' : ''}</span></div>
      </div>

      {ed.faltando.length > 0 && (
        <div className="ac-falta" role="status">
          <b>{ed.status === 'rascunho' ? 'Para publicar, faltam dados' : 'Atenção: faltam dados'} em {ed.faltando.length} {ed.faltando.length === 1 ? 'carta' : 'cartas'}:</b>{' '}
          {ed.faltando.map((f, i) => (
            <span key={f.numero}>
              {i > 0 && ', '}
              <button type="button" onClick={() => onIrParaCarta(f.numero)}>{nn(f.numero)}</button> ({f.campos.map(c => ROTULO_FALTA[c] || c).join(', ')})
            </span>
          ))}.
        </div>
      )}

      {aberto === 'editar' && <FormEditar key="editar" ed={ed} onFechar={() => setAberto(null)} onSalvo={() => { setAberto(null); onMudou() }} onErro={onErro} onOk={onOk} />}
      {aberto === 'publicar' && <FormPublicar key="publicar" ed={ed} onFechar={() => setAberto(null)} onFeito={() => { setAberto(null); onMudou() }} onErro={onErro} onOk={onOk} />}
    </section>
  )
}

function FormEditar({ ed, onFechar, onSalvo, onErro, onOk }: { ed: EdicaoAdmin; onFechar: () => void; onSalvo: () => void; onErro: (m: string) => void; onOk: (m: string) => void }) {
  const [titulo, setTitulo] = useState(ed.titulo)
  const [tiragem, setTiragem] = useState(ed.tiragem_fisica == null ? '' : String(ed.tiragem_fisica))
  const inicial = { abre: paraDatetimeLocal(ed.abre_em), fecha: paraDatetimeLocal(ed.fecha_em), pedir: paraDatetimeLocal(ed.pedir_set_ate) }
  const [abre, setAbre] = useState(inicial.abre)
  const [fecha, setFecha] = useState(inicial.fecha)
  const [pedir, setPedir] = useState(inicial.pedir)
  const [ocupado, setOcupado] = useState(false)
  const comDatas = ed.status !== 'rascunho'
  // A abertura so muda enquanto nao abriu (agendada).
  const abreTravada = ed.fase !== 'agendada'

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const dados: Record<string, unknown> = {}
    if (titulo.trim() !== ed.titulo) dados.titulo = titulo
    if (tiragem.trim() !== (ed.tiragem_fisica == null ? '' : String(ed.tiragem_fisica))) dados.tiragem_fisica = tiragem.trim() === '' ? null : tiragem.trim()
    if (comDatas) {
      if (!abreTravada && abre !== inicial.abre) dados.abre_em = abre
      if (fecha !== inicial.fecha) dados.fecha_em = fecha
      if (pedir !== inicial.pedir) dados.pedir_set_ate = pedir
    }
    if (Object.keys(dados).length === 0) { onFechar(); return }
    setOcupado(true); onErro(''); onOk('')
    const res = await chamar({ acao: 'edicao', id: ed.id, dados })
    setOcupado(false)
    if (!res.ok) { onErro(erroAdminAlbum(res.d.error, res.d.detalhe)); return }
    onOk('Edição salva.')
    onSalvo()
  }

  return (
    <form className="ac-box" onSubmit={salvar} style={{ background: 'rgba(255,255,255,0.03)' }}>
      <h3 className="ac-h3">Editar a edição</h3>
      <div className="ac-2">
        <div className="ac-f"><label className="ac-lb" htmlFor="ed-titulo">Título</label><input id="ed-titulo" className="ac-in" value={titulo} maxLength={80} onChange={e => setTitulo(e.target.value)} /></div>
        <div className="ac-f">
          <label className="ac-lb" htmlFor="ed-tiragem">Tiragem do set físico</label>
          <input id="ed-tiragem" className="ac-in" inputMode="numeric" value={tiragem} placeholder="Sem teto" onChange={e => setTiragem(e.target.value.replace(/\D/g, ''))} />
          <span className="ac-hint">Quantos sets existem para pedir. Vazio = sem teto.</span>
        </div>
      </div>
      {comDatas && (
        <div className="ac-3">
          <div className="ac-f"><label className="ac-lb" htmlFor="ed-abre">Abre em</label><input id="ed-abre" type="datetime-local" className="ac-in" value={abre} disabled={abreTravada} onChange={e => setAbre(e.target.value)} /><span className="ac-hint">{abreTravada ? 'A edição já abriu.' : 'Horário de Brasília.'}</span></div>
          <div className="ac-f"><label className="ac-lb" htmlFor="ed-fecha">Ganhar cartas até</label><input id="ed-fecha" type="datetime-local" className="ac-in" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          <div className="ac-f"><label className="ac-lb" htmlFor="ed-pedir">Pedir o set até</label><input id="ed-pedir" type="datetime-local" className="ac-in" value={pedir} onChange={e => setPedir(e.target.value)} /></div>
        </div>
      )}
      <div className="ac-row">
        <button type="submit" className="ac-btn pri" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" className="ac-btn" onClick={onFechar} disabled={ocupado}>Cancelar</button>
      </div>
    </form>
  )
}

function FormPublicar({ ed, onFechar, onFeito, onErro, onOk }: { ed: EdicaoAdmin; onFechar: () => void; onFeito: () => void; onErro: (m: string) => void; onOk: (m: string) => void }) {
  const [abre, setAbre] = useState('')
  const [dias, setDias] = useState('90')
  const [diasPedido, setDiasPedido] = useState('30')
  const [ocupado, setOcupado] = useState(false)
  const bloqueada = ed.faltando.length > 0

  // Datas que o publicar vai gravar. Sem "abre em" a edicao abre ao publicar, e so da para mostrar os prazos.
  const base = abre ? deDatetimeLocal(abre) : null
  const nDias = Number(dias), nPedido = Number(diasPedido)
  const valido = Number.isInteger(nDias) && nDias >= 7 && nDias <= 365 && Number.isInteger(nPedido) && nPedido >= 0 && nPedido <= 120
  const fecha = base && valido ? new Date(Date.parse(base) + nDias * DIA).toISOString() : null
  const pedir = fecha && valido ? new Date(Date.parse(fecha) + nPedido * DIA).toISOString() : null

  async function publicar(e: React.FormEvent) {
    e.preventDefault()
    if (!valido) { onErro(erroAdminAlbum('prazo_invalido')); return }
    setOcupado(true); onErro(''); onOk('')
    const dados: Record<string, unknown> = { dias: nDias, dias_pedido: nPedido }
    if (abre) dados.abre_em = abre
    const res = await chamar({ acao: 'estado', id: ed.id, como: 'publicar', dados })
    setOcupado(false)
    if (!res.ok) { onErro(erroAdminAlbum(res.d.error, res.d.detalhe)); return }
    onOk(abre ? 'Edição publicada e agendada.' : 'Edição publicada: já está aberta para os membros.')
    onFeito()
  }

  return (
    <form className="ac-box" onSubmit={publicar} style={{ background: 'rgba(255,255,255,0.03)' }}>
      <h3 className="ac-h3">Publicar a edição</h3>
      <p className="ac-mut">Os membros passam a ver o álbum e a ganhar cartas. Antes disso ninguém vê nada, nem a arte.</p>
      <div className="ac-3">
        <div className="ac-f"><label className="ac-lb" htmlFor="pb-abre">Abre em (opcional)</label><input id="pb-abre" type="datetime-local" className="ac-in" value={abre} onChange={e => setAbre(e.target.value)} /><span className="ac-hint">Vazio = abre agora. Horário de Brasília.</span></div>
        <div className="ac-f"><label className="ac-lb" htmlFor="pb-dias">Dias para ganhar cartas</label><input id="pb-dias" className="ac-in" inputMode="numeric" value={dias} onChange={e => setDias(e.target.value.replace(/\D/g, ''))} /><span className="ac-hint">De 7 a 365.</span></div>
        <div className="ac-f"><label className="ac-lb" htmlFor="pb-pedido">Dias para pedir o set depois</label><input id="pb-pedido" className="ac-in" inputMode="numeric" value={diasPedido} onChange={e => setDiasPedido(e.target.value.replace(/\D/g, ''))} /><span className="ac-hint">De 0 a 120.</span></div>
      </div>
      <p className="ac-mut">
        {!valido ? 'Confira os prazos.' : fecha && pedir
          ? <>Vai ganhar cartas até <b>{dataBr(fecha)}</b> e pedir o set até <b>{dataBr(pedir)}</b>.</>
          : <>Abre ao publicar, dá <b>{nDias} dias</b> para ganhar cartas e mais <b>{nPedido} dias</b> para pedir o set.</>}
      </p>
      {bloqueada && <div className="ac-msg erro" role="alert">Complete as cartas antes de publicar (veja o aviso acima).</div>}
      <div className="ac-row">
        <button type="submit" className="ac-btn pri" disabled={ocupado || bloqueada || !valido}>{ocupado ? 'Publicando...' : 'Publicar a edição'}</button>
        <button type="button" className="ac-btn" onClick={onFechar} disabled={ocupado}>Cancelar</button>
      </div>
    </form>
  )
}
