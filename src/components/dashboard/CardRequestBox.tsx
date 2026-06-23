'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAppModal } from '@/components/ui/useAppModal'

interface Props {
  userId: string | null
  termo: string
  resultados: any[]
  isSearching: boolean
  cartaSelecionada: any | null
}

const BRAND = 'linear-gradient(135deg, #f59e0b, #ef4444)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const GOLD = '#f59e0b'

const ERRO_TIPOS = [
  { value: 'nome', label: 'Nome' },
  { value: 'valor', label: 'Valor' },
  { value: 'imagem', label: 'Imagem' },
  { value: 'outro', label: 'Outro' },
]

// Extrai numero/total do nome (ex "Mega Absol ex (086/132)") -> "086/132"
function numFromName(name?: string): string {
  if (!name) return ''
  const m = String(name).match(/\((\d+)\/(\d+)\)/)
  return m ? `${m[1]}/${m[2]}` : ''
}

export default function CardRequestBox({ userId, termo, resultados, isSearching, cartaSelecionada }: Props) {
  const { showAlert } = useAppModal()
  const [tipo, setTipo] = useState<'faltando' | 'erro'>('faltando')
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  const [colecao, setColecao] = useState('')
  const [erroTipo, setErroTipo] = useState('valor')
  const [descricao, setDescricao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const autoLogged = useRef<Set<string>>(new Set())
  const lastSearchedRef = useRef<string>('')

  const termoTrim = (termo || '').trim()

  // So loga auto quando o termo PARECE um nome (>=3 letras seguidas).
  // Mata o ruido de digitacao de numero ("199/", "135/13", "021/165", "0/086").
  const pareceNome = /[a-zA-ZÀ-ÿ]{3,}/.test(termoTrim)

  // Marca qual termo foi EFETIVAMENTE buscado (quando a busca dispara).
  // Evita logar durante a janela de debounce (antes da busca rodar).
  useEffect(() => {
    if (isSearching) lastSearchedRef.current = termoTrim
  }, [isSearching, termoTrim])

  // So considera "sem resultado" quando a busca de fato rodou pra ESTE termo
  // exato e voltou vazia (nao durante o debounce).
  const semResultado =
    !isSearching &&
    termoTrim.length >= 3 &&
    resultados.length === 0 &&
    lastSearchedRef.current === termoTrim

  // Quando o usuario clica numa carta, sugere modo "erro"
  useEffect(() => {
    if (cartaSelecionada) setTipo('erro')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartaSelecionada?.id])

  // Pre-preenche "faltando" com o termo buscado
  useEffect(() => {
    if (tipo === 'faltando' && termoTrim && !nome) setNome(termoTrim)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termoTrim, tipo])

  // Log passivo de busca-zero (origem='auto'), 1x por termo por sessao.
  // So loga se o termo parece nome (gate anti-ruido de numero) E o usuario
  // PAROU de digitar por ~2,5s naquele termo sem resultado. Isso mata o ruido
  // de digitacao incremental: "Cha" -> "Chari" -> "Chariz" nunca logam (o
  // cleanup limpa o timer a cada tecla); so o termo final, quando assenta, loga.
  useEffect(() => {
    if (!userId || !semResultado || !pareceNome) return
    const key = termoTrim.toLowerCase()
    if (autoLogged.current.has(key)) return
    const t = setTimeout(() => {
      autoLogged.current.add(key)
      supabase
        .from('card_requests')
        .insert({ tipo: 'faltando', nome: termoTrim, termo_busca: termoTrim, origem: 'auto', user_id: userId })
        .then(() => {}, () => {})
    }, 2500)
    return () => clearTimeout(t)
  }, [semResultado, pareceNome, termoTrim, userId])

  async function handleSubmit() {
    if (!userId) { await showAlert('Faça login para reportar.', 'warning'); return }
    if (tipo === 'faltando' && !nome.trim() && !numero.trim()) {
      await showAlert('Informe ao menos o nome ou o número da carta.', 'warning'); return
    }
    if (tipo === 'erro' && !cartaSelecionada && !nome.trim()) {
      await showAlert('Clique na carta com erro acima, ou informe o nome.', 'warning'); return
    }

    setEnviando(true)
    const payload: any = {
      tipo,
      origem: 'form',
      user_id: userId,
      termo_busca: termoTrim || null,
      descricao: descricao.trim() || null,
    }
    if (tipo === 'faltando') {
      payload.nome = nome.trim() || null
      payload.numero = numero.trim() || null
      payload.colecao = colecao.trim() || null
    } else {
      payload.erro_tipo = erroTipo
      if (cartaSelecionada) {
        payload.card_id = cartaSelecionada.id
        payload.nome = cartaSelecionada.name || null
        payload.numero = numFromName(cartaSelecionada.name) || (cartaSelecionada.number ? String(cartaSelecionada.number) : null)
        payload.colecao = cartaSelecionada.set_name || null
      } else {
        payload.nome = nome.trim() || null
        payload.numero = numero.trim() || null
      }
    }

    const { error } = await supabase.from('card_requests').insert(payload)
    setEnviando(false)
    if (error) { await showAlert('Não foi possível enviar. Tente novamente.', 'error'); return }

    setEnviado(true)
    setDescricao(''); setNumero(''); setColecao('')
  }

  const label: CSSProperties = { fontSize: 10, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, margin: '10px 0 5px' }
  const inputStyle: CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 11px', color: '#f0f0f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }

  if (enviado) {
    return (
      <div style={{ margin: '18px 4px 8px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 14, padding: '18px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', margin: 0 }}>Recebido! Obrigado por avisar.</p>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '6px 0 0' }}>Vamos revisar e avisamos por e-mail quando a carta for adicionada ou corrigida.</p>
        <button onClick={() => setEnviado(false)} style={{ marginTop: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: TEXT_MUTED, fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Reportar outra</button>
      </div>
    )
  }

  return (
    <div style={{ margin: '18px 4px 8px', background: 'rgba(245,158,11,0.04)', border: `1px solid ${semResultado ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 14, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', margin: '0 0 3px' }}>
        {semResultado ? `Não encontramos "${termoTrim}" 🔎` : 'Encontrou algo errado — ou não encontrou? 🛠️'}
      </p>
      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 12px', lineHeight: 1.5 }}>
        {semResultado ? 'Avise-nos e nós catalogamos para você.' : 'Reporte uma carta faltando ou um erro (nome, valor, imagem) em uma carta que existe.'}
      </p>

      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: 3, marginBottom: 4 }}>
        {(['faltando', 'erro'] as const).map(t => (
          <button key={t} onClick={() => setTipo(t)} style={{ flex: 1, textAlign: 'center', fontSize: 12, padding: 7, borderRadius: 6, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: tipo === t ? BRAND : 'transparent', color: tipo === t ? '#000' : TEXT_MUTED }}>
            {t === 'faltando' ? 'Carta faltando' : 'Erro numa carta'}
          </button>
        ))}
      </div>

      {tipo === 'faltando' ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 2 }}>
              <p style={label}>Nome</p>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Mega Absol ex" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={label}>Número</p>
              <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="086/132" style={inputStyle} />
            </div>
          </div>
          <p style={label}>Coleção (opcional)</p>
          <input value={colecao} onChange={e => setColecao(e.target.value)} placeholder="Ex: Megaevolução" style={inputStyle} />
        </>
      ) : (
        <>
          <p style={label}>Qual carta?</p>
          {cartaSelecionada ? (
            <div style={{ ...inputStyle, borderColor: 'rgba(245,158,11,0.5)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: GOLD, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cartaSelecionada.name}{cartaSelecionada.set_name ? ` · ${cartaSelecionada.set_name}` : ''}
              </span>
            </div>
          ) : (
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Clique na carta acima, ou digite o nome" style={inputStyle} />
          )}
          <p style={label}>O que está errado?</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ERRO_TIPOS.map(et => {
              const on = erroTipo === et.value
              return (
                <button key={et.value} onClick={() => setErroTipo(et.value)} style={{ fontSize: 12, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`, color: on ? GOLD : TEXT_MUTED, fontWeight: 600 }}>
                  {et.label}
                </button>
              )
            })}
          </div>
        </>
      )}

      <p style={label}>{tipo === 'erro' ? 'Descreva o erro' : 'Observação (opcional)'}</p>
      <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder={tipo === 'erro' ? 'Ex: o preço está bem acima do mercado real...' : 'Algum detalhe que ajude a encontrar a carta'} style={{ ...inputStyle, resize: 'vertical', minHeight: 44 }} />

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 }}>
        {!userId && <span style={{ fontSize: 11, color: TEXT_MUTED }}>Faça login para reportar</span>}
        <button onClick={handleSubmit} disabled={enviando || !userId} style={{ marginLeft: 'auto', background: userId ? BRAND : 'rgba(255,255,255,0.06)', border: 'none', color: userId ? '#000' : TEXT_MUTED, fontWeight: 700, fontSize: 13, padding: '9px 18px', borderRadius: 9, cursor: userId ? 'pointer' : 'default', opacity: enviando ? 0.7 : 1, fontFamily: 'inherit' }}>
          {enviando ? 'Enviando...' : 'Reportar'}
        </button>
      </div>
    </div>
  )
}
