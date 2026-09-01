# Controle de recebimentos e alerta de chegada/cobrança

Este documento registra a decisão de arquitetura e o desenho da feature de
controle cruzado de pagamentos (FTR × invoice × booking × BL) com alerta de
cobrança 7 dias antes da ETA, e serve de referência para quem for continuar
esse trabalho.

## Decisão de arquitetura

Havia duas formas de atender ao pedido original ("um sistema completo em
Google Apps Script"):

1. Um sistema Apps Script autônomo — planilha própria como fonte da verdade,
   parsing de Gmail, Calendar e alertas todos dentro do Apps Script,
   desconectado do restante do Ruflo.
2. Apps Script como **sensor fino** (só lê o Gmail e encaminha para o webhook
   já existente), com toda a extração/cruzamento/status/alerta implementados
   nos agentes Node já existentes (COMUNICACAO, FINANCEIRO, LOGISTICS).

A opção 2 foi a escolhida. `docs/ARQUITETURA.md` e `docs/ROADMAP.md` já
descreviam exatamente esse desenho antes desta mudança ("Apps Script — Gmail
intake, Trigger 15min" / "Fallback: Gmail trigger (Apps Script 15min)"), e o
endpoint `/webhook-gmail` já existia. Um sistema Apps Script completo
duplicaria FTR/booking/BL/pagamento em uma segunda fonte de dados (a
planilha) desconectada do Supabase/Firestore que o resto do Ruflo já usa —
exatamente o problema que esta escolha evita.

## Onde cada peça vive

```
Gmail (export@francfort.co)
  → apps-script/gmail-sync/          (sensor: lê e-mails novos, envia ao webhook)
  → POST /webhook-gmail               (src/routes/index.js, já existente)
  → COMUNICACAO agent                 (src/agents/comunicacao)
      ftrNormalization.js             normaliza FTR (variações de formatação)
      documentNumbers.js              extrai invoice/booking/BL
      shipmentExtraction.js           extrai portos/navio/voyage/ETD/ETA/contêineres
      changeDetection.js              detecta booking/ETA amendment, split shipment
      confidenceScoring.js            decide se uma correspondência é segura o bastante
      parser.js                       amarra tudo isso em parseMessage()
  → FINANCEIRO agent                  (src/agents/financeiro)
      paymentSignals.js               SWIFT/parcial/"confirmado" só como sinal de texto
      paymentStatusService.js         status (9 estados) + saldo pendente
      alertService.js                 janela de 7 dias, dedupe, próxima ação, templates
  → LOGISTICS agent                   (src/agents/logistics)
      paymentTrackingCalendarEvent.js monta título/descrição do evento
  → src/services/calendarService.js   cria/atualiza o evento na agenda
                                       "FRANCFORT – CHEGADAS E COBRANÇAS"
  → src/services/email.js             envia o alerta interno (nunca ao comprador)

Supabase (fonte de dados permanente):
  supabase/migrations/0002_payment_tracking.sql
      payment_tracking_meta           1 linha por FTR+invoice+booking+BL
      payment_change_history          histórico de alterações (append-only)
      payment_manual_review           fila de REVISÃO MANUAL
      payment_tracking_view           reconstrói a tela de controle completa
```

## Por que o pagamento nunca é "confirmado" só por um SWIFT

`paymentSignals.detectSwiftMention` e `detectPaymentConfirmedLanguage` só
relatam o que o **texto** de um e-mail diz. Se o único sinal existente é
"segue o SWIFT em anexo", o status fica em `SWIFT_RECEBIDO` — nunca em
`PAGAMENTO_CONFIRMADO`. Esse último estado só é alcançado quando o saldo
calculado (`payments.amount_usd` somado, filtrando
`bank_credit_confirmed = true`) cobre o valor total da invoice — o mesmo gate
que `src/agents/financeiro/releaseGate.js` já usa para liberar documentos
originais.

## Configuração

Tudo centralizado em `src/config.js`:

| Variável de ambiente | Efeito | Padrão |
|---|---|---|
| `TIMEZONE` | fuso usado nos cálculos de data | `America/Sao_Paulo` |
| `ALERT_DAYS_BEFORE` | quantos dias antes da ETA o alerta dispara | `7` |
| `ALERT_EXTRA_RECIPIENTS` | e-mails extras (além de `export@francfort.co`), separados por vírgula | vazio |
| `PAYMENT_TRACKING_TEST_MODE` | `true` desliga envio real de e-mail e escrita real no Calendar (loga em vez de agir) | `false` |
| `GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY` / `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | credenciais da conta de serviço com delegação de domínio para escrever na agenda de `export@francfort.co` | — |
| `EMAIL_SMTP_HOST` / `EMAIL_FROM_ADDRESS` | relay SMTP para o envio real do alerta interno | — |
| `WEBHOOK_SHARED_SECRET` | segredo que o Apps Script envia no header `X-Webhook-Secret` | — |

### Ajustar a antecedência do alerta (os "7 dias")

Defina `ALERT_DAYS_BEFORE` no ambiente do Cloud Run. Nenhum código precisa
mudar — `alertService.js` e `paymentStatusService.js` recebem esse valor via
`src/config.js`.

### Alterar os destinatários do alerta

`export@francfort.co` está sempre incluído (constante em `src/config.js`).
Para acrescentar financeiro, comercial ou o responsável pelo contrato, defina
`ALERT_EXTRA_RECIPIENTS="financeiro@francfort.co,rodrigo@francfort.co"`.

## O que ainda é uma interface aguardando credencial real

Seguindo o mesmo padrão já usado em `financeiro/bankQuery.js` e
`logistics/searatesQuery.js` (mock/gate explícito até a integração real
existir):

- **`src/services/calendarService.js`** — chama a API real do Google
  Calendar via REST, mas exige uma conta de serviço com delegação de domínio
  (`GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY`/`GOOGLE_CALENDAR_IMPERSONATE_EMAIL`).
  Sem isso configurado, retorna `{ error: 'calendar_not_configured' }` e o
  chamador deve tratar isso como "precisa de revisão manual do Calendar".
- **`src/services/email.js`** — a chamada real ao relay SMTP/API do Gmail
  fica marcada com `TODO(real integration)`; sem `EMAIL_SMTP_HOST`/
  `EMAIL_FROM_ADDRESS`, o alerta é apenas logado.
- **OCR/extração de PDF, Excel e Word anexados** — não implementado nesta
  entrega. `apps-script/gmail-sync` já encaminha anexos pequenos como base64
  e grandes como link do Drive; falta o lado Node que extrai texto deles
  (ex.: `pdf-lib` já é dependência do projeto, mas apenas para geração de PDF,
  não para OCR/extração de texto de PDFs digitalizados).
- **Orquestração ponta a ponta** (COMUNICACAO grava a linha em
  `payment_tracking_meta`, dispara LOGISTICS/FINANCEIRO automaticamente) —
  os módulos de extração/status/alerta/calendar estão prontos e testados,
  mas o "cola tudo" que lê uma mensagem processada e decide
  criar/atualizar/enviar-para-revisão-manual uma linha de
  `payment_tracking_meta` ainda precisa ser escrito como o próximo passo.

## Testes

Todos os módulos novos têm testes unitários (`*.test.js` ao lado de cada
arquivo, seguindo o padrão já usado no restante do repositório) — rode
`npm test`. A migração `0002_payment_tracking.sql` foi validada manualmente
contra um Postgres local (aplicação limpa da 0001 + 0002, e uma consulta de
ponta a ponta em `payment_tracking_view` com dados de exemplo).

Veja `apps-script/gmail-sync/README.md` para como configurar e testar o lado
Apps Script (inclui um modo de teste que não envia nada ao webhook).
