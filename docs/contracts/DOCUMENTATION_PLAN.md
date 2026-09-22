# Plano de fechamento documental dos agentes

Status: trabalho documental em revisão. Base de código 178022a; inspeção 2026-09-10. Não houve alteração de runtime nem nova execução da PoC.

## Evidência e escopo

Foram preparados sete contratos em estado DRAFT. Os cinco contratos P0 existentes foram preservados. A revisão consultou o projeto local; não pesquisou Drive nem todas as memórias externas do Claude. Materiais solicitados abaixo podem existir fora do repositório.

Separar sempre: comportamento observado, requisito proposto, decisão pendente e evidência de teste. Um arquivo chamado contrato não significa aprovação operacional.

## Índice dos novos contratos

- [COMERCIAL](COMERCIAL.md): minuta com especificação, suporte, decisões e aceite.
- [CONTRATOS](CONTRATOS.md): minuta com especificação, suporte, decisões e aceite.
- [DOCUMENTACAO](DOCUMENTACAO.md): minuta com especificação, suporte, decisões e aceite.
- [LOGISTICS](LOGISTICS.md): minuta com especificação, suporte, decisões e aceite.
- [COMISSOES](COMISSOES.md): minuta com especificação, suporte, decisões e aceite.
- [EXCECOES](EXCECOES.md): minuta com especificação, suporte, decisões e aceite.
- [DIGITALIZACAO](DIGITALIZACAO.md): minuta com especificação, suporte, decisões e aceite.

## Pendências dos cinco contratos P0

| Contrato | Especificação/decisão pendente | Suporte necessário |
|---|---|---|
| [FINANCEIRO](FINANCEIRO.md) | Evidência de crédito; substituir confirmação simulada; reconciliar status; ligar alertas; limites de intervenção e efeito da liberação | Exemplos anonimizados de confirmação, política de conciliação, alçadas e trilha da confirmação |
| [COMPLIANCE](COMPLIANCE.md) | Cobertura de mercados; fonte/vigência das regras; mercado desconhecido; bloqueio antes do BL; persistência/escalonamento | Matriz de requisitos validada por responsável, fontes oficiais datadas e casos aprovados/reprovados |
| [QUALIDADE](QUALIDADE.md) | Captura da decisão do comprador; vínculo ao lote/laudo/versão; repetição, rejeição e nova análise | Laudos anonimizados, cadastro/fonte de acreditação e exemplos de aprovação/rejeição com evidência |
| [COMUNICACAO](COMUNICACAO.md) | Mensagens repetidas; vínculo sessão/FTR; fila de ambiguidade; confiança; entrega ao próximo componente | Mensagens anonimizadas e gabaritos, templates aprovados, regras de identificação e revisão |
| [MONITOR](MONITOR.md) | Produtores dos seis campos de indicadores; frequência, denominadores e ausência de dados; separar métricas operacionais de negócio | Dicionário de KPIs, exemplos calculados, responsáveis por dados, prazos e destinatários |

As lacunas acima estão registradas nas seções Implementation Gaps/Open Decisions dos contratos existentes; seu fechamento requer confirmação de implementação e de negócio, não somente redação.

## Dependências transversais

1. Contrato do orquestrador: eventos, sequência, esperas, cancelamentos, recuperação e fronteiras com cada componente. Hoje master.route faz uma chamada, não uma execução durável completa.
2. ADR-007: fonte oficial de cada dado, conflito Firestore/Supabase e responsabilidades de gravação. Não decidida neste pacote.
3. Expandir [matriz P0](P0_AUTHORITY_MATRIX.md) para os 12 componentes e atores humanos; não atribuir aprovação ao mero produtor de informação.
4. Aprovação humana: identidade, alçada, evidência, objeto/versão, expiração, revogação e retomada.
5. Catálogo de eventos/erros: correlação, deduplicação e dono das tentativas, evitando retries sobrepostos entre aplicação e motor.
6. Reconciliar arquitetura/roadmap que ainda anunciam 11 agentes com os 12 registrados no código.
7. Conferir e reparar, em tarefa própria, config/schemas.json registrado como inválido na auditoria; não usá-lo como interface executável validada.
8. Preservar evidências da PoC: 10 testes executados, TEST-01 a 09 PASS, TEST-10 FAIL original e PASS no adendo. Isso não aprova serviços externos simulados nem persistência após queda do servidor.

## Ordem sugerida de fechamento

- Leva 1: revisar estas sete minutas contra código e fontes de negócio; marcar dúvidas sem inventar resposta.
- Leva 2: obter materiais e decisões para FINANCEIRO, COMPLIANCE, QUALIDADE, DOCUMENTACAO e EXCECOES, por controlarem liberação, revisão e recuperação.
- Leva 3: fechar schemas, eventos, autoridade dos dados e contrato do orquestrador; manter decisões arquiteturais em seus registros próprios.
- Leva 4: vincular cenários de aceite e procedimentos de operação; executar homologação autorizada depois da implementação pertinente.

## Registro de materiais de suporte

Para cada agente, abrir uma linha por documento com: identificador; título; link/local; fonte; versão; vigência; responsável; aprovador; requisito suportado; sensibilidade; estado (a localizar, recebido, revisado, aprovado, substituído). Não incluir credenciais nem dados pessoais reais em amostras de teste.

## Critério de conclusão

Cada um dos 12 agentes precisa de contrato revisado, regras com fonte e responsável, entradas/saídas versionadas, efeitos e falhas descritos, materiais vinculados e critérios de aceite rastreáveis. Decisões pendentes continuam explícitas. Ter doze arquivos não equivale a doze contratos aprovados.

## Procedimentos de conduta aprovados para incorporação

Consultar obrigatoriamente [PROCEDIMENTOS_CONDUTA](PROCEDIMENTOS_CONDUTA.md) e as duas fontes integrais antes de revisar os contratos dos agentes. A adoção foi solicitada em 2026-09-22; a Fonte B prevalece nas divergências de prazo e responsabilidade, conforme confirmação do usuário em 2026-09-22. Diferenças de ação/evidência permanecem identificadas, sem precedência geral inferida. A incorporação ainda não equivale a implementação.

### Segundo lote — incorporado em 2026-09-22

- **LOGISTICS:** Atraso no Embarque, Falta de aviso do Embarque, Falta de Informação do Booking — gatilho/prazo/responsável adotados (sem divergência entre fontes nestes três); divergência de texto de ação em Atraso no Embarque e Falta de aviso registrada como pendência, não resolvida. Etiquetas (mapeado a COMPLIANCE), Divergência de Peso (mapeado a QUALIDADE) e Documentos Extraviados/LOI (mapeado a DOCUMENTACAO) referenciados por cross-referência, não duplicados neste contrato.
- **DOCUMENTACAO:** Documentação Errada, Falta da cópia dos documentos, Documentos Extraviados (DHL)/LOI — gatilho/prazo/responsável adotados, sem divergência de ação entre as fontes nos três. Tratamento explícito de LOI sem presunção de dispensa regulatória nem autorização automática para emissão/envio.
- **QUALIDADE:** as 11 reclamações de qualidade da Fonte A/B (peso, infestação, dano por insetos, FFA, PV, sacos rasgados, grãos rachados, grão descascados, aflatoxina, aflatoxina-Europa, sacos molhados/mofados) — prazo/responsável adotados com precedência da Fonte B onde diverge: 9 das 11 tiveram prazo alterado de 1 para 2 dias (todas exceto peso e aflatoxina-Europa, que ficaram sem alteração de prazo); aflatoxina também teve o responsável alterado (Vendedor → Vendedor e Comprador). Infestação mantém pendência de ação/evidência (fotos vs. fotos+vídeo e etapa extra de verificação com o vendedor). Tratamento explícito de aflatoxina/reexportação sem presunção de dispensa regulatória nem autorização automática.
- **EXCECOES:** não recebeu procedimento específico — papel transversal de acompanhamento/encaminhamento proposto (não aprovado, não implementado) para quando um prazo de conduta adotado em LOGISTICS/DOCUMENTACAO/QUALIDADE for excedido, distinto do mecanismo técnico de retry já existente.

### Pendências que continuam em aberto após o segundo lote

- Decisões de negócio ainda não respondidas: fonte prioritária residual em divergências não cobertas por prazo/responsável; alçadas de quem executa LOI, reexportação ou contato com comprador alternativo; identidade/autenticação de quem reporta cada evidência; retenção dos registros de conduta; dias úteis vs. corridos e marco inicial da contagem de prazo (explicitamente não inventados).
- Implementação: nenhum dos quatro contratos deste lote teve código alterado — todas as participações de agente descritas são propostas técnicas, não implementadas.
- Terceiro lote sugerido, ainda não iniciado: COMPLIANCE (Etiquetas) e COMERCIAL (interlocução comercial e busca de comprador alternativo), conforme o mapeamento em `PROCEDIMENTOS_CONDUTA.md`.
