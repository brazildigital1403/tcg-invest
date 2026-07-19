'use client'

import { use as usePromise, useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'
import { useLojaOwner, LojaEstadoFallback, SH } from '../_shared'
import { fmtBRL } from '@/lib/comissao'

/**
 * /minha-loja/[id]/produtos — o que a loja vende alem de carta.
 *
 * Carta continua no Marketplace (puxa do catalogo, tem condicao/graduacao).
 * Aqui e selado/pelucia/funko/fichario/acessorio: a loja descreve do zero e tem
 * ESTOQUE (N unidades). Estoque 0 some da vitrine sozinho e volta quando repoe.
 *
 * `peso_g` (gramas) alimenta o frete calculado (Melhor Envio). So precisa
 * preencher se a loja usa frete calculado; a dimensao a Bynx estima pelo tipo.
 */

const TIPOS = [
  { v: 'selado', ic: '📦', label: 'Selado' },
  { v: 'pelucia', ic: '🧸', label: 'Pelúcia' },
  { v: 'funko', ic: '🎎', label: 'Funko' },
  { v: 'fichario', ic: '📁', label: 'Fichário' },
  { v: 'acessorio', ic: '🎁', label: 'Acessório' },
] as const
type TipoV = (typeof TIPOS)[number]['v']
const icone = (t: string) => TIPOS.find(x => x.v === t)?.ic || '📦'
const rotulo = (t: string) => TIPOS.find(x => x.v === t)?.label || t

interface Produto {
  id: string
  tipo: string
  nome: string
  descricao: string | null
  preco_cents: number
  estoque: number
  peso_g: number | null
  vendidos: number
  fotos: string[]
  ativo: boolean
}

export default function LojaProdutosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: lojaId } = usePromise(params)
  const { estado, loja } = useLojaOwner(lojaId)
  const { showAlert, showConfirm } = useAppModal()
  const fileRef = useRef<HTMLInputElement>(null)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [resumo, setResumo] = useState<{ total: number; a_venda: number; esgotados: number; vendidos: number } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [form, setForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [subindo, setSubindo] = useState(false)

  // form
  const [tipo, setTipo] = useState<TipoV>('selado')
  const [nome, setNome] = useState('')
  const [precoTxt, setPrecoTxt] = useState('')
  const [estoqueTxt, setEstoqueTxt] = useState('1')
  const [pesoTxt, setPesoTxt] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fotos, setFotos] = useState<string[]>([])

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || ''
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/produtos`, { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao carregar')
      setProdutos(j.produtos || [])
      setResumo(j.resumo || null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId, token])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  function limpar() {
    setTipo('selado'); setNome(''); setPrecoTxt(''); setEstoqueTxt('1'); setPesoTxt('')
    setDescricao(''); setFotos([]); setEditId(null)
  }
  function abrirNovo() { limpar(); setForm(true) }
  function abrirEdicao(p: Produto) {
    setTipo(p.tipo as TipoV); setNome(p.nome)
    setPrecoTxt((p.preco_cents / 100).toFixed(2).replace('.', ','))
    setEstoqueTxt(String(p.estoque)); setPesoTxt(p.peso_g ? String(p.peso_g) : '')
    setDescricao(p.descricao || '')
    setFotos(p.fotos || []); setEditId(p.id); setForm(true)
  }

  async function subirFoto(f: File) {
    setSubindo(true)
    setErro(null)
    try {
      const t = await token()
      const fd = new FormData()
      fd.append('file', f)
      const r = await fetch(`/api/lojas/${lojaId}/produtos/foto`, {
        method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: fd,
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha no upload')
      setFotos(prev => [...prev, j.url].slice(0, 10))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSubindo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function salvar() {
    const preco = Math.round(Number(precoTxt.replace(/[^0-9,.]/g, '').replace(',', '.')) * 100)
    const est = Number(estoqueTxt)
    const peso = pesoTxt.trim() ? Number(pesoTxt) : null
    if (!nome.trim() || nome.trim().length < 2) return setErro('Dê um nome ao produto.')
    if (!Number.isFinite(preco) || preco <= 0) return setErro('Preço inválido. Use algo como 289,90.')
    if (!Number.isInteger(est) || est < 0) return setErro('Estoque inválido.')
    if (peso !== null && (!Number.isInteger(peso) || peso <= 0 || peso > 30000)) return setErro('Peso inválido. Use de 1 a 30000 g.')

    setSalvando(true)
    setErro(null)
    try {
      const t = await token()
      const corpo = { tipo, nome: nome.trim(), preco_cents: preco, estoque: est, peso_g: peso, descricao: descricao.trim() || null, fotos }
      const r = await fetch(`/api/lojas/${lojaId}/produtos`, {
        method: editId ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { produto_id: editId, ...corpo } : corpo),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Falha ao salvar')
      showAlert(editId ? 'Produto atualizado!' : 'Produto publicado na sua vitrine!', 'success')
      setForm(false); limpar(); await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function remover(p: Produto) {
    const ok = await showConfirm({
      message: `Remover "${p.nome}" da sua vitrine?`,
      description: 'Pedidos antigos desse produto continuam no histórico.',
      confirmLabel: 'Remover', danger: true,
    })
    if (!ok) return
    try {
      const t = await token()
      const r = await fetch(`/api/lojas/${lojaId}/produtos?produto_id=${p.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${t}` },
      })
      if (!r.ok) throw new Error('Falha ao remover')
      await carregar()
    } catch (e) {
      showAlert((e as Error).message, 'error')
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  return (
    <div style={SH.page}>
      <header style={SH.head}>
        <h1 style={SH.title}>Produtos</h1>
        <p style={SH.subtitle}>Selados, pelúcias, funkos e acessórios da sua vitrine. Cartas continuam no Marketplace.</p>
      </header>

      {erro && <div style={S.erro}>{erro}</div>}

      {resumo && resumo.total > 0 && !form && (
        <div style={S.kpis}>
          <div style={S.kpi}><div style={{ ...S.kv, color: '#22c55e' }}>{resumo.a_venda}</div><div style={S.kl}>À venda</div></div>
          <div style={S.kpi}><div style={{ ...S.kv, color: resumo.esgotados > 0 ? '#f59e0b' : '#f0f0f0' }}>{resumo.esgotados}</div><div style={S.kl}>Esgotados</div></div>
          <div style={S.kpi}><div style={S.kv}>{resumo.vendidos}</div><div style={S.kl}>Vendidos</div></div>
        </div>
      )}

      {form ? (
        <div style={SH.card}>
          <div style={S.cap}>{editId ? 'Editar produto' : 'Novo produto'}</div>

          <label style={S.lbl}>Tipo</label>
          <div style={S.chips}>
            {TIPOS.map(t => (
              <button key={t.v} onClick={() => setTipo(t.v)} style={{ ...S.chip, ...(tipo === t.v ? S.chipOn : {}) }}>
                {t.ic} {t.label}
              </button>
            ))}
          </div>

          <label style={S.lbl}>Fotos</label>
          <div style={S.fotos}>
            {fotos.map((f, i) => (
              <div key={i} style={S.foto}>
                <Image src={f} alt="" width={54} height={54} style={{ objectFit: 'cover', borderRadius: 7 }} unoptimized />
                <button onClick={() => setFotos(fotos.filter((_, j) => j !== i))} style={S.remFoto}>×</button>
              </div>
            ))}
            {fotos.length < 10 && (
              <button onClick={() => fileRef.current?.click()} disabled={subindo} style={S.addFoto}>
                {subindo ? '…' : '+'}
              </button>
            )}
          </div>
          <input
            ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto(f) }}
            style={{ display: 'none' }}
          />
          <p style={S.hint}>JPG, PNG ou WEBP até 5 MB. O limite de fotos vem do seu plano.</p>

          <label style={S.lbl}>Nome</label>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Elite Trainer Box Surging Sparks" style={S.input} />

          <div style={S.two}>
            <div>
              <label style={S.lbl}>Preço</label>
              <div style={S.inputWrap}>
                <span style={S.prefixo}>R$</span>
                <input value={precoTxt} onChange={e => setPrecoTxt(e.target.value)} placeholder="289,90" inputMode="decimal" style={S.inputBare} />
              </div>
            </div>
            <div>
              <label style={S.lbl}>Estoque</label>
              <input value={estoqueTxt} onChange={e => setEstoqueTxt(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1" inputMode="numeric" style={S.input} />
            </div>
          </div>

          <label style={S.lbl}>Peso (g)</label>
          <input value={pesoTxt} onChange={e => setPesoTxt(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ex: 850" inputMode="numeric" style={S.input} />
          <p style={S.hint}>Usado pra calcular o frete. Só precisa preencher se sua loja usa frete calculado.</p>

          <label style={S.lbl}>Descrição (opcional)</label>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Lacrado, pronta entrega…" rows={3} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} />

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={salvar} disabled={salvando} style={{ ...SH.btnPrimary, flex: 1, opacity: salvando ? 0.6 : 1 }}>
              {salvando ? 'Salvando…' : editId ? 'Salvar alterações' : 'Publicar produto'}
            </button>
            <button onClick={() => { setForm(false); limpar() }} style={S.btnGhost}>Cancelar</button>
          </div>
        </div>
      ) : carregando ? (
        <div style={{ ...SH.card, textAlign: 'center', color: 'rgba(255,255,255,0.45)' }}>Carregando…</div>
      ) : produtos.length === 0 ? (
        <div style={{ ...SH.card, textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ fontSize: 34 }}>📦</div>
          <h2 style={S.h2}>Sua vitrine só tem cartas</h2>
          <p style={S.txt}>Cadastre selados, pelúcias, funkos e acessórios. Eles aparecem na sua vitrine junto com as cartas e vendem pelo mesmo checkout.</p>
          <button onClick={abrirNovo} style={{ ...SH.btnPrimary, marginTop: 14 }}>+ Adicionar produto</button>
        </div>
      ) : (
        <>
          <button onClick={abrirNovo} style={{ ...SH.btnPrimary, width: '100%', marginBottom: 12 }}>+ Adicionar produto</button>
          {produtos.map(p => {
            const esgotado = p.estoque === 0
            return (
              <div key={p.id} style={{ ...SH.card, marginBottom: 10, padding: 14, ...(esgotado ? S.opaco : {}) }}>
                <div style={S.lin}>
                  <div style={S.th}>
                    {p.fotos?.[0]
                      ? <Image src={p.fotos[0]} alt={p.nome} width={42} height={42} style={{ objectFit: 'cover', borderRadius: 7 }} unoptimized />
                      : <span style={{ fontSize: 18 }}>{icone(p.tipo)}</span>}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.ln}>{p.nome}</div>
                    <div style={S.ls}>
                      {rotulo(p.tipo)} ·{' '}
                      <span style={{ ...S.est, ...(esgotado ? S.estZ : {}) }}>
                        {esgotado ? 'esgotado' : `${p.estoque} em estoque`}
                      </span>
                      {p.vendidos > 0 && ` · ${p.vendidos} vendido${p.vendidos > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={S.lp}>{fmtBRL(p.preco_cents)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => abrirEdicao(p)} style={{ ...S.btnGhost, flex: 1, fontSize: 12 }}>Editar</button>
                  <button onClick={() => remover(p)} style={{ ...S.btnGhost, ...S.btnDel, fontSize: 12 }}>Remover</button>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 },
  kpi: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '13px 8px', textAlign: 'center' },
  kv: { fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  kl: { fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  cap: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 },
  lbl: { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6, marginTop: 12 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { fontSize: 11.5, fontWeight: 600, padding: '7px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)', cursor: 'pointer' },
  chipOn: { background: 'rgba(168,85,247,0.16)', borderColor: 'rgba(168,85,247,0.4)', color: '#c084fc' },
  fotos: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  foto: { position: 'relative', width: 54, height: 54, borderRadius: 8, overflow: 'hidden' },
  remFoto: { position: 'absolute', top: 1, right: 1, width: 17, height: 17, borderRadius: '50%', background: 'rgba(0,0,0,0.75)', color: '#fff', border: 'none', fontSize: 12, lineHeight: 1, cursor: 'pointer', padding: 0 },
  addFoto: { width: 54, height: 54, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.35)', fontSize: 18, cursor: 'pointer' },
  hint: { fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginTop: 6 },
  input: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, color: '#f0f0f0', outline: 'none' },
  inputWrap: { display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, padding: '0 10px' },
  inputBare: { flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#f0f0f0', fontSize: 13.5, fontWeight: 600, padding: '10px 0' },
  prefixo: { fontSize: 12.5, color: 'rgba(255,255,255,0.35)', marginRight: 6 },
  two: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btnGhost: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer' },
  btnDel: { color: '#fca5a5', borderColor: 'rgba(239,68,68,0.2)' },
  opaco: { opacity: 0.62 },
  lin: { display: 'flex', gap: 11, alignItems: 'center' },
  th: { width: 42, height: 42, borderRadius: 7, background: 'linear-gradient(135deg,#1a1030,#0f1628)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  ln: { fontSize: 13, fontWeight: 700, lineHeight: 1.3 },
  ls: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  est: { fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  estZ: { background: 'rgba(239,68,68,0.13)', color: '#ef4444' },
  lp: { fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap' },
  h2: { fontSize: 16, fontWeight: 800, margin: '10px 0 6px' },
  txt: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, maxWidth: 380, margin: '0 auto' },
  erro: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 },
}
