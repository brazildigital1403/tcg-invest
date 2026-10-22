'use client'

// Guia de envio do pedido de servico (/servico/[id]/guia): uma folha A4, no
// mesmo padrao do relatorio da bancada (faixa escura com o logo, listra de
// acento, papel claro), com o passo a passo de embalagem e a etiqueta de
// recortar ja preenchida. Primeiro guia feito a mao para o #S-0006 (22/10/2026);
// esta pagina gera o mesmo documento para qualquer pedido.
//
// O dado vem do mesmo GET do /servico/[id] (dono pelo token): o endereco da
// Bynx so chega com o pedido aceito e o sinal pago, entao o guia so monta nesse
// momento. A etiqueta vai do lado de FORA do pacote: nada nela diz o que tem
// dentro (pedido do Du, 22/10/2026). O remetente sai do proprio cadastro; sem endereco no cadastro, a
// etiqueta fica com linhas para preencher a mao.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/authFetch'
import { supabase } from '@/lib/supabaseClient'
import { SERVICOS, numeroServico, brl } from '@/lib/servicos'
import { IconChevronLeft, IconWarning } from '@/components/ui/Icons'

type Pagamento = { etapa: string; valor_cents: number; pago_em: string | null }
type Dados = {
  solicitacao: { id: string; numero: number; servico: string; status: string; valor_declarado_cents: number | null }
  itens: { id: string; aceito: boolean | null; valor_declarado_cents: number | null }[]
  endereco: string | null
  pagamentos: Pagamento[]
}
type Remetente = { nome: string; linha1: string; linha2: string } | null

const dataBRT = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })

export default function GuiaEnvio({ id }: { id: string }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [remetente, setRemetente] = useState<Remetente>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    try {
      const r = await authFetch(`/api/servicos/${id}`, { cache: 'no-store' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(r.status === 401 ? 'Entre na sua conta para ver o guia de envio.' : d.error || 'Não deu para abrir o guia.'); return }
      setDados(d as Dados)
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user.id
      if (uid) {
        const { data: u } = await supabase.from('users').select('name, logradouro, numero, complemento, bairro, city, uf, cep').eq('id', uid).maybeSingle()
        if (u?.name && u.logradouro && u.cep) {
          setRemetente({
            nome: u.name,
            linha1: [`${u.logradouro}, ${u.numero || 's/n'}`, u.complemento, u.bairro].filter(Boolean).join(' · '),
            linha2: `${[u.city, u.uf].filter(Boolean).join('/')} · CEP ${u.cep}`,
          })
        }
      }
    } catch {
      setErro('Sem conexão com o servidor.')
    }
  }, [id])

  useEffect(() => {
    let vivo = true
    Promise.resolve().then(() => { if (vivo) carregar() })
    return () => { vivo = false }
  }, [carregar])

  const s = dados?.solicitacao
  const pronto = !!dados?.endereco
  let aviso = ''
  if (dados && !pronto) {
    aviso = s?.status === 'aceito'
      ? 'O guia fica pronto assim que o sinal é confirmado: é ele que libera o endereço de envio.'
      : 'Este pedido não está na etapa de envio da carta.'
  }

  return (
    <div className="gv-raiz">
      <style>{CSS}</style>
      <div className="gv-tela" data-theme="light">
        <div className="gv-barra">
          <Link href={`/servico/${id}`} className="gv-voltar"><IconChevronLeft size={16} /> Voltar ao pedido</Link>
          {pronto && (
            <>
              <button type="button" className="gv-bt" onClick={() => window.print()}>Imprimir / Salvar PDF</button>
              <p className="gv-instrucao">No celular: toque em <b>Compartilhar</b> e depois em <b>Imprimir</b> para salvar em PDF. No computador: papel <b>A4</b>, margens <b>Nenhuma</b> e <b>Gráficos de plano de fundo</b> ligado.</p>
            </>
          )}
        </div>
        {(erro || aviso) && <p className="gv-erro"><IconWarning size={15} /> {erro || aviso}</p>}
        {!dados && !erro && <p className="gv-carregando">Carregando o guia...</p>}
        {dados && pronto && s && <Folha dados={dados} remetente={remetente} />}
      </div>
    </div>
  )
}

function Folha({ dados, remetente }: { dados: Dados; remetente: Remetente }) {
  const s = dados.solicitacao
  const num = numeroServico(s.numero)
  const aceitos = dados.itens.filter(i => i.aceito !== false)
  const cartas = aceitos.length || dados.itens.length
  const declarado = aceitos.reduce((t, i) => t + (i.valor_declarado_cents || 0), 0) || s.valor_declarado_cents || 0
  const valor = `R$ ${brl(declarado / 100)}`
  const nomeServico = SERVICOS.find(x => x.id === s.servico)?.nome || 'Serviço de bancada'
  const sinal = dados.pagamentos.find(p => (p.etapa === 'sinal' || p.etapa === 'integral') && p.pago_em)
  const [destNome, ...destLinhas] = (dados.endereco || '').split('\n').map(l => l.trim()).filter(Boolean)
  // O endereco vem em varias linhas (rua, bairro, cidade, CEP); na etiqueta
  // cabem duas: a rua e o resto junto. A linha "Pedido" ja esta ao lado.
  const linhasEnd = destLinhas.filter(l => !/^pedido\b/i.test(l)).map(l => l.replace(/^bairro\s+/i, ''))
  const destEnd = linhasEnd.length > 2 ? [linhasEnd[0], linhasEnd.slice(1).join(' · ')] : linhasEnd

  return (
    <div className="gv-doc">
      <div className="pagina">
        <div className="topo">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element -- documento de impressao, como o relatorio */}
            <img className="logo" src="/logo_BYNX.png" alt="Bynx" />
            <div className="marca-sub">Serviços de bancada</div>
          </div>
          <div className="selo">
            <div className="l">Pedido</div>
            <div className="cod">{num}</div>
            <div className="l">{nomeServico} · {cartas} {cartas === 1 ? 'carta' : 'cartas'}</div>
          </div>
        </div>

        <div className="miolo">
          <div>
            <span className="rot">Guia de envio</span>
            <h1>Como enviar a <span className="g">{cartas === 1 ? 'sua carta' : 'suas cartas'}</span></h1>
            <p className="sub">Leva uns 10 minutos. A carta chega protegida e o pacote é aberto em vídeo aqui na bancada.</p>
          </div>

          <section>
            <div className="sec-t"><span className="rot">Antes de embalar</span><span className="leg">confira os três pontos</span></div>
            <div className="antes">
              <div><Ok /><p><b>Orçamento aprovado</b><span>{sinal?.pago_em ? `e sinal pago em ${dataBRT(sinal.pago_em)}.` : 'e pagamento confirmado.'}</span></p></div>
              <div><Ok /><p><b>Endereço da Bynx</b><span>na etiqueta, no fim desta folha.</span></p></div>
              <div><Ok /><p><b>Valor declarado: {valor}</b><span>o mesmo do orçamento.</span></p></div>
            </div>
          </section>

          <section>
            <div className="sec-t"><span className="rot">Material</span><span className="leg">papelaria ou loja de card</span></div>
            <div className="material">
              {['Sleeve sem PVC', 'Toploader ou semirrígido', 'Fita crepe', '2 pedaços de papelão', 'Envelope de bolha ou caixa'].map(m => <span key={m}>{m}</span>)}
            </div>
          </section>

          <section>
            <div className="sec-t"><span className="rot">Passo a passo</span></div>
            <div className="passos">
              <Passo n={1} titulo="Sleeve" ilu={<IluSleeve />}>
                Pegue a carta pelas bordas e coloque no sleeve, com a frente para fora.
              </Passo>
              <Passo n={2} titulo="Toploader" ilu={<IluToploader />}>
                Sleeve dentro do toploader. Feche a boca com fita <strong>no toploader</strong>. A fita nunca encosta na carta.
              </Passo>
              <Passo n={3} titulo="Papelão" ilu={<IluPapelao />}>
                Toploader entre dois papelões um pouco maiores, presos com fita. O conjunto não pode dobrar.
              </Passo>
              <Passo n={4} titulo="Pacote" ilu={<IluPacote num={num} />}>
                Tudo no envelope de bolha ou na caixa. Escreva <strong>Pedido {num}</strong> do lado de fora.
              </Passo>
              <Passo n={5} titulo="Correios" ilu={<IluCorreios />}>
                Poste com <strong>rastreio</strong> e <strong>valor declarado de {valor}</strong>. Guarde o comprovante.
              </Passo>
              <Passo n={6} titulo="Rastreio no pedido" ilu={<IluRastreio />}>
                Informe o código na página do pedido, em <strong>bynx.gg/servicos</strong>. É assim que acompanhamos a chegada.
              </Passo>
            </div>
          </section>

          <div className="dupla">
            <section>
              <div className="sec-t"><span className="rot">Não faça</span></div>
              <ul className="lista">
                {['Fita na carta ou no sleeve.', 'Clipe, elástico ou grampo no pacote.', 'Envelope comum, sem papelão.', 'Duas cartas no mesmo toploader.', 'Postar sem valor declarado.'].map(t => <li key={t}><Nao />{t}</li>)}
              </ul>
            </section>
            <section>
              <div className="sec-t"><span className="rot">Quando chegar</span></div>
              <ul className="lista">
                {['O pacote é aberto em vídeo, do lacre até a carta.', `${cartas === 1 ? 'A carta recebe' : 'Cada carta recebe'} um número de custódia.`, 'Você recebe um aviso por e-mail e no sino.', 'Se algo estiver diferente das fotos, você decide antes de qualquer trabalho.'].map(t => <li key={t}><Ponto />{t}</li>)}
              </ul>
            </section>
          </div>

          <div className="etiqueta">
            <span className="tesoura"><Tesoura /> Recorte e cole no pacote</span>
            <div>
              <div className="k">Destinatário</div>
              <div className="dest">{destNome}</div>
              <div className="end forte">{destEnd.map(l => <span key={l}>{l}<br /></span>)}</div>
              <div className="k k2">Remetente</div>
              {remetente ? (
                <div className="end forte">{remetente.nome}<br />{remetente.linha1}<br />{remetente.linha2}</div>
              ) : (
                <div className="linhas"><i /><i /><i /></div>
              )}
            </div>
            <div className="lado">
              <div className="k">Pedido</div>
              <div className="ped">{num}</div>
              <div className="end">Envio de serviço</div>
              <span className="fragil">FRÁGIL · NÃO DOBRAR</span>
            </div>
          </div>
        </div>

        <div className="rod"><b>Bynx · Serviços de bancada</b><span>Dúvidas: responda o e-mail do pedido ou chame no WhatsApp</span><b>bynx.gg</b></div>
      </div>
    </div>
  )
}

function Passo({ n, titulo, ilu, children }: { n: number; titulo: string; ilu: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="passo">
      <div className="ilu"><span className="n">{n}</span>{ilu}</div>
      <div className="tx"><b>{titulo}</b><p>{children}</p></div>
    </div>
  )
}

const Ok = () => <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="5.3" className="ok" /><path d="M3.6 6.2l1.6 1.6 3.2-3.4" className="ok" /></svg>
const Nao = () => <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden><path d="M3 3l6 6M9 3l-6 6" className="nao" /></svg>
const Ponto = () => <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden><circle cx="6" cy="6" r="2" className="ponto" /></svg>
const Tesoura = () => <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden><circle cx="3" cy="3" r="1.8" className="s2" /><circle cx="3" cy="9" r="1.8" className="s2" /><path d="M4.5 4l6.5 6M4.5 8l6.5-6" className="s2" /></svg>

const IluSleeve = () => <svg className="ilu-s" viewBox="0 0 92 44" aria-hidden><rect className="s2" x="33" y="3" width="26" height="38" rx="1.5" strokeDasharray="2 2" /><rect className="carta" x="35" y="7" width="22" height="32" rx="1.2" /><rect className="s2" x="38" y="10" width="16" height="13" /><path className="a" d="M46 0v5M43.5 2.5L46 5l2.5-2.5" /></svg>
const IluToploader = () => <svg className="ilu-s" viewBox="0 0 92 44" aria-hidden><rect className="s" x="30" y="3" width="32" height="39" rx="2" /><rect className="carta" x="35" y="9" width="22" height="31" rx="1.2" /><rect className="fita" x="38" y="1" width="16" height="5" rx=".6" /></svg>
const IluPapelao = () => <svg className="ilu-s" viewBox="0 0 92 44" aria-hidden><rect className="s2" x="22" y="6" width="40" height="34" rx="1" transform="rotate(-4 42 23)" /><rect className="s" x="30" y="4" width="32" height="38" rx="1" /><rect className="fita" x="27" y="18" width="38" height="5" rx=".6" /></svg>
const IluPacote = ({ num }: { num: string }) => <svg className="ilu-s" viewBox="0 0 92 44" aria-hidden><rect className="s" x="16" y="8" width="60" height="32" rx="2" /><path className="s2" d="M16 10l30 15 30-15" /><text x="44" y="35" fontSize="5.2" fontWeight="800" className="txt">{num}</text></svg>
const IluCorreios = () => <svg className="ilu-s" viewBox="0 0 92 44" aria-hidden><rect className="s" x="24" y="6" width="44" height="30" rx="2" /><path className="s" d="M24 14h44M32 22h16M32 28h22" /><circle className="s" cx="60" cy="26" r="5" /><path className="s" d="M58 26l1.5 1.5 3-3" /></svg>
const IluRastreio = () => <svg className="ilu-s" viewBox="0 0 92 44" aria-hidden><rect className="s" x="32" y="2" width="28" height="40" rx="4" /><rect className="s2" x="35" y="12" width="22" height="6" rx="1" /><text x="36.2" y="16.3" fontSize="2.9" className="txt2">AA123456789BR</text><rect x="36" y="22" width="20" height="6" rx="1" className="cheio" /></svg>

// A raiz fica no escopo ESCURO e guarda as cores das faixas em --ink*; a
// partir de .gv-tela vale o bloco claro do globals.css (igual ao relatorio).
const CSS = `
@page{size:A4;margin:0}
.gv-raiz{--ink:var(--bx-bg);--ink-text:var(--bx-text);--ink-text-2:var(--bx-text-2);--ink-border:var(--bx-border-2);--ink-surface:var(--bx-surface-2);width:100%;flex:1}
.gv-tela{min-height:100vh;background:var(--bx-surface-3);color:var(--bx-text);padding:0 0 24mm;font-family:var(--font-dm-sans),system-ui,sans-serif}
.gv-barra{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:12px 16px;margin-bottom:10mm;background:var(--bx-bg-elev);border-bottom:1px solid var(--bx-border)}
.gv-voltar{display:inline-flex;align-items:center;gap:4px;min-height:44px;font-size:13px;font-weight:700;color:var(--bx-text-2);text-decoration:none}
.gv-bt{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:10px;border:0;background:var(--ac-grad);color:var(--bx-brand-ink);font:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:transform .15s ease}
.gv-bt:hover{transform:translateY(-2px)}
.gv-instrucao{flex-basis:100%;margin:0;font-size:12.5px;color:var(--bx-text-2)}
.gv-instrucao b{color:var(--bx-text)}
.gv-erro,.gv-carregando{max-width:210mm;margin:0 auto;padding:16px;display:flex;gap:6px;align-items:center;font-size:14px;color:var(--bx-text-2)}
.gv-erro{font-weight:700;color:var(--bx-text)}

.gv-doc{font-size:9pt;line-height:1.38;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.gv-doc *{box-sizing:border-box;margin:0;padding:0}
.gv-doc .pagina{position:relative;width:210mm;height:297mm;margin:0 auto;background:var(--bx-bg-elev);box-shadow:var(--bx-shadow);padding:0 15mm 18mm;overflow:hidden}
.gv-doc .topo{display:flex;justify-content:space-between;align-items:center;gap:6mm;margin:0 -15mm;padding:7mm 15mm 6.5mm;background:var(--ink);color:var(--ink-text);position:relative}
.gv-doc .topo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1.6mm;background:var(--ac-grad)}
.gv-doc .logo{height:10mm;width:auto;display:block}
.gv-doc .marca-sub{color:var(--ac-1);margin-top:2mm;font-size:7.5pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.gv-doc .selo{border:1pt solid var(--ink-border);background:var(--ink-surface);border-radius:2mm;padding:3mm 3.5mm;min-width:60mm}
.gv-doc .selo .l{font-size:7.5pt;color:var(--ink-text-2)}
.gv-doc .selo .cod{font-size:15pt;font-weight:900;letter-spacing:.02em;line-height:1.15;font-variant-numeric:tabular-nums}
.gv-doc .rot{font-size:8pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;display:inline-flex;align-items:center;gap:1.5mm}
.gv-doc .rot::before{content:"";width:1mm;height:3mm;border-radius:.3mm;background:var(--ac-grad)}
.gv-doc h1{font-size:21pt;font-weight:800;letter-spacing:-.035em;line-height:1.1;margin-top:2mm}
.gv-doc h1 .g{background:var(--ac-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.gv-doc .sub{font-size:10pt;color:var(--bx-text-2);font-weight:500;margin-top:1.5mm}
.gv-doc .miolo{display:flex;flex-direction:column;gap:4mm;padding-top:6mm}
.gv-doc .sec-t{display:flex;align-items:baseline;gap:2.5mm;padding-bottom:1.2mm;border-bottom:.5pt solid var(--bx-border-2);margin-bottom:2mm}
.gv-doc .sec-t .leg{font-size:8pt;color:var(--bx-text-2)}
.gv-doc .antes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm}
.gv-doc .antes>div{border:.5pt solid var(--bx-border-2);border-radius:2mm;padding:2mm 3mm;display:flex;gap:2mm;align-items:flex-start}
.gv-doc .antes svg{flex:none;margin-top:.3mm}
.gv-doc .antes b{display:block;font-size:8.5pt}
.gv-doc .antes span{font-size:7.8pt;color:var(--bx-text-2)}
.gv-doc .material{display:flex;flex-wrap:nowrap;gap:1.5mm}
.gv-doc .material span{border:.5pt solid var(--bx-border-2);background:var(--bx-surface-2);border-radius:999px;padding:.9mm 2.2mm;font-size:7.2pt;font-weight:700;white-space:nowrap}
.gv-doc .passos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3mm}
.gv-doc .passo{border:.5pt solid var(--bx-border-2);border-radius:2.5mm;overflow:hidden;display:flex;flex-direction:column}
.gv-doc .passo .ilu{height:16mm;background:var(--bx-surface-2);display:flex;align-items:center;justify-content:center;position:relative}
.gv-doc .passo .n{position:absolute;top:2mm;left:2mm;width:6mm;height:6mm;border-radius:999px;background:var(--ink);color:var(--ink-text);font-weight:900;font-size:8.5pt;display:flex;align-items:center;justify-content:center}
.gv-doc .passo .tx{padding:2mm 3mm 2.5mm}
.gv-doc .passo b{display:block;font-size:9pt;margin-bottom:.8mm}
.gv-doc .passo p{font-size:7.9pt;color:var(--bx-text-2)}
.gv-doc .passo p strong{color:var(--bx-text)}
.gv-doc .dupla{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5mm}
.gv-doc .lista{list-style:none;display:flex;flex-direction:column;gap:1mm}
.gv-doc .lista li{display:grid;grid-template-columns:3.6mm 1fr;gap:1.6mm;font-size:8.2pt}
.gv-doc .lista svg{margin-top:.4mm}
.gv-doc .etiqueta{margin-top:1mm;border:1pt dashed var(--bx-text-3);border-radius:2.5mm;padding:3mm 4mm;position:relative;display:grid;grid-template-columns:1.3fr 1fr;gap:5mm}
.gv-doc .tesoura{position:absolute;top:-2.6mm;left:6mm;background:var(--bx-bg-elev);padding:0 1.5mm;font-size:7pt;color:var(--bx-text-3);display:flex;gap:1mm;align-items:center}
.gv-doc .etiqueta .k{font-size:7pt;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--bx-text-3)}
.gv-doc .etiqueta .k2{margin-top:2.5mm}
.gv-doc .etiqueta .dest{font-size:11pt;font-weight:800;line-height:1.3}
.gv-doc .etiqueta .end{font-size:9pt;color:var(--bx-text-2);margin-top:.8mm}
.gv-doc .etiqueta .end.forte{color:var(--bx-text)}
.gv-doc .etiqueta .lado{border-left:.5pt solid var(--bx-border-2);padding-left:5mm}
.gv-doc .etiqueta .ped{font-size:16pt;font-weight:900;letter-spacing:.02em;font-variant-numeric:tabular-nums}
.gv-doc .etiqueta .fragil{margin-top:1.5mm;display:inline-block;border:1pt solid var(--bx-text);border-radius:1mm;padding:.6mm 2mm;font-size:7.5pt;font-weight:900;letter-spacing:.14em}
.gv-doc .linhas{display:grid;gap:5mm;padding-top:4mm}
.gv-doc .linhas i{display:block;border-bottom:.5pt solid var(--bx-text-3)}
.gv-doc .rod{position:absolute;left:0;right:0;bottom:0;height:11mm;padding:0 15mm;display:flex;justify-content:space-between;align-items:center;background:var(--ink);color:var(--ink-text-2);font-size:7.5pt}
.gv-doc .rod::before{content:"";position:absolute;left:0;right:0;top:0;height:1.2mm;background:var(--ac-grad)}
.gv-doc .rod b{color:var(--ink-text);font-weight:700}
.gv-doc svg.ilu-s{width:34mm;height:15mm}
.gv-doc .s{fill:none;stroke:var(--bx-text);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.gv-doc .s2{fill:none;stroke:var(--bx-text-3);stroke-width:.9;stroke-linecap:round;stroke-linejoin:round}
.gv-doc .a{fill:none;stroke:var(--ac-2);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.gv-doc .carta{fill:var(--bx-bg-elev);stroke:var(--bx-text);stroke-width:1.1}
.gv-doc .fita{fill:var(--ac-1);opacity:.55}
.gv-doc .cheio{fill:var(--ac-1)}
.gv-doc .txt{fill:var(--bx-text);font-family:inherit}
.gv-doc .txt2{fill:var(--bx-text-2);font-family:inherit}
.gv-doc .ok{fill:none;stroke:var(--bx-green);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.gv-doc .nao{stroke:var(--bx-red);stroke-width:1.5;stroke-linecap:round}
.gv-doc .ponto{fill:var(--ac-1)}
@media print{
  body>*:not(.gv-raiz):not(:has(.gv-raiz)){display:none!important}
  html,body{background:none!important}
  .gv-tela{background:none;padding:0;min-height:0}
  .gv-barra,.gv-erro,.gv-carregando{display:none!important}
  .gv-doc .pagina{margin:0;box-shadow:none}
}
`
