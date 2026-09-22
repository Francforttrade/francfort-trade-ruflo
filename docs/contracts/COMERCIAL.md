# COMERCIAL — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Produz texto de oferta e indicadores de preço, crédito e atraso. Não aprova nem envia a oferta.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/comercial/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`product` (type, grade), `quantity.mt`, `unitPriceUsd` e `incoterm` são consumidos diretamente. `seller`, `buyer.credit_limit_usd`, `freightUsdPerMt`, `insuranceRate`, `paymentTerms` e `previousQuoteSentAt` complementam a chamada. O roteador exige `ftrCode`; a resposta deste componente não o devolve.

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

`agent`, `offer_text`, `unit_price_usd`, `total_value_usd`, `price_check`, `credit_check`, `negotiation` (null sem data anterior).

## Regras implementadas

FOB Santos usa preço-base; CFR soma frete; CIF multiplica CFR por (1 + insuranceRate). Histórico: média dos últimos 30 dias por tipo/grade no Supabase. Dump: desvio <= -25%; tolerância: absoluto <= 20%. Crédito desconhecido retorna null. Revisão atrasada após 24h; escalonamento sinalizado após 48h. São regras do código, ainda sujeitas à validação comercial.

## Efeitos, persistência, erros e repetição

Lê Supabase via pricingLookup.js; emite logs; não persiste oferta nem envia mensagem. Incoterm desconhecido lança Error; falhas da consulta propagam. Repetir pode produzir outro resultado por mudança de histórico ou horário.

## Lacunas e limites

O total usa preço-base × quantidade, enquanto o preço unitário retornado inclui frete/seguro: definir a base correta antes de publicar ofertas. Ausência de histórico produz is_dump:false, mas não comprova conformidade. Não há aprovação humana, bloqueio efetivo por crédito, sequência durável nem chave de oferta.

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

Modelo aprovado de oferta; tabela e fonte de preços; política de crédito; cálculo de frete/seguro; tolerâncias e arredondamento; responsáveis por aprovar exceções.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Base do total comercial; validade da oferta; política para histórico/limite ausente; identidade/versionamento da oferta; quem aprova e como comprova aprovação.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Procedimentos de conduta incorporados (Fonte A/B)

Status: regra de negócio já adotada em [QUALIDADE.md](QUALIDADE.md) (gatilho/prazo/responsável das 11 reclamações de qualidade, fontes preservadas integralmente em [CONDUTA_FONTE_A](CONDUTA_FONTE_A.txt) e [CONDUTA_FONTE_B](CONDUTA_FONTE_B.txt), precedência em [PROCEDIMENTOS_CONDUTA](PROCEDIMENTOS_CONDUTA.md)) — não duplicada aqui. Este contrato registra especificamente o papel de COMERCIAL dentro desse mesmo fluxo: interlocução vendedor/comprador, proposta de solução e, no caso de rejeição por aflatoxina na Europa, busca de comprador alternativo ou reexportação pelo vendedor. Vendedor e Comprador continuam os responsáveis humanos definidos nas fontes; nenhum agente de software os substitui. Participação de agente é proposta técnica, não aprovada e não implementada.

### Papel de COMERCIAL nas reclamações de qualidade já adotadas

Nas duas fontes, a etapa final de ação de praticamente todas as 11 reclamações de qualidade é a mesma: aguardar a resposta do vendedor e buscar a melhor solução para ambas as partes. Essa etapa de negociação/proposta é o papel de COMERCIAL — distinto da coleta de evidências (QUALIDADE) e da autoridade regulatória (COMPLIANCE).

- **Gatilho:** QUALIDADE já registrou evidência de uma reclamação de qualidade (ver tabela em [QUALIDADE.md](QUALIDADE.md)).
- **Ação aprovada:** intermediar entre vendedor e comprador; propor solução para ambas as partes.
- **Evidência:** a evidência da reclamação (fotos/laudos) é responsabilidade de QUALIDADE, não deste contrato — COMERCIAL trabalha sobre o que já foi coletado.
- **Prazo/responsável:** os mesmos já adotados por reclamação em `QUALIDADE.md` (Fonte B prevalece nas divergências de prazo/responsável) — não redefinidos aqui.
- **Critério de aceite rastreável:** `CONDUTA_FONTE_A.txt`/`CONDUTA_FONTE_B.txt`, texto de ação de cada reclamação (ver `QUALIDADE.md` para os números de linha específicos).

### Caso específico: Aflatoxina — rejeição na Europa

- **Gatilho:** carga rejeitada por aflatoxina em destino na União Europeia — "No momento em que formos notificados sobre a rejeição da carga" (`CONDUTA_FONTE_A.txt:81-83`; `CONDUTA_FONTE_B.txt:79-81`, texto idêntico nas duas fontes).
- **Ação aprovada:** procurar outro comprador em destino próximo fora da UE, **ou** solicitar a reexportação pelo vendedor, para evitar custos no porto de destino. As duas alternativas são preservadas — nenhuma é eliminada.
- **Prazo:** Imediato (idêntico nas duas fontes).
- **Responsável:** Vendedor (idêntico nas duas fontes) — a reexportação é executada pelo vendedor; a busca por comprador alternativo não tem responsável humano adicional nomeado nas fontes além do contexto comercial geral.
- **Participação proposta do agente COMERCIAL (proposta técnica — não aprovada, não implementada):** `pricingLookup.js`/`negotiation.js` hoje não têm nenhum caminho de código para "comprador alternativo" nem "reexportação" — esses módulos calculam preço/histórico de negociação para uma oferta já em andamento, não buscam novos compradores. Uma participação futura proposta seria usar `pricing.js` para precificar uma oferta ao comprador alternativo já identificado por um humano — sem o agente escolher ou contatar esse comprador de forma autônoma.
- **A busca de outro destino não dispensa avaliação de conformidade aplicável:** encontrar um comprador alternativo ou reexportar não substitui a avaliação regulatória de COMPLIANCE para o novo mercado de destino. Aflatoxina-Europa continua, nas duas fontes, com responsável Vendedor — sem a mudança de responsável que a precedência da Fonte B aplica ao caso geral de "Aflatoxina" (ver [QUALIDADE.md](QUALIDADE.md)). Qualquer novo destino tem seus próprios requisitos regulatórios, não avaliados por este registro.
- **Pendência:** não há alçada definida para quem decide entre as duas alternativas (comprador alternativo vs. reexportação), nem condições comerciais, preço ou custo de reexportação — não inventados aqui.

### Critérios de aceite propostos — procedimentos de conduta (não executados)

1. Para aflatoxina-Europa, o prazo Imediato e o responsável Vendedor são mantidos independentemente de qual das duas alternativas (comprador alternativo ou reexportação) for seguida.
2. As duas alternativas para aflatoxina-Europa (comprador alternativo, reexportação) permanecem preservadas — nenhuma é descartada por inferência, e nenhuma é tratada como obrigatória em detrimento da outra.
3. Registrar a intenção de buscar comprador alternativo ou solicitar reexportação não autoriza automaticamente o agente COMERCIAL a contatar terceiros ou executar a reexportação — a decisão entre as alternativas e sua execução permanecem humanas.
4. Nenhuma das duas alternativas dispensa a avaliação de conformidade regulatória do novo destino — essa avaliação continua sendo de COMPLIANCE, não deste agente, e não é presumida como satisfeita pela mera escolha de um novo comprador ou destino.
5. A proposta de solução de COMERCIAL nunca é tratada como resolução da reclamação sem a evidência de QUALIDADE correspondente já registrada.
6. Vendedor e Comprador não são substituídos por identificadores de agente em nenhum registro derivado deste procedimento.

## Critérios de aceite propostos

Comparar preço unitário e total em FOB/CFR/CIF; crédito ausente/excedido; histórico vazio/zero; erro de consulta; limites exatos de 24h/48h; repetição da mesma solicitação.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/comercial foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/comercial/index.js).
- [pricing.js](../../src/agents/comercial/pricing.js).
- [pricingLookup.js](../../src/agents/comercial/pricingLookup.js).
- [negotiation.js](../../src/agents/comercial/negotiation.js).
- [quoteTemplate.js](../../src/agents/comercial/quoteTemplate.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).
- [Fonte A dos procedimentos de conduta](CONDUTA_FONTE_A.txt); [Fonte B dos procedimentos de conduta](CONDUTA_FONTE_B.txt); [registro de precedência](PROCEDIMENTOS_CONDUTA.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
