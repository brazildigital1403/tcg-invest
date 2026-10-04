'use client'

// Endereco editavel em Minha Conta (Quadro #24). O cadastro ja coletava, mas
// depois ninguem via nem mudava -- e 45% da base (205 de 458 em 02/10/2026)
// estava sem CEP, o que derruba a cotacao de frete da venda e da volta dos
// servicos. O CEP preenche rua, bairro, cidade e UF pelo ViaCEP. Salva por
// /api/conta/endereco (a tabela users nao concede UPDATE dessas colunas).

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/authFetch'
import { IconLocation, IconCheck, IconWarning } from '@/components/ui/Icons'

export interface Endereco {
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; city: string; uf: string
}

const mascaraCep = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export default function EnderecoCard({ inicial, onSalvo }: { inicial: Endereco; onSalvo?: (e: Endereco) => void }) {
  const [e, setE] = useState<Endereco>({ ...inicial, cep: mascaraCep(inicial.cep || '') })
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; t: string } | null>(null)
  const semCep = (inicial.cep || '').replace(/\D/g, '').length !== 8
  const set = (k: keyof Endereco, v: string) => { setE(x => ({ ...x, [k]: v })); setMsg(null) }
  // O link do e-mail e do sino chega com #endereco, mas a pagina carrega os
  // dados depois: o salto nativo do navegador acontece antes deste card existir.
  useEffect(() => {
    if (window.location.hash === '#endereco') document.getElementById('endereco')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  async function buscarCep(valor: string) {
    const d = valor.replace(/\D/g, '')
    if (d.length !== 8) return
    setBuscando(true)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (j.erro) { setMsg({ tipo: 'erro', t: 'CEP não encontrado. Confira o número.' }); return }
      setE(x => ({
        ...x,
        logradouro: j.logradouro || x.logradouro,
        bairro: j.bairro || x.bairro,
        city: j.localidade || x.city,
        uf: j.uf || x.uf,
      }))
    } catch {
      setMsg({ tipo: 'erro', t: 'Não foi possível buscar o CEP agora. Preencha à mão.' })
    } finally {
      setBuscando(false)
    }
  }

  async function salvar() {
    setSalvando(true); setMsg(null)
    try {
      const r = await authFetch('/api/conta/endereco', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg({ tipo: 'erro', t: d.error || 'Não foi possível salvar.' }); return }
      const salvo = { ...e, ...d.endereco, complemento: d.endereco?.complemento || '' }
      setE(salvo)
      onSalvo?.(salvo)
      setMsg({ tipo: 'ok', t: 'Endereço salvo.' })
    } catch {
      setMsg({ tipo: 'erro', t: 'Sem conexão. Tente de novo.' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section id="endereco" className="ec">
      <style>{CSS}</style>
      <p className="ec-t"><IconLocation size={13} /> Endereço</p>
      <p className="ec-sub">
        É por ele que calculamos o frete das suas compras e a volta das cartas que você manda para a bancada. Não aparece no seu perfil público.
      </p>
      {semCep && (
        <p className="ec-aviso"><IconWarning size={15} /> Falta o seu CEP. Sem ele, o frete só sai no orçamento.</p>
      )}
      <div className="ec-g">
        <label className="ec-f ec-cep">
          <span>CEP</span>
          <input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" value={e.cep}
            onChange={ev => { const v = mascaraCep(ev.target.value); set('cep', v); if (v.replace(/\D/g, '').length === 8) buscarCep(v) }} />
          {buscando && <small>Buscando...</small>}
        </label>
        <label className="ec-f ec-rua">
          <span>Rua</span>
          <input autoComplete="address-line1" value={e.logradouro} onChange={ev => set('logradouro', ev.target.value)} />
        </label>
        <label className="ec-f ec-num">
          <span>Número</span>
          <input autoComplete="address-line2" value={e.numero} onChange={ev => set('numero', ev.target.value)} placeholder="ou s/n" />
        </label>
        <label className="ec-f ec-comp">
          <span>Complemento <em>opcional</em></span>
          <input value={e.complemento} onChange={ev => set('complemento', ev.target.value)} placeholder="Apto, bloco, casa" />
        </label>
        <label className="ec-f ec-bairro">
          <span>Bairro</span>
          <input value={e.bairro} onChange={ev => set('bairro', ev.target.value)} />
        </label>
        <label className="ec-f ec-cid">
          <span>Cidade</span>
          <input autoComplete="address-level2" value={e.city} onChange={ev => set('city', ev.target.value)} />
        </label>
        <label className="ec-f ec-uf">
          <span>UF</span>
          <input autoComplete="address-level1" maxLength={2} value={e.uf} onChange={ev => set('uf', ev.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
        </label>
      </div>
      <div className="ec-acoes">
        {msg && (
          <p className={`ec-msg ec-msg-${msg.tipo}`} role={msg.tipo === 'erro' ? 'alert' : 'status'}>
            {msg.tipo === 'ok' ? <IconCheck size={14} /> : <IconWarning size={14} />} {msg.t}
          </p>
        )}
        <button type="button" className="ec-bt" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar endereço'}</button>
      </div>
    </section>
  )
}

const CSS = `
.ec{background:var(--bx-surface);border:1px solid var(--bx-border);border-radius:16px;padding:20px;display:grid;gap:14px}
.ec-t{display:flex;align-items:center;gap:6px;margin:0;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--bx-text-2)}
.ec-sub{margin:-6px 0 0;font-size:13px;line-height:1.5;color:var(--bx-text-3)}
.ec-aviso{display:flex;align-items:center;gap:8px;margin:0;padding:10px 12px;border-radius:10px;font-size:13px;color:var(--bx-text);background:rgba(var(--ac-1-rgb),.08);border:1px solid rgba(var(--ac-1-rgb),.35)}
.ec-aviso svg{color:var(--ac-1);flex:none}
.ec-g{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.ec-f{display:grid;gap:6px;min-width:0}
.ec-f span{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--bx-text-3)}
.ec-f em{font-style:normal;text-transform:none;letter-spacing:0;color:var(--bx-text-3);opacity:.7}
.ec-f input{width:100%;min-height:44px;padding:10px 14px;border-radius:10px;border:1px solid var(--bx-border-2);background:var(--bx-surface-2);color:var(--bx-text);font:inherit;font-size:14px;transition:border-color .15s ease}
.ec-f input:focus{outline:none;border-color:rgba(var(--ac-1-rgb),.55)}
.ec-f small{font-size:12px;color:var(--bx-text-3)}
.ec-cep{grid-column:span 2}.ec-rua{grid-column:span 4}.ec-num{grid-column:span 2}.ec-comp{grid-column:span 4}
.ec-bairro{grid-column:span 2}.ec-cid{grid-column:span 3}.ec-uf{grid-column:span 1}
.ec-acoes{display:flex;justify-content:flex-end;align-items:center;gap:12px;flex-wrap:wrap}
.ec-msg{display:flex;align-items:center;gap:6px;margin:0 auto 0 0;font-size:13px}
.ec-msg-ok{color:var(--bx-green)}.ec-msg-erro{color:var(--bx-red)}
.ec-bt{min-height:44px;padding:0 24px;border:0;border-radius:10px;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-weight:700;font-size:14px;cursor:pointer;transition:opacity .15s ease}
.ec-bt:disabled{opacity:.6;cursor:default}
@media (max-width:640px){
  .ec{padding:16px}
  .ec-g{grid-template-columns:repeat(4,minmax(0,1fr))}
  .ec-cep{grid-column:span 2}.ec-rua{grid-column:span 4}.ec-num{grid-column:span 2}.ec-comp{grid-column:span 4}
  .ec-bairro{grid-column:span 4}.ec-cid{grid-column:span 3}.ec-uf{grid-column:span 1}
  .ec-bt{width:100%}
}
`
