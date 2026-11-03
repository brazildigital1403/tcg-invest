import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { enviarLoteEmails, renderLeilaoMarcadoEmail } from '@/lib/email'
import { urlRodada } from '@/lib/leilao-urls'

/**
 * Loja agendou: avisa, por sino e e-mail, quem pediu "Quero ser avisado". Marca
 * `avisado_em` ANTES de enviar: agendar de novo nunca repete o aviso, e o pior
 * caso de uma queda aqui e alguem sem e-mail, nunca e-mail duplicado. Nunca
 * derruba o agendamento: erro so vai para o log.
 */
export async function avisarInteressados(
  sb: SupabaseClient,
  a: { numero: number; iniciaEm: string | null; lojaNome: string; nLotes: number },
): Promise<number> {
  try {
    const { data: filas, error } = await sb
      .from('leilao_aviso_interesse')
      .update({ avisado_em: new Date().toISOString() })
      .is('avisado_em', null)
      .select('user_id')
    if (error) throw new Error(error.message)
    const ids = (filas ?? []).map(f => f.user_id as string)
    if (!ids.length) return 0

    const quando = a.iniciaEm
      ? new Date(a.iniciaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : 'em breve'
    const link = urlRodada(a.numero)
    await sb.from('notifications').insert(ids.map(user_id => ({
      user_id,
      type: 'leilao',
      title: 'Leilão marcado',
      message: `${a.lojaNome}: ${quando}. ${a.nLotes} ${a.nLotes === 1 ? 'carta' : 'cartas'}.`,
      data: { link },
    })))

    const { data: users } = await sb.from('users').select('id, email, name').in('id', ids)
    const emails = (users ?? []).filter(u => u.email).map(u => ({
      ...renderLeilaoMarcadoEmail({ to: u.email as string, nome: u.name as string | null, lojaNome: a.lojaNome, quando, nLotes: a.nLotes, link }),
      chave: `leilao-marcado-${a.numero}-${u.id}`,
    }))
    if (emails.length) await enviarLoteEmails(emails)
    return ids.length
  } catch (err) {
    console.error('[leilao/aviso-interesse]', (err as Error)?.message)
    return 0
  }
}
