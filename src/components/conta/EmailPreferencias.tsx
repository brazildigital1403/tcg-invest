'use client'

// Preferencias de e-mail (regua F0, card #391).
//
// Um componente, duas portas:
//   - Minha Conta (logado): sem `token`, fala com a API pelo Bearer.
//   - Link do rodape (sem login): com `token` = o mesmo do descadastro.
// Os dois escrevem pela mesma rota (/api/email/preferencias), com a mesma
// regra. Salva na hora, com update otimista e volta atras se falhar.
//
// ★ Estado EFETIVO, nao o cru: com o descadastro ligado nada sai, entao os
//   toggles aparecem desligados mesmo com a preferencia gravada como true.
//   Ligar um deles com o descadastro ativo religa SO aquele (zera os outros),
//   senao a pessoa ligaria "Novidades" e voltaria a receber tudo.

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import { IconBell } from '@/components/ui/Icons'

type Cat = 'colecao' | 'mercado' | 'novidades' | 'radar'
type Estado = {
  email: string | null
  marketingAceito: boolean
  optOut: boolean
  prefs: Record<Cat, boolean>
}

const CATEGORIAS: Array<{ id: Cat; titulo: string; texto: string; marketing: boolean }> = [
  { id: 'colecao', titulo: 'Sua conta e sua coleção', texto: 'Boas-vindas, fim do teste Pro, indicações e avisos sobre a sua loja.', marketing: false },
  { id: 'mercado', titulo: 'Mercado', texto: 'Movimentos de preço no mercado de cartas.', marketing: true },
  { id: 'novidades', titulo: 'Novidades da Bynx', texto: 'Funções novas e o que mudou na Bynx.', marketing: true },
  { id: 'radar', titulo: 'Radar de lançamentos', texto: 'Coleções novas e datas de lançamento.', marketing: true },
]

function Chave({ ligado }: { ligado: boolean }) {
  return (
    <span aria-hidden style={{
      width: 44, height: 26, borderRadius: 100, flexShrink: 0, position: 'relative',
      background: ligado ? 'var(--ac-grad)' : 'var(--bx-surface-3)',
      border: '1px solid var(--bx-border)', boxSizing: 'border-box',
      transition: 'background 0.2s ease',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: ligado ? 20 : 2,
        width: 20, height: 20, borderRadius: '50%', background: 'var(--bx-text)',
        transition: 'left 0.2s ease',
      }} />
    </span>
  )
}

function Linha({ titulo, texto, ligado, desabilitado, onClick }: {
  titulo: string; texto: string; ligado: boolean; desabilitado?: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desabilitado}
      onClick={onClick}
      style={{
        width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 0', background: 'transparent', border: 'none',
        borderTop: '1px solid var(--bx-border)', textAlign: 'left',
        cursor: desabilitado ? 'not-allowed' : 'pointer', opacity: desabilitado ? 0.45 : 1,
        fontFamily: 'inherit', color: 'var(--bx-text)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{titulo}</span>
        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.5, color: 'var(--bx-text-3)', marginTop: 2 }}>{texto}</span>
      </span>
      <Chave ligado={ligado} />
    </button>
  )
}

export default function EmailPreferencias({ token, embutido = false }: {
  /** Token do descadastro. Sem ele, usa a sessao (Minha Conta). */
  token?: string
  /** Em Minha Conta o titulo e o cartao vem de fora. */
  embutido?: boolean
}) {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const url = token ? `/api/email/preferencias?t=${encodeURIComponent(token)}` : '/api/email/preferencias'
  const chamar = (init?: RequestInit) => (token ? fetch(url, init) : authFetch(url, init))

  useEffect(() => {
    let vivo = true
    chamar()
      .then(async (r) => {
        if (!vivo) return
        if (!r.ok) { setErro(r.status === 401 || r.status === 404 ? 'Este link não é mais válido.' : 'Não foi possível carregar suas preferências.'); return }
        setEstado(await r.json())
      })
      .catch(() => { if (vivo) setErro('Não foi possível carregar suas preferências.') })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function salvar(corpo: Record<string, boolean>, otimista: Estado) {
    if (!estado || salvando) return
    const anterior = estado
    setEstado(otimista)
    setSalvando(true)
    setErro(null)
    try {
      const r = await chamar({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
      if (!r.ok) throw new Error(String(r.status))
      setEstado(await r.json())
    } catch {
      setEstado(anterior)
      setErro('Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvando(false)
    }
  }

  const efetivo = (c: Cat, marketing: boolean) =>
    !!estado && !estado.optOut && estado.prefs[c] && (!marketing || estado.marketingAceito)

  function alternarCategoria(c: Cat, marketing: boolean) {
    if (!estado) return
    const ligar = !efetivo(c, marketing)
    if (ligar && estado.optOut) {
      // Volta SO esta categoria; as outras ficam desligadas.
      const prefs = { colecao: false, mercado: false, novidades: false, radar: false, [c]: true } as Record<Cat, boolean>
      salvar({ ...prefs }, { ...estado, optOut: false, prefs })
      return
    }
    salvar({ [c]: ligar }, { ...estado, prefs: { ...estado.prefs, [c]: ligar } })
  }

  function alternarAceite() {
    if (!estado) return
    // Mesmo criterio do que aparece na tela: com descadastro ativo o aceite
    // aparece desligado, entao o clique sempre significa "ligar".
    const ligar = !(estado.marketingAceito && !estado.optOut)
    if (ligar && estado.optOut) {
      // Aceitou novidades com o descadastro ativo: volta o marketing, nao a conta.
      salvar({ marketingAceito: true, colecao: false }, { ...estado, optOut: false, marketingAceito: true, prefs: { ...estado.prefs, colecao: false } })
      return
    }
    salvar({ marketingAceito: ligar }, { ...estado, marketingAceito: ligar })
  }

  function sairDeTudo() {
    if (!estado) return
    salvar({ sairDeTudo: true }, { ...estado, optOut: true })
  }

  const titulo = (
    <p style={{
      fontSize: 13, fontWeight: 700, color: 'var(--bx-text-3)', textTransform: 'uppercase',
      letterSpacing: '0.08em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <IconBell size={13} color="currentColor" />E-mails
    </p>
  )

  const corpo = !estado ? (
    <p style={{ fontSize: 14, color: erro ? 'var(--bx-red)' : 'var(--bx-text-3)', margin: 0 }}>
      {erro ?? 'Carregando...'}
    </p>
  ) : (
    <>
      {estado.email && token && (
        <p style={{ fontSize: 14, color: 'var(--bx-text-2)', margin: '0 0 12px' }}>
          Preferências de <strong style={{ color: 'var(--bx-text)' }}>{estado.email}</strong>
        </p>
      )}

      {estado.optOut && (
        <p style={{
          fontSize: 14, lineHeight: 1.6, color: 'var(--bx-text-2)', margin: '0 0 12px',
          padding: '12px 14px', borderRadius: 12, background: 'var(--bx-surface-2)', border: '1px solid var(--bx-border)',
        }}>
          Você não recebe e-mails de relacionamento da Bynx agora. Ligue abaixo o que quiser voltar a receber.
        </p>
      )}

      <Linha
        titulo="Aceito receber novidades e ofertas"
        texto="Sem este aceite, a Bynx não manda e-mails de mercado, novidades e lançamentos."
        ligado={estado.marketingAceito && !estado.optOut}
        desabilitado={salvando}
        onClick={alternarAceite}
      />
      {CATEGORIAS.map((c) => (
        <Linha
          key={c.id}
          titulo={c.titulo}
          texto={c.marketing && !estado.marketingAceito ? 'Ligue o aceite acima para escolher este.' : c.texto}
          ligado={efetivo(c.id, c.marketing)}
          desabilitado={salvando || (c.marketing && !estado.marketingAceito)}
          onClick={() => alternarCategoria(c.id, c.marketing)}
        />
      ))}

      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--bx-text-3)', margin: '14px 0 0' }}>
        Recibos, pedidos e respostas do suporte continuam chegando, porque são sobre algo que você fez na conta.
      </p>

      {erro && <p style={{ fontSize: 14, color: 'var(--bx-red)', margin: '10px 0 0' }}>{erro}</p>}

      {!estado.optOut && (
        <button
          type="button"
          onClick={sairDeTudo}
          disabled={salvando}
          style={{
            marginTop: 14, minHeight: 44, padding: '0 16px', borderRadius: 10,
            background: 'transparent', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)',
            fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: salvando ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          Não quero receber nenhum destes
        </button>
      )}
    </>
  )

  if (embutido) return <>{titulo}{corpo}</>

  return (
    <div style={{
      background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 16,
      padding: '20px 20px 18px',
    }}>
      {titulo}
      {corpo}
    </div>
  )
}
