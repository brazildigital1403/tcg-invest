'use client'

// Entrar no Club (mockup aprovado pelo Du em 18/11/2026). Folha que confirma o @ do
// Instagram (obrigatório, um por conta) e o WhatsApp (opcional) e grava o membro pelo
// club_entrar. Quem já tem os dois no perfil só confirma; quem já é membro e está sem
// @ passa pelo mesmo caminho, sem trocar a origem. O @ e o WhatsApp também ficam no
// perfil, como no cadastro do Amigo Secreto.
//
// A carta 01 do mockup entra junto com o álbum: aqui o "pronto" ainda não mostra carta.

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { INSTAGRAM_RE, limparInstagram, primeiroNomeBonito } from '@/lib/amigoSecreto'
import { erroEntrarClub, instagramJaUsado, type CadastroClub } from '@/lib/pcc/membro'
import { Folha } from './_comum/calendario'
import { Ico } from './amigo-secreto/estilo'

const ERRO_ARROBA = 'Confira o seu @: só letras, números, ponto e sublinhado, sem espaço.'
const ERRO_ZAP = 'Confira o WhatsApp: só números, com DDD.'

/** WhatsApp do perfil como a pessoa lê: (11) 99999-0000. Fora do padrão, devolve como está. */
function zapBonito(v: string): string {
  const d = v.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return v
}

export default function EntrarClub({ cadastro, nome, onFechar, onEntrou }: {
  cadastro: CadastroClub | null
  nome: string
  onFechar: () => void
  onEntrou: (c: CadastroClub) => void
}) {
  // Fotografia de quando a folha abriu: depois de entrar, o cadastro do pai muda.
  const [eraMembro] = useState(!!cadastro?.membro)
  const arrobaDoPerfil = cadastro?.instagram && INSTAGRAM_RE.test(cadastro.instagram) ? cadastro.instagram : ''
  const zapDoPerfil = cadastro && !cadastro.faltam.includes('whatsapp') ? cadastro.whatsapp || '' : ''

  // Tudo no perfil: só confirmar. Falta algo: formulário.
  const [confirmando, setConfirmando] = useState(!!arrobaDoPerfil && !!zapDoPerfil)
  const [ig, setIg] = useState(cadastro?.instagram || '')
  const [whats, setWhats] = useState(cadastro?.whatsapp || '')
  const [trocandoZap, setTrocandoZap] = useState(!zapDoPerfil)
  const [erro, setErro] = useState('')
  const [bloqueado, setBloqueado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [resultado, setResultado] = useState<CadastroClub | null>(null)

  const igLimpo = limparInstagram(ig)
  const igOk = INSTAGRAM_RE.test(igLimpo)
  // Erro do banco ou, enquanto digita, o formato errado: o aviso aparece na hora, sem esperar o envio.
  const erroCampo = erro || (igLimpo !== '' && !igOk ? ERRO_ARROBA : '')
  const zapDigitos = whats.replace(/\D/g, '')
  const zapOk = !zapDigitos || /^[0-9]{10,13}$/.test(zapDigitos)
  const primeiroNome = primeiroNomeBonito(nome)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (ocupado) return
    const arroba = confirmando ? arrobaDoPerfil : igLimpo
    if (!INSTAGRAM_RE.test(arroba)) { setConfirmando(false); setErro(ERRO_ARROBA); return }
    if (!confirmando && !zapOk) { setErro(ERRO_ZAP); return }
    setOcupado(true)
    setErro('')
    setBloqueado(false)
    const { data, error } = await supabase.rpc('club_entrar', { p: { instagram: arroba, whatsapp: (confirmando ? zapDoPerfil : whats).trim() } })
    setOcupado(false)
    if (error) {
      // Na tela de confirmação o erro aparece no campo do @, que vira editável.
      setConfirmando(false)
      setErro(erroEntrarClub(error.message))
      setBloqueado(instagramJaUsado(error.message))
      return
    }
    const novo = data as CadastroClub
    setResultado(novo)
    onEntrou(novo)
  }

  // ── Pronto ────────────────────────────────────────────────────────────────
  if (resultado) {
    return (
      <Folha eyebrow={eraMembro ? 'Cadastro completo' : 'Você entrou no Club'} titulo={`Tudo certo${primeiroNome ? `, ${primeiroNome}` : ''}`} onFechar={onFechar}>
        <p className="as-p">
          {eraMembro ? 'O seu @ está no cadastro do Club.' : 'Agora você faz parte do Club.'} O @ e o WhatsApp ficam salvos no seu perfil da Bynx, e você muda os dois em Minha conta.
        </p>
        {resultado.faltam.includes('whatsapp') && <div className="as-note">Você pode colocar o WhatsApp depois, em Minha conta.</div>}
        <button type="button" className="as-btn pri cta" onClick={onFechar}>Fechar</button>
      </Folha>
    )
  }

  const eyebrow = eraMembro ? 'Completar cadastro' : 'Entrar no Club'
  const titulo = confirmando ? 'Confirme os seus dados' : eraMembro ? 'Falta o seu @' : 'Como o Club encontra você'
  const lead = confirmando
    ? 'Está tudo certo? Com um toque você entra no Club.'
    : eraMembro ? 'O Club usa o seu @ para reconhecer você no Amigo Secreto, nos Aniversariantes e na Agenda.' : 'Para entrar, o Club precisa do seu Instagram.'
  const podeEnviar = !ocupado && !bloqueado && (confirmando || (igOk && zapOk))

  return (
    <Folha eyebrow={eyebrow} titulo={titulo} onFechar={onFechar}>
      <form onSubmit={enviar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="as-p">{lead}</p>

        {confirmando ? (
          <>
            <div className="as-f">
              <span className="as-lb">Seu @ do Instagram</span>
              <div className="as-pre"><span>@</span><input className="as-in" value={arrobaDoPerfil} readOnly aria-label="Seu @ do Instagram" /></div>
            </div>
            <div className="as-f">
              <span className="as-lb">WhatsApp</span>
              <input className="as-in" value={zapBonito(zapDoPerfil)} readOnly aria-label="WhatsApp" />
            </div>
          </>
        ) : (
          <>
            <div className="as-f">
              <label className="as-lb" htmlFor="club-ig">Seu @ do Instagram</label>
              <div className="as-pre" style={erroCampo ? { borderColor: 'var(--bx-red)' } : undefined}>
                <span>@</span>
                <input id="club-ig" className="as-in" value={ig} onChange={e => { setIg(e.target.value); setErro(''); setBloqueado(false) }}
                  autoCapitalize="none" autoCorrect="off" inputMode="text" placeholder="seuperfil" aria-invalid={!!erroCampo} aria-describedby="club-ig-dica" />
              </div>
              <span id="club-ig-dica" className={`as-hint${erroCampo ? ' err' : ''}`} role={erroCampo ? 'alert' : undefined}>{erroCampo || 'Só letras, números, ponto e sublinhado, sem espaço.'}</span>
            </div>
            <div className="as-f">
              <label className="as-lb" htmlFor="club-zap">{zapDoPerfil ? 'WhatsApp' : 'WhatsApp (opcional)'}</label>
              {trocandoZap ? (
                <input id="club-zap" className="as-in" value={whats} onChange={e => setWhats(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 9 0000-0000" aria-describedby="club-zap-dica" />
              ) : (
                <div className="as-pre">
                  <input id="club-zap" className="as-in" value={zapBonito(zapDoPerfil)} readOnly />
                  <button type="button" className="as-btn lnk sm" style={{ minHeight: 44 }} onClick={() => setTrocandoZap(true)}>Trocar</button>
                </div>
              )}
              <span id="club-zap-dica" className="as-hint">{trocandoZap && !zapOk ? ERRO_ZAP : zapDoPerfil && !trocandoZap ? 'Já está no seu perfil.' : 'Só a organização vê.'}</span>
            </div>
          </>
        )}

        <div className="as-note">
          <strong>Para que serve:</strong> o @ é como o Club reconhece você no Amigo Secreto, nos Aniversariantes e na Agenda. Você troca depois em Minha conta.{' '}
          <Link href="/privacidade" target="_blank" style={{ color: 'var(--bx-text)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Política de privacidade</Link>.
        </div>

        <button type="submit" className="as-btn pri cta" disabled={!podeEnviar}>
          {ocupado ? 'Entrando...' : confirmando ? 'Confirmar e entrar' : eraMembro ? 'Salvar' : 'Entrar no Club'}
        </button>
        {confirmando && <button type="button" className="as-btn lnk" onClick={() => setConfirmando(false)}>Corrigir os dados</button>}
        {bloqueado && <Link href="/suporte" className="as-btn lnk" target="_blank"><Ico n="ext" s={14} />Falar com a organização</Link>}
      </form>
    </Folha>
  )
}
