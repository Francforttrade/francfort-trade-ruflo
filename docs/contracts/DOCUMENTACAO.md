# DOCUMENTACAO — minuta de contrato e especificação

Status: DRAFT — revisão de negócio pendente. Base: commit 178022a, inspecionado em 2026-09-10.

Este documento registra comportamento observado e propostas separadamente. Não aprova regras comerciais/regulatórias, não atribui permissões e não afirma prontidão para produção. Consulte [índice da documentação](DOCUMENTATION_PLAN.md).

## Responsabilidade e autoridade atual

Gera PDFs a partir do contexto ou avalia checklist. PDF produzido não comprova emissão oficial, assinatura válida ou autorização de liberação.

## Invocação e entradas observadas

Entrada de módulo: `process(context)` em [index.js](../../src/agents/documentacao/index.js). O [roteador](../../src/orchestrator/master.js) chama uma vez e não executa a sequência completa. As [rotas HTTP](../../src/routes/index.js) expõem DOCUMENTACAO em POST /classificar-doc, LOGISTICS em GET /rastrear e DIGITALIZACAO em POST /digitalizar-doc; os demais componentes desta leva não têm rota própria nesse arquivo.

`ftrCode`; `docType` opcional (BL, Invoice, CO, Phyto). Sem tipo: `presentDocuments`, `etd`. Cada gerador consome campos próprios: BL usa partes, navio, portos, containers, peso e descrição; Invoice usa itens, total, pagamento e dados bancários; CO usa partes, produto, quantidade e origem; Phyto usa produto, quantidade, issueDate e labName. Os nomes completos permanecem nas assinaturas dos geradores citados.

Tipos e campos aqui descritos são consumo observado, não um schema validado. Não pressupor validação por existir um nome no contexto.

## Saídas observadas

Com tipo: `agent`, `ftr_code`, `doc_type`, `pdf_base64`; BL acrescenta `consignee_address_matches_buyer`; Phyto acrescenta `is_valid`. Sem tipo: `agent`, `ftr_code`, `checklist`, `within_sla`.

## Regras implementadas

Checklist fixo: BL, CO, Phyto, Fumigation, Invoice, Quality. SLA calculado como pelo menos 48h até ETD. Phyto usa 30 dias no código, sem verificação regulatória neste documento. CO inclui nome textual fixo de signatário. Invoice possui regra de apresentação bancária por mercado/nome do comprador; sua legitimidade e aplicabilidade precisam de revisão de negócio.

## Efeitos, persistência, erros e repetição

Retorna bytes PDF em base64 e logs; index.js não grava documentos nem envia originais. Tipo desconhecido lança Error; datas inválidas podem falhar durante conversão. Não há chave de versão nem deduplicação documental.

## Lacunas e limites

Não consulta aprovação financeira/compliance/qualidade antes de gerar. Checklist testa presença informada, não autenticidade. Não há geradores de Fumigation/Quality nesse mapa. Campos ausentes podem chegar ao PDF; geração não recalcula necessariamente os totais recebidos.

## Especificação alvo — proposta, não implementada

O futuro adaptador deve validar entradas e produzir resultado de sucesso, falha ou necessidade de revisão sem converter ausência de evidência em aprovação. Identidade da operação, versão, correlação, timeout, chave de idempotência e erros precisam ser definidos antes de congelar a interface. Esses campos ainda não compõem automaticamente a API atual.

A sequência de workflow e os estados persistentes dependem de decisões próprias do orquestrador e de propriedade dos dados. Este documento não resolve ADR-007 nem inicia integração Temporal ou execução LLM.

## Materiais de suporte a reunir

Modelos aprovados por tipo/mercado; amostras preenchidas anonimizadas; dicionário de campos; emissores habilitados; política de assinatura, versões, guarda e liberação.

Para cada material: registrar origem, versão/data de vigência, responsável pela manutenção, aprovador e operações às quais se aplica. Estado nesta revisão: materiais ainda não vinculados a esta minuta; sua ausência no projeto local não comprova inexistência fora dele.

## Decisões abertas

Separar minuta, documento aprovado e original; proprietário dos números; conjunto obrigatório por operação; bloqueios anteriores à emissão/liberação; responsável por validar regras específicas de mercado.

Responsáveis nominais e datas: a definir pelo negócio. Nenhuma decisão foi assumida como aprovada.

## Procedimentos de conduta incorporados (Fonte A/B)

Status: regra de negócio adotada nos campos gatilho/prazo/responsável (fontes preservadas integralmente em [CONDUTA_FONTE_A](CONDUTA_FONTE_A.txt) e [CONDUTA_FONTE_B](CONDUTA_FONTE_B.txt); precedência registrada em [PROCEDIMENTOS_CONDUTA](PROCEDIMENTOS_CONDUTA.md)). Onde a Fonte B diverge da Fonte A em prazo ou responsável, prevalece a Fonte B, conforme decisão do usuário de 2026-09-22. Vendedor e Comprador continuam sendo os responsáveis humanos definidos nas fontes; nenhum agente de software os substitui. Participação de agente é proposta técnica, não aprovada e não implementada.

### Regras adotadas

| Procedimento | Gatilho | Ação aprovada | Prazo | Responsável | Fonte |
|---|---|---|---|---|---|
| Documentação Errada | Documento emitido com erro | Solicitar os ajustes por parte do vendedor ou terceiro responsável | 1 dia | Vendedor | CONDUTA_FONTE_A.txt:17-19; CONDUTA_FONTE_B.txt:22-24 (texto idêntico nas duas fontes) |
| Falta da cópia dos documentos | Cópia de documento ausente | Solicitar as cópias ao Vendedor ou Comprador | Imediato | Vendedor ou Comprador | CONDUTA_FONTE_A.txt:25-27; CONDUTA_FONTE_B.txt:26-28 (texto idêntico nas duas fontes) |
| Documentos Extraviados (DHL) | Documentos extraviados pela DHL ou transportadora responsável | Solicitar explicações à DHL/responsável pela remessa **e** enviar LOI ao comprador para liberar a carga sem a documentação completa | 1 dia | Vendedor | CONDUTA_FONTE_A.txt:34-36; CONDUTA_FONTE_B.txt:35-37 (B apenas expande a sigla "LOI (Letter of Indemnity)"; prazo, responsável e ação substantiva são os mesmos — sem pendência) |

Os três procedimentos têm prazo e responsável idênticos nas duas fontes — não há divergência para a Fonte B resolver aqui; os textos de ação também convergem (Documentos Extraviados só difere na expansão da sigla LOI, não na ação em si).

### LOI, aflatoxina e reexportação — tratamento sem presunção de dispensa regulatória

Este procedimento aprova **registrar** a prática de enviar uma LOI ao comprador para liberar a carga sem a documentação completa — nas palavras das fontes. Isso não é interpretado aqui como: (a) dispensa de qualquer exigência regulatória de mercado/destino que ainda se aplique à liberação da carga; (b) autorização automática para o agente DOCUMENTACAO emitir, assinar ou enviar uma LOI real sem intervenção humana; ou (c) evidência de que o comprador ou a autoridade de destino aceitam a LOI em todos os casos. FIN-DEC-01–21 não tratam de LOI e não alteram nada aqui. Quem emite, assina e envia a LOI, sob quais condições contratuais e limites de valor, permanece pendência de negócio — não decidida por este registro.

### Participação proposta do agente DOCUMENTACAO (proposta técnica — não aprovada, não implementada)

`index.js` hoje gera PDF a partir do contexto ou avalia o checklist fixo (BL, CO, Phyto, Fumigation, Invoice, Quality) — não há gerador de LOI no mapa de módulos atual (`billOfLading.js`, `invoice.js`, `certificateOfOrigin.js`, `phytosanitary.js`, `checklist.js`, `pdfUtils.js`). Proposta técnica: um gerador de LOI seguiria o mesmo padrão dos demais geradores (produzir `pdf_base64` a partir de campos do contexto), mas isso é geração de documento, não emissão de autorização de negócio — o ato de decidir enviar/aceitar a LOI continua humano. Para Documentação Errada e Falta de cópia, o agente já teria, em tese, o `checklist` existente para sinalizar ausência/erro de campo, mas isso não é acionamento do procedimento de conduta em si (não notifica o vendedor, não conta o prazo).

### Critérios de aceite propostos — procedimentos de conduta (não executados)

1. Documentação Errada e Falta de cópia mantêm Vendedor/Comprador como responsáveis e os prazos acima, independentemente da fonte consultada.
2. O registro do procedimento de Documentos Extraviados (DHL)/LOI não implica que o agente esteja autorizado a emitir ou enviar uma LOI real, nem que exigências regulatórias de destino estejam dispensadas.
3. Comprador e Vendedor não são substituídos por identificadores de agente em nenhum registro derivado deste procedimento.

## Critérios de aceite propostos

Tipo não suportado; campos obrigatórios ausentes; total divergente dos itens; data inválida; checklist incompleto; limites de prazo; comprovação de que geração não representa aprovação.

Estes são cenários para especificação/homologação futura, não testes executados nesta revisão. Associar cada cenário a entrada sintética, resultado esperado, evidência e responsável. Os testes existentes em src/agents/documentacao foram inventariados; existência de arquivo de teste não comprova cobertura total ou aprovação atual.

## Operação e revisão humana

Definir quem recebe casos pendentes, prazo, canal, identidade do aprovador, evidência da decisão, expiração e retomada. Antes de reprocessar, conferir efeitos já realizados e chave da operação. Não presumir envio de alertas ou recuperação automática quando o código apenas retorna flags ou escreve logs.

## Fontes verificáveis

- [Ponto de entrada](../../src/agents/documentacao/index.js).
- [billOfLading.js](../../src/agents/documentacao/billOfLading.js).
- [invoice.js](../../src/agents/documentacao/invoice.js).
- [certificateOfOrigin.js](../../src/agents/documentacao/certificateOfOrigin.js).
- [phytosanitary.js](../../src/agents/documentacao/phytosanitary.js).
- [checklist.js](../../src/agents/documentacao/checklist.js).
- [pdfUtils.js](../../src/agents/documentacao/pdfUtils.js).
- [Roadmap de intenção](../ROADMAP.md): requisitos planejados, não prova de implementação.
- [Baseline da auditoria](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md).
- [Fonte A dos procedimentos de conduta](CONDUTA_FONTE_A.txt); [Fonte B dos procedimentos de conduta](CONDUTA_FONTE_B.txt); [registro de precedência](PROCEDIMENTOS_CONDUTA.md).

## Condição para fechar o contrato

Validar as decisões abertas; vincular os materiais de suporte; fechar schemas de entrada/saída e efeitos; atribuir responsáveis; mapear critérios de aceite às evidências. Só então promover esta minuta a contrato aprovado, com versão e registro de aprovação.
