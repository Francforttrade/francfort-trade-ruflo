# Requisitos transversais de prontidão para produção

Status: especificação proposta a partir dos sete pilares solicitados pelo usuário; não implementada nem aprovada operacionalmente. Base inspecionada: 178022a em 2026-09-10. Aplica-se aos 12 agentes e ao orquestrador — este último descrito em [ORQUESTRADOR.md](ORQUESTRADOR.md), minuta técnica separada dos 12 agentes, status DRAFT/TECHNICAL_PROPOSAL. Complementa [cobertura documental](SUPPORT_COVERAGE.md), [features](FEATURE_CATALOG.md), [skills](SKILLS_INVENTORY.md) e [matriz por agente](PRODUCTION_AGENT_MATRIX.md).

**Nota de leitura (2026-09-22):** este documento antecede [FIN-DEC-01 a 21](FINANCEIRO_DECISIONS.md), os [procedimentos de conduta](PROCEDIMENTOS_CONDUTA.md) e `ORQUESTRADOR.md`. Onde citados abaixo, três categorias continuam distintas: *responsável humano* (Rodrigo, Leonardo, Vendedor, Comprador — já nomeados nas fontes de negócio), *participação proposta do agente* (sugestão técnica não aprovada, não implementada) e *mecanismo implementado* (o que o código hoje efetivamente faz). Decisão aprovada não equivale a requisito implementado.

## 1. Memória e contexto — MEM

MEM-01: separar estado transacional do workflow, memória episódica de interações e conhecimento semântico versionado. Preferências não podem alterar regras de compliance ou autorização. Fonte oficial de dados continua dependente de ADR-007.

MEM-02: cada item de memória deve registrar origem, escopo de acesso, versão, validade/TTL, finalidade e política de correção/exclusão. Recuperação deve respeitar identidade e permissões da operação; conteúdo recuperado não é instrução privilegiada.

MEM-03: para chamadas LLM futuras, definir orçamento de contexto, reserva de saída e seleção de evidências. Compactação deve preservar IDs, decisões pendentes, restrições e links às fontes; resumo é derivado e não substitui evidência original.

MEM-04: escolher RAG/banco vetorial somente se os casos de recuperação exigirem. Estado transacional não deve ser substituído por busca semântica. Armazenamento vetorial não é requisito universal para agentes determinísticos.

Aceite: sessão longa mantém fatos críticos após compactação; fontes revogadas deixam de ser recuperadas; dado de outra operação sem permissão não aparece; conflito é preservado; correção/exclusão alcança cache/índice conforme política.

Evidência atual: COMUNICACAO grava sessões; isso não comprova memória episódica/semântica ou compactação. RDIA §19 declara que embeddings não existem. Implementação LLM/recuperação: pendente de decisão própria.

## 2. Observabilidade e tracing — OBS

OBS-01: correlacionar request, FTR, workflow/run, atividade, versão do agente/skill/modelo quando aplicável e chamada de ferramenta. Registrar etapa, horários, resultado, erro e referência à evidência, com dados minimizados.

OBS-02: medir latência por etapa, falhas por ferramenta, retries, fila/revisão, tokens e custo quando houver modelo. Distinguir custo observado de estimativa; ausência de medição não equivale a zero. Donos, SLOs e limites numéricos: a definir.

OBS-03: registrar justificativa resumida verificável, regra aplicada e decisão. Não capturar nem exigir raciocínio interno privado (chain-of-thought). Não armazenar indiscriminadamente prompts completos, documentos, segredos ou PII em traces.

Aceite: reconstruir uma execução e seus efeitos por correlação; erro externo identifica etapa/tentativa; métricas não duplicam contagem em replay; logs de teste não expõem segredos.

Atual: logger Winston produz JSON, timestamp e service; PoC demonstra correlação no escopo sintético. Tracing distribuído completo, custo e operação contínua não estão comprovados. OpenTelemetry/LangSmith/Phoenix são opções citadas pelo usuário, não tecnologia selecionada neste documento.

## 3. Guardrails e fundamentação — SEC

SEC-01: validar schemas, tipos, tamanho, MIME, campos obrigatórios e outputs; separar conteúdo externo de instruções e permissões. Filtrar/mascarar dados sensíveis conforme finalidade sem perder a evidência autorizada.

SEC-02: cada afirmação operacional crítica deve ter fonte e versão verificáveis; comparar valores calculáveis por código. Ausência/conflito gera estado explícito de revisão. Groundedness pode validar referência, trecho e consistência; não garante por si só a verdade de toda afirmação livre.

SEC-03: controles antes e depois das ferramentas; ferramenta e recurso devem pertencer ao escopo autorizado. Testar prompt injection em documento, email e memória recuperada quando usados por modelo. Sanitização textual isolada não substitui controle de permissões.

Aceite: documento que tenta mudar regras não ganha autoridade; output inválido não produz efeito; fonte ausente não libera documento; dado sensível não aparece em destinatário/log indevido.

Atual: webhook usa segredo compartilhado; RDIA tem regras de confiança/conflito e especificação anti-injection. Isso não demonstra autorização granular, proteção abrangente de PII ou groundedness completo. Confiança por regex não é probabilidade calibrada.

## 4. Avaliação contínua — EVAL

EVAL-01: vincular requisito e feature a entradas/gabaritos versionados, resultado e evidência. Cobrir caminho feliz, falhas, concorrência, duplicação, limites, dados ausentes, ferramentas indisponíveis e permissões.

EVAL-02: regressão em toda alteração relevante de código, contrato, modelo, prompt, skill, ferramenta ou corpus. Versionar configuração e comparar contra baseline; thresholds e aprovadores definidos antes da promoção.

EVAL-03: se houver LLM-as-a-Judge, usar rubrica, amostra humana calibrada, repetição e registro de versão; não usar o juiz como único aprovador de pagamentos, regras regulatórias ou permissões. Avaliações determinísticas continuam obrigatórias para regras objetivas.

Aceite: mudança regressiva reprova a promoção; fixture e resultado são reproduzíveis; teste de integração simulado é distinguido de externo; juiz discorda/oscila sem ocultar incerteza.

Atual: testes unitários e integração existem; PoC do motor executada. Não foi executada nova suíte nesta revisão nem demonstrado pipeline contínuo de evals LLM.

## 5. Resiliência e HITL — RES/HITL

RES-01: definir timeout, backoff limitado, dono do retry, circuit breaker/quota quando necessário, idempotência, compensação e tratamento de resultado externo incerto. Não repetir escrita externa sem verificar efeito anterior.

HITL-01: aprovação deve identificar aprovador autenticado, alçada, objeto/versão, ação exata, motivo, evidência, validade e consumo da aprovação. Negação, expiração, revogação e mudança do objeto invalidam o caminho de execução.

FIN-DEC-01–21 já aprovam, em nível de negócio, parte deste requisito para FINANCEIRO: identidade (Rodrigo ou Leonardo), objeto/versão (FTR, autorização, documentos selecionados) e não duplicação do consumo da aprovação. Decisão aprovada, implementação pendente — não implementada em código, e não se estende por inferência a outros agentes. Os [procedimentos de conduta](PROCEDIMENTOS_CONDUTA.md) definem, para LOGISTICS/DOCUMENTACAO/QUALIDADE, prazo e responsável humano (Vendedor/Comprador) em casos críticos — precedência da Fonte B limitada a esses dois campos; não definem identidade autenticada, alçada de execução (LOI/reexportação) nem os demais elementos de HITL-01.

RES-02: degradação produz estado claro e fila com responsável. Alertar não é resolver. Definir recuperação, RPO/RTO e testar queda do servidor/persistência em campanha própria.

Aceite: timeout após efeito não duplica operação; aprovação repetida não duplica ação; comprador sem alçada não libera financeiro; operação alterada exige nova avaliação; erro permanente não entra em loop.

Atual: EXCECOES recomenda retry e grava fila; mecanismo de aprovação de comprador é incompleto. PoC testa worker, retry e signal; não comprova identidade humana nem recuperação após queda do servidor. `ORQUESTRADOR.md` (DRAFT/TECHNICAL_PROPOSAL, minuta separada dos 12 agentes) propõe — sem aprovação nem implementação — a coordenação de espera por dois sinais independentes em qualquer ordem e o dedupe de reinvocação sem duplicar efeito; não substitui nenhuma decisão registrada acima.

## 6. Correção controlada — COR

COR-01: permitir alternativa apenas dentro de ferramentas, dados e objetivos autorizados; limitar tentativas, tempo e custo. Persistir a razão resumida e resultado de cada alternativa.

COR-02: não alterar regras, critérios de aceite, permissões ou evidências para obter sucesso. Reavaliar erros transitórios versus erros de entrada/negócio; parar e encaminhar quando não houver alternativa válida.

Aceite: falha de leitura permite alternativa aprovada; falha de autorização não provoca bypass; orçamento esgotado encerra com estado rastreável; sucesso não apaga falha anterior.

Atual: sem loop de planejamento LLM comprovado. ReAct/Plan-and-Solve não são escolhidos nem exigidos; correção pode ser determinística.

## 7. Governança e auditoria — GOV

GOV-01: matriz ator/ação/recurso; identidades e credenciais com menor privilégio; segregação leitura/escrita/aprovação; rotação/revogação e acesso de emergência auditado. Confirmar configuração real de cada ambiente.

GOV-02: trilha preservada com identidade, ação, objeto/versão, antes/depois quando aplicável, evidência, resultado e correlação. Definir retenção, acesso e mecanismo de imutabilidade ou detecção de adulteração; uma collection chamada AUDIT_LOG não basta.

GOV-03: promoção exige versão de código/modelo/skill/dados, responsáveis, evals e rollback. Definir interrupção operacional e resposta a incidentes.

Aceite: credencial fora de escopo é negada; tentativa de alteração da auditoria é impedida/detectada conforme desenho; revogação é efetiva; rollback é ensaiado sem apagar evidências.

Atual: regras Firestore negam clientes, mas backend usa service account que as contorna; IAM real não foi auditado. Writes AUDIT_LOG por set não comprovam imutabilidade.

## Fechamento e evidência

Estado inicial dos requisitos: PROPOSTO; bases existentes são parciais, não aceite final. Cada requisito precisa de dono nominal, prioridade, especificação detalhada, teste, evidência, dependências e data de revisão. [Matriz por agente](PRODUCTION_AGENT_MATRIX.md) orienta aplicação. Decisões sobre runtime LLM pertencem a ADR-001B, e dados a ADR-007; este documento não as resolve.
