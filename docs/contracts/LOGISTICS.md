# LOGISTICS — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Compara containers, calcula prazo indicativo de demurrage e prepara/sincroniza eventos. Rastreamento atual é simulado.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/logistics/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`ftrCode`, `bookingId`, `containerNumber`, `bookingContainers`, `blContainers`, `destinationPort`, `etaDate`, `freeTimeDays`; sincronização adicional usa `trackingId`, `buyer` e demais campos do payload de cobrança.

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

`agent`, `ftr_code`, `tracking`, `container_check`, `calendar_event`, `payment_tracking_calendar`, `demurrage`; seções sem dados relevantes podem ser null.

## Regras implementadas

searatesQuery retorna mocked:true e carrier/vessel/ETD/ETA nulos. Prazo calculado: ETA + freeTimeDays (default 14); risco quando data de referência é posterior. É heurística do código, não cálculo de cobrança contratual. Containers: compara tamanho e presença em Set; não valida multiplicidades duplicadas corretamente em todos os casos.

## Efeitos, persistência, erros e repetição

Pode escrever no Google Calendar por calendarService quando trackingId, buyer e ETA existem e a integração está configurada. Serviço distingue test_mode/calendar_not_configured e retorna erro em falhas. calendar_event simples é apenas payload. Busca evento por trackingId antes de inserir/alterar; não é garantia transacional contra duas inserções concorrentes.

## Lacunas e limites

Fonte real de rastreamento ausente; ETA vem do chamador. Não há agendamento diário em index.js. Sem garantia de unicidade concorrente no Calendar nem validação completa das entradas HTTP (GET fornece query strings).

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

Contrato de dados do provedor; exemplos de booking/BL; regras de free time por operação; fonte oficial de ETA/ETD; calendário e responsáveis; cenários de mudança de viagem.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Fonte prioritária em divergências; atraso aceitável de dados; fuso; retirada efetiva versus ETA; separação entre alerta e valor de demurrage; tratamento de duplicatas no Calendar.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Procedimentos de conduta incorporados (Fonte A/B)

Status: regra de negócio adotada nos campos gatilho/prazo/responsável (fontes preservadas integralmente em [CONDUTA_FONTE_A](CONDUTA_FONTE_A.txt) e [CONDUTA_FONTE_B](CONDUTA_FONTE_B.txt); precedência registrada em [PROCEDIMENTOS_CONDUTA](PROCEDIMENTOS_CONDUTA.md)). Onde a Fonte B diverge da Fonte A em prazo ou responsável, prevalece a Fonte B, conforme decisão do usuário de 2026-09-22. Diferenças de texto de ação/evidência entre as fontes **não** são resolvidas por essa precedência — ficam registradas como pendência abaixo. Vendedor e Comprador continuam sendo os responsáveis humanos definidos nas fontes; nenhum agente de software os substitui. Participação de agente é proposta técnica, não aprovada e não implementada.

### Regras adotadas (gatilho / prazo / responsável — sem divergência entre as fontes nestes três procedimentos)

| Procedimento | Gatilho | Prazo | Responsável | Fonte |
|---|---|---|---|---|
| Atraso no Embarque | Embarque não ocorre na data prevista | Imediato | Vendedor | CONDUTA_FONTE_A.txt:5-7; CONDUTA_FONTE_B.txt:10-12 |
| Falta de aviso do Embarque | Vendedor não avisa que o embarque ocorreu | Imediato | Vendedor | CONDUTA_FONTE_A.txt:9-11; CONDUTA_FONTE_B.txt:14-16 |
| Falta de Informação do Booking | Booking não emitido/informado | Imediato | Vendedor | CONDUTA_FONTE_A.txt:13-15; CONDUTA_FONTE_B.txt:18-20 |

Nestes três procedimentos, prazo e responsável já são idênticos nas duas fontes — não há divergência para a precedência da Fonte B resolver.

### Ação — registrada por fonte, sem precedência assumida (divergência de texto, não de prazo/responsável)

- **Atraso no Embarque:** Fonte A — contatar o vendedor, solicitar urgência, verificar novas datas e informar o comprador com o motivo. Fonte B — contatar o vendedor, **apurar o motivo do atraso primeiro**, solicitar nova data com urgência, e só então informar o comprador com a data e o motivo. Pendência: ordem/ênfase da apuração do motivo não resolvida entre as fontes.
- **Falta de aviso do Embarque:** Fonte A — verificar o rastreio do armador e cobrar a documentação pós-embarque. Fonte B — **apurar o motivo do não aviso junto ao vendedor**, solicitar o booking, consultar o site do armador, e cobrar a documentação pós-embarque. Pendência: passo adicional de apuração de motivo (Fonte B) não incorporado por inferência.
- **Falta de Informação do Booking:** Fonte A e Fonte B convergem — contatar o vendedor e cobrar urgência na emissão do booking. Sem pendência de ação.

### Participação proposta do agente LOGISTICS (proposta técnica — não aprovada, não implementada)

Hoje `searatesQuery.js` retorna `mocked:true` e não há fonte real de data de embarque (ver "Lacunas e limites" acima) — o agente não tem, na implementação atual, como detectar automaticamente um atraso de embarque, uma falta de aviso ou uma falta de booking; essas são hoje detecções humanas, reportadas ao processo de negócio, não ao código. Proposta técnica: se/quando existir uma fonte real de rastreamento, LOGISTICS poderia sinalizar o desvio entre a data de embarque esperada e o evento real observado, e expor esse sinal para o responsável humano agir dentro do prazo acima — sem decidir, sem contatar vendedor/comprador automaticamente e sem substituir a apuração humana do motivo. Nenhum código foi alterado para isso.

### Critérios de aceite propostos — procedimentos de conduta (não executados)

1. Um atraso de embarque, falta de aviso ou falta de booking mantém Vendedor como responsável e prazo Imediato, independentemente de qual fonte descreve o passo a passo da ação.
2. Nenhum dos três procedimentos é tratado como resolvido pela mera passagem de uma mensagem/evento; a divergência de texto de ação registrada acima permanece pendência de negócio, não decidida por inferência.
3. Comprador e Vendedor não são substituídos por identificadores de agente em nenhum registro derivado deste procedimento.

### Procedimentos mapeados para outros contratos (fora de escopo deste arquivo)

- **Etiquetas:** listado como "Problemas de Logística" nas fontes, mas `PROCEDIMENTOS_CONDUTA.md` atribui os requisitos de etiqueta a COMPLIANCE (proposta técnica, lote futuro) — não incorporado aqui.
- **Divergência de Peso:** `PROCEDIMENTOS_CONDUTA.md` atribui a QUALIDADE (o procedimento aciona o departamento de qualidade do vendedor) — ver [QUALIDADE](QUALIDADE.md).
- **Documentos Extraviados (DHL) / LOI:** `PROCEDIMENTOS_CONDUTA.md` atribui o suporte documental da LOI a DOCUMENTACAO — ver [DOCUMENTACAO](DOCUMENTACAO.md). LOGISTICS participaria apenas do rastreio operacional da remessa, sem procedimento próprio incorporado aqui.

## Critérios de aceite propostos

Rastreamento mocked; ETA inválida/alterada; fronteira do free time; containers repetidos; Calendar não configurado/indisponível; dois pedidos simultâneos para trackingId igual.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/logistics foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/logistics/index.js).
- [searatesQuery.js](../../src/agents/logistics/searatesQuery.js).
- [containerLinking.js](../../src/agents/logistics/containerLinking.js).
- [demurrage.js](../../src/agents/logistics/demurrage.js).
- [calendarEvent.js](../../src/agents/logistics/calendarEvent.js).
- [paymentTrackingCalendarEvent.js](../../src/agents/logistics/paymentTrackingCalendarEvent.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).
- [Fonte A dos procedimentos de conduta](CONDUTA_FONTE_A.txt); [Fonte B dos procedimentos de conduta](CONDUTA_FONTE_B.txt); [registro de precedência](PROCEDIMENTOS_CONDUTA.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
