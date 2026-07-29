'use client'

/**
 * src/app/admin/conteudo/page.tsx
 *
 * GESTAO DE CONTEUDO — a regua de conteudo da Bynx dentro do painel.
 *
 * Por que ela migrou pra ca: o guia em HTML era consulta pura, e o estado
 * (o que ja foi feito, o que foi publicado) vivia no navegador de um aparelho
 * so. Aqui o estado persiste no banco, e duas coisas que o guia nao conseguia
 * fazer passam a existir:
 *
 *   - "Hoje": o que postar agora, puxado da grade da semana.
 *   - "Deu resultado": cadastros por canal, de `users.signup_utm_source`.
 *     Era o item da Fase 3 do proprio guia ("medir os cadastros vindos do
 *     Instagram") — virou coluna em 29/07/2026.
 *
 * O HTML original passa a ser historico. A fonte de verdade e esta tela.
 *
 * ★ Zero emoji (regra 15). O guia usava emoji nos pilares e campanhas; aqui
 *   tudo e icone SVG outline de Icons.tsx.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  IconCamera, IconCollection, IconWallet, IconRocket, IconChat,
  IconShield, IconTrendingUp, IconWarning, IconBolt, IconCheck,
  IconClock, IconCalendar, IconChart, IconTag, IconStar,
} from '@/components/ui/Icons'

// ─── Tokens ──────────────────────────────────────────────────────────────────
const AC = 'var(--ac-1)'
const TXT = 'var(--bx-text)'
const TXT2 = 'var(--bx-text-2)'
const TXT3 = 'var(--bx-text-3)'
const FAINT = 'var(--bx-text-faint)'
const SURF = 'var(--bx-surface)'
const SURF2 = 'var(--bx-surface-2)'
const SURF3 = 'var(--bx-surface-3)'
const BORD = 'var(--bx-border)'
const BORD2 = 'var(--bx-border-2)'

// Cor por pilar — mantida do guia original pra leitura ficar igual.
const P = { jornada: '#f59e0b', utilidade: '#60a5fa', preco: '#22c55e', novidade: '#a855f7', comunidade: '#ec4899' }

// ─── Dados da regua ──────────────────────────────────────────────────────────

const PILARES = [
  { id: 'jornada', nome: 'Jornada do Du', cor: P.jornada, Icon: IconCamera, tag: 'o coracao da marca',
    txt: 'Graduacao, abertura de booster, hits, o sobrinho, a colecao crescendo. Gera conexao e compartilhamento. E o que a concorrencia nao consegue copiar.',
    como: ['Formato: Reels com narracao', '2 a 3x por semana'] },
  { id: 'utilidade', nome: 'Utilidade do colecionador', cor: P.utilidade, Icon: IconCollection, tag: 'autoridade',
    txt: 'Como proteger carta, sleeve x toploader, como ver se e real, o que e reverse/foil, vale gradar, quanto custa gradar. Gera salvamento.',
    como: ['Formato: carrossel + Reels explicativo', '2x por semana'] },
  { id: 'preco', nome: 'Preco e mercado', cor: P.preco, Icon: IconWallet, tag: 'o produto aparecendo',
    txt: 'Quanto vale a carta X, o que valorizou, "voce jogou fora e hoje vale R$", os movers da semana. O preco em real e o gancho, sem pitch.',
    como: ['Formato: estatico ou carrossel com print da Bynx', '1 a 2x por semana'] },
  { id: 'novidade', nome: 'Novidades e lancamentos', cor: P.novidade, Icon: IconRocket, tag: 'timing',
    txt: 'Set novo, cartas pra cacar, data de lancamento, 30 anos do TCG. Surfa o hype e a busca do momento, atrai gente nova.',
    como: ['Formato: estatico + Reels de abertura', 'Sob demanda'] },
  { id: 'comunidade', nome: 'Comunidade e engajamento', cor: P.comunidade, Icon: IconChat, tag: 'alcance',
    txt: 'Enquetes, "rip ou abrir devagar?", memes do hobby, nostalgia, TCG Pocket. Barato de produzir, alto de engajar.',
    como: ['Formato: estatico + Stories', '1x no feed + todo dia nos Stories'] },
]

// dia 0 = domingo (Date.getDay())
const GRADE = [
  { dia: 'Domingo',  pilar: 'jornada',    fmt: 'Reels leve — recap / carta favorita' },
  { dia: 'Segunda',  pilar: 'jornada',    fmt: 'Reels — abertura, hit ou bastidor' },
  { dia: 'Terca',    pilar: 'utilidade',  fmt: 'Carrossel salvavel' },
  { dia: 'Quarta',   pilar: 'preco',      fmt: 'Estatico — "valia R$X, hoje vale R$Y"' },
  { dia: 'Quinta',   pilar: 'utilidade',  fmt: 'Reels explicativo ou set novo', pilar2: 'novidade' },
  { dia: 'Sexta',    pilar: 'jornada',    fmt: 'Reels emocional — o dia de mais compartilhamento' },
  { dia: 'Sabado',   pilar: 'comunidade', fmt: 'Enquete / meme' },
]

const GANCHOS: { p: keyof typeof P; t: string }[] = [
  { p: 'jornada', t: 'Deixei duas cartas pra gradar. Hoje saiu o resultado.' },
  { p: 'jornada', t: 'Meu sobrinho abriu o primeiro booster da vida. Olha a reacao.' },
  { p: 'jornada', t: 'Abri e no segundo booster veio o premio.' },
  { p: 'jornada', t: 'Falta uma carta pra fechar meu trio de Kanto.' },
  { p: 'jornada', t: 'Rasguei tudo de uma vez? Ou abri devagar? Confesso o que fiz.' },
  { p: 'jornada', t: 'A carta que mais me deu trabalho pra achar.' },
  { p: 'utilidade', t: 'Voce ta guardando suas cartas errado. Olha o jeito certo.' },
  { p: 'utilidade', t: 'Sleeve, toploader, pasta: quando usar cada um.' },
  { p: 'utilidade', t: 'Como saber se uma carta Pokemon e falsa em 10 segundos.' },
  { p: 'utilidade', t: 'O que significa cada numero da sua carta (ex: 090/084).' },
  { p: 'utilidade', t: 'Vale a pena gradar? Fiz as contas com preco real.' },
  { p: 'utilidade', t: 'Reverse, foil, pokeball: qual vale mais?' },
  { p: 'utilidade', t: 'Quanto custa gradar uma carta no Brasil em 2026.' },
  { p: 'preco', t: 'Essa carta voce jogou fora — hoje vale R$[X].' },
  { p: 'preco', t: 'As 5 cartas mais caras do [SET] agora.' },
  { p: 'preco', t: 'Comprei por R$X, hoje vale R$Y. A conta da valorizacao.' },
  { p: 'preco', t: 'O que subiu de preco essa semana no mercado brasileiro.' },
  { p: 'novidade', t: 'Chegou o [SET]. As cartas que voce tem que cacar.' },
  { p: 'novidade', t: 'Data confirmada: quando sai o [SET] no Brasil.' },
  { p: 'novidade', t: '30 anos de Pokemon TCG: as cartas que fizeram historia.' },
  { p: 'comunidade', t: 'Qual foi seu primeiro starter? (eu ja sei o meu)' },
  { p: 'comunidade', t: 'Rip and ship ou abrir devagar? Assume ai.' },
  { p: 'comunidade', t: 'A carta que TE fisgou de vez no hobby.' },
  { p: 'comunidade', t: 'Adivinha a carta pela arte. (serie)' },
  { p: 'comunidade', t: 'O maior perrengue de colecionador que voce ja passou.' },
]

const FASES = [
  { n: 1, nome: 'Fundacao', quando: 'Semana 1', itens: [
    { k: 'p1-bio', t: 'Ajustar a bio do perfil', s: 'Posicionamento claro: a casa do colecionador, contada por um colecionador. Link do bynx.gg em destaque.' },
    { k: 'p1-pilares', t: 'Fixar os 5 pilares como quadros', s: 'Todo post cai em um deles.' },
    { k: 'p1-grade', t: 'Montar a grade da semana', s: 'Ter o esqueleto pronto pra nunca abrir o app sem saber o que postar.' },
    { k: 'p1-destaques', t: 'Criar destaques por tema', s: 'Jornada, Como cuidar, Precos, Sets. Organiza a casa pra quem chega novo.' },
    { k: 'p1-confianca', t: 'Preparar 3 pecas de "comprar sem medo"', s: 'Ataca a dor de confianca que aparece nos comentarios da concorrencia.' },
  ]},
  { n: 2, nome: 'Ritmo', quando: 'Semanas 2 a 4', itens: [
    { k: 'p2-postar', t: 'Postar seguindo a grade', s: '6 a 7 por semana, com peso em Reels. Constancia vence viral isolado.' },
    { k: 'p2-stories', t: 'Stories todo dia', s: 'Enquete, bastidor, link do cadastro. E onde o lead nasce.' },
    { k: 'p2-comentarios', t: 'Responder todo comentario na 1a hora', s: 'O Instagram mede o engajamento inicial.' },
    { k: 'p2-campanha', t: 'Rodar 1 campanha', s: 'Comeca pela caca ao Squirtle 10, que ja esta viva.' },
    { k: 'p2-lead', t: 'Ativar 1 mecanica de lead por semana', s: 'Comeca pela "Quanto vale sua colecao?".' },
  ]},
  { n: 3, nome: 'Escala', quando: 'Mes 2 em diante', itens: [
    { k: 'p3-checkpoint', t: 'Checkpoint mensal', s: 'Quais 3 posts mais salvaram e compartilharam? Esse e o mapa do que repetir.' },
    { k: 'p3-dobrar', t: 'Dobrar a dose do que funcionou', s: 'O pilar que mais puxou ganha mais espaco na semana seguinte.' },
    { k: 'p3-reaproveitar', t: 'Reaproveitar o campeao', s: 'Reels que foi bem vira carrossel e vira Stories.' },
    { k: 'p3-leads', t: 'Medir os cadastros vindos do Instagram', s: 'Agora da: ver a aba Resultado.' },
    { k: 'p3-meta', t: 'Ajustar o ritmo pros 10k', s: 'Usa a calculadora na aba Metas.' },
  ]},
]

const CHECKLIST_POST = [
  { grupo: 'Antes de postar', itens: [
    { k: 'c-gancho', t: 'Gancho forte nos 2 primeiros segundos', s: 'Fala + texto na tela. Introducao sem valor custa alcance.' },
    { k: 'c-texto', t: 'Texto na tela sempre', s: 'Roda sem som e ajuda o Instagram a entender o tema.' },
    { k: 'c-marca', t: "Sem marca d'agua de outro app", s: 'CapCut/TikTok penaliza. Exporta limpo.' },
    { k: 'c-seo', t: 'Legenda com palavra-chave clara', s: 'cartas pokemon, colecionador, preco em real, graduacao, nome do set.' },
    { k: 'c-pergunta', t: 'Termina com pergunta', s: 'Puxa comentario. Comentario e alcance.' },
    { k: 'c-cta', t: 'CTA suave: bynx.gg no rodape', s: '' },
  ]},
  { grupo: 'Logo depois de postar', itens: [
    { k: 'c-primeiro', t: 'Primeiro comentario seu', s: 'Reforco, pergunta ou CTA.' },
    { k: 'c-responder', t: 'Responder todo comentario na 1a hora', s: '' },
    { k: 'c-reels', t: 'Comentario bom? Responde com um Reels', s: 'Formato que o algoritmo premia.' },
    { k: 'c-reuso', t: 'Reels que foi bem vira carrossel e Stories', s: '' },
  ]},
]

const CAMPANHAS = [
  { t: 'A caca ao Squirtle 10', status: 'no ar', cor: '#22c55e',
    d: 'Voce tem Charmander 10 e Bulbasaur 10. Falta o Squirtle pra fechar o trio de Kanto. Aberturas diarias cacando, graduacao, veredito. Novela pura.',
    cta: 'acompanha a caca + montei o trio na Bynx' },
  { t: 'Lancamento de set', status: '', cor: '',
    d: 'Teaser, abertura, as cartas mais valiosas pra cacar com preco da Bynx, o hit. Surfa a busca do lancamento.',
    cta: 'checklist do set na Bynx' },
  { t: 'Quanto vale sua colecao?', status: 'lead forte', cor: 'var(--ac-1)',
    d: 'Provocacao, prova (a sua vale isso, olha), convite (descobre a sua de graca). A mecanica de captacao mais direta.',
    cta: 'cadastro na Bynx' },
  { t: 'Loja Validada', status: 'B2B', cor: '#60a5fa',
    d: 'O que e o selo, por que da confianca ao comprador, como a loja consegue, depoimento. Ataca a dor de "e seguro?".',
    cta: 'cadastre sua loja e peca o selo' },
  { t: '30 anos do Pokemon TCG', status: '', cor: '',
    d: 'Nostalgia, cartas historicas, o quanto valorizaram, "sua base set valia quanto?". Nostalgia e o combustivel de compartilhamento numero 1 do nicho.',
    cta: 'veja quanto valem as antigas na Bynx' },
]

const LEADS = [
  { t: 'Quanto vale sua colecao? (a principal)', f: 'Reels ou carrossel', c:
`Voce provavelmente tem mais dinheiro parado em cartas do que imagina.
Peguei a minha colecao e a Bynx me mostrou o valor de tudo, em real, atualizado do mercado brasileiro.
Quer descobrir quanto vale a sua? E de graca e leva uns minutos: cadastra em bynx.gg e vai adicionando suas cartas.
Me conta aqui embaixo: voce acha que sua colecao passa de R$500, R$1.000 ou R$5.000?` },
  { t: 'Comentario como chave', f: 'Reels curto', c:
`Fiz uma lista das cartas mais valiosas do [SET] com o preco de cada uma.
Comenta QUERO aqui embaixo que eu te mando o link pra voce conferir e marcar o que ja tem.` },
  { t: 'Prova social do valor', f: 'Estatico / carrossel', c:
`Essa carta ficou anos parada numa gaveta. Hoje ela vale R$[X].
A parte chata e nao saber o que voce tem. A boa e que da pra descobrir em minutos.
Cadastra sua colecao em bynx.gg e veja o valor de cada carta sua, em real.` },
  { t: 'Stories em funil (todo dia)', f: '3 telas de Stories', c:
`Tela 1 — Enquete: "Voce sabe quanto vale sua colecao?" (Sei / Nao faco ideia)
Tela 2 — Bastidor: print da sua colecao na Bynx com o valor.
Tela 3 — Link: "Descubra a sua em bynx.gg"` },
  { t: 'Lojista (lead B2B)', f: 'Reels / carrossel', c:
`Loja de card: seus clientes confiam mais quando veem o selo de verificada.
Na Bynx a sua loja ganha vitrine, e o Selo de Loja Validada mostra que ali e gente seria.
Chama no direct "LOJA" que eu te explico como funciona.` },
]

const ABAS = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'resultado', nome: 'Resultado' },
  { id: 'semana', nome: 'A semana' },
  { id: 'plano', nome: 'Plano de acao' },
  { id: 'pilares', nome: 'Pilares' },
  { id: 'campanhas', nome: 'Campanhas' },
  { id: 'leads', nome: 'Leads' },
  { id: 'ganchos', nome: 'Ganchos' },
  { id: 'checklist', nome: 'Checklist' },
  { id: 'metas', nome: 'Metas' },
  { id: 'visao', nome: 'Visao geral' },
]

// ─── Estilos ─────────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: SURF, border: `1px solid ${BORD}`, borderRadius: 12, padding: '16px 18px' }
const h2: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: '26px 0 12px', display: 'flex', alignItems: 'center', gap: 8, color: TXT }
const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
  padding: '9px 14px', borderRadius: 10, border: `1px solid ${BORD2}`, background: SURF2, color: TXT2,
  cursor: 'pointer', transition: 'background .15s ease, color .15s ease, transform .15s ease',
}
const btnPri: React.CSSProperties = { ...btn, background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', borderColor: 'transparent' }
const miniBtn: React.CSSProperties = {
  border: `1px solid ${BORD2}`, background: 'transparent', color: TXT3, fontFamily: 'inherit',
  fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
  transition: 'color .15s ease, border-color .15s ease', flexShrink: 0,
}

function Pill({ pilar }: { pilar: keyof typeof P }) {
  const nome = { jornada: 'Jornada', utilidade: 'Utilidade', preco: 'Preco', novidade: 'Novidade', comunidade: 'Comunidade' }[pilar]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
      padding: '3px 9px', borderRadius: 999, background: SURF3, color: P[pilar], flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />
      {nome}
    </span>
  )
}

function Check({ feito, onClick, titulo, sub }: { feito: boolean; onClick: () => void; titulo: string; sub?: string }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 10,
        cursor: 'pointer', border: `1px solid ${BORD}`, background: SURF, marginBottom: 8,
        transition: 'background .15s ease, border-color .15s ease, transform .15s ease',
      }}
    >
      <span style={{
        flexShrink: 0, width: 20, height: 20, borderRadius: 6, marginTop: 1,
        border: feito ? '2px solid transparent' : `2px solid ${BORD2}`,
        background: feito ? 'var(--ac-grad)' : 'transparent',
        display: 'grid', placeItems: 'center',
      }}>
        {feito && <IconCheck size={12} color="var(--bx-brand-ink)" strokeWidth={3.5} />}
      </span>
      <span style={{ fontSize: 14, color: feito ? TXT3 : TXT, textDecoration: feito ? 'line-through' : 'none' }}>
        {titulo}
        {sub ? <small style={{ display: 'block', color: TXT3, fontSize: 12.5, marginTop: 2, textDecoration: 'none' }}>{sub}</small> : null}
      </span>
    </div>
  )
}

// ─── Pagina ──────────────────────────────────────────────────────────────────

type Post = { data: string; pilar: string | null; formato: string | null; gancho: string | null }
type Canal = { nome: string; total: number }

export default function GestaoConteudo() {
  const [aba, setAba] = useState('hoje')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [posts, setPosts] = useState<Post[]>([])
  const [canais, setCanais] = useState<Canal[]>([])
  const [totalCadastros, setTotalCadastros] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState('')
  const [filtroGancho, setFiltroGancho] = useState<'todos' | keyof typeof P>('todos')
  const [ganchoIdx, setGanchoIdx] = useState(0)
  const [seguidores, setSeguidores] = useState(1553)
  const [semanas, setSemanas] = useState(22)

  const hoje = new Date()
  const hojeISO = hoje.toISOString().slice(0, 10)
  const grade = GRADE[hoje.getDay()]
  const pilarHoje = PILARES.find((p) => p.id === grade.pilar)!
  const publicadoHoje = posts.some((p) => p.data === hojeISO)

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/conteudo')
      if (!r.ok) throw new Error('falha ao carregar')
      const d = await r.json()
      setChecklist(d.checklist || {})
      setPosts(d.posts || [])
      setCanais(d.canais || [])
      setTotalCadastros(d.totalCadastros || 0)
      setErro('')
    } catch {
      setErro('Nao consegui carregar o estado. Recarrega a pagina.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function toggle(chave: string) {
    const novo = !checklist[chave]
    setChecklist((c) => ({ ...c, [chave]: novo }))   // otimista
    try {
      await fetch('/api/admin/conteudo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'checklist', chave, feito: novo }),
      })
    } catch {
      setChecklist((c) => ({ ...c, [chave]: !novo }))  // desfaz se falhou
    }
  }

  async function marcarPublicado() {
    const gancho = ganchosFiltrados[ganchoIdx % Math.max(1, ganchosFiltrados.length)]?.t
    await fetch('/api/admin/conteudo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'publicar', data: hojeISO, pilar: grade.pilar, formato: grade.fmt, gancho }),
    })
    carregar()
  }

  async function desmarcar(data: string) {
    await fetch('/api/admin/conteudo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'desmarcar', data }),
    })
    carregar()
  }

  function copiar(txt: string, id: string) {
    navigator.clipboard?.writeText(txt).then(() => {
      setCopiado(id)
      setTimeout(() => setCopiado(''), 1500)
    }).catch(() => {})
  }

  const ganchosFiltrados = GANCHOS.filter((g) => filtroGancho === 'todos' || g.p === filtroGancho)
  const ganchoDoDia = GANCHOS.filter((g) => g.p === grade.pilar)
  const sugestao = ganchoDoDia[ganchoIdx % Math.max(1, ganchoDoDia.length)]

  const totalChecks = FASES.reduce((n, f) => n + f.itens.length, 0) + CHECKLIST_POST.reduce((n, g) => n + g.itens.length, 0)
  const feitos = Object.values(checklist).filter(Boolean).length
  const faltam = Math.max(0, 10000 - seguidores)
  const porSemana = semanas > 0 ? Math.ceil(faltam / semanas) : 0

  // Segunda-feira da semana corrente, pra montar a grade com data real.
  const seg = new Date(hoje)
  seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7))

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4, color: TXT }}>
        Gestao de conteudo
      </h1>
      <p style={{ color: TXT3, fontSize: 14, marginBottom: 18 }}>
        O que postar hoje, se voce esta em dia, e quanto isso virou cadastro.
        {totalChecks > 0 && <span style={{ marginLeft: 8, color: FAINT }}>{feitos} de {totalChecks} passos marcados</span>}
      </p>

      {erro && (
        <div style={{ ...card, borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', marginBottom: 14 }}>{erro}</div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 20 }}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              border: `1px solid ${aba === a.id ? BORD2 : BORD}`, background: aba === a.id ? SURF3 : SURF,
              color: aba === a.id ? TXT : TXT3, fontFamily: 'inherit', fontSize: 12.5,
              fontWeight: aba === a.id ? 600 : 500, padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            {a.nome}
          </button>
        ))}
      </div>

      {carregando && <p style={{ color: TXT3, fontSize: 14 }}>Carregando...</p>}

      {/* ─── HOJE ─────────────────────────────────────────────────────────── */}
      {aba === 'hoje' && !carregando && (
        <>
          <div style={{
            background: 'var(--bx-hero-wash), var(--bx-surface)', border: `1px solid ${BORD2}`,
            borderRadius: 14, padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <Pill pilar={grade.pilar as keyof typeof P} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: AC }}>
                {grade.dia}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: TXT3 }}>{grade.fmt}</span>
            </div>

            <h3 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 6, color: TXT }}>
              {pilarHoje.nome}
            </h3>
            <p style={{ color: TXT2, fontSize: 14, marginBottom: 14, maxWidth: '62ch' }}>{pilarHoje.txt}</p>

            {sugestao && (
              <div style={{
                background: 'var(--bx-bg-elev)', border: `1px solid ${BORD}`, borderRadius: 10,
                padding: '12px 14px', fontSize: 14, color: TXT2, display: 'flex',
                alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap',
              }}>
                <IconBolt size={16} color={AC} />
                <span style={{ flex: 1, minWidth: 200 }}>{sugestao.t}</span>
                <button style={miniBtn} onClick={() => copiar(sugestao.t, 'hoje')}>
                  {copiado === 'hoje' ? 'copiado' : 'copiar'}
                </button>
                <button style={miniBtn} onClick={() => setGanchoIdx((i) => i + 1)}>outro</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {publicadoHoje ? (
                <>
                  <span style={{ ...btn, background: 'rgba(34,197,94,0.14)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.4)', cursor: 'default' }}>
                    <IconCheck size={14} color="#22c55e" /> Publicado hoje
                  </span>
                  <button style={btn} onClick={() => desmarcar(hojeISO)}>Desfazer</button>
                </>
              ) : (
                <button style={btnPri} onClick={marcarPublicado}>
                  <IconCheck size={14} color="var(--bx-brand-ink)" /> Marcar como publicado
                </button>
              )}
              <button style={btn} onClick={() => setAba('checklist')}>Ver checklist do post</button>
            </div>
          </div>

          <div style={{ ...card, marginTop: 14, borderLeft: `3px solid ${AC}`, borderRadius: '0 12px 12px 0' }}>
            <p style={{ fontSize: 13.5, color: TXT2, margin: 0 }}>
              <strong style={{ color: TXT }}>O teste antes de postar:</strong>{' '}
              isso e salvavel ou compartilhavel? Se nao for nenhum dos dois, refaz.
              Persiga salvamento, compartilhamento, comentario e retencao — nessa ordem. Seguidor e consequencia.
            </p>
          </div>
        </>
      )}

      {/* ─── RESULTADO ────────────────────────────────────────────────────── */}
      {aba === 'resultado' && !carregando && (
        <>
          <h2 style={h2}><IconChart size={16} color={TXT3} /> Cadastros por canal
            <span style={{ marginLeft: 'auto', fontSize: 12, color: FAINT, fontWeight: 400 }}>ultimos 30 dias</span>
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
            <div style={{ background: SURF, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: TXT3, marginBottom: 5 }}>Cadastros no periodo</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: TXT }}>{totalCadastros}</div>
            </div>
            <div style={{ background: SURF, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: TXT3, marginBottom: 5 }}>Com origem identificada</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: TXT }}>
                {canais.filter((c) => c.nome !== '(sem origem)').reduce((n, c) => n + c.total, 0)}
              </div>
            </div>
            <div style={{ background: SURF, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: TXT3, marginBottom: 5 }}>Publicados nesta semana</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: TXT }}>{posts.length} <span style={{ fontSize: 14, color: TXT3 }}>de 7</span></div>
            </div>
          </div>

          <div style={{ ...card, padding: 0 }}>
            {canais.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '26px 16px', color: TXT3, fontSize: 13.5 }}>
                Nenhum cadastro no periodo.
              </p>
            ) : canais.map((c) => (
              <div key={c.nome} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderBottom: `1px solid ${BORD}`, fontSize: 13.5,
              }}>
                <span style={{ flex: 1, color: c.nome === '(sem origem)' ? TXT3 : TXT2 }}>{c.nome}</span>
                <span style={{ width: 120, height: 6, borderRadius: 999, background: SURF3, overflow: 'hidden' }}>
                  <span style={{
                    display: 'block', height: '100%', borderRadius: 999,
                    width: `${Math.round((c.total / Math.max(1, canais[0].total)) * 100)}%`,
                    background: c.nome === '(sem origem)' ? BORD2 : 'var(--ac-grad)',
                  }} />
                </span>
                <span style={{ width: 38, textAlign: 'right', fontWeight: 600, color: TXT, fontVariantNumeric: 'tabular-nums' }}>{c.total}</span>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginTop: 14, borderLeft: `3px solid ${AC}`, borderRadius: '0 12px 12px 0' }}>
            <p style={{ fontSize: 13.5, color: TXT2, margin: 0 }}>
              <strong style={{ color: TXT }}>Por que muita coisa cai em "(sem origem)":</strong>{' '}
              a captura de atribuicao passou a existir em 29/07/2026. Cadastro anterior a isso nao tem
              como saber de onde veio — nao e falha, e ausencia de dado. A proporcao com origem sobe
              conforme os cadastros novos entram.
            </p>
          </div>
        </>
      )}

      {/* ─── A SEMANA ─────────────────────────────────────────────────────── */}
      {aba === 'semana' && !carregando && (
        <>
          <h2 style={h2}><IconCalendar size={16} color={TXT3} /> A semana-modelo
            <span style={{ marginLeft: 'auto', fontSize: 12, color: FAINT, fontWeight: 400 }}>{posts.length} de 7 publicados</span>
          </h2>
          <div style={{ border: `1px solid ${BORD}`, borderRadius: 12, overflow: 'hidden' }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const g = GRADE[d]
              const dt = new Date(seg)
              dt.setDate(seg.getDate() + ((d + 6) % 7))
              const iso = dt.toISOString().slice(0, 10)
              const pub = posts.some((p) => p.data === iso)
              const ehHoje = iso === hojeISO
              return (
                <div key={g.dia} style={{
                  display: 'grid', gridTemplateColumns: '96px 1fr 112px', alignItems: 'center',
                  borderBottom: `1px solid ${BORD}`, fontSize: 13.5,
                  background: ehHoje ? 'rgba(var(--ac-1-rgb),0.05)' : 'transparent',
                }}>
                  <div style={{ padding: '11px 14px', fontWeight: 600, color: TXT2, borderRight: `1px solid ${BORD}` }}>{g.dia}</div>
                  <div style={{ padding: '11px 14px', color: TXT2, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <Pill pilar={g.pilar as keyof typeof P} />
                    {g.pilar2 && <Pill pilar={g.pilar2 as keyof typeof P} />}
                    {g.fmt}
                  </div>
                  <div style={{ padding: '11px 14px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>
                    {pub ? <span style={{ color: '#22c55e' }}>publicado</span>
                      : ehHoje ? <span style={{ color: AC }}>hoje</span>
                      : <span style={{ color: FAINT }}>pendente</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ ...card, marginTop: 14 }}>
            <p style={{ fontSize: 13.5, color: TXT2, margin: 0 }}>
              <strong style={{ color: TXT }}>Mix que importa:</strong> Reels e o motor — engaja 59% mais que
              carrossel e 75% mais que estatico. Meta de feed: cerca de 1 por dia. Nao precisa ser perfeito
              todo dia, precisa ser constante. Stories todo dia, sem excecao.
            </p>
          </div>
        </>
      )}

      {/* ─── PLANO DE ACAO ────────────────────────────────────────────────── */}
      {aba === 'plano' && !carregando && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 18, maxWidth: '70ch' }}>
            Tres fases, na ordem. A fundacao sustenta o ritmo, o ritmo gera os dados, os dados guiam a escala.
          </p>
          {FASES.map((f) => (
            <div key={f.n} style={{ marginBottom: 26 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center',
                  background: 'var(--ac-grad)', color: 'var(--bx-brand-ink)', fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>{f.n}</span>
                <h2 style={{ ...h2, margin: 0, fontSize: 17 }}>{f.nome}</h2>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: TXT3 }}>{f.quando}</span>
              </div>
              {f.itens.map((i) => (
                <Check key={i.k} feito={!!checklist[i.k]} onClick={() => toggle(i.k)} titulo={i.t} sub={i.s} />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ─── PILARES ──────────────────────────────────────────────────────── */}
      {aba === 'pilares' && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 18, maxWidth: '70ch' }}>
            Todo conteudo perene cai em um destes cinco. Mantenha o equilibrio ao longo da semana.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {PILARES.map((p) => (
              <div key={p.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <p.Icon size={18} color={p.cor} />
                  <strong style={{ fontSize: 15, fontWeight: 600, color: TXT }}>{p.nome}</strong>
                </div>
                <p style={{ fontSize: 12.5, color: p.cor, marginBottom: 8, fontWeight: 600 }}>{p.tag}</p>
                <p style={{ fontSize: 13.5, color: TXT2, marginBottom: 10 }}>{p.txt}</p>
                {p.como.map((c) => (
                  <p key={c} style={{ fontSize: 13, color: TXT3, paddingLeft: 14, position: 'relative', marginBottom: 4 }}>
                    <span style={{ position: 'absolute', left: 0, color: p.cor }}>&rsaquo;</span>{c}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── CAMPANHAS ────────────────────────────────────────────────────── */}
      {aba === 'campanhas' && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 18, maxWidth: '70ch' }}>
            Historia com comeco, meio e fim (5 a 10 dias), com CTA claro. E o que faz a base voltar todo dia
            pra ver o proximo capitulo. Rode uma por vez, por tras do conteudo perene.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {CAMPANHAS.map((c) => (
              <div key={c.t} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, flexWrap: 'wrap' }}>
                  <IconTag size={16} color={TXT3} />
                  <strong style={{ fontSize: 15, fontWeight: 600, color: TXT }}>{c.t}</strong>
                  {c.status && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
                      background: SURF3, color: c.cor || TXT3,
                    }}>{c.status}</span>
                  )}
                </div>
                <p style={{ fontSize: 13.5, color: TXT2, marginBottom: 8 }}>{c.d}</p>
                <p style={{ fontSize: 12.5, color: TXT3 }}>CTA: {c.cta}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── LEADS ────────────────────────────────────────────────────────── */}
      {aba === 'leads' && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 18, maxWidth: '70ch' }}>
            Lead da Bynx e cadastro no app. A regra: entregue valor <strong style={{ color: TXT }}>antes</strong> de
            pedir o cadastro. Copies prontas.
          </p>
          {LEADS.map((l, i) => (
            <div key={l.t} style={{ ...card, marginBottom: 14 }}>
              <strong style={{ fontSize: 15, fontWeight: 600, color: TXT, display: 'block', marginBottom: 3 }}>{l.t}</strong>
              <p style={{ fontSize: 12.5, color: TXT3, marginBottom: 10 }}>Formato: {l.f}</p>
              <div style={{
                position: 'relative', background: 'var(--bx-bg-elev)', border: `1px solid ${BORD}`,
                borderRadius: 10, padding: '14px 16px', fontSize: 13.5, color: TXT2,
                whiteSpace: 'pre-wrap', lineHeight: 1.55,
              }}>
                <button
                  style={{ ...miniBtn, position: 'absolute', top: 10, right: 10 }}
                  onClick={() => copiar(l.c, `lead-${i}`)}
                >{copiado === `lead-${i}` ? 'copiado' : 'copiar'}</button>
                {l.c}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ─── GANCHOS ──────────────────────────────────────────────────────── */}
      {aba === 'ganchos' && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 14, maxWidth: '70ch' }}>
            A primeira frase, os 2 primeiros segundos. {GANCHOS.length} prontos.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
            {(['todos', 'jornada', 'utilidade', 'preco', 'novidade', 'comunidade'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroGancho(f)}
                style={{
                  border: `1px solid ${filtroGancho === f ? BORD2 : BORD}`,
                  background: filtroGancho === f ? SURF3 : SURF,
                  color: filtroGancho === f ? TXT : TXT3, fontFamily: 'inherit', fontSize: 12.5,
                  fontWeight: 500, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                  textTransform: 'capitalize', transition: 'background .15s ease, color .15s ease',
                }}
              >{f}</button>
            ))}
          </div>
          {ganchosFiltrados.map((g, i) => (
            <div key={g.t} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px',
              border: `1px solid ${BORD}`, background: SURF, borderRadius: 10, marginBottom: 7, fontSize: 13.5,
            }}>
              <Pill pilar={g.p} />
              <span style={{ flex: 1, color: TXT }}>{g.t}</span>
              <button style={miniBtn} onClick={() => copiar(g.t, `g-${i}`)}>
                {copiado === `g-${i}` ? 'copiado' : 'copiar'}
              </button>
            </div>
          ))}
        </>
      )}

      {/* ─── CHECKLIST DO POST ────────────────────────────────────────────── */}
      {aba === 'checklist' && !carregando && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 18, maxWidth: '70ch' }}>
            Rotina operacional. Marca conforme faz — vira automatico depois de algumas semanas.
          </p>
          {CHECKLIST_POST.map((g) => (
            <div key={g.grupo} style={{ marginBottom: 22 }}>
              <h2 style={h2}><IconCheck size={16} color={TXT3} /> {g.grupo}</h2>
              {g.itens.map((i) => (
                <Check key={i.k} feito={!!checklist[i.k]} onClick={() => toggle(i.k)} titulo={i.t} sub={i.s} />
              ))}
            </div>
          ))}
        </>
      )}

      {/* ─── METAS ────────────────────────────────────────────────────────── */}
      {aba === 'metas' && (
        <>
          <p style={{ color: TXT2, fontSize: 14, marginBottom: 18, maxWidth: '70ch' }}>
            KPI primario: crescimento liquido por semana + taxa de salvamento e compartilhamento.
            Nao likes, nao numero bruto.
          </p>

          <div style={card}>
            <strong style={{ fontSize: 15, fontWeight: 600, color: TXT, display: 'block', marginBottom: 3 }}>Calculadora de ritmo</strong>
            <p style={{ fontSize: 12.5, color: TXT3, marginBottom: 14 }}>Quantos seguidores por semana pra chegar aos 10k.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label htmlFor="seg" style={{ display: 'block', fontSize: 12.5, color: TXT3, fontWeight: 600, marginBottom: 6 }}>Seguidores hoje</label>
                <input id="seg" type="number" value={seguidores} onChange={(e) => setSeguidores(Number(e.target.value) || 0)}
                  style={{ width: '100%', background: 'var(--bx-bg-elev)', border: `1px solid ${BORD2}`, borderRadius: 8, color: TXT, fontFamily: 'inherit', fontSize: 15, padding: '10px 12px' }} />
              </div>
              <div>
                <label htmlFor="sem" style={{ display: 'block', fontSize: 12.5, color: TXT3, fontWeight: 600, marginBottom: 6 }}>Semanas restantes</label>
                <input id="sem" type="number" value={semanas} onChange={(e) => setSemanas(Number(e.target.value) || 0)}
                  style={{ width: '100%', background: 'var(--bx-bg-elev)', border: `1px solid ${BORD2}`, borderRadius: 8, color: TXT, fontFamily: 'inherit', fontSize: 15, padding: '10px 12px' }} />
              </div>
            </div>
            <div style={{ background: 'var(--bx-hero-wash), var(--bx-surface)', border: `1px solid ${BORD}`, borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: AC }}>
                {faltam <= 0 ? 'Meta batida' : `+${porSemana.toLocaleString('pt-BR')} / semana`}
              </div>
              <div style={{ fontSize: 13, color: TXT3 }}>
                {faltam <= 0 ? 'Proxima meta?' : `Faltam ${faltam.toLocaleString('pt-BR')} em ${semanas} semanas — cerca de ${Math.ceil(porSemana / 7)} por dia.`}
              </div>
            </div>
          </div>

          <h2 style={h2}><IconTrendingUp size={16} color={TXT3} /> Pago x organico</h2>
          <div style={{ ...card, borderLeft: `3px solid ${AC}`, borderRadius: '0 12px 12px 0' }}>
            <p style={{ fontSize: 13.5, color: TXT2, marginBottom: 10 }}>
              <strong style={{ color: TXT }}>A leitura honesta:</strong> se o crescimento depende do
              impulsionamento, os 10k sao uma meta cara, nao organica. Quando o gasto baixa, o ritmo cai junto —
              a menos que o organico esteja crescendo por baixo.
            </p>
            {[
              'Todo post nasce organico. Deixa rodar 24 a 48h sem impulsionar.',
              'Impulsiona so o vencedor — o que teve salvamento ou retencao acima da media sozinho.',
              'O que floppou nao recebe dinheiro. Aprende e descarta.',
              'Meta paralela: crescer o organico, que e o que sustenta quando o gasto baixar.',
            ].map((t) => (
              <p key={t} style={{ fontSize: 13.5, color: TXT2, paddingLeft: 16, position: 'relative', marginBottom: 5 }}>
                <span style={{ position: 'absolute', left: 0, color: AC }}>&rsaquo;</span>{t}
              </p>
            ))}
          </div>

          <div style={{ ...card, marginTop: 14 }}>
            <p style={{ fontSize: 13.5, color: TXT2, margin: 0 }}>
              <strong style={{ color: TXT }}>O numero que falta:</strong> o custo por seguidor
              (gasto mensal dividido por seguidores ganhos). Com ele na mao da pra decidir se os 10k valem o
              investimento, ou se a meta sustentavel e 5 a 7k combinando organico forte com pago pontual.
            </p>
          </div>
        </>
      )}

      {/* ─── VISAO GERAL ──────────────────────────────────────────────────── */}
      {aba === 'visao' && (
        <>
          <div style={{
            background: 'var(--bx-hero-wash), var(--bx-surface)', border: `1px solid ${BORD}`,
            borderRadius: 16, padding: '24px 22px', marginBottom: 18,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: AC }}>A tese</span>
            <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 8px', color: TXT }}>
              A casa do colecionador brasileiro, contada por um colecionador.
            </h3>
            <p style={{ color: TXT2, fontSize: 14.5, maxWidth: '70ch' }}>
              Os concorrentes sao marketplaces sem rosto. Nenhum tem um fundador colecionador construindo em
              publico. Voce tem. E o algoritmo premia exatamente isso: rosto, bastidor, historia e utilidade.
            </p>
          </div>

          <h2 style={h2}><IconStar size={16} color={TXT3} /> O que a concorrencia ensinou</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {[
              { Icon: IconShield, t: 'A dor numero 1 e confianca', d: '"E seguro mesmo? Da pra confiar no site?" A audiencia tem medo de comprar online. O Selo de Loja Validada e o repasse protegido sao a resposta.' },
              { Icon: IconTrendingUp, t: 'Existe demanda de venda reprimida', d: '"Quero vender as minhas!" e "alguem que venda em Pernambuco?" — intencao clara de vender e de achar gente perto.' },
              { Icon: IconWarning, t: 'Numero inflado nao engaja', d: 'Um concorrente segue 3,5 mil contas pra inflar numero, e o post fixado tem 49 curtidas num perfil de 26 mil. Folheto sem alma.' },
            ].map((c) => (
              <div key={c.t} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <c.Icon size={18} color={AC} />
                  <strong style={{ fontSize: 15, fontWeight: 600, color: TXT }}>{c.t}</strong>
                </div>
                <p style={{ fontSize: 13.5, color: TXT2 }}>{c.d}</p>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginTop: 16, borderLeft: `3px solid ${AC}`, borderRadius: '0 12px 12px 0' }}>
            <p style={{ fontSize: 13.5, color: TXT2, margin: 0 }}>
              <strong style={{ color: TXT }}>A regra de ouro:</strong> pare de perseguir numero de seguidor.
              Persiga salvamento, compartilhamento, comentario e retencao — nessa ordem.
            </p>
          </div>
        </>
      )}

      <p style={{ color: FAINT, fontSize: 12.5, marginTop: 30, paddingTop: 16, borderTop: `1px solid ${BORD}` }}>
        <IconClock size={12} color={FAINT} /> Progresso e publicacoes ficam no banco — valem em qualquer aparelho.
      </p>
    </div>
  )
}
