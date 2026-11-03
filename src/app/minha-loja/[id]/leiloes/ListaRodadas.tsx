'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLojaOwner, LojaEstadoFallback, SH, LOJA_HOME, TrilhaLoja } from '../_shared'
import { CSS_KIT } from '@/components/leilao/kit/estilos'
import {
  AbasFiltro, Acoes, Aviso, Botao, Esqueleto, IconeBloco, Linha, Linhas, MiniCarta, ProximaAcao, Selo, TelaEstado, Titulo, type Tom,
} from '@/components/leilao/kit'
import { IconLeilao, IconPlus, IconTruck, IconWarning } from '@/components/ui/Icons'
import { formatarBRL, formatarTempoRestante, horarioBrasilia } from '@/lib/leilao'
import NovoLote, { type LoteInicial } from './[rodadaId]/NovoLote'
import { STATUS_RODADA, chamarPainel, type RodadaResumo } from './_rodada'

/**
 * Painel de leiloes da loja: a proxima acao primeiro, depois lotes com prazo e
 * rodadas ao vivo juntos, filtrados por estado. "Nova rodada" cria um rascunho
 * e abre o editor.
 */

type AbaPainel = 'abertos' | 'agendadas' | 'rascunhos' | 'pagamento' | 'sem_lance' | 'historico'

interface LotePrazo {
  id: string; slug: string; card_name: string; status: string; n_lances: number
  preco_atual_cents: number | null; lance_inicial_cents: number; termina_em: string | null
  card_id: string | null; card_numero: string | null; set_nome: string | null; card_image: string | null
  fotos: string[]; condicao: string | null; idioma: string | null; graduadora: string | null
  nota: string | number | null; descricao: string | null; duracao_seg: number | null
}
interface EnvioPendente { id: string; numero: number | null; item_nome: string | null; item_imagem: string | null; enviar_ate: string | null }
const diasDoLote = (l: LotePrazo) => Math.round((l.duracao_seg ?? 0) / 86400) || 3
const STATUS_LOTE: Record<string, string> = {
  aguardando_pagamento: 'aguardando pagamento', vendido: 'vendido', sem_lances: 'encerrado sem lances', cancelado: 'cancelado', calote: 'não pago',
}

export default function ListaRodadas({ lojaId }: { lojaId: string }) {
  const router = useRouter()
  const { estado, loja } = useLojaOwner(lojaId)
  const [rodadas, setRodadas] = useState<RodadaResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [lotes, setLotes] = useState<LotePrazo[]>([])
  const [novoLeilao, setNovoLeilao] = useState(false)
  const [inicial, setInicial] = useState<LoteInicial | null>(null)
  const [republicando, setRepublicando] = useState<string | null>(null)
  const [enderecoOk, setEnderecoOk] = useState(true)
  const [recebimento, setRecebimento] = useState<{ podeReceber: boolean; motivo: string | null } | null>(null)
  const [envios, setEnvios] = useState<EnvioPendente[]>([])
  const [aba, setAba] = useState<AbaPainel | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [j, p] = await Promise.all([
        chamarPainel<{ rodadas: RodadaResumo[] }>(`/api/lojas/${lojaId}/leiloes`),
        chamarPainel<{ lotes: LotePrazo[]; enderecoOk: boolean; recebimento: { podeReceber: boolean; motivo: string | null }; envios: EnvioPendente[] | null }>(`/api/lojas/${lojaId}/leiloes/lotes`),
      ])
      setRodadas(j.rodadas || [])
      setLotes(p.lotes || [])
      setEnderecoOk(p.enderecoOk)
      setRecebimento(p.recebimento)
      setEnvios(p.envios ?? [])
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setCarregando(false)
    }
  }, [lojaId])

  useEffect(() => { if (estado === 'pronto') carregar() }, [estado, carregar])

  async function cancelarLote(id: string) {
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/lotes?lote_id=${id}`, { method: 'DELETE' })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Mesma carta fisica e mesmas fotos, que continuam sem lote vivo: o servidor
  // recusa se a foto ja estiver em outro leilao, entao clique duplo nao duplica.
  async function publicarDeNovo(l: LotePrazo) {
    if (republicando) return
    setRepublicando(l.id)
    setErro(null)
    try {
      await chamarPainel(`/api/lojas/${lojaId}/leiloes/lotes`, {
        method: 'POST',
        body: JSON.stringify({
          card_id: l.card_id, fotos: l.fotos, condicao: l.condicao, idioma: l.idioma, graduadora: l.graduadora,
          nota: l.nota, descricao: l.descricao, lance_inicial_cents: l.lance_inicial_cents, dias: diasDoLote(l),
        }),
      })
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setRepublicando(null)
    }
  }

  function outraIgual(l: LotePrazo) {
    if (!l.card_id) return
    setInicial({ ...l, card_id: l.card_id, dias: diasDoLote(l) })
    setNovoLeilao(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function novaRodada() {
    setCriando(true)
    setErro(null)
    try {
      const j = await chamarPainel<{ rodada: RodadaResumo }>(`/api/lojas/${lojaId}/leiloes`, {
        method: 'POST',
        body: JSON.stringify({ titulo: 'Rodada ao vivo' }),
      })
      router.push(`/minha-loja/${lojaId}/leiloes/${j.rodada.id}`)
    } catch (e) {
      setErro((e as Error).message)
      setCriando(false)
    }
  }

  if (estado !== 'pronto' || !loja) return <LojaEstadoFallback estado={estado} />

  const pendencia = recebimento && !recebimento.podeReceber
    ? recebimento.motivo
    : !enderecoOk ? 'Falta o endereço para devoluções. Ele não aparece na sua página.' : null

  const base = `/minha-loja/${lojaId}/leiloes`
  // A lista vem do pagamento mais antigo para o mais novo: o primeiro e o mais urgente.
  const enviosAtrasados = envios.filter(e => e.enviar_ate && Date.parse(e.enviar_ate) < Date.now()).length

  const lotesEm = (...st: string[]) => lotes.filter(l => st.includes(l.status))
  const rodadasEm = (...st: string[]) => rodadas.filter(r => st.includes(r.status))
  const grupos = ([
    { chave: 'abertos', rotulo: 'Abertos', lotes: lotesEm('ativo'), rodadas: rodadasEm('ao_vivo') },
    { chave: 'agendadas', rotulo: 'Agendadas', lotes: [], rodadas: rodadasEm('agendada') },
    { chave: 'rascunhos', rotulo: 'Rascunhos', lotes: [], rodadas: rodadasEm('rascunho') },
    { chave: 'pagamento', rotulo: 'A receber', lotes: lotesEm('aguardando_pagamento'), rodadas: [] },
    { chave: 'sem_lance', rotulo: 'Sem lance', lotes: lotesEm('sem_lances'), rodadas: [] },
    { chave: 'historico', rotulo: 'Histórico', lotes: lotesEm('vendido', 'cancelado', 'calote'), rodadas: rodadasEm('encerrada', 'cancelada') },
  ] as Array<{ chave: AbaPainel; rotulo: string; lotes: LotePrazo[]; rodadas: RodadaResumo[] }>)
    .filter(g => g.lotes.length + g.rodadas.length > 0)
  const grupoAtual = grupos.find(g => g.chave === aba) ?? grupos[0] ?? null

  const linhaLote = (l: LotePrazo) => {
    const aberto = l.status === 'ativo'
    const fim = l.termina_em ? Date.parse(l.termina_em) : NaN
    const imagem = l.fotos?.[0] || l.card_image
    const lances = l.n_lances === 1 ? '1 lance' : `${l.n_lances} lances`
    const podeRepublicar = !aberto && !!l.card_id && (l.status === 'sem_lances' || l.status === 'cancelado')
    const podeCopiar = !aberto && !!l.card_id && l.status !== 'aguardando_pagamento'
    const podeCancelar = aberto && l.n_lances === 0
    return (
      <div key={l.id} className="lk-item">
        <Linha
          href={`/leiloes/${l.slug}`}
          midia={imagem ? <MiniCarta src={imagem} /> : undefined}
          titulo={l.card_name}
          meta={aberto && Number.isFinite(fim) ? `${lances} · ${formatarTempoRestante(fim - Date.now())}` : aberto ? lances : (STATUS_LOTE[l.status] ?? l.status)}
          valor={formatarBRL(l.preco_atual_cents ?? l.lance_inicial_cents)}
          seta={false}
        />
        {(podeCancelar || podeRepublicar || podeCopiar) && (
          <div className="lk-item-acoes">
            {podeCancelar && <Botao tipo="sec" onClick={() => cancelarLote(l.id)}>Cancelar</Botao>}
            {podeCopiar && <Botao tipo="sec" disabled={!!pendencia} onClick={() => outraIgual(l)}>Outra carta igual</Botao>}
            {podeRepublicar && (
              <Botao disabled={!!pendencia || !!republicando} onClick={() => publicarDeNovo(l)}>
                {republicando === l.id ? 'Publicando…' : 'Publicar de novo'}
              </Botao>
            )}
          </div>
        )}
      </div>
    )
  }

  const linhaRodada = (r: RodadaResumo) => {
    const st = STATUS_RODADA[r.status] ?? STATUS_RODADA.rascunho
    const n = r.lotes ?? 0
    const tom: Tom = r.status === 'ao_vivo' ? 'vivo' : r.status === 'agendada' ? 'acento' : r.status === 'encerrada' ? 'frente' : 'neutro'
    return (
      <Linha
        key={r.id}
        href={`${base}/${r.id}`}
        midia={<IconeBloco tamanho="m"><IconLeilao size={20} /></IconeBloco>}
        titulo={r.titulo || `Rodada #${r.numero}`}
        meta={[n === 1 ? '1 lote' : `${n} lotes`, r.inicia_em ? horarioBrasilia(r.inicia_em).replace(/\/\d{4},/, '').replace(' (Brasília)', '') : null].filter(Boolean).join(' · ')}
        selo={<Selo tom={tom} icone={<></>}>{st.label}</Selo>}
      />
    )
  }

  return (
    <div style={SH.page}>
      <style>{CSS_KIT}</style>
      <TrilhaLoja items={[LOJA_HOME, { name: loja.nome, href: `/minha-loja/${lojaId}` }, { name: 'Leilões', href: base }]} />
      <div style={S.corpo}>
        <Titulo rotulo="Painel de leilões" titulo="Leilões" />

        {erro && <Aviso tom="perigo">{erro}</Aviso>}

        {pendencia && (
          <ProximaAcao
            rotulo="Sua vez"
            tom="atencao"
            icone={<IconWarning size={22} />}
            titulo={pendencia}
            acao={
              <Botao cheio href={recebimento && !recebimento.podeReceber ? `/minha-loja/${lojaId}/pagamentos` : `/minha-loja/${lojaId}/vitrine`}>
                {recebimento && !recebimento.podeReceber ? 'Ativar recebimentos' : 'Cadastrar endereço'}
              </Botao>
            }
          />
        )}

        {envios.length > 0 && (
          <ProximaAcao
            rotulo={enviosAtrasados > 0 ? 'Envio atrasado' : 'Sua vez'}
            tom={enviosAtrasados > 0 ? 'perigo' : 'acento'}
            icone={enviosAtrasados > 0 ? <IconWarning size={22} /> : <IconTruck size={22} />}
            titulo={envios.length === 1 ? `Enviar ${envios[0].item_nome ?? 'a carta arrematada'}` : `${envios.length} arremates para enviar`}
            texto={envios[0].enviar_ate && (
              enviosAtrasados > 1
                ? `${enviosAtrasados} atrasados. O mais antigo era até ${horarioBrasilia(envios[0].enviar_ate)}`
                : enviosAtrasados === 1
                  ? `O prazo era até ${horarioBrasilia(envios[0].enviar_ate)}`
                  : `Postar até ${horarioBrasilia(envios[0].enviar_ate)}`
            )}
            acao={<Botao cheio href={`/minha-loja/${lojaId}/pedidos`}>Ver envio</Botao>}
          />
        )}

        {!novoLeilao && (
          <Acoes linha>
            <Botao cheio disabled={!!pendencia} onClick={() => { setInicial(null); setNovoLeilao(true) }}>
              <IconPlus size={16} /> Colocar carta em leilão
            </Botao>
            <Botao tipo="sec" cheio disabled={criando} onClick={novaRodada}>
              {criando ? 'Criando…' : 'Nova rodada ao vivo'}
            </Botao>
          </Acoes>
        )}

        {novoLeilao && (
          <NovoLote key={inicial?.card_id ?? 'novo'} lojaId={lojaId} inicial={inicial} onCancelar={() => setNovoLeilao(false)} onCriado={() => { setNovoLeilao(false); setInicial(null); carregar() }} />
        )}

        {carregando && !grupoAtual ? (
          <Linhas><Esqueleto /><Esqueleto /></Linhas>
        ) : !grupoAtual ? (
          <TelaEstado
            icone={<IconLeilao size={38} />}
            titulo="Nenhum leilão ainda."
            texto="Publique a primeira carta e ela aparece aqui."
          />
        ) : (
          <>
            <AbasFiltro
              rotulo="Filtrar leilões"
              ativa={grupoAtual.chave}
              aoEscolher={setAba}
              itens={grupos.map(g => ({ chave: g.chave, rotulo: g.rotulo, n: g.lotes.length + g.rodadas.length }))}
            />
            <Linhas>
              {grupoAtual.rodadas.map(linhaRodada)}
              {grupoAtual.lotes.map(linhaLote)}
            </Linhas>
          </>
        )}
      </div>
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  corpo: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, fontFamily: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif" },
}
