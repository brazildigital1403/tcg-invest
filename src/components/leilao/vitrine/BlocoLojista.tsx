import Link from 'next/link'

/**
 * Bloco para lojas. A previa do painel e ILUSTRACAO estatica, sem numero nem
 * carta (nenhum dado inventado): barras no lugar de preco e tempo.
 */
export default function BlocoLojista() {
  return (
    <section className="vt-lojista" aria-labelledby="vt-lojista-t">
      <div>
        <p className="vt-rot" style={{ marginBottom: 6 }}>Para lojas</p>
        <h2 id="vt-lojista-t">Faça seu leilão ao vivo na Bynx</h2>
        <p className="vt-lojista-sub">Você transmite, a Bynx cuida do lance e da cobrança.</p>
        <ul>
          <li>Quem arremata paga pela Bynx, no cartão: você não precisa cobrar ninguém no Pix.</li>
          <li>Link fixo da rodada para colocar na live.</li>
          <li>Painel ao vivo com o lote no ar, a fila e o resultado.</li>
        </ul>
        <Link href="/para-lojistas" prefetch={false} className="vt-cta">Criar minha rodada</Link>
      </div>
      <div className="vt-painel" aria-hidden>
        <p className="vt-rot">Painel ao vivo</p>
        <div className="vt-painel-l"><span className="vt-painel-carta" /><b>Lote no ar</b><span className="vt-painel-barra" /></div>
        <div className="vt-painel-l"><span className="vt-painel-carta" />Próximo lote</div>
        <div className="vt-painel-l"><span className="vt-painel-carta" />Lote arrematado<span className="vt-painel-barra" /></div>
      </div>
    </section>
  )
}
