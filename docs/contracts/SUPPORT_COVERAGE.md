# Cobertura documental completa — agentes e orquestração

Status: levantamento local em 2026-09-10. Sete minutas novas não encerram as lacunas. Não houve busca no Drive nem validação de materiais externos.

## Pacote necessário para cada um dos 12 agentes

| Camada | Base encontrada | Complemento necessário |
|---|---|---|
| Objetivo, usuários e escopo | Roadmap geral; PRD dedicado RDIA | Escopo individual e exclusões revisados pelos responsáveis |
| Features/requisitos | Código, roadmap e contratos | [Catálogo](FEATURE_CATALOG.md), decomposição atômica e rastreabilidade |
| Especificação funcional | Cinco contratos P0; sete novas minutas; [ORQUESTRADOR.md](ORQUESTRADOR.md) como 13º documento (minuta técnica, não um dos 12 agentes) | Fluxos normal/alternativo, regras, estados, decisões humanas e casos de uso |
| Contratos de dados | Campos no código; schemas/SQL; RDIA | Schemas executáveis coerentes, tipos, nulabilidade, exemplos e versionamento |
| Skills/prompts | System Contract documental RDIA | [Inventário](SKILLS_INVENTORY.md), procedimentos e ferramentas antes de instalação |
| Ferramentas/integrações | Serviços, rotas, Apps Script e deploy | Fonte real versus mock, autenticação, limites, timeout, erros, sandbox e responsável |
| Conhecimento e templates | Constantes/modelos em código | Fonte aprovada, vigência, exemplos anonimizados e dono de atualização |
| Workflow/eventos | Master e PoC Temporal | Máquina de estados do negócio, handoffs, contratos de eventos e compensação |
| Persistência | FIRESTORE_SUPABASE, migrações e baseline | Resolver autoridade em ADR-007, retenção, exclusão, unicidade e recuperação |
| Segurança/permissões | Middleware, regras e roadmap | Alçadas por ação, dados acessíveis, trilha de decisão e validação por ambiente |
| Testes/avaliações | Testes unitários, integração e PoC | Matriz requisito→teste→evidência; casos adversos, concorrência e amostras reais anonimizadas |
| Operação | DEPLOY geral, logs e contratos | Runbook por falha, revisão humana, SLAs/SLOs, métricas, alertas e responsáveis |
| Ciclo de vida | Git e ADRs | Versões, dependências, migração, critérios de promoção e rollback |

## Materiais de negócio por agente

| Agente | Material a localizar/validar |
|---|---|
| [COMUNICACAO](COMUNICACAO.md) | Mensagens com gabarito; respostas aprovadas; vínculo conversa/FTR |
| [COMERCIAL](COMERCIAL.md) | Modelos de oferta; política de preços/crédito; alçadas. Interlocução comercial/comprador alternativo mapeada em [PROCEDIMENTOS_CONDUTA.md](PROCEDIMENTOS_CONDUTA.md), ainda não incorporada (3º lote) |
| [CONTRATOS](CONTRATOS.md) | Contrato padrão; cláusulas; aditivos e assinaturas anonimizadas |
| [COMPLIANCE](COMPLIANCE.md) | Matriz por mercado/produto; fontes oficiais datadas; responsáveis. Procedimento "Etiquetas" mapeado em `PROCEDIMENTOS_CONDUTA.md`, ainda não incorporado (3º lote) |
| [DOCUMENTACAO](DOCUMENTACAO.md) | Modelos por tipo/mercado; instruções de emissão e assinatura. Procedimentos de conduta (documentação errada, cópias, DHL/LOI) já incorporados |
| [FINANCEIRO](FINANCEIRO.md) | Confirmação de crédito (canal e responsáveis já **aprovados** em [FIN-DEC-01–21](FINANCEIRO_DECISIONS.md), não implementados); política de conciliação; alçadas |
| [QUALIDADE](QUALIDADE.md) | Laudos com gabaritos; especificações do comprador; fonte de acreditação. 11 procedimentos de conduta de qualidade já incorporados |
| [LOGISTICS](LOGISTICS.md) | Bookings/BL; contrato de free time; payloads de provedor. Procedimentos de conduta de embarque/booking já incorporados |
| [COMISSOES](COMISSOES.md) | Acordos; beneficiários; exemplos calculados; regras de estorno |
| [EXCECOES](EXCECOES.md) | Runbook; taxonomia de erros; alçadas; exemplos de incidentes. Papel transversal de acompanhamento de prazos de conduta proposto (não aprovado) |
| [MONITOR](MONITOR.md) | Dicionário de KPIs; fórmulas; fontes; exemplos e destinatários |
| [DIGITALIZACAO](DIGITALIZACAO.md) | Corpus anonimizado; gabaritos por campo; limiares; conflitos |

Materiais não vinculados não são automaticamente inexistentes. Estado inicial: A_LOCALIZAR/VALIDAR. Donos nominais, links externos e datas de aprovação permanecem não informados.

**ORQUESTRADOR (2026-09-22):** não é um dos 12 agentes da tabela acima — é uma minuta técnica separada, [ORQUESTRADOR.md](ORQUESTRADOR.md), status DRAFT/TECHNICAL_PROPOSAL. Suas pendências de arquitetura, operação e negócio já estão listadas na própria seção "Open Decisions" desse documento — não duplicadas aqui: motor e persistência/ADR-007 (arquitetura); limites de retry e escalonamento (operação); retenção e revogação (negócio).

**Precedência dos procedimentos de conduta:** onde referenciados acima, a Fonte B prevalece sobre a Fonte A **somente** em prazo e responsável — decisão registrada em [PROCEDIMENTOS_CONDUTA.md](PROCEDIMENTOS_CONDUTA.md), não em [FIN-DEC-01–21](FINANCEIRO_DECISIONS.md), que trata de um conjunto de decisões distinto (a confirmação financeira de FINANCEIRO) e não estabelece essa precedência. Diferenças de ação/evidência continuam pendência de negócio, não resolvidas por inferência. Aprovado não equivale a implementado em nenhum dos casos citados.

## Bases existentes a preservar e reconciliar

- [Plano de contratos](DOCUMENTATION_PLAN.md) e [matriz P0](P0_AUTHORITY_MATRIX.md).
- [FIN-DEC-01 a 21](FINANCEIRO_DECISIONS.md), [ORQUESTRADOR.md](ORQUESTRADOR.md) (minuta técnica separada), [Fonte A](CONDUTA_FONTE_A.txt), [Fonte B](CONDUTA_FONTE_B.txt) e [precedência dos procedimentos de conduta](PROCEDIMENTOS_CONDUTA.md) — todos adicionados após esta leva original, commits `2e3492b` e `7fe8dbf`.
- [RDIA PRD](../RDIA_PRD.md): escopo, provenance, extração, confiança, erros e system contract de DIGITALIZACAO.
- [Pagamentos/tracking](../PAGAMENTOS_TRACKING.md): FINANCEIRO, LOGISTICS e intake; revisar afirmações temporais de implementação.
- [Arquitetura](../ARQUITETURA.md), [roadmap](../ROADMAP.md), [dados](../FIRESTORE_SUPABASE.md), [deploy](../DEPLOY.md).
- [Gmail intake](../../apps-script/gmail-intake/README.md) e [Gmail sync](../../apps-script/gmail-sync/README.md).
- [Baseline](../adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md), [ADR-001A](../adr/ADR-001A-durable-workflow-engine.md) e [contrato PoC](../../poc/adr-001a/temporal/TEST_CONTRACT.md).

## Critério de aceite documental

Cada requisito deve ter ID, fonte, dono, estado de implementação, contrato/schema, skill quando aplicável e critério de teste. Cada documento de apoio deve ter link, origem, versão, vigência, aprovador e escopo. Cada lacuna deve indicar decisão/material/implementação pendente, responsável a designar e dependência.

Os 10 testes da PoC validam o escopo do motor documentado, não a completude destas 13 camadas para cada agente. Nenhuma mudança de produção, execução externa ou instalação de skill foi feita nesta revisão.
