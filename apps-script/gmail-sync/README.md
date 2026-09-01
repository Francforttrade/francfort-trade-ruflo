# FRANCFORT — Gmail → Ruflo sync (Apps Script)

## O que este script faz (e o que ele não faz)

Este é o "sensor" leve descrito em `docs/ARQUITETURA.md` ("Apps Script — Gmail
intake, Trigger 15min") e no `docs/ROADMAP.md` ("Fallback: Gmail trigger (Apps
Script 15min)"). Ele **só** observa a caixa de entrada de `export@francfort.co`
e encaminha cada mensagem nova (assunto, corpo, remetente, thread, anexos) para
o endpoint `/webhook-gmail` já existente no serviço Ruflo (Cloud Run).

Toda a extração de FTR/invoice/booking/BL, cruzamento, cálculo de saldo,
geração de evento no Calendar e alerta de 7 dias acontece do lado Node
(`src/agents/comunicacao`, `src/agents/financeiro`, `src/agents/logistics` —
ver `docs/PAGAMENTOS_TRACKING.md`). Este script **nunca**:

- marca mensagens como lidas, arquiva, exclui ou move e-mails;
- responde automaticamente a remetentes;
- altera labels existentes (a label de "processado" é opcional e configurável);
- decide status de pagamento, cria eventos de Calendar ou envia alertas —
  isso é feito pelo serviço Node.

## Pré-requisitos

- Acesso à conta `export@francfort.co` (ou a uma conta com delegação de acesso
  a essa caixa de entrada).
- O serviço Ruflo já publicado no Cloud Run, com `WEBHOOK_SHARED_SECRET`
  configurado (ver `.env.example` na raiz do repositório) — o mesmo valor
  também precisa existir no Secret Manager como `francfort-whatsapp-webhook-secret`
  (ver `docs/DEPLOY.md`, passo 2).
- A conta que vai autorizar este script precisa do papel
  `roles/secretmanager.secretAccessor` **nesse secret específico** (não no
  projeto inteiro):

  ```bash
  gcloud secrets add-iam-policy-binding francfort-whatsapp-webhook-secret \
  	--member="user:export@francfort.co" \
  	--role="roles/secretmanager.secretAccessor" \
  	--project=<PROJECT_ID>
  ```

## Por que o secret vem do Secret Manager em vez de Script Properties

O shared secret nunca é digitado nem armazenado neste script — `Config.gs`
(`getWebhookSecret_`) lê o valor atual direto do Secret Manager a cada
execução, usando o token OAuth do próprio script (`cloud-platform`) e
cacheando o resultado só durante essa execução. Isso evita ter uma segunda
cópia do segredo espalhada em Script Properties, e uma rotação do secret no
Secret Manager já vale na próxima sincronização, sem precisar reconfigurar o
script.

## Configuração passo a passo

1. **Crie uma planilha de controle** no Google Drive de `export@francfort.co`
   (ex.: "Francfort — Painel de Sincronização Gmail"). O menu deste script só
   aparece em uma planilha à qual ele esteja vinculado.
2. Na planilha, abra **Extensões → Apps Script**.
3. Apague o `Code.gs` padrão e crie um arquivo `.gs` para cada arquivo desta
   pasta (`Config.gs`, `Utils.gs`, `GmailSync.gs`, `Menu.gs`, `Triggers.gs`,
   `TestMode.gs`), colando o conteúdo correspondente.
4. Abra **Configurações do projeto** (ícone de engrenagem) e cole o conteúdo
   de `appsscript.json` no editor de manifesto (ative "Mostrar arquivo de
   manifesto 'appsscript.json'" nas configurações, se necessário).
5. Salve e recarregue a planilha. O menu **FRANCFORT – PAGAMENTOS** deve
   aparecer.
6. No menu, clique em **Configurar credenciais (webhook)** e informe:
   - a URL completa do endpoint, ex.: `https://ruflo-xxxxx.a.run.app/webhook-gmail`;
   - o **GCP Project ID** onde o secret `francfort-whatsapp-webhook-secret`
     está armazenado (não o valor do secret em si — ver seção acima).
7. Na primeira execução, o Google pedirá autorização para os escopos listados
   em `appsscript.json` (Gmail somente leitura + labels, Drive apenas para
   arquivos criados pelo próprio script, envio de e-mail para alertas
   críticos, chamadas de rede externas, e `cloud-platform` para ler o secret
   no Secret Manager). Autorize com a conta `export@francfort.co`. Se a conta
   ainda não tiver o papel `secretAccessor` do pré-requisito acima, toda
   sincronização vai falhar com um erro claro ("Falha ao ler o secret...")
   até o papel ser concedido.

## Modo de teste

Use **Ativar/desativar modo de teste** no menu antes de rodar em produção.
Com o modo de teste ativado, `syncGmailToWebhook` lê o Gmail normalmente, mas
**não** envia nada ao webhook — apenas registra nos Logs (Ver → Registros de
execução) o payload que seria enviado. Use **Testar conexão com o webhook**
para validar URL + acesso ao Secret Manager com um ping (`{ ping: true }`),
que o lado Node responde sem criar nenhum registro.

## Instalando o gatilho automático

Menu → **Instalar gatilho automático (15 min)**. Isso cria um gatilho
temporizado chamado `syncGmailToWebhook` a cada 15 minutos (ajustável em
`Config.gs`, propriedade `SYNC_TRIGGER_MINUTES`). Rodar essa opção de novo não
duplica o gatilho — o script remove o anterior antes de criar um novo.

Para parar a sincronização automática: menu → **Remover gatilho automático**.

## Reprocessamento manual

- **Sincronizar agora**: roda a sincronização imediatamente, sem esperar o
  próximo disparo do gatilho.
- **Resetar checkpoint (reprocessar tudo)**: apaga o checkpoint e a lista de
  mensagens já processadas, fazendo a próxima sincronização revisitar até
  `INITIAL_BACKFILL_DAYS` dias de e-mails (30 por padrão). Use com cautela —
  isso reenvia mensagens antigas ao webhook, que por sua vez pode reprocessá-
  las (o lado Node deve ser idempotente para isso, mas volume grande pode
  gerar reprocessamento pesado).

## Ajustando o tamanho de anexo enviado embutido vs. via Drive

`Config.gs` → `MAX_INLINE_ATTACHMENT_BYTES` (3 MB por padrão). Anexos até esse
tamanho vão embutidos como base64 no payload; anexos maiores são enviados para
uma pasta no Drive (`DRIVE_FOLDER_NAME`) e apenas o link é encaminhado.

## Rollback / desativação

1. Menu → **Remover gatilho automático** (para a sincronização automática).
2. Em **Extensões → Apps Script → Configurações do projeto → Propriedades do
   script**, você pode apagar `WEBHOOK_URL`/`GCP_PROJECT_ID` para desativar o
   envio por completo sem apagar o código. Alternativamente, revogar o papel
   `secretmanager.secretAccessor` da conta no secret também basta — a próxima
   sincronização falha ao ler o secret e nada é enviado.
3. Para remover totalmente: apague o projeto Apps Script e, se desejar, a
   planilha de controle. Nenhum dado é apagado do Gmail nem do serviço Ruflo
   por este processo — o script nunca teve permissão para isso.

## Testes

- `runSelfTests()` (rodável pelo editor ou pelo menu, se adaptado): verifica
  se as credenciais estão configuradas, sem tocar em Gmail/rede.
- `runFormattingSelfTests_()`: valida os helpers puros de formatação/
  checkpoint com entradas fixas — rode manualmente pelo editor depois de
  qualquer alteração em `Utils.gs`/`GmailSync.gs`.
- `testWebhookConnection()`: chama o webhook real com `{ ping: true }` e
  retorna o código HTTP + corpo da resposta.
