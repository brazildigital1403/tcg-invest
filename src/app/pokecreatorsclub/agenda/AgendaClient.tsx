'use client'

// Agenda do Club (wireframe aprovado em 08/11/2026, quadros E01 a E12 e D5).
// "Proximos" e a tela principal; o calendario fica em uma aba no celular e ao
// lado no computador, a mesma base dos Aniversariantes. So quem esta logado ve.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { useAuthModal } from '@/components/auth/AuthModalProvider'
import { MESES, hojeBrasilia, trocarMes, type MesAno } from '@/lib/pcc/datas'
import { TIPOS, diasAte, isoDia, linhaMeta, momento, type Evento, type ListaAgenda } from '@/lib/pcc/agenda'
import { AGENDA, AGENDA_ORGANIZAR, CLUB, agendaEvento } from '@/lib/pcc/rotas'
import { Ico } from '../amigo-secreto/estilo'
import { Abas, CalendarioMes, Folha, NavMes } from '../_comum/calendario'
import { Casca, ChipEstado, LinhaEvento, TipoQuad, proximos } from './comum'

const ROTA = AGENDA

// Janela lida do banco: do mes anterior ate 11 meses depois (13 meses, no
// maximo 397 dias; o banco aceita ate 400). Fora dela, busca de novo.
function janela(m: MesAno): { de: string; ate: string; ini: MesAno; fim: MesAno } {
  const ini = trocarMes(m, -1)
  const fim = trocarMes(m, 11)
  const ultimo = new Date(Date.UTC(fim.ano, fim.mes, 0)).getUTCDate()
  return { de: isoDia({ ...ini, dia: 1 }), ate: isoDia({ ...fim, dia: ultimo }), ini, fim }
}
const dentro = (m: MesAno, ini: MesAno, fim: MesAno) => {
  const v = m.ano * 12 + m.mes
  return v >= ini.ano * 12 + ini.mes && v <= fim.ano * 12 + fim.mes
}

export default function AgendaClient() {
  const { openLogin } = useAuthModal()
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [dados, setDados] = useState<ListaAgenda | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [aba, setAba] = useState<'proximos' | 'calendario'>('proximos')
  const [diaAberto, setDiaAberto] = useState<number | null>(null)
  const hoje = useMemo(() => hojeBrasilia(), [])
  const [mesVisto, setMesVisto] = useState<MesAno>({ ano: hoje.ano, mes: hoje.mes })
  const [lida, setLida] = useState<{ ini: MesAno; fim: MesAno } | null>(null)
  // "Proximos" usa sempre a janela que comeca hoje; so o calendario troca de
  // janela ao navegar para longe (revisao de 08/11: a lista perdia eventos).
  const [doCal, setDoCal] = useState<Evento[] | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user.id ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  const carregar = useCallback(async (centro: MesAno, soCalendario = false) => {
    setFalhou(false)
    const j = janela(centro)
    const { data, error } = await supabase.rpc('club_agenda_lista', { p_de: j.de, p_ate: j.ate })
    if (error) { setFalhou(true); return }
    const d = data as ListaAgenda
    if (!soCalendario) setDados(d)
    setDoCal(d.eventos)
    setLida({ ini: j.ini, fim: j.fim })
  }, [])

  useEffect(() => { if (uid) carregar({ ano: hoje.ano, mes: hoje.mes }) }, [uid, carregar, hoje])

  const irMes = (delta: number) => {
    const novo = trocarMes(mesVisto, delta)
    setMesVisto(novo)
    if (lida && !dentro(novo, lida.ini, lida.fim)) carregar(novo, true)
  }
  const fecharDia = useCallback(() => setDiaAberto(null), [])

  if (uid === undefined) return <Casca logado={false} onEntrar={() => {}} voltar={CLUB} titulo="Agenda"><div className="as-center"><span className="as-meta">Abrindo...</span></div></Casca>

  if (uid === null) {
    const entrar = () => openLogin({ next: ROTA, cta: 'Entrar no Club' })
    return (
      <Casca logado={false} onEntrar={entrar} voltar={CLUB} titulo="Agenda">
        <div className="as-center">
          <div className="as-verso tilt" aria-hidden="true"><Ico n="cal" s={28} /></div>
          <h1 className="as-h2">Agenda do Club</h1>
          <p className="as-p">Entre para ver a agenda.</p>
          <button type="button" className="as-btn pri cta" style={{ maxWidth: 320, width: '100%' }} onClick={entrar}>Entrar</button>
          <Link href={`/cadastro?next=${encodeURIComponent(ROTA)}`} className="as-btn" style={{ maxWidth: 320, width: '100%' }}>Criar conta</Link>
        </div>
      </Casca>
    )
  }

  if (falhou && !dados) {
    return (
      <Casca logado onEntrar={() => {}} voltar={CLUB} titulo="Agenda">
        <h1 className="as-h2">Agenda do Club</h1>
        <div className="as-erro" role="alert">Não conseguimos carregar a agenda.</div>
        <button type="button" className="as-btn" onClick={() => carregar(mesVisto)}>Tentar de novo</button>
      </Casca>
    )
  }

  if (!dados) return <Casca logado onEntrar={() => {}} voltar={CLUB} titulo="Agenda"><div className="as-center"><span className="as-meta">Abrindo a agenda...</span></div></Casca>

  const organiza = dados.papeis.includes('agenda')
  const lista = proximos(dados.eventos, hoje)
  const deHoje = lista.filter(e => e.status === 'publicado' && ['hoje', 'agora'].includes(momento(e, hoje)))
  const destaque = deHoje.length ? [] : lista.filter(e => e.status === 'publicado').slice(0, 1)
  const resto = lista.filter(e => !deHoje.includes(e) && !destaque.includes(e))
  const semana = resto.filter(e => diasAte(e.inicio_data, hoje) <= 7)
  const depois = resto.filter(e => diasAte(e.inicio_data, hoje) > 7)

  const iniMes = isoDia({ ...mesVisto, dia: 1 })
  const fimMes = isoDia({ ...mesVisto, dia: new Date(Date.UTC(mesVisto.ano, mesVisto.mes, 0)).getUTCDate() })
  const doMes = (doCal || dados.eventos).filter(e => e.inicio_data <= fimMes && e.fim_data >= iniMes)
  const noDia = (d: number) => {
    const iso = isoDia({ ...mesVisto, dia: d })
    return doMes.filter(e => e.inicio_data <= iso && e.fim_data >= iso)
  }

  const colProximos = (
    <div className={`pc-col${aba === 'proximos' ? ' on' : ''}`}>
      {deHoje.map(e => <CartaHoje key={e.id} e={e} />)}
      {destaque.map(e => (
        <Link key={e.id} href={agendaEvento(e.slug)} className="as-frente ag-hoje" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="ag-hoje-l"><TipoQuad e={e} /><span className="as-k">Próximo · {TIPOS[e.tipo].rotulo}</span></div>
          <div className="at">{e.titulo}</div>
          <div className="as-meta">{linhaMeta(e)}</div>
        </Link>
      ))}
      {lista.length === 0 && (
        <div className="ag-vazio"><span className="as-meta">Nenhum evento marcado.</span><span className="as-meta">Quando a organização marcar, aparece aqui.</span></div>
      )}
      {semana.length > 0 && <div className="as-k">Esta semana</div>}
      {semana.map(e => <LinhaEvento key={e.id} e={e} hoje={hoje} />)}
      {depois.length > 0 && <div className="as-k">Depois</div>}
      {depois.map(e => <LinhaEvento key={e.id} e={e} hoje={hoje} />)}
    </div>
  )

  const colCalendario = (
    <div className={`pc-col${aba === 'calendario' ? ' on' : ''}`}>
      <NavMes ano={mesVisto.ano} mes={mesVisto.mes} onTrocar={irMes} />
      <CalendarioMes ano={mesVisto.ano} mes={mesVisto.mes} hoje={hoje} itensDoDia={noDia} onDia={setDiaAberto}
        marca={evs => <TipoQuad e={evs[0]} tam={26} />}
        nome={evs => evs[0].titulo}
        classeDia={evs => (evs.every(e => e.status !== 'publicado' || momento(e, hoje) === 'passado') ? 'ap' : '')}
        rotulo={(d, evs) => `Dia ${d}: ${evs.map(e => e.titulo).join(', ')}`} />
      {doMes.length === 0
        ? <div className="ag-vazio"><span className="as-meta">Nenhum evento neste mês.</span></div>
        : <div className="as-mob-cal"><div className="as-k">Neste mês</div>{doMes.map(e => <LinhaEvento key={e.id} e={e} hoje={hoje} comChip />)}</div>}
    </div>
  )

  return (
    <Casca logado onEntrar={() => {}} voltar={CLUB} titulo="Agenda">
      <div className="ag-topo">
        <div>
          <h1 className="as-h2">Agenda do Club</h1>
          <p className="as-meta ag-sub">Lives, collabs, feiras e as datas do grupo, em um lugar só.</p>
        </div>
        {organiza && <Link href={AGENDA_ORGANIZAR} className="as-btn sm">Organizar</Link>}
      </div>
      <Abas valor={aba} onTrocar={setAba} opcoes={[{ id: 'proximos', rotulo: 'Próximos' }, { id: 'calendario', rotulo: 'Calendário' }]} />
      <div className="pc-grade">{colCalendario}{colProximos}</div>

      {diaAberto !== null && (
        <Folha titulo={`${diaAberto} de ${MESES[mesVisto.mes - 1].toLowerCase()}`} onFechar={fecharDia}>
          {noDia(diaAberto).map(e => <LinhaEvento key={e.id} e={e} hoje={hoje} comChip />)}
          <button type="button" className="as-btn" onClick={fecharDia}>Fechar</button>
        </Folha>
      )}
    </Casca>
  )
}

function CartaHoje({ e }: { e: Evento }) {
  const hoje = hojeBrasilia()
  return (
    <section className="as-frente ag-hoje">
      <div className="ag-hoje-l"><ChipEstado e={e} hoje={hoje} /><span className="as-meta">{TIPOS[e.tipo].rotulo} · {linhaMeta(e)}</span></div>
      <div className="at">{e.titulo}</div>
      <Link href={agendaEvento(e.slug)} className="as-btn pri" style={{ width: '100%' }}>Ver evento</Link>
    </section>
  )
}
