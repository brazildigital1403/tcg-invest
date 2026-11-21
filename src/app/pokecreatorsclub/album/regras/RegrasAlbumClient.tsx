'use client'

// Regra pública do Álbum do Club (fatia 4 da Fase 1, 21/11/2026). Qualquer pessoa lê, sem entrar.
// O texto descreve o que o álbum faz hoje, sem prometer nada além; as datas, a tiragem do set e a
// lista de missões vêm da edição já aberta (club_colecao_regras_publica), nunca cravadas aqui. A
// carta secreta continua secreta, e o rosto de uma carta (nome, texto, arte) nunca chega a esta
// página. Não é parecer jurídico: o texto passa pelo advogado antes da Fase 2.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { MISSOES, nn } from '@/lib/pcc/album'
import { carregarRegras, dataHoraBr, type CartaRegra, type RegrasAlbum } from '@/lib/pcc/albumOrg'
import { ALBUM } from '@/lib/pcc/rotas'
import { AS_CSS, VoltarClub } from '../../amigo-secreto/estilo'

type Estado = { fase: 'lendo' } | { fase: 'falhou' } | { fase: 'ok'; regra: RegrasAlbum }

const aEstado = (r: Awaited<ReturnType<typeof carregarRegras>>): Estado => (r.ok ? { fase: 'ok', regra: r.d } : { fase: 'falhou' })

export default function RegrasAlbumClient() {
  const [estado, setEstado] = useState<Estado>({ fase: 'lendo' })

  useEffect(() => {
    let vivo = true
    carregarRegras().then(r => { if (vivo) setEstado(aEstado(r)) })
    return () => { vivo = false }
  }, [])

  const tentarDeNovo = () => { setEstado({ fase: 'lendo' }); carregarRegras().then(r => setEstado(aEstado(r))) }

  const regra = estado.fase === 'ok' ? estado.regra : null
  const ed = regra?.edicao ?? null
  const cartas = regra?.cartas ?? []
  const total = ed?.total ?? 0
  const tiragem = ed?.tiragem_fisica ?? null
  const todas = total > 0 ? `as ${total} cartas` : 'todas as cartas'
  const semDados = estado.fase === 'lendo' ? 'Abrindo...' : estado.fase === 'falhou' ? 'Não conseguimos carregar agora.' : 'Aparece aqui quando a edição abrir.'

  return (
    <div className="as rg">
      <header className="as-top bx-gutter">
        <div className="as-wrap">
          <VoltarClub href={ALBUM} rotulo="Álbum" />
          <span className="t">Regra do álbum</span>
          <span style={{ width: 44 }} aria-hidden="true" />
        </div>
      </header>
      <main className="bx-gutter">
        <div className="as-wrap as-bd">
          <article className="rg-col">
            <h1 className="as-h2">Regra do Álbum do Club</h1>
            <p className="as-p">Como ganhar as cartas, os prazos e o set físico, em uma tela. As datas e os números vêm da própria edição.</p>

            <Secao titulo="O que é">
              <p>O Álbum do Club reúne {total > 0 ? `${total} cartas` : 'as cartas'} colecionáveis digitais do Poké Creators Club. Cada carta é ganha ao cumprir uma missão. As cartas ficam na conta de quem as ganhou e não são vendidas nem transferidas.</p>
              <p>Participa quem tem conta na Bynx e entrou no Poké Creators Club. Entrar no Club não custa nada.</p>
            </Secao>

            <Secao titulo="Como ganhar">
              <p>Cada carta tem uma missão. O site confere sozinho as missões automáticas quando a pessoa abre o álbum. Nas outras, a organização do Club confere e concede a carta.</p>
              {ed ? <ListaMissoes cartas={cartas} /> : <p className="rg-mut">{semDados}</p>}
              {estado.fase === 'falhou' && <button type="button" className="as-btn" onClick={tentarDeNovo}>Tentar de novo</button>}
            </Secao>

            <Secao titulo="Prazos">
              {ed ? (
                <>
                  <p>A edição {ed.edicao} abriu em {dataHoraBr(ed.abre_em)}. Dá para ganhar cartas até {dataHoraBr(ed.fecha_em)}. Depois disso, até {dataHoraBr(ed.pedir_set_ate)}, quem já virou {todas} ainda pode pedir o set físico.</p>
                  <p className="rg-mut">Todas as datas valem no horário de Brasília.{ed.status === 'encerrada' ? ' Esta edição está encerrada.' : ''}</p>
                </>
              ) : <p className="rg-mut">{semDados}</p>}
            </Secao>

            <Secao titulo="Cartas fechadas e viradas">
              <p>A carta ganha chega fechada. A pessoa a vira no álbum, e só as cartas viradas entram no contador. O nome, o texto e a arte de uma carta só aparecem para quem a ganhou, salvo as cartas que a organização libera como prévia.</p>
            </Secao>

            <Secao titulo="Set físico">
              <p>
                Quem vira {todas} dentro do prazo pode pedir o set físico, no botão Receber meu set em casa.{' '}
                {tiragem !== null
                  ? `A tiragem é de ${tiragem} ${tiragem === 1 ? 'set' : 'sets'} por edição, e os pedidos valem na ordem em que chegam: quando os sets acabam, os pedidos fecham.`
                  : 'A tiragem é limitada, e os pedidos valem na ordem em que chegam.'}{' '}
                Pedir não custa nada. O frete fica por conta de quem recebe, e a organização combina o envio com a pessoa, por e-mail ou WhatsApp.
              </p>
            </Secao>

            <Secao titulo="Camiseta">
              <p>Quem compra a camiseta do Club recebe {todas} digitais de uma vez, depois que a organização confirma o pagamento.</p>
            </Secao>

            <Secao titulo="Correções e dúvidas">
              <p>A organização pode desfazer uma carta concedida por engano. Dúvidas sobre o álbum: fale com a organização do Club.</p>
            </Secao>

            <Link href={ALBUM} className="as-btn pri">Abrir o meu álbum</Link>
          </article>
        </div>
      </main>
      <style>{AS_CSS + RG_CSS}</style>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="rg-sec"><h2>{titulo}</h2>{children}</section>
}

function ListaMissoes({ cartas }: { cartas: CartaRegra[] }) {
  return (
    <div className="rg-mis">
      {cartas.map(c => {
        if (c.secreta || !c.missao) {
          return (
            <div key={c.numero} className="rg-mi">
              <span className="nr">{nn(c.numero)}</span>
              <div className="tx"><b>Carta surpresa</b><small>Aparece sozinha quando a pessoa avança no álbum.</small></div>
            </div>
          )
        }
        const como = (c.como_ganhar || '').replace(/[.\s]+$/, '')
        return (
          <div key={c.numero} className="rg-mi">
            <span className="nr">{nn(c.numero)}</span>
            <div className="tx">
              <b>{MISSOES[c.missao]?.titulo || `Carta ${nn(c.numero)}`}</b>
              <small>{como}. {c.modo === 'manual' ? 'A organização confere.' : 'O site confere.'}</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const RG_CSS = `
.rg-col{width:100%;max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:12px;min-width:0}
.rg-sec{display:flex;flex-direction:column;gap:8px;padding-top:14px;border-top:1px solid var(--bx-border)}
.rg-sec h2{font-size:15px;font-weight:800;letter-spacing:-.01em;color:var(--bx-text)}
.rg-sec p{font-size:14px;line-height:1.55;color:var(--bx-text-2)}
.rg-sec p.rg-mut{font-size:12.5px;color:var(--bx-text-3)}
.rg-sec .as-btn{width:auto;align-self:flex-start}
.rg-mis{display:flex;flex-direction:column}
.rg-mi{display:flex;align-items:flex-start;gap:12px;padding:9px 0;border-top:1px solid var(--bx-border)}
.rg-mi:first-child{border-top:0}
.rg-mi .nr{width:22px;flex:none;padding-top:2px;font-size:11px;font-weight:800;color:var(--bx-text-3);font-variant-numeric:tabular-nums}
.rg-mi .tx{flex:1;min-width:0}
.rg-mi .tx b{display:block;font-size:14px;font-weight:700;color:var(--bx-text)}
.rg-mi .tx small{display:block;font-size:12.5px;line-height:1.4;color:var(--bx-text-3)}
`
