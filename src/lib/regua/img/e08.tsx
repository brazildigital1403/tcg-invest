import { E08 } from '@/lib/regua/templates/E08'
import { Abs, C, type Desenho, GRAD, brlImg, eNum, eObj, eStr, fundoFixo, imagemCartaImg, numImg, Seta } from './base'
import { Carta, T, caber } from './pecas'

/**
 * e08-painel (600x480). Ref.: mockups/E08-alerta-preco/assets/hero.html.
 * Fundo fixo: cena, painel com parafusos e o trilho (img-painel-fundo.jpg; na
 * queda, img-painel-fundo-queda.jpg com o brilho vermelho). Por cima: o nome
 * da carta em placas split-flap, a carta pendurada na presilha e a coluna da
 * direita (painel da pessoa, data, percentual em placas, ganho e placar).
 */

export type ImgE08 = {
  /** Primeiro nome da pessoa ("PAINEL DA MARINA"). */
  nome: string
  /** "07/10" */
  data: string
  carta: { nome: string; imagem: string }
  /** Variacao em 7 dias, em % (negativo = queda). */
  pct: number
  /** Variacao em R$ na colecao da pessoa. */
  naColecao: number
  /** Quantas outras cartas estao no placar do e-mail. */
  placar: number
}

const ex = E08.exemplo
const exemplo: ImgE08 = {
  nome: ex.nome,
  data: ex.data,
  carta: { nome: ex.destaque.nome, imagem: ex.destaque.imagem },
  pct: ex.destaque.pct,
  naColecao: ex.destaque.naColecao,
  placar: ex.outras.length,
}

function valido(d: unknown): d is ImgE08 {
  return eObj(d) && eStr(d.nome) && eStr(d.data) && eObj(d.carta) && eStr(d.carta.nome) && eStr(d.carta.imagem) &&
    eNum(d.pct) && eNum(d.naColecao) && eNum(d.placar)
}

/** Regra do mockup: 10 casas; acima disso tira o sufixo de mecanica e corta. */
function nomePainel(nome: string): string {
  let n = nome.toUpperCase()
  if (n.length > 10) n = n.replace(/\s+(EX|GX|V|VMAX|VSTAR|V-UNION|LV\.X)$/, '')
  return n.slice(0, 10)
}

const PLACA_BG = 'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.10) 49.5%, rgba(255,255,255,0.06) 50.5%, rgba(255,255,255,0.08) 100%)'

function Placa(props: { ch: string; w: number; h: number; fs: number; cor: string }) {
  const { ch, w, h, fs, cor } = props
  return (
    <div style={{ display: 'flex', position: 'relative', flexShrink: 0, width: w, height: h, borderRadius: 5, backgroundImage: PLACA_BG, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 3px rgba(8,10,15,0.7)', alignItems: 'center', justifyContent: 'center' }}>
      {ch.trim() ? <div style={{ display: 'flex', fontSize: fs, lineHeight: 1, fontWeight: 800, color: cor }}>{ch}</div> : null}
      <Abs x={0} y={h / 2 - 1} w={w} h={2} style={{ background: C.fundo }} />
    </div>
  )
}

async function desenhar(d: ImgE08) {
  const sobe = d.naColecao >= 0
  const cor = sobe ? C.verde : C.vermelho
  const [fundo, carta] = await Promise.all([
    fundoFixo(sobe ? 'e08/img-painel-fundo.jpg' : 'e08/img-painel-fundo-queda.jpg'),
    imagemCartaImg(d.carta.imagem, { largura: 244, altura: 341 }),
  ])

  // linha do nome: palavras separadas por vao estreito, placas lisas so no fim
  const palavras = nomePainel(d.carta.nome).split(/\s+/).filter(Boolean)
  const usadas = palavras.join('').length
  const nomeLinha: { ch: string; vao?: boolean }[] = []
  palavras.forEach((p, i) => {
    if (i > 0) nomeLinha.push({ ch: '', vao: true })
    for (const ch of p) nomeLinha.push({ ch })
  })
  for (let i = usadas; i < 10; i++) nomeLinha.push({ ch: ' ' })

  const pctTxt = `${d.pct >= 0 ? '+' : '-'}${numImg(Math.abs(d.pct))}%`
  const n = pctTxt.length
  const pw = Math.min(37, Math.floor((240 - 3 * (n - 1)) / n))
  const ganho = `${sobe ? '+' : '-'}${brlImg(Math.abs(d.naColecao))}`
  const marca = `PAINEL DA ${d.nome.toUpperCase()}`

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={480} style={{ position: 'absolute', left: 0, top: 0 }} />

      <Abs x={32} y={32} style={{ gap: 3 }}>
        {nomeLinha.map((c, i) => (c.vao
          ? <div key={i} style={{ display: 'flex', width: 16, flexShrink: 0 }} />
          : <Placa key={i} ch={c.ch} w={48} h={62} fs={40} cor={C.texto} />))}
      </Abs>

      {/* carta pendurada no trilho pela presilha */}
      <Abs x={48} y={116} w={244} h={341} style={{ transform: 'rotate(-4deg)', transformOrigin: 'top' }}>
        <Carta src={carta} w={244} h={341} raio={12} brilho={null} style={{ left: 0, top: 0 }}
          sombra={`0 0 0 2px rgba(255,255,255,0.14), 0 18px 34px rgba(8,10,15,0.85), 0 0 48px ${sobe ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)'}`} />
        <Abs x={116} y={-24} w={12} h={12} style={{ borderRadius: 6, border: '3px solid rgba(255,255,255,0.30)', boxShadow: '0 2px 3px rgba(8,10,15,0.8)' }} />
        <Abs x={96} y={-16} w={52} h={30} style={{ borderRadius: 6, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.26) 55%, rgba(255,255,255,0.12))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40), 0 4px 8px rgba(8,10,15,0.9)' }}>
          <Abs x={8} y={13} w={36} h={3} style={{ borderRadius: 2, background: 'rgba(8,10,15,0.7)' }} />
        </Abs>
      </Abs>

      <Abs x={330} y={116} w={240} style={{ flexDirection: 'column' }}>
        <T max={240} style={{ fontSize: caber(marca, 22, 240, 14, 0.66), lineHeight: '28px', fontWeight: 900, letterSpacing: 1.32, backgroundImage: GRAD, backgroundClip: 'text', color: 'transparent' }}>{marca}</T>
        <T style={{ alignItems: 'center', marginTop: 2, fontSize: 26, lineHeight: '32px', fontWeight: 800, letterSpacing: 1.56, color: C.sec }}>
          <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 5, background: C.verde, boxShadow: `0 0 10px ${C.verde}`, marginRight: 8 }} />
          {d.data}
        </T>
        <T style={{ alignItems: 'center', marginTop: 20, fontSize: 22, lineHeight: '28px', fontWeight: 800, letterSpacing: 1.76, color: cor }}>
          <Seta dir={sobe ? 'cima' : 'baixo'} cor={cor} tam={20} style={{ marginRight: 10 }} />
          {sobe ? 'SUBIU EM 7 DIAS' : 'CAIU EM 7 DIAS'}
        </T>
        <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
          {[...pctTxt].map((ch, i) => <Placa key={i} ch={ch} w={pw} h={58} fs={38} cor={cor} />)}
        </div>
        <T style={{ marginTop: 20, fontSize: caber(ganho, 40, 240, 26, 0.6), lineHeight: '44px', fontWeight: 900, letterSpacing: -0.4, color: cor }}>{ganho}</T>
        <T style={{ marginTop: 2, fontSize: 26, lineHeight: '32px', fontWeight: 700, color: C.sec }}>na sua coleção</T>
      </Abs>

      {d.placar > 0 ? (
        <Abs x={330} y={401} w={240} style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
          <T style={{ fontSize: 26, lineHeight: '32px', fontWeight: 800, letterSpacing: 1.56, color: C.sec }}>{`+${d.placar} NO PLACAR`}</T>
          <Seta dir="baixo" cor={C.sec} tam={20} style={{ marginLeft: 10 }} />
        </Abs>
      ) : null}
    </>
  )
}

export const e08Painel: Desenho<ImgE08> = { largura: 600, altura: 480, fundo: C.elevado, exemplo, valido, desenhar }
