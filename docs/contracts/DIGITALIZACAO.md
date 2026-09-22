# DIGITALIZACAO — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Classifica e extrai campos, avalia confiança e sugere associação/destino. Não confirma pagamento, aprova qualidade ou autentica documento.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/digitalizacao/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`ftrCode`, `filename`, `mimeType`, `fileBase64`, `docTypeHint`, `market`; FTR é exigido por route(). O formato de cada extração depende do tipo documental, definido em extractors/.

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

`agent`, `ftr_code`, `content_hash`, `classified_doc_type`, `classification_confidence`, `extraction_method`, `cost_tier_used`, `extracted_fields`, `field_confidence`, `overall_confidence`, `confidence_band`, `cross_validation`, `relationship`, `needs_review`, `escalated_to_excecoes`, `routed_to`.

## Regras implementadas

Prioriza arquivo estruturado ou texto de PDF. Sem método utilizável, retorna resultado não resolvido e escala a EXCECOES; OCR não está implementado nesse fluxo. Confiança usa CONFIG.DIGITALIZACAO. routed_to mapeia laudo→qualidade, SWIFT→financeiro, contrato→contratos, ACID/permit→compliance e documentos de embarque→documentacao; é informação, não chamada automática.

## Efeitos, persistência, erros e repetição

Lê dados por validação cruzada/resolução de entidade; pode gravar fila/auditoria indiretamente por EXCECOES. Calcula hash, mas index.js não usa consulta de hash para evitar processamento repetido. Falhas das dependências podem propagar; nenhuma fila de revisão completa é implementada aqui.

## Lacunas e limites

Sem OCR ativo, revisão humana completa ou entrega automática ao próximo agente. Extração/confiança não comprova autenticidade. Repetir arquivo pode repetir efeitos de escalonamento. Chamar novamente route() sob o mesmo lock pode bloquear; a entrega precisa ocorrer após retorno.

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

PRD RDIA existente; amostras anonimizadas por tipo e formato; gabaritos de campos; casos ambíguos/corrompidos; política de confiança; regras de vínculo documental; limites de tamanho e retenção.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Quem revisa; campos críticos que impedem aceite; origem e calibração dos limiares; política para FTR desconhecida; versão do extrator/hash; custódia dos arquivos; futura cobertura OCR.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Critérios de aceite propostos

Planilha/texto de PDF; imagem sem OCR; arquivo corrompido; classificação desconhecida; conflito de campo/entidade; baixa confiança; arquivo repetido; falha de consulta/escalonamento.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/digitalizacao foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/digitalizacao/index.js).
- [structuredFileExtractor.js](../../src/agents/digitalizacao/structuredFileExtractor.js).
- [textLayerDetector.js](../../src/agents/digitalizacao/textLayerDetector.js).
- [docClassifier.js](../../src/agents/digitalizacao/docClassifier.js).
- [confidenceScoring.js](../../src/agents/digitalizacao/confidenceScoring.js).
- [crossValidation.js](../../src/agents/digitalizacao/crossValidation.js).
- [entityResolution.js](../../src/agents/digitalizacao/entityResolution.js).
- [errorCodes.js](../../src/agents/digitalizacao/errorCodes.js).
- [extractors/index.js](../../src/agents/digitalizacao/extractors/index.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
