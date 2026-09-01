# Deploy no Cloud Run

Passos de setup único, antes do primeiro deploy. Requer acesso ao projeto
GCP `francfort-trade-ruflo` (ou o que for criado).

## 1. Habilitar APIs

```bash
gcloud services enable run.googleapis.com \
	cloudbuild.googleapis.com \
	secretmanager.googleapis.com \
	firestore.googleapis.com \
	--project=<PROJECT_ID>
```

## 2. Criar os secrets no Secret Manager

Nomes conforme o checklist de segurança do `docs/ROADMAP.md`:

```bash
echo -n "<valor>" | gcloud secrets create francfort-anthropic-api-key --data-file=- --project=<PROJECT_ID>
echo -n "<valor>" | gcloud secrets create francfort-supabase-url --data-file=- --project=<PROJECT_ID>
echo -n "<valor>" | gcloud secrets create francfort-supabase-key --data-file=- --project=<PROJECT_ID>
echo -n "<valor>" | gcloud secrets create francfort-supabase-service-key --data-file=- --project=<PROJECT_ID>
echo -n "<valor>" | gcloud secrets create francfort-whatsapp-webhook-secret --data-file=- --project=<PROJECT_ID>
```

Dê ao service account do Cloud Run (`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`,
ou um service account dedicado) o papel `roles/secretmanager.secretAccessor`
em cada secret.

## 3. Aplicar o schema do Supabase

```bash
psql "<connection string do Supabase>" -f supabase/migrations/0001_init_schema.sql
```

## 4. Deploy das regras/índices do Firestore

```bash
firebase deploy --only firestore --project=<PROJECT_ID>
bash scripts/setup-firestore-ttl.sh   # requer GCP_PROJECT_ID no ambiente
```

## 5. Primeiro deploy

Manual (`scripts/deploy-cloud-run.sh`) ou via Cloud Build (`cloudbuild.yaml`,
disparado por um trigger conectado a este repositório):

```bash
GCP_PROJECT_ID=<PROJECT_ID> bash scripts/deploy-cloud-run.sh
```

## 6. Gmail intake (Apps Script)

Fallback de intake por Gmail, ver `apps-script/gmail-intake/README.md` para
o passo a passo completo de deploy (`clasp`) e configuração. Requer conceder
à conta que autoriza o script o papel `roles/secretmanager.secretAccessor`
no secret `francfort-whatsapp-webhook-secret` criado no passo 2:

```bash
gcloud secrets add-iam-policy-binding francfort-whatsapp-webhook-secret \
	--member="user:<email-da-conta-do-apps-script>" \
	--role="roles/secretmanager.secretAccessor" \
	--project=<PROJECT_ID>
```

## Notas

- O serviço é implantado com `--allow-unauthenticated`: os endpoints
  (`/webhook-whatsapp`, `/webhook-gmail` etc.) são públicos porque IAM não
  autentica chamadores externos (WhatsApp, o trigger do Apps Script). O
  controle de acesso real é o segredo compartilhado validado em
  `src/middleware/webhookAuth.js` — todo request precisa do header
  `X-Webhook-Secret` batendo com a env var `WEBHOOK_SHARED_SECRET`, mapeada
  ao secret `francfort-whatsapp-webhook-secret` do Secret Manager (item 2
  acima). Veja `apps-script/gmail-intake/README.md` para o setup do lado do
  Apps Script.
- O `Dockerfile` **não foi validado com `docker build` real** neste ambiente
  — a política de rede da sessão bloqueia o registry do Docker Hub
  (`production.cloudfront.docker.com`, erro 403). Validar o build antes do
  primeiro deploy real, localmente ou no próprio Cloud Build.
- Região usada nos exemplos: `southamerica-east1` (São Paulo) — ajuste se
  preferir outra.
