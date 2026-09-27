# Proteção Bynx (leilão) — rascunho de cláusula

> **RASCUNHO para revisão do advogado. NÃO publicado nos Termos de Uso.**
> Vale só para compras feitas em leilão na Bynx. Compras no marketplace e em
> vitrines de loja seguem as regras atuais.
>
> Prazos encurtados em 28/09 para caber no repasse de 30 dias. Os números desta
> cláusula espelham as constantes `DIAS_*` de `src/lib/leilao-reclamacao.ts`
> (fonte única do sistema): mudou lá, muda aqui.

## Cláusula X — Proteção Bynx para compras em leilão

**X.1 Abrangência.** A Proteção Bynx se aplica aos pedidos gerados pelo
arremate de um lote em leilão realizado na Bynx e pagos pela plataforma. Não se
aplica a negociações feitas fora da Bynx.

**X.2 Prazo de envio.** A loja vendedora deve enviar o item e informar o código
de rastreio em até 3 (três) dias úteis contados da confirmação do pagamento.
Esgotado esse prazo sem envio, o comprador pode solicitar o cancelamento do
pedido pela própria plataforma e recebe o estorno integral do valor pago.

**X.3 Confirmação de recebimento.** O comprador confirma o recebimento na
página do pedido. Sem confirmação, o pedido é considerado entregue
automaticamente 12 (doze) dias depois do envio. No 8º (oitavo)
dia a Bynx avisa o comprador para confirmar ou relatar um problema. Uma
reclamação aberta suspende a confirmação automática.

**X.4 Prazo para reclamar.** O comprador pode abrir uma reclamação enquanto o
pedido estiver em trânsito e em até 5 (cinco) dias corridos depois da entrega
(a confirmação do comprador ou a confirmação automática, o que ocorrer
primeiro).

**X.5 Motivos.** São aceitas reclamações pelos seguintes motivos: (a) o item
não chegou; (b) o item é diferente do anunciado no lote; (c) há suspeita de
falsificação; (d) o item chegou danificado. Nos motivos (b), (c) e (d), o
comprador deve enviar fotos da frente e do verso do item e da embalagem
recebida; vídeo é opcional.

**X.6 Resposta da loja.** A loja é avisada e tem 2 (dois) dias úteis para
responder, podendo aceitar o estorno, propor um acordo ou apresentar provas. A
ausência de resposta no prazo resulta em decisão favorável ao comprador.

**X.7 Decisão da Bynx.** Quando a loja não resolver a reclamação, a Bynx
analisa as informações das duas partes e decide em até 3 (três) dias úteis,
podendo determinar: (a) estorno total; (b) estorno parcial; (c) devolução do
item, com estorno integral após o recebimento pela loja, sendo o frete de
devolução custeado pela parte que deu causa ao problema; ou (d) encerramento
da reclamação sem estorno.

**X.8 Execução do estorno.** O estorno é feito no mesmo meio de pagamento
usado na compra, e o prazo para o valor aparecer depende do banco emissor. Na
mesma proporção do estorno, é revertido o valor repassado à loja e a tarifa da
Bynx sobre a parte estornada.

**X.9 Repasse da loja.** Para vender em leilão, a loja deve manter o prazo de
repasse de 30 (trinta) dias. O valor de uma venda em leilão pode ser revertido
por decisão tomada nos termos desta cláusula enquanto não tiver sido repassado.

**X.10 Dias úteis.** Para esta cláusula, dias úteis são os de segunda a sexta,
excluídos os feriados nacionais, contados no horário de Brasília. O prazo em
dias úteis termina às 23h59 do último dia.

**X.11 Outros meios.** A Proteção Bynx não afasta os direitos do comprador
previstos no Código de Defesa do Consumidor nem o impede de recorrer aos
meios legais cabíveis.

---

### Notas para a revisão (internas, não vão para os Termos)

- **X.10 × implementação:** o sistema hoje pula fim de semana e os feriados
  nacionais de **data fixa**. Carnaval, Sexta-feira Santa e Corpus Christi
  (móveis) ainda contam como úteis — isso só encurta o prazo da loja em um dia,
  nunca o do comprador. Decidir se o texto diz "feriados nacionais de data
  fixa" ou se o sistema passa a ter o calendário completo.
- **X.8 × chargeback:** a Proteção não substitui a contestação no cartão. Se o
  comprador abrir chargeback em paralelo, vale a disputa da operadora.
- **X.9:** a trava de 30 dias existe no agendamento da rodada. A loja ainda
  consegue mudar o prazo para 14 dias depois de agendar (ver pendências).
- **Direito de arrependimento (art. 49 CDC):** compra em leilão online pode
  ser enquadrada como compra fora do estabelecimento. Confirmar com o advogado
  se o prazo de 5 dias da X.4 precisa conviver com o arrependimento sem motivo
  (que é de 7 dias no art. 49).
- **Pior caso × repasse de 30 dias:** ver o bloco "pior caso" em
  `scripts/reclamacao-selftest.mjs` (pagamento → envio no limite → fechamento
  automático → reclamação no último dia → loja e Bynx no último dia útil).
