// Membros do Poké Creators Club (18/11/2026). Quem é Creator mora em club_membros
// (migration 20261118160000_club_membros) e o navegador só fala com as funções
// club_meu_cadastro e club_entrar. O @ do Instagram e o WhatsApp também ficam no perfil
// (users), como no cadastro do Amigo Secreto.

import { erroAmigoSecreto } from '@/lib/amigoSecreto'

export type OrigemMembro = 'modal' | 'amigo_secreto' | 'aniversarios' | 'organizacao' | 'admin'

export type CadastroClub = {
  membro: boolean
  origem: OrigemMembro | null
  desde: string | null
  /** @ do perfil, minúsculo e sem o @ (nulo se não houver). */
  instagram: string | null
  /** WhatsApp do perfil, como está salvo (nulo se não houver). */
  whatsapp: string | null
  /** O que falta no perfil para o cadastro do Club ficar completo. */
  faltam: Array<'instagram' | 'whatsapp'>
}

/** Como a pessoa entrou, em texto para o Admin. */
export const ORIGEM_MEMBRO: Record<OrigemMembro, string> = {
  modal: 'Entrou pelo modal',
  amigo_secreto: 'Amigo Secreto',
  aniversarios: 'Aniversariantes',
  organizacao: 'Organização do Club',
  admin: 'Marcado no Admin',
}

export const instagramJaUsado = (msg?: string | null) => (msg || '').includes('instagram_ja_usado')

/** Mensagens das funções do banco em texto para a pessoa. */
export function erroEntrarClub(msg?: string | null): string {
  const m = msg || ''
  if (instagramJaUsado(m)) return 'Esse @ já está em outra conta do Club. Fale com a organização para resolver.'
  if (m.includes('usuario_nao_encontrado')) return 'Não achamos o seu cadastro. Saia e entre de novo na sua conta.'
  return erroAmigoSecreto(m)
}
