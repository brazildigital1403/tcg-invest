'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { IconWallet } from '@/components/ui/Icons'

/**
 * Faixa de aviso: a loja tem coisa a venda e NAO consegue receber.
 *
 * ★ POR QUE EXISTE (12/09/2026, #279). Medido: 9 das 12 lojas estao em
 * `stripe_connect_status = 'nao_iniciado'`, e duas delas ATIVAS tem anuncio no
 * ar -- ghostcg 15, sc-cartas-tcg 1. Esses 16 anuncios aparecem normalmente no
 * marketplace, mas o botao de comprar nao existe pra eles: o `anuncioPublico`
 * devolve `lojaPodeVender: false` e a tela cai no "Tenho interesse".
 *
 * ★ O DIAGNOSTICO NAO ERA FALTA DE TELA. O /minha-loja/[id]/pagamentos ja tem
 * o convite certo ("Comece a vender na Bynx", botao, os 3 minutos, o CNPJ), e o
 * /produtos ja avisa na hora de salvar. O que faltava era o aviso ONDE o
 * lojista olha: ele cai na Visao geral e ve sete atalhos iguais entre si, um
 * deles "Pagamentos - Receba pelas vendas na Bynx", indistinguivel dos outros.
 * Conferido no painel real antes de escrever. E o "grava mas nao le" na versao
 * UX: a tela existe e ninguem chega nela.
 *
 * ★ SO APARECE COM COISA NO AR. Loja vazia com Connect desligado nao esta
 * perdendo venda nenhuma -- ali o convite do /pagamentos basta, e a faixa seria
 * ruido. O numero entra no texto porque "15 anuncios" move e "ative os
 * recebimentos" nao.
 *
 * ★ LOJA SUSPENSA NAO RECEBE. O `anuncioPublico` so resolve loja com
 * `status = 'ativa'`, entao os anuncios de uma suspensa ja aparecem como pessoa
 * fisica: o problema dela vem antes deste, e mandar ativar recebimento seria
 * apontar pra porta errada. Foi o caso da morion-boutique, com 7 anuncios.
 */
export default function AvisoRecebimentos({
  lojaId,
  ownerUserId,
  status,
  podeReceber,
  compacto = false,
}: {
  lojaId: string
  ownerUserId: string
  /** `status` da loja. Suspensa tem problema anterior a este. */
  status: string
  /** `connect_charges_enabled` da loja. */
  podeReceber: boolean | null
  /** Versao de uma linha, para o card na lista de lojas. */
  compacto?: boolean
}) {
  const [quantos, setQuantos] = useState<{ anuncios: number; produtos: number } | null>(null)

  const desligado = !podeReceber && status !== 'suspensa'

  useEffect(() => {
    if (!desligado) return
    let vivo = true
    async function contar() {
      // ★ `removido_em` e `ativo` NAO podem faltar. Sem eles a conta inclui o
      //   que o proprio lojista ja tirou do ar, e a faixa diria "os seus 3
      //   anuncios estao no ar" pra quem nao tem nenhum -- o erro que este
      //   componente existe pra nao cometer. Todo leitor publico filtra os
      //   dois (anuncioPublico:95, ofertasDaCarta:89, marketplace:998); esta
      //   contagem tem que enxergar o mesmo que o comprador enxerga.
      const [a, p] = await Promise.all([
        supabase.from('marketplace').select('id', { count: 'exact', head: true })
          .eq('user_id', ownerUserId).eq('status', 'disponivel')
          .is('removido_em', null),
        supabase.from('loja_produtos').select('id', { count: 'exact', head: true })
          .eq('loja_id', lojaId).gt('estoque', 0)
          .eq('ativo', true),
      ])
      // Falha de contagem esconde a faixa em vez de mostrar "0 anuncios":
      // avisar com numero errado e pior do que nao avisar.
      if (!vivo || a.error || p.error) return
      setQuantos({ anuncios: a.count || 0, produtos: p.count || 0 })
    }
    contar()
    return () => { vivo = false }
  }, [desligado, lojaId, ownerUserId])

  if (!desligado || !quantos) return null
  const total = quantos.anuncios + quantos.produtos
  if (total === 0) return null

  const oQue = quantos.anuncios > 0 && quantos.produtos > 0
    ? `${total} itens`
    : quantos.anuncios > 0
      ? `${quantos.anuncios} ${quantos.anuncios === 1 ? 'anúncio' : 'anúncios'}`
      : `${quantos.produtos} ${quantos.produtos === 1 ? 'produto' : 'produtos'}`
  // "Você tem" e nao "Os seus": com 1 item o artigo plural nao concorda
  // ("Os seus 1 anuncio esta no ar" -- visto na tela antes de corrigir), e
  // "O seu 1 anuncio" soa pior ainda.

  // ★ `span`, NAO `Link`: na lista de lojas o card inteiro ja e um <Link>, e
  //   ancora dentro de ancora e HTML invalido -- o React reclama e o clique
  //   fica ambiguo. Quem clica no card cai na Visao geral, que mostra a faixa
  //   inteira com o botao. Mesma licao da galeria dentro do <Link> na vitrine.
  if (compacto) {
    return (
      <span style={S.mini}>
        <IconWallet size={14} color="#f59e0b" />
        <span>{oQue} sem poder receber pagamento</span>
      </span>
    )
  }

  return (
    <div style={S.faixa}>
      <span style={S.icone}><IconWallet size={20} color="#f59e0b" /></span>
      <div style={S.texto}>
        <strong style={S.titulo}>Você tem {oQue} no ar, e ninguém consegue comprar</strong>
        <p style={S.linha}>
          {total === 1 ? 'Ele aparece' : 'Eles aparecem'} normalmente para quem visita, mas sem o botão de
          comprar — o cliente só consegue entrar em contato, e a venda acontece por fora da Bynx.
        </p>
        {/* ★ A segunda linha responde o que trava o lojista de verdade, e nao
            "leva 3 minutos": quanto custa, o que ele precisa ter na mao agora,
            pra onde vai o dinheiro e quem ve os dados dele. Sao 9 lojas que
            nunca abriram o onboarding -- ninguem deixa de ativar por achar que
            demora, deixa por nao saber o que vem pela frente. */}
        <p style={S.linha}>
          Ativar não custa nada: você preenche CNPJ ou CPF e a conta bancária direto na Stripe, em uns
          3 minutos. O dinheiro de cada venda cai nessa conta, e a Bynx nunca vê esses dados.
        </p>
      </div>
      <Link href={`/minha-loja/${lojaId}/pagamentos`} style={S.botao}>Ativar recebimentos</Link>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  faixa: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)',
    borderRadius: 14, padding: '14px 16px',
  },
  icone: {
    width: 38, height: 38, flex: '0 0 auto', borderRadius: 10,
    background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  // minWidth 0 + flex 1: sem isso o texto empurra o botao pra fora no mobile.
  texto: { flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
  titulo: { fontSize: 13.5, fontWeight: 800, color: '#f59e0b', lineHeight: 1.35 },
  linha: { fontSize: 12.5, color: 'var(--bx-text-2)', margin: 0, lineHeight: 1.5 },
  botao: {
    flex: '0 0 auto', background: '#f59e0b', color: '#0d0f14', padding: '10px 16px',
    borderRadius: 10, fontSize: 12.5, fontWeight: 800, textDecoration: 'none',
    minHeight: 44, display: 'inline-flex', alignItems: 'center',
  },
  mini: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
    fontSize: 11.5, fontWeight: 700, color: '#f59e0b', textDecoration: 'none',
    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
    borderRadius: 8, padding: '6px 9px',
  },
}
