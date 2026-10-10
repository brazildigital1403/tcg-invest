/**
 * Avisos transacionais do leilao (E13 lance superado, E14 resultado do lote).
 *
 * ★ NAO ESTA LIGADO A NADA. O leilao nao esta em producao (feat/leilao); o
 * modulo do leilao chama esta funcao quando for ao ar. Ela passa pelo mesmo
 * pipeline da regua (linha em email_envios, token da imagem, Resend, CDN) e
 * respeita a chave geral: com REGUA_ATIVA != '1', so simula.
 *
 * Transacional: sem teto, sem consentimento de marketing (e aviso de algo que a
 * pessoa fez), rodape sem Descadastrar. Dedup pela `chave` que o chamador da
 * (ex.: "lance:<lote>:<lance>" no E13, "lote:<lote>:<resultado>" no E14).
 *
 * Regras de quando chamar (BRIEFS, E13/E14): E13 so em lote com mais de 10
 * minutos restantes (no ao vivo de 30-90s o aviso e push/sino); E14 ganhador na
 * hora + lembrete 24h, perdedor 1h depois, uma vez.
 */
import type { DadosE13 } from '@/lib/regua/templates/E13'
import type { DadosE14 } from '@/lib/regua/templates/E14'
import type { ImgE13 } from '@/lib/regua/img/e13'
import type { ImgE14Arrematado, ImgE14Faltou } from '@/lib/regua/img/e14'
import { criarContexto } from './contexto'
import { enviarCandidatos } from './envio'
import { jaRecebeu } from './regras'

export type AvisoLeilao =
  | { template: 'E13'; dados: DadosE13; img: ImgE13 }
  | { template: 'E14'; dados: DadosE14; img: ImgE14Arrematado | ImgE14Faltou }

export async function enviarAvisoLeilao(args: AvisoLeilao & { userId: string; chave: string }): Promise<{ status: 'enviado' | 'simulado' | 'pulado' | 'falhou'; motivo?: string }> {
  const ctx = await criarContexto({ so: [args.userId] })
  const u = ctx.usuarios.get(args.userId)
  if (!u) return { status: 'pulado', motivo: 'usuario_inexistente' }
  if (jaRecebeu(ctx, u.id, args.template, { chave: args.chave })) return { status: 'pulado', motivo: 'ja_recebeu' }
  const tipo = args.template === 'E13' ? 'e13-lance'
    : args.dados.resultado === 'arrematou' ? 'e14-arrematado' : 'e14-faltou'
  const r = await enviarCandidatos(ctx, [{
    usuario: u, template: args.template, campanha: args.template.toLowerCase(), chave: args.chave,
    dados: args.dados, img: { [tipo]: args.img },
  }])
  if (r.simulados) return { status: 'simulado' }
  if (r.enviados) return { status: 'enviado' }
  return { status: 'falhou' }
}
