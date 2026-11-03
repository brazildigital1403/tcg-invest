import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AbasChips from '@/components/leilao/kit/AbasChips'
import { CSS_KIT } from '@/components/leilao/kit/estilos'
import {
  Acoes, Aviso, Botao, CartaoDecisao, Esqueleto, Etapas, IconeBloco, Linha, Linhas, MiniCarta, Preco, ProximaAcao,
  Recolhido, Resumo, Resumos, Rotulo, Selo, TelaEstado, Titulo,
} from '@/components/leilao/kit'
import { IconBell, IconCheck, IconClock, IconLeilao, IconLoja, IconPlus, IconTruck, IconWarning } from '@/components/ui/Icons'

/** Vitrine do kit visual para aprovacao. So existe em desenvolvimento: em producao, 404. */
export const metadata: Metadata = { title: 'Kit visual do leilão', robots: { index: false, follow: false } }

const CARTA = (c: string) => `https://images.pokemontcg.io/${c}.png`
// So nesta pagina: o acento real da loja vem do layout de /minha-loja.
const LOJA = {
  '--ac-1': '#60a5fa', '--ac-2': '#a855f7', '--ac-1-rgb': '96, 165, 250', '--ac-2-rgb': '168, 85, 247',
  '--ac-grad': 'linear-gradient(135deg, #60a5fa, #a855f7)',
} as CSSProperties

function Sec({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section className="kt-sec">
      <h2 className="lk-sub">{t}</h2>
      {children}
    </section>
  )
}

export default function KitPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="kt">
      <style>{CSS_KIT + `
        .kt { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 40px; padding-bottom: 48px; }
        .kt-sec { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .kt-gr { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr)); align-items: start; }
        .kt-l { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      `}</style>

      <Titulo rotulo="Etapa 0" titulo="Kit visual do leilão" texto="As peças que todas as telas vão usar." />

      <Sec t="Títulos">
        <Titulo nivel={2} rotulo="Planeje sua disputa" titulo="Agenda de leilões" texto="Saiba quando a próxima carta abre." />
        <Titulo nivel={2} selo={<Selo tom="vivo">Ao vivo agora</Selo>} titulo="O próximo lote pode ser o seu." />
      </Sec>

      <Sec t="Selos de estado">
        <div className="kt-l">
          <Selo tom="vivo">Ao vivo</Selo>
          <Selo tom="frente">Na frente</Selo>
          <Selo tom="atencao">Superado</Selo>
          <Selo tom="acento" tempo icone={<IconClock size={13} />}>12h 14min</Selo>
          <Selo tom="perigo" tempo icone={<IconClock size={13} />}>08:41</Selo>
          <Selo tom="perigo">Envio atrasado</Selo>
          <Selo tom="neutro">Encerrado</Selo>
        </div>
      </Sec>

      <Sec t="Abas">
        <AbasChips
          rotulo="Exemplo de abas"
          ativa="resultados"
          itens={[
            { chave: 'abertos', rotulo: 'Abertos', href: '/leiloes/kit', n: 7 },
            { chave: 'agenda', rotulo: 'Agenda', href: '/leiloes/kit', n: 3 },
            { chave: 'resultados', rotulo: 'Resultados', href: '/leiloes/kit' },
            { chave: 'como', rotulo: 'Como funciona', href: '/leiloes/kit' },
          ]}
        />
      </Sec>

      <Sec t="Preço e números">
        <div className="kt-gr">
          <Preco rotulo="Lance atual" valor="R$ 480,00" meta="6 lances · próximo lance R$ 500,00" />
          <Resumos>
            <Resumo rotulo="Arrematados" valor="4 de 5" meta="1 sem lance" />
            <Resumo rotulo="Valor dos lotes" valor="R$ 1.482" />
            <Resumo rotulo="Pagos" valor="3 de 4" meta="1 aguardando" tom="atencao" />
            <Resumo rotulo="A postar" valor="2" meta="1 atrasado" tom="perigo" />
          </Resumos>
        </div>
      </Sec>

      <Sec t="Botões">
        <div className="kt-gr">
          <Acoes><Botao>Dar lance</Botao><Botao tipo="sec"><IconBell size={16} />Acompanhar</Botao><Botao tipo="leve">Ver todos</Botao></Acoes>
          <div style={LOJA}><Acoes><Botao><IconPlus size={16} />Colocar carta em leilão</Botao><Botao tipo="sec">Ver prévia</Botao><Botao tipo="perigo">Cancelar rodada</Botao></Acoes></div>
          <div className="bx-ctx-comprador"><Acoes><Botao>Pagar R$ 549,00</Botao><Botao tipo="sec">Ver o pedido</Botao></Acoes></div>
        </div>
      </Sec>

      <Sec t="Decisão e próxima ação">
        <div className="kt-gr">
          <CartaoDecisao
            rotulo="Leilão aberto"
            tempo={<Selo tom="acento" tempo icone={<IconClock size={13} />}>12h 14min</Selo>}
            preco={<Preco rotulo="Lance atual" valor="R$ 480,00" meta="6 lances · próximo lance R$ 500,00" />}
            acoes={<Acoes><Botao cheio>Dar lance</Botao><Botao tipo="sec" cheio><IconBell size={16} />Acompanhar</Botao></Acoes>}
          />
          <div style={LOJA}>
            <ProximaAcao icone={<IconTruck size={22} />} titulo="Enviar Eevee 173/215" texto="Postar até 06/11" acao={<Botao cheio>Ver envio</Botao>} />
          </div>
          <div style={LOJA}>
            <ProximaAcao rotulo="Envio atrasado" tom="perigo" icone={<IconWarning size={22} />} titulo="Enviar Gengar VMAX" texto="O prazo era até 28/10" acao={<Botao cheio>Ver envio</Botao>} />
          </div>
        </div>
      </Sec>

      <Sec t="Momentos de resultado">
        <div className="kt-gr">
          <TelaEstado
            tom="frente" icone={<IconCheck size={38} strokeWidth={2} />} selo={<Selo tom="frente">Lance confirmado</Selo>}
            titulo="Você está na frente."
            acoes={<Acoes><Preco medio rotulo="Seu máximo" valor="R$ 480,00" /><Botao cheio>Continuar acompanhando</Botao></Acoes>}
          />
          <TelaEstado
            tom="atencao" icone={<IconWarning size={38} />} selo={<Selo tom="atencao">Você foi superado</Selo>}
            titulo="A disputa continua."
            acoes={<Acoes><Preco medio rotulo="Lance atual" valor="R$ 500,00" /><Botao cheio>Cobrir por R$ 520,00</Botao></Acoes>}
          />
          <TelaEstado
            tom="neutro" icone={<IconLeilao size={38} />} selo={<Selo tom="neutro">Lote encerrado</Selo>}
            titulo="Você não venceu." texto="Nada a pagar."
            acoes={<Botao tipo="sec" cheio>Ver outros leilões</Botao>}
          />
        </div>
      </Sec>

      <Sec t="Etapas">
        <div className="kt-gr">
          <div style={LOJA}>
            <Etapas direcao="h" itens={[{ titulo: 'Informações', estado: 'feito' }, { titulo: 'Lotes', estado: 'atual' }, { titulo: 'Prévia' }, { titulo: 'Publicar' }]} />
          </div>
          <div className="bx-ctx-comprador">
            <Etapas itens={[{ titulo: 'Pagar', estado: 'atual', meta: 'até 05/11 às 14:13' }, { titulo: 'Loja envia', meta: 'até 3 dias úteis' }, { titulo: 'Você recebe' }, { titulo: 'Reclamar ou desistir', meta: '7 dias' }]} />
          </div>
        </div>
      </Sec>

      <Sec t="Listas">
        <Linhas>
          <Linha href="/leiloes/kit" midia={<MiniCarta src={CARTA('swsh7/215')} />} titulo="Umbreon VMAX" meta="12h 14min · 6 lances" valor="R$ 480,00" />
          <Linha href="/leiloes/kit" midia={<MiniCarta src={CARTA('base1/4')} />} titulo="Charizard" meta="Esperando pagamento" selo={<Selo tom="atencao">A pagar</Selo>} />
          <Linha href="/leiloes/kit" midia={<IconeBloco tamanho="m"><IconLoja size={20} /></IconeBloco>} titulo="Rodada de novembro" meta="12 lotes · quinta, 21h" selo={<Selo tom="acento">Agendada</Selo>} />
        </Linhas>
      </Sec>

      <Sec t="Avisos e recolhidos">
        <div className="kt-gr">
          <Aviso tom="atencao" titulo="Conexão instável">O valor pode estar atrasado.</Aviso>
          <div>
            <Recolhido titulo="O que você recebe" aberto><p>A loja envia em até 3 dias úteis, e você recebe o rastreio.</p></Recolhido>
            <Recolhido titulo="Como o tempo funciona"><p>Lance nos últimos 2 minutos estende o fim.</p></Recolhido>
          </div>
        </div>
      </Sec>

      <Sec t="Carregando">
        <Linhas><Esqueleto /><Esqueleto /></Linhas>
      </Sec>

      <Rotulo fraco>Todas as cartas, nomes e valores são exemplos.</Rotulo>
    </div>
  )
}
