import Image from 'next/image'
import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconCheck, IconChevronDown, IconChevronRight, IconWarning } from '@/components/ui/Icons'

/**
 * Pecas do kit visual do Bynx Leiloes (CSS em ./estilos). Sem hook: valem em
 * componente de servidor e de cliente. Estado sempre com icone, texto e cor.
 */

export type Tom = 'vivo' | 'frente' | 'atencao' | 'perigo' | 'acento' | 'neutro'

export function Rotulo({ children, fraco = false }: { children: ReactNode; fraco?: boolean }) {
  return <span className={fraco ? 'lk-rotulo lk-rotulo-f' : 'lk-rotulo'}>{children}</span>
}

/** Titulo da tela: rotulo curto, frase grande, no maximo uma linha de apoio. */
export function Titulo({
  rotulo, titulo, texto, selo, acao, nivel = 1,
}: {
  rotulo?: ReactNode; titulo: ReactNode; texto?: ReactNode; selo?: ReactNode; acao?: ReactNode; nivel?: 1 | 2
}) {
  return (
    <header className="lk-tit">
      {selo}
      {rotulo && <Rotulo>{rotulo}</Rotulo>}
      <div className="lk-tit-l">
        {nivel === 1 ? <h1>{titulo}</h1> : <h2 className="lk-tit-t">{titulo}</h2>}
        {acao}
      </div>
      {texto && <p>{texto}</p>}
    </header>
  )
}

export function Selo({ tom = 'neutro', icone, tempo = false, children }: { tom?: Tom; icone?: ReactNode; tempo?: boolean; children: ReactNode }) {
  const padrao = tom === 'vivo' ? <i className="lk-ponto" />
    : tom === 'frente' ? <IconCheck size={13} strokeWidth={2.4} />
    : tom === 'atencao' || tom === 'perigo' ? <IconWarning size={13} strokeWidth={2} />
    : null
  return <span className={`lk-selo lk-t-${tom}${tempo ? ' lk-selo-tempo' : ''}`}>{icone ?? padrao}{children}</span>
}

export function IconeBloco({ tom = 'acento', tamanho = 'g', children }: { tom?: Tom; tamanho?: 'g' | 'm'; children: ReactNode }) {
  return <span className={`lk-bloco lk-bloco-${tamanho} lk-t-${tom}`} aria-hidden>{children}</span>
}

export function Preco({ rotulo, valor, meta, medio = false }: { rotulo: string; valor: string; meta?: ReactNode; medio?: boolean }) {
  return (
    <div className={medio ? 'lk-preco lk-preco-m' : 'lk-preco'}>
      <small>{rotulo}</small>
      <strong>{valor}</strong>
      {meta && <span>{meta}</span>}
    </div>
  )
}

export function Resumos({ children }: { children: ReactNode }) {
  return <div className="lk-resumos">{children}</div>
}

export function Resumo({ rotulo, valor, meta, tom }: { rotulo: string; valor: string; meta?: string; tom?: Tom }) {
  return (
    <div className={`lk-resumo${tom ? ` lk-t-${tom}` : ''}`}>
      <small>{rotulo}</small>
      <b>{valor}</b>
      {meta && <span>{meta}</span>}
    </div>
  )
}

export interface Etapa { titulo: string; meta?: string; estado?: 'feito' | 'atual' | 'futuro' }

/** Horizontal no assistente; vertical na linha do tempo de pagamento e envio. */
export function Etapas({ itens, direcao = 'v' }: { itens: Etapa[]; direcao?: 'h' | 'v' }) {
  return (
    <ol className={`lk-etapas lk-etapas-${direcao}`}>
      {itens.map((e, i) => (
        <li key={e.titulo} className={e.estado === 'feito' ? 'lk-feito' : e.estado === 'atual' ? 'lk-atual' : undefined} aria-current={e.estado === 'atual' ? 'step' : undefined}>
          <i className="lk-num">{e.estado === 'feito' ? <IconCheck size={14} strokeWidth={2.4} /> : i + 1}</i>
          <span>{e.titulo}</span>
          {e.meta && <small>{e.meta}</small>}
        </li>
      ))}
    </ol>
  )
}

type BotaoProps = {
  tipo?: 'prim' | 'sec' | 'perigo' | 'leve'; cheio?: boolean; href?: string; children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>

export function Botao({ tipo = 'prim', cheio = false, href, children, className, ...resto }: BotaoProps) {
  const cls = `lk-btn lk-btn-${tipo}${cheio ? ' lk-btn-cheio' : ''}${className ? ` ${className}` : ''}`
  if (href) return <Link href={href} prefetch={false} className={cls}>{children}</Link>
  return <button type="button" className={cls} {...resto}>{children}</button>
}

export function Acoes({ children, linha = false }: { children: ReactNode; linha?: boolean }) {
  return <div className={linha ? 'lk-acoes lk-acoes-l' : 'lk-acoes'}>{children}</div>
}

/** Bloco da decisao: tempo, preco e o botao principal na mesma olhada. */
export function CartaoDecisao({
  rotulo, tempo, preco, acoes,
}: { rotulo: ReactNode; tempo: ReactNode; preco: ReactNode; acoes: ReactNode }) {
  return (
    <section className="lk-card lk-card-d">
      <div className="lk-card-t"><Rotulo>{rotulo}</Rotulo>{tempo}</div>
      {preco}
      {acoes}
    </section>
  )
}

/** "Sua vez": a uma olhada, o que a pessoa precisa fazer agora. */
export function ProximaAcao({
  rotulo = 'Próxima ação', icone, tom = 'acento', titulo, texto, acao,
}: { rotulo?: string; icone: ReactNode; tom?: Tom; titulo: ReactNode; texto?: ReactNode; acao: ReactNode }) {
  return (
    <section className={`lk-card lk-card-d lk-t-${tom}`} style={{ borderColor: 'color-mix(in srgb, var(--lk-c) 42%, transparent)' }}>
      <IconeBloco tom={tom} tamanho="m">{icone}</IconeBloco>
      <div className="lk-tit" style={{ gap: 4 }}>
        <span className="lk-rotulo" style={{ color: 'var(--lk-c)' }}>{rotulo}</span>
        <b style={{ fontSize: 18, lineHeight: 1.25, fontWeight: 800, color: 'var(--bx-text)' }}>{titulo}</b>
        {texto && <p style={{ fontSize: 14 }}>{texto}</p>}
      </div>
      {acao}
    </section>
  )
}

/** Momento de resultado: icone grande, selo, frase curta e uma acao principal. */
export function TelaEstado({
  icone, tom = 'acento', selo, titulo, texto, children, acoes,
}: { icone: ReactNode; tom?: Tom; selo?: ReactNode; titulo: ReactNode; texto?: ReactNode; children?: ReactNode; acoes?: ReactNode }) {
  return (
    <section className="lk-estado" role="status">
      <IconeBloco tom={tom}>{icone}</IconeBloco>
      {selo}
      <h2>{titulo}</h2>
      {texto && <p>{texto}</p>}
      {(children || acoes) && <div className="lk-estado-c">{children}{acoes}</div>}
    </section>
  )
}

export function MiniCarta({ src }: { src: string }) {
  return <Image src={src} alt="" width={88} height={123} sizes="44px" className="lk-mini" />
}

export function Linhas({ children }: { children: ReactNode }) {
  return <div className="lk-linhas">{children}</div>
}

/** Linha de lista: midia, titulo, uma meta, selo ou valor. Com href, a linha inteira e o link. */
export function Linha({
  midia, titulo, meta, selo, valor, href, seta = !!href,
}: { midia?: ReactNode; titulo: ReactNode; meta?: ReactNode; selo?: ReactNode; valor?: ReactNode; href?: string; seta?: boolean }) {
  const dentro = (
    <>
      {midia}
      <span className="lk-linha-c"><b>{titulo}</b>{meta && <small>{meta}</small>}</span>
      {selo}
      {valor && <span className="lk-linha-v">{valor}</span>}
      {seta && <span className="lk-linha-s"><IconChevronRight size={17} /></span>}
    </>
  )
  return href
    ? <Link href={href} prefetch={false} className="lk-linha">{dentro}</Link>
    : <div className="lk-linha">{dentro}</div>
}

export function Aviso({ tom = 'acento', icone, titulo, children }: { tom?: Tom; icone?: ReactNode; titulo?: ReactNode; children: ReactNode }) {
  return (
    <div className={`lk-aviso lk-t-${tom}`}>
      {icone ?? <IconWarning size={17} />}
      <div>{titulo && <b>{titulo}</b>}{children}</div>
    </div>
  )
}

export function Recolhido({ titulo, children, aberto = false }: { titulo: ReactNode; children: ReactNode; aberto?: boolean }) {
  return (
    <details className="lk-rec" open={aberto}>
      <summary>{titulo}<IconChevronDown size={16} /></summary>
      <div className="lk-rec-c">{children}</div>
    </details>
  )
}

export function Esqueleto({ altura = 64 }: { altura?: number }) {
  return <span className="lk-esq" style={{ height: altura }} aria-hidden />
}
