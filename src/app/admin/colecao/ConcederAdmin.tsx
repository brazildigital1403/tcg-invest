'use client'

// Conceder cartas no /admin (21/11/2026): cola @ ou e-mails, ve a previa do que vai acontecer
// (nada e gravado) e so entao confirma. Dois jeitos: "Por @ ou e-mail" (uma carta, de missao
// manual: presenca, palco, trend...) e "Camiseta" (so na Base: todas de uma vez, origem brinde, um set
// digital por conta). Cada confirmacao vira um LOTE que da para desfazer no Historico.
// Quem nao tem conta (ou tem conta mas nao entrou no Club) aparece na previa e nao recebe;
// depois de conceder, o que nao deu para achar volta para a caixa para tentar de novo.

import { useMemo, useState } from 'react'
import { nn } from '@/lib/pcc/album'
import { erroAdminAlbum, separarTokens, type EdicaoAdmin, type EstadoLinha, type PreviaLote, type ResultadoLote } from '@/lib/pcc/albumAdmin'
import { chamar } from './api'

type Props = { ed: EdicaoAdmin; onMudou: () => void; onErro: (m: string) => void; onOk: (m: string) => void }

const ROTULO: Record<EstadoLinha, string> = {
  recebe: 'Vai receber', ja_tem: 'Já tem', nao_membro: 'Não entrou no Club', sem_conta: 'Sem conta', ambiguo: 'Use o e-mail',
}
const DICA: Record<EstadoLinha, string> = {
  recebe: '', ja_tem: 'Nada muda para esta pessoa.', nao_membro: 'Tem conta na Bynx, mas ainda não entrou no Club.',
  sem_conta: 'Não achamos nenhuma conta com isso.', ambiguo: 'Mais de uma conta usa esse @. Cole o e-mail.',
}

export default function ConcederAdmin({ ed, onMudou, onErro, onOk }: Props) {
  const manuais = ed.cartas.filter(c => c.modo === 'manual')
  const [modo, setModo] = useState<'arroba' | 'camiseta'>('arroba')
  const [numero, setNumero] = useState<number>(manuais[0]?.numero ?? ed.cartas[0]?.numero ?? 1)
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState('')
  const [previa, setPrevia] = useState<PreviaLote | null>(null)
  const [resultado, setResultado] = useState<ResultadoLote | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const tokens = useMemo(() => separarTokens(texto), [texto])
  const numeros = modo === 'camiseta' ? ed.cartas.map(c => c.numero) : [numero]
  const carta = ed.cartas.find(c => c.numero === numero)
  const travada = ed.status === 'encerrada'
  const muitos = tokens.length > 200

  // Mexeu em qualquer coisa: a previa antiga nao vale mais.
  const mudar = (fn: () => void) => { fn(); setPrevia(null); setResultado(null) }

  async function ver() {
    setOcupado(true); onErro(''); onOk(''); setResultado(null)
    const r = await chamar<{ previa?: PreviaLote }>({ acao: 'previa', id: ed.id, numeros, ids: tokens })
    setOcupado(false)
    if (!r.ok || !r.d.previa) { onErro(erroAdminAlbum(r.d.error, r.d.detalhe)); return }
    setPrevia(r.d.previa)
  }

  async function conceder() {
    if (!previa) return
    const n = previa.totais.recebe
    const o = modo === 'camiseta' ? `as ${numeros.length} cartas` : `a carta ${nn(numero)}`
    if (!window.confirm(`Conceder ${o} a ${n} ${n === 1 ? 'conta' : 'contas'}? Dá para desfazer o lote no Histórico.`)) return
    setOcupado(true); onErro(''); onOk('')
    const r = await chamar<{ resultado?: ResultadoLote }>({ acao: 'conceder', id: ed.id, numeros, ids: tokens, origem: modo === 'camiseta' ? 'brinde' : 'manual', nota })
    setOcupado(false)
    if (!r.ok || !r.d.resultado) { onErro(erroAdminAlbum(r.d.error, r.d.detalhe)); return }
    const res = r.d.resultado
    setResultado(res)
    setPrevia(null)
    // O que nao deu para achar fica na caixa; o que foi concedido sai.
    const sobra = [...res.nao_membros.map(x => x.token), ...res.nao_encontrados, ...res.ambiguos]
    setTexto(sobra.join('\n'))
    // O resultado aparece aqui embaixo, junto do botao; o aviso do topo da pagina ficaria repetido.
    onMudou()
  }

  if (travada) return <div className="ac-box"><p className="ac-mut">A edição está encerrada: não dá mais para conceder cartas.</p></div>

  return (
    <div className="ac-box">
      <div className="ac-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={modo === 'arroba'} className={`ac-tab${modo === 'arroba' ? ' on' : ''}`} onClick={() => mudar(() => setModo('arroba'))}>Por @ ou e-mail</button>
        {/* A camiseta entrega so as cartas da Base (decisao de 21/11/2026): em capitulo a aba nao existe e a rota recusa. */}
        {ed.papel === 'base' && <button type="button" role="tab" aria-selected={modo === 'camiseta'} className={`ac-tab${modo === 'camiseta' ? ' on' : ''}`} onClick={() => mudar(() => setModo('camiseta'))}>Camiseta ({ed.cartas.length} cartas)</button>}
      </div>

      {modo === 'arroba' ? (
        <div className="ac-f">
          <label className="ac-lb" htmlFor="cd-carta">Carta</label>
          <select id="cd-carta" className="ac-in" value={numero} onChange={e => mudar(() => setNumero(Number(e.target.value)))}>
            {ed.cartas.map(c => (
              <option key={c.numero} value={c.numero}>{nn(c.numero)} · {c.missao_titulo || 'Carta'} · {c.modo === 'manual' ? 'manual' : 'automática'}</option>
            ))}
          </select>
          {carta?.modo === 'auto' && <span className="ac-hint" style={{ color: '#f59e0b' }}>Esta carta se ganha sozinha quando a pessoa cumpre a missão. Conceder aqui pula a missão.</span>}
        </div>
      ) : (
        <p className="ac-mut">Cada conta recebe <b>as {ed.cartas.length} cartas de uma vez</b>, fechadas (a pessoa vira uma a uma). Quem já tem alguma carta fica só com as que faltam. Origem: camiseta.</p>
      )}

      <div className="ac-f">
        <label className="ac-lb" htmlFor="cd-lista">{modo === 'camiseta' ? 'E-mails ou @ de quem comprou a camiseta' : 'Quem recebe (um @ ou e-mail por linha)'}</label>
        <textarea id="cd-lista" className="ac-in ta" style={{ minHeight: 130 }} value={texto} onChange={e => mudar(() => setTexto(e.target.value))} placeholder={'@exemplo.um\nexemplo.dois@email.com'} />
        <span className="ac-hint" style={muitos ? { color: '#ef4444' } : undefined}>{tokens.length} {tokens.length === 1 ? 'nome' : 'nomes'} (até 200 por vez). O sistema acha a conta pelo @ do perfil ou pelo e-mail.</span>
      </div>
      <div className="ac-f">
        <label className="ac-lb" htmlFor="cd-nota">Anotação do lote (opcional)</label>
        <input id="cd-nota" className="ac-in" value={nota} maxLength={200} onChange={e => setNota(e.target.value)} placeholder={modo === 'camiseta' ? 'Ex.: compradores de novembro' : 'Ex.: live de 25/11'} />
      </div>
      <div className="ac-row">
        <button type="button" className="ac-btn pri" disabled={ocupado || tokens.length === 0 || muitos} onClick={ver}>{ocupado && !previa ? 'Conferindo...' : 'Ver prévia'}</button>
        <span className="ac-hint">A prévia não grava nada.</span>
      </div>

      {previa && (
        <div className="ac-box" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="ac-row sp">
            <h3 className="ac-h3">Prévia: nada foi gravado ainda</h3>
            <div className="ac-chips">
              {(Object.keys(ROTULO) as EstadoLinha[]).filter(k => previa.totais[k] > 0).map(k => <span key={k} className={`ac-est ${k}`}>{previa.totais[k]} {ROTULO[k].toLowerCase()}</span>)}
            </div>
          </div>
          <div>
            {previa.linhas.map((l, i) => (
              <div key={`${l.token}-${i}`} className="ac-lin">
                <div className="tx">
                  <b>{l.token.includes('@') ? l.token : `@${l.token}`}</b>
                  <small>{l.nome ? `${l.nome}${l.instagram ? ` · @${l.instagram}` : ''}` : DICA[l.estado]}{l.nome && DICA[l.estado] ? ` · ${DICA[l.estado]}` : ''}</small>
                </div>
                <span className={`ac-est ${l.estado}`}>{ROTULO[l.estado]}{l.estado === 'recebe' && modo === 'camiseta' ? ` (${l.faltam})` : ''}</span>
              </div>
            ))}
          </div>
          <div className="ac-row">
            <button type="button" className="ac-btn pri" disabled={ocupado || previa.totais.recebe === 0} onClick={conceder}>
              {ocupado ? 'Concedendo...' : previa.totais.recebe === 0 ? 'Ninguém para receber' : `Conceder a ${previa.totais.recebe} ${previa.totais.recebe === 1 ? 'conta' : 'contas'}`}
            </button>
            <button type="button" className="ac-btn" disabled={ocupado} onClick={() => setPrevia(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="ac-msg ok" role="status">
          {resultado.lote
            ? <><b>Lote registrado.</b> {resultado.pessoas} {resultado.pessoas === 1 ? 'conta' : 'contas'}: {resultado.novas} {resultado.novas === 1 ? 'carta nova' : 'cartas novas'}{resultado.reativadas > 0 ? `, ${resultado.reativadas} devolvida${resultado.reativadas === 1 ? '' : 's'}` : ''}{resultado.ja_tinham > 0 ? `, ${resultado.ja_tinham === 1 ? '1 que já tinha' : `${resultado.ja_tinham} que já tinham`}` : ''}. Para desfazer, abra o Histórico.</>
            : <>Nada mudou: ninguém precisava dessa carta{resultado.pessoas === 0 ? ' (nenhuma conta encontrada)' : ''}.</>}
          {resultado.nao_encontrados.length + resultado.nao_membros.length + resultado.ambiguos.length > 0 && <> O que não deu para achar ficou na caixa para tentar de novo.</>}
        </div>
      )}
    </div>
  )
}
