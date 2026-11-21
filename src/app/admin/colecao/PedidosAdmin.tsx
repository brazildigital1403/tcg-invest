'use client'

// Pedidos do set fisico no /admin (21/11/2026). Fase 1: a pessoa so pede ("quero receber"); o
// frete e o envio a organizacao combina por fora (e-mail da conta ou WhatsApp) e aqui anota o
// andamento: solicitado, combinado, postado, entregue, ou cancela (a pessoa pode pedir de novo).

import { useEffect, useState } from 'react'
import { dataHoraCurta, erroAdminAlbum, type EdicaoAdmin, type PedidoSetAdmin, type PedidosAdmin, type StatusPedido } from '@/lib/pcc/albumAdmin'
import { chamar } from './api'

const ANDAMENTOS: { id: StatusPedido; rotulo: string }[] = [
  { id: 'solicitada', rotulo: 'Solicitado' },
  { id: 'combinada', rotulo: 'Frete combinado' },
  { id: 'postada', rotulo: 'Postado' },
  { id: 'entregue', rotulo: 'Entregue' },
  { id: 'cancelada', rotulo: 'Cancelado' },
]

/** Link do WhatsApp: o numero do perfil e guardado como a pessoa digitou (com DDD, sem o 55). */
function linkZap(w: string): string {
  const d = w.replace(/\D/g, '')
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`
}

export default function PedidosAdmin({ ed, versao, onMudou, onErro, onOk }: {
  ed: EdicaoAdmin; versao: number; onMudou: () => void; onErro: (m: string) => void; onOk: (m: string) => void
}) {
  const [dados, setDados] = useState<PedidosAdmin | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    chamar<{ pedidos?: PedidosAdmin }>({ acao: 'pedidos', id: ed.id }).then(r => {
      if (!vivo) return
      if (r.ok && r.d.pedidos) { setDados(r.d.pedidos); setFalhou(false) } else setFalhou(true)
    })
    return () => { vivo = false }
  }, [ed.id, versao, recarga])

  async function mudar(p: PedidoSetAdmin, status: StatusPedido, nota?: string) {
    if (status === 'cancelada' && !window.confirm(`Cancelar o pedido nº ${p.numero}? A pessoa poderá pedir de novo.`)) return
    setOcupado(p.numero); onErro(''); onOk('')
    const r = await chamar({ acao: 'pedido', numero: p.numero, status, ...(nota !== undefined ? { nota } : {}) })
    setOcupado(null)
    if (!r.ok) { onErro(erroAdminAlbum(r.d.error, r.d.detalhe)); setRecarga(n => n + 1); return }
    onOk(`Pedido nº ${p.numero} atualizado.`)
    setRecarga(n => n + 1)
    onMudou()
  }

  if (falhou && !dados) return <div className="ac-box"><p className="ac-mut">Não conseguimos carregar os pedidos.</p></div>
  if (!dados) return <div className="ac-box"><p className="ac-mut">Carregando...</p></div>

  return (
    <div className="ac-box">
      <p className="ac-mut"><b>{dados.ativos}</b> {dados.ativos === 1 ? 'pedido ativo' : 'pedidos ativos'}{dados.tiragem != null ? ` de ${dados.tiragem} sets` : ' (sem teto de sets)'}. O frete e o envio são combinados por fora: use o e-mail ou o WhatsApp da conta.</p>
      {dados.lista.length === 0 ? <p className="ac-mut">Ninguém pediu o set ainda.</p> : (
        <div className="ac-scroll">
          <table className="ac-tbl">
            <thead><tr><th>Nº</th><th>Pessoa</th><th>Contato</th><th>Pedido em</th><th>Andamento</th><th>Anotação</th></tr></thead>
            <tbody>
              {dados.lista.map(p => {
                const cancelado = p.status === 'cancelada'
                return (
                  <tr key={p.numero} className={cancelado ? 'cancelado' : ''}>
                    <td>{p.numero}</td>
                    <td><b>{p.nome || 'Sem nome'}</b><small>{p.instagram ? `@${p.instagram}` : 'sem @'}</small></td>
                    <td>
                      <small style={{ color: '#f0f0f0' }}>{p.email || '-'}</small>
                      {p.whatsapp ? <small><a className="ac-a" href={linkZap(p.whatsapp)} target="_blank" rel="noopener noreferrer">{p.whatsapp}</a></small> : <small>sem WhatsApp</small>}
                    </td>
                    <td>{dataHoraCurta(p.criado_em)}</td>
                    <td>
                      <select aria-label={`Andamento do pedido ${p.numero}`} value={p.status} disabled={cancelado || ocupado === p.numero} onChange={e => mudar(p, e.target.value as StatusPedido)}>
                        {ANDAMENTOS.map(a => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
                      </select>
                    </td>
                    <td>
                      <input key={`${p.numero}:${p.nota ?? ''}`} className="ac-in" style={{ minHeight: 40, fontSize: 14 }} defaultValue={p.nota ?? ''} maxLength={500} disabled={cancelado} aria-label={`Anotação do pedido ${p.numero}`} placeholder="Ex.: frete R$ 17,50 combinado"
                        onBlur={e => { if (e.target.value !== (p.nota ?? '')) mudar(p, p.status, e.target.value) }} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
