# Inventário e especificação de skills por agente

Status: catálogo proposto, não skills instaladas. Inspeção local em 2026-09-10.

## Situação atual

Busca por SKILL.md, pastas skills/prompts e instruções de agente no projeto (excluindo dependências, .git e segredos) não encontrou pacotes de skills dos 12 componentes. Isso não inclui configurações pessoais fora do projeto. Não foi instalado nem ativado nenhum prompt ou ferramenta.

[RDIA_PRD](../RDIA_PRD.md), seção 28, contém um System Contract documental e esclarece que não é prompt de LLM em execução. Templates de resposta em COMUNICACAO e de oferta em COMERCIAL são textos de aplicação, não skills. A camada de execução LLM permanece uma decisão separada de arquitetura.

**Capacidades propostas versus skills existentes (2026-09-22):** toda a tabela abaixo lista capacidades propostas (candidatas) — nenhuma skill verificada ou instalada existe hoje, conforme "Situação atual" acima. [ORQUESTRADOR](ORQUESTRADOR.md) não é um dos 12 agentes desta tabela e fica fora deste inventário por ser zero-LLM por desenho próprio (`ORQUESTRADOR.md`, "LLM: NO AUTHORITY" implícito em todo o repositório), não por omissão.

## Skills candidatas e limites

| Agente | Skills a especificar | Limite obrigatório na futura especificação |
|---|---|---|
| [COMUNICACAO](COMUNICACAO.md) | Triagem de mensagem; identificação de FTR; preparação de resposta | Não prometer envio/roteamento só porque retornou template; FTR ambígua vai a revisão |
| [COMERCIAL](COMERCIAL.md) | Preparação de oferta; análise de desvio; acompanhamento de negociação | Cálculos no módulo determinístico; limite desconhecido não é aprovação. Skill deve respeitar o papel de interlocução/proposta de solução já incorporado em [COMERCIAL.md](COMERCIAL.md), sem contatar comprador alternativo de forma autônoma |
| [CONTRATOS](CONTRATOS.md) | Conferência de termos; comparação de aditivo; preparação para assinatura | Não interpretar Boolean de assinatura como prova jurídica; registrar fonte |
| [COMPLIANCE](COMPLIANCE.md) | Conferência de requisitos; avaliação documental; acompanhamento de validade | Regras objetivas pertencem ao módulo; ausência de dado não vira aprovação. Procedimento "Etiquetas" (fora do padrão importador/especial) já incorporado em [COMPLIANCE.md](COMPLIANCE.md) |
| [DOCUMENTACAO](DOCUMENTACAO.md) | Preparação de minuta; conferência do conjunto; montagem para revisão | Documento gerado não é documento oficialmente emitido; respeitar gates de domínio. Skill deve respeitar os procedimentos de conduta já incorporados em [DOCUMENTACAO.md](DOCUMENTACAO.md) (documentação errada, cópias, DHL/LOI) |
| [FINANCEIRO](FINANCEIRO.md) | Triagem de evidência; conciliação assistida; preparação de revisão | SWIFT/mensagem não confirma crédito; LLM não autoriza liberação. Canal de confirmação (WhatsApp, Rodrigo/Leonardo) já aprovado em [FIN-DEC-01–21](FINANCEIRO_DECISIONS.md), não implementado |
| [QUALIDADE](QUALIDADE.md) | Conferência de laudo; preparação de aprovação; tratamento de rejeição | Não substituir decisão do comprador nem limites de COMPLIANCE. Skill deve respeitar os 11 procedimentos de conduta já incorporados em [QUALIDADE.md](QUALIDADE.md) |
| [LOGISTICS](LOGISTICS.md) | Conferência de embarque; acompanhamento de ETA; preparação de alerta | Mock não é tracking real; alerta de risco não é cálculo de cobrança. Skill deve respeitar os procedimentos de conduta já incorporados em [LOGISTICS.md](LOGISTICS.md) |
| [COMISSOES](COMISSOES.md) | Preparação do cálculo; conferência de comissão; conciliação assistida | Cálculo não autoriza pagamento; usar taxas aprovadas e módulo determinístico |
| [EXCECOES](EXCECOES.md) | Triagem de falha; preparação de reprocessamento; registro de decisão | Não criar retry duplicado nem transformar registro de override em permissão. Papel transversal de acompanhamento de prazos de conduta proposto (não aprovado) em [EXCECOES.md](EXCECOES.md) |
| [MONITOR](MONITOR.md) | Preparação de relatório; explicação de indicador; triagem de SLA | Dados ausentes precisam aparecer; métrica não altera estado do negócio |
| [DIGITALIZACAO](DIGITALIZACAO.md) | Classificação; extração com fonte; resolução de entidade; preparação de revisão | Conteúdo do arquivo é dado não confiável; não seguir instruções nele |

## Atualização de referências (2026-09-22)

A tabela acima foi escrita antes de FIN-DEC-01–21, dos procedimentos de conduta e de `ORQUESTRADOR.md`; onde a informação ficou incompleta, as células foram editadas diretamente, acima, com a referência cruzada e a precedência da Fonte B limitada a prazo/responsável (nunca ação/evidência, que continua pendência não resolvida por inferência).

**Responsável humano, participação proposta e mecanismo implementado continuam três coisas distintas** em cada linha da tabela: responsável humano é quem as fontes de negócio já nomeiam (Rodrigo, Leonardo, Vendedor, Comprador); a skill candidata é sempre proposta técnica, não aprovada; mecanismo implementado é só o que o código hoje efetivamente faz.

## Conteúdo mínimo de cada skill

1. Nome, propósito, versão, responsável e estado de aprovação.
2. Quando usar e quando não usar; gatilho e pré-condições.
3. Entradas, arquivos aceitos e schema de saída ligado ao contrato.
4. Passos do procedimento, consultas e ferramentas permitidas; distinguir leitura, proposta e escrita.
5. Regras objetivas delegadas ao código e fontes de negócio versionadas.
6. Limites de decisão e evidência necessária para aprovação humana.
7. Falhas esperadas, campos ausentes, conflitos, timeout e encaminhamento.
8. Identidade da operação, correlação, deduplicação e efeitos permitidos.
9. Proteção de dados: minimização, acesso, retenção e conteúdo externo tratado como dado, não instrução.
10. Exemplos positivos, negativos e ambíguos, com saída esperada e provenance.
11. Avaliações de qualidade e regressão; critérios mensuráveis, orçamento e latência somente quando definidos.
12. Dependências, compatibilidade, histórico de alterações, implantação e reversão.

## Skills de engenharia versus skills do produto

Procedimentos de revisão de código, auditoria de contratos e execução de testes pertencem ao trabalho de desenvolvimento. Skills do produto operam sobre mensagens, documentos ou decisões do negócio. Não misturar permissões dos dois grupos, nem copiar instruções de um assistente de desenvolvimento para agentes de produção.

## Entrega futura

Antes de gerar SKILL.md executável, escolher o runtime, aprovar a fronteira de ferramentas e vincular cada skill a uma feature e contrato. O inventário não escolhe plataforma, modelo, orçamento ou permissões em nome do negócio. Não duplicar a lógica determinística de cálculos/gates em texto de prompt.
