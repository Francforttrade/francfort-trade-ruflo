# Gmail intake (Apps Script)

Implementa o nó `APPSCRIPT` de `docs/ARQUITETURA.md`: um script Google Apps
Script (`apps-script/gmail-intake/`) roda em um trigger de 15min, busca no
Gmail e-mails de trade não lidos e envia cada um para o endpoint Cloud Run
`/webhook-gmail`, que roteia via `master.route()` para o agente COMUNICACAO —
o mesmo caminho que `/webhook-whatsapp` usa para mensagens de WhatsApp.

## Autenticação

O serviço Cloud Run roda público (`--allow-unauthenticated`) para este
endpoint porque IAM não autentica chamadores externos como o Apps Script
(ele não consegue emitir um ID token do Google). O controle de acesso real é
o segredo compartilhado validado em `src/middleware/webhookAuth.js`: toda
requisição precisa do header `X-Webhook-Secret` com o mesmo valor da env var
`WEBHOOK_SHARED_SECRET` do Cloud Run.

## Setup

1. **Criar o projeto Apps Script** e subir o código:
   - Via [`clasp`](https://github.com/google/clasp):
     ```bash
     cd apps-script/gmail-intake
     clasp create --type standalone --title "Ruflo Gmail Intake"
     clasp push
     ```
   - Ou copie manualmente `Code.gs` e `appsscript.json` para um projeto criado
     em [script.google.com](https://script.google.com).

2. **Configurar Script Properties** (File > Project properties > Script
   properties, ou `clasp` / a API do Apps Script):
   | Propriedade | Obrigatória | Descrição |
   |---|---|---|
   | `RUFLO_ENDPOINT_URL` | sim | URL do Cloud Run + `/webhook-gmail`, ex.: `https://ruflo-xxx.run.app/webhook-gmail` |
   | `RUFLO_WEBHOOK_SECRET` | sim | Mesmo valor da env var `WEBHOOK_SHARED_SECRET` do Cloud Run |
   | `GMAIL_SEARCH_QUERY` | não | Sobrescreve `DEFAULT_SEARCH_QUERY` do script |

3. **Rodar `setup()`** uma vez pelo editor do Apps Script. Isso cria as
   labels `Ruflo/Processado` e `Ruflo/Falhou` e instala o trigger de 15min
   que chama `intakeGmail`.

## Funcionamento

- A cada execução, `intakeGmail` busca threads com `GMAIL_SEARCH_QUERY`
  (por padrão, não lidas, sem as labels de controle, e com palavras-chave de
  trade: FTR, booking, invoice, fatura, oferta, BL, phyto).
- Cada mensagem não lida da thread é enviada como
  `{ from, subject, body, threadId }` para `/webhook-gmail`.
- Mensagens enviadas com sucesso são marcadas como lidas; a thread recebe a
  label `Ruflo/Processado` se todas as mensagens não lidas foram enviadas
  com sucesso, ou `Ruflo/Falhou` se alguma falhou (fica disponível para
  reprocessamento manual ou pelo job semanal descrito em
  `docs/ARQUITETURA.md`).
- O corpo da mensagem é truncado em 20000 caracteres antes do envio.

## Rotação do segredo

`WEBHOOK_SHARED_SECRET` é o mesmo secret usado por `/webhook-whatsapp`
(`docs/DEPLOY.md`, `francfort-whatsapp-webhook-secret` no Secret Manager).
Ao rotacionar, atualize também a Script Property `RUFLO_WEBHOOK_SECRET` do
Apps Script — caso contrário `intakeGmail` passa a receber `401` do
Cloud Run.
