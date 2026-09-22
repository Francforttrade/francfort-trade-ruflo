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

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
