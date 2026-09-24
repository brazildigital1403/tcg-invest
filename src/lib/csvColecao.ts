/**
 * Leitura do arquivo de colecao (CSV ou TXT) para a importacao em massa.
 *
 * ★ O QUE ESTE ARQUIVO NAO FAZ: casar carta. Quem casa e a funcao
 * `analisar_import_lote` no banco, que procura por nome + numero + total do
 * set. Aqui so se transforma a planilha em linhas no formato que ela entende
 * ("2x Charizard ex 199/165"), que e o mesmo formato do campo de colar.
 * Manter o casamento num lugar so e o que impede duas regras diferentes para
 * a mesma pergunta.
 *
 * ★ POR QUE UM PARSER PROPRIO E NAO UMA BIBLIOTECA: o arquivo tem 4 colunas
 * uteis e vem de exportador de aplicativo, nao de planilha feita a mao. O
 * necessario e aspas, separador vira-lata (`,` ou `;`) e quebra de linha do
 * Windows -- nao vale 40 KB de dependencia no bundle do navegador.
 */

export const TETO_IMPORTACAO = 500
export const TAMANHO_BLOCO = 40

export type PapelColuna = 'nome' | 'numero' | 'quantidade' | 'set' | 'ignorar'

export type ArquivoLido = {
  cabecalho: string[]
  linhas: string[][]
  /** Separador detectado, so para a tela poder explicar o que foi lido. */
  separador: ',' | ';' | '\t'
}

/**
 * Divide uma linha respeitando aspas duplas. `"Charizard ex, brilhante",199`
 * vira dois campos, nao tres.
 */
function dividirLinha(linha: string, sep: string): string[] {
  const out: string[] = []
  let atual = ''
  let dentroDeAspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      // Aspas duplicadas dentro do campo sao uma aspa literal ("" -> ").
      if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++ }
      else dentroDeAspas = !dentroDeAspas
    } else if (c === sep && !dentroDeAspas) {
      out.push(atual.trim()); atual = ''
    } else {
      atual += c
    }
  }
  out.push(atual.trim())
  return out
}

/** O separador e o que aparece mais vezes na primeira linha. */
function detectarSeparador(primeira: string): ',' | ';' | '\t' {
  const contagem: [',' | ';' | '\t', number][] = [
    [',', (primeira.match(/,/g) || []).length],
    [';', (primeira.match(/;/g) || []).length],
    ['\t', (primeira.match(/\t/g) || []).length],
  ]
  contagem.sort((a, b) => b[1] - a[1])
  return contagem[0][1] > 0 ? contagem[0][0] : ','
}

/**
 * Le o texto do arquivo. A primeira linha e SEMPRE tratada como cabecalho --
 * arquivo de exportador sempre tem um, e se nao tiver a pessoa ve na
 * pre-visualizacao que a primeira carta virou titulo de coluna.
 */
export function lerCsv(texto: string): ArquivoLido | null {
  // BOM do Excel entra como caractere invisivel no primeiro cabecalho e faz
  // "Nome" nunca casar com "Nome".
  const limpo = texto.replace(/^﻿/, '')
  const linhas = limpo.split(/\r\n|\n|\r/).filter(l => l.trim() !== '')
  if (linhas.length < 2) return null

  const separador = detectarSeparador(linhas[0])
  const cabecalho = dividirLinha(linhas[0], separador)
  const corpo = linhas.slice(1).map(l => dividirLinha(l, separador))
  return { cabecalho, linhas: corpo, separador }
}

/**
 * Chute do papel de cada coluna pelo nome do cabecalho.
 *
 * Cobre o export da propria Bynx (Nome, Número, Set, Qtd) e os nomes que os
 * aplicativos de fora costumam usar. O chute e ponto de partida: quem decide
 * e a pessoa, na tela.
 */
export function adivinharColunas(cabecalho: string[]): PapelColuna[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const jaUsado = new Set<PapelColuna>()

  return cabecalho.map(col => {
    const c = norm(col)
    const escolher = (p: PapelColuna): PapelColuna => {
      if (jaUsado.has(p)) return 'ignorar'   // duas colunas nao disputam o mesmo papel
      jaUsado.add(p); return p
    }
    if (/^(nome|name|card|card_?name|carta|titulo|title)$/.test(c)) return escolher('nome')
    if (/^(numero|number|no|n|card_?number|collector_?(no|number)|num)$/.test(c)) return escolher('numero')
    if (/^(qtd|quantidade|quantity|count|qty|amount|copias)$/.test(c)) return escolher('quantidade')
    if (/^(set|colecao|collection|expansion|expansao|edicao|set_?name)$/.test(c)) return escolher('set')
    return 'ignorar'
  })
}

export type LinhaImport = {
  /** Numero da linha no arquivo, para a pessoa achar o que corrigir. */
  origem: number
  /** O texto no formato que a RPC entende. */
  linha: string
  /** So para conferencia na revisao -- o set nao entra no casamento. */
  setArquivo: string | null
}

/**
 * Monta as linhas de busca a partir do arquivo e do mapeamento escolhido.
 *
 * ★ O SET NAO VAI NA LINHA, de proposito. A RPC monta os padroes de busca com
 * as palavras do NOME; juntar o nome do set ali faria a busca exigir que o
 * nome da carta contivesse "Evolving Skies", e nada casaria. O set fica
 * guardado para a tela de revisao avisar quando a carta encontrada e de outro
 * set -- que e onde ele ajuda de verdade.
 */
export function montarLinhas(arquivo: ArquivoLido, papeis: PapelColuna[]): LinhaImport[] {
  const idx = (p: PapelColuna) => papeis.indexOf(p)
  const iNome = idx('nome')
  const iNumero = idx('numero')
  const iQtd = idx('quantidade')
  const iSet = idx('set')
  if (iNome < 0 || iNumero < 0) return []

  const out: LinhaImport[] = []
  arquivo.linhas.forEach((cols, i) => {
    const nome = (cols[iNome] || '').trim()
    const numero = (cols[iNumero] || '').trim()
    if (!nome && !numero) return  // linha em branco no meio do arquivo

    const brutoQtd = iQtd >= 0 ? parseInt((cols[iQtd] || '').replace(/\D/g, ''), 10) : 1
    const qtd = Number.isFinite(brutoQtd) && brutoQtd > 0 ? Math.min(brutoQtd, 99) : 1

    out.push({
      origem: i + 2,  // +1 do cabecalho, +1 porque planilha comeca em 1
      linha: `${qtd > 1 ? `${qtd}x ` : ''}${nome} ${numero}`.trim(),
      setArquivo: iSet >= 0 ? (cols[iSet] || '').trim() || null : null,
    })
  })
  return out
}

/** Fatia em blocos do tamanho que o banco aguenta sem estourar o tempo. */
export function emBlocos<T>(itens: T[], tamanho = TAMANHO_BLOCO): T[][] {
  const out: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho))
  return out
}
