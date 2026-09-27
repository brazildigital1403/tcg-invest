import Image from 'next/image'
import Link from 'next/link'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { IconClock } from '@/components/ui/Icons'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { separarLotesRodada, tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { urlRodada } from '@/lib/leilao-urls'
import { quandoRodada } from '@/lib/leilao-vitrine'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'
import type { LojaDoLote, ResumoRodada } from '@/app/leiloes/_dados'
import AnelVitrine from './AnelVitrine'
import BotaoAgenda from './BotaoAgenda'
import ComecaEm from './ComecaEm'
import LogoLoja from './LogoLoja'

function nomeDaLoja(loja: LojaDoLote | null): string | null {
  return loja ? loja.nome ?? loja.slug : null
}

/** Loja com selo + linha de apoio (rodada, titulo, participantes). */
function LinhaLoja({ loja, sub, fallback }: { loja: LojaDoLote | null; sub: string; fallback: string }) {
  const nome = nomeDaLoja(loja)
  return (
    <div className="vt-loja">
      <LogoLoja nome={nome ?? fallback} logoUrl={loja?.logoUrl ?? null} />
      <div style={{ minWidth: 0 }}>
        <span className="vt-loja-nome">{nome ?? fallback}</span>{' '}
        {loja?.verificada && (
          <span className="vt-verif">
            <SeloVerificado size={13} />
            Verificada
          </span>
        )}
        <div className="vt-loja-sub">{sub}</div>
      </div>
    </div>
  )
}

function precoDoLote(l: LotePublico): number {
  return l.nLances > 0 && l.precoAtualCents != null ? l.precoAtualCents : l.lanceInicialCents
}

/**
 * Palco da rodada NO AR: carta grande do lote no ar, loja, preco, anel,
 * "Lote N de M", fila em miniatura e o CTA. Participantes = `n_participantes`
 * do lote no ar (o banco conta por lote, nao por rodada: o rotulo diz isso).
 */
export function PalcoAoVivo({
  rodada,
  loja,
  lotes,
  renderizadoEm,
}: {
  rodada: RodadaPublica
  loja: LojaDoLote | null
  lotes: LotePublico[]
  renderizadoEm: string
}) {
  const { ativo, proximos } = separarLotesRodada(lotes)
  const visiveis = lotes.filter(l => l.status !== 'cancelado')
  const posDe = (l: LotePublico) => visiveis.findIndex(v => v.id === l.id) + 1
  const foto = ativo ? ativo.fotos[0] || ativo.cardImage : visiveis.find(l => l.cardImage)?.cardImage ?? null
  const url = urlRodada(rodada.numero)
  const partes = [`Rodada ${rodada.numero}`]
  if (rodada.titulo) partes.push(tituloRodada(rodada))
  if (ativo && ativo.nParticipantes > 0) {
    partes.push(ativo.nParticipantes === 1 ? '1 participante no lote' : `${ativo.nParticipantes} participantes no lote`)
  }
  const detalhes = ativo
    ? [ativo.setNome, ativo.condicao, rotuloGraduacao(ativo)].filter(Boolean).join(' · ')
    : ''

  return (
    <article className="vt-palco" aria-label={`Rodada ${rodada.numero} ao vivo`}>
      <div className="vt-carta">
        <span className="vt-carta-in">
        {foto ? (
          <Image
            src={foto}
            alt={ativo ? ativo.cardName : ''}
            width={245}
            height={342}
            priority
            sizes="(max-width: 768px) 170px, 240px"
            className="vt-carta-img"
          />
        ) : (
          <span className="vt-carta-vazia" aria-hidden />
        )}
        <span className="vt-selo-vivo">
          <span className="vt-ponto" aria-hidden />
          AO VIVO
        </span>
        </span>
      </div>
      <div className="vt-info">
        <LinhaLoja loja={loja} sub={partes.join(' · ')} fallback={tituloRodada(rodada)} />
        {ativo ? (
          <>
            <p className="vt-lote-nome">
              {ativo.cardName}
              {ativo.cardNumero ? ` ${ativo.cardNumero}` : ''}
              {detalhes && <span> · {detalhes}</span>}
            </p>
            <div className="vt-linha">
              <div>
                <p className="vt-rot">{ativo.nLances > 0 ? 'Lance atual' : 'Lance inicial'}</p>
                <div className="vt-preco vt-num">{formatarBRL(precoDoLote(ativo))}</div>
              </div>
              <AnelVitrine terminaEm={ativo.terminaEm} duracaoSeg={ativo.duracaoSeg} renderizadoEm={renderizadoEm} />
              <span className="vt-fraco vt-num" style={{ fontSize: 13 }}>
                Lote {posDe(ativo)} de {visiveis.length}
              </span>
            </div>
          </>
        ) : (
          <p className="vt-fraco" style={{ margin: 0, fontSize: 14 }}>Próximo lote em instantes.</p>
        )}
        {proximos.length > 0 && (
          <div className="vt-minis" aria-label="Próximos lotes">
            {proximos.slice(0, 5).map(l => (
              <div key={l.id} className="vt-mini" title={l.cardName}>
                {l.cardImage && <Image src={l.cardImage} alt="" width={46} height={64} sizes="46px" />}
                <span>{posDe(l)}</span>
              </div>
            ))}
          </div>
        )}
        <Link href={url} prefetch={false} className="vt-cta">Entrar na rodada ao vivo</Link>
      </div>
    </article>
  )
}

/** Sem rodada no ar: o palco mostra a PROXIMA agendada, com a contagem. */
export function PalcoProxima({
  rodada,
  loja,
  resumo,
  renderizadoEm,
}: {
  rodada: RodadaPublica
  loja: LojaDoLote | null
  resumo: ResumoRodada | null
  renderizadoEm: string
}) {
  const imagens = resumo?.imagens ?? []
  const partes = [`Rodada ${rodada.numero}`]
  if (rodada.titulo) partes.push(tituloRodada(rodada))
  if (resumo && resumo.n > 0) partes.push(resumo.n === 1 ? '1 lote' : `${resumo.n} lotes`)
  const titulo = `${nomeDaLoja(loja) ?? tituloRodada(rodada)}: rodada ao vivo no Bynx Leilões`
  return (
    <article className="vt-palco" aria-label={`Próxima rodada: ${rodada.numero}`}>
      <div className="vt-carta">
        <span className="vt-carta-in">
        {imagens[0] ? (
          <Image src={imagens[0]} alt="" width={245} height={342} priority sizes="(max-width: 768px) 170px, 240px" className="vt-carta-img" />
        ) : (
          <span className="vt-carta-vazia" aria-hidden />
        )}
        <span className="vt-selo-vivo vt-selo-breve">
          <IconClock size={12} />
          PRÓXIMA RODADA
        </span>
        </span>
      </div>
      <div className="vt-info">
        <LinhaLoja loja={loja} sub={partes.join(' · ')} fallback={tituloRodada(rodada)} />
        <div>
          <p className="vt-rot">{quandoRodada(rodada.iniciaEm, Date.parse(renderizadoEm))}</p>
          <div className="vt-preco" style={{ fontSize: 'clamp(24px, 6vw, 34px)' }}>
            <ComecaEm iniciaEm={rodada.iniciaEm} renderizadoEm={renderizadoEm} maiuscula />
          </div>
        </div>
        {imagens.length > 1 && (
          <div className="vt-minis" aria-hidden>
            {imagens.slice(1).map((src, i) => (
              <div key={src + i} className="vt-mini">
                <Image src={src} alt="" width={46} height={64} sizes="46px" />
              </div>
            ))}
          </div>
        )}
        <div className="vt-acoes">
          <Link href={urlRodada(rodada.numero)} prefetch={false} className="vt-cta">Ver a rodada</Link>
          {rodada.iniciaEm && (
            <BotaoAgenda numero={rodada.numero} titulo={titulo} iniciaEm={rodada.iniciaEm} descricao={rodada.descricao} variante="caixa" />
          )}
        </div>
      </div>
    </article>
  )
}

/** Nada no ar e nada agendado. */
export function HeroSemRodada() {
  return (
    <section className="vt-heroi" aria-labelledby="vt-heroi-t">
      <h2 id="vt-heroi-t">Nenhuma rodada no ar agora</h2>
      <p>
        Quando uma loja abrir ou agendar uma rodada ao vivo, ela aparece aqui com o horário. Enquanto isso, as cartas à
        venda com preço fixo estão no Mercado.
      </p>
      <div className="vt-acoes">
        <Link href="/marketplace" prefetch={false} className="vt-cta">Ver o Mercado</Link>
        <Link href="/para-lojistas" prefetch={false} className="vt-cta-sec">Sou lojista</Link>
      </div>
    </section>
  )
}
