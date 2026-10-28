/**
 * Quem vende, como o comprador ve (#470, decisao do Du em 28/10/2026).
 *
 * O Decreto 7.962/2013 pede nome e CNPJ ou CPF de quem vende. A regra:
 *   - loja com `cnpj` aparece como EMPRESA: razao social + CNPJ;
 *   - o resto (loja sem CNPJ, vendedor sem loja) aparece como PESSOA FISICA:
 *     nome e CPF do dono. Nas telas publicas o CPF sai MASCARADO
 *     (***.456.789-**, o mesmo padrao do gov.br); inteiro, so no pedido de
 *     quem comprou.
 *
 * ★ O CPF INTEIRO NUNCA SAI DO SERVIDOR para tela publica: quem monta e
 * `identificacaoPublica`, que so recebe o CPF para mascarar. Este arquivo e
 * puro (sem banco) para dar para testar a conta; a leitura vive em
 * vendedorIdentificadoServer.ts.
 */

export type Identificacao = {
  tipo: 'empresa' | 'pessoa'
  /** Razao social ou nome da pessoa. */
  nome: string
  /** "CNPJ 12.345.678/0001-90", "CPF ***.456.789-**" ou null quando falta o dado. */
  documento: string | null
}

const so = (v: string | null | undefined) => (v || '').replace(/\D/g, '')

export function cnpjValido(v: string | null | undefined): boolean {
  const d = so(v)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const dv = (base: string) => {
    let soma = 0
    let peso = base.length - 7
    for (const c of base) {
      soma += Number(c) * peso--
      if (peso < 2) peso = 9
    }
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = dv(d.slice(0, 12))
  const d2 = dv(d.slice(0, 12) + d1)
  return d.endsWith(`${d1}${d2}`)
}

export function formatarCnpj(v: string | null | undefined): string {
  const d = so(v)
  if (d.length !== 14) return d
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function formatarCpf(v: string | null | undefined): string {
  const d = so(v)
  if (d.length !== 11) return d
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** ***.456.789-** : esconde os 3 primeiros e os 2 verificadores. */
export function mascararCpf(v: string | null | undefined): string | null {
  const d = so(v)
  if (d.length !== 11) return null
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`
}

/** Razao social como a pessoa digitou, sem espaco sobrando. */
export function limparRazaoSocial(v: string | null | undefined): string {
  return (v || '').replace(/\s+/g, ' ').trim()
}

export type DadosVendedor = {
  cnpj?: string | null
  razaoSocial?: string | null
  nomeDono?: string | null
  cpfDono?: string | null
}

/**
 * `completo` = CPF inteiro. So para quem comprou daquele vendedor (pedido) --
 * quem chama e responsavel por conferir isso antes.
 */
export function montarIdentificacao(d: DadosVendedor, completo = false): Identificacao | null {
  const cnpj = so(d.cnpj)
  const razao = limparRazaoSocial(d.razaoSocial)
  if (cnpj.length === 14 && razao) {
    return { tipo: 'empresa', nome: razao, documento: `CNPJ ${formatarCnpj(cnpj)}` }
  }
  const nome = limparRazaoSocial(d.nomeDono)
  if (!nome) return null
  const cpf = completo ? (so(d.cpfDono).length === 11 ? formatarCpf(d.cpfDono) : null) : mascararCpf(d.cpfDono)
  return { tipo: 'pessoa', nome, documento: cpf ? `CPF ${cpf}` : null }
}

/**
 * O que a loja manda no painel/cadastro. CNPJ vazio = pessoa fisica (limpa os
 * dois campos). CNPJ preenchido exige digito certo e razao social.
 */
export function validarDadosEmpresa(
  cnpj: unknown,
  razaoSocial: unknown,
): { cnpj: string | null; razao_social: string | null } | { erro: string } {
  const d = so(typeof cnpj === 'string' ? cnpj : '')
  if (!d) return { cnpj: null, razao_social: null }
  if (!cnpjValido(d)) return { erro: 'CNPJ inválido. Confira os 14 números.' }
  const razao = limparRazaoSocial(typeof razaoSocial === 'string' ? razaoSocial : '')
  if (razao.length < 2) return { erro: 'Informe a razão social do CNPJ.' }
  if (razao.length > 150) return { erro: 'A razão social passou de 150 caracteres.' }
  return { cnpj: d, razao_social: razao }
}
