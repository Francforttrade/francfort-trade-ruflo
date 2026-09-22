# COMISSOES — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Calcula valor, identificador e indicador de conciliação. Não emite invoice, efetua pagamento ou persiste provisionamento.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/comissoes/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`ftrCode`, `commissionType`, `commissionRate`, `baseUsd`, `quantityMt`, `sequence`, `paidAmountUsd`. Campos necessários ao cálculo variam por tipo; não existe validação completa de valores no ponto de entrada.

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

`agent`, `ftr_code`, `commission_id` (null sem sequence), `commission_amount_usd`, `is_accrual_day`, `reconciled`.

## Regras implementadas

Percentage: baseUsd × commissionRate / 100; Per MT: rate × quantityMt; Flat Fee: rate. Conciliação compara diferença absoluta <= USD 0,01, sem pago retorna false. Dias 10/25 são comparados ao calendário local da execução. ID: COM-sequência preenchida até seis dígitos-ano de dois dígitos.

## Efeitos, persistência, erros e repetição

Somente cálculo e logs no componente. Tipo desconhecido lança Error. Datas e ano padrão dependem do relógio. Sequência vem do chamador, sem reserva única.

## Lacunas e limites

Não verifica FTR final/pagamento confirmado antes do cálculo. Não reserva numeração, não executa agenda e não mantém razão de pagamentos parciais/estornos. Número calculado não demonstra emissão.

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

Acordos de comissão; beneficiários; base e alíquotas; exemplos de cálculo; arredondamento; condições de reconhecimento; numeração e modelo de documento.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Base bruta/líquida; quem aprova comissão; momento de reconhecimento; moeda/câmbio; cancelamento, parcial e estorno; fuso e calendário.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Critérios de aceite propostos

Três tipos; taxa/quantidade negativas ou ausentes; limite de tolerância monetária; sequência repetida; virada de ano; comissão sem liberação do negócio.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/comissoes foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/comissoes/index.js).
- [calculation.js](../../src/agents/comissoes/calculation.js).
- [accrualSchedule.js](../../src/agents/comissoes/accrualSchedule.js).
- [invoiceNumbering.js](../../src/agents/comissoes/invoiceNumbering.js).
- [reconciliation.js](../../src/agents/comissoes/reconciliation.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
