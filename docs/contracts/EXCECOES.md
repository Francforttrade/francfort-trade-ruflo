# EXCECOES — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Componente transversal: recomenda nova tentativa, registra falha esgotada e registra intervenção manual. Não é fase sequencial do negócio.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/excecoes/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`action: record_failure` usa `ftrCode`, `agent`, `errorMsg`, `retryCount` (default 0). `action: override` usa `ftrCode`, `approvedBy`. Demais chamadas usam reason/message. Chamadas internas diretas do roteador e DIGITALIZACAO não seguem necessariamente o gate de route().

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

Retry: `agent`, `ftr_code`, `retry:true`, `retry_count`, `delay_ms`. Esgotado: `retry:false`, `dlq_entry`, `escalation_message` e identidade/contador. Override: identidade e `override`. Fallback: `agent`, `reason`, `message`.

## Regras implementadas

shouldRetry compara retryCount < 3. A tabela tem 1s/5s/30s/5min/30min, mas o fluxo comum com contadores 0/1/2 só usa os três primeiros. Não incrementa contador nem agenda execução. DIGITALIZACAO passa MAX_RETRIES para falhas determinísticas e vai direto à fila.

## Efeitos, persistência, erros e repetição

Override grava AUDIT_LOG; falha esgotada grava FALHAS_PROCESSAMENTO no Firestore. Identificadores usam FTR e timestamp. Mensagem de escalonamento é retornada/logada, não enviada pelo componente. Falha de gravação propaga.

## Lacunas e limites

Sem executor de retries, posse/resolução da fila ou deduplicação. approvedBy é dado do chamador, não validação de permissão. Registrar override não altera gate financeiro ou aprovação de qualidade.

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

Taxonomia de erros; runbook de falhas; responsáveis e contatos de escalonamento; matriz de permissões; motivos e evidências de intervenção humana.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Quem controla retries entre aplicação e o motor de workflow (não selecionado — ADR-001A: NOT DECIDED); contagem máxima total; erros transitórios; identidade da falha; alçadas e limites de override; resolução/reabertura da fila.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Procedimentos de conduta incorporados (Fonte A/B) — papel transversal, não dono de procedimento

Status: regra de negócio adotada (fontes preservadas integralmente em [CONDUTA_FONTE_A](CONDUTA_FONTE_A.txt) e [CONDUTA_FONTE_B](CONDUTA_FONTE_B.txt); precedência registrada em [PROCEDIMENTOS_CONDUTA](PROCEDIMENTOS_CONDUTA.md)). `PROCEDIMENTOS_CONDUTA.md` atribui a EXCECOES o papel de "acompanhamento e encaminhamento dos casos críticos" — não a titularidade de nenhum procedimento específico de logística, documentação ou qualidade. Os prazos, gatilhos, ações e responsáveis (Vendedor/Comprador) de cada procedimento pertencem aos contratos [LOGISTICS](LOGISTICS.md), [DOCUMENTACAO](DOCUMENTACAO.md) e [QUALIDADE](QUALIDADE.md); este contrato não os repete nem os redefine.

### Gatilho proposto para participação de EXCECOES

- Gatilho (proposta técnica, não aprovada): um dos prazos aprovados em LOGISTICS/DOCUMENTACAO/QUALIDADE (Imediato, 1 dia ou 2 dias, conforme o procedimento e a precedência da Fonte B) é excedido sem que o responsável humano (Vendedor ou Comprador) tenha registrado a ação/evidência esperada.
- Ação hoje implementada, sem relação com estes procedimentos: `shouldRetry` compara `retryCount < 3` para retries técnicos entre agentes; `override.js` grava um registro de intervenção manual para qualquer par `ftrCode`/`approvedBy`. Nenhum dos dois é acionado, hoje, por um prazo de conduta comercial vencido — são mecanismos de falha técnica/override de sistema, não de acompanhamento de prazo de negócio.
- Participação proposta do agente (TECHNICAL_PROPOSAL — não aprovada, não implementada): EXCECOES poderia registrar um evento de "prazo de conduta excedido" citando o procedimento de origem (ex.: "Atraso no Embarque — LOGISTICS", "Aflatoxina — QUALIDADE"), sem decidir a ação, sem substituir Vendedor/Comprador e sem escalonar automaticamente — apenas tornando o atraso visível, do mesmo modo que `record_failure` hoje torna uma falha técnica visível. Isso é distinto do mecanismo de retry técnico existente (`shouldRetry`/backoff), que trata falhas de chamada entre agentes, não prazos de negócio.

### O que este registro explicitamente não decide

- Alçada de quem pode declarar um prazo de conduta como excedido, ou quem recebe o encaminhamento.
- Intervalo, contagem máxima ou política de escalonamento para um prazo de conduta vencido — não definidos em `PROCEDIMENTOS_CONDUTA.md` nem inventados aqui.
- Qualquer alteração ao gate financeiro, à aprovação de qualidade ou à autorização de liberação já registrados em outros contratos — um prazo de conduta vencido não é, por si só, um override.

### Critérios de aceite propostos — procedimentos de conduta (não executados)

1. Um evento de prazo de conduta excedido, se implementado, identifica o procedimento e o contrato de origem (LOGISTICS/DOCUMENTACAO/QUALIDADE) — não duplica o texto do procedimento aqui.
2. Registrar um prazo excedido não altera automaticamente `release_flag`, `aflatoxin_check` ou qualquer outro gate definido em outro contrato.
3. Vendedor e Comprador permanecem os responsáveis pela ação/evidência do procedimento; EXCECOES não assume essa responsabilidade ao registrar o atraso.

## Critérios de aceite propostos

Contadores 0/2/3 e inválidos; falha do Firestore; repetição da falha; override não autorizado; nenhum reprocessamento automático implícito; erro determinístico sem retry.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/excecoes foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/excecoes/index.js).
- [backoff.js](../../src/agents/excecoes/backoff.js).
- [dlqEntry.js](../../src/agents/excecoes/dlqEntry.js).
- [escalation.js](../../src/agents/excecoes/escalation.js).
- [override.js](../../src/agents/excecoes/override.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).
- [Fonte A dos procedimentos de conduta](CONDUTA_FONTE_A.txt); [Fonte B dos procedimentos de conduta](CONDUTA_FONTE_B.txt); [registro de precedência](PROCEDIMENTOS_CONDUTA.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
