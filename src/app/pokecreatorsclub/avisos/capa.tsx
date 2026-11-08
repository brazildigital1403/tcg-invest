'use client'

// Capa do aviso na "Revista do Club" (09/11/2026, mockup aprovado): a primeira
// imagem do aviso, ou uma capa automatica por categoria quando nao tem foto.
// A capa automatica so usa tokens da marca + logo e selos do Club: nenhuma
// cor nova, nenhum emoji.

import Image from 'next/image'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { categoriaDe, palavraCapa, type Aviso } from '@/lib/pcc/avisos'
import { horaCurta, parseDia, diasAte, isoDia, type Evento } from '@/lib/pcc/agenda'
import { hojeBrasilia, MESES_CURTOS } from '@/lib/pcc/datas'
import { agendaEvento, AGENDA } from '@/lib/pcc/rotas'
import { proximos } from '../agenda/comum'
import { Ico, LOGO_PCC, SELOS } from '../amigo-secreto/estilo'
import { urlImagem } from './comum'

type CapaProps = { a: Pick<Aviso, 'titulo' | 'categoria' | 'imagens'>; sizes: string; prioridade?: boolean; enquadrar?: boolean }

/** Preenche o pai (que define altura/proporcao). enquadrar: mostra a arte inteira sobre fundo desfocado. */
export function CapaAviso({ a, sizes, prioridade, enquadrar }: CapaProps) {
  const img = a.imagens[0]
  if (img) {
    if (enquadrar) {
      return (
        <span className="av-capa av-poster">
          <Image src={urlImagem(img)} alt="" fill sizes={sizes} className="bg" aria-hidden="true" />
          <Image src={urlImagem(img)} alt="" fill sizes={sizes} className="fg" priority={prioridade} />
        </span>
      )
    }
    return <span className="av-capa"><Image src={urlImagem(img)} alt="" fill sizes={sizes} priority={prioridade} /></span>
  }
  return <CapaAuto a={a} />
}

export function CapaAuto({ a }: { a: Pick<Aviso, 'titulo' | 'categoria'> }) {
  const cat = categoriaDe(a)
  if (a.categoria === 'comunidade') {
    // Institucional: o logo do Club no centro, com dois selos nos cantos.
    return (
      <span className="av-capa av-auto av-auto-com" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SELOS.aniversariantes} alt="" className="sl a" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SELOS['amigo-secreto']} alt="" className="sl b" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_PCC} alt="" className="logo" />
      </span>
    )
  }
  return (
    <span className={`av-capa av-auto av-auto-${a.categoria}`} aria-hidden="true">
      {a.categoria === 'evento' && SELOS.agenda
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={SELOS.agenda} alt="" className="selo" />
        : <span className="big"><Ico n={cat.ico} s={150} /></span>}
      <span className="word"><small>{cat.rotulo}</small>{palavraCapa(a)}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_PCC} alt="" className="pcc" />
    </span>
  )
}

/** Proximos eventos da Agenda (ate 60 dias). Vazio enquanto carrega ou se falhar: a fileira some. */
export function useVemAi(ativo: boolean, limite = 6): Evento[] | null {
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  useEffect(() => {
    if (!ativo) return
    let vivo = true
    const hoje = hojeBrasilia()
    const ate = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 60)).toISOString().slice(0, 10)
    supabase.rpc('club_agenda_lista', { p_de: isoDia(hoje), p_ate: ate }).then(({ data, error }) => {
      if (!vivo) return
      if (error || !data) { setEventos([]); return }
      setEventos(proximos((data as { eventos: Evento[] }).eventos, hoje).slice(0, limite))
    })
    return () => { vivo = false }
  }, [ativo, limite])
  return eventos
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Fileira "Vem ai": data grande, quando, titulo. O mais proximo em ambar; evento do Club em vermelho. */
export function VemAi({ eventos, titulo = 'Vem aí' }: { eventos: Evento[] | null; titulo?: string }) {
  if (!eventos || eventos.length === 0) return null
  const hoje = hojeBrasilia()
  return (
    <section className="av-vem" aria-label={titulo}>
      <div className="av-sec">
        <div><h2>{titulo}</h2><p className="sub">Próximos na Agenda do Club</p></div>
        <Link href={AGENDA}>Ver agenda</Link>
      </div>
      <div className="av-rail">
        {eventos.map((e, i) => {
          const d = parseDia(e.inicio_data)
          const em = diasAte(e.inicio_data, hoje)
          const sem = SEMANA[new Date(Date.UTC(d.ano, d.mes - 1, d.dia)).getUTCDay()]
          const quando = em <= 0 ? 'Hoje' : em === 1 ? 'Amanhã' : null
          return (
            <Link key={e.id} href={agendaEvento(e.slug)} className={`av-ev${i === 0 ? ' next' : ''}${e.tipo === 'club' && i > 0 ? ' big' : ''}`}>
              <span className="ico" aria-hidden="true"><Ico n={e.tipo === 'club' ? 'star' : e.tipo === 'live' ? 'video' : e.tipo === 'presencial' ? 'pin' : 'cal'} s={20} /></span>
              <span className="d">{String(d.dia).padStart(2, '0')}</span>
              <span className="dm">{MESES_CURTOS[d.mes - 1]} · {sem}</span>
              {quando && <span className="av-chip amber soon">{quando}</span>}
              <span className="t4">{e.titulo}</span>
              <span className="t"><Ico n="clock" s={14} />{e.hora_inicio ? horaCurta(e.hora_inicio) : 'Dia todo'}{e.status === 'adiado' ? ' · adiado' : ''}</span>
            </Link>
          )
        })}
        <Link href={AGENDA} className="av-ev all">
          <span className="ico" aria-hidden="true"><Ico n="cal" s={20} /></span>
          <span className="t4">Agenda completa</span>
          <span className="t">Ver agenda</span>
        </Link>
      </div>
    </section>
  )
}
