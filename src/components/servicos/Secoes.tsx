// Secoes compartilhadas pelas paginas de servico. Server components: o HTML
// sai pronto do servidor (o Google le tudo) e so o slider, o video, a galeria
// e o CTA fixo hidratam.

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

export function agendarHref(servico: ServicoId) {
  const p = servico === 'pre_grading' ? 'pre-grading' : servico
  return `/restauracao-de-cartas/agendar?servico=${p}`
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
}

export function ResolveNaoResolve() {
  return (
    <section className="sv-sec" id="o-que-resolve">
      <div className="sv-stack">
        <div className="sv-card sv-card-ok">
          <h2 className="sv-tag sv-tag-ok"><IconCheck size={14} strokeWidth={2.2} /> O que a restauração resolve</h2>
          <ul className="sv-list">
            {RESOLVE.map(i => (
              <li key={i.t} className="sv-li"><span className="sv-ic sv-ic-ok"><IconCheck size={16} strokeWidth={2} /></span><div><b>{i.t}</b><span>{i.d}</span></div></li>
            ))}
          </ul>
        </div>
        <div className="sv-card">
          <p className="sv-tag sv-tag-mid"><IconMinus size={14} strokeWidth={2.2} /> O que ela atenua</p>
          <ul className="sv-list">
            {ATENUA.map(i => (
              <li key={i.t} className="sv-li"><span className="sv-ic sv-ic-mid"><IconMinus size={16} strokeWidth={2} /></span><div><b>{i.t}</b><span>{i.d}</span></div></li>
            ))}
          </ul>
        </div>
        <div className="sv-card sv-card-bad">
          <h2 className="sv-tag sv-tag-bad"><IconClose size={14} strokeWidth={2.2} /> O que ela não resolve</h2>
          <ul className="sv-list">
            {NAO_RESOLVE.map(i => (
              <li key={i.t} className="sv-li"><span className="sv-ic sv-ic-bad"><IconClose size={16} strokeWidth={2} /></span><div><b>{i.t}</b><span>{i.d}</span></div></li>
            ))}
          </ul>
        </div>
      </div>
      <p className="sv-regra">
        <b>Não repinto, não colo, não corto.</b> Qualquer uma dessas coisas torna a carta ingraduável. Se a sua carta precisa disso, o orçamento diz não.
      </p>
    </section>
  )
}

const CUSTODIA_ICONES = [IconCamera, IconEye, IconHistory, IconTruck]

export function Custodia() {
  return (
    <section className="sv-sec" id="custodia">
      <div className="sv-risk">
        <p className="sv-kicker">Como a sua carta viaja e volta</p>
        <h2 className="sv-h2">Sua carta tem número, registro e testemunha.</h2>
        <ul className="sv-list" style={{ marginTop: 16 }}>
          {CUSTODIA.map((c, i) => {
            const Ic = CUSTODIA_ICONES[i] || IconShield
            const d = i === 3 && PRECOS ? `${c.d} Seguro de ${PRECOS.seguroPct}% sobre o valor declarado.` : c.d
            return (
              <li key={c.t} className="sv-li"><span className="sv-ic sv-ic-ok"><Ic size={17} /></span><div><b>{c.t}</b><span>{d}</span></div></li>
            )
          })}
        </ul>
        {LINKS.videoAbertura && (
          <video className="sv-clip" src={LINKS.videoAbertura} poster={LINKS.videoAberturaPoster || undefined} muted playsInline controls preload="none" />
        )}
      </div>
    </section>
  )
}

export function ComoFunciona() {
  return (
    <section className="sv-sec" id="como-funciona">
      <h2 className="sv-h2">Como funciona</h2>
      <p className="sv-p">Cinco passos, e você só envia a carta depois de aprovar o preço.</p>
      <ol className="sv-tl">
        {PASSOS.map((p, i) => (
          <li key={p.t}><span className="sv-tl-n">{i + 1}</span><div><b>{p.t}</b><span>{p.d}</span></div></li>
        ))}
      </ol>
    </section>
  )
}

export function NaoRegistrado() {
  if (!CASO_RECUSADO) return null
  return (
    <section className="sv-sec">
      <h2 className="sv-h2">Às vezes a resposta é não.</h2>
      <p className="sv-p">Recusar uma carta faz parte do trabalho. Este é um caso real.</p>
      <div className="sv-card">
        <dl className="sv-dl">
          <div><dt>Carta</dt><dd>{CASO_RECUSADO.carta}</dd></div>
          <div><dt>Motivo</dt><dd>{CASO_RECUSADO.motivo}</dd></div>
          <div><dt>Resultado</dt><dd>{CASO_RECUSADO.resultado}</dd></div>
        </dl>
      </div>
    </section>
  )
}

/** Nao renderiza enquanto PRECOS for null: nada de "consulte". */
export function Precos({ destaque }: { destaque: ServicoId }) {
  if (!PRECOS) return null
  const prazo = PRAZOS.padraoDiasUteis ? `${PRAZOS.padraoDiasUteis} dias úteis após a chegada · ` : ''
  return (
    <section className="sv-sec" id="preco">
      <h2 className="sv-h2">Preço e prazo</h2>
      <p className="sv-p">Valor por carta. O orçamento pelas fotos é grátis.</p>
      <div className="sv-plans">
        {SERVICOS.map(s => {
          const v = precoDoServico(s.id)!
          const seguro = s.id !== 'pre_grading' ? ` + ${PRECOS!.seguroPct}% de seguro` : ''
          return (
            <div key={s.id} className={`sv-plan${s.id === destaque ? ' sv-plan-dest' : ''}`}>
              {s.id === 'completo' && <span className="sv-ribbon">Mais completo</span>}
              <div>
                <span className="sv-plan-nome">{s.nome}</span>
                <span className="sv-plan-d">{prazo}frete de ida e volta por sua conta</span>
              </div>
              <div className="sv-plan-r"><b>R$ {brl(v)}</b><small>por carta{seguro}</small></div>
            </div>
          )
        })}
      </div>
      <div className="sv-pills">
        <span className="sv-pill">{PRECOS.desc10a20}% de desconto de 10 a 20 cartas</span>
        <span className="sv-pill">{PRECOS.descAcima20}% acima de 20 cartas</span>
      </div>
    </section>
  )
}

export function QuemFaz({ foto }: { foto?: string | null }) {
  return (
    <section className="sv-sec" id="quem-faz">
      <h2 className="sv-h2">Quem faz</h2>
      {foto && (
        <div className="sv-quem-foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="Bancada de restauração da Bynx" style={{ width: '100%', height: '100%' }} loading="lazy" />
        </div>
      )}
      <div className="sv-quem">
        <p className="sv-p" style={{ margin: 0 }}>
          Quem restaura é o Du, fundador da Bynx{CIDADE ? `, em ${CIDADE}` : ''}. Comecei tratando as minhas próprias cartas, e cada uma que chega passa pela mesma bancada, pelas mesmas mãos. Atendo o Brasil todo pelo correio.
        </p>
        <div className="sv-redes">
          <a className="sv-ghost" href={LINKS.instagram} target="_blank" rel="noopener"><IconInstagram size={18} /> Instagram</a>
          {LINKS.youtube && <a className="sv-ghost" href={LINKS.youtube} target="_blank" rel="noopener"><IconYouTube size={18} /> YouTube</a>}
        </div>
      </div>
    </section>
  )
}

export function VideoProcesso() {
  if (!LINKS.videoProcessoId) return null
  return (
    <section className="sv-sec">
      <h2 className="sv-h2">Veja o processo inteiro</h2>
      <p className="sv-p">Da carta chegando à carta voltando, sem corte de bancada.</p>
      <VideoLazy videoId={LINKS.videoProcessoId} titulo="Restauração de carta Pokémon, do começo ao fim" duracao={LINKS.videoProcessoDuracao} />
      <a className="sv-link" href={LINKS.instagram} target="_blank" rel="noopener">Mais casos no Instagram <IconArrowRight size={15} /></a>
    </section>
  )
}

export function FaqServico({ itens }: { itens: Faq[] }) {
  return (
    <section className="sv-sec" id="perguntas">
      <h2 className="sv-h2">Perguntas frequentes</h2>
      <div className="sv-faq">
        {itens.map(f => (
          <details key={f.q}>
            <summary>{f.q}<IconChevronDown size={18} /></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function CtaFinal({ servico, outro }: { servico: ServicoId; outro: { href: string; texto: string } }) {
  return (
    <section className="sv-final">
      <h2 className="sv-h2">Mande as fotos. O orçamento é grátis.</h2>
      <p className="sv-p">Você só envia a carta depois de aprovar o preço.</p>
      <a className="sv-cta" href={agendarHref(servico)}>Pedir orçamento pelas fotos</a>
      <Link className="sv-link" href={outro.href} style={{ marginTop: 8 }}>{outro.texto} <IconArrowRight size={15} /></Link>
    </section>
  )
}
