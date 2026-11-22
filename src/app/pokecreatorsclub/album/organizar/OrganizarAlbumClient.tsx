'use client'

// Área de quem organiza o álbum (fatia 4 da Fase 1, 21/11/2026). Conta normal da Bynx com o papel
// "colecao" (a Mika): concede UMA carta de missão conferida pela organização a quem for colado,
// vê antes o que vai acontecer com cada nome e desfaz só os lotes que ela mesma concedeu. Molde das
// Avisos. As regras de verdade ficam no banco (club_colecao_*): esta tela só as chama. No fim da
// tela fica a amostra do portfólio (Fase 2, fatia 2b), que vale para todas as edições.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { MISSOES, nn } from '@/lib/pcc/album'
import { FASES, dataBr, dataHoraCurta, separarTokens } from '@/lib/pcc/albumAdmin'
import {
  MAX_NOMES_ORG, carregarPainelOrg, concederOrg, desfazerLoteOrg, meusPapeis, previaOrg,
  type CartaManual, type EdicaoOrg, type EstadoLinhaOrg, type LoteOrg, type PainelOrg, type PreviaOrg, type ResultadoOrg,
} from '@/lib/pcc/albumOrg'
import { ALBUM, ALBUM_ORGANIZAR } from '@/lib/pcc/rotas'
import { Folha } from '../../_comum/calendario'
import { Casca } from '../../agenda/comum'
import AmostraPortfolio from './AmostraPortfolio'

type Carga = { fase: 'lendo' } | { fase: 'sem_papel' } | { fase: 'falhou' } | { fase: 'ok'; painel: PainelOrg | null }

const ROTULO: Record<EstadoLinhaOrg, string> = {
  recebe: 'Vai receber', ja_tem: 'Já tem', proprio: 'É você', nao_membro: 'Não entrou no Club', sem_conta: 'Sem conta', ambiguo: 'Use o e-mail',
}
const DICA: Record<EstadoLinhaOrg, string> = {
  recebe: '', ja_tem: 'Nada muda para esta pessoa.', proprio: 'Você não concede a carta a si mesma.',
  nao_membro: 'Tem conta na Bynx, mas ainda não entrou no Club.', sem_conta: 'Não achamos nenhuma conta com isso.',
  ambiguo: 'Mais de uma conta usa esse @. Cole o e-mail.',
}
const ORDEM: EstadoLinhaOrg[] = ['recebe', 'ja_tem', 'proprio', 'nao_membro', 'ambiguo', 'sem_conta']

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Texto do chip de cada estado, já no plural certo ("Club" não vira minúscula). */
function rotuloChip(k: EstadoLinhaOrg, n: number): string {
  switch (k) {
    case 'recebe': return n === 1 ? '1 vai receber' : `${n} vão receber`
    case 'ja_tem': return n === 1 ? '1 já tem' : `${n} já têm`
    case 'proprio': return 'é você'
    case 'nao_membro': return n === 1 ? '1 não entrou no Club' : `${n} não entraram no Club`
    case 'ambiguo': return `${n} com @ repetido`
    default: return `${n} sem conta`
  }
}

export default function OrganizarAlbumClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [carga, setCarga] = useState<Carga>({ fase: 'lendo' })
  // A edição escolhida no seletor. Nula = a Base.
  const [slug, setSlug] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const ler = useCallback(async (): Promise<Carga> => {
    const papeis = await meusPapeis()
    if (!papeis.includes('colecao')) return { fase: 'sem_papel' }
    const r = await carregarPainelOrg(slug)
    return r.ok ? { fase: 'ok', painel: r.d } : { fase: 'falhou' }
  }, [slug])

  useEffect(() => {
    if (!uid) return
    let vivo = true
    ler().then(c => { if (vivo) setCarga(c) })
    return () => { vivo = false }
  }, [uid, ler])

  // Depois de conceder ou desfazer: lê só o painel de novo, sem apagar a tela. Se a leitura falhar, fica o que estava.
  const recarregar = useCallback(() => { carregarPainelOrg(slug).then(r => { if (r.ok) setCarga({ fase: 'ok', painel: r.d }) }) }, [slug])
  const tentarDeNovo = () => { setCarga({ fase: 'lendo' }); ler().then(setCarga) }

  const entrar = () => openLogin({ next: ALBUM_ORGANIZAR, cta: 'Entrar no Club' })
  const casca = (filhos: ReactNode, logado = true) => (
    <Casca logado={logado} onEntrar={entrar} voltar={ALBUM} rotuloVoltar="Álbum" titulo="Organizar álbum">
      <div className="oa-col">{filhos}</div>
      <style>{OA_CSS}</style>
    </Casca>
  )

  if (uid === undefined) return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>, false)
  if (uid === null) {
    return casca(
      <div className="as-center">
        <h1 className="as-h2">Organizar o álbum</h1>
        <p className="as-p">Entre com a sua conta da Bynx.</p>
        <button type="button" className="as-btn pri" style={{ maxWidth: 320, width: '100%' }} onClick={entrar}>Entrar</button>
      </div>,
      false,
    )
  }
  if (carga.fase === 'lendo') return casca(<div className="as-center"><span className="as-meta">Abrindo...</span></div>)
  if (carga.fase === 'sem_papel') {
    return casca(<>
      <h1 className="as-h2">Organizar o álbum</h1>
      <div className="as-note">Só a organização do álbum pode conceder cartas. Se você organiza, peça para incluírem a sua conta.</div>
      <Link href={ALBUM} className="as-btn">Ver o álbum</Link>
    </>)
  }
  if (carga.fase === 'falhou') {
    return casca(<>
      <div className="as-erro" role="alert">Não conseguimos abrir a área de organização.</div>
      <button type="button" className="as-btn" onClick={tentarDeNovo}>Tentar de novo</button>
    </>)
  }
  if (!carga.painel) {
    return casca(<>
      <h1 className="as-h2">Organizar o álbum</h1>
      <div className="as-note">Ainda não existe uma edição do álbum.</div>
    </>)
  }
  return casca(<PainelOrganizar key={carga.painel.edicao.slug} painel={carga.painel} onMudou={recarregar} onTrocar={setSlug} />)
}

/** O que a fase da edição muda para quem organiza. */
function notaDaFase(ed: EdicaoOrg): { texto: string; trava: boolean } | null {
  switch (ed.fase) {
    case 'rascunho':
      return { texto: 'Esta edição ainda é um rascunho: os membros não veem o álbum. As cartas concedidas agora ficam guardadas e aparecem quando a edição abrir.', trava: false }
    case 'agendada':
      return { texto: `Esta edição abre em ${dataBr(ed.abre_em)}. Os membros veem o álbum a partir dessa data.`, trava: false }
    case 'so_pedidos':
    case 'prazo_encerrado':
      return { texto: `O prazo para ganhar cartas acabou em ${dataBr(ed.fecha_em)}. A organização ainda pode conceder cartas até a edição ser encerrada.`, trava: false }
    case 'encerrada':
      return { texto: 'Esta edição está encerrada: não dá mais para conceder cartas.', trava: true }
    default:
      return null
  }
}

const chipDaFase = (ed: EdicaoOrg) => (ed.fase === 'aberta' ? 'ok' : ed.fase === 'encerrada' ? '' : 'wait')

function PainelOrganizar({ painel, onMudou, onTrocar }: { painel: PainelOrg; onMudou: () => void; onTrocar: (slug: string) => void }) {
  const { edicao: ed, cartas, lotes, edicoes } = painel
  // Cada mensagem aparece perto do botão que a causou, e só a da ação mais recente fica na tela.
  const [ultimo, setUltimo] = useState<'conceder' | 'desfazer' | null>(null)
  const nota = notaDaFase(ed)
  return (
    <>
      <h1 className="as-h2">Organizar o álbum</h1>
      {edicoes.length > 1 && (
        <div className="as-f">
          <label className="as-lb" htmlFor="oa-edicao">Edição</label>
          <select id="oa-edicao" className="as-in" value={ed.slug} onChange={e => onTrocar(e.target.value)}>
            {edicoes.map(e => <option key={e.slug} value={e.slug}>{e.papel === 'base' ? 'Base' : e.titulo} · {e.manuais === 0 ? 'sem carta conferida' : e.manuais === 1 ? '1 carta conferida' : `${e.manuais} cartas conferidas`}</option>)}
          </select>
        </div>
      )}
      <div className="oa-ed">
        <span className={`as-chip ${chipDaFase(ed)}`}>{FASES[ed.fase]}</span>
        <span className="as-meta">Edição {ed.edicao}, {ed.titulo}</span>
      </div>
      {nota && <div className="as-note" role="status">{nota.texto}</div>}
      {!nota?.trava && <FormConceder ed={ed} cartas={cartas} onMudou={onMudou} mostrarResultado={ultimo === 'conceder'} onAcao={() => setUltimo('conceder')} />}
      <Lotes cartas={cartas} lotes={lotes} onMudou={onMudou} mostrarAviso={ultimo === 'desfazer'} onAcao={() => setUltimo('desfazer')} />
      <AmostraPortfolio />
    </>
  )
}

function FormConceder({ ed, cartas, onMudou, mostrarResultado, onAcao }: {
  ed: EdicaoOrg; cartas: CartaManual[]; onMudou: () => void; mostrarResultado: boolean; onAcao: () => void
}) {
  const [numero, setNumero] = useState<number>(cartas[0]?.numero ?? 0)
  const [texto, setTexto] = useState('')
  const [nota, setNota] = useState('')
  const [previa, setPrevia] = useState<PreviaOrg | null>(null)
  const [resultado, setResultado] = useState<ResultadoOrg | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const tokens = useMemo(() => separarTokens(texto), [texto])
  const muitos = tokens.length > MAX_NOMES_ORG
  const carta = cartas.find(c => c.numero === numero)

  // Mexeu em qualquer coisa: a prévia e o resultado antigos não valem mais.
  const mudar = (fn: () => void) => { fn(); setPrevia(null); setResultado(null); setErro('') }

  async function ver() {
    setOcupado(true); setErro(''); setResultado(null)
    const r = await previaOrg(ed.slug, numero, tokens)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    setPrevia(r.d)
  }

  async function conceder() {
    if (!previa) return
    setOcupado(true); setErro('')
    const r = await concederOrg(ed.slug, numero, tokens, nota)
    setOcupado(false)
    if (!r.ok) { setErro(r.msg); return }
    setResultado(r.d)
    setPrevia(null)
    // O que não deu para achar fica na caixa para tentar de novo; o que foi concedido sai.
    setTexto([...r.d.nao_membros.map(x => x.token), ...r.d.nao_encontrados, ...r.d.ambiguos].join('\n'))
    if (r.d.lote) setNota('')
    onAcao()
    onMudou()
  }

  if (cartas.length === 0) {
    return <div className="as-note">Esta edição não tem cartas de missão conferida pela organização.</div>
  }

  const sobra = resultado ? resultado.nao_membros.length + resultado.nao_encontrados.length + resultado.ambiguos.length : 0

  return (
    <section className="as-card oa-form" aria-label="Conceder carta">
      <h2 className="as-h3">Conceder carta</h2>
      <label className="as-f">
        <span className="as-lb">Carta</span>
        <select className="as-in" value={numero} onChange={e => mudar(() => setNumero(Number(e.target.value)))}>
          {cartas.map(c => <option key={c.numero} value={c.numero}>{nn(c.numero)} · {c.missao_titulo || MISSOES[c.missao]?.titulo || 'Carta'}</option>)}
        </select>
        {carta && <span className="as-meta" style={{ marginTop: 6 }}>{carta.como_ganhar}</span>}
      </label>
      <label className="as-f">
        <span className="as-lb">Quem recebe</span>
        <textarea className="as-in ta" style={{ minHeight: 120 }} value={texto} placeholder={'@exemplo.um\nexemplo.dois@email.com'}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e => mudar(() => setTexto(e.target.value))} />
        <span className={`as-meta${muitos ? ' oa-mx' : ''}`} style={{ marginTop: 6 }}>
          {plural(tokens.length, 'nome', 'nomes')} (até {MAX_NOMES_ORG} por vez). Use o @ do Instagram ou o e-mail da conta, um por linha.
        </span>
      </label>
      <label className="as-f">
        <span className="as-lb">Anotação do lote (opcional)</span>
        <input className="as-in" value={nota} maxLength={200} placeholder="Ex.: live de 25/11" onChange={e => setNota(e.target.value)} />
      </label>

      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <div className="oa-acoes">
        <button type="button" className="as-btn pri" disabled={ocupado || tokens.length === 0 || muitos} onClick={ver}>
          {ocupado && !previa ? 'Conferindo...' : 'Ver prévia'}
        </button>
        <span className="as-meta">A prévia não grava nada.</span>
      </div>

      {previa && (
        <div className="oa-previa">
          <h3 className="as-h3">Prévia: nada foi gravado ainda</h3>
          <div className="as-chips">
            {ORDEM.filter(k => previa.totais[k] > 0).map(k => (
              <span key={k} className={`as-chip ${k === 'recebe' ? 'ok' : k === 'sem_conta' ? 'oa-red' : k === 'ja_tem' ? '' : 'wait'}`}>{rotuloChip(k, previa.totais[k])}</span>
            ))}
          </div>
          <div>
            {previa.linhas.map((l, i) => (
              <div key={`${l.token}-${i}`} className="oa-lin">
                <div className="tx">
                  <b>{l.token.includes('@') ? l.token : `@${l.token}`}</b>
                  <small>{l.nome ? `${l.nome}${l.instagram ? ` · @${l.instagram}` : ''}` : DICA[l.estado]}{l.nome && DICA[l.estado] ? ` · ${DICA[l.estado]}` : ''}</small>
                </div>
                <span className={`oa-est ${l.estado}`}>{ROTULO[l.estado]}</span>
              </div>
            ))}
          </div>
          <div className="oa-acoes">
            <button type="button" className="as-btn pri" disabled={ocupado || previa.totais.recebe === 0} onClick={conceder}>
              {ocupado ? 'Concedendo...' : previa.totais.recebe === 0 ? 'Ninguém para receber' : `Conceder a ${plural(previa.totais.recebe, 'conta', 'contas')}`}
            </button>
            <button type="button" className="as-btn" disabled={ocupado} onClick={() => setPrevia(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {mostrarResultado && resultado && (
        <div className="as-note strong" role="status">
          {resultado.lote
            ? <><strong>Lote registrado.</strong> {plural(resultado.pessoas, 'conta', 'contas')}: {plural(resultado.novas, 'carta nova', 'cartas novas')}{resultado.reativadas > 0 ? `, ${plural(resultado.reativadas, 'devolvida', 'devolvidas')}` : ''}{resultado.ja_tinham > 0 ? `, ${resultado.ja_tinham === 1 ? '1 que já tinha' : `${resultado.ja_tinham} que já tinham`}` : ''}. Para desfazer, use a lista de lotes abaixo.</>
            : <>Nada mudou: ninguém precisava dessa carta{resultado.pessoas === 0 ? ' (nenhuma conta encontrada)' : ''}.</>}
          {resultado.proprio_ignorado && ' A sua própria conta ficou de fora.'}
          {sobra > 0 && ' O que não deu para achar ficou na caixa para tentar de novo.'}
        </div>
      )}
    </section>
  )
}

function tituloLote(l: LoteOrg, cartas: CartaManual[]): string {
  const nums = l.numeros ?? []
  if (nums.length === 1) {
    const c = cartas.find(x => x.numero === nums[0])
    return `Carta ${nn(nums[0])}${c ? ` · ${c.missao_titulo || MISSOES[c.missao]?.titulo || ''}` : ''}`.trim()
  }
  return nums.length ? `Cartas ${nums.map(nn).join(', ')}` : 'Lote'
}

function Lotes({ cartas, lotes, onMudou, mostrarAviso, onAcao }: {
  cartas: CartaManual[]; lotes: LoteOrg[]; onMudou: () => void; mostrarAviso: boolean; onAcao: () => void
}) {
  const [alvo, setAlvo] = useState<LoteOrg | null>(null)
  const [aviso, setAviso] = useState('')
  const fechar = useCallback(() => setAlvo(null), [])
  return (
    <section className="as-card" aria-label="Meus lotes">
      <h2 className="as-h3">Meus lotes</h2>
      <p className="as-meta">Só aparecem os lotes que você concedeu nesta edição. Desfazer vale para o lote inteiro.</p>
      {mostrarAviso && aviso && <div className="as-note strong" role="status">{aviso}</div>}
      {lotes.length === 0
        ? <p className="as-meta">Você ainda não concedeu nenhuma carta.</p>
        : lotes.map(l => (
          <div key={l.lote} className="oa-lin">
            <div className="tx">
              <b>{tituloLote(l, cartas)}</b>
              <small>{[dataHoraCurta(l.quando), plural(l.pessoas ?? 0, 'conta', 'contas'), l.nota ? `"${l.nota}"` : ''].filter(Boolean).join(' · ')}</small>
            </div>
            {l.ativas > 0
              ? <button type="button" className="as-btn sm" onClick={() => setAlvo(l)}>Desfazer</button>
              : <span className="oa-est">Desfeito</span>}
          </div>
        ))}
      {alvo && <FolhaDesfazer lote={alvo} titulo={tituloLote(alvo, cartas)} onFechar={fechar} onFeito={msg => { setAlvo(null); setAviso(msg); onAcao(); onMudou() }} />}
    </section>
  )
}

function FolhaDesfazer({ lote, titulo, onFechar, onFeito }: { lote: LoteOrg; titulo: string; onFechar: () => void; onFeito: (msg: string) => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function desfazer() {
    setOcupado(true); setErro('')
    const r = await desfazerLoteOrg(lote.lote)
    if (!r.ok) { setOcupado(false); setErro(r.msg); return }
    const x = r.d
    const presos = x.bloqueadas_por_retirada
    onFeito(`Lote desfeito: ${plural(x.revogadas, 'carta', 'cartas')} de ${plural(x.pessoas, 'conta', 'contas')}.${presos > 0 ? ` ${presos === 1 ? '1 conta ficou' : `${presos} contas ficaram`} com a carta porque já pediram o set.` : ''}`)
  }

  return (
    <Folha titulo="Desfazer este lote?" eyebrow={titulo} onFechar={onFechar}>
      <p className="as-meta">As cartas voltam a ficar bloqueadas para quem as recebeu neste lote. Quem já pediu o set fica de fora.</p>
      {erro && <div className="as-erro" role="alert">{erro}</div>}
      <button type="button" className="as-btn pri" disabled={ocupado} onClick={desfazer}>{ocupado ? 'Desfazendo...' : 'Desfazer lote'}</button>
      <button type="button" className="as-btn" disabled={ocupado} onClick={onFechar}>Voltar</button>
    </Folha>
  )
}

const OA_CSS = `
.oa-col{width:100%;max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:12px;min-width:0}
.oa-ed{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.oa-form{gap:12px;padding:14px}
.oa-mx{color:var(--bx-red)}
.oa-acoes{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap}
.oa-acoes .as-btn{width:auto}
.oa-previa{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--bx-border)}
.oa-lin{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--bx-border)}
.oa-previa .oa-lin:first-of-type{border-top:0}
.oa-lin .tx{flex:1;min-width:0}
.oa-lin .tx b{display:block;font-size:14px;font-weight:700;overflow-wrap:anywhere}
.oa-lin .tx small{display:block;font-size:12.5px;color:var(--bx-text-3);line-height:1.35}
.oa-lin .as-btn{width:auto;flex:none}
.oa-est{flex:none;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;border:1px solid var(--bx-border-2);color:var(--bx-text-3);white-space:nowrap}
.oa-est.recebe{color:var(--bx-green);border-color:rgba(34,197,94,.35)}
.oa-est.proprio,.oa-est.nao_membro,.oa-est.ambiguo{color:var(--ac-1);border-color:rgba(var(--ac-1-rgb),.35)}
.oa-est.sem_conta{color:var(--bx-red);border-color:rgba(239,68,68,.35)}
.as-chip.oa-red{color:var(--bx-red);border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.08)}
`
