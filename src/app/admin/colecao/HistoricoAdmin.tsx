'use client'

// Historico da edicao no /admin (21/11/2026): o que a organizacao fez, do mais novo para o mais
// antigo. O lote concedido mostra quantas linhas ainda valem e, se ainda valem, o botao de
// desfazer o lote inteiro (quem ja pediu o set fica de fora, e o banco conta quantos).

import { useEffect, useState } from 'react'
import { nn } from '@/lib/pcc/album'
import { dataBr, dataHoraCurta, erroAdminAlbum, type EdicaoAdmin, type ItemHistorico } from '@/lib/pcc/albumAdmin'
import { chamar } from './api'

const CAMPOS_CARTA: Record<string, string> = {
  nome: 'nome', tipo: 'tipo', raridade: 'raridade', texto_efeito: 'texto', homenageado: 'homenagem', como_ganhar: 'como ganhar', previa: 'prévia', arte: 'arte',
}
const CAMPOS_EDICAO: Record<string, string> = {
  titulo: 'título', tiragem_fisica: 'tiragem', abre_em: 'abertura', fecha_em: 'fim da janela de ganhar', pedir_set_ate: 'prazo do set',
}
const STATUS: Record<string, string> = { solicitada: 'Solicitado', combinada: 'Combinado', postada: 'Postado', entregue: 'Entregue', cancelada: 'Cancelado' }

type Detalhe = Record<string, unknown> | null
const num = (d: Detalhe, k: string) => (typeof d?.[k] === 'number' ? (d[k] as number) : 0)
const txt = (d: Detalhe, k: string) => (typeof d?.[k] === 'string' ? (d[k] as string) : '')
const lista = (d: Detalhe, k: string): unknown[] => (Array.isArray(d?.[k]) ? (d[k] as unknown[]) : [])
const campos = (d: Detalhe, mapa: Record<string, string>) => lista(d, 'campos').map(c => mapa[String(c)] || String(c)).join(', ')

function descrever(i: ItemHistorico, ed: EdicaoAdmin): { titulo: string; detalhe: string } {
  const d = i.detalhe
  switch (i.acao) {
    case 'conceder_lote': {
      const numeros = lista(d, 'numeros').filter((n): n is number => typeof n === 'number')
      const unica = numeros.length === 1 ? ed.cartas.find(c => c.numero === numeros[0]) : null
      const o = numeros.length > 1 && numeros.length >= ed.cartas.length ? `as ${ed.cartas.length} cartas`
        : unica ? `a carta ${nn(unica.numero)} · ${unica.missao_titulo || ''}`.trim()
        : `as cartas ${numeros.map(nn).join(', ')}`
      const pessoas = num(d, 'pessoas')
      const nota = txt(d, 'nota')
      return {
        titulo: `Concedeu ${o} a ${pessoas} ${pessoas === 1 ? 'conta' : 'contas'}`,
        detalhe: [txt(d, 'origem') === 'brinde' ? 'camiseta' : 'manual', num(d, 'ja_tinham') > 0 ? `${num(d, 'ja_tinham')} já tinham` : '', nota ? `"${nota}"` : ''].filter(Boolean).join(' · '),
      }
    }
    case 'desfazer_lote': {
      const b = num(d, 'bloqueadas_por_retirada')
      return {
        titulo: `Desfez um lote: ${num(d, 'revogadas')} cartas de ${num(d, 'pessoas')} contas`,
        detalhe: b > 0 ? `${b} ${b === 1 ? 'conta ficou' : 'contas ficaram'} com as cartas porque já pediram o set` : '',
      }
    }
    case 'colecao_publicar': return { titulo: 'Publicou a edição', detalhe: `Abre ${dataHoraCurta(txt(d, 'abre_em'))} · ganhar cartas até ${dataBr(txt(d, 'fecha_em'))} · pedir o set até ${dataBr(txt(d, 'pedir_set_ate'))}` }
    case 'colecao_recolher': return { titulo: 'Recolheu a edição', detalhe: 'Voltou para rascunho: os membros não veem mais.' }
    case 'colecao_encerrar': return { titulo: 'Encerrou a edição', detalhe: '' }
    case 'colecao_salvar': return { titulo: 'Alterou a edição', detalhe: campos(d, CAMPOS_EDICAO) }
    case 'carta_salvar': return { titulo: `Alterou a carta ${nn(num(d, 'numero'))}`, detalhe: campos(d, CAMPOS_CARTA) }
    case 'retirada_status': return { titulo: `Pedido do set nº ${i.alvo}`, detalhe: `${STATUS[txt(d, 'de')] || txt(d, 'de')} → ${STATUS[txt(d, 'para')] || txt(d, 'para')}` }
    default: return { titulo: i.acao, detalhe: '' }
  }
}

export default function HistoricoAdmin({ ed, versao, onMudou, onErro, onOk }: {
  ed: EdicaoAdmin; versao: number; onMudou: () => void; onErro: (m: string) => void; onOk: (m: string) => void
}) {
  const [itens, setItens] = useState<ItemHistorico[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    chamar<{ historico?: ItemHistorico[] }>({ acao: 'historico', id: ed.id }).then(r => {
      if (!vivo) return
      if (r.ok && r.d.historico) { setItens(r.d.historico); setFalhou(false) } else setFalhou(true)
    })
    return () => { vivo = false }
  }, [ed.id, versao, recarga])

  async function desfazer(i: ItemHistorico) {
    if (!i.alvo) return
    if (!window.confirm('Desfazer este lote? As cartas voltam a ficar bloqueadas para quem as recebeu aqui. Quem já pediu o set fica de fora.')) return
    setOcupado(i.id); onErro(''); onOk('')
    const r = await chamar<{ resultado?: { revogadas: number; pessoas: number; bloqueadas_por_retirada: number } }>({ acao: 'desfazer', lote: i.alvo })
    setOcupado(null)
    if (!r.ok || !r.d.resultado) { onErro(erroAdminAlbum(r.d.error, r.d.detalhe)); return }
    const x = r.d.resultado
    onOk(`Lote desfeito: ${x.revogadas} cartas de ${x.pessoas} contas.${x.bloqueadas_por_retirada > 0 ? ` ${x.bloqueadas_por_retirada} ${x.bloqueadas_por_retirada === 1 ? 'conta ficou' : 'contas ficaram'} com as cartas porque já pediram o set.` : ''}`)
    setRecarga(n => n + 1)
    onMudou()
  }

  if (falhou && !itens) return <div className="ac-box"><p className="ac-mut">Não conseguimos carregar o histórico.</p></div>
  if (!itens) return <div className="ac-box"><p className="ac-mut">Carregando...</p></div>
  if (itens.length === 0) return <div className="ac-box"><p className="ac-mut">Nada foi feito nesta edição ainda.</p></div>

  return (
    <div className="ac-box">
      <p className="ac-mut">As últimas {itens.length} ações, da mais nova para a mais antiga. Horário de Brasília.</p>
      <div>
        {itens.map(i => {
          const t = descrever(i, ed)
          const lote = i.acao === 'conceder_lote'
          const ativas = i.ativas ?? 0
          return (
            <div key={i.id} className="ac-lin">
              <div className="ac-mut" style={{ width: 84, flex: 'none', fontVariantNumeric: 'tabular-nums' }}>{dataHoraCurta(i.quando)}</div>
              <div className="tx">
                <b>{t.titulo}</b>
                <small>{[t.detalhe, i.quem ? `@${i.quem}` : 'Admin Bynx'].filter(Boolean).join(' · ')}</small>
              </div>
              {lote && ativas > 0 && <button type="button" className="ac-btn sm red" disabled={ocupado === i.id} onClick={() => desfazer(i)}>{ocupado === i.id ? 'Desfazendo...' : 'Desfazer lote'}</button>}
              {lote && ativas === 0 && <span className="ac-est desfeito">Desfeito</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
