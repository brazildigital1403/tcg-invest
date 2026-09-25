'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { IconWallet } from '@/components/ui/Icons'

/**
 * Faixa em "Meus anúncios": a pessoa tem carta no ar e ninguem consegue comprar.
 *
 * ★ E O IRMAO DO `AvisoRecebimentos` (que e da loja), para quem NAO TEM LOJA.
 * A licao daquele vale inteira aqui: o problema nunca foi falta de tela, foi
 * falta de aviso ONDE a pessoa olha. Criar /recebimentos e nao avisar em lugar
 * nenhum seria "grava mas nao le" de novo -- so que em UX.
 *
 * ★ QUEM TEM LOJA NAO VE ESTA FAIXA: a dela e a da loja, que aponta para o
 * painel certo. Duas faixas dizendo a mesma coisa em lugares diferentes seria
 * ruido, e a de la ja existe desde 12/09.
 *
 * ★ SO APARECE COM ANUNCIO NO AR. Sem anuncio nao ha venda sendo perdida, e a
 * ativacao nem e permitida (a rota exige pelo menos um). O numero entra no
 * texto porque "seus 6 anuncios" move, e "ative os recebimentos" nao.
 *
 * ★ LEITURA PELO PROPRIO DONO: a RLS de `users` libera SELECT da propria linha,
 * entao o cliente consegue ler o status sem rota nenhuma. O que ele NAO
 * consegue e escrever -- nao existe GRANT UPDATE para `authenticated`.
 */
export default function AvisoRecebimentoPessoa({
  userId,
  anunciosNoAr,
}: {
  userId: string | null
  /** Anuncios realmente no ar. Zero esconde a faixa. */
  anunciosNoAr: number
}) {
  const [mostrar, setMostrar] = useState(false)
  const [temCep, setTemCep] = useState(true)

  useEffect(() => {
    if (!userId || anunciosNoAr === 0) { setMostrar(false); return }
    let vivo = true
    async function checar() {
      const [me, lojas] = await Promise.all([
        supabase.from('users').select('connect_charges_enabled, cep').eq('id', userId!).maybeSingle(),
        supabase.from('lojas').select('id').eq('owner_user_id', userId!).eq('status', 'ativa').limit(1),
      ])
      if (!vivo || me.error) return
      const temLoja = (lojas.data?.length || 0) > 0
      setTemCep(String(me.data?.cep || '').replace(/\D/g, '').length === 8)
      setMostrar(!temLoja && !me.data?.connect_charges_enabled)
    }
    checar()
    return () => { vivo = false }
  }, [userId, anunciosNoAr])

  if (!mostrar) return null

  const quantos = `${anunciosNoAr} ${anunciosNoAr === 1 ? 'anúncio' : 'anúncios'}`

  return (
    <div style={S.faixa}>
      <span style={S.icone}><IconWallet size={20} color="#f59e0b" /></span>
      <div style={S.texto}>
        <strong style={S.titulo}>
          Você tem {quantos} no ar, e ninguém consegue comprar
        </strong>
        <p style={S.linha}>
          {anunciosNoAr === 1 ? 'Ele aparece' : 'Eles aparecem'} normalmente no Mercado, mas sem o botão
          de comprar — quem se interessa só consegue conversar, e a venda acontece por fora da Bynx.
        </p>
        <p style={S.linha}>
          {temCep
            ? 'Ativar não custa nada: você preenche CPF (ou CNPJ) e a conta bancária direto na Stripe, em uns 3 minutos. O dinheiro de cada venda cai nessa conta, e a Bynx nunca vê esses dados.'
            : 'Você precisa do CEP de onde posta (é por ele que o frete é calculado) e de uns 3 minutos para preencher CPF e conta bancária direto na Stripe.'}
        </p>
      </div>
      <Link href="/recebimentos" style={S.botao}>Ativar recebimentos</Link>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  faixa: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.28)',
    borderRadius: 14, padding: '14px 16px', marginBottom: 20,
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
}
