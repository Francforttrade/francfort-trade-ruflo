# TRACKING FTR — Francfort (v4.0.0)

Reescrita completa do indexador de FTRs. Deixa de ser um extrator raso
de assunto/corpo e passa a ser um pipeline de ingestão documental:
classifica anexos pelo conteúdo (inclusive PDFs/imagens escaneados com
nome genérico como `scan.pdf`), faz OCR quando necessário, cruza
múltiplas fontes por FTR com uma hierarquia de confiança por campo, e
só grava na planilha quando não há conflito relevante — caso contrário
marca a linha como `REVISAR` e registra o conflito na aba de auditoria.

Este diretório é um projeto Apps Script independente (`clasp`). Não
compartilha escopo com `gmail-sync/` nem `gmail-intake/` — cada um tem
seu próprio `appsscript.json` e namespace (`TrackingFTR`), então os
três podem ser implantados em containers Apps Script separados sem
colisão de nomes.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `Config.gs` | Namespace raiz, constantes, aliases de coluna, hierarquia de confiança |
| `Security.gs` | Hashing, mascaramento, logger seguro, validação de compartilhamento |
| `SheetMap.gs` | Leitura dinâmica do cabeçalho; cria `PORTO ORIGEM`/`BL` se ausentes |
| `HtmlUtils.gs` | Corpo HTML → texto; extração de tabelas HTML |
| `AttachmentPipeline.gs` | Validação de anexo, pasta temp, conversão/OCR via Drive API, limpeza |
| `GmailSource.gs` | Watermark, filtro de relevância de thread, coleta de blocos de texto |
| `Extraction.gs` | Classificador documental + todos os extratores/normalizadores de campo |
| `Resolver.gs` | Agrega evidências por FTR, aplica hierarquia de confiança, detecta conflito |
| `Persistence.gs` | Índice de FTR/booking/BL, política de gravação, `LOG_EXTRAÇÃO`, lock |
| `Pipeline.gs` | Orquestração: orçamento de tempo/OCR, checkpoint, escrita em lote |
| `Diagnostics.gs` | dry-run, testes de thread/anexo únicos, 15 casos internos, validações |
| `Triggers.gs` | Únicas funções globais (`trackingFtr...`), instalação de acionadores, menu |

## Instalação

1. Crie um novo projeto Apps Script (script.google.com → Novo projeto)
   **ou** use `clasp create --type standalone` a partir deste diretório.
2. Copie o conteúdo de cada `.gs` para um arquivo de mesmo nome no
   editor (ou `clasp push` se usar `clasp`).
3. Copie `appsscript.json` para o manifesto do projeto (**Ver
   manifesto do projeto** precisa estar habilitado em
   Configurações do projeto).
4. Ative o serviço avançado **Drive API**: no editor, ícone `+` ao
   lado de "Serviços" → selecione **Drive API** → Adicionar. Confirme
   que a versão fica `v2` (é a que o código usa — `Drive.Files.insert`
   com `ocr`/`ocrLanguage`).
5. Salve. Na primeira execução de qualquer função, a tela de
   consentimento OAuth vai listar os escopos do `appsscript.json`
   (Gmail somente leitura, Sheets, Drive, Docs somente leitura,
   gerenciar os próprios acionadores, e-mail da conta em uso). Revise
   e aceite.

   > **Nota sobre o escopo do Drive:** a intenção original era usar
   > `drive.file` (só arquivos criados pelo próprio script) em vez do
   > escopo amplo `drive`. Na prática, o serviço embutido `DriveApp`
   > (usado para criar/gerenciar a pasta temporária, checar
   > compartilhamento da planilha, mover temporários pra lixeira) exige
   > o escopo `https://www.googleapis.com/auth/drive` quando os escopos
   > são fixados manualmente no manifesto — `drive.file` não é
   > suficiente mesmo para `DriveApp.createFolder()`. Isso foi
   > confirmado rodando `trackingFtrValidarPermissoes()` de verdade
   > (erro `Specified permissions are not sufficient to call
   > DriveApp.createFolder`). É uma limitação documentada do Apps
   > Script, não do código — o risco residual é aceito e mitigado pelas
   > validações de compartilhamento em `Security.gs`, que abortam a
   > execução se qualquer arquivo relevante estiver exposto
   > publicamente.

## Ordem de execução recomendada

```
trackingFtrValidarPermissoes()        // confere Drive API, planilha, pasta temp, conta em uso
trackingFtrValidarCompartilhamentos() // planilha/pasta não podem estar públicas
trackingFtrDiagnosticarCabecalho()    // mapeia colunas; cria PORTO ORIGEM/BL se faltarem
trackingFtrRodarTestesInternos()      // 15 casos sintéticos, sem tocar em dado real
trackingFtrDryRun(10)                 // simula em até 10 threads reais, NÃO grava
trackingFtrProcessar()                // executa de verdade (protegido por lock)
trackingFtrInstalarAcionadores()      // agenda a cada 30 min + manutenção diária
```

## Reprocessamento e manutenção

```
trackingFtrReprocessarFTR("03062-26")        // dry-run
trackingFtrReprocessarFTR("03062-26", true)  // grava de verdade (com lock)
trackingFtrReprocessarPeriodo(180)           // dry-run de 180 dias
trackingFtrReprocessarPeriodo(180, true)     // grava de verdade (com lock)
trackingFtrPadronizarFTRs()                  // dry-run da normalização da coluna FTR
trackingFtrPadronizarFTRs(true)              // aplica
trackingFtrLimparTemporarios()               // limpa órfãos na pasta temp controlada
trackingFtrResetarWatermark()                // força janela de 90 dias na próxima execução
trackingFtrExibirFilaOcr()                   // uso de OCR da última execução
trackingFtrTestarThread("<threadId>")        // dry-run de 1 thread
trackingFtrTestarAnexo("<messageId>", 0)     // roda conversão/OCR em 1 anexo, sem gravar
```

## Segurança e retenção — resumo operacional

- A planilha e a pasta temporária são validadas quanto a
  compartilhamento inseguro (`ANYONE`/`ANYONE_WITH_LINK`) **antes** de
  qualquer processamento; se detectado, a execução aborta sem gravar.
- A aba `LOG_EXTRAÇÃO` é criada automaticamente na primeira execução
  real. **Restrinja o acesso a ela manualmente** (Dados → Intervalos
  protegidos, ou proteção de aba) para administradores/revisores.
- Nenhum log ou diagnóstico imprime corpo de email, texto de anexo,
  OCR bruto, ou IDs de mensagem/thread completos — tudo passa por
  `Security.mascarar*` antes de qualquer `console.log`.
- Retenção do log: `CFG.RETENCAO_LOG_DIAS` (180 dias por padrão).
  `trackingFtrManutencaoDiaria` (agendado) remove linhas vencidas.
- Arquivos temporários: nome aleatório (`tmp_<uuid>`), vivem só na
  pasta `TrackingFTR_TMP_DO_NOT_SHARE`, são registrados por ID antes
  de qualquer processamento e movidos para a lixeira ao final da
  execução (nunca excluídos por nome, nunca fora da pasta controlada).

## Limitações conhecidas

- OCR (`Drive.Files.insert` com `ocr:true`) aceita **um** idioma por
  chamada — a "prioridade pt/en/es/fr" é implementada como até
  `CFG.OCR_MAX_TENTATIVAS_IDIOMA` tentativas sequenciais, não uma
  lista nativa.
- TIFF tem suporte inconsistente no conversor do Drive; falha é
  tratada como "sem texto extraído", nunca como erro fatal do lote.
- Sem separador real de "página" em texto já extraído, a deduplicação
  de pesos repetidos em páginas diferentes é best-effort (por valor
  idêntico consecutivo).
- `DriveApp` (serviço embutido) precisa do escopo amplo
  `https://www.googleapis.com/auth/drive` para operações básicas como
  `createFolder`/`getFileById`/`getSharingAccess` quando os escopos do
  projeto são fixados manualmente — confirmado em teste real, não é
  suposição. `drive.file`/`drive.metadata.readonly` não bastam para o
  `DriveApp`, mesmo que bastassem para o serviço avançado `Drive.*`.
  O risco residual (acesso amplo ao Drive da conta que executa o
  script) é mitigado pelas validações de compartilhamento que abortam
  a execução diante de qualquer configuração insegura.
