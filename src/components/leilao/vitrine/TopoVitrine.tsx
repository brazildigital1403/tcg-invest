import type { ReactNode } from 'react'
import { Selo } from '@/components/leilao/kit'

/** Topo da vitrine: frase forte a esquerda e o que esta aberto a direita. */
export default function TopoVitrine({
  aoVivo, frase, destaque, texto, children, rodape,
}: {
  aoVivo?: boolean; frase: string; destaque?: string; texto: string; children: ReactNode; rodape: ReactNode
}) {
  return (
    <section className="vt-topo">
      <header className="vt-topo-t">
        {aoVivo && <Selo tom="vivo">Ao vivo agora</Selo>}
        <h1 className="lk-rotulo">Leilão de cartas Pokémon</h1>
        <p className="vt-frase">{frase}{destaque && <em> {destaque}</em>}</p>
        <p className="vt-frase-apoio">{texto}</p>
      </header>
      <div className="vt-topo-c">{children}</div>
      <div className="vt-topo-r">{rodape}</div>
    </section>
  )
}
