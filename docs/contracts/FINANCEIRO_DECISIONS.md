# FINANCEIRO — decisões de negócio

Data do registro: 2026-09-21.
Fonte: respostas explícitas do usuário nesta conversa.
Estado: decisões abaixo confirmadas; implementação e detalhes operacionais pendentes.

## Decisões confirmadas

- FIN-DEC-01: Rodrigo e Leonardo realizam a confirmação de crédito por consulta ao banco.
- FIN-DEC-02: a confirmação de apenas um deles é suficiente; não se exige confirmação dupla.
- FIN-DEC-03: após essa confirmação, a liberação dos documentos pode ocorrer automaticamente, sem uma segunda autorização humana para a liberação.

A autorização de automatizar após confirmação não elimina as demais condições do [contrato financeiro](FINANCEIRO.md). O gate atual exige invoiceStatus=Issued, paymentStatus=Received e bankCreditConfirmed=true. FIN-DEC-11 permite liberação com pagamento parcial. FIN-DEC-12 define decisão humana caso a caso para elegibilidade do parcial; seu mapeamento ao gate atual ainda precisa ser especificado; não se deve tratar pagamento parcial como quitação integral.

## Fronteira da confirmação

A fonte operacional confirmada é a consulta ao banco feita por Rodrigo ou Leonardo. Não foi informada integração automática com API bancária. Mensagem do comprador, SWIFT ou resultado simulado não substituem essa confirmação humana.

## Detalhes ainda a definir

1. Identificador do grupo e integração WhatsApp compatível com mensagens em grupo e respostas vinculadas; disponibilidade técnica ainda não verificada.
2. Identificação autenticada de Rodrigo e Leonardo; mecanismo técnico que vincula a resposta à mensagem de confirmação e à versão do pagamento.
3. Implementação da guarda da mensagem de confirmação e seus metadados; comprovante anexado não é obrigatório, conforme FIN-DEC-14. Valor e moeda já integram a mensagem aprovada.
4. Identificação precisa dos documentos selecionados; formato e evidência da confirmação de entrega física (canal em FIN-DEC-18; responsáveis em FIN-DEC-19). Responsáveis e canal de seleção definidos em FIN-DEC-16; destinatários e canais de autorização definidos em FIN-DEC-08/09/10.
5. Implementação do registro da decisão parcial no formato aprovado (FIN-DEC-13), divergência, estorno, revisão pendente e revogação.

## Requisitos técnicos propostos, ainda não implementados

- Registrar confirmação com identidade autenticada, objeto/versão e evidência definida pelo negócio.
- Aplicar os gates financeiros e garantir que repetição da confirmação não duplique a liberação.
- Separar elegibilidade, tentativa de entrega e entrega confirmada na auditoria.
- Tratar resultado externo incerto antes de repetir a ação.

## Situação atual

[bankQuery.js](../../src/agents/financeiro/bankQuery.js) continua simulado. [releaseGate.js](../../src/agents/financeiro/releaseGate.js) calcula elegibilidade a partir de três campos. [index.js](../../src/agents/financeiro/index.js) registra auditoria de liberação, mas esse registro não comprova entrega efetiva. Este documento não altera código nem ativa a liberação automática.
## Canal e formato confirmados

- FIN-DEC-04: a confirmação será feita por WhatsApp.
- FIN-DEC-05: o canal será um grupo de WhatsApp da operação com o agente.
- FIN-DEC-06: o agente apresenta FTR, invoice, valor e moeda; Rodrigo ou Leonardo confirma respondendo àquela mensagem. Formato aprovado explicitamente pelo usuário.

### Fluxo funcional aprovado

1. O agente apresenta os quatro campos no grupo da operação.
2. Rodrigo ou Leonardo consulta o banco e responde à mensagem apresentada para confirmar o crédito.
3. Uma confirmação válida de qualquer um deles é suficiente, respeitadas as demais condições financeiras, para permitir liberação automática sem segunda autorização.

Nenhum texto exato de confirmação foi obrigatório nesta decisão. Identificador do grupo, números autorizados, provedor, envio/recepção de mensagens em grupo e captura do vínculo de resposta permanecem pendentes de definição e verificação técnica. A escolha do canal não comprova suporte da integração atual.

### Controles técnicos propostos para esse fluxo

- Validar grupo, identidade do remetente e identificador da mensagem respondida; nome de exibição sozinho não comprova identidade.
- Vincular a resposta aos quatro campos e à versão da solicitação. Resposta ambígua, sem vínculo ou de pessoa não autorizada não deve gerar confirmação automática.
- Deduplicar mensagens e confirmações; duas respostas não devem gerar duas liberações.
- Guardar referência à solicitação e à resposta, remetente, data e resultado, conforme política de retenção a definir.
- Alteração de valor, moeda ou objeto após a solicitação exige tratamento de invalidação/reconfirmação a especificar.

Esses controles são propostas de implementação, não funcionalidades já ativas. Não houve envio de mensagens, configuração de WhatsApp ou ativação de liberação nesta revisão.

## Ação de liberação confirmada

- FIN-DEC-07: liberar documentos significa enviar uma autorização para alguém entregar os documentos originais. Decisão explícita do usuário em 2026-09-21.

Após a confirmação bancária válida por Rodrigo ou Leonardo no grupo da operação, e respeitadas as demais condições financeiras, o efeito automático previsto é o envio dessa autorização. O destinatário e os canais de envio da autorização foram posteriormente definidos em FIN-DEC-08/09 abaixo. O grupo da operação continua sendo o canal aprovado para confirmação de crédito.

O envio da autorização não comprova a entrega física dos originais. A especificação deve distinguir autorização enviada de entrega realizada; o canal de confirmação da entrega foi definido em FIN-DEC-18; os responsáveis foram definidos em FIN-DEC-19; FIN-DEC-20 dispensa recibo/anexo obrigatório; o formato textual permanece pendente. Não foi autorizada nesta conversa a substituição desse fluxo pelo envio de arquivos ao comprador.

Nenhum envio externo foi realizado e nenhuma automação foi ativada por este registro.

## Destinatários e canais da autorização

- FIN-DEC-08: a mesma autorização será enviada por e-mail e WhatsApp aos destinatários cadastrados. A lista foi ampliada pelo usuário para Rodrigo e Leonardo (FIN-DEC-10).
- FIN-DEC-09: destinatário informado pelo usuário: Rodrigo Francfort; e-mail rodrigo@francfort.co; telefone/WhatsApp +5511982344422.

O e-mail foi normalizado removendo o espaço em 'rodrigo@ francfort.co'. Os contatos foram fornecidos pelo usuário; titularidade, disponibilidade e entrega não foram verificadas. Este número foi informado como contato destinatário: sua inclusão como identidade autorizada a confirmar crédito requer validação no cadastro do fluxo de confirmação. Os contatos destinatários de Leonardo foram informados em FIN-DEC-10. A validação das identidades para confirmação de crédito e o identificador do grupo continuam pendentes.

Proposta técnica: usar um identificador único de autorização nos dois canais e registrar tentativas/resultado por canal, evitando que duas notificações sejam interpretadas como duas ordens. A política para falha de um dos canais foi aprovada em FIN-DEC-17 abaixo.

Este registro documenta o fluxo futuro. Nenhuma mensagem foi enviada e nenhuma integração foi ativada.

## Ampliação da lista de destinatários

- FIN-DEC-10: o usuário solicitou múltiplos destinatários e incluiu Leonardo Francfort; e-mail finance@francfort.co; telefone/WhatsApp +5511982344411. Rodrigo permanece cadastrado.

| Destinatário | E-mail | WhatsApp |
|---|---|---|
| Rodrigo Francfort | rodrigo@francfort.co | +5511982344422 |
| Leonardo Francfort | finance@francfort.co | +5511982344411 |

Ambos recebem a mesma autorização pelos dois canais. Isso não altera FIN-DEC-02: basta uma confirmação válida de Rodrigo ou Leonardo para o crédito, sem aprovação dupla. Os contatos são dados fornecidos pelo usuário, ainda não verificados pela integração. O escape de formatação em finance\@francfort.co foi removido do endereço registrado.

Proposta técnica: manter o identificador único da autorização entre destinatários e canais, com resultado de envio por destinatário/canal. A política para falha de um dos canais foi aprovada em FIN-DEC-17; diferenças de entrega entre destinatários não são resolvidas por essa decisão. Nenhuma mensagem foi enviada e nenhuma integração foi ativada.

## Liberação com pagamento parcial

- FIN-DEC-11: o usuário confirmou que a autorização de entrega dos documentos originais pode ocorrer com pagamento parcial.

Esta decisão permite o caso parcial, mas não define um percentual mínimo, valor mínimo, parcela contratual exigida ou liberação por qualquer valor. FIN-DEC-12 define que Rodrigo ou Leonardo decide caso a caso, sem limiar automático aprovado. Mantém-se a confirmação do crédito por Rodrigo ou Leonardo, conforme as decisões anteriores.

A implementação deve distinguir valor efetivamente recebido, total da invoice e saldo remanescente. Elegibilidade para liberar documentos não equivale a quitação integral. Esse detalhamento é requisito técnico proposto, ainda não implementado.

O contrato FINANCEIRO e o gate atual devem ser reconciliados com a política de pagamento parcial para incorporar a decisão humana caso a caso definida em FIN-DEC-12. Nenhuma alteração de código, confirmação de pagamento ou envio externo foi realizado neste registro.

## Decisão caso a caso para pagamento parcial

- FIN-DEC-12: Rodrigo ou Leonardo decide, caso a caso, se o pagamento parcial permite autorizar a entrega dos documentos originais. Não foi definido percentual ou valor mínimo automático. Basta um dos dois; não se exige aprovação dupla.

Esta decisão especializa FIN-DEC-03 para pagamentos parciais: confirmar que o crédito entrou não demonstra, por si só, a decisão de liberar apesar do saldo. A decisão de aceitar o parcial deve ficar explícita e vinculada à operação. Após confirmação do crédito e decisão favorável sobre o parcial, o envio da autorização segue automático pelos canais/destinatários já definidos, respeitadas as demais condições aplicáveis. O saldo não é zerado por essa autorização.

Interação aprovada pelo usuário em FIN-DEC-13: o agente exibe FTR, invoice, moeda, total, valor recebido e saldo no grupo; Rodrigo ou Leonardo pode registrar confirmação de crédito e decisão de liberar com saldo em uma única resposta explícita à mensagem. Não é necessário inferir uma segunda rodada de aprovação nem aceitar um 'confirmado' ambíguo como autorização para parcial.

A forma textual da resposta foi aprovada em FIN-DEC-13. O mecanismo técnico de vínculo à versão do pagamento e o tratamento de alteração/revogação permanecem a especificar. Nenhuma automação foi ativada e nenhuma mensagem foi enviada.

## Formato aprovado para pagamento parcial

- FIN-DEC-13: o usuário aprovou o seguinte formato no grupo de WhatsApp da operação: o agente apresenta FTR, invoice, moeda, total da invoice, valor recebido e saldo; Rodrigo ou Leonardo responde à mensagem com: **Crédito confirmado. Autorizo liberar com saldo pendente.**

Essa resposta registra a confirmação do crédito consultado no banco e a decisão de liberar os originais apesar do saldo, em uma única interação. Uma resposta válida de qualquer um dos dois é suficiente. Após validação de identidade, vínculo à solicitação e demais condições aplicáveis, o sistema deverá enviar automaticamente a mesma autorização a Rodrigo e Leonardo por e-mail e WhatsApp.

O saldo remanescente continua em aberto; enviar a autorização não comprova entrega física. Mensagem ambígua como 'confirmado' não registra por si só a decisão de liberar com saldo pendente. Não foram definidas variantes textuais aceitas nem tolerâncias de interpretação.

Critérios de aceite propostos: resposta válida vinculada ao parcial produz uma autorização única; mensagem duplicada não duplica a autorização; remetente não autorizado ou resposta sem vínculo não gera liberação; saldo permanece registrado; resultado de envio é registrado por destinatário/canal. Critérios ainda não implementados nem executados nesta revisão.

Este é um registro documental da aprovação do formato, não uma confirmação de pagamento real. Nenhuma mensagem foi enviada e nenhuma automação foi ativada.

## Confirmação suficiente sem anexo obrigatório

- FIN-DEC-14: o usuário confirmou que basta a mensagem de confirmação de Rodrigo ou Leonardo no grupo da operação; não é obrigatório anexar comprovante bancário.

A consulta ao banco continua sendo realizada por Rodrigo ou Leonardo antes da confirmação. A decisão dispensa o anexo, não a consulta humana. No pagamento parcial, permanece o formato aprovado em FIN-DEC-13: **Crédito confirmado. Autorizo liberar com saldo pendente.** A confirmação deve responder à solicitação identificada e manter o vínculo à operação e aos valores apresentados.

Requisito técnico proposto: preservar a mensagem e a solicitação respondida, identidade validada do remetente, grupo, identificadores, data/hora e versão dos dados, para rastrear a decisão. Não criar exigência de extrato ou referência bancária adicional como condição obrigatória sem nova decisão do negócio.

Critérios de aceite propostos: confirmação válida sem anexo deve ser aceita; ausência de anexo não deve bloquear o fluxo; mensagem de remetente não autorizado ou sem vínculo não deve autorizar liberação; pagamento parcial continua exigindo decisão explícita sobre o saldo. Testes ainda não executados.

Registro exclusivamente documental. Nenhuma mensagem enviada, confirmação bancária real processada ou automação ativada.

## Escopo documental da autorização

- FIN-DEC-15: os documentos originais a entregar são selecionados em cada caso. A autorização não abrange automaticamente todos os originais da operação.

A mensagem de autorização deverá identificar os documentos selecionados e a operação correspondente. Documentos não selecionados não devem ser incluídos por inferência. FIN-DEC-16 define Rodrigo ou Leonardo como responsável pela seleção, na mesma conversa do grupo de WhatsApp. A seleção não é atribuída autonomamente ao agente.

Requisitos técnicos propostos: vincular a lista de documentos à autorização única e à versão da solicitação; preservar essa lista na auditoria e nas notificações; tratar seleção ausente/ambígua como pendência. Identificação de documento (tipo, número e versão quando aplicável) e mudanças posteriores da lista ainda precisam de especificação.

Critério de aceite proposto: uma seleção de parte dos originais gera autorização somente para esse conjunto, sem inclusão dos demais. Nenhum teste foi executado e nenhuma automação foi ativada neste registro.

## Responsável e canal da seleção documental

- FIN-DEC-16: Rodrigo ou Leonardo fará a seleção dos documentos na mesma conversa do grupo de WhatsApp da operação com o agente, conforme confirmação explícita do usuário.

A seleção é feita por um dos dois responsáveis e deve ser associada à operação e à solicitação de liberação correspondentes. Não é exigida seleção conjunta pelos dois. O agente deve usar apenas o conjunto indicado, sem ampliar o escopo.

Consolidação do fluxo aprovado: o agente apresenta os dados financeiros; Rodrigo ou Leonardo confirma após consultar o banco, sem anexo obrigatório; no caso parcial, registra também a decisão explícita de liberar com saldo pendente; Rodrigo ou Leonardo seleciona os documentos na mesma conversa. Reunidas confirmação, seleção e demais condições aplicáveis, o envio da autorização segue automático a Rodrigo e Leonardo por e-mail e WhatsApp. Não há nova rodada de aprovação exigida por este registro.

Requisitos técnicos propostos: se a confirmação chegar antes da seleção, aguardar a lista em vez de autorizar todos os documentos; correlacionar mensagens à mesma operação/versão; não inferir seleção a partir de mensagens de outras operações no grupo. Seleções conflitantes, alterações após envio e identificação exata de cada original permanecem pendentes de especificação.

Nenhuma mensagem enviada, código alterado ou automação ativada nesta atualização documental.

## Validade da autorização quando um canal falha

- FIN-DEC-17: o usuário aprovou que, se WhatsApp funcionar e e-mail falhar, ou vice-versa, a autorização pode valer pelo canal que funcionou enquanto o sistema tenta novamente o outro.

Essa decisão trata da notificação de uma autorização já elegível conforme as regras financeiras e a seleção documental. Não elimina a confirmação bancária, a decisão explícita sobre saldo no caso parcial ou a seleção dos documentos. A autorização continua única, com o mesmo identificador, escopo e conteúdo nas novas tentativas.

Requisitos técnicos propostos: registrar resultado por destinatário/canal; tentar novamente o envio que falhou sem criar nova autorização nem reenviar intencionalmente aos destinos já atendidos; preservar falhas e tentativas na auditoria. Resultado incerto deve ser reconciliado antes de repetir um efeito externo. Intervalos, limite de tentativas e escalonamento após esgotamento ainda precisam de especificação técnica; não há autorização para tentativas ilimitadas.

Esta decisão não define se entrega a apenas um dos dois destinatários é suficiente quando o outro não recebe em nenhum canal. Ambos continuam na lista de destinatários. Envio/entrega da notificação também não comprova entrega física dos documentos originais.

Critérios de aceite propostos: sucesso em WhatsApp e falha em e-mail mantém a validade pelo WhatsApp e pendência de e-mail; cenário inverso equivalente; nova tentativa preserva o identificador e documentos da autorização; falha em ambos não é registrada como sucesso; resultados individuais permanecem rastreáveis. Critérios ainda não executados.

Registro documental de decisão de negócio; nenhuma mensagem enviada ou automação ativada.

## Canal de confirmação da entrega física

- FIN-DEC-18: o usuário confirmou que a entrega física dos documentos originais será confirmada no mesmo grupo de WhatsApp da operação com o agente.

Essa mensagem trata da entrega efetiva dos originais, separadamente da confirmação de crédito e do envio da autorização. FIN-DEC-18 define o canal e FIN-DEC-19 define os responsáveis autorizados. FIN-DEC-20 define que basta a mensagem de confirmação, sem recibo/anexo obrigatório; o formato textual permanece pendente. Essa dispensa foi aprovada especificamente para entrega física, separadamente de FIN-DEC-14.

Requisitos técnicos propostos: vincular a confirmação à operação, autorização e documentos efetivamente entregues; registrar remetente e data/hora; não inferir entrega física a partir de mensagem de autorização, status de envio, entrega ou leitura da notificação. FIN-DEC-21 define o tratamento da entrega física parcial por documento.

Critérios de aceite propostos: notificação entregue não altera por si só o estado para originais entregues; confirmação de entrega no grupo deve ser correlacionada à autorização correta, conforme as regras de identidade e evidência a definir. Nenhum teste executado nesta atualização.

Nenhuma mensagem enviada, código alterado ou automação ativada.

## Responsáveis pela confirmação de entrega física

- FIN-DEC-19: somente Rodrigo Francfort ou Leonardo Francfort pode confirmar a entrega física dos documentos originais, no grupo de WhatsApp da operação definido em FIN-DEC-18.

A confirmação pode ser feita por Rodrigo ou Leonardo; não há exigência de confirmação conjunta. Mensagem de outra pessoa não deve ser aceita automaticamente como confirmação autorizada de entrega, mesmo que essa pessoa tenha efetuado o transporte ou participe do grupo.

Requisitos técnicos propostos: validar identidade e vínculo à operação/autorização e aos documentos entregues; registrar quem confirmou e quando; não usar apenas nome de exibição como prova de identidade. Uma confirmação repetida não deve criar outra entrega nem ampliar o conjunto documental confirmado.

Critérios de aceite propostos: confirmação válida de Rodrigo ou Leonardo pode registrar entrega sem anexo obrigatório conforme FIN-DEC-20, com formato textual ainda a definir; mensagem de outro participante não registra entrega como confirmada; status de entrega/leitura da notificação não substitui essa confirmação humana.

Ainda pendente: formato da mensagem. FIN-DEC-21 define o tratamento da entrega física parcial. FIN-DEC-20 resolve a exigência de recibo/anexo. Nenhuma mensagem foi enviada e nenhuma automação foi ativada.

## Evidência suficiente para confirmação da entrega física

- FIN-DEC-20: o usuário confirmou que basta a mensagem de confirmação de entrega física enviada por Rodrigo ou Leonardo no grupo de WhatsApp da operação. Não é obrigatório anexar recibo ou comprovante de entrega.

A mensagem humana de confirmação é a evidência operacional aprovada para registrar a entrega. Isso não equivale ao status de envio, entrega ou leitura de uma notificação pelo WhatsApp, nem ao envio da autorização. Permanecem os responsáveis definidos em FIN-DEC-19 e o escopo documental selecionado em FIN-DEC-15/16.

Requisitos técnicos propostos: preservar mensagem, remetente validado, grupo, data/hora e vínculo à operação/autorização e aos documentos efetivamente confirmados. Ausência de anexo não deve bloquear uma confirmação válida. Mensagem ambígua ou sem vínculo deve aguardar esclarecimento, sem inferir entrega de todos os originais.

Critérios de aceite propostos: confirmação válida sem anexo é aceita; mensagem de terceiro não confirma entrega; status de leitura da autorização não confirma entrega física; repetição da mesma mensagem não duplica o registro. O formato textual ainda precisa ser especificado; FIN-DEC-21 define o tratamento da entrega física parcial. Nenhum teste executado nesta revisão.

Decisão documental, sem envio de mensagens, alteração de código ou ativação de automação.

## Entrega física parcial dos documentos autorizados

- FIN-DEC-21: se apenas parte dos documentos autorizados for entregue, o agente deve registrar quais foram entregues e manter os demais pendentes, conforme decisão explícita do usuário.

A confirmação continua restrita a Rodrigo ou Leonardo no grupo da operação, sem anexo obrigatório (FIN-DEC-18/19/20). O registro considera somente os documentos identificados na confirmação e pertencentes à autorização correspondente. Entrega parcial dos documentos não significa quitação do saldo financeiro nem entrega completa dos originais.

Requisitos técnicos propostos: manter estado individual por documento autorizado; calcular pendentes como o conjunto autorizado menos os documentos com entrega confirmada; acumular confirmações posteriores sem perder entregas anteriores. A entrega do conjunto somente fica completa quando todos os documentos autorizados tiverem confirmação válida. Mensagens repetidas não duplicam entrega. Documento não autorizado ou identificação ambígua exige esclarecimento, sem ampliar automaticamente o escopo.

Critérios de aceite propostos:

- Autorização para BL, CO e Phyto, seguida de confirmação válida somente do BL: BL entregue; CO e Phyto pendentes.
- Confirmação posterior do CO: BL e CO entregues; Phyto permanece pendente.
- Confirmação posterior do Phyto: conjunto autorizado completamente entregue, sem alterar o saldo financeiro.
- Repetir a confirmação do BL não cria novo registro de entrega nem reabre documentos já entregues.
- Notificação de documento fora do conjunto autorizado não o incorpora automaticamente à autorização.

Os exemplos são sintéticos; não registram entrega real. Formato textual, identificação precisa e versão de cada documento permanecem a especificar. Nenhum teste executado, mensagem enviada, código alterado ou automação ativada nesta atualização.