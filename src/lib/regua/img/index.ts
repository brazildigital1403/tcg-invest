import { tipoImg, type TipoImg } from './base'
import { e01Fichario } from './e01'
import { e04Proxima } from './e04'
import { e05Trial } from './e05'
import { e06Grafico } from './e06'
import { e07Fichario } from './e07'
import { e08Painel } from './e08'
import { e09Bolso } from './e09'
import { e12Ingresso } from './e12'
import { e13Lance } from './e13'
import { e14Arrematado, e14Faltou } from './e14'
import { e15Postal } from './e15'
import { e16Fichario } from './e16'
import { e17Stories, e17TrofeuCartas, e17TrofeuFichario, e17TrofeuPrimeira, e17TrofeuRepetidas } from './e17'
import { e18Remarcadas } from './e18'
import { e19Bancada } from './e19'
import { e20Varal } from './e20'

/**
 * Registro dos tipos de imagem pessoal da regua. A chave e o `tipo` que os
 * templates passam para `urlImagemPessoal` e o nome da chave em
 * `email_envios.meta.img`. O formato dos dados de cada tipo esta no topo do
 * arquivo do tipo (ImgE01, ImgE04, ...): e o contrato com o motor.
 */
export const DESENHOS: Record<string, TipoImg> = {
  'e01-fichario': tipoImg(e01Fichario),
  'e04-proxima': tipoImg(e04Proxima),
  'e05-trial': tipoImg(e05Trial),
  'e06-grafico': tipoImg(e06Grafico),
  'e07-fichario': tipoImg(e07Fichario),
  'e08-painel': tipoImg(e08Painel),
  'e09-bolso': tipoImg(e09Bolso),
  'e12-ingresso': tipoImg(e12Ingresso),
  'e13-lance': tipoImg(e13Lance),
  'e14-arrematado': tipoImg(e14Arrematado),
  'e14-faltou': tipoImg(e14Faltou),
  'e15-postal': tipoImg(e15Postal),
  'e16-fichario': tipoImg(e16Fichario),
  'e17-stories': tipoImg(e17Stories),
  'e17-trofeu-cartas': tipoImg(e17TrofeuCartas),
  'e17-trofeu-fichario': tipoImg(e17TrofeuFichario),
  'e17-trofeu-repetidas': tipoImg(e17TrofeuRepetidas),
  'e17-trofeu-primeira': tipoImg(e17TrofeuPrimeira),
  'e18-remarcadas': tipoImg(e18Remarcadas),
  'e19-bancada': tipoImg(e19Bancada),
  'e20-varal': tipoImg(e20Varal),
}
