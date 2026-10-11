'use client'

// Centralizacao na bancada. Duas entradas:
//  - avulsa (/admin/centralizacao): mede qualquer foto, nada e gravado; sai
//    imagem anotada para baixar e a medida para copiar.
//  - pelo pedido (?pedido=<id>&item=<id>): abre a foto difusa da carta, e o
//    Salvar grava a centralizacao no laudo do item e a imagem anotada como
//    midia de laudo (posicao centralizacao_frente/verso), que o relatorio do
//    cliente passa a usar no lugar da foto crua.

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { numeroServico, fmtDataAnoBRT } from '@/lib/servicos'
import MedidorCentralizacao, { FACES, type Face, type FotoOpcao, type MedicaoFace, type ResultadoFace } from '@/components/centralizacao/MedidorCentralizacao'
import { IconChevronLeft } from '@/components/ui/Icons'

type Midia = { id: string; item_id: string | null; tipo: string; posicao: string | null; url: string | null; created_at: string }
type Item = { id: string; nome: string; laudo: Record<string, unknown> | null }
type Dados = { solicitacao: { id: string; numero: number; servico: string }; itens: Item[]; midias: Midia[] }

export default function Page() {
  return (
    <Suspense fallback={<div className="ce-pg"><p>Carregando...</p></div>}>
      <Centralizacao />
    </Suspense>
  )
}

function Centralizacao() {
  const sp = useSearchParams()
  const pedidoId = sp.get('pedido')
  const itemId = sp.get('item')
  const hoje = fmtDataAnoBRT.format(new Date())

  if (!pedidoId || !itemId) {
    return (
      <div className="ce-pg">
        <style>{CSS}</style>
        <MedidorCentralizacao
          titulo="Medir centralização"
          subtitulo="Avulsa: nada é gravado. Baixe a imagem anotada ou copie a medida. Para gravar no laudo, abra pelo pedido."
          rodapeImagem={`Medido na bancada · ${hoje} · bynx.gg`}
        />
      </div>
    )
  }
  return <PeloPedido pedidoId={pedidoId} itemId={itemId} hoje={hoje} />
}

function PeloPedido({ pedidoId, itemId, hoje }: { pedidoId: string; itemId: string; hoje: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/servicos/${pedidoId}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(d.error || 'Não deu para carregar o pedido.'); return }
      setDados(d)
    } catch { setErro('Sem conexão com o servidor.') }
  }, [pedidoId])
  useEffect(() => { carregar() }, [carregar])

  const item = dados?.itens.find(i => i.id === itemId) || null

  // Foto difusa mais recente por face; a de saida primeiro quando a carta foi tratada.
  const fotos = useMemo(() => {
    if (!dados || !item) return undefined
    const out: Partial<Record<Face, FotoOpcao[]>> = {}
    for (const f of FACES) {
      const ops: FotoOpcao[] = []
      for (const [tipo, rotulo] of [['saida_difusa', 'Saída'], ['entrada_difusa', 'Entrada']] as const) {
        const m = dados.midias.filter(x => x.item_id === item.id && x.tipo === tipo && x.posicao === f && x.url).at(-1)
        if (m?.url) ops.push({ rotulo, url: m.url, midiaId: m.id })
      }
      out[f] = ops
    }
    return out
  }, [dados, item])

  const salvas = useMemo(() => {
    const med = item?.laudo?.centralizacao_medicao as Partial<Record<Face, MedicaoFace>> | undefined
    return med && typeof med === 'object' ? med : undefined
  }, [item])

  const salvar = useCallback(async (r: Partial<Record<Face, ResultadoFace>>): Promise<string | null> => {
    const post = async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/servicos/${pedidoId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Não deu certo.')
      return d
    }
    try {
      // Imagem antes do laudo: se a imagem falhar, o laudo nao fica apontando para nada novo.
      for (const f of FACES) {
        const res = r[f]
        if (!res) continue
        const blob = await res.imagem()
        const u = await post({ acao: 'midia_url', tipo: 'laudo', item_id: itemId, mime: 'image/jpeg' })
        const { error } = await supabase.storage.from('servico-midias').uploadToSignedUrl(u.path, u.token, blob, { contentType: 'image/jpeg' })
        if (error) throw new Error('A imagem anotada não subiu. Tente de novo.')
        await post({ acao: 'midia_confirmar', tipo: 'laudo', item_id: itemId, posicao: `centralizacao_${f}`, path: u.path })
      }
      await post({
        acao: 'centralizacao', item_id: itemId,
        frente: r.frente?.texto, verso: r.verso?.texto,
        medicao: { frente: r.frente?.medicao, verso: r.verso?.medicao },
      })
      await carregar()
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Não deu certo.'
    }
  }, [carregar, itemId, pedidoId])

  if (erro) return <div className="ce-pg"><style>{CSS}</style><p className="ce-erro">{erro}</p></div>
  if (!dados) return <div className="ce-pg"><style>{CSS}</style><p className="ce-muted">Carregando o pedido...</p></div>
  if (!item) return <div className="ce-pg"><style>{CSS}</style><p className="ce-erro">Carta não encontrada neste pedido.</p></div>

  const num = numeroServico(dados.solicitacao.numero)
  const atual = [item.laudo?.centralizacao_frente, item.laudo?.centralizacao_verso]
  return (
    <div className="ce-pg">
      <style>{CSS}</style>
      <Link href={`/admin/servicos/${pedidoId}`} className="ce-voltar"><IconChevronLeft size={16} /> Voltar ao pedido {num}</Link>
      <MedidorCentralizacao
        titulo={`${num} · ${item.nome}`}
        subtitulo={atual.some(Boolean)
          ? `No laudo hoje: frente ${typeof atual[0] === 'string' ? atual[0] : 'sem medida'}, verso ${typeof atual[1] === 'string' ? atual[1] : 'sem medida'}.`
          : 'Ainda sem centralização no laudo.'}
        rodapeImagem={`${num} · ${item.nome} · ${hoje} · bynx.gg`}
        fotos={fotos}
        salvas={salvas}
        onSalvar={salvar}
      />
    </div>
  )
}

const CSS = `
.ce-pg{padding:28px 24px 64px;max-width:1280px;margin:0 auto;font-family:var(--font-dm-sans),system-ui,sans-serif;color:var(--bx-text)}
.ce-voltar{display:inline-flex;align-items:center;gap:4px;min-height:36px;font-size:13px;color:var(--bx-text-2);text-decoration:none;margin-bottom:8px}
.ce-muted{font-size:13px;color:var(--bx-text-3)}
.ce-erro{font-size:13.5px;color:var(--bx-red)}
@media (max-width:700px){.ce-pg{padding:16px 16px 48px}}
`
