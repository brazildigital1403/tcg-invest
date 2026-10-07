'use client'

// /admin/promocoes -- promocoes de afiliado do Mercado Livre por vitrine.
//
// Vitrines (`chave` em ml_afiliado_produtos): 'default' (Site: cartas, sets e
// Pokemon), 'acessorios' (pagina de carta) e 'email' (bloco "Selecao Bynx" da
// regua). Chave que existir no banco e nao estiver em VITRINES vira aba extra.
//
// Toda escrita passa por /api/admin/promocoes (service key). A validacao e a de
// src/lib/promocoes.ts, a mesma que a API repete antes de gravar.
//
// Mockup aprovado: _Regua/direcao/admin-promocoes.(md|png).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconPlus, IconClose, IconEdit, IconCopy, IconArrowUp, IconArrowDown, IconLink,
  IconImage, IconCheck, IconWarning,
} from '@/components/ui/Icons'
import MercadoLivre from '@/components/ui/MercadoLivre'
import {
  VITRINES, TITULO_MAX, encurtarLink, exibirPreco, nomeVitrine, normalizarPreco,
  normalizarTitulo, validarImagemUrl, validarLink,
} from '@/lib/promocoes'

type Produto = {
  id: number
  ml_id: string | null
  chave: string
  titulo: string
  preco: string
  imagem_url: string
  url: string
  ordem: number
  ativo: boolean
  link_manual: boolean
}

type Link = { chave: string; url: string; titulo: string | null; subtitulo: string | null; ativo: boolean }

type InfoCache = { revalidadas: string[]; adiadas: string[] }

type RespostaApi = { ok?: boolean; error?: string; produto?: Produto; link?: Link; cache?: InfoCache }

const FORM_VAZIO = {
  url: '',
  imagem_url: '',
  titulo: '',
  preco: '',
  ordem: '',
  vitrines: [] as string[],
  ativo: true,
}

type Form = typeof FORM_VAZIO

function avisoCache(c: InfoCache | undefined): string | null {
  if (!c || c.adiadas.length === 0) return null
  const nomes = c.adiadas.map(nomeVitrine).join(' e ')
  return `Salvo. Em ${nomes}, a mudança aparece aos poucos no site: até 1h nos dados, e a página de carta guarda o HTML por até 7 dias.`
}

export default function AdminPromocoesPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErro, setLoadErro] = useState<string | null>(null)
  const [aba, setAba] = useState<string>('email')
  const [aviso, setAviso] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [menuDuplicar, setMenuDuplicar] = useState<number | null>(null)

  // Formulario (nova ou edicao)
  const [formAberto, setFormAberto] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<Form>({ ...FORM_VAZIO })
  const [tocado, setTocado] = useState<Record<string, boolean>>({})
  const [salvando, setSalvando] = useState(false)
  const [formErro, setFormErro] = useState<string | null>(null)
  const [enviandoImg, setEnviandoImg] = useState(false)
  const [imgErro, setImgErro] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  // Cabecalho da vitrine
  const [editCab, setEditCab] = useState(false)
  const [cab, setCab] = useState({ titulo: '', subtitulo: '', url: '' })
  const [salvandoCab, setSalvandoCab] = useState(false)
  const [cabErro, setCabErro] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadErro(null)
    try {
      const res = await fetch('/api/admin/promocoes', { cache: 'no-store' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setLoadErro(d.error || `Erro ${res.status} ao carregar promoções`); return }
      setProdutos(d.produtos || [])
      setLinks(d.links || [])
    } catch {
      setLoadErro('Erro de rede ao carregar promoções')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derivados ───────────────────────────────────────────────────────────
  const chaves = useMemo(() => {
    const extras = [...new Set(produtos.map((p) => p.chave))].filter((c) => !VITRINES.some((v) => v.chave === c)).sort()
    return [...VITRINES.map((v) => v.chave), ...extras]
  }, [produtos])

  const contagem = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of produtos) c[p.chave] = (c[p.chave] || 0) + 1
    return c
  }, [produtos])

  const vitrinesPorUrl = useMemo(() => {
    const m: Record<string, Set<string>> = {}
    for (const p of produtos) (m[p.url] ||= new Set()).add(p.chave)
    return m
  }, [produtos])

  const lista = useMemo(() => {
    const base = aba === 'todas' ? produtos : produtos.filter((p) => p.chave === aba)
    return [...base].sort((a, b) => a.chave.localeCompare(b.chave) || a.ordem - b.ordem || a.id - b.id)
  }, [produtos, aba])

  const ativas = lista.filter((p) => p.ativo).length
  const linkDaAba = links.find((l) => l.chave === aba) || null
  const linkDefault = links.find((l) => l.chave === 'default') || null

  // ── Acoes da lista ──────────────────────────────────────────────────────
  async function chamar(url: string, method: string, body: unknown): Promise<RespostaApi | null> {
    setErroAcao(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErroAcao(d.error || `Erro ${res.status}`); return null }
      return d
    } catch {
      setErroAcao('Erro de rede. Tente de novo.')
      return null
    }
  }

  async function alternarAtivo(p: Produto) {
    setOcupado(p.id)
    setProdutos((l) => l.map((x) => (x.id === p.id ? { ...x, ativo: !p.ativo } : x)))
    const d = await chamar(`/api/admin/promocoes/${p.id}`, 'PATCH', { ativo: !p.ativo })
    if (!d) setProdutos((l) => l.map((x) => (x.id === p.id ? { ...x, ativo: p.ativo } : x)))
    else setAviso(avisoCache(d.cache))
    setOcupado(null)
  }

  async function mover(p: Produto, dir: -1 | 1) {
    const daVitrine = produtos.filter((x) => x.chave === p.chave).sort((a, b) => a.ordem - b.ordem || a.id - b.id)
    const i = daVitrine.findIndex((x) => x.id === p.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= daVitrine.length) return
    const nova = [...daVitrine]
    ;[nova[i], nova[j]] = [nova[j], nova[i]]
    const antes = produtos
    const ordemPorId = new Map(nova.map((x, idx) => [x.id, idx]))
    setProdutos((l) => l.map((x) => (ordemPorId.has(x.id) ? { ...x, ordem: ordemPorId.get(x.id)! } : x)))
    setOcupado(p.id)
    const d = await chamar('/api/admin/promocoes/ordem', 'PUT', { chave: p.chave, ids: nova.map((x) => x.id) })
    if (!d) setProdutos(antes)
    else setAviso(avisoCache(d.cache))
    setOcupado(null)
  }

  async function duplicar(p: Produto, chave: string) {
    setMenuDuplicar(null)
    setOcupado(p.id)
    const d = await chamar(`/api/admin/promocoes/${p.id}/duplicar`, 'POST', { chave })
    if (d?.produto) {
      const novo = d.produto
      setProdutos((l) => [...l, novo])
      setAviso(avisoCache(d.cache) || `Duplicada para ${nomeVitrine(chave)}.`)
    }
    setOcupado(null)
  }

  // ── Formulario ──────────────────────────────────────────────────────────
  function abrirNova() {
    setEditId(null)
    setForm({ ...FORM_VAZIO, vitrines: aba !== 'todas' ? [aba] : [] })
    setTocado({})
    setFormErro(null)
    setImgErro(null)
    setFormAberto(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function abrirEdicao(p: Produto) {
    setEditId(p.id)
    setForm({
      url: p.url, imagem_url: p.imagem_url, titulo: p.titulo, preco: p.preco,
      ordem: String(p.ordem), vitrines: [p.chave], ativo: p.ativo,
    })
    setTocado({ url: true, imagem_url: true, titulo: true, preco: true })
    setFormErro(null)
    setImgErro(null)
    setFormAberto(true)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function fecharForm() {
    setFormAberto(false)
    setEditId(null)
    setFormErro(null)
  }

  function setCampo<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const vLink = validarLink(form.url)
  const vImg = validarImagemUrl(form.imagem_url)
  const vTitulo = normalizarTitulo(form.titulo)
  const vPreco = normalizarPreco(form.preco)
  const urlRepetida = vLink.ok
    ? form.vitrines.filter((c) => produtos.some((p) => p.chave === c && p.url === vLink.url && p.id !== editId))
    : []

  async function enviarImagem(file: File) {
    setImgErro(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setImgErro('Use JPG, PNG ou WebP.'); return }
    if (file.size > 5 * 1024 * 1024) { setImgErro('A imagem passou de 5 MB.'); return }
    setEnviandoImg(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('pasta', 'promocoes')
      const res = await fetch('/api/admin/blog/upload-imagem', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.url) { setImgErro(d.error || 'Erro ao enviar a imagem.'); return }
      setCampo('imagem_url', d.url)
      setTocado((t) => ({ ...t, imagem_url: true }))
    } catch {
      setImgErro('Erro de rede ao enviar a imagem.')
    } finally {
      setEnviandoImg(false)
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (salvando) return
    setTocado({ url: true, imagem_url: true, titulo: true, preco: true, vitrines: true })
    setFormErro(null)
    const erro =
      (!vLink.ok && vLink.erro) || (!vImg.ok && vImg.erro) || (!vTitulo.ok && vTitulo.erro) ||
      (!vPreco.ok && vPreco.erro) || (form.vitrines.length === 0 && 'Marque ao menos uma vitrine.') ||
      (urlRepetida.length > 0 && `Já está na vitrine ${urlRepetida.map(nomeVitrine).join(', ')}.`) || null
    if (erro) { setFormErro(erro); return }

    setSalvando(true)
    try {
      const payload: Record<string, unknown> = {
        url: form.url, imagem_url: form.imagem_url, titulo: form.titulo, preco: form.preco, ativo: form.ativo,
      }
      if (form.ordem.trim() !== '') payload.ordem = Number(form.ordem)
      const res = editId
        ? await fetch(`/api/admin/promocoes/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/promocoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, vitrines: form.vitrines }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) { setFormErro(d.error || `Erro ${res.status} ao salvar`); return }
      setAviso(avisoCache(d.cache) || (editId ? 'Promoção atualizada.' : 'Promoção criada.'))
      fecharForm()
      await load()
    } catch {
      setFormErro('Erro de rede ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Cabecalho da vitrine ────────────────────────────────────────────────
  function abrirCab() {
    setCab({ titulo: linkDaAba?.titulo || '', subtitulo: linkDaAba?.subtitulo || '', url: linkDaAba?.url || '' })
    setCabErro(null)
    setEditCab(true)
  }

  async function salvarCab(e: React.FormEvent) {
    e.preventDefault()
    const v = validarLink(cab.url)
    if (!v.ok) { setCabErro(`Link "ver tudo": ${v.erro}`); return }
    setSalvandoCab(true)
    const d = await chamar(`/api/admin/promocoes/vitrine/${encodeURIComponent(aba)}`, 'PUT', { ...cab, ativo: true })
    setSalvandoCab(false)
    if (!d) { setCabErro('Não foi possível salvar o cabeçalho. Veja o aviso acima.'); return }
    if (d.link) { const novo = d.link; setLinks((l) => [...l.filter((x) => x.chave !== aba), novo]) }
    setAviso(avisoCache(d.cache) || 'Cabeçalho salvo.')
    setEditCab(false)
  }

  // ── Previa ao vivo ──────────────────────────────────────────────────────
  const novaPrevia = {
    titulo: vTitulo.ok ? vTitulo.valor : (form.titulo.trim() || 'Título da promoção'),
    preco: vPreco.ok ? vPreco.valor : (form.preco.trim() || '0,00'),
    imagem: vImg.ok ? vImg.url : '',
    url: vLink.ok ? vLink.url : '#',
  }
  const vizinhaEmail = produtos.find((p) => p.chave === 'email' && p.ativo && p.id !== editId)
    || produtos.find((p) => p.ativo && p.id !== editId)
  const vizinhasSite = produtos.filter((p) => p.chave === 'default' && p.ativo && p.id !== editId).slice(0, 2)

  const [previaHtml, setPreviaHtml] = useState('')
  const [previaAltura, setPreviaAltura] = useState(380)
  const chavePrevia = formAberto ? JSON.stringify([novaPrevia, vizinhaEmail?.id]) : ''
  useEffect(() => {
    if (!formAberto) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/email-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variante: 'dupla',
            produtos: [
              novaPrevia,
              ...(vizinhaEmail ? [{ titulo: vizinhaEmail.titulo, preco: vizinhaEmail.preco, imagem: vizinhaEmail.imagem_url, url: vizinhaEmail.url }] : []),
            ],
          }),
        })
        if (res.ok) setPreviaHtml(await res.text())
      } catch {}
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chavePrevia, formAberto])

  // ── Render ──────────────────────────────────────────────────────────────
  const abaInfo = VITRINES.find((v) => v.chave === aba)

  return (
    <div className="prm-page" style={{ maxWidth: 1280, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Cabecalho */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 4px', color: 'var(--bx-text)' }}>
            Promoções
          </h1>
          <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: 0, lineHeight: 1.5 }}>
            Produtos de afiliado do Mercado Livre nas páginas de carta, set e Pokémon e no corpo dos e-mails
          </p>
        </div>
        <button type="button" className="prm-btn-principal" onClick={abrirNova}>
          <IconPlus size={16} color="currentColor" /> Nova promoção
        </button>
      </div>

      {/* Abas */}
      <div className="prm-abas" role="tablist" aria-label="Vitrines">
        <Aba ativa={aba === 'todas'} onClick={() => setAba('todas')} nome="Todas" n={produtos.length} />
        {chaves.map((c) => {
          const v = VITRINES.find((x) => x.chave === c)
          return (
            <Aba key={c} ativa={aba === c} onClick={() => { setAba(c); setEditCab(false) }}
              nome={v?.nome ?? c} descricao={v?.descricao} n={contagem[c] || 0} />
          )
        })}
      </div>

      {aviso && (
        <Faixa tom="info" onFechar={() => setAviso(null)}>{aviso}</Faixa>
      )}
      {erroAcao && (
        <Faixa tom="erro" onFechar={() => setErroAcao(null)}>{erroAcao}</Faixa>
      )}

      <div className={`prm-grid${formAberto ? ' com-form' : ''}`}>
        <div style={{ minWidth: 0 }}>

          {/* Cabecalho da vitrine */}
          {aba !== 'todas' && (
            <div className="prm-card" style={{ marginBottom: 16 }}>
              {aba === 'email' ? (
                <div className="prm-cab">
                  <Info rotulo="Título do bloco" valor="Seleção Bynx" />
                  <Info rotulo="Onde aparece" valor="Depois do botão principal de todo e-mail da régua. Sem promoção ativa, o bloco não sai." apagado />
                </div>
              ) : editCab ? (
                <form onSubmit={salvarCab} style={{ display: 'grid', gap: 12 }}>
                  <div className="prm-form-2">
                    <Campo rotulo="Título do bloco">
                      <input className="prm-input" value={cab.titulo} maxLength={80}
                        onChange={(e) => setCab((c) => ({ ...c, titulo: e.target.value }))} />
                    </Campo>
                    <Campo rotulo='Link "ver tudo"' obrigatorio>
                      <input className="prm-input" value={cab.url} inputMode="url" placeholder="https://meli.la/..."
                        onChange={(e) => setCab((c) => ({ ...c, url: e.target.value }))} />
                    </Campo>
                  </div>
                  <Campo rotulo="Subtítulo">
                    <input className="prm-input" value={cab.subtitulo} maxLength={160}
                      onChange={(e) => setCab((c) => ({ ...c, subtitulo: e.target.value }))} />
                  </Campo>
                  {cabErro && <Erro>{cabErro}</Erro>}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button type="button" className="prm-btn-sec" onClick={() => setEditCab(false)}>Cancelar</button>
                    <button type="submit" className="prm-btn-principal" disabled={salvandoCab}>
                      {salvandoCab ? 'Salvando...' : 'Salvar cabeçalho'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="prm-cab">
                  <Info rotulo="Título do bloco"
                    valor={linkDaAba?.titulo || (linkDefault?.titulo ? `${linkDefault.titulo} (da vitrine Site)` : 'Padrão do site')} />
                  <Info rotulo='Link "ver tudo"'
                    valor={linkDaAba ? encurtarLink(linkDaAba.url) : 'Não definido: usa o da vitrine Site'}
                    apagado={!linkDaAba} />
                  <button type="button" className="prm-btn-texto" onClick={abrirCab}>
                    <IconEdit size={16} color="currentColor" /> Editar cabeçalho
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Resumo da lista */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 4px 10px' }}>
            <span className="prm-rotulo">
              {lista.length} {lista.length === 1 ? 'promoção' : 'promoções'} · {ativas} {ativas === 1 ? 'ativa' : 'ativas'}
            </span>
            <span className="prm-rotulo">
              {aba === 'todas' ? 'Para mudar a ordem, abra uma vitrine' : 'Use as setas para mudar a ordem'}
            </span>
          </div>

          {/* Lista */}
          {loading ? (
            <p style={{ color: 'var(--bx-text-3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Carregando...</p>
          ) : loadErro ? (
            <div className="prm-card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--bx-red)', margin: '0 0 12px' }}>{loadErro}</p>
              <button type="button" className="prm-btn-sec" onClick={() => { setLoading(true); load() }}>Tentar de novo</button>
            </div>
          ) : lista.length === 0 ? (
            <div className="prm-card" style={{ textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ fontSize: 14, color: 'var(--bx-text-3)', margin: '0 0 12px' }}>
                {aba === 'email'
                  ? 'Nenhuma promoção na vitrine E-mail. Enquanto ela estiver vazia, os e-mails saem sem a Seleção Bynx.'
                  : 'Nenhuma promoção nesta vitrine.'}
              </p>
              <button type="button" className="prm-btn-sec" onClick={abrirNova}>
                <IconPlus size={16} color="currentColor" /> Nova promoção
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lista.map((p) => {
                const daVitrine = lista.filter((x) => x.chave === p.chave)
                const pos = daVitrine.findIndex((x) => x.id === p.id)
                const outras = [...(vitrinesPorUrl[p.url] || [])].filter((c) => c !== p.chave)
                const podeOrdenar = aba !== 'todas'
                const travado = ocupado === p.id
                return (
                  <div key={p.id} className={`prm-item${p.ativo ? '' : ' desligada'}`}>
                    <div className="prm-item-topo">
                      <span className="prm-ordem">{pos + 1}</span>
                      <span className="prm-thumb">
                        {p.imagem_url ? <img src={p.imagem_url} alt="" loading="lazy" /> : <IconImage size={20} color="var(--bx-text-3)" />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="prm-titulo">{p.titulo}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="prm-link">
                            <IconLink size={13} color="currentColor" /> {encurtarLink(p.url)}
                          </a>
                          {aba === 'todas' && <Selo>{nomeVitrine(p.chave)}</Selo>}
                          {outras.length > 0 && <Selo>Também em {outras.map(nomeVitrine).join(', ')}</Selo>}
                          {!p.ativo && <Selo>Desligada</Selo>}
                        </div>
                        <p className="prm-preco prm-so-mobile">{exibirPreco(p.preco)}</p>
                      </div>
                      <p className="prm-preco prm-so-desktop">{exibirPreco(p.preco)}</p>
                    </div>

                    <div className="prm-acoes">
                      <Interruptor ligado={p.ativo} disabled={travado} onClick={() => alternarAtivo(p)}
                        rotulo={p.ativo ? 'Ativa' : 'Desligada'} />
                      <span style={{ flex: 1 }} className="prm-so-mobile" />
                      <BotaoIcone rotulo="Subir" disabled={!podeOrdenar || travado || pos === 0} onClick={() => mover(p, -1)}>
                        <IconArrowUp size={16} color="currentColor" />
                      </BotaoIcone>
                      <BotaoIcone rotulo="Descer" disabled={!podeOrdenar || travado || pos === daVitrine.length - 1} onClick={() => mover(p, 1)}>
                        <IconArrowDown size={16} color="currentColor" />
                      </BotaoIcone>
                      <BotaoIcone rotulo="Editar" disabled={travado} onClick={() => abrirEdicao(p)}>
                        <IconEdit size={16} color="currentColor" />
                      </BotaoIcone>
                      <div style={{ position: 'relative' }}>
                        <BotaoIcone rotulo="Duplicar para outra vitrine" disabled={travado} ativo={menuDuplicar === p.id}
                          onClick={() => setMenuDuplicar((m) => (m === p.id ? null : p.id))}>
                          <IconCopy size={16} color="currentColor" />
                        </BotaoIcone>
                        {menuDuplicar === p.id && (
                          <div className="prm-menu" role="menu">
                            <p className="prm-rotulo" style={{ margin: '4px 10px 6px' }}>Duplicar para</p>
                            {chaves.filter((c) => c !== p.chave).map((c) => {
                              const jaEsta = (vitrinesPorUrl[p.url] || new Set()).has(c)
                              const v = VITRINES.find((x) => x.chave === c)
                              return (
                                <button key={c} type="button" role="menuitem" disabled={jaEsta}
                                  className="prm-menu-item" onClick={() => duplicar(p, c)}>
                                  <span style={{ flex: 1, textAlign: 'left' }}>
                                    <span style={{ display: 'block', fontSize: 14, color: 'var(--bx-text)' }}>{v?.nome ?? c}</span>
                                    {v && <span style={{ display: 'block', fontSize: 12, color: 'var(--bx-text-3)' }}>{v.descricao}</span>}
                                  </span>
                                  {jaEsta && <span className="prm-rotulo">Já está</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Formulario */}
        {formAberto && (
          <form ref={formRef} onSubmit={salvar} className="prm-card prm-form" noValidate>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--bx-text)', margin: 0 }}>
                {editId ? 'Editar promoção' : 'Nova promoção'}
              </p>
              <BotaoIcone rotulo="Fechar" onClick={fecharForm}><IconClose size={16} color="currentColor" /></BotaoIcone>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <Campo rotulo="Link de afiliado" obrigatorio>
                <div style={{ position: 'relative' }}>
                  <input className={`prm-input${tocado.url && !vLink.ok ? ' invalido' : ''}${vLink.ok ? ' valido' : ''}`}
                    value={form.url} inputMode="url" placeholder="https://meli.la/..." autoComplete="off"
                    onChange={(e) => setCampo('url', e.target.value)}
                    onBlur={() => setTocado((t) => ({ ...t, url: true }))} />
                  {vLink.ok && (
                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                      <IconCheck size={16} color="var(--bx-green)" />
                    </span>
                  )}
                </div>
                {tocado.url && !vLink.ok && (
                  <>
                    <Erro>{vLink.erro}</Erro>
                    {vLink.sugestao && (
                      <button type="button" className="prm-btn-sec" style={{ marginTop: 8 }}
                        onClick={() => setCampo('url', vLink.sugestao!)}>
                        Usar {vLink.sugestao}
                      </button>
                    )}
                  </>
                )}
                {vLink.ok && vLink.aviso && <Ajuda tom="aviso">{vLink.aviso}</Ajuda>}
                {urlRepetida.length > 0 && <Erro>Já está na vitrine {urlRepetida.map(nomeVitrine).join(', ')}.</Erro>}
              </Campo>

              <Campo rotulo="Imagem do produto" obrigatorio>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span className="prm-thumb grande">
                    {vImg.ok ? <img src={vImg.url} alt="" /> : <IconImage size={22} color="var(--bx-text-3)" />}
                  </span>
                  <label className="prm-btn-sec" style={{ flex: 1, justifyContent: 'center', cursor: enviandoImg ? 'wait' : 'pointer' }}>
                    <IconImage size={16} color="currentColor" />
                    {enviandoImg ? 'Enviando...' : vImg.ok ? 'Trocar imagem' : 'Enviar imagem'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} disabled={enviandoImg}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarImagem(f); e.target.value = '' }} />
                  </label>
                </div>
                <Ajuda>JPG, PNG ou WebP até 5 MB. Mesmo envio do Blog.</Ajuda>
                <p className="prm-rotulo" style={{ textAlign: 'center', margin: '10px 0 6px' }}>ou cole a URL da imagem</p>
                <input className={`prm-input${tocado.imagem_url && !vImg.ok ? ' invalido' : ''}`}
                  value={form.imagem_url} inputMode="url" placeholder="https://http2.mlstatic.com/..." autoComplete="off"
                  onChange={(e) => setCampo('imagem_url', e.target.value)}
                  onBlur={() => setTocado((t) => ({ ...t, imagem_url: true }))} />
                {imgErro && <Erro>{imgErro}</Erro>}
                {tocado.imagem_url && !vImg.ok && <Erro>{vImg.erro}</Erro>}
              </Campo>

              <Campo rotulo="Título" obrigatorio>
                <div style={{ position: 'relative' }}>
                  <input className={`prm-input${tocado.titulo && !vTitulo.ok ? ' invalido' : ''}`} style={{ paddingRight: 64 }}
                    value={form.titulo} maxLength={TITULO_MAX + 10}
                    onChange={(e) => setCampo('titulo', e.target.value)}
                    onBlur={() => setTocado((t) => ({ ...t, titulo: true }))} />
                  <span style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12,
                    color: form.titulo.trim().length > TITULO_MAX ? 'var(--bx-red)' : 'var(--bx-text-3)',
                  }}>
                    {form.titulo.trim().length}/{TITULO_MAX}
                  </span>
                </div>
                {tocado.titulo && !vTitulo.ok && <Erro>{vTitulo.erro}</Erro>}
              </Campo>

              <div className="prm-form-2">
                <Campo rotulo="Preço" obrigatorio>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--bx-text-3)' }}>R$</span>
                    <input className={`prm-input${tocado.preco && !vPreco.ok ? ' invalido' : ''}`} style={{ paddingLeft: 44 }}
                      value={form.preco} inputMode="decimal" placeholder="134,00"
                      onChange={(e) => setCampo('preco', e.target.value)}
                      onBlur={() => {
                        setTocado((t) => ({ ...t, preco: true }))
                        if (vPreco.ok) setCampo('preco', vPreco.valor)
                      }} />
                  </div>
                </Campo>
                <Campo rotulo="Ordem">
                  <input className="prm-input" value={form.ordem} inputMode="numeric" placeholder="Fim da fila"
                    onChange={(e) => setCampo('ordem', e.target.value.replace(/\D/g, ''))} />
                </Campo>
              </div>
              {tocado.preco && !vPreco.ok
                ? <Erro>{vPreco.erro}</Erro>
                : <Ajuda>Aceita 134, 134,00 ou R$ 134,00. Grava como 134,00 e aparece como R$ 134,00.</Ajuda>}

              <Campo rotulo="Vitrines" obrigatorio>
                <div style={{ display: 'grid', gap: 8 }}>
                  {(editId ? form.vitrines : chaves).map((c) => {
                    const v = VITRINES.find((x) => x.chave === c)
                    const marcada = form.vitrines.includes(c)
                    return (
                      <label key={c} className={`prm-check${marcada ? ' marcada' : ''}${editId ? ' travada' : ''}`}>
                        <input type="checkbox" checked={marcada} disabled={!!editId}
                          onChange={() => setCampo('vitrines', marcada ? form.vitrines.filter((x) => x !== c) : [...form.vitrines, c])} />
                        <span className="prm-check-box">{marcada && <IconCheck size={14} color="var(--bx-brand-ink)" />}</span>
                        <span style={{ flex: 1, fontSize: 15, color: 'var(--bx-text)', fontWeight: 600 }}>{v?.nome ?? c}</span>
                        {v && <span style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>{v.descricao}</span>}
                      </label>
                    )
                  })}
                </div>
                <Ajuda>
                  {editId
                    ? 'A vitrine não muda na edição. Para levar a outra vitrine, use Duplicar na lista.'
                    : 'Uma cópia por vitrine marcada. Cada vitrine tem a sua ordem.'}
                </Ajuda>
                {tocado.vitrines && form.vitrines.length === 0 && <Erro>Marque ao menos uma vitrine.</Erro>}
              </Campo>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bx-text)', margin: 0 }}>Ativa</p>
                  <p style={{ fontSize: 13, color: 'var(--bx-text-3)', margin: '2px 0 0' }}>Desligada fica salva e some do site e dos e-mails</p>
                </div>
                <Interruptor ligado={form.ativo} onClick={() => setCampo('ativo', !form.ativo)} rotulo="Ativa" semTexto />
              </div>

              {formErro && <Erro destaque>{formErro}</Erro>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="prm-btn-sec" onClick={fecharForm}>Cancelar</button>
                <button type="submit" className="prm-btn-principal" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar promoção'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Previa ao vivo */}
        {formAberto && (
          <div className="prm-card prm-previa">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--bx-text)', margin: 0 }}>Prévia ao vivo</p>
              <span style={{ fontSize: 13, color: 'var(--bx-text-3)' }}>atualiza enquanto você digita</span>
            </div>
            <div className="prm-previa-grid">
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="prm-rotulo">Prévia no e-mail</span>
                  <span className="prm-rotulo">600 px</span>
                </div>
                <iframe
                  title="Prévia do bloco no e-mail"
                  srcDoc={previaHtml}
                  sandbox="allow-same-origin"
                  onLoad={(e) => {
                    try {
                      const h = e.currentTarget.contentDocument?.body?.scrollHeight
                      if (h) setPreviaAltura(h + 8)
                    } catch {}
                  }}
                  style={{ width: '100%', height: previaAltura, border: '1px solid var(--bx-border)', borderRadius: 12, background: 'var(--bx-bg)' }}
                />
                <Ajuda>Botão de contorno, depois do botão principal do e-mail. Sem imagem, o título e o preço continuam como texto.</Ajuda>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="prm-rotulo">Prévia no site</span>
                  <span className="prm-rotulo">carta, set e Pokémon</span>
                </div>
                <MercadoLivre
                  url={(linkDefault?.url) || novaPrevia.url}
                  variante="card"
                  layout="grid"
                  gridMax={3}
                  titulo={linkDefault?.titulo}
                  subtitulo={linkDefault?.subtitulo}
                  produtos={[
                    { titulo: novaPrevia.titulo, preco: novaPrevia.preco, imagem: novaPrevia.imagem, url: novaPrevia.url },
                    ...vizinhasSite.map((p) => ({ titulo: p.titulo, preco: p.preco, imagem: p.imagem_url, url: p.url })),
                  ]}
                />
                <Ajuda>No site a grade sorteia até 6 produtos ativos da vitrine a cada visita. A prévia mostra a nova ao lado de duas que já estão no ar.</Ajuda>
              </div>
            </div>
          </div>
        )}
      </div>

      {abaInfo && aba === 'email' && !loading && (
        <p style={{ fontSize: 12, color: 'var(--bx-text-3)', margin: '16px 4px 0', lineHeight: 1.6 }}>
          Para conferir o e-mail inteiro com a Seleção Bynx, abra{' '}
          <a href="/api/admin/email-preview?tpl=base" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ac-1)' }}>
            a pré-visualização do layout
          </a>.
        </p>
      )}

      <style>{`
        .prm-page { padding: 24px 16px; }
        @media (min-width: 768px) { .prm-page { padding: 32px 24px; } }

        .prm-btn-principal {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 44px; padding: 0 20px; border-radius: 12px; border: 1px solid transparent;
          background: var(--ac-grad); color: var(--bx-brand-ink, #0a0a0a);
          font-size: 15px; font-weight: 800; font-family: inherit; cursor: pointer;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .prm-btn-principal:hover { transform: translateY(-2px); }
        .prm-btn-principal:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .prm-btn-sec {
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px;
          border-radius: 12px; border: 1px solid var(--bx-border-2); background: var(--bx-surface-2);
          color: var(--bx-text); font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .prm-btn-sec:hover { background: var(--bx-surface-3); }
        .prm-btn-texto {
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 8px;
          background: transparent; border: none; color: var(--ac-1); font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; margin-left: auto;
        }

        .prm-abas { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; scrollbar-width: none; }
        .prm-abas::-webkit-scrollbar { display: none; }
        .prm-aba {
          display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; min-height: 44px;
          padding: 0 14px; border-radius: 999px; border: 1px solid var(--bx-border);
          background: var(--bx-surface); color: var(--bx-text-2); font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
        }
        .prm-aba:hover { border-color: var(--bx-border-2); }
        .prm-aba.ativa { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.10); color: var(--bx-text); }
        .prm-aba-desc { font-size: 12px; font-weight: 500; color: var(--bx-text-3); }
        .prm-aba-n {
          min-width: 24px; height: 22px; padding: 0 7px; border-radius: 999px; display: inline-flex;
          align-items: center; justify-content: center; font-size: 12px; font-weight: 800;
          background: var(--bx-surface-2); color: var(--bx-text-2);
        }
        .prm-aba.ativa .prm-aba-n { background: var(--ac-grad); color: var(--bx-brand-ink, #0a0a0a); }
        @media (max-width: 767px) { .prm-aba-desc { display: none; } }

        .prm-card { background: var(--bx-surface); border: 1px solid var(--bx-border); border-radius: 12px; padding: 16px; }
        .prm-cab { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .prm-rotulo { font-size: 11px; font-weight: 700; color: var(--bx-text-3); text-transform: uppercase; letter-spacing: 0.07em; }

        .prm-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (min-width: 1100px) {
          .prm-grid.com-form { grid-template-columns: minmax(0, 1fr) 400px; }
          .prm-grid.com-form .prm-form { grid-column: 2; grid-row: 1 / span 2; position: sticky; top: 76px; max-height: calc(100vh - 96px); overflow-y: auto; }
          .prm-grid.com-form .prm-previa { grid-column: 1; }
        }

        .prm-item {
          background: var(--bx-surface); border: 1px solid var(--bx-border); border-radius: 12px;
          padding: 12px 14px; display: flex; align-items: center; gap: 12px;
          transition: border-color 0.15s ease, opacity 0.15s ease;
        }
        .prm-item:hover { border-color: var(--bx-border-2); }
        .prm-item.desligada { opacity: 0.55; }
        .prm-item-topo { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
        .prm-ordem { width: 20px; text-align: center; font-size: 14px; font-weight: 700; color: var(--bx-text-3); flex-shrink: 0; }
        /* Fundo branco = o fundo da propria foto do ML (nao e cor de UI). */
        .prm-thumb {
          width: 64px; height: 64px; border-radius: 10px; background: #fff; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .prm-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
        .prm-thumb.grande { width: 88px; height: 88px; }
        .prm-titulo { font-size: 15px; font-weight: 700; color: var(--bx-text); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .prm-link { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--bx-text-2); text-decoration: none; }
        .prm-link:hover { color: var(--bx-text); }
        .prm-preco { font-size: 17px; font-weight: 800; color: var(--bx-text); margin: 0; white-space: nowrap; }
        .prm-acoes { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .prm-so-mobile { display: none; }
        @media (max-width: 767px) {
          .prm-item { flex-direction: column; align-items: stretch; }
          .prm-item-topo { align-items: flex-start; }
          .prm-ordem { display: none; }
          .prm-titulo { white-space: normal; }
          .prm-so-mobile { display: block; }
          .prm-so-mobile.prm-preco { margin-top: 6px; }
          .prm-so-desktop { display: none; }
          .prm-acoes { border-top: 1px solid var(--bx-border); padding-top: 10px; }
        }

        .prm-icone {
          width: 44px; height: 44px; border-radius: 10px; border: 1px solid var(--bx-border);
          background: var(--bx-surface-2); color: var(--bx-text-2); display: inline-flex;
          align-items: center; justify-content: center; cursor: pointer; font-family: inherit;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .prm-icone:hover:not(:disabled) { color: var(--bx-text); border-color: var(--bx-border-2); }
        .prm-icone.ativo { border-color: var(--ac-1); color: var(--bx-text); }
        .prm-icone:disabled { opacity: 0.35; cursor: not-allowed; }

        .prm-switch {
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 4px;
          background: transparent; border: none; cursor: pointer; font-family: inherit;
          color: var(--bx-text-3); font-size: 13px;
        }
        .prm-switch:disabled { cursor: wait; }
        .prm-switch-trilho {
          width: 46px; height: 26px; border-radius: 999px; background: var(--bx-surface-3);
          border: 1px solid var(--bx-border-2); position: relative; transition: background 0.15s ease;
        }
        .prm-switch-bola {
          position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 999px;
          background: var(--bx-text); transition: transform 0.15s ease;
        }
        .prm-switch.ligado .prm-switch-trilho { background: var(--bx-green); border-color: transparent; }
        .prm-switch.ligado .prm-switch-bola { transform: translateX(20px); }

        .prm-menu {
          position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; width: 260px;
          background: var(--bx-bg-elev); border: 1px solid var(--bx-border-2); border-radius: 12px;
          padding: 6px; box-shadow: var(--bx-shadow);
        }
        .prm-menu-item {
          display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 10px;
          border-radius: 8px; border: none; background: transparent; cursor: pointer; font-family: inherit;
          transition: background 0.15s ease;
        }
        .prm-menu-item:hover:not(:disabled) { background: var(--bx-surface-2); }
        .prm-menu-item:disabled { opacity: 0.5; cursor: not-allowed; }

        .prm-form-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
        .prm-input {
          width: 100%; min-height: 48px; padding: 0 14px; border-radius: 10px;
          border: 1px solid var(--bx-border); background: var(--bx-surface-2); color: var(--bx-text);
          font-size: 16px; font-family: inherit; outline: none; transition: border-color 0.15s ease;
        }
        .prm-input:focus { border-color: var(--bx-border-2); }
        .prm-input.valido { border-color: var(--bx-green); }
        .prm-input.invalido { border-color: var(--bx-red); }

        .prm-check {
          position: relative; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 0 14px;
          border-radius: 12px; border: 1px solid var(--bx-border); background: var(--bx-surface-2);
          cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
        }
        .prm-check input { position: absolute; opacity: 0; pointer-events: none; }
        .prm-check.marcada { border-color: var(--ac-1); background: rgba(var(--ac-1-rgb), 0.08); }
        .prm-check.travada { cursor: default; }
        .prm-check-box {
          width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--bx-border-2);
          display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .prm-check.marcada .prm-check-box { background: var(--ac-grad); border-color: transparent; }
        .prm-check:has(input:focus-visible) { outline: 2px solid var(--ac-1); outline-offset: 2px; }

        .prm-previa-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
        @media (min-width: 900px) { .prm-previa-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }

        @media (prefers-reduced-motion: reduce) {
          .prm-btn-principal, .prm-btn-principal:hover, .prm-switch-bola, .prm-item { transition: none; transform: none; }
        }
      `}</style>
    </div>
  )
}

// ─── Auxiliares ──────────────────────────────────────────────────────────

function Aba({ ativa, onClick, nome, descricao, n }: { ativa: boolean; onClick: () => void; nome: string; descricao?: string; n: number }) {
  return (
    <button type="button" role="tab" aria-selected={ativa} className={`prm-aba${ativa ? ' ativa' : ''}`} onClick={onClick}>
      {nome}
      {descricao && <span className="prm-aba-desc">{descricao}</span>}
      <span className="prm-aba-n">{n}</span>
    </button>
  )
}

function Info({ rotulo, valor, apagado }: { rotulo: string; valor: string; apagado?: boolean }) {
  return (
    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
      <p className="prm-rotulo" style={{ margin: '0 0 4px' }}>{rotulo}</p>
      <p style={{ fontSize: 14, margin: 0, color: apagado ? 'var(--bx-text-3)' : 'var(--bx-text)', fontWeight: apagado ? 500 : 700, lineHeight: 1.5 }}>{valor}</p>
    </div>
  )
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 9px', borderRadius: 999, border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function BotaoIcone({ rotulo, onClick, disabled, ativo, children }: {
  rotulo: string; onClick: () => void; disabled?: boolean; ativo?: boolean; children: React.ReactNode
}) {
  return (
    <button type="button" className={`prm-icone${ativo ? ' ativo' : ''}`} onClick={onClick} disabled={disabled}
      aria-label={rotulo} title={rotulo}>
      {children}
    </button>
  )
}

function Interruptor({ ligado, onClick, disabled, rotulo, semTexto }: {
  ligado: boolean; onClick: () => void; disabled?: boolean; rotulo: string; semTexto?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo}
      className={`prm-switch${ligado ? ' ligado' : ''}`} onClick={onClick} disabled={disabled}>
      <span className="prm-switch-trilho"><span className="prm-switch-bola" /></span>
      {!semTexto && <span className="prm-so-mobile">{rotulo}</span>}
    </button>
  )
}

function Campo({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <span className="prm-rotulo" style={{ display: 'block', marginBottom: 6 }}>
        {rotulo}{obrigatorio && <span style={{ color: 'var(--ac-1)' }}> *</span>}
      </span>
      {children}
    </div>
  )
}

function Ajuda({ children, tom }: { children: React.ReactNode; tom?: 'aviso' }) {
  return (
    <p style={{ fontSize: 13, lineHeight: 1.5, margin: '6px 0 0', color: tom === 'aviso' ? 'var(--bx-amber)' : 'var(--bx-text-3)' }}>
      {children}
    </p>
  )
}

function Erro({ children, destaque }: { children: React.ReactNode; destaque?: boolean }) {
  return (
    <p role="alert" style={{
      fontSize: 13, lineHeight: 1.5, margin: '6px 0 0', color: 'var(--bx-red)',
      ...(destaque ? { border: '1px solid var(--bx-red)', borderRadius: 10, padding: '10px 12px' } : {}),
    }}>
      {children}
    </p>
  )
}

function Faixa({ tom, onFechar, children }: { tom: 'info' | 'erro'; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16, padding: '10px 6px 10px 14px',
      borderRadius: 12, background: 'var(--bx-surface)',
      border: `1px solid ${tom === 'erro' ? 'var(--bx-red)' : 'var(--bx-border-2)'}`,
    }}>
      <IconWarning size={16} color={tom === 'erro' ? 'var(--bx-red)' : 'var(--ac-1)'} style={{ flexShrink: 0, marginTop: 13 }} />
      <p style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: 'var(--bx-text-2)', margin: '12px 0' }}>{children}</p>
      <BotaoIcone rotulo="Fechar aviso" onClick={onFechar}><IconClose size={14} color="currentColor" /></BotaoIcone>
    </div>
  )
}
