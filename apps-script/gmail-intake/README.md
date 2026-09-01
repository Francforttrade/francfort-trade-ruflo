# Gmail intake (Apps Script)

Fallback de intake por Gmail para o agente COMUNICACAO — dispara a cada
15 minutos, varre a inbox e encaminha threads novas para o endpoint
`/webhook-gmail` do Cloud Run (`src/routes/index.js`). Ver
`docs/ARQUITETURA.md` e `docs/ROADMAP.md`.

## Deploy (clasp)

```bash
npm install -g @google/clasp
clasp login
cd apps-script/gmail-intake
clasp create --type standalone --title "Francfort FTR - Gmail Intake"
clasp push
```

`clasp create` gera um `.clasp.json` local (não versionado) com o
`scriptId` do projeto — não commitar esse arquivo.

## Configuração pós-deploy

1. No editor do Apps Script (`clasp open`), Project Settings > Script
   Properties, adicionar:
   - `WEBHOOK_URL`: URL do serviço Cloud Run, sem barra final (ex.:
     `https://francfort-trade-ruflo-xxxx.a.run.app`).
   - `GCP_PROJECT_ID`: projeto onde o secret
     `francfort-whatsapp-webhook-secret` foi criado (`docs/DEPLOY.md`).
2. Conceder à conta que autoriza o script (a "Apps Script trigger
   account" do `docs/ROADMAP.md`) o papel
   `roles/secretmanager.secretAccessor` nesse secret — o script lê o
   valor do webhook secret direto do Secret Manager em vez de duplicá-lo
   em Script Properties.
3. Rodar a função `setupTrigger` uma vez pelo editor (autoriza os escopos
   do `appsscript.json` e cria o trigger de 15 min). É idempotente, pode
   rodar de novo sem duplicar o trigger.

## Escopos (`appsscript.json`)

- `gmail.modify` — ler mensagens e aplicar o label `FTR-Processado`.
- `script.external_request` — `UrlFetchApp` para o Cloud Run e o Secret
  Manager.
- `script.scriptapp` — criar/remover o trigger de tempo em `setupTrigger`.
- `cloud-platform` — token OAuth do script usado para autenticar a
  leitura do secret no Secret Manager.
