import Image from 'next/image'
import { GRADUADORA_MAP, tierNome, notaCurta, isNotaTop } from '@/lib/graduadoras'

/**
 * Slab estatico (sem estado) para paginas publicas: etiqueta da graduadora com
 * nota e nivel, e a carta dentro do acrilico. Serve no servidor, entao a arte
 * chega no HTML que o Google le.
 *
 * Nivel, rotulo, brilho e cor saem de lib/graduadoras -- o mesmo arquivo do
 * slab no CardItem e do "Monte o seu slab". A largura e de quem monta: o slab
 * ocupa 100% do elemento pai.
 *
 * O CSS vive em SLAB_ARTE_CSS e entra uma vez na pagina que usa.
 */

const OURO = '#e8c878' // mesmo dourado do Black Label no CardItem

export default function SlabArte({
  graduadora, nota, blackLabel = false, img, nome, sizes, priority = false, mostrarNome = true, altVazio = false,
}: {
  graduadora: string
  nota: number
  blackLabel?: boolean
  img: string
  nome: string
  sizes: string
  priority?: boolean
  mostrarNome?: boolean
  /** Copia decorativa (faixa em loop): a arte ja foi descrita na primeira. */
  altVazio?: boolean
}) {
  const g = GRADUADORA_MAP[graduadora]
  if (!g) return null
  const bl = blackLabel && g.temBlackLabel
  const rotulo = notaCurta(nota, bl)
  const classe = `sa${isNotaTop(nota, bl) ? ' sa-top' : ''}${bl ? ' sa-bl' : ''}`

  return (
    <div className={classe} style={{ ['--g' as string]: bl ? '#0a0a0a' : g.cor }}>
      <div className="sa-lab" style={{ color: bl ? OURO : '#fff' }}>
        <div className="sa-l">
          <div className="sa-sig">{g.curto}</div>
          {mostrarNome && <div className="sa-nome">{nome}</div>}
        </div>
        <div className="sa-r">
          <div className="sa-nota">{rotulo}</div>
          <div className="sa-tier">{tierNome(graduadora, nota, bl)}</div>
        </div>
      </div>
      <div className="sa-win">
        <Image
          src={img}
          alt={altVazio ? '' : `${nome} graduada ${g.curto} ${rotulo}`}
          width={245}
          height={342}
          sizes={sizes}
          priority={priority}
        />
      </div>
    </div>
  )
}

export const SLAB_ARTE_CSS = `
.sa{position:relative;width:100%;border-radius:15px;padding:9px;
  background:linear-gradient(160deg,rgba(255,255,255,.17),rgba(255,255,255,.04) 40%,rgba(255,255,255,.09));
  border:1px solid rgba(255,255,255,.25);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 24px 56px rgba(0,0,0,.6)}
.sa-top{box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 24px 56px rgba(0,0,0,.6),0 0 46px -6px var(--g)}
.sa-bl{border-color:rgba(232,200,120,.55)}
.sa-bl.sa-top{box-shadow:inset 0 0 0 1px rgba(232,200,120,.2),0 24px 56px rgba(0,0,0,.6),0 0 50px -4px rgba(232,200,120,.6)}
.sa-lab{display:flex;justify-content:space-between;align-items:center;gap:8px;border-radius:8px;padding:6px 9px;background:var(--g);margin-bottom:7px;min-height:46px}
.sa-bl .sa-lab{border:1px solid rgba(232,200,120,.45)}
.sa-l{min-width:0}
.sa-sig{font-size:13px;font-weight:800;letter-spacing:.04em;line-height:1}
.sa-nome{font-size:9px;font-weight:600;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
.sa-r{text-align:right;flex:none}
.sa-nota{font-size:24px;font-weight:800;line-height:.95;font-variant-numeric:tabular-nums}
.sa-tier{font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-top:2px;white-space:nowrap}
.sa-win{border-radius:8px;background:#0b0d12;border:1px solid rgba(255,255,255,.08);padding:7px}
.sa-win img{display:block;width:100%;height:auto;border-radius:6px}
`
