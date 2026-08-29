# Gmail intake (Apps Script)

Implementa o nó `APPSCRIPT` de `docs/ARQUITETURA.md`: um Google Apps Script
roda a cada 15min, busca emails de trade não lidos e envia cada um para o
endpoint Cloud Run `/webhook-email`, que roteia pelo mesmo `master.route()`
usado pelo `/webhook-whatsapp` (agente COMUNICACAO).

Código-fonte: `scripts/apps-script/gmail-intake.gs` + `appsscript.json`.

## 1. Criar o projeto Apps Script

Opção A — via [clasp](https://github.com/google/clasp):

```bash
npm install -g @google/clasp
clasp login
cd scripts/apps-script
clasp create --type standalone --title "Ruflo Gmail Intake"
clasp push
```

Opção B — manual: abra [script.google.com](https://script.google.com), crie
um projeto novo, cole o conteúdo de `gmail-intake.gs` e ajuste o manifesto
(`Editor de projeto > mostrar arquivo de manifesto`) para bater com
`appsscript.json` deste repositório (escopos OAuth).

## 2. Configurar Script Properties

No editor: `Configurações do projeto (⚙️) > Propriedades do script`:

| Propriedade | Obrigatória | Descrição |
|---|---|---|
| `RUFLO_ENDPOINT_URL` | sim | URL do Cloud Run + `/webhook-email`, ex: `https://ruflo-352556500695.southamerica-east1.run.app/webhook-email` |
| `GMAIL_SEARCH_QUERY` | não | Sobrescreve a query padrão (`DEFAULT_SEARCH_QUERY` no script) |
| `USE_IAM_AUTH` | não | `"true"` se o Cloud Run exige autenticação (ver seção 3) |
| `IAM_SERVICE_ACCOUNT_EMAIL` | se `USE_IAM_AUTH=true` | Service account com `roles/run.invoker` no serviço |

## 3. Autenticação contra o Cloud Run

`scripts/deploy-cloud-run.sh` faz deploy com `--no-allow-unauthenticated`
(ver `docs/DEPLOY.md`), então chamadas precisam de um ID token do Google com
audience = URL do serviço. Apps Script não gera esse token diretamente, então
o script impersona uma service account via IAM Credentials API:

```bash
# 1. Criar a service account (ou reusar uma existente)
gcloud iam service-accounts create ruflo-gmail-intake \
  --display-name="Ruflo Gmail Intake" --project=<PROJECT_ID>

# 2. Dar a ela permissão pra invocar o Cloud Run
gcloud run services add-iam-policy-binding ruflo \
  --region=southamerica-east1 \
  --member="serviceAccount:ruflo-gmail-intake@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=<PROJECT_ID>

# 3. Autorizar a conta Google que roda o Apps Script (a conta com que você
#    fez `clasp login` / criou o projeto em script.google.com) a impersonar
#    essa service account
gcloud iam service-accounts add-iam-policy-binding \
  ruflo-gmail-intake@<PROJECT_ID>.iam.gserviceaccount.com \
  --member="user:<seu-email-google>" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project=<PROJECT_ID>
```

Depois disso, configure `USE_IAM_AUTH=true` e
`IAM_SERVICE_ACCOUNT_EMAIL=ruflo-gmail-intake@<PROJECT_ID>.iam.gserviceaccount.com`
nas Script Properties.

Alternativa mais simples (mas só recomendada em ambiente de teste): fazer
deploy do Cloud Run com `--allow-unauthenticated` e deixar `USE_IAM_AUTH`
sem configurar. Isso deixa o endpoint público — a validação de assinatura
(`X-Webhook-Signature`, `docs/ROADMAP.md` seção C) ainda está pendente e
deveria ser adicionada antes de ir pra produção nesse modo.

## 4. Rodar o setup

No editor do Apps Script, selecione a função `setup` e clique em ▶ Executar
(vai pedir autorização de escopos na primeira vez). Isso cria as labels
Gmail `Ruflo/Processado` e `Ruflo/Falhou`, e instala o trigger de 15min que
chama `intakeGmail`.

## 5. Testar

- Envie um email de teste pra caixa monitorada com algo como
  `Oferta de 600 MT peanuts 38/42, FTR 03075-26` no corpo.
- Rode `intakeGmail` manualmente pelo editor (▶) ou espere o trigger.
- Verifique: o email deve ficar marcado como lido e receber a label
  `Ruflo/Processado`; no Firestore, a collection `sessions` deve ganhar uma
  entrada nova (mesmo comportamento do `/webhook-whatsapp`, ver
  `src/agents/comunicacao/index.js`).
- `Execuções` no editor do Apps Script mostra os `Logger.log` de cada rodada
  (quantas threads, sucessos, falhas).

## Comportamento em falha

Se o POST falhar (rede, 4xx/5xx), a thread recebe a label `Ruflo/Falhou` em
vez de `Ruflo/Processado` e a mensagem continua não lida — ela **não** é
reprocessada automaticamente na próxima rodada (a query padrão exclui
`label:Ruflo/Falhou`) para evitar reenvio infinito de algo que já falhou;
remova a label manualmente depois de investigar para que ela volte pra fila.
