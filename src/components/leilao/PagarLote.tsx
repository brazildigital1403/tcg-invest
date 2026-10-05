'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import { IconArrowRight, IconCard, IconClock, IconLoja, IconPokeball, IconShield, IconWarning } from '@/components/ui/Icons'
import { formatarBRL, horarioBrasilia } from '@/lib/leilao'
import { calcularArremate } from '@/lib/leilao-taxas'

/**
 * Ilha da tela /leiloes/[slug]/pagar.
 *
 * Quem venceu, o prazo e o vendedor vem de GET /api/leiloes/[id]/checkout
 * (Bearer). A conta mostrada usa a MESMA lib do servidor (leilao-taxas.ts):
 * preco de martelo + taxa de protecao + acrescimo do cartao + frete. O frete
 * calculado e so estimativa aqui (/api/frete/cotar); o servidor re-cota pelo
 * servico escolhido na hora de abrir o pagamento.
 *
 * Fatia 2: so cartao (o Pix entra quando PIX_DISPONIVEL virar true).
 *
 * VISUAL (casca do Bynx Leiloes, mockup aprovado em 27/09/2026): arremate,
 * prazo em destaque, entrega, conta e o botao de pagar fixo no fim da tela no
 * celular. O acento e o do comprador (.bx-ctx-comprador, na pagina).
 */

interface OpcaoFrete {
  id: number
  nome: string
  empresa: string
  precoCents: number
  prazoDias: number
}

interface DadosPagamento {
  lote: { id: string; slug: string; nome: string; imagem: string | null; condicao: string | null; preco_cents: number }
  pagar_ate: string | null
  vendedor: {
    tipo: 'loja' | 'pessoa'
    nome: string
    verificada: boolean
    frete_modo: 'fixo' | 'calculado'
    frete_fixo_cents: number | null
    pode_vender: boolean
    motivo: string | null
    /** Por que nao da para pagar: 'cep' e 'recebimento' sao pendencias do vendedor. */
    bloqueio?: 'nenhum' | 'cep' | 'recebimento'
    /** Slug da loja (so quando o vendedor e loja), para o link "Ver a loja". */
    slug?: string | null
  } | null
}

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'deslogado' }
  | { tipo: 'bloqueado'; titulo: string; texto: string; pedidoId?: string | null }
  | { tipo: 'pronto'; dados: DadosPagamento }

async function tokenAtual(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

function fmtCep(v: string): string {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export default function PagarLote({
  loteId,
  urlLote,
  urlPagar,
  nomeInicial,
  imagemInicial,
  cancelado,
}: {
  loteId: string
  urlLote: string
  /** Esta pagina (volta do login). Vem de urlPagar() em src/lib/leilao-urls.ts. */
  urlPagar: string
  nomeInicial: string
  imagemInicial: string | null
  cancelado: boolean
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [cep, setCep] = useState('')
  const [opcoes, setOpcoes] = useState<OpcaoFrete[] | null>(null)
  const [servico, setServico] = useState<number | null>(null)
  const [cotando, setCotando] = useState(false)
  const [erroFrete, setErroFrete] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [conferindo, setConferindo] = useState(false)

  const loginHref = `${urlPagar}?auth=login&next=${encodeURIComponent(urlPagar)}`

  const carregar = useCallback(async () => {
    const token = await tokenAtual()
    if (!token) {
      setEstado({ tipo: 'deslogado' })
      return
    }
    try {
      const r = await fetch(`/api/leiloes/${loteId}/checkout`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await r.json().catch(() => null)
      if (r.status === 401) {
        setEstado({ tipo: 'deslogado' })
        return
      }
      if (!r.ok || !j) {
        const erroCod = j?.erro as string | undefined
        setEstado({
          tipo: 'bloqueado',
          titulo:
            erroCod === 'nao_vencedor'
              ? 'Este pagamento é de quem venceu o lote'
              : erroCod === 'pago'
                ? 'Este lote já está pago'
                : 'Não é possível pagar este lote agora',
          texto:
            erroCod === 'nao_vencedor'
              ? 'Só a conta que deu o lance vencedor consegue pagar por este lote. Confira se você entrou com a conta certa.'
              : (j?.error as string) || 'Tente de novo em instantes.',
          pedidoId: typeof j?.pedido_id === 'string' ? j.pedido_id : null,
        })
        return
      }
      setEstado({ tipo: 'pronto', dados: j as DadosPagamento })
    } catch {
      setEstado({
        tipo: 'bloqueado',
        titulo: 'Sem conexão',
        texto: 'Não foi possível carregar o pagamento. Confira a internet e tente de novo.',
      })
    }
  }, [loteId])

  useEffect(() => {
    carregar()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      carregar()
    })
    return () => sub.subscription.unsubscribe()
  }, [carregar])

  // "Conferir de novo" na espera: rele sem trocar a tela por "Carregando".
  async function conferir() {
    if (conferindo) return
    setConferindo(true)
    try {
      await carregar()
    } finally {
      setConferindo(false)
    }
  }

  async function cotar() {
    const d = cep.replace(/\D/g, '')
    if (d.length !== 8) {
      setErroFrete('Digite um CEP válido, com 8 dígitos.')
      return
    }
    setCotando(true)
    setErroFrete(null)
    setOpcoes(null)
    setServico(null)
    try {
      const r = await fetch('/api/frete/cotar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'leilao', id: loteId, cep: d }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(j?.error || 'Não foi possível calcular o frete.')
      const ops = (j?.opcoes || []) as OpcaoFrete[]
      setOpcoes(ops)
      if (ops.length) setServico(ops[0].id)
    } catch (e) {
      setErroFrete((e as Error).message)
    } finally {
      setCotando(false)
    }
  }

  async function pagar(ehCalculado: boolean) {
    if (indo) return
    setIndo(true)
    setErro(null)
    try {
      const token = await tokenAtual()
      if (!token) {
        setEstado({ tipo: 'deslogado' })
        return
      }
      const corpo: Record<string, unknown> = { metodo: 'cartao' }
      if (ehCalculado) {
        corpo.cep = cep.replace(/\D/g, '')
        corpo.servico = servico
      }
      const r = await fetch(`/api/leiloes/${loteId}/checkout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.url) {
        window.location.href = j.url
        return
      }
      if ((j?.erro === 'processando' || j?.erro === 'pago') && typeof j?.pedido_id === 'string') {
        window.location.href = `/pedido/${j.pedido_id}`
        return
      }
      throw new Error(j?.error || 'Não foi possível abrir o pagamento. Tente de novo.')
    } catch (e) {
      setErro((e as Error).message)
      setIndo(false)
    }
  }

  // ── Estados sem pagamento ────────────────────────────────────────────────
  if (estado.tipo === 'carregando') {
    return <div style={S.card} role="status">Carregando o pagamento...</div>
  }
  if (estado.tipo === 'deslogado') {
    return (
      <div style={S.card}>
        <p style={S.aviTitulo}>Entre para pagar o lote</p>
        <p style={S.aviTexto}>O pagamento fica disponível para a conta que venceu o lote.</p>
        <Link href={loginHref} prefetch={false} className="pg-cta" style={S.cta}>
          Entrar <IconArrowRight size={16} />
        </Link>
      </div>
    )
  }
  if (estado.tipo === 'bloqueado') {
    return (
      <div style={S.card}>
        <p style={S.aviTitulo}>{estado.titulo}</p>
        <p style={S.aviTexto}>{estado.texto}</p>
        <div style={S.acoes}>
          {estado.pedidoId && (
            <Link href={`/pedido/${estado.pedidoId}`} prefetch={false} className="pg-cta" style={S.cta}>
              Ver o pedido <IconArrowRight size={16} />
            </Link>
          )}
          <Link href={urlLote} prefetch={false} className="pg-ghost" style={S.ghost}>
            Voltar para o lote
          </Link>
        </div>
      </div>
    )
  }

  // ── Pagamento ────────────────────────────────────────────────────────────
  const { dados } = estado
  const v = dados.vendedor
  const precoCents = dados.lote.preco_cents
  const a = calcularArremate(precoCents, 'cartao')
  const ehCalculado = v?.frete_modo === 'calculado'
  const opcao = opcoes?.find(o => o.id === servico) ?? null
  const freteCents: number | null = ehCalculado ? (opcao ? opcao.precoCents : null) : (v?.frete_fixo_cents ?? 0)
  const total = freteCents == null ? null : a.compradorPagaCents + freteCents
  const precisaFrete = ehCalculado && freteCents == null
  const imagem = dados.lote.imagem || imagemInicial

  return (
    <div style={S.coluna}>
      <style>{`
        .pg-cta, .pg-ghost, .pg-op { transition: filter 0.15s ease, background 0.15s ease, border-color 0.15s ease; }
        .pg-cta:hover:not(:disabled) { filter: brightness(1.08); }
        .pg-ghost:hover, .pg-op:hover { background: var(--bx-surface-2); border-color: var(--bx-border-2); }
        .pg-cta:focus-visible, .pg-ghost:focus-visible, .pg-op:focus-visible, .pg-campo:focus-visible {
          outline: 2px solid var(--ac-1); outline-offset: 2px;
        }
        .pg-cta-fixo { margin-top: 2px; }
        @media (max-width: 768px) {
          /* Pagar fixo no fim da tela (sem bottom nav na casca do leilao). */
          .pg-cta-fixo {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 150; margin: 0;
            padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
            background: var(--bx-bg-elev); border-top: 1px solid var(--bx-border); box-shadow: var(--bx-shadow);
          }
        }
        @media (prefers-reduced-motion: reduce) { .pg-cta, .pg-ghost, .pg-op { transition: none; } }
      `}</style>

      {cancelado && (
        <div role="status" style={{ ...S.faixa, ...S.faixaAviso }}>
          <IconWarning size={16} />
          O pagamento não foi concluído. Você ainda pode pagar dentro do prazo.
        </div>
      )}
      {erro && (
        <div role="alert" style={{ ...S.faixa, ...S.faixaErro }}>
          <IconWarning size={16} />
          {erro}
        </div>
      )}

      <div style={S.arrem}>
        <div style={S.thumb}>
          {imagem ? (
            <Image src={imagem} alt={dados.lote.nome || nomeInicial} width={54} height={75} sizes="64px" style={S.thumbImg} />
          ) : (
            <IconPokeball size={22} color="var(--bx-text-3)" />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={S.itemNome}>{dados.lote.nome || nomeInicial}</p>
          <p style={S.itemMeta}>Você arrematou por {formatarBRL(precoCents)}</p>
          {(dados.lote.condicao || v) && (
            <p style={S.itemFraco}>
              {[dados.lote.condicao, v ? `Vendido por ${v.nome}` : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      {dados.pagar_ate && <p style={S.prazo}>Pague até {horarioBrasilia(dados.pagar_ate)}</p>}

      {!v || !v.pode_vender ? (
        <EmEspera
          vendedor={v}
          pagarAte={dados.pagar_ate}
          conferindo={conferindo}
          onConferir={conferir}
        />
      ) : (
        <>
          {ehCalculado && (
            <section aria-labelledby="pg-entrega" style={S.bloco}>
              <h2 id="pg-entrega" style={S.rot}>Entrega</h2>
              <div style={S.cepLinha}>
                <input
                  className="pg-campo"
                  value={cep}
                  onChange={e => {
                    setCep(fmtCep(e.target.value))
                    setOpcoes(null)
                    setServico(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') cotar()
                  }}
                  placeholder="CEP"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  aria-label="CEP de entrega"
                  style={S.campo}
                />
                <button type="button" onClick={cotar} disabled={cotando} className="pg-ghost" style={S.btnCep}>
                  {cotando ? 'Calculando...' : 'Calcular'}
                </button>
              </div>
              {erroFrete && <p style={S.erroFrete}>{erroFrete}</p>}
              {opcoes && opcoes.length > 0 && (
                <div role="radiogroup" aria-label="Opções de frete" style={S.opcoes}>
                  {opcoes.map(o => {
                    const on = servico === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setServico(o.id)}
                        className="pg-op"
                        style={{ ...S.opcao, ...(on ? S.opcaoOn : null) }}
                      >
                        <span style={{ ...S.radio, ...(on ? S.radioOn : null) }} />
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <span style={S.opNome}>{o.empresa} {o.nome}</span>
                          <span style={S.opPrazo}>
                            chega em cerca de {o.prazoDias} dia{o.prazoDias > 1 ? 's' : ''} úte{o.prazoDias > 1 ? 'is' : 'il'}
                          </span>
                        </span>
                        <span style={S.opPreco}>{formatarBRL(o.precoCents)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          <section aria-label="Resumo do pagamento" style={S.conta}>
            <div style={S.linha}>
              <span style={S.rotulo}>Arremate</span>
              <span>{formatarBRL(precoCents)}</span>
            </div>
            <div style={S.linha}>
              <span style={S.rotulo}>Taxa de proteção</span>
              <span>{formatarBRL(a.protecaoCents)}</span>
            </div>
            <div style={S.linha}>
              <span style={S.rotulo}>Acréscimo do cartão</span>
              <span>{formatarBRL(a.custoMetodoCents)}</span>
            </div>
            <div style={S.linha}>
              <span style={S.rotulo}>Frete</span>
              <span>
                {freteCents == null ? (
                  <span style={S.rotulo}>informe o CEP</span>
                ) : freteCents === 0 ? (
                  <span style={{ color: 'var(--bx-green)' }}>Grátis</span>
                ) : (
                  formatarBRL(freteCents)
                )}
              </span>
            </div>
            <div style={S.total}>
              <span>Total</span>
              <span style={S.totalValor}>{total == null ? '—' : formatarBRL(total)}</span>
            </div>
          </section>

          <p style={S.nota}>
            <IconShield size={14} />
            <span>Os dados do cartão não passam pela Bynx.</span>
          </p>

          <div className="pg-cta-fixo">
            <button
              type="button"
              onClick={() => pagar(ehCalculado)}
              disabled={indo || precisaFrete}
              className="pg-cta"
              style={{ ...S.cta, ...(indo || precisaFrete ? S.ctaOff : null) }}
            >
              {indo ? (
                'Abrindo o pagamento...'
              ) : precisaFrete ? (
                'Calcule o frete para continuar'
              ) : (
                <>
                  <IconCard size={18} /> Pagar com cartão{total == null ? '' : ` · ${formatarBRL(total)}`}
                </>
              )}
            </button>
          </div>
        </>
      )}

      <Link href={urlLote} prefetch={false} className="pg-ghost" style={S.ghost}>
        Voltar para o lote
      </Link>
    </div>
  )
}

/**
 * Arremate que ainda nao pode ser pago. Dois casos, com textos diferentes de
 * proposito:
 *   - vendedor null: a leitura do vendedor falhou (nao e culpa de ninguem que
 *     o comprador conheca). Antes caia na frase "o vendedor ainda nao recebe",
 *     que era falsa nesse caso.
 *   - pendencia do vendedor ('recebimento' ou 'cep'): a loja so agenda rodada
 *     com recebimento ativo e CEP (api/lojas/[id]/leiloes/_comum.ts), entao
 *     isso so aparece se a conta for restrita depois do agendamento.
 * So promete o que e verdade: nada foi cobrado, o lote fica reservado ate
 * pagar_ate, e se o prazo passar o arremate e cancelado sem cobranca. Na
 * pendencia do vendedor, a rota do checkout registra o bloqueio e enfileira o
 * aviso a loja, e o tick cancela sem marcar calote (migration 20260928150000)
 * -- por isso "avisamos a loja" e "nao conta contra voce" so aparecem nesse
 * caso. Na falha de leitura ninguem sabe de quem e a culpa: texto neutro.
 */
function EmEspera({
  vendedor,
  pagarAte,
  conferindo,
  onConferir,
}: {
  vendedor: DadosPagamento['vendedor']
  pagarAte: string | null
  conferindo: boolean
  onConferir: () => void
}) {
  const [conferidoEm, setConferidoEm] = useState<string | null>(null)
  const [anterior, setAnterior] = useState(conferindo)
  // Terminou uma conferencia e a tela continua em espera: registra a hora.
  if (anterior !== conferindo) {
    setAnterior(conferindo)
    if (!conferindo) {
      setConferidoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }))
    }
  }

  const falhaLeitura = !vendedor
  const nome = vendedor?.nome || 'O vendedor'
  const linkLoja = vendedor?.tipo === 'loja' && vendedor.slug ? `/lojas/${vendedor.slug}` : null

  const titulo = falhaLeitura ? 'Não conseguimos carregar o pagamento' : 'Pagamento em espera'
  const texto = falhaLeitura
    ? 'Os dados do vendedor não carregaram agora. Nada foi cobrado e o seu arremate continua reservado.'
    : vendedor?.bloqueio === 'cep'
      ? `${nome} ainda não informou o CEP de onde a carta sai, e sem ele não é possível calcular o frete. Já avisamos a loja. Nada foi cobrado.`
      : `${nome} precisa concluir um ajuste no recebimento antes de você pagar. Já avisamos a loja. Nada foi cobrado.`

  const passos = [
    pagarAte
      ? `Seu arremate fica reservado para você até ${horarioBrasilia(pagarAte)}.`
      : 'Seu arremate fica reservado para você até o fim do prazo de pagamento.',
    falhaLeitura
      ? 'Toque em Tentar de novo. Se continuar assim, volte em alguns minutos.'
      : 'Quando o ajuste for concluído, o botão de pagar aparece nesta tela.',
    falhaLeitura
      ? 'Se o prazo terminar antes, o arremate é cancelado e nada é cobrado.'
      : 'Se o prazo terminar antes, o arremate é cancelado, nada é cobrado e isso não conta contra você.',
  ]

  return (
    <section aria-labelledby="pg-espera" style={S.espera}>
      <div style={S.esperaIc} aria-hidden="true">
        {falhaLeitura ? <IconWarning size={24} color="var(--ac-1)" /> : <IconClock size={24} color="var(--ac-1)" />}
      </div>
      <h2 id="pg-espera" style={S.esperaTitulo}>{titulo}</h2>
      <p style={S.esperaTexto}>{texto}</p>

      <div style={S.passos}>
        <p style={S.rot}>O que acontece agora</p>
        <ol style={S.passosLista}>
          {passos.map((t, i) => (
            <li key={i} style={S.passo}>
              <span style={S.passoN}>{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>

      <div style={S.acoes}>
        <button
          type="button"
          onClick={onConferir}
          disabled={conferindo}
          className="pg-cta"
          style={{ ...S.cta, ...(conferindo ? S.ctaOff : null) }}
        >
          {conferindo ? 'Conferindo...' : falhaLeitura ? 'Tentar de novo' : 'Conferir de novo'}
        </button>
        {linkLoja && (
          <Link href={linkLoja} prefetch={false} className="pg-ghost" style={S.ghost}>
            <IconLoja size={16} color="currentColor" /> Ver a loja
          </Link>
        )}
      </div>
      {conferidoEm && !conferindo && (
        <p role="status" style={S.conferido}>Conferido às {conferidoEm}. Ainda em espera.</p>
      )}
    </section>
  )
}

const S: Record<string, CSSProperties> = {
  espera: {
    display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: '20px 16px 16px',
    borderRadius: 12, border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', color: 'var(--bx-text)',
  },
  esperaIc: {
    width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', background: 'rgba(var(--ac-1-rgb), 0.12)',
  },
  esperaTitulo: { fontSize: 18, fontWeight: 800, margin: 0, textAlign: 'center', lineHeight: 1.3 },
  esperaTexto: {
    fontSize: 14, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5, textAlign: 'center',
    maxWidth: 440, alignSelf: 'center',
  },
  passos: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--bx-border)', background: 'var(--bx-bg)',
  },
  passosLista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  passo: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--bx-text-2)', lineHeight: 1.45 },
  passoN: {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ac-1)',
    border: '1px solid rgba(var(--ac-1-rgb), 0.4)', fontVariantNumeric: 'tabular-nums',
  },
  conferido: { fontSize: 12, color: 'var(--bx-text-3)', margin: 0, textAlign: 'center' },
  coluna: { display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 },
  arrem: {
    display: 'flex', gap: 12, alignItems: 'center', padding: 10, borderRadius: 12,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)',
  },
  bloco: { display: 'flex', flexDirection: 'column', gap: 8 },
  rot: {
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--bx-text-3)', margin: 0,
  },
  conta: {
    display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 12,
    border: '1px solid var(--bx-border)',
  },
  card: {
    display: 'flex', flexDirection: 'column', gap: 10, padding: 16, borderRadius: 12,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', color: 'var(--bx-text)',
  },
  aviTitulo: { fontSize: 16, fontWeight: 700, color: 'var(--bx-text)', margin: 0 },
  aviTexto: { fontSize: 14, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5 },
  acoes: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  thumb: {
    width: 54, height: 75, borderRadius: 6, overflow: 'hidden', flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center', background: 'var(--bx-surface-2)',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'contain' },
  itemNome: { fontSize: 15, fontWeight: 700, color: 'var(--bx-text)', margin: 0, lineHeight: 1.3, overflowWrap: 'anywhere' },
  itemMeta: { fontSize: 12.5, color: 'var(--bx-text-2)', margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' },
  itemFraco: { fontSize: 12, color: 'var(--bx-text-3)', margin: '2px 0 0' },
  prazo: {
    margin: 0, padding: '10px 12px', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'var(--ac-1)',
    border: '1px solid var(--ac-1)', background: 'rgba(var(--ac-1-rgb), 0.08)',
  },
  cepLinha: { display: 'flex', gap: 8 },
  campo: {
    flex: 1, minWidth: 0, minHeight: 44, padding: '0 12px', borderRadius: 12, fontSize: 16, fontWeight: 600,
    fontFamily: 'inherit', background: 'var(--bx-bg)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
  },
  btnCep: {
    minHeight: 44, padding: '0 16px', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
    cursor: 'pointer', background: 'var(--bx-surface)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text)',
  },
  erroFrete: { fontSize: 13, color: 'var(--bx-red)', margin: 0 },
  opcoes: { display: 'flex', flexDirection: 'column', gap: 8 },
  opcao: {
    display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px', borderRadius: 10,
    cursor: 'pointer', fontFamily: 'inherit', background: 'var(--bx-surface)',
    borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--bx-border)',
    color: 'var(--bx-text)',
  },
  opcaoOn: { borderColor: 'var(--ac-1)', background: 'rgba(var(--ac-1-rgb), 0.08)' },
  radio: { width: 16, height: 16, borderRadius: '50%', flexShrink: 0, borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--bx-border-2)' },
  radioOn: { borderColor: 'var(--ac-1)', background: 'var(--ac-1)', boxShadow: 'inset 0 0 0 3px var(--bx-surface)' },
  opNome: { display: 'block', fontSize: 14, fontWeight: 600 },
  opPrazo: { display: 'block', fontSize: 12, color: 'var(--bx-text-3)' },
  opPreco: { fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  linha: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, fontVariantNumeric: 'tabular-nums' },
  rotulo: { color: 'var(--bx-text-3)' },
  total: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingTop: 8, marginTop: 2,
    borderTop: '1px solid var(--bx-border)', fontSize: 15, fontWeight: 800,
  },
  totalValor: { fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--bx-text)' },
  cta: {
    width: '100%', minHeight: 48, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
    background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums',
  },
  ctaOff: { opacity: 0.6, cursor: 'default' },
  ghost: {
    minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10,
    border: '1px solid var(--bx-border)', background: 'var(--bx-surface)', color: 'var(--bx-text)',
    fontSize: 14, fontWeight: 600, textDecoration: 'none',
  },
  nota: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11.5, color: 'var(--bx-text-3)',
    margin: 0, lineHeight: 1.5, textAlign: 'center',
  },
  faixa: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 600,
  },
  faixaAviso: { background: 'var(--bx-surface)', border: '1px solid var(--bx-border-2)', color: 'var(--bx-text-2)' },
  faixaErro: { background: 'var(--bx-surface)', border: '1px solid var(--bx-red)', color: 'var(--bx-red)' },
}
