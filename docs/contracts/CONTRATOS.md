# CONTRATOS — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Extrai termos por padrões textuais, calcula indicadores e registra auditoria de aditivo. Não autentica assinaturas nem executa um ciclo jurídico de aprovação.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/contratos/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`body` (default vazio), `ftrCode`, `buyer.credit_limit_usd`, `sellerSigned`, `buyerSigned`, `userEmail`, `previousQuantityMt`. Flags de assinatura são fornecidas pelo chamador.

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

`agent`, `parsed`, `total_value_usd`, `credit_check`, `signature_check`, `new_ftr_code`, `audit_id`. Os dois últimos são null sem aditivo.

## Regras implementadas

Termos extraídos incluem partes, quantidade, grade, preço, Incoterm, pagamento, entrega e alteração de quantidade. Assinatura completa usa Boolean(sellerSigned) && Boolean(buyerSigned), sem validação estrita de tipo. Versionamento aceita cinco dígitos, hífen, dois dígitos e sufixo opcional; incrementa o sufixo.

## Efeitos, persistência, erros e repetição

Aditivo grava AUDIT_LOG no Firestore usando identificação baseada em Date.now(). Retorna novo código; isso não equivale a gravar uma nova FTR no cadastro. Código inválido para versionamento e falhas de persistência propagam.

## Lacunas e limites

Não há comprovação da identidade de signatários, autorização de aditivo nem idempotência transacional. Repetição pode gerar outra auditoria; concorrência pode colidir em identificadores de milissegundo. O nome do usuário no contexto não é autenticação.

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

Modelos aprovados de contrato e aditivo; cláusulas obrigatórias; evidências aceitas de assinatura; exemplos de alterações e regras de impacto sobre documentos/pagamento.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Autoridade para aprovar aditivo; identidade estável da operação versus versão; retenção de assinaturas; aplicação do novo código; revalidação de preço, compliance e qualidade.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Critérios de aceite propostos

Texto incompleto; assinatura ausente e string 'false'; aditivo duplicado; versões concorrentes; falha de gravação; interpretação de separadores decimais.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/contratos foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/contratos/index.js).
- [parser.js](../../src/agents/contratos/parser.js).
- [signature.js](../../src/agents/contratos/signature.js).
- [versioning.js](../../src/agents/contratos/versioning.js).
- [auditTrail.js](../../src/agents/contratos/auditTrail.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
