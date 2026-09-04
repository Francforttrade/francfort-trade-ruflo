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

## 6. PaddleOCR worker (docs/RDIA_PRD.md chunk 2a)

Serviço Cloud Run separado (`services/paddleocr/`), buildado/deployado pelo
mesmo `cloudbuild.yaml` (agora com 2 imagens). Passos únicos que o Cloud
Build **não** faz sozinho:

```bash
# 1. Conceder à service account do ruflo (o serviço principal) permissão
#    para invocar o worker PaddleOCR (privado, sem --allow-unauthenticated).
gcloud run services add-iam-policy-binding ruflo-paddleocr \
	--region=southamerica-east1 \
	--member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
	--role="roles/run.invoker" \
	--project=<PROJECT_ID>
```

O `cloudbuild.yaml` já deploya `ruflo-paddleocr` antes de `ruflo` e passa a
URL resultante como `PADDLE_OCR_SERVICE_URL` automaticamente — não precisa
setar essa env var manualmente em deploys via Cloud Build. Para rodar
`scripts/deploy-cloud-run.sh` manualmente (fora do Cloud Build), configure
`PADDLE_OCR_SERVICE_URL` você mesmo com a URL do `gcloud run services
describe ruflo-paddleocr --format='value(status.url)'`.

**Não validado neste ambiente:** nem o `docker build` do
`services/paddleocr/Dockerfile` nem os passos de `gcloud run deploy` acima
foram executados de verdade (mesma limitação de rede já registrada para o
Dockerfile raiz). O que foi validado: `services/paddleocr/app.py` importa
sem erros e responde corretamente a `/health` e a entradas inválidas — ver
`services/paddleocr/README.md`.

## 7. Gmail intake (Apps Script)

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

## 8. Google Document AI (docs/RDIA_PRD.md chunk 2b)

Ao contrário do PaddleOCR (item 6), não há serviço novo para deployar —
Document AI é uma API gerenciada do Google, chamada pelo próprio serviço
`ruflo` via `@google-cloud/documentai`, autenticada com as mesmas
Application Default Credentials já usadas para Firestore/Supabase. Passos
únicos:

```bash
# 1. Habilitar a API Document AI no projeto.
gcloud services enable documentai.googleapis.com --project=<PROJECT_ID>

# 2. Conceder à service account do ruflo permissão para chamar processadores.
gcloud projects add-iam-policy-binding <PROJECT_ID> \
	--member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
	--role="roles/documentai.apiUser"

# 3. Criar um processador (tipo "Document OCR" cobre o caso de uso do
#    DIGITALIZACAO — texto solto; um form/table parser especializado pode
#    substituir depois, sem mudar o client) e anotar o ID e a região:
gcloud documentai processors create \
	--display-name="ruflo-digitalizacao" \
	--type="OCR_PROCESSOR" \
	--location=us \
	--project=<PROJECT_ID>
```

Setar `DOCUMENT_AI_PROCESSOR_ID` (o ID retornado no passo 3) e
`DOCUMENT_AI_LOCATION` (a região do processador, ex. `us`) como env vars do
serviço `ruflo` — ver `.env.example`. Sem `DOCUMENT_AI_PROCESSOR_ID`
configurado, o tier `expensive` fica desligado (nunca tentado) e o pipeline
para no resultado do PaddleOCR, degradando para revisão manual quando este
falhar — não é um erro de configuração bloqueante, é o comportamento padrão
até esse processador ser provisionado.

**Não validado neste ambiente:** a criação do processador e a chamada real à
API não foram exercitadas contra um projeto GCP de verdade (mesma limitação
de rede das outras integrações Google). O client SDK (`documentAiClient.js`)
foi validado com mocks — ver `src/agents/digitalizacao/documentAiClient.test.js`.

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
