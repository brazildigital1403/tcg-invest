'use client'

// Landing do convite de grupo para criadores. Especificacao do PO e copy final
// das revisoras (workflow de 13 agentes, 23/10/2026), mockup aprovado pelo Du.
//
// Seis secoes: hero, Colecao, Graduadas, Conteudo, Parceria e passos/FAQ. O
// CTA abre o cadastro de 3 campos (nome, e-mail, senha). A conta nasce
// confirmada no servidor e o ano de Pro e liberado ali mesmo; quem ja tem conta
// entra pela barra do topo e ativa o ano pelo mesmo botao.
//
// Nada de numero cravado: as cartas sao do catalogo (storage da Bynx) e o
// patrimonio aparece mascarado, como exemplo.

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import Turnstile from '@/components/auth/Turnstile'
import SlabArte, { SLAB_ARTE_CSS } from '@/components/graduadas/SlabArte'
import { trackSignUp } from '@/lib/analytics'
import { SENHA_REGRA_MSG } from '@/lib/senha'
import { APRESENTACAO_PARCERIA } from '@/lib/parceriaMaterial'
import {
  IconCalendar, IconCheck, IconChevronDown, IconClock, IconClose, IconInstagram, IconLink, IconAccount, IconCollection,
  IconCard, IconShare, IconDownload, IconChart, IconPokeball,
} from '@/components/ui/Icons'

const IMG = 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/'

// Hero (26/10/2026): o trio do Base Set, com o Charizard numa slab PSA 10.
// Imagens do catalogo (as mesmas da pagina da carta), via next/image.
const TRIO = {
  pikachu: 'https://images.pokemontcg.io/base1/58_hires.png',
  mewtwo: 'https://images.pokemontcg.io/base1/10_hires.png',
  charizard: 'https://images.pokemontcg.io/base1/4_hires.png',
}
const SLAB_BGS = { nome: 'Jirachi ex', img: `${IMG}30C-Jirachi-ex-102.jpg` }
const SLAB_PSA = { nome: 'Pikachu', img: `${IMG}30C-Pikachu-036.jpg` }
const MINIS = [`${IMG}30C-Lapras-131.jpg`, `${IMG}30C-Espeon-ex-070.jpg`, `${IMG}30C-Greninja-ex-021.jpg`]

// Prova social: posts reais de parceiros (pedido do Du, 25/10/2026). A capa
// fica no Storage da Bynx porque a URL de imagem do Instagram expira; o
// toque abre o post no Instagram. Ja vem com o play do Instagram embutido.
const CAPA_POST = 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/parceria-material/prova-'
type Post = { autor: string; titulo: string; capa: string; href: string }
const PROVA: Post[] = [
  { autor: '@oinstadodelimas', titulo: 'Pikachus de 30 anos para fechar o Master Set', capa: `${CAPA_POST}Det6WBgxp6o.jpg`, href: 'https://www.instagram.com/p/Det6WBgxp6o/' },
  { autor: '@poke.fatos', titulo: 'Quanto vale a sua coleção de cartas Pokémon?', capa: `${CAPA_POST}Deb-fJ7Rh2S.jpg`, href: 'https://www.instagram.com/p/Deb-fJ7Rh2S/' },
  { autor: '@weslleyverso', titulo: 'A coleção cadastrada, com o valor em reais', capa: `${CAPA_POST}DdUEqnjuE10.jpg`, href: 'https://www.instagram.com/p/DdUEqnjuE10/' },
]

// Contrapartida em 3 passos (perfil -> conteudo -> comunidade). A arte e
// carta real do storage, a mesma regra do resto da pagina.
const CONTRAPARTIDA = [
  { titulo: 'Ative seu perfil', carta: 'https://hvkcwfcvizrvhkerupfc.supabase.co/storage/v1/object/public/card-images/MEP-Bulbasaur.jpg',
    texto: 'Organize e mostre o que faz sentido para você: sets, Master Sets, slabs ou a coleção inteira.' },
  { titulo: 'Compartilhe sua experiência', carta: `${IMG}30C-Pikachu-037.jpg`,
    texto: 'Mostre uma carta, uma meta, uma pasta ou uma descoberta real. Sem roteiro pronto.' },
  { titulo: 'Leve para a comunidade', carta: `${IMG}30C-Eevee-116.jpg`,
    texto: 'Seu cupom dá 20% de desconto na primeira cobrança. Indicações válidas podem gerar comissão para você.' },
]

type Estado = 'carregando' | 'ativo' | 'encerrado' | 'invalido'
type Sucesso = { proAte: string | null; aviso: string | null }

const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

const dataBR = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

type Motivo = 'vagas' | 'prazo' | 'desligado' | null
type VagasCtx = { restantes: number | null; vagas: number | null; expiraEm: string | null; pulso: number }

// Faixas do contador (mockup aprovado em 25/10/2026): acima de 20 neutro,
// 20 a 11 muda de cor, 10 ou menos vermelho com aviso fixo. Sem loop: o unico
// movimento e um pulso quando o numero cai com a pessoa na pagina.
function faixa(r: number): '' | 'f20' | 'f10' {
  return r <= 10 ? 'f10' : r <= 20 ? 'f20' : ''
}

/** "Até 06/11, 23h59", ou o destaque "Termina hoje/amanhã às 23h59" a menos de 24 h. */
function linhaPrazo(expiraEm: string): { texto: string; urgente: boolean } {
  const fim = new Date(expiraEm)
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(fim).replace(':', 'h')
  const falta = fim.getTime() - Date.now()
  if (falta > 0 && falta < 24 * 3600_000) {
    const dia = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
    return { texto: `Termina ${dia(fim) === dia(new Date()) ? 'hoje' : 'amanhã'} às ${hora}`, urgente: true }
  }
  return { texto: `Até ${dataCurta(expiraEm)}, às ${hora}, ou enquanto durarem os convites.`, urgente: false }
}

function fraseFechamento(restantes: number | null, vagas: number | null, expiraEm: string | null): string {
  const fim = 'Sem cartão e sem cobrança automática no fim.'
  if (restantes === null || !vagas || !expiraEm) return fim
  const ate = `até ${dataCurta(expiraEm)}. ${fim}`
  if (restantes === 1) return `Último convite para creators de Pokémon TCG, ${ate}`
  if (restantes <= 20) return `Restam ${restantes} de ${vagas} convites para creators de Pokémon TCG, ${ate}`
  return `${restantes} convites disponíveis para creators de Pokémon TCG, ${ate}`
}

/** Bloco do hero: numero, regua de convites e prazo. */
function Contador({ restantes, vagas, expiraEm, pulso, carregando }: VagasCtx & { carregando: boolean }) {
  const prazo = expiraEm ? linhaPrazo(expiraEm) : null
  if (restantes === null || !vagas) {
    // Carregando: espaco reservado, sem numero. Erro: so o prazo (o teto nao e o que resta).
    if (carregando) return <div className="cr-ct cr-ct-vazio" aria-hidden="true"><span className="cr-ct-sk" /></div>
    return prazo ? <div className="cr-ct"><p className="cr-ct-p" style={{ marginTop: 0 }}><IconClock size={14} />{prazo.texto}</p></div> : null
  }
  const f = faixa(restantes)
  const usadas = Math.max(0, vagas - restantes)
  return (
    <div className={`cr-ct ${f}${prazo?.urgente ? ' cr-ct-urg' : ''}`}>
      <p className="cr-ct-l" aria-live="polite">
        {restantes === 1 ? <span key={pulso} className={`cr-ct-n${pulso ? ' cr-ct-pulso' : ''}`}>Último convite</span>
          : restantes <= 10 ? <><span className="cr-ct-pre">Últimos</span><span key={pulso} className={`cr-ct-n${pulso ? ' cr-ct-pulso' : ''}`}>{restantes}</span><span className="cr-ct-t">convites</span></>
          : restantes <= 20 ? <><span className="cr-ct-pre">Restam</span><span key={pulso} className={`cr-ct-n${pulso ? ' cr-ct-pulso' : ''}`}>{restantes}</span><span className="cr-ct-t">de {vagas} convites</span></>
          : <><span key={pulso} className={`cr-ct-n${pulso ? ' cr-ct-pulso' : ''}`}>{restantes}</span><span className="cr-ct-t">convites disponíveis</span></>}
      </p>
      {vagas <= 60 ? (
        <div className="cr-ct-regua" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${vagas}, minmax(0, 1fr))` }}>
          {Array.from({ length: vagas }, (_, i) => <i key={i} className={i < usadas ? 'u' : ''} />)}
        </div>
      ) : (
        <div className="cr-ct-barra-cont" aria-hidden="true"><i style={{ width: `${(restantes / vagas) * 100}%` }} /></div>
      )}
      {prazo && <p className="cr-ct-p"><IconClock size={14} />{prazo.texto}</p>}
      {restantes <= 10 && (
        <p className="cr-ct-av"><span className="cr-ct-dot" aria-hidden="true" />{restantes === 1 ? 'Este é o último convite do programa.' : `Restam ${restantes} convites. O programa fecha quando acabarem.`}</p>
      )}
    </div>
  )
}

/** Versao em uma linha: barra fixa do celular e pilula do cabecalho no desktop. */
function ContadorCurto({ restantes, vagas, expiraEm, classe }: VagasCtx & { classe: string }) {
  if (restantes === null || !vagas) return null
  const f = faixa(restantes)
  return (
    <p className={`${classe} ${f}`}>
      {restantes === 1 ? <b>Último convite</b>
        : restantes <= 10 ? <>Últimos <b>{restantes}</b> convites</>
        : restantes <= 20 ? <>Restam <b>{restantes}</b> de {vagas} convites</>
        : <><b>{restantes}</b> convites disponíveis{expiraEm ? ` · até ${dataCurta(expiraEm)}` : ''}</>}
    </p>
  )
}

export default function CriadoresClient() {
  const { openLogin } = useAuthModal()
  const [codigo, setCodigo] = useState<string | null>(null)
  const [estado, setEstado] = useState<Estado>('carregando')
  const [expiraEm, setExpiraEm] = useState<string | null>(null)
  const [vagas, setVagas] = useState<number | null>(null)
  const [restantes, setRestantes] = useState<number | null>(null)
  const [motivo, setMotivo] = useState<Motivo>(null)
  const [erroConvite, setErroConvite] = useState(false)
  const [pulso, setPulso] = useState(0)
  const ultimaBusca = useRef(0)
  const restantesRef = useRef<number | null>(null)
  const [logado, setLogado] = useState(false)
  const [folha, setFolha] = useState(false)
  const [sucesso, setSucesso] = useState<Sucesso | null>(null)
  const [erroTopo, setErroTopo] = useState('')
  const [ativando, setAtivando] = useState(false)
  const [heroVisivel, setHeroVisivel] = useState(true)
  const heroCta = useRef<HTMLButtonElement | null>(null)
  const visitaFeita = useRef(false)

  const evento = useCallback((etapa: 'visita' | 'cta', c: string) => {
    fetch('/api/criadores/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c, etapa }), keepalive: true }).catch(() => {})
  }, [])

  // Busca o convite (estado, prazo, teto e vagas restantes). Roda ao abrir,
  // ao voltar para a aba e ao abrir o cadastro, no maximo 1 vez por minuto
  // (`forcar` ignora o limite so na primeira carga). Sem polling: o numero e
  // uma linha por codigo, e o servidor e quem decide no envio.
  const carregarConvite = useCallback((c: string, forcar = false) => {
    const agora = Date.now()
    if (!forcar && agora - ultimaBusca.current < 60_000) return
    ultimaBusca.current = agora
    fetch(`/api/criadores/convite?c=${encodeURIComponent(c)}`)
      .then(r => r.json())
      .then((d: { estado?: Estado; expiraEm?: string; vagas?: number; restantes?: number; motivo?: Motivo }) => {
        setErroConvite(false)
        setEstado(d.estado === 'ativo' || d.estado === 'encerrado' ? d.estado : 'invalido')
        setExpiraEm(d.expiraEm || null)
        setVagas(typeof d.vagas === 'number' ? d.vagas : null)
        setMotivo(d.motivo || null)
        if (typeof d.restantes === 'number') {
          // Pulso unico so quando o numero CAI com a pessoa na pagina.
          if (restantesRef.current !== null && d.restantes < restantesRef.current) setPulso(n => n + 1)
          restantesRef.current = d.restantes
          setRestantes(d.restantes)
        }
        if (d.estado === 'ativo' && !visitaFeita.current) { visitaFeita.current = true; evento('visita', c) }
      })
      .catch(() => {
        // Erro de rede nao vira "link invalido": a pagina segue sem numero e
        // o servidor confere o convite no envio.
        setErroConvite(true)
        setEstado(e => (e === 'carregando' ? 'ativo' : e))
      })
  }, [evento])

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c')
    setCodigo(c)
    if (!c) { setEstado('invalido'); return }
    carregarConvite(c, true)
    const aoVoltar = () => { if (document.visibilityState === 'visible') carregarConvite(c) }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [carregarConvite])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogado(!!data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Barra fixa de CTA so aparece quando o botao do hero sai da tela.
  useEffect(() => {
    const el = heroCta.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setHeroVisivel(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [estado])

  const voltarAqui = codigo ? `/criadores?c=${encodeURIComponent(codigo)}` : '/criadores'

  async function ativarComConta() {
    if (!codigo) return
    setErroTopo('')
    setAtivando(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) { openLogin({ next: voltarAqui }); return }
      const res = await fetch('/api/criadores/resgatar', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ c: codigo }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (d.code === 'CONVITE_ENCERRADO') setEstado('encerrado')
        setErroTopo(d.error || 'Não conseguimos liberar o seu ano agora.')
        return
      }
      setSucesso({ proAte: d.proAte || null, aviso: null })
      window.scrollTo({ top: 0 })
    } catch {
      setErroTopo('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setAtivando(false)
    }
  }

  function cta() {
    if (!codigo || estado !== 'ativo') return
    evento('cta', codigo)
    if (logado) ativarComConta()
    else { setFolha(true); carregarConvite(codigo) }
  }

  if (sucesso) return <TelaSucesso sucesso={sucesso} />
  if (estado === 'encerrado' || estado === 'invalido') return <TelaEncerrado invalido={estado === 'invalido'} motivo={motivo} vagas={vagas} />

  const ctaTexto = ativando ? 'Liberando...' : 'Liberar meu 1 ano grátis'
  const vagasCtx = { restantes: erroConvite ? null : restantes, vagas, expiraEm, pulso }

  return (
    <div className="cr">
      <style>{SLAB_ARTE_CSS + CSS}</style>
      <header className="cr-top bx-gutter">
        <Link href="/" className="cr-logo-a"><img src="/logo_BYNX.png" alt="Bynx" className="cr-logo" /></Link>
        <div className="cr-top-r">
          {logado
            ? <span className="cr-top-ok">Você está na sua conta</span>
            : <button type="button" className="cr-ghost" onClick={() => openLogin({ next: voltarAqui })}>Já tenho conta</button>}
          {!heroVisivel && !folha && estado === 'ativo' && (
            <>
              <ContadorCurto {...vagasCtx} classe="cr-ct-pill" />
              <button type="button" className="cr-top-cta" onClick={cta} disabled={ativando}>{ctaTexto}</button>
            </>
          )}
        </div>
      </header>

      <main>
        {/* 1. Hero: a oferta inteira no primeiro contato (12 meses, sem cartao,
            vagas e prazo) e o ganho do criador logo abaixo do botao. */}
        <section className="cr-sec cr-hero bx-gutter">
          <div className="cr-in">
            <p className="cr-eyebrow">Convite para criadores de Pokémon TCG</p>
            <h1 className="cr-h1"><span className="cr-lockup">Creator <b>Bynx</b></span><span className="cr-bene">Sua coleção já faz parte do seu conteúdo. <em>Agora ela trabalha a seu favor.</em></span></h1>
            <p className="cr-p cr-hero-sub">Ganhe 1 ano de Bynx Pro para organizar sua coleção, mostrar suas cartas em um perfil público e criar conteúdos melhores para a sua comunidade.</p>

            <figure className="cr-trio" aria-hidden="true">
              <div className="cr-trio-c cr-trio-l"><Image src={TRIO.pikachu} alt="" width={245} height={342} sizes="(min-width:1024px) 190px, (min-width:768px) 130px, 104px" /></div>
              <div className="cr-trio-c cr-trio-r"><Image src={TRIO.mewtwo} alt="" width={245} height={342} sizes="(min-width:1024px) 190px, (min-width:768px) 130px, 104px" /></div>
              <div className="cr-trio-slab">
                <SlabArte graduadora="psa" nota={10} img={TRIO.charizard} nome="Charizard" sizes="(min-width:1024px) 250px, (min-width:768px) 180px, 140px" priority altVazio />
              </div>
              <span className="cr-trio-tag"><b>sua coleção,</b> sua voz</span>
            </figure>

            <ul className="cr-oferta">
              <li><IconCalendar size={16} color="var(--ac-1)" />12 meses grátis</li>
              <li><IconCheck size={16} color="var(--ac-1)" />Sem cartão</li>
            </ul>
            <Contador {...vagasCtx} carregando={estado === 'carregando'} />
            {erroTopo && <p className="cr-erro" role="alert">{erroTopo}</p>}
            <button ref={heroCta} type="button" className="cr-cta" onClick={cta} disabled={ativando || estado !== 'ativo'}>{estado === 'carregando' ? 'Carregando...' : ctaTexto}</button>
            <p className="cr-micro">Sem cobrança no fim.</p>
            <div className="cr-chip-wrap"><a href="#parceria" className="cr-chip"><IconAccount size={14} color="var(--ac-1)" />Parceria: 20% para seus seguidores e comissão para você</a></div>
          </div>
        </section>

        {/* 2. Parceria: logo depois do hero, com a comissao em numero. */}
        <section className="cr-sec cr-s-par bx-gutter" id="parceria">
          <div className="cr-in">
            <p className="cr-eyebrow">Parceria</p>
            <h2 className="cr-h2">Sua comunidade ganha. Você também.</h2>
            <p className="cr-p">Quem acompanha você ganha desconto para conhecer a Bynx, enquanto você recebe comissão pelas indicações válidas feitas com o seu cupom.</p>
            <Parceria logado={logado} onPrecisaConta={() => setFolha(true)} />
          </div>
        </section>

        {/* 2b. Contrapartida do Bynx Creator 100. Versao enxuta (25/10/2026,
            revisao de texto do Du): o beneficio primeiro, o combinado uma vez so,
            3 passos curtos e o exemplo escondido num acordeao. */}
        <section className="cr-sec cr-s-ctr bx-gutter">
          <div className="cr-in">
            <div className="cr-ctr-intro">
              <p className="cr-eyebrow">Contrapartida · Bynx Creator 100</p>
              <h2 className="cr-h2">Sua coleção. Seu conteúdo. <em>Seu jeito.</em></h2>
              <p className="cr-p">Você recebe 1 ano de Bynx Pro para usar na sua coleção.</p>
              <p className="cr-ctr-combinado"><IconPokeball size={18} color="var(--ac-1)" /><span>O combinado é simples: <b>1 conteúdo público por mês já basta.</b> Post, Reel, Short, TikTok, carrossel ou até 3 Stories.</span></p>
            </div>
            <div className="cr-ctr-passos">
              {CONTRAPARTIDA.map((c, i) => (
                <article key={c.titulo} className={`cr-ctr-passo cr-ctr-p${i + 1}`}>
                  <div className="cr-ctr-arte" aria-hidden="true">
                    <Image src={c.carta} alt="" width={245} height={342} sizes="(min-width:1024px) 150px, 104px" />
                  </div>
                  <span className="cr-ctr-n">{String(i + 1).padStart(2, '0')}</span>
                  <h3>{c.titulo}</h3>
                  <p>{c.texto}</p>
                </article>
              ))}
            </div>
            <p className="cr-ctr-fecho">Sem roteiro pronto. Só a sua coleção.</p>
            <details className="cr-ctr-exemplo">
              <summary>Ver exemplo de conteúdo<IconChevronDown size={16} /></summary>
              <p className="cr-sug-n">Exemplo, não obrigação.</p>
              <p className="cr-sug-t">“Minha coleção agora está organizada na Bynx. Dá para acompanhar minhas cartas, Master Sets, slabs e o valor estimado do acervo. Quem usar o meu cupom ganha 20% de desconto na primeira cobrança.”</p>
            </details>
          </div>
        </section>

        {/* 3. Prova social: posts reais de parceiros (capas no Storage da Bynx;
            o link do Instagram expira). O toque abre o post no Instagram. */}
        <section className="cr-sec cr-s-cont bx-gutter">
          <div className="cr-in">
            <p className="cr-eyebrow">Quem já mostra a Bynx</p>
            <h2 className="cr-h2">Coleção organizada rende conteúdo melhor.</h2>
            <p className="cr-p">Pasta aberta na câmera, Master Set fechando, o valor da coleção em R$. Veja como criadores parceiros mostram a Bynx.</p>
            <div className="cr-rail">
              {PROVA.map(m => <CartaoPost key={m.href} m={m} />)}
            </div>
          </div>
        </section>

        {/* 4. Colecao: o perfil publico vem primeiro, porque e o ganho mais
            direto para quem cria conteudo. */}
        <section className="cr-sec cr-s-col bx-gutter">
          <div className="cr-in">
            <div className="cr-head">
              <p className="cr-eyebrow">Coleção</p>
              <h2 className="cr-h2">Sua coleção. Suas regras.</h2>
              <p className="cr-p">Você levou anos para montar. Quem decide como organizar é você.</p>
            </div>
            <div className="cr-feat">
              <div>
                <h3>Perfil público</h3>
                <p>Um link com a sua coleção, pronto para a bio e para os vídeos.</p>
                <div className="cr-shot">
                  <div className="cr-url"><IconLink size={14} /><span>bynx.gg/perfil/<b>seunome</b></span></div>
                  <div className="cr-minis">{MINIS.map(s => <Image key={s} src={s} alt="" width={120} height={168} sizes="(min-width:1024px) 120px, 100px" />)}</div>
                </div>
              </div>
              <div>
                <h3>Pastas do seu jeito</h3>
                <p>Por set, por Pokémon, por ilustrador ou pela lógica que só você entende.</p>
                <div className="cr-shot cr-folders">
                  {['Cartas graduadas', 'Para troca', 'Ilustradores', 'Do canal'].map(n => (
                    <div key={n} className="cr-fd"><IconCollection size={18} color="var(--ac-1)" /><span>{n}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Metas e Master Sets</h3>
                <p>Escolha o alvo e veja a barra avançar a cada carta.</p>
                <div className="cr-shot">
                  <div className="cr-meta">
                    <div className="cr-thumbs">{MINIS.map(s => <Image key={s} src={s} alt="" width={48} height={67} sizes="(min-width:1024px) 48px, 34px" />)}</div>
                    <strong>Master Set 30th Celebration</strong>
                  </div>
                  <div className="cr-bar" aria-hidden="true"><i /></div>
                </div>
              </div>
              <div>
                <h3>Patrimônio em R$</h3>
                <p>Quanto a coleção vale hoje, pelo Mercado Brasileiro. É uma estimativa de mercado, não uma garantia de venda.</p>
                <div className="cr-shot cr-pat">
                  <span className="cr-ex">Exemplo ilustrativo</span>
                  <span className="cr-pat-l">Patrimônio</span>
                  <span className="cr-pat-v">R$ ••••••</span>
                </div>
              </div>
            </div>
            <button type="button" className="cr-cta" onClick={cta} disabled={ativando}>{ctaTexto}</button>
          </div>
        </section>

        {/* 5. Cartas graduadas */}
        <section className="cr-sec cr-s-grad bx-gutter">
          <div className="cr-in">
            <p className="cr-eyebrow">Cartas graduadas</p>
            <h2 className="cr-h2">Slab não é linha de planilha.</h2>
            <p className="cr-p">Registre graduadora, nota, subnotas, Black Label e certificado. Veja o valor da carta graduada ao lado do valor da carta sem graduação.</p>
            <div className="cr-pair">
              <div>
                <SlabArte graduadora="bgs" nota={10} blackLabel img={SLAB_BGS.img} nome={SLAB_BGS.nome} sizes="(min-width:1024px) 260px, 200px" certificado />
                <dl className="cr-subs">
                  {['Centering', 'Corners', 'Edges', 'Surface'].map(s => <div key={s}><dt>{s}</dt><dd>10</dd></div>)}
                </dl>
              </div>
              <div>
                <SlabArte graduadora="psa" nota={10} img={SLAB_PSA.img} nome={SLAB_PSA.nome} sizes="(min-width:1024px) 200px, 160px" />
              </div>
            </div>
            <p className="cr-quote">Na hora de mostrar a slab no vídeo, o número está na tela.</p>
          </div>
        </section>

        {/* 6. Passos, FAQ e fechamento */}
        <section className="cr-sec cr-s-faq bx-gutter">
          <div className="cr-in">
            <p className="cr-eyebrow">Como funciona</p>
            <ol className="cr-steps">
              <li><span className="cr-node"><IconAccount size={16} color="var(--ac-1)" /></span><div><b>Cadastre</b><span>Seu nome, e-mail e senha.</span></div></li>
              <li><span className="cr-node"><IconCheck size={16} color="var(--ac-1)" /></span><div><b>Ative</b><span>Seu ano de Bynx Pro, na hora.</span></div></li>
              <li><span className="cr-node"><IconCard size={16} color="var(--ac-1)" /></span><div><b>Monte</b><span>Crie seu perfil público e adicione sua coleção.</span></div></li>
              <li><span className="cr-node"><IconInstagram size={16} color="var(--ac-1)" /></span><div><b>Compartilhe</b><span>Sua experiência com a Bynx.</span></div></li>
              <li><span className="cr-node"><IconChart size={16} color="var(--ac-1)" /></span><div><b>Acompanhe</b><span>Suas indicações e comissões na Central do Parceiro.</span></div></li>
            </ol>
            <div className="cr-faq">
              <Pergunta q="Preciso de cartão?" a="Não. Nada é cobrado, nem no fim do ano." aberta />
              <Pergunta q="E depois de 12 meses?" a="Sua conta passa para o plano Grátis. As cartas continuam salvas, mas recursos do Pro, como scan, Master Sets e pastas extras, ficam bloqueados até você assinar. Avisamos antes." />
              <Pergunta q="Já tenho conta." a="Toque em Já tenho conta, no topo da página. Depois de entrar, o botão Liberar meu 1 ano grátis aplica o ano na sua conta." />
              <Pergunta q="De onde vem o valor das cartas?" a="Do Mercado Brasileiro: preço em R$ de quem vende carta no Brasil, não dólar convertido. É uma estimativa de mercado para você acompanhar a coleção, não uma avaliação oficial nem garantia de venda." />
              <Pergunta q="O que preciso publicar, e com que frequência?" a="1 conteúdo público por mês sobre a sua experiência com a Bynx já basta. Pode ser post, Reel, Short, TikTok, carrossel ou até 3 Stories em sequência. Não precisa publicar todo dia." />
              <Pergunta q="Preciso seguir um roteiro?" a="Não. Você pode falar da Bynx com a sua própria linguagem. O importante é mostrar uma experiência real com a plataforma." />
              <Pergunta q="Preciso mostrar o valor total da minha coleção?" a="Não. Você decide quais informações da sua coleção ficam públicas." />
              <Pergunta q="Preciso ter muitos seguidores?" a="Não. A Bynx valoriza afinidade com Pokémon TCG, qualidade do conteúdo e relação com a comunidade." />
              <Pergunta q="Como funciona a comissão?" a="Você recebe 100% da primeira cobrança de cada indicação, limitado a R$ 100, mais 20% das 11 renovações mensais seguintes: até 12 cobranças pagas no total. As comissões valem para pagamentos aprovados e não estornados." />
              {expiraEm && <Pergunta q="O convite tem prazo?" a={`Sim. Ele vale até ${dataBR(expiraEm)}, às 23h59, ou enquanto durarem os convites.`} />}
            </div>
          </div>
        </section>

        <section className="cr-sec cr-close bx-gutter">
          <div className="cr-in">
            <h2 className="cr-h2">A Bynx foi feita para quem vive o hobby. Isso inclui você.</h2>
            <button type="button" className="cr-cta" onClick={cta} disabled={ativando}>{ctaTexto}</button>
            <p className="cr-micro">{fraseFechamento(vagasCtx.restantes, vagas, expiraEm)}</p>
          </div>
        </section>
      </main>

      <footer className="cr-foot bx-gutter">
        Bynx, colecionismo de Pokémon TCG feito no Brasil.<br />
        <Link href="/termos">Termos de Uso</Link> · <Link href="/privacidade">Privacidade</Link>
      </footer>

      {!heroVisivel && !folha && estado === 'ativo' && (
        <div className="cr-sticky bx-gutter">
          <ContadorCurto {...vagasCtx} classe="cr-ct-barra" />
          <button type="button" className="cr-cta" onClick={cta} disabled={ativando}>{ctaTexto}</button>
        </div>
      )}

      {folha && codigo && (
        <FolhaCadastro
          codigo={codigo}
          onFechar={() => setFolha(false)}
          onJaTemConta={() => { setFolha(false); openLogin({ next: voltarAqui }) }}
          restantes={vagasCtx.restantes}
          onEncerrado={() => { restantesRef.current = 0; setRestantes(0) }}
          onSucesso={s => { setFolha(false); setSucesso(s); window.scrollTo({ top: 0 }) }}
        />
      )}
    </div>
  )
}

function Pergunta({ q, a, aberta = false }: { q: string; a: string; aberta?: boolean }) {
  return (
    <details className="cr-q" open={aberta}>
      <summary>{q}<IconChevronDown size={16} /></summary>
      <p>{a}</p>
    </details>
  )
}

function CartaoPost({ m }: { m: Post }) {
  return (
    <a className="cr-vid" href={m.href} target="_blank" rel="noopener noreferrer" aria-label={`Post de ${m.autor} no Instagram: ${m.titulo} (abre em outra aba)`}>
      <Image src={m.capa} alt="" fill sizes="(min-width:1024px) 176px, 148px" />
      <span className="cr-vid-tag">Parceiro</span>
      <span className="cr-vid-ext"><IconInstagram size={16} /></span>
      <span className="cr-vid-meta">{m.titulo}<small>{m.autor}</small></span>
    </a>
  )
}

function Parceria({ logado, onPrecisaConta }: { logado: boolean; onPrecisaConta: () => void }) {
  const [ig, setIg] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [ok, setOk] = useState(false)
  const [erro, setErro] = useState('')

  async function pedir(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!logado) { onPrecisaConta(); return }
    setEnviando(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) { onPrecisaConta(); return }
      const res = await fetch('/api/criadores/parceria', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ instagram: ig }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setErro(d.error || 'Não conseguimos registrar agora.'); return }
      setOk(true)
    } catch {
      setErro('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  // Pedido feito: a apresentacao entra aqui, no momento de maior valor. Antes
  // do pedido ela so aparece como link discreto abaixo do botao.
  if (ok) {
    return (
      <div className="cr-partner" role="status">
        <div className="cr-okic cr-okic-sm"><IconCheck size={26} color="var(--bx-green)" strokeWidth={2.4} /></div>
        <h3 className="cr-h3">Pedido recebido.</h3>
        <p className="cr-p">A Bynx confere o seu perfil e cria o seu cupom. Você recebe tudo por e-mail.</p>
        <a className="cr-doc" href={APRESENTACAO_PARCERIA.url} target="_blank" rel="noopener noreferrer">
          <Image src={APRESENTACAO_PARCERIA.capa} alt="" width={112} height={63} sizes="112px" />
          <span><b>Programa de Parceiros</b><small>PDF, {APRESENTACAO_PARCERIA.tamanho} · versão {APRESENTACAO_PARCERIA.versao}</small><small>Comissão, cupom e simulação</small></span>
        </a>
        <a className="cr-cta" href={APRESENTACAO_PARCERIA.url} target="_blank" rel="noopener noreferrer">Ver a apresentação</a>
        <p className="cr-micro">Abre o PDF em outra aba. Dá para salvar e repassar.</p>
      </div>
    )
  }

  return (
    <div className="cr-partner">
      <ul>
        <li><IconCheck size={18} color="var(--bx-green)" /><span>Seus seguidores têm <b>20% de desconto</b> na primeira cobrança com o seu cupom.</span></li>
        <li><IconCheck size={18} color="var(--bx-green)" /><span>Você recebe <b>100% da primeira cobrança</b> de cada indicação, limitado a R$ 100.</span></li>
        <li><IconCheck size={18} color="var(--bx-green)" /><span>Você recebe <b>20% das 11 renovações mensais</b> seguintes.</span></li>
      </ul>
      <p className="cr-partner-nota">Até 12 cobranças pagas no total por indicação: a primeira mais 11 renovações.</p>
      <div className="cr-coupon">SEUNOME20 <small>seu cupom sai com o seu @</small></div>
      <form onSubmit={pedir} className="cr-partner-form">
          {logado && (
            <label className="cr-field">
              <span>Seu @ do Instagram</span>
              <div className="cr-ig"><IconInstagram size={16} /><input value={ig} onChange={e => setIg(e.target.value)} placeholder="seuperfil" autoCapitalize="none" autoCorrect="off" inputMode="text" required /></div>
            </label>
          )}
          {erro && <p className="cr-erro" role="alert">{erro}</p>}
          <button type="submit" className="cr-outline" disabled={enviando}>{enviando ? 'Enviando...' : 'Quero ser Creator Bynx'}</button>
          {!logado && <p className="cr-micro">Primeiro ative o seu ano de Pro. A parceria vem logo depois.</p>}
          <a className="cr-doclink" href={APRESENTACAO_PARCERIA.url} target="_blank" rel="noopener noreferrer">
            <IconDownload size={14} />Ver a apresentação completa (PDF, {APRESENTACAO_PARCERIA.tamanho})
          </a>
        </form>
    </div>
  )
}

function FolhaCadastro({ codigo, restantes, onFechar, onJaTemConta, onEncerrado, onSucesso }: {
  codigo: string
  restantes: number | null
  onFechar: () => void
  onJaTemConta: () => void
  onEncerrado: () => void
  onSucesso: (s: Sucesso) => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [termos, setTermos] = useState(false)
  const [idade13, setIdade13] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [campoErro, setCampoErro] = useState('')
  const [esgotou, setEsgotou] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onFechar])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCampoErro('')
    if (!termos) { setCampoErro('termos'); setErro('Aceite os Termos de Uso e a Política de Privacidade.'); return }
    if (!idade13) { setCampoErro('idade13'); setErro('A Bynx é para quem tem 13 anos ou mais.'); return }
    setCarregando(true)
    try {
      const res = await fetch('/api/criadores/cadastro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: codigo, nome, email, senha, termos, idade13, captcha }),
      })
      const d = await res.json().catch(() => ({}))
      // Vagas acabaram com o formulario aberto: a folha NAO fecha nem apaga o
      // que foi digitado. Avisa e oferece o plano Gratis.
      if (d.code === 'CONVITE_ENCERRADO') { setEsgotou(true); onEncerrado(); return }
      if (d.code === 'JA_TEM_CONTA') { onJaTemConta(); return }
      if (!res.ok) {
        setCampoErro(d.campo || ''); setErro(d.error || 'Não conseguimos criar sua conta.')
        setCaptchaReset(n => n + 1)
        return
      }
      if (d.tokenHash) {
        const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' })
        if (vErr) console.error('[criadores] verifyOtp falhou:', vErr.message)
      }
      trackSignUp({ metodo: 'convite-grupo', utm_source: 'convite', utm_medium: 'grupo', utm_campaign: 'criadores' })
      onSucesso({ proAte: d.proAte || null, aviso: d.aviso || null })
    } catch {
      setErro('Sem conexão com o servidor. Confira o sinal e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="cr-sheet-bg" onClick={onFechar}>
      <div className="cr-sheet" role="dialog" aria-modal="true" aria-labelledby="cr-sheet-t" onClick={e => e.stopPropagation()}>
        <div className="cr-sheet-h">
          <span className="cr-pro">12 meses de Bynx Pro</span>
          <button type="button" className="cr-x" onClick={onFechar} aria-label="Fechar"><IconClose size={18} /></button>
        </div>
        <h2 id="cr-sheet-t" className="cr-h2">Seu ano de Pro começa aqui</h2>
        {esgotou ? (
          <div className="cr-esgotou" role="alert">
            <b>Os convites acabaram enquanto você preenchia.</b>
            <p>Seus dados continuam aqui. Você pode criar a conta no plano Grátis.</p>
            <Link href="/planos" className="cr-outline">Conhecer o plano Grátis</Link>
          </div>
        ) : restantes !== null && restantes > 0 && restantes <= 10 && (
          <p className="cr-ct-folha"><span className="cr-ct-dot" aria-hidden="true" />{restantes === 1 ? 'Resta 1 convite' : `Restam ${restantes} convites`}</p>
        )}
        <form onSubmit={enviar} noValidate>
          <label className="cr-field">
            <span>Nome</span>
            <input className={campoErro === 'nome' ? 'err' : ''} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" required />
          </label>
          <label className="cr-field">
            <span>E-mail</span>
            <input className={campoErro === 'email' ? 'err' : ''} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" autoCapitalize="none" required />
          </label>
          <label className="cr-field">
            <span>Senha</span>
            <input className={campoErro === 'senha' ? 'err' : ''} type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" required />
            <small>{SENHA_REGRA_MSG.replace('Senha fraca. ', '')}</small>
          </label>
          <label className={`cr-chk${campoErro === 'termos' ? ' err' : ''}`}>
            <input type="checkbox" checked={termos} onChange={e => setTermos(e.target.checked)} />
            <span>Li e aceito os <a href="/termos" target="_blank">Termos de Uso</a> e a <a href="/privacidade" target="_blank">Política de Privacidade</a></span>
          </label>
          <label className={`cr-chk${campoErro === 'idade13' ? ' err' : ''}`}>
            <input type="checkbox" checked={idade13} onChange={e => setIdade13(e.target.checked)} />
            <span>Tenho 13 anos ou mais</span>
          </label>
          <Turnstile onToken={setCaptcha} resetKey={captchaReset} />
          {erro && <p className="cr-erro" role="alert">{erro}</p>}
          <button type="submit" className="cr-cta" disabled={carregando || esgotou}>{carregando ? 'Criando sua conta...' : 'Criar conta e ativar meu ano'}</button>
          <p className="cr-micro">Sem CPF e sem cartão. CPF só se você entrar na Parceria.</p>
        </form>
      </div>
    </div>
  )
}

function TelaSucesso({ sucesso }: { sucesso: Sucesso }) {
  return (
    <div className="cr">
      <style>{CSS}</style>
      <header className="cr-top bx-gutter"><Link href="/" className="cr-logo-a"><img src="/logo_BYNX.png" alt="Bynx" className="cr-logo" /></Link></header>
      <main className="bx-gutter cr-state">
        <div className="cr-in">
          {sucesso.proAte ? (
            <>
              <div className="cr-okic"><IconCheck size={30} color="var(--bx-green)" strokeWidth={2.4} /></div>
              <h1 className="cr-h2">Seu ano de Bynx Pro está ativo.</h1>
              <p className="cr-p">Vale até {dataBR(sucesso.proAte)}. Três passos para a coleção ficar pronta para o vídeo:</p>
            </>
          ) : (
            <>
              <h1 className="cr-h2">Sua conta foi criada.</h1>
              <p className="cr-p">{sucesso.aviso || 'Não conseguimos liberar o ano agora.'}</p>
            </>
          )}
          <div className="cr-todo">
            <Link href="/minha-colecao"><IconCard size={18} color="var(--ac-1)" />Adicionar minhas primeiras cartas</Link>
            <Link href="/minha-colecao"><IconCollection size={18} color="var(--ac-1)" />Registrar uma graduada</Link>
            <Link href="/minha-conta"><IconShare size={18} color="var(--ac-1)" />Publicar meu perfil</Link>
          </div>
          <Link href="/minha-colecao" className="cr-cta">Adicionar minha primeira carta</Link>
          {sucesso.proAte && (
            <div className="cr-sec-mini">
              <p className="cr-eyebrow">Parceria</p>
              <h2 className="cr-h2">Sua comunidade ganha. Você também.</h2>
              <Parceria logado onPrecisaConta={() => {}} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function TelaEncerrado({ invalido, motivo, vagas }: { invalido: boolean; motivo: Motivo; vagas: number | null }) {
  const titulo = invalido ? 'Este link de convite não existe.'
    : motivo === 'vagas' ? (vagas ? `Os ${vagas} convites deste programa acabaram.` : 'Os convites deste programa acabaram.')
    : motivo === 'prazo' ? 'O prazo deste convite terminou.'
    : 'Este convite encerrou.'
  return (
    <div className="cr">
      <style>{CSS}</style>
      <header className="cr-top bx-gutter"><Link href="/" className="cr-logo-a"><img src="/logo_BYNX.png" alt="Bynx" className="cr-logo" /></Link></header>
      <main className="bx-gutter cr-state cr-center">
        <div className="cr-in">
          <h1 className="cr-h2">{titulo}</h1>
          <p className="cr-p">{invalido ? 'Confira o link que você recebeu no grupo.' : 'A Bynx continua aberta para você.'}</p>
          <Link href="/" className="cr-outline">Conhecer a Bynx</Link>
        </div>
      </main>
    </div>
  )
}

const CSS = `
/* O body do site e Arial: cada pagina aplica a DM Sans na propria raiz (a home
   no .hm-root, o app no AppLayout). Sem isto a landing saiu em Arial de 23 a 26/10. */
.cr{min-height:100vh;background:var(--bx-bg);color:var(--bx-text);padding-bottom:96px;font-family:var(--font-dm-sans),'DM Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.cr-in{max-width:560px;margin:0 auto}
.cr-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;height:56px;background:color-mix(in srgb,var(--bx-bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--bx-border)}
.cr-logo-a{display:flex;align-items:center;min-height:44px}
.cr-logo{height:26px;width:auto;display:block}
.cr-ghost{min-height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--bx-border-2);background:transparent;color:var(--bx-text);font:inherit;font-weight:700;font-size:13px;cursor:pointer;transition:background .15s ease}
.cr-ghost:hover{background:var(--bx-surface-2)}
.cr-top-ok{font-size:12px;color:var(--bx-text-3);font-weight:600}
.cr-sec{padding-top:40px;padding-bottom:40px}
.cr-sec + .cr-sec{border-top:1px solid var(--bx-border)}
.cr-hero{background:var(--bx-hero-wash);padding-top:28px}
.cr-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ac-1);background:rgba(var(--ac-1-rgb),0.10);border:1px solid rgba(var(--ac-1-rgb),0.25);padding:5px 10px;border-radius:999px;margin:0}
.cr-h1{font-size:clamp(30px,8vw,40px);font-weight:800;letter-spacing:-0.03em;line-height:1.08;margin:14px 0 0;text-wrap:balance}
.cr-h1 em{font-style:normal;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.cr-h2{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:12px 0 0;text-wrap:balance}
.cr-p{color:var(--bx-text-2);font-size:15px;line-height:1.5;margin:10px 0 0}
.cr-cta{display:flex;align-items:center;justify-content:center;width:100%;height:56px;margin-top:20px;border:0;border-radius:12px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:16px;cursor:pointer;text-decoration:none;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.cr-cta:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(var(--ac-2-rgb),.35)}
.cr-cta:focus-visible,.cr-outline:focus-visible,.cr-ghost:focus-visible,.cr-vid:focus-visible{outline:2px solid var(--bx-text);outline-offset:3px}
.cr-cta:disabled{opacity:.6;cursor:default;transform:none}
.cr-outline{display:flex;align-items:center;justify-content:center;width:100%;height:52px;margin-top:16px;border-radius:12px;border:1px solid var(--ac-1);background:transparent;color:var(--ac-1);font:inherit;font-weight:800;font-size:15px;cursor:pointer;text-decoration:none;transition:background .15s ease}
.cr-outline:hover{background:rgba(var(--ac-1-rgb),.08)}
.cr-micro{text-align:center;font-size:12.5px;color:var(--bx-text-3);margin:8px 0 0}
.cr-erro{font-size:13px;color:var(--bx-red);margin:12px 0 0}
.cr-lockup{display:block;font-size:50px;line-height:.86;letter-spacing:-.05em}
.cr-lockup b{display:block;font-weight:800;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.cr-bene{display:block;margin-top:12px;font-size:20px;line-height:1.16;letter-spacing:-.02em;text-wrap:balance}
.cr-hero .cr-in{display:flex;flex-direction:column}
.cr-hero .cr-eyebrow{align-self:flex-start}
.cr-hero .cr-chip-wrap{align-self:center}
.cr-hero-sub{order:20;margin-top:16px}
.cr-trio{position:relative;height:228px;margin:10px -16px 0;background:radial-gradient(55% 60% at 50% 50%,rgba(var(--ac-2-rgb),.22),rgba(var(--ac-1-rgb),.06) 50%,transparent 72%)}
.cr-trio::before{content:"";position:absolute;left:50%;top:50%;width:300px;height:300px;border-radius:50%;border:1px solid rgba(var(--ac-1-rgb),.18);transform:translate(-50%,-50%) rotate(-18deg) scaleY(.8)}
.cr-trio-c{position:absolute;width:104px;border-radius:7px;overflow:hidden;line-height:0;box-shadow:0 18px 34px rgba(0,0,0,.55);transition:transform .2s ease}
.cr-trio-c img{display:block;width:100%;height:auto}
.cr-trio-l{left:6%;top:24%;transform:rotate(-14deg)}
.cr-trio-r{right:5%;top:12%;transform:rotate(13deg)}
.cr-trio-slab{position:absolute;left:50%;top:3%;width:140px;transform:translateX(-46%) rotate(-5deg);z-index:2;transition:transform .2s ease}
.cr-trio-slab .sa{padding:6px;border-radius:11px}
.cr-trio-slab .sa-lab{padding:4px 7px;min-height:34px;margin-bottom:5px}
.cr-trio-slab .sa-sig{font-size:11px}
.cr-trio-slab .sa-nome{font-size:7.5px;max-width:none}
.cr-trio-slab .sa-nota{font-size:18px}
.cr-trio-slab .sa-tier{font-size:6.5px}
.cr-trio-slab .sa-win{padding:4px}
.cr-trio-tag{display:none}
.cr-band{display:flex;gap:10px;align-items:flex-start;margin-top:16px;padding:12px 14px;border-radius:12px;background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.28);font-size:13px;font-weight:600}
.cr-band svg{flex:none;margin-top:1px}
.cr-chip-wrap{text-align:center;margin-top:14px}
.cr-oferta{list-style:none;margin:16px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.cr-oferta li{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.28);font-size:13px;font-weight:700;color:var(--bx-text)}
.cr-partner li b{color:var(--bx-text);font-weight:700}
.cr-ct{margin-top:14px;padding:14px;border-radius:12px;background:var(--bx-surface);border:1px solid var(--bx-border);transition:border-color .2s ease}
.cr-ct-l{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0}
.cr-ct-n{display:inline-block;font-size:44px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums;color:var(--bx-text);transition:color .2s ease}
.cr-ct-pre,.cr-ct-t{font-size:15px;font-weight:700;color:var(--bx-text-2)}
.cr-ct-regua{display:grid;gap:2px;height:8px;margin-top:12px}
.cr-ct-regua i{display:block;border-radius:2px;background:var(--ac-1);transition:background .2s ease}
.cr-ct-regua i.u{background:var(--bx-surface-3)}
.cr-ct-barra-cont{height:8px;margin-top:12px;border-radius:999px;background:var(--bx-surface-3);overflow:hidden}
.cr-ct-barra-cont i{display:block;height:100%;background:var(--ac-1);border-radius:999px}
.cr-ct-p{display:flex;align-items:center;gap:6px;margin:10px 0 0;font-size:13px;color:var(--bx-text-3)}
.cr-ct-p svg{flex:none}
.cr-ct-urg .cr-ct-p{color:var(--bx-text);font-weight:700}
.cr-ct-urg .cr-ct-p svg{color:var(--ac-1)}
.cr-ct.f20{border-color:rgba(var(--ac-1-rgb),.35)}
.cr-ct.f20 .cr-ct-n{color:var(--ac-2)}
.cr-ct.f20 .cr-ct-regua i:not(.u),.cr-ct.f20 .cr-ct-barra-cont i{background:var(--ac-2)}
.cr-ct.f10{border-color:rgba(var(--ac-2-rgb),.45)}
.cr-ct.f10 .cr-ct-n{color:var(--bx-red)}
.cr-ct.f10 .cr-ct-regua i:not(.u),.cr-ct.f10 .cr-ct-barra-cont i{background:var(--bx-red)}
.cr-ct-av{display:flex;align-items:center;gap:8px;margin:10px 0 0;padding-top:10px;border-top:1px solid var(--bx-border);font-size:13px;font-weight:700;color:var(--bx-text)}
.cr-ct-dot{width:6px;height:6px;border-radius:50%;background:var(--bx-red);flex:none}
.cr-ct-vazio{height:96px;display:flex;align-items:center}
.cr-ct-sk{display:block;width:72px;height:40px;border-radius:8px;background:var(--bx-surface-3)}
.cr-ct-pulso{animation:cr-pulso .2s ease 1}
@keyframes cr-pulso{50%{transform:scale(1.06)}}
.cr-ct-barra{display:flex;justify-content:center;gap:4px;margin:0 auto 6px;max-width:560px;font-size:12.5px;font-weight:700;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.cr-ct-barra b,.cr-ct-pill b{color:var(--bx-text);font-weight:800;transition:color .2s ease}
.cr-ct-barra.f20 b,.cr-ct-pill.f20 b{color:var(--ac-2)}
.cr-ct-barra.f10 b,.cr-ct-pill.f10 b{color:var(--bx-red)}
.cr-ct-pill{display:none}
.cr-ct-folha{display:flex;align-items:center;gap:8px;margin:12px 0 0;padding:9px 12px;border-radius:10px;border:1px solid rgba(var(--ac-2-rgb),.45);font-size:13px;font-weight:700;color:var(--bx-text)}
.cr-esgotou{margin-top:14px;padding:14px;border-radius:12px;border:1px solid rgba(var(--ac-2-rgb),.45);background:rgba(var(--ac-2-rgb),.08)}
.cr-esgotou b{display:block;font-size:15px}
.cr-esgotou p{font-size:13.5px;color:var(--bx-text-2);margin:4px 0 0}
.cr-esgotou .cr-outline{margin-top:12px}
.cr-chip{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);font-size:12px;font-weight:700;color:var(--bx-text-2);text-decoration:none}


.cr-feat{display:flex;flex-direction:column;gap:24px;margin-top:22px}
.cr-feat h3{font-size:16px;font-weight:800;margin:0}
.cr-feat p{font-size:13.5px;color:var(--bx-text-2);margin:3px 0 0}
.cr-shot{margin-top:10px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);padding:12px}
.cr-folders{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cr-fd{display:flex;gap:8px;align-items:center;min-height:48px;padding:0 10px;border-radius:10px;background:var(--bx-surface-2);border:1px solid var(--bx-border);font-size:13px;font-weight:700}
.cr-fd svg{flex:none}
.cr-meta{display:flex;gap:12px;align-items:center;font-size:13px}
.cr-thumbs{display:flex;flex:none}
.cr-thumbs img{width:34px;height:auto;border-radius:3px;margin-left:-10px;box-shadow:0 4px 10px rgba(0,0,0,.5)}
.cr-thumbs img:first-child{margin-left:0}
.cr-bar{height:8px;border-radius:99px;background:var(--bx-surface-3);overflow:hidden;margin-top:10px}
.cr-bar i{display:block;height:100%;width:64%;background:var(--ac-grad);border-radius:99px}
.cr-url{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:10px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);font-size:13px;color:var(--bx-text-2);font-variant-numeric:tabular-nums}
.cr-url b{color:var(--bx-text);font-weight:700}
.cr-minis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
.cr-minis img{width:100%;height:auto;border-radius:4px;display:block}
.cr-pat{display:flex;flex-direction:column;gap:2px}
.cr-ex{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text-3);margin-bottom:6px}
.cr-pat-l{font-size:11.5px;color:var(--bx-text-3);font-weight:700}
.cr-pat-v{font-size:26px;font-weight:800;letter-spacing:-.02em;color:var(--bx-text-3)}

.cr-pair{display:grid;grid-template-columns:1.25fr 1fr;gap:14px;margin-top:22px;align-items:end}
.cr-subs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0 0}
.cr-subs div{border-radius:8px;background:var(--bx-surface-2);border:1px solid var(--bx-border);padding:6px 8px}
.cr-subs dt{font-size:10.5px;color:var(--bx-text-3);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.cr-subs dd{margin:0;font-size:15px;font-weight:800;color:var(--bx-text)}
.cr-quote{margin:22px 0 0;padding-left:12px;border-left:2px solid var(--ac-1);font-size:15px;font-weight:700}

.cr-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:16px;margin:22px -16px 0;padding:0 16px 6px;scrollbar-width:none}
.cr-rail::-webkit-scrollbar{display:none}
.cr-vid{flex:0 0 148px;aspect-ratio:9/16;border-radius:12px;overflow:hidden;position:relative;scroll-snap-align:start;border:1px solid var(--bx-border-2);background:var(--bx-bg-elev);color:var(--bx-text);text-decoration:none;padding:0;font:inherit;text-align:left;cursor:pointer;transition:transform .15s ease}
.cr-vid:hover{transform:translateY(-2px)}
.cr-vid img{object-fit:cover}
.cr-vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.cr-vid::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.78),transparent 55%);pointer-events:none}
.cr-vid-tag{position:absolute;top:8px;left:8px;z-index:2;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 7px;border-radius:6px;background:color-mix(in srgb,var(--bx-bg) 70%,transparent)}
.cr-vid-play{position:absolute;z-index:2;left:50%;top:44%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--bx-bg) 70%,transparent);border:1px solid var(--bx-border-2);display:grid;place-items:center}
.cr-vid-ext{position:absolute;z-index:2;top:8px;right:8px;color:var(--bx-text-2)}
.cr-vid-meta{position:absolute;z-index:2;left:10px;right:10px;bottom:10px;font-size:12px;font-weight:700;line-height:1.3}
.cr-vid-meta small{display:block;font-size:11px;color:var(--bx-text-2);font-weight:600;margin-top:2px}

.cr-partner{margin-top:20px;border-radius:18px;border:1px solid rgba(var(--ac-1-rgb),.4);background:var(--bx-surface-2);padding:16px}
.cr-partner ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.cr-partner li{display:flex;gap:10px;font-size:14px;color:var(--bx-text-2)}
.cr-partner li svg{flex:none;margin-top:1px}
.cr-partner li{padding:12px;border-radius:10px;background:var(--bx-surface);border:1px solid var(--bx-border);align-items:flex-start;line-height:1.45}
.cr-partner-nota{margin:10px 0 0;font-size:12.5px;color:var(--bx-text-3)}
.cr-ctr-intro .cr-h2 em{font-style:normal;background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.cr-ctr-intro{max-width:720px}
.cr-ctr-combinado{display:flex;align-items:flex-start;gap:10px;margin:14px 0 0;padding:14px 16px;border-radius:12px;background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.3);font-size:14.5px;line-height:1.5;color:var(--bx-text-2)}
.cr-ctr-combinado svg{flex:none;margin-top:2px}
.cr-ctr-combinado b{color:var(--bx-text);font-weight:800}
.cr-ctr-fecho{margin:18px 0 0;text-align:center;font-size:15px;font-weight:800;color:var(--bx-text)}
.cr-ctr-exemplo{margin-top:12px;border-top:1px solid var(--bx-border);border-bottom:1px solid var(--bx-border)}
.cr-ctr-exemplo summary{list-style:none;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:14px;font-weight:700;color:var(--bx-text-2);cursor:pointer}
.cr-ctr-exemplo summary::-webkit-details-marker{display:none}
.cr-ctr-exemplo summary svg{transition:transform .2s ease;color:var(--bx-text-3)}
.cr-ctr-exemplo[open] summary svg{transform:rotate(180deg)}
.cr-ctr-exemplo .cr-sug-n{margin:0}
.cr-ctr-exemplo .cr-sug-t{margin:6px 0 14px}
.cr-ctr-passos{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin-top:22px;position:relative}
.cr-ctr-passo{--tint:var(--ac-1-rgb);position:relative;overflow:hidden;isolation:isolate;display:flex;flex-direction:column;justify-content:flex-end;min-height:400px;padding:22px;border-radius:18px;border:1px solid var(--bx-border);background:linear-gradient(160deg,var(--bx-surface-3),var(--bx-surface));transition:transform .2s ease,border-color .2s ease}
.cr-ctr-p2{--tint:var(--ac-2-rgb)}
.cr-ctr-passo::before{content:"";position:absolute;z-index:-1;top:-90px;right:-90px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(var(--tint),.22),transparent 70%)}
.cr-ctr-passo:hover{transform:translateY(-2px);border-color:rgba(var(--tint),.4)}
.cr-ctr-arte{position:absolute;z-index:-1;top:18px;left:0;right:0;height:210px;display:grid;place-items:center}
.cr-ctr-arte::before,.cr-ctr-arte::after{content:"";position:absolute;border-radius:12px;border:1px solid rgba(var(--tint),.45);background:rgba(var(--tint),.10)}
.cr-ctr-arte::before{width:70px;height:96px;transform:translate(-92px,22px) rotate(-12deg)}
.cr-ctr-arte::after{width:58px;height:80px;transform:translate(96px,-4px) rotate(14deg);opacity:.7}
.cr-ctr-arte img{position:relative;width:128px;height:auto;border-radius:8px;transform:rotate(-4deg);box-shadow:0 18px 34px rgba(0,0,0,.5);transition:transform .2s ease}
.cr-ctr-passo:hover .cr-ctr-arte img{transform:rotate(0) translateY(-4px)}
.cr-ctr-n{display:grid;place-items:center;width:36px;height:36px;margin-bottom:14px;border-radius:50%;border:1px solid rgba(var(--tint),.6);background:rgba(var(--tint),.14);color:var(--bx-text);font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.cr-ctr-passo h3{font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1.08;margin:0}
.cr-ctr-passo p{font-size:14px;color:var(--bx-text-2);margin:8px 0 0}
.cr-sug-k{margin:0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--ac-1)}
.cr-sug-t{margin:8px 0 0;font-size:14.5px;line-height:1.55;color:var(--bx-text)}
.cr-sug-n{margin:8px 0 0;font-size:12px;color:var(--bx-text-3)}
.cr-coupon{display:inline-flex;align-items:center;gap:8px;margin-top:14px;min-height:36px;padding:0 12px;border-radius:8px;background:var(--bx-bg-elev);border:1px dashed rgba(var(--ac-1-rgb),0.55);font-size:14px;font-weight:800;letter-spacing:.1em}
.cr-coupon small{font-family:var(--font-dm-sans,"DM Sans"),system-ui,sans-serif;font-size:11px;color:var(--bx-text-3);letter-spacing:0}
.cr-partner-form{margin-top:4px}
.cr-ig{display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text-3)}
.cr-ig input{flex:1;min-width:0;height:100%;border:0;background:transparent;color:var(--bx-text);font:inherit;font-size:16px;outline:none}
.cr-ok{margin:14px 0 0;font-size:14px;color:var(--bx-green);font-weight:700}
.cr-doclink{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;margin-top:6px;font-size:13px;font-weight:700;color:var(--bx-text-2);text-decoration:underline;text-underline-offset:3px;transition:color .15s ease}
.cr-doclink:hover{color:var(--bx-text)}
.cr-okic-sm{width:52px;height:52px;margin:0 0 14px}
.cr-h3{font-size:20px;font-weight:800;letter-spacing:-.02em;margin:0}
.cr-doc{display:flex;gap:12px;align-items:center;margin-top:16px;padding:10px;border-radius:12px;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);color:var(--bx-text);text-decoration:none;transition:border-color .15s ease,transform .15s ease}
.cr-doc:hover{border-color:rgba(var(--ac-1-rgb),.5);transform:translateY(-2px)}
.cr-doc img{width:112px;height:auto;border-radius:6px;display:block;flex:none}
.cr-doc b{display:block;font-size:14px}
.cr-doc small{display:block;font-size:12px;color:var(--bx-text-3);margin-top:2px}

.cr-steps{list-style:none;margin:20px 0 0;padding:0}
.cr-steps li{display:flex;gap:12px;position:relative;padding-bottom:18px}
.cr-steps li:not(:last-child)::before{content:"";position:absolute;left:17px;top:36px;bottom:0;width:1px;background:var(--bx-border-2)}
.cr-steps b{display:block;font-size:15px}
.cr-steps span:not(.cr-node){font-size:13px;color:var(--bx-text-2)}
.cr-node{width:36px;height:36px;border-radius:50%;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);display:grid;place-items:center;flex:none}
.cr-faq{margin-top:12px;border-top:1px solid var(--bx-border)}
.cr-q{border-bottom:1px solid var(--bx-border)}
.cr-q summary{list-style:none;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:14.5px;cursor:pointer}
.cr-q summary::-webkit-details-marker{display:none}
.cr-q summary svg{transition:transform .2s ease;color:var(--bx-text-3);flex:none}
.cr-q[open] summary svg{transform:rotate(180deg)}
.cr-q p{font-size:13.5px;color:var(--bx-text-2);margin:0;padding:0 0 14px}
.cr-close{text-align:center;background:var(--bx-hero-wash)}
.cr-foot{padding-top:20px;padding-bottom:28px;font-size:11.5px;color:var(--bx-text-3);text-align:center;border-top:1px solid var(--bx-border)}
.cr-foot a{color:var(--bx-text-2);text-decoration:none}
.cr-sticky{position:fixed;left:0;right:0;bottom:0;z-index:30;padding-top:8px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bx-bg) 92%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-top:1px solid var(--bx-border)}
.cr-sticky .cr-cta{margin:0 auto;max-width:560px;height:52px}

.cr-sheet-bg{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center}
.cr-sheet{width:100%;max-width:480px;max-height:100dvh;overflow-y:auto;background:var(--bx-bg-elev);border:1px solid var(--bx-border-2);border-bottom:0;border-radius:18px 18px 0 0;padding:16px 16px calc(20px + env(safe-area-inset-bottom))}
@media (min-width:640px){.cr-sheet-bg{align-items:center}.cr-sheet{border-radius:18px;border-bottom:1px solid var(--bx-border-2)}}
.cr-sheet-h{display:flex;align-items:center;justify-content:space-between}
.cr-pro{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;background:var(--ac-grad);color:var(--bx-brand-ink);font-weight:800;font-size:12px}
.cr-x{width:44px;height:44px;display:grid;place-items:center;border:0;background:transparent;color:var(--bx-text-3);cursor:pointer;margin-right:-10px}
.cr-field{display:block;margin-top:14px}
.cr-field > span{display:block;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--bx-text-3);margin-bottom:6px}
.cr-field > input{width:100%;height:48px;padding:0 14px;border-radius:12px;border:1px solid var(--bx-border-2);background:var(--bx-surface);color:var(--bx-text);font:inherit;font-size:16px;outline:none;transition:border-color .15s ease}
.cr-field > input:focus{border-color:var(--ac-1)}
.cr-field > input.err{border-color:var(--bx-red)}
.cr-field small{display:block;font-size:11.5px;color:var(--bx-text-3);margin-top:5px}
.cr-chk{display:flex;gap:10px;align-items:center;min-height:44px;font-size:13px;color:var(--bx-text-2);margin-top:8px;cursor:pointer}
.cr-chk input{width:22px;height:22px;flex:none;accent-color:var(--ac-1)}
.cr-chk.err span{color:var(--bx-red)}
.cr-chk a{color:var(--bx-text);text-decoration:underline}

.cr-state{padding-top:32px;padding-bottom:40px}
.cr-center{text-align:center;padding-top:96px}
.cr-okic{width:64px;height:64px;border-radius:50%;background:color-mix(in srgb,var(--bx-green) 12%,transparent);border:1px solid color-mix(in srgb,var(--bx-green) 40%,transparent);display:grid;place-items:center;margin:16px 0 18px}
.cr-todo{display:flex;flex-direction:column;gap:8px;margin-top:22px}
.cr-todo a{display:flex;gap:10px;align-items:center;min-height:52px;padding:0 14px;border-radius:12px;background:var(--bx-surface-2);border:1px solid var(--bx-border);font-size:14px;font-weight:700;color:var(--bx-text);text-decoration:none;transition:background .15s ease}
.cr-todo a:hover{background:var(--bx-surface-3)}
.cr-sec-mini{margin-top:40px;padding-top:32px;border-top:1px solid var(--bx-border)}
/* ---- desktop (23/10/2026): spec dos agentes de UX/arte, revisada ----
   Abaixo de 768 px nada muda. 768-1023: coluna unica mais larga.
   1024+: grade de 12 colunas em 1120 px (o .wrap da home), ritmo vertical
   variado e o visual alternando de lado. Slab no maximo 260 px e carta 160:
   a arte do storage tem 350 px e borraria no retina de quem grava. */
.cr-top-r{display:flex;gap:10px;align-items:center}
.cr-top-cta{display:none}
.cr .sa-cert{font-family:inherit;font-variant-numeric:tabular-nums}
@media (min-width:768px) and (max-width:1023px){
.cr-sec .cr-in{max-width:680px}
.cr-lockup{font-size:84px}
.cr-bene{font-size:30px}
.cr-trio{height:340px;margin:16px 0 0}
.cr-trio-c{width:130px}
.cr-trio-slab{width:180px}
.cr-rail{overflow:visible;margin:22px 0 0;padding:0}
.cr-vid{flex:1 1 0}
}
@media (min-width:1024px){
.cr{padding-bottom:0}
.cr-sticky{display:none}
.cr-top{height:64px;padding-left:max(24px,calc((100% - 1120px)/2))!important;padding-right:max(24px,calc((100% - 1120px)/2))!important}
.cr-top-cta{display:inline-flex;align-items:center;height:44px;padding:0 18px;border:0;border-radius:10px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:transform .15s ease}
.cr-top-cta:hover{transform:translateY(-2px)}
.cr-ct-pill{display:inline-flex;align-items:center;gap:4px;height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);font-size:12.5px;font-weight:700;color:var(--bx-text-2);font-variant-numeric:tabular-nums;margin:0;white-space:nowrap}
.cr-ct-pill.f20{border-color:rgba(var(--ac-1-rgb),.4)}
.cr-ct-pill.f10{border-color:rgba(var(--ac-2-rgb),.5)}
.cr-hero .cr-ct{justify-self:start;width:100%;max-width:440px}
.cr-ct-n{font-size:52px}
.cr-sec .cr-in{max-width:1120px;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;align-items:start}
.cr-sec .cr-in>*{grid-column:1/-1;min-width:0}
.cr-sec+.cr-sec{border-top:0}
.cr-eyebrow{background:none;border:0;padding:0;border-radius:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;justify-self:start}
.cr-h2{font-size:clamp(32px,3vw,44px);line-height:1.08;letter-spacing:-.03em}
.cr-p{font-size:17px}
.cr-cta{display:inline-flex;width:auto;min-width:320px;padding:0 32px;justify-self:start}
.cr-micro,.cr-chip-wrap{text-align:left}

.cr-hero{padding-top:0;padding-bottom:0;overflow:clip}
.cr-hero .cr-in{position:relative;min-height:min(calc(100svh - 64px),780px);align-content:center;padding:48px 0}
.cr-hero .cr-in>*{grid-column:1/7}
.cr-hero .cr-in{display:grid}
.cr-hero-sub{order:0}
.cr-hero .cr-chip-wrap{align-self:auto;justify-self:start}
.cr-hero .cr-in>.cr-trio{grid-column:auto;grid-row:auto;position:absolute;top:0;bottom:0;right:0;width:calc(50% - 12px);height:auto;margin:0;background:radial-gradient(48% 52% at 52% 46%,rgba(var(--ac-2-rgb),.20),rgba(var(--ac-1-rgb),.06) 48%,transparent 72%)}
.cr-trio::before{width:520px;height:520px}
.cr-trio-c{width:190px}
.cr-trio-l{left:4%;top:calc(50% - 150px)}
.cr-trio-r{right:2%;top:calc(50% - 250px)}
.cr-trio-c:hover{z-index:3}
.cr-trio-l:hover{transform:rotate(-14deg) translateY(-6px)}
.cr-trio-r:hover{transform:rotate(13deg) translateY(-6px)}
.cr-trio-slab{width:250px;top:calc(50% - 250px)}
.cr-trio-slab:hover{transform:translateX(-46%) rotate(-3deg) translateY(-6px)}
.cr-trio-slab .sa{padding:9px;border-radius:15px}
.cr-trio-slab .sa-lab{padding:6px 9px;min-height:46px;margin-bottom:7px}
.cr-trio-slab .sa-sig{font-size:13px}
.cr-trio-slab .sa-nome{font-size:9px}
.cr-trio-slab .sa-nota{font-size:24px}
.cr-trio-slab .sa-tier{font-size:8px}
.cr-trio-slab .sa-win{padding:7px}
.cr-trio-tag{display:inline-flex;align-items:center;gap:6px;position:absolute;right:6%;bottom:calc(50% - 300px);z-index:4;padding:8px 12px;border-radius:999px;border:1px solid var(--bx-border-2);background:color-mix(in srgb,var(--bx-bg) 80%,transparent);font-size:12px;font-weight:700;color:var(--bx-text-2)}
.cr-trio-tag b{color:var(--bx-text);font-weight:700}
.cr-lockup{font-size:clamp(72px,6.6vw,100px)}
.cr-bene{margin-top:18px;font-size:clamp(26px,2.3vw,32px);max-width:560px}
.cr-h1{font-size:clamp(40px,3.6vw,54px);line-height:1.04;letter-spacing:-.035em}
.cr-hero .cr-p{max-width:46ch}
.cr-band{justify-self:start;max-width:520px}

.cr-s-col{padding-top:112px;padding-bottom:112px}
.cr-s-col .cr-head{grid-column:1/5;grid-row:1/span 2;position:sticky;top:104px}
.cr-s-col .cr-feat{grid-column:6/13;grid-row:1;margin-top:0;gap:0}
.cr-s-col .cr-cta{grid-column:6/13;grid-row:2;margin-top:40px}
.cr-feat>div{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);grid-template-rows:auto 1fr;column-gap:32px;padding:32px 0;border-top:1px solid var(--bx-border)}
.cr-feat>div:last-child{border-bottom:1px solid var(--bx-border)}
.cr-feat>div>.cr-shot{grid-column:2;grid-row:1/span 2;margin-top:0}
.cr-feat h3{font-size:20px}
.cr-feat p{font-size:15px;margin-top:6px}
.cr-thumbs img{width:48px;margin-left:-14px}
.cr-bar{height:12px}
.cr-minis{grid-template-columns:repeat(3,minmax(0,120px));gap:10px}
.cr-minis img:nth-child(2){transform:translateY(-10px)}
.cr-pat{border:0;background:none;padding:0}
.cr-pat-v{font-size:clamp(44px,4vw,60px);color:var(--bx-text-2);font-variant-numeric:tabular-nums}

.cr-s-grad{background:var(--bx-bg-elev);padding-top:128px;padding-bottom:128px}
.cr-s-grad .cr-in{grid-template-rows:repeat(4,auto) 1fr}
.cr-s-grad .cr-in>:not(.cr-pair){grid-column:8/13}
.cr-s-grad .cr-eyebrow{margin-top:48px}
.cr-s-grad .cr-pair{grid-column:1/7;grid-row:1/span 5;display:flex;gap:28px;align-items:flex-start;margin-top:0}
.cr-s-grad .cr-pair>div:first-child{flex:0 0 260px}
.cr-s-grad .cr-pair>div:last-child{flex:0 0 200px;transform:translateY(72px) rotate(3deg)}
.cr-subs{gap:8px}
.cr-subs dd{font-size:20px;font-variant-numeric:tabular-nums}
.cr-s-grad .cr-quote{font-size:24px;line-height:1.25;margin-top:32px;padding-left:16px}

.cr-s-cont{padding-top:80px;padding-bottom:80px}
.cr-s-cont .cr-in{grid-template-rows:repeat(3,auto) 1fr}
.cr-s-cont .cr-in>:not(.cr-rail){grid-column:1/6}
.cr-s-cont .cr-rail{grid-column:7/13;grid-row:1/span 4;overflow:visible;margin:0;padding:0 0 48px;gap:20px}
.cr-s-cont .cr-vid{flex:0 0 calc((100% - 40px)/3)}
.cr-s-cont .cr-vid:nth-child(2){margin-top:48px}
.cr-s-cont .cr-vid:nth-child(3){margin-top:16px}
.cr-vid-meta{font-size:14px}

.cr-s-par{padding-top:96px;padding-bottom:96px}
.cr-s-par{background:var(--bx-bg-elev)}
.cr-s-par .cr-in{grid-template-rows:auto auto auto 1fr}
.cr-s-par .cr-in>:not(.cr-partner){grid-column:8/13}
.cr-s-par .cr-eyebrow{margin-top:24px}
.cr-s-par .cr-h2{font-size:clamp(36px,3.4vw,48px)}
.cr-s-par .cr-partner{grid-column:1/7;grid-row:1/span 4;margin-top:0;padding:28px}
.cr-coupon{font-size:24px;min-height:64px;padding:0 20px;border-radius:12px;letter-spacing:.12em}

.cr-partner ul{gap:12px}
.cr-s-ctr{padding-top:104px;padding-bottom:104px}
.cr-s-ctr .cr-in>*{grid-column:1/-1}
.cr-ctr-intro{grid-column:1/9}
.cr-ctr-intro .cr-h2{font-size:clamp(36px,3.8vw,52px);line-height:1.02}
.cr-ctr-exemplo{max-width:760px;margin-left:auto;margin-right:auto;width:100%}
.cr-ctr-passos{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:44px}
.cr-ctr-passos::before{content:"";position:absolute;top:50%;left:9%;right:9%;height:1px;background:linear-gradient(90deg,rgba(var(--ac-1-rgb),.4),rgba(var(--ac-2-rgb),.35),rgba(var(--ac-1-rgb),.4));z-index:-1}
.cr-ctr-passo{min-height:440px;padding:28px}
.cr-ctr-arte{height:250px}
.cr-ctr-arte img{width:150px}
.cr-ctr-passo h3{font-size:26px}
.cr-ctr-passo p{min-height:66px}
.cr-s-faq{padding-top:88px;padding-bottom:88px}
.cr-s-faq .cr-in{grid-template-rows:auto auto 1fr}
.cr-s-faq .cr-eyebrow,.cr-s-faq .cr-steps{grid-column:1/5}
.cr-s-faq .cr-faq{grid-column:6/13;grid-row:1/span 3;margin-top:0}
.cr-steps b{font-size:17px}
.cr-q summary{min-height:60px;font-size:16px}
.cr-q p{font-size:15px}

.cr-close{text-align:left;padding-top:120px;padding-bottom:120px}
.cr-close .cr-h2{grid-column:1/9;grid-row:1/span 2;font-size:clamp(36px,3.4vw,52px);margin:0}
.cr-close .cr-cta{grid-column:9/13;grid-row:1;align-self:end;justify-self:stretch;min-width:0}
.cr-close .cr-micro{grid-column:9/13;grid-row:2}

.cr-sheet{padding:28px;max-height:calc(100dvh - 64px)}
/* O cadastro e um formulario de coluna unica: nao herda o CTA de largura
   automatica nem o titulo de secao do desktop. */
.cr-sheet .cr-h2{font-size:30px;line-height:1.1;margin-top:14px}
.cr-sheet .cr-cta{display:flex;width:100%;min-width:0;padding:0;justify-self:auto;margin-top:16px}
.cr-sheet .cr-micro{text-align:center}
}
@media (min-width:1024px) and (max-height:720px){
.cr-h1{font-size:42px}
.cr-hero .cr-in{padding:32px 0}
}
/* Hero compacto no celular (25/10/2026): com o contador, o CTA do hero tinha
   ido para baixo da dobra (912 px em 375x812). Leque menor, titulo e contador
   mais enxutos; o desktop nao muda. */
@media (max-width:767px){
.cr-hero{padding-top:18px}
.cr-h1{font-size:28px;margin-top:10px}
.cr-hero .cr-p{font-size:14.5px;margin-top:8px}
.cr-oferta{margin-top:12px}
.cr-oferta li{min-height:32px;font-size:12.5px}
.cr-ct{margin-top:10px;padding:12px}
.cr-ct-n{font-size:36px}
.cr-ct-pre,.cr-ct-t{font-size:14px}
.cr-ct-regua,.cr-ct-barra-cont{margin-top:10px}
.cr-ct-p{margin-top:8px}
.cr-hero .cr-cta{margin-top:14px}
.cr-ctr-passo{min-height:300px;padding:20px}
.cr-ctr-arte{height:150px;top:12px}
.cr-ctr-arte img{width:96px}
.cr-ctr-arte::before{width:56px;height:76px;transform:translate(-76px,18px) rotate(-12deg)}
.cr-ctr-arte::after{width:46px;height:64px;transform:translate(78px,-2px) rotate(14deg)}
}
@media (prefers-reduced-motion: reduce){.cr *{transition:none!important}.cr-ct-pulso{animation:none}}
`
