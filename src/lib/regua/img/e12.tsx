import { E12 } from '@/lib/regua/templates/E12'
import { Abs, C, type Desenho, eObj, eStr, fundoFixo } from './base'
import { T, caber } from './pecas'

/**
 * e12-ingresso (600x136). Ref.: mockups/E12-leilao-lista-espera/assets/ingresso.html.
 * Fundo fixo: o ingresso inteiro sem texto variavel, com a placa BYNX | LEILOES,
 * a faixa foil, o picote e o codigo de barras (img-ingresso-fundo.jpg). Por
 * cima, no mesmo giro de -1 grau: RODADA, loja, dia e o NOME no canhoto.
 */

export type ImgE12 = {
  /** Primeiro nome (vai em maiusculas no canhoto). */
  nome: string
  rodada: { numero: string; loja: string; dia: string }
}

const exemplo: ImgE12 = { nome: E12.exemplo.nome, rodada: { ...E12.exemplo.rodada } }

function valido(d: unknown): d is ImgE12 {
  return eObj(d) && eStr(d.nome) && eObj(d.rodada) && eStr(d.rodada.numero) && eStr(d.rodada.loja) && eStr(d.rodada.dia)
}

async function desenhar(d: ImgE12) {
  const fundo = await fundoFixo('e12/img-ingresso-fundo.jpg')
  const rodada = `RODADA ${d.rodada.numero}`
  const loja = d.rodada.loja.toUpperCase()
  const dia = `${d.rodada.dia.toUpperCase()} · AO VIVO`
  const nome = d.nome.toUpperCase()
  const tamNome = caber(nome, 30, 90, 16, 0.66)

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={fundo} width={600} height={136} style={{ position: 'absolute', left: 0, top: 0 }} />
      <Abs x={40} y={12} w={520} h={112} style={{ transform: 'rotate(-1deg)' }}>
        <T style={{ position: 'absolute', left: 247, top: 11, fontSize: caber(rodada, 29, 160, 18, 0.66), lineHeight: '34px', fontWeight: 900, letterSpacing: -1.0, color: C.ambar }}>{rodada}</T>
        <T max={360} style={{ position: 'absolute', left: 44, top: 51, fontSize: caber(loja, 22, 356, 15, 0.7), lineHeight: '26px', fontWeight: 800, letterSpacing: 0.44, color: C.texto }}>{loja}</T>
        <T max={360} style={{ position: 'absolute', left: 44, top: 77, fontSize: caber(dia, 22, 356, 15, 0.7), lineHeight: '26px', fontWeight: 700, letterSpacing: 0.44, color: 'rgba(240,240,240,0.62)' }}>{dia}</T>
        {/* nome na vertical: caixa 96x34 centrada na coluna do canhoto, girada no proprio centro */}
        <Abs x={461 - 48} y={58 - 17} w={96} h={34} style={{ alignItems: 'center', justifyContent: 'center', transform: 'rotate(-90deg)' }}>
          <T max={94} style={{ fontSize: tamNome, lineHeight: '34px', fontWeight: 900, letterSpacing: tamNome * 0.02, color: C.texto }}>{nome}</T>
        </Abs>
      </Abs>
    </>
  )
}

export const e12Ingresso: Desenho<ImgE12> = { largura: 600, altura: 136, fundo: C.elevado, exemplo, valido, desenhar }
