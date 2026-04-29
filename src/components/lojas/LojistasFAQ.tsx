'use client'

import { CSSProperties, useState } from 'react'

// ─── Perguntas e respostas ────────────────────────────────────────────────────

const FAQ_ITEMS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: 'Vou aparecer pra colecionador da minha cidade?',
    resposta:
      'Sim, e essa é a graça do Bynx. Quando alguém pesquisa "loja Pokémon [sua cidade]" no guia, você aparece. O filtro tá em cima de estado e cidade — ou seja, quem é da sua área te encontra primeiro. Lojas Pro aparecem acima das Básico; Premium aparece em rotação no topo.',
  },
  {
    pergunta: 'Qual a diferença entre Pro e Premium?',
    resposta:
      'O Pro (R$ 39/mês) já te tira do plano Básico: até 5 fotos, redes sociais, descrição sem limite, badge Pro no card e prioridade na listagem. O Premium (R$ 89/mês) adiciona o que diferencia loja grande de loja pequena: 10 fotos, eventos e torneios ilimitados, card 1.5x maior, rotação no topo, analytics de visualizações e cliques no WhatsApp, e SEO customizável. Se você organiza eventos ou quer dado pra decidir, vai de Premium.',
  },
  {
    pergunta: 'Como funciona a divulgação de eventos e torneios?',
    resposta:
      'Exclusivo do Premium. Você publica eventos (ligas, torneios, prereleases, drafts) direto no perfil da sua loja. Eles aparecem no card do guia como "Próxima liga: dd/mm" e ficam visíveis pra qualquer colecionador que olha sua página. Quem nunca foi na sua casa de torneios descobre o evento e aparece.',
  },
  {
    pergunta: 'Preciso ter CNPJ pra cadastrar minha loja?',
    resposta:
      'Não é obrigatório, mas é fortemente recomendado. Lojas com CNPJ ativo têm prioridade na aprovação e na obtenção do selo verificado. Lojas pessoa física também podem se cadastrar, mas passam por uma análise mais cuidadosa.',
  },
  {
    pergunta: 'Quanto tempo leva pra minha loja ser aprovada?',
    resposta:
      'Nossa equipe analisa novos cadastros em até 48 horas úteis. Você recebe um email assim que sua loja for aprovada. Durante a análise, sua loja não aparece no guia público, mas você pode continuar editando os dados.',
  },
  {
    pergunta: 'Como funciona o trial de 14 dias do Pro?',
    resposta:
      'Ao cadastrar sua loja, você entra automaticamente com 14 dias de plano Pro, sem precisar informar cartão de crédito. Durante esse período, tem acesso a todas as features do Pro: 5 fotos, redes sociais, descrição ilimitada e especialidades ilimitadas. Ao fim do trial, sua loja continua ativa no plano Básico (gratuito) a menos que você escolha assinar.',
  },
  {
    pergunta: 'Posso cancelar quando quiser?',
    resposta:
      'Sim. Você pode cancelar a assinatura Pro ou Premium a qualquer momento direto no painel "Minha Loja". O cancelamento não é imediato: sua loja continua com os benefícios do plano até o fim do período pago. Depois, volta pro plano Básico sem perder os dados. Sem multa, sem fidelidade.',
  },
  {
    pergunta: 'Posso ter mais de uma loja cadastrada?',
    resposta:
      'Sim. Você pode cadastrar quantas lojas quiser na mesma conta — cada uma com seu próprio plano (Básico, Pro ou Premium) e cobrança separada. Útil pra quem tem matriz e filiais, lojas de cidades diferentes, ou marcas diferentes sob a mesma operação. Cada loja tem sua URL única, suas fotos, suas redes sociais e seu próprio painel.',
  },
  {
    pergunta: 'As fotos precisam ser profissionais?',
    resposta:
      'Não precisam. Fotos feitas com celular funcionam bem, desde que sejam bem iluminadas e mostrem sua loja de forma verdadeira. Recomendamos: fachada, interior, mesas de jogo (se tiver), estoque ou balcão, eventos ou comunidade. Fotos genéricas de estoque de internet não são aceitas.',
  },
  {
    pergunta: 'Como funciona a moderação e o selo verificado?',
    resposta:
      'Toda loja nova passa por moderação pra evitar cadastros falsos, duplicatas ou conteúdo impróprio. O selo verificado (⭐ azul) é concedido manualmente pela equipe Bynx pra lojas com CNPJ ativo, operação comprovada (site, redes sociais com seguidores, reviews no Google) e pelo menos 3 meses cadastradas no Bynx.',
  },
  {
    pergunta: 'Posso usar o Bynx pra vender cartas online pelo meu WhatsApp?',
    resposta:
      'Sim. Essa é justamente a proposta. O Bynx não processa vendas nem cobra comissão. Ele conecta o colecionador à sua loja, e a negociação rola do jeito que você já trabalha: WhatsApp, e-commerce próprio, presencial. Você fica com 100% do faturamento.',
  },
]

// ─── Componente ───────────────────────────────────────────────────────────────

export default function LojistasFAQ() {
  const [abertoIdx, setAbertoIdx] = useState<number | null>(0)

  return (
    <div style={S.wrap}>
      {FAQ_ITEMS.map((item, idx) => {
        const aberto = abertoIdx === idx
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setAbertoIdx(aberto ? null : idx)}
            style={{ ...S.item, ...(aberto ? S.itemOpen : {}) }}
            aria-expanded={aberto}
          >
            <span style={S.itemQuestion}>
              {item.pergunta}
              <svg
                width="18"
                height="18"
                viewBox="0 0 20 20"
                fill="none"
                style={{
                  ...S.icon,
                  transform: aberto ? 'rotate(45deg)' : 'rotate(0deg)',
                }}
              >
                <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            {aberto && <p style={S.itemAnswer}>{item.resposta}</p>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S: Record<string, CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  item: {
    width: '100%',
    textAlign: 'left',
    background: '#0d0f14',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 20,
    cursor: 'pointer',
    fontFamily: 'inherit',
    color: '#f0f0f0',
    transition: 'border-color 0.15s ease, background 0.15s ease',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  itemOpen: {
    border: '1px solid rgba(96,165,250,0.25)',
    background: 'linear-gradient(180deg, rgba(96,165,250,0.03), rgba(13,15,20,1) 80%)',
  },
  itemQuestion: {
    fontSize: 15,
    fontWeight: 600,
    color: '#f0f0f0',
    letterSpacing: '-0.01em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    lineHeight: 1.4,
  },
  icon: {
    flexShrink: 0,
    transition: 'transform 0.2s ease',
    color: 'rgba(96,165,250,0.8)',
  },
  itemAnswer: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.7,
    margin: 0,
    paddingRight: 36,
  },
}
