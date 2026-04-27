'use client'

import { CSSProperties, useState, useMemo, useRef } from 'react'
import { authFetch } from '@/lib/authFetch'
import { useAppModal } from '@/components/ui/useAppModal'
import { uploadFotoLoja, deletarFotoLoja } from '@/lib/uploadFoto'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface LojaFormData {
  id?: string
  slug?: string
  nome: string
  descricao: string
  cidade: string
  estado: string
  endereco: string
  tipo: 'fisica' | 'online' | 'ambas'
  especialidades: string[]
  whatsapp: string
  email: string
  website: string
  instagram: string
  facebook: string
  logo_url: string
  fotos: string[]
  plano?: 'basico' | 'pro' | 'premium'
  status?: 'pendente' | 'ativa' | 'suspensa' | 'inativa'
}

interface Props {
  userId: string
  initialData?: LojaFormData
  isEditMode?: boolean
  onSaved?: (data: LojaFormData) => void
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

const ESPECIALIDADES_OPCOES = [
  { value: 'pokemon', label: 'Pokémon' },
  { value: 'magic', label: 'Magic' },
  { value: 'yugioh', label: 'Yu-Gi-Oh!' },
  { value: 'lorcana', label: 'Lorcana' },
  { value: 'digimon', label: 'Digimon' },
  { value: 'outros', label: 'Outros' },
]

const TIPO_OPCOES: Array<{ value: 'fisica' | 'online' | 'ambas'; label: string }> = [
  { value: 'fisica', label: 'Física' },
  { value: 'online', label: 'Online' },
  { value: 'ambas', label: 'Física + Online' },
]

// ─── Limites por plano ────────────────────────────────────────────────────────

const LIMITES = {
  basico:  { fotos: 0,  descricao: 160,  especialidades: 1 },
  pro:     { fotos: 5,  descricao: 9999, especialidades: 99 },
  premium: { fotos: 10, descricao: 9999, especialidades: 99 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

const LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 5,
  display: 'block',
}

const INPUT: CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '11px 14px',
  color: '#f0f0f0',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

const TEXTAREA: CSSProperties = {
  ...INPUT,
  minHeight: 100,
  resize: 'vertical',
  lineHeight: 1.5,
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FormLoja({ userId: _userId, initialData, isEditMode = false, onSaved }: Props) {
  const { showAlert } = useAppModal()

  const plano = initialData?.plano || 'basico'
  const limites = LIMITES[plano]

  const [nome,           setNome]           = useState(initialData?.nome           || '')
  const [slugCustom,     setSlugCustom]     = useState(initialData?.slug           || '')
  const [descricao,      setDescricao]      = useState(initialData?.descricao      || '')
  const [cidade,         setCidade]         = useState(initialData?.cidade         || '')
  const [estado,         setEstado]         = useState(initialData?.estado         || '')
  const [endereco,       setEndereco]       = useState(initialData?.endereco       || '')
  const [tipo,           setTipo]           = useState<'fisica' | 'online' | 'ambas'>(initialData?.tipo || 'fisica')
  const [especialidades, setEspecialidades] = useState<string[]>(initialData?.especialidades || [])
  const [whatsapp,       setWhatsapp]       = useState(initialData?.whatsapp       || '')
  const [email,          setEmail]          = useState(initialData?.email          || '')
  const [website,        setWebsite]        = useState(initialData?.website        || '')
  const [instagram,      setInstagram]      = useState(initialData?.instagram      || '')
  const [facebook,       setFacebook]       = useState(initialData?.facebook       || '')
  const [logoUrl,        setLogoUrl]        = useState(initialData?.logo_url       || '')

  // Fotos — agora é array direto (controlado pelo upload)
  const [fotos, setFotos] = useState<string[]>(initialData?.fotos || [])
  const [uploadingFotos, setUploadingFotos] = useState(0)
  const [deletandoUrl, setDeletandoUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving]     = useState(false)
  const [slugError, setSlugError] = useState('')

  const slugFinal = useMemo(() => {
    if (slugCustom.trim()) return slugify(slugCustom)
    return slugify(nome)
  }, [nome, slugCustom])

  function toggleEspecialidade(valor: string) {
    if (especialidades.includes(valor)) {
      setEspecialidades(prev => prev.filter(e => e !== valor))
    } else {
      if (especialidades.length >= limites.especialidades) {
        showAlert(
          plano === 'basico'
            ? 'O plano Básico permite apenas 1 especialidade. Faça upgrade para Pro para adicionar mais.'
            : 'Limite de especialidades atingido.',
          'warning'
        )
        return
      }
      setEspecialidades(prev => [...prev, valor])
    }
  }

  // ─── Upload de fotos ───────────────────────────────────────
  // Só funciona em modo edit (precisa ter loja id pra subir)
  async function handleAddFotos(files: FileList) {
    if (!isEditMode || !initialData?.id) {
      showAlert('Salve a loja primeiro para adicionar fotos.', 'warning')
      return
    }

    const lojaId = initialData.id
    const arquivos = Array.from(files)
    if (arquivos.length === 0) return

    const slots = limites.fotos - fotos.length - uploadingFotos
    if (slots <= 0) {
      showAlert(`Limite de ${limites.fotos} fotos atingido.`, 'warning')
      return
    }
    const aSubir = arquivos.slice(0, slots)
    if (arquivos.length > slots) {
      showAlert(`Apenas ${slots} foto(s) cabem. As demais foram ignoradas.`, 'info')
    }

    setUploadingFotos(prev => prev + aSubir.length)
    const promises = aSubir.map(async file => {
      try {
        const result = await uploadFotoLoja(lojaId, file)
        // Atualiza com a lista mais recente vinda do servidor (source of truth)
        setFotos(result.fotos)
      } catch (err: any) {
        console.error('[FormLoja] upload foto falhou', err)
        showAlert(err?.message || 'Erro ao enviar foto.', 'error')
      } finally {
        setUploadingFotos(prev => Math.max(0, prev - 1))
      }
    })
    await Promise.all(promises)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleRemoverFoto(url: string) {
    if (!initialData?.id) return
    setDeletandoUrl(url)
    try {
      const novasFotos = await deletarFotoLoja(initialData.id, url)
      setFotos(novasFotos)
    } catch (err: any) {
      console.error('[FormLoja] delete foto falhou', err)
      showAlert(err?.message || 'Erro ao remover foto.', 'error')
    } finally {
      setDeletandoUrl(null)
    }
  }

  function validar(): string | null {
    if (!nome.trim())                    return 'O nome da loja é obrigatório.'
    if (nome.trim().length < 3)          return 'O nome precisa ter pelo menos 3 caracteres.'
    if (!slugFinal || slugFinal.length < 3) return 'O identificador da URL é inválido.'
    if (!cidade.trim())                  return 'A cidade é obrigatória.'
    if (!estado.trim())                  return 'O estado é obrigatório.'
    if (!tipo)                           return 'Selecione o tipo de loja.'
    if (especialidades.length === 0)     return 'Selecione pelo menos uma especialidade.'
    if ((tipo === 'fisica' || tipo === 'ambas') && !endereco.trim())
      return 'Endereço é obrigatório para lojas físicas.'
    if (descricao.length > limites.descricao)
      return `A descrição no plano atual tem limite de ${limites.descricao} caracteres.`
    return null
  }

  // Monta payload sem o campo `fotos` — gerenciado pelos endpoints dedicados
  function montarPayload() {
    return {
      slug: slugFinal,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      cidade: cidade.trim(),
      estado: estado.trim().toUpperCase(),
      endereco: endereco.trim() || null,
      tipo,
      especialidades,
      whatsapp: whatsapp.trim() || null,
      website: website.trim() || null,
      instagram: instagram.trim() || null,
      facebook: facebook.trim() || null,
      logo_url: logoUrl.trim() || null,
    }
  }

  function handleApiError(data: any, res: Response, contexto: 'criar' | 'salvar'): void {
    const msg = data?.error || `Erro ao ${contexto} loja. Tente novamente.`

    if (res.status === 409 && /slug/i.test(msg)) {
      setSlugError('Este identificador já está em uso. Escolha outro.')
      return
    }

    showAlert(msg, 'error')
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    setSlugError('')

    const erro = validar()
    if (erro) {
      showAlert(erro, 'warning')
      return
    }

    setSaving(true)

    try {
      const payload = montarPayload()

      if (isEditMode && initialData?.id) {
        const res = await authFetch(`/api/lojas/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          handleApiError(data, res, 'salvar')
          return
        }

        showAlert('Loja atualizada com sucesso!', 'success')
        onSaved?.({ ...initialData, ...payload, fotos, id: data?.loja?.id || initialData.id } as LojaFormData)

      } else {
        const res = await authFetch('/api/lojas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          handleApiError(data, res, 'criar')
          return
        }

        showAlert(
          'Loja cadastrada! Sua loja está em análise pelo time do Bynx. Assim que aprovada, ela aparecerá no Guia de Lojas.',
          'success'
        )
        if (data?.loja) onSaved?.(data.loja as LojaFormData)
      }

    } catch (err: any) {
      console.error('[FormLoja] handleSave erro inesperado', err)
      showAlert('Erro inesperado ao salvar. Verifique sua conexão e tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Cálculos derivados pra UI das fotos
  const totalFotosNoMomento = fotos.length + uploadingFotos
  const slotsRestantes = Math.max(0, limites.fotos - totalFotosNoMomento)
  const podeSubirMais = isEditMode && !!initialData?.id && slotsRestantes > 0

  return (
    <form onSubmit={handleSave} style={S.form}>
      {/* ─── SEÇÃO: Identidade ─────────────────────────────────── */}
      <fieldset style={S.fieldset}>
        <legend style={S.legend}>Identidade</legend>

        <div style={S.grid2}>
          <div>
            <label style={LABEL}>Nome da loja *</label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Mestre dos Baralhos"
              style={INPUT}
              maxLength={100}
            />
          </div>

          <div>
            <label style={LABEL}>URL da página</label>
            <div style={S.slugWrap}>
              <span style={S.slugPrefix}>bynx.gg/lojas/</span>
              <input
                type="text"
                value={slugCustom || slugify(nome)}
                onChange={e => setSlugCustom(e.target.value)}
                placeholder="mestre-dos-baralhos"
                style={{ ...INPUT, paddingLeft: 4, borderColor: slugError ? 'rgba(239,68,68,0.4)' : undefined }}
                maxLength={60}
              />
            </div>
            {slugError && <p style={S.errorText}>{slugError}</p>}
            {!slugError && slugFinal && (
              <p style={S.hintText}>Sua loja: bynx.gg/lojas/<strong style={{ color: '#f59e0b' }}>{slugFinal}</strong></p>
            )}
          </div>
        </div>

        <div>
          <label style={LABEL}>Descrição</label>
          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Fale um pouco sobre sua loja, o que vocês vendem, há quanto tempo estão no mercado..."
            style={TEXTAREA}
            maxLength={limites.descricao}
          />
          <p style={S.hintText}>
            {descricao.length}/{limites.descricao === 9999 ? '∞' : limites.descricao} caracteres
            {plano === 'basico' && ' · Plano Básico: limite de 160 caracteres.'}
          </p>
        </div>

        <div>
          <label style={LABEL}>URL do logo</label>
          <input
            type="url"
            value={logoUrl}
            onChange={e => setLogoUrl(e.target.value)}
            placeholder="https://..."
            style={INPUT}
          />
          <p style={S.hintText}>Cole a URL de uma imagem quadrada (upload direto em breve).</p>
        </div>
      </fieldset>

      {/* ─── SEÇÃO: Localização ──────────────────────────────── */}
      <fieldset style={S.fieldset}>
        <legend style={S.legend}>Localização</legend>

        <div>
          <label style={LABEL}>Tipo de loja *</label>
          <div style={S.chipsRow}>
            {TIPO_OPCOES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                style={{ ...S.chip, ...(tipo === t.value ? S.chipActive : {}) }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={S.grid2}>
          <div>
            <label style={LABEL}>Cidade *</label>
            <input
              type="text"
              value={cidade}
              onChange={e => setCidade(e.target.value)}
              placeholder="Ex: São Paulo"
              style={INPUT}
            />
          </div>

          <div>
            <label style={LABEL}>Estado *</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value)}
              style={{ ...INPUT, cursor: 'pointer', appearance: 'none' }}
            >
              <option value="">Selecione</option>
              {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>

        {(tipo === 'fisica' || tipo === 'ambas') && (
          <div>
            <label style={LABEL}>Endereço *</label>
            <input
              type="text"
              value={endereco}
              onChange={e => setEndereco(e.target.value)}
              placeholder="Ex: Rua Augusta, 1200 — Consolação"
              style={INPUT}
            />
            <p style={S.hintText}>Aparecerá na página junto com um link para o Google Maps.</p>
          </div>
        )}
      </fieldset>

      {/* ─── SEÇÃO: Especialidades ────────────────────────────── */}
      <fieldset style={S.fieldset}>
        <legend style={S.legend}>Especialidades</legend>

        <div>
          <label style={LABEL}>Quais jogos sua loja trabalha? *</label>
          <div style={S.chipsRow}>
            {ESPECIALIDADES_OPCOES.map(esp => (
              <button
                key={esp.value}
                type="button"
                onClick={() => toggleEspecialidade(esp.value)}
                style={{ ...S.chip, ...(especialidades.includes(esp.value) ? S.chipActive : {}) }}
              >
                {esp.label}
              </button>
            ))}
          </div>
          <p style={S.hintText}>
            {especialidades.length}/{limites.especialidades === 99 ? '∞' : limites.especialidades} selecionadas
            {plano === 'basico' && ' · Plano Básico: limite de 1 jogo.'}
          </p>
        </div>
      </fieldset>

      {/* ─── SEÇÃO: Contatos ─────────────────────────────────── */}
      <fieldset style={S.fieldset}>
        <legend style={S.legend}>Contatos</legend>

        <div style={S.grid2}>
          <div>
            <label style={LABEL}>WhatsApp</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-8888"
              style={INPUT}
            />
          </div>
          <div>
            <label style={LABEL}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="contato@loja.com.br"
              style={INPUT}
            />
          </div>
        </div>
      </fieldset>

      {/* ─── SEÇÃO: Redes sociais (Pro+) ─────────────────────── */}
      {(plano === 'pro' || plano === 'premium') ? (
        <fieldset style={S.fieldset}>
          <legend style={S.legend}>Redes sociais e website</legend>

          <div style={S.grid2}>
            <div>
              <label style={LABEL}>Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                placeholder="instagram.com/sualoja"
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>Facebook</label>
              <input
                type="text"
                value={facebook}
                onChange={e => setFacebook(e.target.value)}
                placeholder="facebook.com/sualoja"
                style={INPUT}
              />
            </div>
          </div>

          <div>
            <label style={LABEL}>Website</label>
            <input
              type="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://sualoja.com.br"
              style={INPUT}
            />
          </div>
        </fieldset>
      ) : (
        <fieldset style={S.fieldsetLocked}>
          <legend style={S.legend}>Redes sociais e website</legend>
          <p style={S.lockedText}>
            🔒 Recurso disponível nos planos <strong>Pro</strong> e <strong>Premium</strong>.
            Mostre seu Instagram, Facebook e site na página da sua loja.
          </p>
        </fieldset>
      )}

      {/* ─── SEÇÃO: Fotos (Pro+) — UPLOAD REAL ─────────────────────── */}
      {(plano === 'pro' || plano === 'premium') ? (
        <fieldset style={S.fieldset}>
          <legend style={S.legend}>Fotos da loja</legend>

          <div>
            <label style={LABEL}>
              Galeria · {fotos.length}/{limites.fotos} fotos
              {uploadingFotos > 0 && ` · enviando ${uploadingFotos}...`}
            </label>

            {/* Grid de thumbs */}
            <div style={S.fotosGrid}>
              {fotos.map(url => (
                <div key={url} style={S.fotoThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Foto da loja" style={S.fotoImg} />
                  <button
                    type="button"
                    onClick={() => handleRemoverFoto(url)}
                    disabled={deletandoUrl === url}
                    style={{
                      ...S.fotoDeleteBtn,
                      ...(deletandoUrl === url ? { opacity: 0.5, cursor: 'wait' } : {}),
                    }}
                    aria-label="Remover foto"
                    title="Remover foto"
                  >
                    {deletandoUrl === url ? '...' : '×'}
                  </button>
                </div>
              ))}

              {/* Placeholders enquanto sobe */}
              {Array.from({ length: uploadingFotos }).map((_, i) => (
                <div key={`up-${i}`} style={{ ...S.fotoThumb, ...S.fotoUploading }}>
                  <span style={S.fotoUploadingText}>Enviando...</span>
                </div>
              ))}

              {/* Botão de adicionar (se há slots) */}
              {podeSubirMais && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={S.fotoAddBtn}
                >
                  <span style={{ fontSize: 32, lineHeight: 1, color: 'rgba(245,158,11,0.7)' }}>+</span>
                  <span style={S.fotoAddBtnLabel}>Adicionar foto</span>
                </button>
              )}
            </div>

            {/* Input file invisível */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={e => e.target.files && handleAddFotos(e.target.files)}
              style={{ display: 'none' }}
            />

            <p style={S.hintText}>
              {!isEditMode || !initialData?.id ? (
                <>Salve a loja primeiro para enviar fotos.</>
              ) : fotos.length >= limites.fotos ? (
                <>Limite de {limites.fotos} fotos atingido no plano {plano === 'premium' ? 'Premium' : 'Pro'}.</>
              ) : (
                <>JPG, PNG ou WebP · até 5MB cada · serão otimizadas automaticamente.</>
              )}
            </p>
          </div>
        </fieldset>
      ) : (
        <fieldset style={S.fieldsetLocked}>
          <legend style={S.legend}>Fotos da loja</legend>
          <p style={S.lockedText}>
            🔒 Recurso disponível nos planos <strong>Pro</strong> (5 fotos) e <strong>Premium</strong> (10 fotos).
            Mostre o ambiente da sua loja e deixe os colecionadores ansiosos pra te visitar.
          </p>
        </fieldset>
      )}

      {/* ─── Botão Salvar ─────────────────────────────────────── */}
      <div style={S.actions}>
        <button
          type="submit"
          disabled={saving}
          style={{ ...S.btnPrimary, ...(saving ? S.btnDisabled : {}) }}
        >
          {saving ? 'Salvando…' : (isEditMode ? 'Salvar alterações' : 'Cadastrar loja')}
        </button>
      </div>
    </form>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  fieldset: {
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  fieldsetLocked: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px dashed rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 20,
  },
  legend: {
    fontSize: 12,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    padding: '0 8px',
  },
  lockedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.6,
    margin: 0,
  },

  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },

  slugWrap: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingLeft: 14,
  },
  slugPrefix: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
  },

  hintText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    margin: '6px 0 0',
    lineHeight: 1.4,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    margin: '6px 0 0',
    lineHeight: 1.4,
  },

  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 14px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.04)',
    color: 'rgba(255,255,255,0.65)',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.12s ease',
  },
  chipActive: {
    background: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.35)',
  },

  // ─── Galeria de fotos ───
  fotosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 10,
    marginTop: 4,
  },
  fotoThumb: {
    position: 'relative',
    aspectRatio: '4 / 3',
    borderRadius: 10,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  fotoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  fotoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.7)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#f0f0f0',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
    padding: 0,
  },
  fotoUploading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(245,158,11,0.06)',
    border: '1px dashed rgba(245,158,11,0.3)',
  },
  fotoUploadingText: {
    fontSize: 11,
    color: 'rgba(245,158,11,0.8)',
    fontWeight: 600,
  },
  fotoAddBtn: {
    aspectRatio: '4 / 3',
    borderRadius: 10,
    background: 'rgba(245,158,11,0.04)',
    border: '1px dashed rgba(245,158,11,0.3)',
    color: 'rgba(245,158,11,0.85)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: 'inherit',
    transition: 'all 0.12s ease',
  },
  fotoAddBtnLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
  },

  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    border: 'none',
    color: '#000',
    fontSize: 14,
    fontWeight: 700,
    padding: '12px 28px',
    borderRadius: 10,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}
