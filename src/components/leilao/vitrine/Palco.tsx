import Image from 'next/image'
import Link from 'next/link'
import SeloVerificado from '@/components/ui/SeloVerificado'
import { IconClock } from '@/components/ui/Icons'
import { Preco, Rotulo } from '@/components/leilao/kit'
import { formatarBRL, type LotePublico } from '@/lib/leilao'
import { separarLotesRodada, tituloRodada, type RodadaPublica } from '@/lib/leilao-rodada'
import { urlHome, urlRodada } from '@/lib/leilao-urls'
import { quandoRodada } from '@/lib/leilao-vitrine'
import { rotuloGraduacao } from '@/components/leilao/cardDoLote'
import type { LojaDoLote, ResumoRodada } from '@/app/leiloes/_dados'
import AnelVitrine from './AnelVitrine'
import BotaoAgenda from './BotaoAgenda'
import ComecaEm from './ComecaEm'
import LogoLoja from './LogoLoja'
import BotaoAvisoLeilao from './BotaoAvisoLeilao'

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
    <article className="vt-dest" aria-label={`Rodada ${rodada.numero} ao vivo`}>
      <span className="vt-dest-t">
        <Rotulo>{ativo ? `Lote ${posDe(ativo)} de ${visiveis.length}` : `Rodada ${rodada.numero}`}</Rotulo>
        {ativo && <AnelVitrine terminaEm={ativo.terminaEm} duracaoSeg={ativo.duracaoSeg} renderizadoEm={renderizadoEm} />}
      </span>
      <span className="vt-dest-art">
        {foto && <Image src={foto} alt={ativo ? ativo.cardName : ''} width={384} height={536} priority sizes="(min-width: 769px) 300px, 200px" />}
      </span>
      {ativo ? (
        <>
          <span className="vt-dest-nome">
            <strong>{ativo.cardName}{ativo.cardNumero ? ` ${ativo.cardNumero}` : ''}</strong>
            {detalhes && <small>{detalhes}</small>}
          </span>
          <Preco medio rotulo={ativo.nLances > 0 ? 'Lance atual' : 'Lance inicial'} valor={formatarBRL(precoDoLote(ativo))} />
        </>
      ) : (
        <p className="vt-fraco" style={{ margin: 0, fontSize: 14 }}>Próximo lote em instantes.</p>
      )}
      <Link href={url} prefetch={false} className="lk-btn lk-btn-prim lk-btn-cheio">Entrar na rodada</Link>
      <LinhaLoja loja={loja} sub={partes.join(' · ')} fallback={tituloRodada(rodada)} />
      {proximos.length > 0 && (
        <div className="vt-fila">
          <Rotulo fraco>Na fila</Rotulo>
          <div className="vt-minis" aria-label="Próximos lotes">
            {proximos.slice(0, 5).map(l => (
              <div key={l.id} className="vt-mini" title={l.cardName}>
                {l.cardImage && <Image src={l.cardImage} alt="" width={46} height={64} sizes="46px" />}
                <span>{posDe(l)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
    <article className="vt-dest" style={{ maxWidth: 440 }} aria-label={`Próxima rodada: ${rodada.numero}`}>
      <span className="vt-dest-t">
        <Rotulo>Próxima rodada</Rotulo>
        <span className="lk-selo lk-selo-tempo lk-t-acento"><IconClock size={13} /><ComecaEm iniciaEm={rodada.iniciaEm} renderizadoEm={renderizadoEm} maiuscula /></span>
      </span>
      <span className="vt-dest-art">
        {imagens[0] && <Image src={imagens[0]} alt="" width={384} height={536} priority sizes="(min-width: 769px) 300px, 200px" />}
      </span>
      <span className="vt-dest-nome">
        <strong>{quandoRodada(rodada.iniciaEm, Date.parse(renderizadoEm))}</strong>
      </span>
      <LinhaLoja loja={loja} sub={partes.join(' · ')} fallback={tituloRodada(rodada)} />
      {imagens.length > 1 && (
        <div className="vt-minis" aria-hidden>
          {imagens.slice(1).map((src, i) => (
            <div key={src + i} className="vt-mini">
              <Image src={src} alt="" width={46} height={64} sizes="46px" />
            </div>
          ))}
        </div>
      )}
      <Link href={urlRodada(rodada.numero)} prefetch={false} className="lk-btn lk-btn-prim lk-btn-cheio">Ver a rodada</Link>
      {rodada.iniciaEm && (
        <BotaoAgenda numero={rodada.numero} titulo={titulo} iniciaEm={rodada.iniciaEm} descricao={rodada.descricao} variante="caixa" />
      )}
    </article>
  )
}

const EXEMPLOS = ['base1/4', 'swsh7/215', 'sv3pt5/151'].map(c => `https://images.pokemontcg.io/${c}.png`)

/** Nada no ar e nada agendado. */
export function HeroSemRodada() {
  return (
    <section className="vt-dest" aria-labelledby="vt-heroi-t">
      <span className="vt-dest-t">
        <Rotulo fraco><span id="vt-heroi-t">Nenhum leilão aberto agora</span></Rotulo>
      </span>
      <div className="vt-leque" data-nosnippet>
        {EXEMPLOS.map(src => <Image key={src} src={src} alt="" width={256} height={357} sizes="(min-width: 769px) 140px, 96px" priority />)}
      </div>
      <span className="vt-exemplo" data-nosnippet>Exemplos, não estão à venda</span>
      <BotaoAvisoLeilao className="lk-btn lk-btn-prim lk-btn-cheio" />
      <Link href={urlHome('agenda')} prefetch={false} className="lk-btn lk-btn-sec lk-btn-cheio">Ver a agenda</Link>
      <Link href="/marketplace" prefetch={false} className="lk-btn lk-btn-leve lk-btn-cheio">Ver cartas com preço fixo</Link>
    </section>
  )
}
