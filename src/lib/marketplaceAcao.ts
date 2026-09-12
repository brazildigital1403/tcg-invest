import { authFetch } from '@/lib/authFetch'

/**
 * Muda o status de um anuncio pela rota de servidor.
 *
 * ★ POR QUE NAO ESCREVER DIRETO (12/09/2026): ate hoje 13 pontos do browser
 * faziam `supabase.from('marketplace').update({ status })`. Sem regra de quem
 * pode o que -- a policy deixava qualquer logado escrever qualquer status em
 * anuncio disponivel alheio -- e sem como furar o cache da /carta, que virou
 * ISR de 7 dias. A rota resolve os dois. Ver /api/marketplace/[id]/status.
 *
 * ★ ERRO AGORA EXISTE. Antes o update do cliente falhava CALADO (a policy
 * recusava e ninguem olhava o retorno). A rota devolve 403 (papel errado) e
 * 409 (o anuncio mudou no meio), e quem chama precisa mostrar isso -- senao
 * o botao "nao faz nada" e o usuario clica de novo.
 */
export type AcaoAnuncio = 'reservar' | 'enviar' | 'concluir' | 'liberar' | 'cancelar'

export async function mudarStatusAnuncio(
  anuncioId: string,
  acao: AcaoAnuncio,
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const r = await authFetch(`/api/marketplace/${anuncioId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao }),
    })
    if (r.ok) return { ok: true }
    const j = await r.json().catch(() => ({}))
    return { ok: false, erro: (j as { error?: string })?.error || 'Nao foi possivel concluir a acao.' }
  } catch {
    // Rede caiu. Mensagem que diz o que fazer, nao "erro inesperado".
    return { ok: false, erro: 'Sem conexao com o servidor. Tente de novo.' }
  }
}
