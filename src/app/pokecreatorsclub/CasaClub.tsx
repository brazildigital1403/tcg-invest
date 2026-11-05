'use client'

// Casa do Club (wireframe aprovado em 05/11/2026, quadros C01 a C10 e D1/D2).
// Uma tarefa por vez no topo e as frentes logo abaixo. A casa nunca mostra o par
// do sorteio, porque criador grava a tela: o @ so existe dentro da sala.
//
// Hoje o Amigo Secreto e a unica frente no ar. Nova frente entra como mais um
// cartao, sem "em breve".

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import {
  AMIGO_SECRETO_SLUG, dataCurta, dataHora, type EdicaoPublica, type MinhaSala,
} from '@/lib/amigoSecreto'
import { AMIGO_SECRETO, AMIGO_SECRETO_SALA, CLUB } from '@/lib/pcc/rotas'
import { AS_CSS, Ico, LOGO_PCC } from './amigo-secreto/estilo'

type Tarefa = { titulo: string; texto: string; botao: string }

/** Tarefas da pessoa no Amigo Secreto, da mais urgente para a menos urgente. */
function tarefasDe(sala: MinhaSala | null): Tarefa[] {
  if (!sala || !sala.inscrito) return []
  const { eu, tirou, recebo, estado } = sala
  if (estado === 'inscricoes') {
    if (eu.perfil_completo) return []
    const temEndereco = !!(eu.cep && eu.numero)
    const temDica = eu.me_surpreenda || !!(eu.desejo && eu.desejo.trim())
    const faltam = [temEndereco, temDica].filter(ok => !ok).length
    return [{ titulo: 'Falta completar seu perfil', texto: `Amigo Secreto: ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`} de 3 itens.`, botao: 'Completar' }]
  }
  if (estado === 'encerrado') return []
  const lista: Tarefa[] = []
  if (tirou && !eu.postado_em) lista.push({ titulo: 'Você tem um presente para enviar', texto: `Postar até ${dataCurta(sala.postar_ate)}.`, botao: 'Ver' })
  if (recebo?.postado_em && !eu.recebido_em) lista.push({ titulo: 'Seu presente chegou?', texto: 'Confirme só com o presente na mão.', botao: 'Confirmar' })
  return lista
}

export default function CasaClub() {
  const { openLogin } = useAuthModal()
  const [logado, setLogado] = useState<boolean | undefined>(undefined)
  const [edicao, setEdicao] = useState<EdicaoPublica | null | undefined>(undefined)
  const [sala, setSala] = useState<MinhaSala | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async () => {
    if (logado === undefined) return
    setFalhou(false)
    const [e, m] = await Promise.all([
      supabase.rpc('amigo_secreto_edicao_publica', { p_slug: AMIGO_SECRETO_SLUG }),
      logado ? supabase.rpc('amigo_secreto_meu', { p_slug: AMIGO_SECRETO_SLUG }) : Promise.resolve({ data: null, error: null }),
    ])
    if (e.error) { setFalhou(true); setEdicao(null) } else setEdicao((e.data as EdicaoPublica | null) ?? null)
    if (m.error) { setFalhou(true); setSala(null) } else setSala((m.data as MinhaSala | null) ?? null)
  }, [logado])

  useEffect(() => { carregar() }, [carregar])

  const inscrito = !!sala?.inscrito
  const tarefas = tarefasDe(sala)
  const tarefa = tarefas[0]
  const encerrada = edicao?.estado === 'encerrado'
  const aberta = !!edicao && edicao.estado === 'inscricoes' && Date.parse(edicao.inscricoes_ate) > Date.now()
  const destino = inscrito ? AMIGO_SECRETO_SALA : AMIGO_SECRETO
  const mostrarApresentacao = !inscrito

  return (
    <div className="as cl">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <Link href={CLUB} className="as-logo-a" aria-label="Poké Creators Club"><Image src={LOGO_PCC} alt="" width={438} height={218} className="as-logo cl-logo" priority /></Link>
          <span className="t">na Bynx</span>
          {logado
            ? <Link href="/minha-conta" className="as-ib" aria-label="Minha conta"><Ico n="user" s={22} /></Link>
            : <button type="button" className="as-btn lnk sm cl-entrar" disabled={logado === undefined} onClick={() => openLogin({ next: CLUB, cta: 'Entrar no Club' })}>Entrar</button>}
        </div>
      </header>

      <main className="bx-gutter as-main-hero">
        <div className="as-wrap as-bd">
          {falhou && (
            <div className="as-note strong cl-falha" role="alert">
              <span>Não conseguimos carregar suas tarefas.</span>
              <button type="button" className="as-btn lnk sm" onClick={carregar}>Tentar de novo</button>
            </div>
          )}

          {tarefa && (
            <section className="as-mis" aria-label="Sua missão agora">
              <div className="as-eye"><Ico n="star" s={14} />Sua missão agora</div>
              <h2 className="as-h3">{tarefa.titulo}</h2>
              <p className="as-meta">{tarefa.texto}</p>
              <Link href={AMIGO_SECRETO_SALA} className="as-btn pri">{tarefa.botao}</Link>
              {tarefas.length > 1 && <Link href={AMIGO_SECRETO_SALA} className="as-btn lnk">Ver mais 1 tarefa</Link>}
            </section>
          )}

          {mostrarApresentacao ? (
            <section className="cl-hero">
              <div className="cl-hero-tx">
                <Image src={LOGO_PCC} alt="Poké Creators Club" width={438} height={218} className="cl-marca" priority />
                <h1 className="as-h1">A casa do <em>Club</em></h1>
                <p className="as-p">O que o grupo faz junto, em um lugar só.</p>
              </div>
              <div className="cl-leque" aria-hidden="true">
                <div className="as-verso"><Ico n="gift" s={32} /></div>
                <div className="as-verso"><Image src={LOGO_PCC} alt="" width={438} height={218} className="cl-verso-logo" /></div>
                <div className="as-verso"><Ico n="star" s={32} /></div>
              </div>
            </section>
          ) : <h1 className="as-h2">A casa do Club</h1>}

          {edicao === undefined && <div className="as-card" aria-busy="true"><div className="as-k">Carregando o Club...</div></div>}

          {edicao !== undefined && !encerrada && (
            <CartaoAmigoSecreto edicao={edicao} inscrito={inscrito} aberta={aberta} destaque={!tarefa} destino={destino} sala={sala} logado={!!logado} />
          )}

          {encerrada && edicao && (
            <>
              <div className="as-center cl-vazio"><span className="as-meta">Nada aberto agora.<br />Novidade sai no grupo.</span></div>
              <div className="as-k">Edições passadas</div>
              <div className="as-card cl-passadas">
                <Link href={destino} className="as-row">
                  <span className="l"><span className="as-verso cl-verso-mini" aria-hidden="true" /><span>Amigo Secreto<small>Edição encerrada · {dataCurta(edicao.revelacao_em)}</small></span></span>
                  <Ico n="chev" className="arr" />
                </Link>
              </div>
            </>
          )}

          {!inscrito && logado !== undefined && <div className="as-note">O Club vive no grupo de WhatsApp. Para entrar, fale com quem administra.</div>}

          <footer className="as-foot">
            <span>Poké Creators Club na Bynx</span>
            <span><Link href="/termos">Termos</Link>·<Link href="/privacidade">Privacidade</Link></span>
          </footer>
        </div>
      </main>
      <style>{AS_CSS + CL_CSS}</style>
    </div>
  )
}

function CartaoAmigoSecreto({ edicao, inscrito, aberta, destaque, destino, sala, logado }: {
  edicao: EdicaoPublica | null; inscrito: boolean; aberta: boolean; destaque: boolean; destino: string; sala: MinhaSala | null; logado: boolean
}) {
  // Sem edicao (falha ao ler o banco): o cartao continua, so sem o estado.
  if (!edicao) {
    return (
      <section className="as-card cl-frente">
        <div className="cl-frente-g">
          <div className="as-verso sm" aria-hidden="true"><Ico n="gift" s={24} /></div>
          <div className="cl-frente-tx"><h2 className="as-h3">Amigo Secreto</h2><p className="as-meta">Troca de presentes em segredo.</p></div>
        </div>
        <Link href={destino} className="as-btn">Abrir</Link>
      </section>
    )
  }
  const completo = sala?.inscrito ? sala.eu.perfil_completo : false
  const chip = edicao.estado === 'inscricoes'
    ? (inscrito && completo ? 'Perfil pronto' : aberta ? 'Inscrições abertas' : 'Inscrições encerradas')
    : edicao.estado === 'sorteado' ? 'Sorteio feito' : 'Entregas'
  const linhaData = edicao.estado === 'inscricoes' ? `Sorteio em ${dataHora(edicao.sorteio_em)}.` : `Postar até ${dataCurta(edicao.postar_ate)}.`
  const linha = inscrito ? linhaData : `Troca de presentes em segredo. ${linhaData}`
  const botao = inscrito ? 'Abrir a sala' : aberta ? (logado ? 'Abrir' : 'Participar') : 'Ver'
  const principal = destaque && !inscrito && aberta
  return (
    <section className={principal ? 'as-mis cl-frente' : 'as-card cl-frente'}>
      <div className="cl-frente-g">
        <div className={`as-verso${principal ? '' : ' sm'}`} aria-hidden="true"><Ico n="gift" s={principal ? 28 : 24} /></div>
        <div className="cl-frente-tx">
          <span className={`as-chip${principal ? ' fill' : completo ? ' ok' : ''}`}>{chip}</span>
          <h2 className="as-h3">Amigo Secreto</h2>
          <p className="as-meta">{linha}</p>
        </div>
      </div>
      <Link href={destino} className={`as-btn${principal ? ' pri' : ''}`}>{botao}</Link>
    </section>
  )
}

const CL_CSS = `
.cl .as-logo.cl-logo{height:36px}
.cl-entrar{min-height:44px;padding:0 8px;margin-right:-4px}
.cl-falha{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cl-falha .as-btn{flex:none}
.cl-hero{display:flex;flex-direction:column;gap:10px;padding:8px 0 4px}
.cl-hero-tx{display:flex;flex-direction:column;gap:10px;min-width:0}
.cl-marca{width:176px;height:auto;display:block;margin-left:-6px}
.cl-leque{display:none}
.cl-frente .as-verso{cursor:default}
.cl-frente .as-verso:hover{transform:none}
.cl-frente-g{display:flex;gap:14px;align-items:flex-start}
.cl-frente-tx{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.cl-frente .as-verso{width:84px}
.cl-frente .as-verso.sm{width:56px}
.cl-vazio{padding:24px 0;border:1px dashed var(--bx-border-2);border-radius:12px}
.cl-passadas{padding:0 12px}
.cl-passadas .as-row{text-decoration:none;min-height:64px}
.cl-passadas .as-verso.cl-verso-mini{width:28px;border-radius:6px}
.cl-passadas .cl-verso-mini:before,.cl-passadas .cl-verso-mini:after{display:none}
.cl-verso-logo{position:relative;width:76%;height:auto;display:block}
@media (min-width:1024px){
  .cl .as-logo.cl-logo{height:40px}
  .cl-hero{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);column-gap:24px;align-items:center;padding:24px 0}
  .cl-marca{display:none}
  .cl-leque{display:flex;justify-content:center;padding:12px 0}
  .cl-leque .as-verso{width:172px;margin:0 -22px}
  .cl-leque .as-verso:nth-child(1){transform:rotate(-10deg)}
  .cl-leque .as-verso:nth-child(2){position:relative;z-index:1}
  .cl-leque .as-verso:nth-child(3){transform:rotate(10deg)}
  .cl-frente{padding:24px}
  .cl-frente-g{gap:20px;align-items:center}
  .cl-frente .as-btn{width:auto;align-self:flex-start;min-width:220px}
}
`
