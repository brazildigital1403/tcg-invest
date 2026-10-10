'use client'

// Painel do motor da regua no /admin/regua, por template: gatilho, publico,
// contagem atual (seca: nao grava, nao envia) e, nos editoriais, o disparo
// com a edicao, o publico e a confirmacao dupla. Ver /api/admin/regua/disparo.

import { useCallback, useEffect, useState } from 'react'

type Contagem = {
  noSegmento: number
  elegiveis: number
  motivos: Record<string, number>
  fechado?: string | null
  incompleto?: boolean
  amostra?: { email: string; assunto: string }[]
  envio?: { simulados: number; enviados: number; falhas: number; aquecidas: number; aquecimentoFalhou: number; aquecimentoPulado: number } | null
} | null

type Info = {
  template: string
  modo: 'real' | 'simulacao'
  tipo: 'evento' | 'editorial' | 'leilao'
  gatilho: string
  publico: string
  bloqueio?: string
  /** Variante: sai no gatilho/disparo deste template (a contagem e a dele). */
  principal?: string
  edicao: Record<string, unknown> | null
  contagem: Contagem
  erro?: string
}

const ONDAS = ['E01', 'E11']

const MOTIVO: Record<string, string> = {
  conta_de_teste: 'Conta de teste',
  conta_suspensa: 'Conta suspensa',
  optout: 'Descadastrou',
  sem_token_descadastro: 'Sem link de descadastro',
  sem_marketing_aceito: 'Não aceitou novidades',
  pref_colecao_desligada: 'Desligou Coleção',
  pref_mercado_desligada: 'Desligou Mercado',
  pref_novidades_desligada: 'Desligou Novidades',
  pref_radar_desligada: 'Desligou Radar',
  sunset_sem_resposta: 'Saiu no sunset',
  em_winback: 'Em winback',
  ja_recebeu: 'Já recebeu',
  teto_semanal: 'Teto de 2 por semana',
  limite_diario: 'Limite diário',
  limite_semanal: 'Limite semanal',
}

function nomeMotivo(m: string): string {
  return MOTIVO[m] ?? m.replace(/_/g, ' ')
}

export default function MotorRegua({ id }: { id: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [edicao, setEdicao] = useState('')
  const [onda, setOnda] = useState<'' | '1' | '2' | '3'>('')
  const [modoPublico, setModoPublico] = useState<'segmento' | 'emails'>('segmento')
  const [emails, setEmails] = useState('')
  const [resultado, setResultado] = useState<(Contagem & { acao?: string; bloqueio?: string | null }) | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const r = await fetch(`/api/admin/regua/disparo?template=${encodeURIComponent(id)}`, { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok && !d?.template) throw new Error(d?.error || `Erro ${r.status}`)
      setInfo(d)
      if (d.erro) setErro(d.erro)
      setEdicao(d.edicao && Object.keys(d.edicao).length ? JSON.stringify(d.edicao, null, 2) : '')
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível contar.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function disparar(acao: 'simular' | 'enviar') {
    setErro(null)
    setResultado(null)
    let ed: Record<string, unknown> = {}
    if (edicao.trim()) {
      try { ed = JSON.parse(edicao) } catch { setErro('A edição não é um JSON válido.'); return }
    }
    const publico = modoPublico === 'emails'
      ? { tipo: 'emails', emails: emails.split(/[\s,;]+/).filter(Boolean) }
      : { tipo: 'segmento', ...(onda ? { onda: Number(onda) } : {}) }
    setOcupado(true)
    try {
      const r = await fetch('/api/admin/regua/disparo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: id, acao, edicao: ed, publico, ...(acao === 'enviar' ? { confirmacao: `ENVIAR ${id}` } : {}) }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || `Erro ${r.status}`)
      setResultado({ ...d, noSegmento: d.noSegmento, elegiveis: d.elegiveis })
    } catch (e) {
      setErro((e as Error).message || 'Falhou.')
    } finally {
      setOcupado(false)
      setConfirmando(false)
    }
  }

  const c = resultado ?? info?.contagem ?? null
  const editorial = info?.tipo === 'editorial' && !info?.principal
  const podeEnviar = editorial && info?.modo === 'real' && !info?.bloqueio

  return (
    <div className="mr-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <p className="mr-rotulo" style={{ margin: 0 }}>Motor · {info?.tipo === 'evento' ? 'Evento (cron)' : info?.tipo === 'editorial' ? 'Editorial (disparo)' : info?.tipo === 'leilao' ? 'Leilão' : '...'}</p>
        <span className={`mr-modo${info?.modo === 'real' ? ' real' : ''}`}>
          {info ? (info.modo === 'real' ? 'Régua ligada' : 'Simulação (REGUA_ATIVA desligada)') : ''}
        </span>
      </div>

      {info && (
        <dl className="mr-dl">
          <dt>Gatilho</dt><dd>{info.gatilho}</dd>
          <dt>Público</dt><dd>{info.publico}</dd>
          {info.principal && (<><dt>Variante</dt><dd>Sai junto com o {info.principal}: a contagem abaixo é a do {info.principal} (as duas versões juntas){info.tipo === 'editorial' ? ` e o disparo é feito no ${info.principal}` : ''}.</dd></>)}
          {info.bloqueio && (<><dt>Bloqueio</dt><dd className="mr-alerta">{info.bloqueio}</dd></>)}
        </dl>
      )}

      {carregando ? (
        <p className="mr-txt">Contando quem receberia hoje...</p>
      ) : c ? (
        <div className="mr-contagem">
          <div className="mr-nums">
            <div><span className="mr-num">{c.noSegmento}</span><span className="mr-legenda">no {info?.tipo === 'editorial' ? 'segmento' : 'gatilho'}</span></div>
            <div><span className="mr-num ac">{c.elegiveis}</span><span className="mr-legenda">{resultado?.acao === 'enviar' ? 'no disparo' : 'receberiam'}</span></div>
          </div>
          {c.fechado && <p className="mr-txt">Gatilho fechado hoje: {c.fechado.replace(/_/g, ' ')}. A contagem acima ignora o calendário.</p>}
          {c.incompleto && <p className="mr-alerta">O tempo da função acabou antes do fim. {resultado?.acao === 'enviar' ? 'Dispare de novo para continuar: quem já recebeu não recebe de novo.' : 'A contagem está parcial.'}</p>}
          {Object.keys(c.motivos || {}).length > 0 && (
            <table className="mr-tabela">
              <caption className="mr-rotulo" style={{ textAlign: 'left', paddingBottom: 6 }}>Fora, por motivo</caption>
              <tbody>
                {Object.entries(c.motivos).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
                  <tr key={m}><td>{nomeMotivo(m)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{n}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {c.amostra && c.amostra.length > 0 && (
            <div>
              <p className="mr-rotulo" style={{ margin: '12px 0 6px' }}>Assuntos montados</p>
              <ul className="mr-amostra">
                {c.amostra.map((x, i) => <li key={i}><span>{x.assunto}</span><span className="mr-legenda">{x.email}</span></li>)}
              </ul>
            </div>
          )}
          {resultado?.envio && (
            <p className="mr-txt">
              Enviados: {resultado.envio.enviados} · falhas: {resultado.envio.falhas}
              {resultado.envio.simulados ? ` · simulados: ${resultado.envio.simulados}` : ''}
              {' · '}CDN aquecida: {resultado.envio.aquecidas} ({resultado.envio.aquecimentoFalhou} falharam, {resultado.envio.aquecimentoPulado} sem tempo)
            </p>
          )}
        </div>
      ) : null}

      {erro && <p className="mr-alerta" role="alert">{erro}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="mr-btn" onClick={() => { setResultado(null); carregar() }} disabled={carregando || ocupado}>Recontar</button>
      </div>

      {editorial && info && (
        <div className="mr-disparo">
          <p className="mr-rotulo" style={{ margin: '0 0 8px' }}>Disparo</p>
          {edicao !== '' && (
            <label className="mr-campo">
              <span className="mr-legenda">Edição (JSON). Começa com o exemplo do template: troque pelo conteúdo real antes de disparar.</span>
              <textarea value={edicao} onChange={(e) => setEdicao(e.target.value)} rows={10} spellCheck={false} />
            </label>
          )}
          <div className="mr-linha">
            <label className="mr-campo" style={{ flex: 1, minWidth: 180 }}>
              <span className="mr-legenda">Público</span>
              <select value={modoPublico} onChange={(e) => setModoPublico(e.target.value as 'segmento' | 'emails')}>
                <option value="segmento">Segmento do template</option>
                <option value="emails">Lista de teste (e-mails)</option>
              </select>
            </label>
            {modoPublico === 'segmento' && ONDAS.includes(id) && (
              <label className="mr-campo" style={{ flex: 1, minWidth: 180 }}>
                <span className="mr-legenda">Onda</span>
                <select value={onda} onChange={(e) => setOnda(e.target.value as '' | '1' | '2' | '3')}>
                  <option value="">Todas</option>
                  <option value="1">1: acesso em até 30 dias</option>
                  <option value="2">2: de 31 a 90 dias</option>
                  <option value="3">3: o resto</option>
                </select>
              </label>
            )}
          </div>
          {modoPublico === 'emails' && (
            <label className="mr-campo">
              <span className="mr-legenda">E-mails de contas da Bynx (até 20). Fora do teto e do dedup.</span>
              <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={2} spellCheck={false} />
            </label>
          )}
          <div className="mr-linha" style={{ marginTop: 12 }}>
            <button type="button" className="mr-btn" disabled={ocupado} onClick={() => disparar('simular')}>
              {ocupado && !confirmando ? 'Simulando...' : 'Simular disparo'}
            </button>
            {!confirmando ? (
              <button type="button" className="mr-btn perigo" disabled={ocupado || !podeEnviar}
                title={!podeEnviar ? (info.bloqueio || 'A régua está desligada: só simulação.') : undefined}
                onClick={() => setConfirmando(true)}>
                Disparar
              </button>
            ) : (
              <div className="mr-confirma" role="group" aria-label="Confirmar disparo">
                <p className="mr-txt" style={{ margin: 0 }}>
                  Envio REAL do {id} para {modoPublico === 'emails' ? 'a lista de teste' : `${c?.elegiveis ?? '?'} pessoas (contagem da última simulação)`}. Não tem volta.
                </p>
                <div className="mr-linha">
                  <button type="button" className="mr-btn" disabled={ocupado} onClick={() => setConfirmando(false)}>Cancelar</button>
                  <button type="button" className="mr-btn perigo" disabled={ocupado} onClick={() => disparar('enviar')}>
                    {ocupado ? 'Disparando...' : `Sim, disparar o ${id} agora`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .mr-card { margin: 14px 0 4px; padding: 14px; border: 1px solid var(--bx-border); border-radius: 12px; background: var(--bx-surface-2); }
        .mr-rotulo { font-size: 11px; font-weight: 700; color: var(--bx-text-3); text-transform: uppercase; letter-spacing: 0.07em; }
        .mr-modo { font-size: 12px; font-weight: 700; color: var(--bx-text-2); }
        .mr-modo.real { color: var(--bx-red); }
        .mr-dl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px 12px; margin: 10px 0 0; font-size: 13px; line-height: 1.5; }
        @media (min-width: 640px) { .mr-dl { grid-template-columns: 90px minmax(0, 1fr); } }
        .mr-dl dt { color: var(--bx-text-3); font-weight: 700; }
        .mr-dl dd { margin: 0 0 6px; color: var(--bx-text); }
        .mr-txt { font-size: 13px; line-height: 1.5; color: var(--bx-text-2); margin: 10px 0 0; }
        .mr-alerta { font-size: 13px; line-height: 1.5; color: var(--bx-red); margin: 10px 0 0; }
        .mr-contagem { margin-top: 12px; }
        .mr-nums { display: flex; gap: 24px; flex-wrap: wrap; }
        .mr-nums > div { display: flex; flex-direction: column; }
        .mr-num { font-size: 26px; font-weight: 800; line-height: 1.1; color: var(--bx-text); }
        .mr-num.ac { color: var(--ac-1); }
        .mr-legenda { font-size: 12px; color: var(--bx-text-3); line-height: 1.4; }
        .mr-tabela { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
        .mr-tabela td { padding: 6px 0; border-top: 1px solid var(--bx-border); color: var(--bx-text-2); }
        .mr-amostra { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .mr-amostra li { display: flex; flex-direction: column; font-size: 13px; color: var(--bx-text); line-height: 1.4; overflow-wrap: anywhere; }
        .mr-disparo { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--bx-border); }
        .mr-campo { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
        .mr-campo textarea, .mr-campo select {
          width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--bx-border);
          background: var(--bx-surface); color: var(--bx-text); font-size: 13px; font-family: ui-monospace, Menlo, monospace;
        }
        .mr-campo select { font-family: inherit; min-height: 44px; }
        .mr-linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
        .mr-btn {
          display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 12px;
          border: 1px solid var(--bx-border-2); background: var(--bx-surface); color: var(--bx-text);
          font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s ease, border-color 0.15s ease;
        }
        .mr-btn:hover:not(:disabled) { border-color: var(--ac-1); }
        .mr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mr-btn.perigo { border-color: var(--bx-red); color: var(--bx-red); }
        .mr-btn:focus-visible, .mr-campo textarea:focus-visible, .mr-campo select:focus-visible { outline: 2px solid var(--ac-1); outline-offset: 2px; }
        .mr-confirma { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--bx-red); border-radius: 12px; width: 100%; }
        @media (prefers-reduced-motion: reduce) { .mr-btn { transition: none; } }
      `}</style>
    </div>
  )
}
