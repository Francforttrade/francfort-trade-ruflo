# Aplicação dos pilares por agente

Status: prioridades propostas; nenhum requisito abaixo é declarado homologado. Referência: [requisitos de produção](PRODUCTION_READINESS.md). Todos os agentes devem atender aos sete pilares; esta matriz destaca necessidades específicas. Memória de LLM, compactação, judge e autocorreção generativa só se aplicam se esse runtime for adotado.

| Agente | Memória/dados e contexto | Observabilidade, segurança e evals | Resiliência, humano e governança |
|---|---|---|---|
| COMUNICACAO | Identidade de mensagem/conversa/FTR, retenção e dedup | Trace do intake; injection, extração incorreta, PII, duplicatas | Revisão de FTR ambígua; permissão de envio; reprocessamento sem sobrescrever evidência. Canal de confirmação por WhatsApp já **aprovado pelo negócio** (FIN-DEC-04–06); o que permanece proposta técnica não aprovada é atribuir a implementação desse canal a este agente, em [COMUNICACAO.md](COMUNICACAO.md), distinta do webhook geral já implementado |
| COMERCIAL | Oferta/versionamento e histórico com fonte/data | Consistência total/unitário, fonte de crédito e preço | Aprovação de oferta/exceção; validade; dados ausentes não aprovam. Papel de interlocução comercial/comprador alternativo mapeado em [PROCEDIMENTOS_CONDUTA.md](PROCEDIMENTOS_CONDUTA.md), ainda não incorporado (3º lote) |
| CONTRATOS | Contrato e aditivo vinculados à mesma operação | Fonte das cláusulas, assinatura e trilha antes/depois | Signatário/alçada, concorrência de versão, aditivo duplicado |
| COMPLIANCE | Regra por produto/mercado/versão/vigência | Fonte de requisito, limites exatos, mercado desconhecido | Resultado inconclusivo bloqueia avanço proposto; decisão técnica responsável. Procedimento de conduta "Etiquetas" mapeado em [PROCEDIMENTOS_CONDUTA.md](PROCEDIMENTOS_CONDUTA.md), ainda não incorporado (3º lote) |
| DOCUMENTACAO | Original, extração e minuta separados/versionados | Provenance dos campos, template, validade e destinatário | Emissão versus preparação; gates; identidade de documento; rollback sem apagar original. Procedimentos de conduta (documentação errada, cópias, DHL/LOI) já incorporados em [DOCUMENTACAO.md](DOCUMENTACAO.md) |
| FINANCEIRO | Crédito/recebimento com evidência persistida | Auditoria da conciliação e gate; adulteração de dados; sem PII nos logs | Autorização financeira independente (desenho aprovado em [FIN-DEC-01–21](FINANCEIRO_DECISIONS.md), não implementado); efeito externo incerto; nenhuma duplicação de liberação |
| QUALIDADE | Lote, laudo, especificação e revisão | Laboratório/fonte, unidade, conflito e limiar | Aprovação autenticada vinculada à versão; rejeição/reteste; timeout da revisão. 11 procedimentos de conduta de qualidade já incorporados em [QUALIDADE.md](QUALIDADE.md) |
| LOGISTICS | ETA/ETD com origem/data, booking e containers | Mock versus real, staleness, falha do provedor | Evento Calendar idempotente; alternativa de consulta autorizada; alteração de viagem. Procedimentos de conduta de embarque/booking já incorporados em [LOGISTICS.md](LOGISTICS.md) |
| COMISSOES | Acordo/versionamento, beneficiário, parcelas | Cálculo e arredondamento, conciliação e IDs | Aprovação de reconhecimento/pagamento; estorno; unicidade de numeração |
| EXCECOES | Incidente, tentativas e decisões preservados | Erro por ferramenta, fila, duplicação e override | Dono único de retry; alçada de override; encerramento e reabertura auditados. Papel transversal de acompanhamento de prazos de conduta proposto (não aprovado) em [EXCECOES.md](EXCECOES.md) |
| MONITOR | Janela, denominador, origem e atualização de KPI | Qualidade dos dados, latência, erro/custo e ausência explícita | Consulta com menor privilégio; alerta com dono; não altera estado do negócio. KPIs candidatos do fluxo de confirmação (FIN-DEC-01–21) só sinalizados, não adotados, em [MONITOR.md](MONITOR.md) |
| DIGITALIZACAO | Arquivo/hash, extração, trecho e versão de extrator | Injeção documental; precisão por campo; confiança calibrada | Conflito/OCR ausente para revisão; limite de custo; documento não autoriza ação |

## Infraestrutura compartilhada

- Orquestração: estado durável, correlação, sinal autenticado, dedup, retry/compensação e interrupção — proposta técnica detalhada (eventos, estados, dedupe, tratamento de falha), não aprovada nem implementada, em [ORQUESTRADOR.md](ORQUESTRADOR.md).
- Identidade: credenciais por função, autorização por ação/recurso e trilha de aprovação.
- Conhecimento: fontes versionadas, ACL, expiração e recuperação; RAG só se necessário.
- Observabilidade: formato comum, minimização, retenção, painéis, SLOs e alertas acionáveis.
- Auditoria: mecanismo de integridade e retenção independente de logs operacionais.
- Evals e releases: datasets, rubricas, resultados e gates de promoção versionados.

## Atualização de referências (2026-09-22)

A tabela e a lista acima foram escritas antes de FIN-DEC-01–21, dos procedimentos de conduta e de [ORQUESTRADOR.md](ORQUESTRADOR.md); onde a informação ficou incompleta, as células e a linha "Orquestração" foram editadas diretamente, acima, com a referência cruzada — este ponto só cobre o que não cabe em célula de tabela.

- **ORQUESTRADOR não é um dos 12 agentes desta tabela** — é uma minuta técnica separada, [ORQUESTRADOR.md](ORQUESTRADOR.md), status DRAFT/TECHNICAL_PROPOSAL, não implementada e não aprovada.
- **Três categorias que não devem ser confundidas nesta tabela nem nos contratos citados:** (1) *responsável humano* — quem as fontes de negócio já nomeiam (Rodrigo, Leonardo, Vendedor, Comprador, comprador da FTR); (2) *participação proposta do agente* — sugestão técnica não aprovada e não implementada (ex.: "Revisão de FTR ambígua" na linha COMUNICACAO); (3) *mecanismo implementado* — o que o código hoje efetivamente faz, registrado nas "Fontes verificáveis" de cada contrato. Nenhuma célula desta tabela deve ser lida como prova de implementação.

## Ordem sugerida

P0: evidência bancária real; aprovação autenticada; gates ligados às ações; identidade/permissões; efeitos idempotentes; preservação da auditoria. P1: tracing/métricas, catálogo de erros/runbooks e regressão por feature. Antes de qualquer LLM: skills versionadas, isolamento de conteúdo, evals, orçamento de contexto/custo e limites de correção. Persistência/recuperação precisa de projeto e testes próprios antes da promoção pertinente.

Responsáveis, limites numéricos e plataformas permanecem a definir; não há autorização implícita de operações externas. Os documentos desta leva são especificações e inventários, não implementação de infraestrutura.
