'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import AppLayout from '@/components/ui/AppLayout'
import PageHeader, { INICIO } from '@/components/ui/PageHeader'
import { fmtBRL } from '@/lib/comissao'
import { IconBox, IconCheck, IconArrowRight, IconMarketplace, IconStar } from '@/components/ui/Icons'

/**
 * /vendas — as vendas de quem vende SEM ter loja.
 *
 * ★ POR QUE UMA TELA NOVA E NAO O PAINEL DA LOJA (01/10/2026, F5 do epico de
 * recebimento). O painel e `/minha-loja/[id]/pedidos`, e a rota dele filtra
 * `loja_id = [id]`. Pedido de pessoa fisica tem `loja_id` NULO: nao e questao
 * de permissao, e que nao existe id para pôr na URL. Sem esta tela, quem
 * vendesse sem loja nao tinha como informar rastreio -- e o comprador nunca
 * recebia o aviso de envio.
 *
 * ★ ACENTO AMBAR, NAO AZUL-ROXO. O azul-roxo e da casca `/minha-loja`, e esta
 * tela vive fora dela: herda o ambar do app, como o `/compras`. Quem vende sem
 * loja nao e lojista, e a cor diz isso antes do texto.
 *
 * ★ A LEITURA PASSA POR ROTA, nao direto pelo Supabase como o `/compras` faz.
 * Dois motivos: as ACOES (enviar, cancelar) precisam de service_role de
 * qualquer jeito, e o nome do comprador sai de `public_users` no servidor --
 * buscar aqui exigiria uma segunda consulta do navegador para cada pedido.
 */

type Venda = {
  id: string
  numero: number
  status: string
  item_nome: string
  item_imagem: string | null
  total_comprador_cents: number
  liquido_loja_cents: number
  repasse_prazo: number
  rastreio: string | null
  endereco: Record<string, unknown> | null
  created_at: string
  enviado_em: string | null
  entregue_em: string | null
  cancelado_em: string | null
  comprador_nome: string
}

function fmtDia(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** O endereco vem como jsonb do checkout. Monta a linha que quem posta precisa. */
function linhaEndereco(e: Record<string, unknown> | null): string | null {
  if (!e || typeof e !== 'object') return null
  const s = (k: string) => (typeof e[k] === 'string' ? (e[k] as string).trim() : '')
  const rua = [s('logradouro') || s('rua') || s('line1'), s('numero'), s('complemento')].filter(Boolean).join(', ')
  const cidade = [s('bairro'), [s('cidade'), s('uf') || s('estado')].filter(Boolean).join(', ')].filter(Boolean).join(' — ')
  const cep = s('cep')
  const partes = [rua, cidade, cep].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<Venda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [rastreios, setRastreios] = useState<Record<string, string>>({})
  const [agindo, setAgindo] = useState<string | null>(null)
  const [cancelAberto, setCancelAberto] = useState<string | null>(null)
  const [motivos, setMotivos] = useState<Record<string, string>>({})

  const token = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const carregar = useCallback(async () => {
    setErro(null)
    const t = await token()
    if (!t) { setCarregando(false); setErro('Entre na sua conta para ver suas vendas.'); return }
    try {
      const r = await fetch('/api/vendas', { headers: { Authorization: `Bearer ${t}` } })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Erro ao carregar.')
      setVendas(j.vendas || [])
    } catch (e) {
      setErro((e as Error)?.message || 'Erro ao carregar suas vendas.')
    } finally {
      setCarregando(false)
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function agir(v: Venda, acao: 'enviar' | 'cancelar') {
    const t = await token()
    if (!t) { setErro('Sua sessão expirou. Entre de novo.'); return }
    setAgindo(v.id)
    setErro(null)
    try {
      const corpo: Record<string, unknown> = { pedido_id: v.id, acao }
      if (acao === 'enviar') corpo.rastreio = (rastreios[v.id] || '').trim()
      else corpo.motivo = (motivos[v.id] || '').trim() || null

      const r = await fetch('/api/vendas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(corpo),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || 'Não foi possível concluir.')
      setCancelAberto(null)
      await carregar()
    } catch (e) {
      setErro((e as Error)?.message || 'Não foi possível concluir.')
    } finally {
      setAgindo(null)
    }
  }

  const aEnviar = vendas.filter(v => v.status === 'pago').length
  const emTransito = vendas.filter(v => v.status === 'enviado').length
  const recebido = vendas
    .filter(v => v.status === 'entregue')
    .reduce((acc, v) => acc + (v.liquido_loja_cents || 0), 0)

  return (
    <AppLayout>
      <div style={S.wrap}>
        <PageHeader
          trilha={[INICIO, { name: 'Vendas', href: '/vendas' }]}
          titulo="Minhas Vendas"
          descricao="As cartas que você vendeu pela Bynx. O dinheiro cai direto na sua conta"
          stat={
            vendas.length > 0 ? (
              <div style={S.resumo}>
                {aEnviar > 0 && <div style={S.chip}><span style={{ ...S.chipV, color: 'var(--ac-1)' }}>{aEnviar}</span><span style={S.chipL}>a enviar</span></div>}
                {emTransito > 0 && <div style={S.chip}><span style={S.chipV}>{emTransito}</span><span style={S.chipL}>em trânsito</span></div>}
                {recebido > 0 && <div style={S.chip}><span style={{ ...S.chipV, color: 'var(--bx-green)' }}>{fmtBRL(recebido)}</span><span style={S.chipL}>recebido</span></div>}
              </div>
            ) : undefined
          }
        />

        {erro && <div role="alert" style={S.erro}>{erro}</div>}

        {carregando ? (
          <div style={S.vazio}>Carregando…</div>
        ) : vendas.length === 0 ? (
          <div style={S.vazio}>
            <IconMarketplace size={30} color="rgba(255,255,255,0.22)" strokeWidth={1.4} />
            <h3 style={S.vazioT}>Você ainda não vendeu nada por aqui</h3>
            <p style={S.vazioP}>
              Quando alguém comprar um dos seus anúncios, o pedido aparece nesta tela com o
              endereço de entrega e o campo de rastreio.
            </p>
            <Link href="/marketplace" style={S.btnGhostAc}>Ver meus anúncios</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vendas.map(v => {
              const end = linhaEndereco(v.endereco)
              const cod = (rastreios[v.id] || '').trim()
              const podeEnviar = cod.length >= 8
              const morto = v.status === 'cancelado' || v.status === 'reembolsado'

              return (
                <div key={v.id} style={S.ped}>
                  <div style={S.topo}>
                    <div style={S.thumb}>
                      {v.item_imagem
                        ? <Image src={v.item_imagem} alt={v.item_nome} width={72} height={100} sizes="72px" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                        : <IconBox size={20} color="rgba(255,255,255,0.3)" />}
                    </div>

                    <div style={S.meta}>
                      <span style={S.num}>#{v.numero} · {fmtDia(v.created_at)}</span>
                      <span style={S.item}>{v.item_nome}</span>
                      <span style={S.quem}>Comprado por {v.comprador_nome}</span>
                      <span style={{ ...S.selo, ...seloEstilo(v.status) }}>{seloTexto(v)}</span>
                    </div>

                    <div style={S.val}>
                      <span style={S.valL}>{v.status === 'entregue' ? 'recebido' : 'você recebe'}</span>
                      <span style={{ ...S.valV, ...(morto ? { color: 'var(--bx-text-3)' } : {}) }}>
                        {morto ? fmtBRL(0) : fmtBRL(v.liquido_loja_cents)}
                      </span>
                      {!morto && <span style={S.valL}>em {v.repasse_prazo} dias</span>}
                    </div>
                  </div>

                  {/* Endereco: so enquanto importa, que e ate despachar. */}
                  {v.status === 'pago' && end && (
                    <div style={S.end}>
                      <b style={S.endT}>Endereço de entrega</b>
                      {v.comprador_nome} · {end}
                    </div>
                  )}

                  {v.status === 'pago' && (
                    <>
                      <div>
                        <div style={S.rot}>
                          <IconBox size={14} color="rgba(255,255,255,0.5)" />
                          Código de rastreio <span style={{ color: '#f87171', fontWeight: 800 }}>(obrigatório)</span>
                        </div>
                        <input
                          value={rastreios[v.id] || ''}
                          onChange={e => setRastreios(r => ({ ...r, [v.id]: e.target.value }))}
                          placeholder="Cole o código dos Correios / Melhor Envio"
                          style={S.input}
                        />
                        <button
                          onClick={() => agir(v, 'enviar')}
                          disabled={!podeEnviar || agindo === v.id}
                          style={{ ...S.btn, width: '100%', marginTop: 9, opacity: (!podeEnviar || agindo === v.id) ? 0.45 : 1 }}
                        >
                          {agindo === v.id ? 'Enviando…' : 'Marcar como enviado'}
                        </button>
                        <p style={S.info}>
                          O comprador precisa do código para acompanhar a entrega — por isso ele é
                          obrigatório. Mínimo de 8 caracteres.
                        </p>
                      </div>

                      {cancelAberto === v.id ? (
                        <div style={S.cancelBox}>
                          <div style={S.rot}>Motivo (opcional, o comprador vê)</div>
                          <input
                            value={motivos[v.id] || ''}
                            onChange={e => setMotivos(m => ({ ...m, [v.id]: e.target.value }))}
                            placeholder="Ex.: a carta sofreu dano no armazenamento"
                            style={S.input}
                          />
                          <p style={S.info}>
                            O comprador recebe <strong style={{ color: 'var(--bx-text)' }}>{fmtBRL(v.total_comprador_cents)}</strong> de
                            volta no cartão, a carta volta para o Mercado e nada é descontado de você.
                            Só dá para cancelar antes de enviar.
                          </p>
                          <div style={{ display: 'flex', gap: 9, marginTop: 4 }}>
                            <button onClick={() => setCancelAberto(null)} style={{ ...S.btnGhost, flex: 1 }}>Voltar</button>
                            <button
                              onClick={() => agir(v, 'cancelar')}
                              disabled={agindo === v.id}
                              style={{ ...S.btnDanger, flex: 1, opacity: agindo === v.id ? 0.6 : 1 }}
                            >
                              {agindo === v.id ? 'Reembolsando…' : 'Confirmar reembolso'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setCancelAberto(v.id)} style={{ ...S.btnDangerGhost, width: '100%' }}>
                          Cancelar e reembolsar
                        </button>
                      )}
                    </>
                  )}

                  {v.status === 'enviado' && (
                    <p style={S.info}>
                      <IconArrowRight size={13} color="rgba(255,255,255,0.5)" />{' '}
                      {v.rastreio && <>Rastreio <strong style={S.mono}>{v.rastreio}</strong> · </>}
                      o comprador confirma o recebimento e a venda se encerra. Depois disso ele pode
                      avaliar você.
                    </p>
                  )}

                  {v.status === 'entregue' && (
                    <p style={S.info}>
                      <IconCheck size={13} color="var(--bx-green)" /> Entregue
                      {v.entregue_em ? ` em ${fmtDia(v.entregue_em)}` : ''} · o repasse cai na sua
                      conta em até {v.repasse_prazo} dias contados do pagamento.
                    </p>
                  )}

                  {morto && (
                    <p style={S.info}>
                      O comprador recebeu o valor de volta e a carta voltou para o Mercado. Nada foi
                      descontado de você.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function seloTexto(v: Venda): string {
  if (v.status === 'pago') return 'Pago · o comprador está esperando'
  if (v.status === 'enviado') return `Enviado${v.enviado_em ? ` em ${fmtDia(v.enviado_em)}` : ''}`
  if (v.status === 'entregue') return `Entregue${v.entregue_em ? ` em ${fmtDia(v.entregue_em)}` : ''}`
  if (v.status === 'reembolsado') return `Reembolsado${v.cancelado_em ? ` em ${fmtDia(v.cancelado_em)}` : ''}`
  if (v.status === 'cancelado') return 'Cancelado'
  return v.status
}

function seloEstilo(status: string): React.CSSProperties {
  if (status === 'pago') return { background: 'rgba(245,158,11,0.14)', color: 'var(--ac-1)', border: '1px solid rgba(245,158,11,0.3)' }
  if (status === 'enviado') return { background: 'rgba(96,165,250,0.14)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }
  if (status === 'entregue') return { background: 'rgba(34,197,94,0.14)', color: 'var(--bx-green)', border: '1px solid rgba(34,197,94,0.3)' }
  return { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.28)' }
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 720, margin: '0 auto', padding: '4px 0 40px' },
  resumo: { display: 'flex', gap: 9, flexWrap: 'wrap' },
  chip: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8 },
  chipV: { fontSize: 17, fontWeight: 900, fontVariantNumeric: 'tabular-nums' },
  chipL: { fontSize: 11.5, color: 'var(--bx-text-2)' },

  erro: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: 10, padding: '11px 13px', fontSize: 13, marginBottom: 14 },

  ped: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color 0.15s ease, background 0.15s ease' },
  topo: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  // 72x100: o mesmo tamanho que o /compras passou a usar em 24/09 -- menor que
  // isso nao da pra reconhecer a carta.
  thumb: { width: 72, height: 100, flex: '0 0 auto', borderRadius: 8, overflow: 'hidden', background: 'var(--bx-surface-3)', border: '1px solid var(--bx-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  num: { fontSize: 11, color: 'var(--bx-text-3)', fontFamily: 'monospace' },
  item: { fontSize: 15, fontWeight: 700, lineHeight: 1.3 },
  quem: { fontSize: 12.5, color: 'var(--bx-text-2)' },
  selo: { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, padding: '5px 11px', borderRadius: 999, marginTop: 2 },

  val: { flex: '0 0 auto', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 },
  valV: { fontSize: 18, fontWeight: 900, color: 'var(--bx-green)', whiteSpace: 'nowrap' },
  valL: { fontSize: 10.5, color: 'var(--bx-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' },

  end: { background: 'var(--bx-bg)', border: '1px solid var(--bx-border)', borderRadius: 10, padding: '11px 12px', fontSize: 12.5, color: 'var(--bx-text-2)', lineHeight: 1.5 },
  endT: { display: 'block', marginBottom: 3, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bx-text-3)', fontWeight: 600 },

  rot: { fontSize: 11, fontWeight: 700, color: 'var(--bx-text-2)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 },
  // fontSize 16: abaixo disso o Safari do iPhone da zoom ao focar e nao volta.
  input: { width: '100%', font: 'inherit', fontSize: 16, color: 'var(--bx-text)', background: 'var(--bx-bg)', border: '1px solid var(--bx-border-2)', borderRadius: 10, padding: '11px 13px', minHeight: 48 },
  info: { fontSize: 12.5, color: 'var(--bx-text-2)', lineHeight: 1.5, margin: '9px 0 0' },
  mono: { fontFamily: 'monospace', color: 'var(--bx-text)' },

  btn: { font: 'inherit', fontSize: 13.5, fontWeight: 800, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'var(--bx-brand)', color: 'var(--bx-brand-ink)', minHeight: 44, padding: '0 18px', transition: 'opacity 0.15s ease' },
  btnGhost: { font: 'inherit', fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)', minHeight: 44, padding: '0 14px' },
  btnGhostAc: { font: 'inherit', fontSize: 13, fontWeight: 700, borderRadius: 10, background: 'transparent', border: '1px solid rgba(245,158,11,0.35)', color: 'var(--ac-1)', minHeight: 44, padding: '0 16px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginTop: 4 },
  btnDanger: { font: 'inherit', fontSize: 13, fontWeight: 800, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#dc2626', color: '#fff', minHeight: 44, padding: '0 14px' },
  btnDangerGhost: { font: 'inherit', fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', minHeight: 44, padding: '0 14px' },
  cancelBox: { background: 'var(--bx-bg)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 4 },

  vazio: { border: '1px dashed var(--bx-border-2)', borderRadius: 14, padding: '34px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--bx-text-3)', fontSize: 13 },
  vazioT: { fontSize: 15, fontWeight: 700, color: 'var(--bx-text)' },
  vazioP: { fontSize: 13, color: 'var(--bx-text-2)', maxWidth: '42ch', margin: 0 },
}
