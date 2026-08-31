import Link from 'next/link'
import PublicHeader from '@/components/ui/PublicHeader'
import PublicFooter from '@/components/ui/PublicFooter'

/**
 * Lista de subprocessadores.
 *
 * Existe por uma obrigacao concreta: o art. 9º da LGPD da ao titular o direito
 * de saber COM QUEM os dados dele sao compartilhados, e o art. 18, VII permite
 * pedir essa informacao. A secao 4 da Politica descreve as CATEGORIAS; a
 * identificacao nominal vive aqui.
 *
 * ★ noindex de proposito. Nao e conteudo de busca, nao disputa palavra-chave e
 * nao deve competir com a Politica no indice. Nao esta em STATIC_ROUTES do
 * sitemap -- adicionar seria mexer em superficie de crawl, que e decisao do Du.
 *
 * ★ Ao mexer aqui, mexer TAMBEM na secao 4 e na 9 da Politica: as duas
 * apontam pra ca, e documento que se contradiz e pior que documento incompleto.
 */

export const metadata = {
  title: 'Subprocessadores',
  description: 'Fornecedores que tratam dados pessoais a serviço da Bynx.',
  robots: { index: false, follow: false },
}

const UPDATED = '30 de agosto de 2026'

type Sub = { nome: string; papel: string; dados: string; local: string }

const INFRA: Sub[] = [
  { nome: 'Supabase',   papel: 'Banco de dados e autenticação', dados: 'Dados de conta e conteúdo da coleção', local: 'Estados Unidos' },
  { nome: 'Vercel',     papel: 'Hospedagem da aplicação',       dados: 'Dados de acesso e logs técnicos',      local: 'Estados Unidos' },
  { nome: 'Cloudflare', papel: 'Proteção contra robôs no cadastro e login', dados: 'Endereço IP e sinais do dispositivo', local: 'Estados Unidos' },
]

const OPERACAO: Sub[] = [
  { nome: 'Stripe',        papel: 'Pagamentos e repasses',            dados: 'Dados de cobrança e do pedido', local: 'Estados Unidos' },
  { nome: 'Resend',        papel: 'E-mails transacionais',            dados: 'Nome e e-mail',                 local: 'Estados Unidos' },
  { nome: 'Melhor Envio',  papel: 'Cotação de frete',                 dados: 'CEP de origem e destino',       local: 'Brasil' },
  { nome: 'ViaCEP',        papel: 'Preenchimento de endereço',        dados: 'CEP informado',                 local: 'Brasil' },
  { nome: 'Anthropic',     papel: 'Processamento das imagens do Scan por IA', dados: 'A imagem enviada no escaneamento, sem uso para treinamento', local: 'Estados Unidos' },
]

const MEDICAO: Sub[] = [
  { nome: 'Google (Tag Manager e Analytics 4)', papel: 'Métricas de uso',        dados: 'Eventos de navegação',              local: 'Estados Unidos' },
  { nome: 'PostHog',                            papel: 'Análise de uso e gravação de sessão', dados: 'Eventos e perfil identificado por e-mail', local: 'Estados Unidos' },
  { nome: 'Sentry',                             papel: 'Monitoramento de erros', dados: 'Identificador, e-mail e nome do usuário logado', local: 'Estados Unidos' },
  { nome: 'Meta',                               papel: 'Medição dos nossos anúncios', dados: 'Eventos de conversão',         local: 'Estados Unidos' },
]

export default function SubprocessadoresPage() {
  return (
    <div style={{ background: '#080a0f', minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", color: '#f0f0f0' }}>
      <PublicHeader />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 24px 100px' }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Documento legal</p>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>Subprocessadores</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 32 }}>Última atualização: {UPDATED}</p>

        <P>Estes são os fornecedores que tratam dados pessoais a serviço da Bynx. Eles agem seguindo nossas instruções e apenas para as finalidades descritas na <Link href="/privacidade" style={{ color: '#f59e0b' }}>Política de Privacidade</Link>.</P>
        <P>Quando um fornecedor entra ou sai desta lista, a página é atualizada. Mudanças relevantes são comunicadas conforme a seção 11 da Política.</P>

        <Grupo titulo="Infraestrutura" subs={INFRA} />
        <Grupo titulo="Operação do serviço" subs={OPERACAO} />
        <Grupo titulo="Medição e diagnóstico" subs={MEDICAO} />

        <div style={{ marginTop: 40, padding: '18px 20px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 12 }}>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0 }}>
            As lojas e os vendedores que anunciam no Marketplace <strong style={{ color: '#f0f0f0' }}>não são subprocessadores</strong>. Ao receberem seu nome e endereço para despachar um pedido, passam a responder por esses dados de forma independente, para cumprir a entrega e as obrigações fiscais deles.
          </p>
        </div>

        <P style={{ marginTop: 32 }}>Dúvidas sobre esta lista: <strong>privacidade@bynx.gg</strong>.</P>
      </div>

      <PublicFooter />
    </div>
  )
}

function Grupo({ titulo, subs }: { titulo: string; subs: Sub[] }) {
  return (
    <div style={{ marginTop: 36 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {titulo}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {subs.map((s) => (
          <div key={s.nome} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 6 }}>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{s.nome}</p>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.local}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.62)', margin: '0 0 3px' }}>{s.papel}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', margin: 0 }}>{s.dados}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75, marginBottom: 14, ...style }}>{children}</p>
}
