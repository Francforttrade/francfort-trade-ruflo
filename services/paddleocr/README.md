# PaddleOCR worker

Microsserviço Python separado do app principal do Rúflo — ver
`docs/RDIA_PRD.md` seção 26 para a justificativa arquitetural (por que este é
o único componente do agente DIGITALIZACAO que precisa ser um serviço
deployado à parte, em vez de um módulo dentro do app Node).

## O que faz

Dois endpoints, chamados por `src/agents/digitalizacao/ocrClient.js`:

- `POST /ocr` — `{file_base64, mime_type}` → `{text, confidence, pages}`.
  Extração de texto solto via PaddleOCR.
- `POST /table` — mesmo input → `{table_rows, confidence}`. Extração de
  tabela via PP-Structure, normalizada para o mesmo formato
  `[{coluna: valor}, ...]` que `structuredFileExtractor.js` já produz para
  XLSX, para que `tableExtractor.js` no lado Node não precise de um caminho
  específico por origem.
- `GET /health` — health check do Cloud Run.

PDF é rasterizado (via `pdf2image`/poppler) antes de entrar no
PaddleOCR/PPStructure — nenhum dos dois lê PDF diretamente.

## Rodando localmente

```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

Nota: a primeira chamada a `/ocr` ou `/table` baixa os pesos do modelo
PaddleOCR (lazy-loaded na primeira invocação, não no import do módulo) —
espere alguns segundos/minutos na primeira chamada, dependendo da conexão.

## Deploy

Ver `docs/DEPLOY.md` — este serviço é deployado **privado** (IAM, nunca
`--allow-unauthenticated`), invocável só pela service account do serviço
principal do Rúflo via token OIDC (autenticação serviço-a-serviço padrão do
Cloud Run), nunca exposto publicamente.

## O que NÃO foi validado neste repositório

`docker build`/deploy real não foram executados neste ambiente de
desenvolvimento (mesma limitação já registrada em `docs/DEPLOY.md` para o
`Dockerfile` raiz — a política de rede da sessão bloqueia o registry do
Docker Hub). O que **foi** validado localmente: `app.py` importa sem erros,
define as rotas esperadas, e o tratamento de erro de decodificação
(`/ocr`/`/table` com base64 inválido) responde 400 em vez de crashar.
