'use client'

// Album do Club no /admin (21/11/2026, fatia 3 do plano da Fase 1; Fase 2: nova edicao, nova carta e
// missao como dado). Visao de dono: a edicao e as cartas (nome, texto, arte, previa, publicar), conceder em lote com previa (por @ ou e-mail, e
// o atalho da camiseta), o historico com desfazer lote e os pedidos do set fisico. Nada aparece
// para membro enquanto a edicao estiver em rascunho. As regras ficam no banco (club_*_interno);
// esta tela so fala com /api/admin/colecao.

import { useCallback, useEffect, useState } from 'react'
import { AdminFaixa, AdminPage, AdminVazio } from '@/components/admin/AdminPage'
import { CARTA_CSS } from '@/app/pokecreatorsclub/album/CartaClub'
import type { PainelAdmin } from '@/lib/pcc/albumAdmin'
import { AC_CSS } from './estilo'
import CartasAdmin from './CartasAdmin'
import ConcederAdmin from './ConcederAdmin'
import EdicaoBloco from './EdicaoBloco'
import HistoricoAdmin from './HistoricoAdmin'
import { NovaEdicao } from './MissaoAdmin'
import PedidosAdmin from './PedidosAdmin'

type Aba = 'cartas' | 'conceder' | 'historico' | 'pedidos'

async function lerPainel(slug: string | null): Promise<{ painel?: PainelAdmin; erro?: string }> {
  const res = await fetch(`/api/admin/colecao${slug ? `?slug=${encodeURIComponent(slug)}` : ''}`)
  const d = await res.json().catch(() => ({}))
  if (!res.ok) return { erro: d.error || `Erro ${res.status}` }
  return { painel: d.painel as PainelAdmin }
}

export default function AdminColecaoPage() {
  const [painel, setPainel] = useState<PainelAdmin | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [aba, setAba] = useState<Aba>('cartas')
  const [versao, setVersao] = useState(0)
  const [falhou, setFalhou] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [novaEdicao, setNovaEdicao] = useState(false)

  // Cada acao que muda algo avisa aqui: o painel e as abas de historico e pedidos leem de novo.
  const mudou = useCallback(() => setVersao(v => v + 1), [])

  useEffect(() => {
    let vivo = true
    lerPainel(slug).then(r => {
      if (!vivo) return
      if (r.erro || !r.painel) { setFalhou(r.erro || 'Erro ao carregar'); return }
      setPainel(r.painel)
      setFalhou('')
    })
    return () => { vivo = false }
  }, [slug, versao])

  // Aviso de uma aba nao serve para a outra: trocar de aba limpa o que ficou na faixa.
  const trocarAba = useCallback((a: Aba) => { setAba(a); setErro(''); setOk('') }, [])

  const irParaCarta = useCallback((numero: number) => {
    setAba('cartas')
    setTimeout(() => document.getElementById(`carta-${numero}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }, [])

  const ed = painel?.edicao || null
  const abas: [Aba, string][] = [['cartas', 'Cartas'], ['conceder', 'Conceder'], ['historico', 'Histórico'], ['pedidos', `Pedidos do set${ed && ed.resumo.pedidos_ativos > 0 ? ` (${ed.resumo.pedidos_ativos})` : ''}`]]

  return (
    <AdminPage titulo="Álbum do Club" largura="larga"
      subtitulo="Poké Creators Club. As cartas de cada edição, quem ganhou o quê e os pedidos do set físico. Os membros só veem a edição publicada.">
      {falhou && !painel && <AdminFaixa tom="erro">{falhou}</AdminFaixa>}
      {erro && <AdminFaixa tom="erro">{erro}</AdminFaixa>}
      {ok && <AdminFaixa tom="ok">{ok}</AdminFaixa>}
      {!painel && !falhou && <AdminVazio>Carregando...</AdminVazio>}
      {painel && !ed && <AdminVazio>Nenhuma edição por aqui ainda.</AdminVazio>}

      {painel && (
        <div className="ac-tabs">
          {painel.edicoes.map(e => <button key={e.slug} type="button" title={e.titulo} className={`ac-tab${ed?.slug === e.slug ? ' on' : ''}`} onClick={() => { setSlug(e.slug); setErro(''); setOk('') }}>{e.edicao} · {e.titulo}</button>)}
          {!novaEdicao && <button type="button" className="ac-tab" onClick={() => { setNovaEdicao(true); setErro(''); setOk('') }}>Nova edição</button>}
        </div>
      )}
      {novaEdicao && <NovaEdicao onFechar={() => setNovaEdicao(false)} onCriada={s => { setSlug(s); setAba('cartas'); mudou() }} onErro={setErro} onOk={setOk} />}

      {ed && (
        <>
          <EdicaoBloco ed={ed} onMudou={mudou} onErro={setErro} onOk={setOk} onIrParaCarta={irParaCarta} />
          <div className="ac-tabs" role="tablist">
            {abas.map(([id, rotulo]) => <button key={id} type="button" role="tab" aria-selected={aba === id} className={`ac-tab${aba === id ? ' on' : ''}`} onClick={() => trocarAba(id)}>{rotulo}</button>)}
          </div>
          {aba === 'cartas' && <CartasAdmin ed={ed} onMudou={mudou} onErro={setErro} onOk={setOk} />}
          {aba === 'conceder' && <ConcederAdmin ed={ed} onMudou={mudou} onErro={setErro} onOk={setOk} />}
          {aba === 'historico' && <HistoricoAdmin ed={ed} versao={versao} onMudou={mudou} onErro={setErro} onOk={setOk} />}
          {aba === 'pedidos' && <PedidosAdmin ed={ed} versao={versao} onMudou={mudou} onErro={setErro} onOk={setOk} />}
        </>
      )}
      <style>{AC_CSS + CARTA_CSS}</style>
    </AdminPage>
  )
}
