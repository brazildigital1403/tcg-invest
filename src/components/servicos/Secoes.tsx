// Secoes compartilhadas pelas landings de servico, no molde das paginas
// institucionais da Bynx (/pokedex-pokemon-tcg): cada secao e uma faixa de
// largura total com conteudo ate 1160px e cabecalho centralizado.
// Server components: o HTML sai pronto do servidor (o Google le tudo) e so o
// slider, o video, a galeria e o CTA fixo hidratam.

import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  IconCheck, IconClose, IconMinus, IconChevronDown, IconShield, IconEye, IconCamera, IconHistory,
  IconTruck, IconInstagram, IconYouTube, IconArrowRight,
} from '@/components/ui/Icons'
import {
  RESOLVE, ATENUA, NAO_RESOLVE, PASSOS, CUSTODIA, PRECOS, PRAZOS, CIDADE, LINKS, SERVICOS,
  CASO_RECUSADO, precoDoServico, brl, type Faq, type ServicoId,
} from '@/lib/servicos'
import VideoLazy from './VideoLazy'
import { DiagramaDefeito, DEFEITO_POR_TITULO, IlustracaoBancada, IlustracaoCustodia } from './Mockups'

export function agendarHref(servico: ServicoId) {
  const p = servico === 'pre_grading' ? 'pre-grading' : servico
  return `/restauracao-de-cartas/agendar?servico=${p}`
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

/** Faixa de largura total. `alt` alterna o fundo, como as secoes da Pokedex. */
export function Faixa({ id, alt, children }: { id?: string; alt?: boolean; children: ReactNode }) {
  return (
    <section id={id} className={alt ? 'sv-band-alt' : 'sv-band'}>
      <div className="bx-gutter sv-container">{children}</div>
    </section>
  )
}

export function Cabecalho({ eyebrow, titulo, sub }: { eyebrow: string; titulo: string; sub?: string }) {
  return (
    <div className="sv-head">
      <span className="sv-eyebrow">{eyebrow}</span>
      <h2 className="sv-h2">{titulo}</h2>
      {sub && <p className="sv-p">{sub}</p>}
    </div>
  )
}

/** Faixa curta de garantias embaixo dos CTAs do hero. */
export function Garantias({ itens }: { itens: string[] }) {
  return (
    <div className="sv-trust">
      {itens.map(t => <span key={t}><IconCheck size={14} strokeWidth={2.4} /> {t}</span>)}
    </div>
  )
}

export function ResolveNaoResolve() {
  return (
    <Faixa id="o-que-resolve" alt>
      <Cabecalho
        eyebrow="Transparência técnica"
        titulo="O que a restauração resolve, e o que ela não resolve"
        sub="Antes de você enviar qualquer carta, fica claro o que dá para tratar. Ouvir um não pelas fotos é melhor que descobrir depois."
      />
      <div className="sv-g3">
        <div className="sv-card sv-card-ok">
          <h3 className="sv-tag sv-tag-ok"><IconCheck size={14} strokeWidth={2.2} /> Resolve</h3>
          <ul className="sv-list">
            {RESOLVE.map(i => (
              <li key={i.t} className="sv-li"><DiagramaDefeito tipo={DEFEITO_POR_TITULO[i.t]} /><div><b>{i.t}</b><span>{i.d}</span></div></li>
            ))}
          </ul>
        </div>
        <div className="sv-card">
          <h3 className="sv-tag sv-tag-mid"><IconMinus size={14} strokeWidth={2.2} /> Atenua</h3>
          <ul className="sv-list">
            {ATENUA.map(i => (
              <li key={i.t} className="sv-li"><DiagramaDefeito tipo={DEFEITO_POR_TITULO[i.t]} /><div><b>{i.t}</b><span>{i.d}</span></div></li>
            ))}
          </ul>
        </div>
        <div className="sv-card sv-card-bad">
          <h3 className="sv-tag sv-tag-bad"><IconClose size={14} strokeWidth={2.2} /> Não resolve</h3>
          <ul className="sv-list">
            {NAO_RESOLVE.map(i => (
              <li key={i.t} className="sv-li"><DiagramaDefeito tipo={DEFEITO_POR_TITULO[i.t]} /><div><b>{i.t}</b><span>{i.d}</span></div></li>
            ))}
          </ul>
        </div>
      </div>
      <p className="sv-regra">
        <b>A Bynx não usa tinta, cola nem corte.</b> Qualquer uma dessas intervenções torna a carta ingraduável. Se a sua carta precisa disso, o orçamento diz não.
      </p>
    </Faixa>
  )
}

const CUSTODIA_ICONES = [IconCamera, IconEye, IconHistory, IconTruck]

export function Custodia({ alt }: { alt?: boolean }) {
  return (
    <Faixa id="custodia" alt={alt}>
      <Cabecalho
        eyebrow="Como a sua carta viaja e volta"
        titulo="Sua carta tem número, registro e testemunha."
        sub="Mandar uma carta de valor pelo correio exige confiança. Por isso cada etapa deixa prova, e a prova fica na sua conta."
      />
      <div className="sv-g4">
        {CUSTODIA.map((c, i) => {
          const Ic = CUSTODIA_ICONES[i] || IconShield
          const d = i === 3 && PRECOS ? `${c.d} Seguro de ${PRECOS.seguroPct}% sobre o valor declarado.` : c.d
          return (
            <div key={c.t} className="sv-card sv-card-hover sv-feat">
              <span className="sv-ic sv-ic-lg sv-ic-ok"><Ic size={20} /></span>
              <b>{c.t}</b>
              <span>{d}</span>
            </div>
          )
        })}
      </div>
      <div className="sv-custodia-midia">
        {LINKS.videoAbertura
          ? <video className="sv-clip" src={LINKS.videoAbertura} poster={LINKS.videoAberturaPoster || undefined} muted playsInline controls preload="none" />
          : <IlustracaoCustodia />}
      </div>
    </Faixa>
  )
}

export function ComoFunciona({ alt }: { alt?: boolean }) {
  return (
    <Faixa id="como-funciona" alt={alt}>
      <Cabecalho eyebrow="Passo a passo" titulo="Como funciona" sub="Cinco passos, e você só envia a carta depois de aprovar o preço." />
      <ol className="sv-tl">
        {PASSOS.map((p, i) => (
          <li key={p.t}><span className="sv-tl-n">{i + 1}</span><div><b>{p.t}</b><span>{p.d}</span></div></li>
        ))}
      </ol>
    </Faixa>
  )
}

export function NaoRegistrado({ alt }: { alt?: boolean }) {
  if (!CASO_RECUSADO) return null
  return (
    <Faixa alt={alt}>
      <Cabecalho eyebrow="Critério" titulo="Às vezes a resposta é não." sub="Recusar uma carta faz parte do trabalho. Este é um caso real." />
      <div className="sv-narrow sv-card">
        <dl className="sv-dl">
          <div><dt>Carta</dt><dd>{CASO_RECUSADO.carta}</dd></div>
          <div><dt>Motivo</dt><dd>{CASO_RECUSADO.motivo}</dd></div>
          <div><dt>Resultado</dt><dd>{CASO_RECUSADO.resultado}</dd></div>
        </dl>
      </div>
    </Faixa>
  )
}

/** Nao renderiza enquanto PRECOS for null: nada de "consulte". */
export function Precos({ destaque, alt }: { destaque: ServicoId; alt?: boolean }) {
  if (!PRECOS) return null
  const prazo = PRAZOS.padraoDiasUteis ? `${PRAZOS.padraoDiasUteis} dias úteis após a chegada. ` : ''
  return (
    <Faixa id="preco" alt={alt}>
      <Cabecalho eyebrow="Investimento e prazo" titulo="Preço por carta" sub="O orçamento pelas fotos é grátis. Frete de ida e volta por sua conta." />
      <div className="sv-g3">
        {SERVICOS.map(s => {
          const v = precoDoServico(s.id)!
          const seguro = s.id !== 'pre_grading' ? ` + ${PRECOS!.seguroPct}% de seguro` : ''
          return (
            <div key={s.id} className={`sv-plan${s.id === destaque ? ' sv-plan-dest' : ''}`}>
              {s.id === 'completo' && <span className="sv-ribbon">Mais completo</span>}
              <span className="sv-plan-nome">{s.nome}</span>
              <span className="sv-plan-v">R$ {brl(v)} <small>por carta{seguro}</small></span>
              <span className="sv-plan-d">{prazo}{s.descricao}</span>
            </div>
          )
        })}
      </div>
      <div className="sv-pills">
        <span className="sv-pill">{PRECOS.desc10a20}% de desconto de 10 a 20 cartas</span>
        <span className="sv-pill">{PRECOS.descAcima20}% acima de 20 cartas</span>
      </div>
    </Faixa>
  )
}

export function QuemFaz({ foto, alt }: { foto?: string | null; alt?: boolean }) {
  return (
    <Faixa id="quem-faz" alt={alt}>
      <div className="sv-g2">
        <div className="sv-quem-foto">
          {foto
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={foto} alt="Bancada de restauração da Bynx" loading="lazy" />
            : <IlustracaoBancada />}
        </div>
        <div>
          <span className="sv-eyebrow">Quem faz</span>
          <h2 className="sv-h2" style={{ margin: '12px 0 16px' }}>Uma bancada, as mesmas mãos em toda carta.</h2>
          <p className="sv-p">
            Quem restaura hoje é o Edu, fundador da Bynx{CIDADE ? `, em ${CIDADE}` : ''}. Começou tratando as próprias cartas, e cada uma que chega passa pela mesma bancada, com o mesmo cuidado. Atendemos o Brasil todo pelo correio.
          </p>
          <div className="sv-redes">
            <a className="sv-ghost" href={LINKS.instagram} target="_blank" rel="noopener"><IconInstagram size={18} /> Instagram</a>
            {LINKS.youtube && <a className="sv-ghost" href={LINKS.youtube} target="_blank" rel="noopener"><IconYouTube size={18} /> YouTube</a>}
          </div>
        </div>
      </div>
    </Faixa>
  )
}

export function VideoProcesso({ alt }: { alt?: boolean }) {
  if (!LINKS.videoProcessoId) return null
  return (
    <Faixa alt={alt}>
      <Cabecalho eyebrow="Na bancada" titulo="Veja o processo inteiro" sub="Da carta chegando à carta voltando, sem corte de bancada." />
      <div className="sv-narrow">
        <VideoLazy videoId={LINKS.videoProcessoId} titulo="Restauração de carta Pokémon, do começo ao fim" duracao={LINKS.videoProcessoDuracao} />
        <p style={{ textAlign: 'center', margin: '12px 0 0' }}>
          <a className="sv-link" href={LINKS.instagram} target="_blank" rel="noopener">Mais casos no Instagram <IconArrowRight size={15} /></a>
        </p>
      </div>
    </Faixa>
  )
}

export function FaqServico({ itens, alt }: { itens: Faq[]; alt?: boolean }) {
  return (
    <Faixa id="perguntas" alt={alt}>
      <Cabecalho eyebrow="Dúvidas" titulo="Perguntas frequentes" />
      <div className="sv-narrow sv-faq">
        {itens.map(f => (
          <details key={f.q} name="bynx-sv-faq">
            <summary>{f.q}<IconChevronDown size={18} /></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </Faixa>
  )
}

export function CtaFinal({ servico, outro }: { servico: ServicoId; outro: { href: string; texto: string } }) {
  return (
    <section className="sv-final">
      <div className="bx-gutter sv-container">
        <div className="sv-final-in">
          <h2 className="sv-h2">Mande as fotos. O orçamento é grátis.</h2>
          <p className="sv-p">Você só envia a carta depois de aprovar o preço, e acompanha cada etapa pela sua conta.</p>
          <div className="sv-ctas">
            <a className="sv-cta" href={agendarHref(servico)}>Pedir orçamento pelas fotos <IconArrowRight size={18} strokeWidth={2.2} /></a>
            <Link className="sv-ghost" href={outro.href}>{outro.texto}</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
