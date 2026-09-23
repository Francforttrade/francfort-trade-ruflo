# Catálogo inicial de funcionalidades — 12 agentes

Status: inventário de código e lacunas, 2026-09-10. Não é declaração de homologação. Base: 178022a. O próximo passo é decompor cada grupo em requisitos atômicos e vincular testes/decisões.

| ID | Agente | Código observado | Parcial, planejado ou pendente |
|---|---|---|---|
| F-01 | [COMUNICACAO](COMUNICACAO.md) | Normalização, intenção, FTR, extração de referências, sessão e template | Duplicatas, revisão de ambiguidade, confiança conectada, handoff e envio real |
| F-02 | [COMERCIAL](COMERCIAL.md) | Preço por Incoterm, histórico, crédito, texto de oferta, prazos | Aprovação, consistência total/preço, oferta persistida/versionada, negociação durável |
| F-03 | [CONTRATOS](CONTRATOS.md) | Extração de termos, indicadores de assinatura, sufixo de versão, auditoria | Assinatura autenticada, aprovação do aditivo, atualização efetiva da FTR |
| F-04 | [COMPLIANCE](COMPLIANCE.md) | Checklist de três mercados, comparação de aflatoxina, alertas de validade | Cobertura restante, regras com fonte vigente, bloqueio ligado à emissão, escalonamento |
| F-05 | [DOCUMENTACAO](DOCUMENTACAO.md) | PDF BL/Invoice/CO/Phyto e checklist | Templates homologados, estados minuta/aprovado/original, validação de campos, custódia |
| F-06 | [FINANCEIRO](FINANCEIRO.md) | Validação de referência, gate, status/saldo e auditoria | Decisões de negócio já aprovadas (FIN-DEC-01–21, conjunto completo): confirmação por Rodrigo/Leonardo via WhatsApp, liberação parcial caso a caso, escopo por documento selecionado, uma única autorização enviada por e-mail e WhatsApp com resultado por destinatário/canal, e confirmação de entrega física por documento (FIN-DEC-18–21). Nenhuma implementada: integração WhatsApp, vínculo de identidade, persistência da confirmação, branch de pagamento parcial no gate, modelo de seleção de documentos, rastreio de entrega por documento |
| F-07 | [QUALIDADE](QUALIDADE.md) | Leitura de laudo, acreditação por lista, comparação, registro da decisão recebida | Recepção autenticada da decisão, lote/versão, rejeição/reteste, escalonamento |
| F-08 | [LOGISTICS](LOGISTICS.md) | Comparação de containers, cálculo de prazo, payload e integração Calendar | Rastreamento real, fonte de ETA, duplicatas concorrentes, validação de entradas |
| F-09 | [COMISSOES](COMISSOES.md) | Três modos de cálculo, ID e conciliação | Reconhecimento aprovado, razão de parcelas, emissão, sequência única e estorno |
| F-10 | [EXCECOES](EXCECOES.md) | Recomendação de retry, gravação de falha e override | Executor de retry, dono/resolução da fila, notificações, autorização do override |
| F-11 | [MONITOR](MONITOR.md) | Consultas e cálculos de KPIs, dashboard em objeto e flags | Produtores de seis campos, agenda, exportação e notificação |
| F-12 | [DIGITALIZACAO](DIGITALIZACAO.md) | Parser estruturado/texto PDF, extração, confiança, validação e associação | OCR, idioma, provenance por campo, cache, custos, eventos e revisão completa |

## Evidência e como interpretar

Fontes: os pontos de entrada index.js em src/agents, os módulos citados nos contratos e os cinco contratos P0 com suas seções Implementation Gaps. O [roteador](../../src/orchestrator/master.js) não implementa a sequência completa. O [roadmap](../ROADMAP.md) mistura intenções com checkboxes antigos; checkbox desmarcado não prova ausência de código.

Para cada feature detalhada registrar: ID, problema/usuário, gatilho, pré-condições, regra e fonte, dados de entrada, resultado, efeitos, exceções, aprovação, dependência, prioridade, responsável, critério de aceite e teste/evidência. Estado documental e estado de implementação são independentes.

## Divergências documentais que precisam de reconciliação

- Arquitetura e roadmap anunciam 11 agentes, mas master registra 12, incluindo DIGITALIZACAO.
- PAGAMENTOS_TRACKING.md afirma que extração PDF/Excel/Word não foi implementada naquela entrega. Hoje DIGITALIZACAO possui caminhos para arquivos estruturados/texto PDF. Isso não comprova ligação dos anexos Gmail a esse pipeline; separar capacidade do parser de integração do intake.
- Templates de COMUNICACAO dizem 'notificando' ou 'encaminhando', mas seu index.js retorna texto e grava sessão; esses verbos não provam efeito executado.
- Há funções de preço, comissão, assinatura e prazo, mas existência de cálculo não equivale a aprovação do negócio.
- O PRD RDIA §27 marca OCR, idioma, chunks semânticos, provenance, eventos, auditoria/custo e cache como pendentes. Mapear cada item ao código antes de promover seu estado.
- FINANCEIRO (F-06) tem agora decisões de negócio aprovadas para o fluxo completo de confirmação, liberação e entrega física (FIN-DEC-01–21, ver [FINANCEIRO](FINANCEIRO.md), seção "Acceptance Criteria Index" para o mapa das duas listas de critérios existentes). Não decidido: se a confirmação via WhatsApp é implementada dentro de FINANCEIRO ou de COMUNICACAO — COMUNICACAO é hoje AUTHORITATIVE para normalização de mensagens conforme [matriz P0](P0_AUTHORITY_MATRIX.md).

## Próxima especificação

Prioridade sugerida: confirmação financeira, aprovação humana, bloqueios documentais e recuperação; depois fontes de logística/comercial, comissão e observabilidade. A priorização é proposta, não decisão de implementação já aprovada.
