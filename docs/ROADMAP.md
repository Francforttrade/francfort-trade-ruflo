# RUFLO SYSTEM — MATRIZ RESPONSABILIDADES, ROADMAP E SEGURANÇA

---

## 📊 MATRIZ RESPONSABILIDADES (11 AGENTES + ORQUESTRADOR)

| Agent | Input | Process | Output | Critical Flow | SLA |
|-------|-------|---------|--------|---|---|
| **ORQUESTRADOR-MASTER** | Email/WhatsApp/Manual | State machine validation, FTR phase routing, mutex lock | Routing decision to agent queue | Gate-keeper: 70% determinístico (valid FTR, status enum, data completeness) | Real-time |
| **COMUNICACAO** | Raw email/WhatsApp, manual entry | Parse subject/body, extract FTR code, detect buyer/seller, classify intent | Structured message object → Firestore → MASTER | Intake normalization, deduplicate, label Gmail | <5min |
| **COMERCIAL** | Quote request, competitor pricing, client history | Generate oferta using template, validate pricing, check credit limit | Commercial offer (PDF), pricing approval | Seller negotiation loop: draft → buyer approval | 24h response |
| **CONTRATOS** | Buyer T&C, amendment request, signature proof | Parse contract terms, compare to standard, track amendments, validate signature | Contract approval, tracked changes log | Seller ≈24h, Buyer 24h, Terceiros 4d | 4 days |
| **COMPLIANCE** | FTR market, aflatoxin specs, regulatory dates | Calendar alerts (ACID, import permits, phyto renewal), fetch expiry dates, send reminders | Compliance checklist, alert escalation | BLOCKER: ACID/permit must exist before BL | Daily 06:00 |
| **DOCUMENTACAO** | FTR approved, buyer QA passed, payment confirmed | Assemble BL/CO/Phyto/fumigation, validate document set, generate invoice if missing | Document set package (files + checklist) | PDF generation, signature validation | 48h pre-ETD |
| **FINANCEIRO** | Invoice issued, SWIFT sent, bank statement available | Validate SWIFT ref, confirm bank credit, verify payment received, authorize release | Release flag for original documents, payment tracking | GATE: No docs released until SWIFT confirmed | 7 days pre-arrival |
| **QUALIDADE** | Lab report uploaded, buyer quality request | Parse aflatoxin/moisture/purity, validate against limit, escalate fail, track buyer approval | QA sign-off, quality exception report | Buyer can request new lab, reject lot | 5 days |
| **LOGISTICS** | Booking confirmed, container numbers assigned | ETD/ETA lookup (Searates), container tracking, calendar events, demurrage alerts | Container tracker update, calendar ETA events | Link Booking → BL → Container numbers | Daily 07:00 |
| **COMISSOES** | FTR final, payment confirmed | Calculate commission (% or USD/MT), generate invoice, track payment | Commission invoice, reconciliation report | Monthly accrual on days 10/25 | Monthly |
| **EXCEPCOES** | Any agent error, retry exhausted, conflict detected | Retry with exponential backoff, log to DLQ (Firestore falhas_processamento), escalate manual | Escalation email/Chat, manual decision queue | If >2 retries → Rodrigo notified immediately | Immediate |
| **MONITOR** | All agents, KPI data, SLA tracking | Calculate daily FTRs processed, payment SLA, documentation delays, agent errors | Dashboard (TRACKING 2026), KPI cards, alerts | SLA red flags: payment >7d pre-arrival, docs <48h ETD | Hourly |

---

## 🎯 FLUXO CRÍTICO FTR END-TO-END

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: INTAKE & VALIDAÇÃO (COMUNICACAO + MASTER)              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Email recebido (GMAIL)                                       │
│ 2. COMUNICACAO extrai: FTR code, seller, buyer, qty, price      │
│ 3. MASTER valida: FTR format, seller/buyer in customers?, qty>0?│
│ 4. ✅ Válido → Firestore ftr_processing com status "Em análise" │
│ 5. ❌ Inválido → DLQ + escalação                                │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: NEGOCIAÇÃO (COMERCIAL + CONTRATOS)                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. COMERCIAL gera quote (seller 24h revisão)                    │
│ 2. CONTRATOS valida T&C (seller ≈24h, buyer 24h, terceiros 4d) │
│ 3. Assinatura comprovada                                        │
│ 4. Status → "Aprovação"                                         │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: COMPLIANCE & LOGISTICS (COMPLIANCE + LOGISTICS)         │
├─────────────────────────────────────────────────────────────────┤
│ 1. COMPLIANCE: ACID obtained?, import permit pending?,           │
│    Phyto valid?, aflatoxin spec = 5ppb Russia / 2ppb EU?        │
│ 2. LOGISTICS: Booking confirmed, ETD, container numbers         │
│ 3. Both ready → "Em revisão de correção" or approval            │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 4: DOCUMENTAÇÃO & QUALIDADE (DOCUMENTACAO + QUALIDADE)     │
├─────────────────────────────────────────────────────────────────┤
│ 1. DOCUMENTACAO: BL/CO/Phyto/Fumigation/Invoice generated       │
│ 2. QUALIDADE: Lab report uploaded, aflatoxin parsed, buyer OK   │
│ 3. All docs assembled, validation pass                          │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 5: PAGAMENTO & LIBERAÇÃO DOCS (FINANCEIRO)                 │
├─────────────────────────────────────────────────────────────────┤
│ 🔐 CRÍTICO: Não liberar docs até SWIFT confirmado + crédito ✅  │
│ 1. Invoice issued, SWIFT enviado                                │
│ 2. FINANCEIRO: Confirm SWIFT reference recebida pelo banco      │
│ 3. Bank credit confirmed (statement ou email banco)             │
│ 4. ✅ Liberar originais via DHL/courier                         │
│ 5. Status → "Final"                                             │
└─────────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────────┐
│ FASE 6: COMISSÃO & RASTREAMENTO (COMISSOES + MONITOR)           │
├─────────────────────────────────────────────────────────────────┤
│ 1. COMISSOES calcula (% ou USD/MT), gera invoice                │
│ 2. Tracking atualiza: FTR → Booking → BL → Container → ETA      │
│ 3. MONITOR consolida KPIs, alertas SLA                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📅 ROADMAP 4 SEMANAS

### SEMANA 1: INFRAESTRUTURA & CACHING

**Objetivo:** Setup Cloud Run, Firestore, Supabase, Secret Manager

- [ ] Criar projeto Cloud Run
  - [ ] Dockerfile base (Node.js)
  - [ ] `server.js` skeleton com endpoints (0 handlers, apenas routing)
  - [ ] Deploy inicial (health check `/ping` → 200)
  
- [ ] Setup Firestore
  - [ ] Collections: `ftr_processing`, `booking_draft`, `sessions`, `audit_log`, `temp_documents`
  - [ ] Security rules (read/write restrição)
  - [ ] TTL policies (7d booking_draft, 5yr audit_log)
  
- [ ] Setup Supabase PostgreSQL
  - [ ] Schema DDL: `ftr`, `customers`, `bookings`, `invoices`, `payments`, `bl_documents`, `compliance_events`, `commissions`
  - [ ] Índices (ftr_code, booking_id, invoice_number)
  - [ ] Row-Level Security (RLS) placeholder
  
- [ ] Secret Manager
  - [ ] Armazenar: Anthropic API key, Bank credentials, WhatsApp webhook secret
  - [ ] Rotação automática de tokens
  
- [ ] Google Sheets TRACKING 2026
  - [ ] Confirmar sheet IDs, criar abas: DigestBuffer, Rastreamento, KPI
  
**Dependência concluída para:** Semana 2

**Responsável:** Rodrigo + Leonardo (co-admin)

---

### SEMANA 2: AGENTES COMUNICACAO + COMERCIAL

**Objetivo:** Intake funcional + quote generation

#### COMUNICACAO Agent
- [ ] Endpoint `/webhook-whatsapp` (Cloud Run)
  - [ ] Parse incoming WhatsApp message (nome, email, FTR code)
  - [ ] Fallback: Gmail trigger (Apps Script 15min)
  - [ ] Estruturar JSON: `{from, subject, body, extracted_ftr_code, intent}`
  
- [ ] Gmail classifier
  - [ ] Detectar padrões: "Oferta de", "FTR", "Booking", "Invoice", "BL"
  - [ ] Extrair: seller, buyer, qty, preço (regex + AI fallback)
  - [ ] Armazenar em Firestore `sessions` com thread_id
  
- [ ] Response template manager
  - [ ] Template "Quote Received" → Rodrigo confirmation
  - [ ] Template "Booking Confirmed" → Buyer/Seller notification
  
**Testing:** 
- [ ] Unit test: parse email "Oferta de 600 MT peanuts 38/42" → extract qty=600, grade="38/42"
- [ ] Integration test: real email → Firestore entry

#### COMERCIAL Agent
- [ ] Quote generation from template
  - [ ] Input: seller, buyer, product, qty, incoterm
  - [ ] Output: Commercial offer (assinado "Rodrigo Francfort – Francfort Trade")
  - [ ] Validação: preço dentro de 20% histórico? credit_limit buyer?
  
- [ ] Pricing lookup
  - [ ] Supabase query: histórico preços últimos 30 dias
  - [ ] Cálculo FOB Santos, CFR, CIF
  - [ ] Alertas: preço anormalmente baixo? (possível dump)
  
- [ ] T&C negotiation tracking
  - [ ] Seller revisão em 24h?
  - [ ] Buyer aceitou payment terms?
  - [ ] Deadline tracking → escalação se >2 dias sem resposta
  
**Testing:**
- [ ] Unit test: gerar oferta Brazil peanuts → template filled
- [ ] Compliance test: price dump detection (preço <-25% histórico)

**Dependência:** Semana 1 ✅

**Responsável:** Agent COMERCIAL (Claude Sonnet) + COMUNICACAO (Claude Haiku)

---

### SEMANA 3: AGENTES CONTRATOS + DOCUMENTACAO + COMPLIANCE

**Objetivo:** Ciclo completo de contrato + documentação crítica

#### CONTRATOS Agent
- [ ] Contract T&C parser
  - [ ] Extrair: buyer, seller, qty, preço, incoterm, payment terms, delivery date
  - [ ] Validação: buyer credit_limit >= total_value?
  - [ ] Detectar amendments: "alteração para 550 MT" → new version
  
- [ ] Amendment tracking
  - [ ] Versioning (FTR 03075-26, 03075-26-1, 03075-26-2)
  - [ ] Before/after audit trail
  
- [ ] Signature workflow
  - [ ] Seller signature proof (email +/- PDF signed)
  - [ ] Buyer signature proof
  - [ ] Store em Supabase + Google Drive `/FTR_ROOT_FOLDER/03075-26/contract_signed.pdf`

#### DOCUMENTACAO Agent
- [ ] BL assembly
  - [ ] Input: booking_id, container_numbers, buyer consignee address
  - [ ] Output: BL template filled (shipper, consignee, vessel, marks)
  - [ ] Validação: consignee address matches buyer address? ✓
  
- [ ] Invoice generation
  - [ ] Input: seller, buyer, qty, unit_price, incoterm
  - [ ] **RULE RUSSIA:** Se buyer = Agrotrade Rus, bank_account ONLY (sem nome banco)
  - [ ] Output: PDF invoice + Supabase entry
  
- [ ] CO (Certificate of Origin)
  - [ ] Gerar documento PDF
  - [ ] Assinatura Rodrigo Francfort
  
- [ ] Phytosanitary certificate
  - [ ] Parse lab report
  - [ ] Verificar validade
  - [ ] Emitir Phyto PDF
  
- [ ] Document set validation
  - [ ] Checklist: BL ✓, CO ✓, Phyto ✓, Fumigation ✓, Invoice ✓, Quality ✓
  - [ ] SLA: 48h before ETD

#### COMPLIANCE Agent
- [ ] Regulatory calendar
  - [ ] Market-specific requirements:
    - [ ] **Egypt:** ACID (CargoX/USDA), aflatoxin ≤2ppb
    - [ ] **Algeria:** Import permit, livre circulação, ACID optional
    - [ ] **Russia:** Aflatoxin ≤5/10ppb, phyto, certificate
  
- [ ] Aflatoxin spec mapping
  - [ ] FTR market = Russia → limit 5ppb
  - [ ] FTR market = Egypt → limit 2ppb
  - [ ] DB lookup: compliance_events table
  
- [ ] Alert system
  - [ ] ACID expiry in 7 days → email Rodrigo + DOCUMENTACAO
  - [ ] Import permit pending → escalação
  - [ ] Lab result > limit → quality exception
  
- [ ] Phyto renewal tracking
  - [ ] Validade Phyto (típicamente 30 dias)
  - [ ] Alertar 7 dias antes expirar

**Testing:**
- [ ] Unit test: Egypt FTR → aflatoxin limit = 2ppb ✓
- [ ] Integration test: Russia FTR → FINANCEIRO recebe payent ok → DOCUMENTACAO libera docs ✓
- [ ] Compliance test: Algeria import permit missing → COMPLIANCE escalação ✓

**Dependência:** Semana 2 ✅

**Responsável:** DOCUMENTACAO (Sonnet) + COMPLIANCE (Sonnet) + CONTRATOS (Sonnet)

---

### SEMANA 4: AGENTES FINANCEIRO + QUALIDADE + LOGISTICS + EXCEÇÕES + MONITOR

**Objetivo:** Full orchestration + exception handling + monitoring

#### FINANCEIRO Agent
- [ ] SWIFT validation
  - [ ] Endpoint: recebe SWIFT ref, valida formato (ITAU123ABC456XYZ)
  - [ ] Query banco (mock): confirma crédito recebido
  - [ ] Supabase: atualiza payments.bank_credit_confirmed = true
  
- [ ] **GATE CRÍTICO:** Original document release
  - [ ] Pré-condições:
    - [ ] invoice_status = "Issued" ✓
    - [ ] payment_status = "Received" ✓
    - [ ] bank_credit_confirmed = true ✓
  - [ ] Ação: release_flag = true → email DHL, courier número
  - [ ] Audit: log quem, quando, qual FTR
  
- [ ] Payment reconciliation
  - [ ] Diário: comparar SWIFT recebidos vs. invoices
  - [ ] Flag: pagamento >7 dias antes chegada → alerta desnecessário (bounce?)
  
#### QUALIDADE Agent
- [ ] Lab report parsing
  - [ ] Aceitar PDF upload (filename padrão: `FTR_03075-26_EUROFINS_2026-08-15.pdf`)
  - [ ] OCR/extract: aflatoxin PPB, moisture, purity
  - [ ] Validação: lab acreditado? (eurofins.com?)
  
- [ ] Aflatoxin compliance check
  - [ ] FTR market = Egypt, lab result = 3ppb, limit = 2ppb → ❌ FAIL
  - [ ] Escalação: email seller + buyer ("rejeitar lote ou requerer novo lab")
  
- [ ] Buyer quality approval
  - [ ] Endpoint para buyer: "Aceitar lote?" → yes/no
  - [ ] Signature email + timestamp
  - [ ] Supabase: quality_approval.approved = true/false

#### LOGISTICS Agent
- [ ] ETD/ETA tracking via Searates
  - [ ] Endpoint `/logistics/track?container=MAEU1234567`
  - [ ] Query Searates API: carrier, vessel, ETA
  - [ ] Atualizar Firestore + TRACKING 2026 sheet
  
- [ ] Container number linking
  - [ ] Booking BK-000001-26 → [MAEU1234567, MAEU1234568, ...]
  - [ ] BL → [MAEU1234567, MAEU1234568]
  - [ ] Validação: count match?
  
- [ ] Calendar integration
  - [ ] Google Calendar event: "BK-000001-26 ETA Algiers" em 2026-09-20
  - [ ] Reminder: 3 dias antes
  
- [ ] Demurrage alerts
  - [ ] Se ETA confirmada < ETD + free_time (14 dias), calcular demurrage
  - [ ] Alertar Rodrigo (responsabilidade armador?)

#### EXCEÇÕES Agent
- [ ] Retry logic
  - [ ] Exponential backoff: 1s, 5s, 30s, 5m, 30m
  - [ ] Max 3 retries
  
- [ ] DLQ (Dead Letter Queue)
  - [ ] Firestore collection: `falhas_processamento`
  - [ ] Campos: FTR, agent, error_msg, timestamp, retry_count
  
- [ ] Escalação manual
  - [ ] Se retry_count = 3 → email Rodrigo
  - [ ] Google Chat notification
  - [ ] "Ação necessária: FTR 03075-26 agente FINANCEIRO falhou (motivo: SWIFT timeout)"
  
- [ ] Manual override
  - [ ] Rodrigo clica "Aprovar mesmo assim" → audit trail: "Rodrigo override @ 2026-09-01 14:30"
  - [ ] Agente continua

#### MONITOR Agent
- [ ] KPI calculation (diário)
  - [ ] FTRs em análise: contagem
  - [ ] FTRs finalizados (último 7 dias): count + revenue USD
  - [ ] Avg ciclo dias (criação → Final)
  - [ ] Payment SLA: % pagamentos 7d pre-arrival? (target 95%)
  - [ ] Documentation SLA: % BLs emitidos 48h pre-ETD? (target 98%)
  
- [ ] SLA alerts
  - [ ] Se payment SLA < 85% → email Rodrigo "SLA em risco"
  - [ ] Se agent error rate > 5% → "Agente XXXX presenting issues"
  
- [ ] Dashboard export
  - [ ] Endpoint `/dashboard/kpi` → JSON com últimas 7 days
  - [ ] Render em TRACKING 2026 (aba KPI)
  - [ ] Charts: FTRs by market, revenue by buyer, payment delays

**Testing:**
- [ ] End-to-end: FTR 03075-26 entrada → payment confirmado → docs released → ETA calendar → KPI updated ✓
- [ ] Exception: FINANCEIRO timeout → retry 3x → DLQ → Rodrigo notified ✓
- [ ] Compliance: aflatoxin FAIL → QUALIDADE escalação → seller response ✓

**Dependência:** Semana 3 ✅

**Responsável:** FINANCEIRO (Sonnet) + QUALIDADE (Haiku) + LOGISTICS (Haiku) + EXCEÇÕES (Haiku) + MONITOR (Haiku)

---

## 🔐 SECURITY CHECKLIST

### A. SECRET MANAGEMENT

- [ ] **Google Cloud Secret Manager setup**
  - [ ] Criar secrets:
    - [ ] `francfort-anthropic-api-key` (rotate monthly)
    - [ ] `francfort-bank-itau-account` (PII encrypted)
    - [ ] `francfort-whatsapp-webhook-secret` (rotate quarterly)
    - [ ] `francfort-supabase-connection-string` (DB password)
  
- [ ] **Credenciais em variáveis ambiente (não hardcoded)**
  - [ ] Cloud Run env var → Secret Manager reference
  - [ ] Apps Script PropertiesService → ainda OK para não-PII (trial loop count, etc)
  
- [ ] **Encrypt at rest**
  - [ ] Firestore: Customer encryption key (GCP default = AES-256)
  - [ ] Supabase: PostgreSQL pgcrypto extension para bank_account
  ```sql
  ALTER TABLE invoices ADD bank_account_encrypted TEXT;
  CREATE TRIGGER encrypt_bank_account BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION pgp_sym_encrypt(new.bank_account, 'master_key');
  ```

### B. AUDIT LOGGING

- [ ] **Firestore audit_log collection**
  - [ ] Obrigatório: user_email, timestamp, operation, resource_id, before/after state
  - [ ] Index: (resource_type, timestamp) para queries rápidas
  - [ ] TTL: 5 anos
  
- [ ] **Critical operations logged:**
  - [ ] Create FTR
  - [ ] Update payment status
  - [ ] Release original documents (🔐 CRITICALISSIMO)
  - [ ] Override manual (Rodrigo approve FTR despite error)
  - [ ] Compliance exception (ACID expired, aflatoxin fail)

- [ ] **Audit trail retention**
  - [ ] Não deletar histórico
  - [ ] Backup daily para Google Cloud Storage (archive)

### C. ACCESS CONTROL

- [ ] **Cloud IAM roles**
  - [ ] `francfort-dev` (Rodrigo) → Editor role (Cloud Run, Firestore, Supabase)
  - [ ] `leonardo-admin` → Viewer + specific write (Firestore, TRACKING 2026)
  - [ ] Apps Script trigger account → minimal scope (Gmail, Sheets, Drive)
  
- [ ] **Supabase Row-Level Security (RLS)**
  - [ ] (Future) Se multi-user: restrição por market (Egypt ops ≠ Russia)
  - [ ] Hoje: anon role = disabled, só auth role
  
- [ ] **Cloud Run authentication**
  - [ ] Endpoint `/webhook-whatsapp` → JWT validation (Bearer token)
  - [ ] Validar `X-Webhook-Signature` header (HMAC)

### D. DATA PROTECTION

- [ ] **Bank account obfuscation**
  - [ ] Invoice display: "****7890" (últimos 4 dígitos)
  - [ ] Armazenamento: encrypted em Supabase
  - [ ] Rule: RUSSIA invoices (Agrotrade Rus) = account_only (sem nome banco)
  
- [ ] **PII minimization**
  - [ ] Logs: não registrar full bank account, só masked
  - [ ] Backup: remover PII antes exportar para teste
  
- [ ] **Encryption in transit**
  - [ ] HTTPS obrigatório (Cloud Run default)
  - [ ] SSL/TLS 1.2+ (verificar Searates, Cargowise APIs)

### E. BACKUP & DISASTER RECOVERY

- [ ] **Daily backup strategy**
  - [ ] Firestore: exportar para Google Cloud Storage (gs://francfort-backup/firestore/)
  - [ ] Supabase: pg_dump diário (scheduled backup)
  - [ ] TRACKING 2026 sheet: versionamento automático (Google Sheets versioning)
  
- [ ] **Cross-region replication**
  - [ ] Supabase: enable replication to standby (point-in-time restore)
  - [ ] Firestore: multi-region (apenas se critical)
  
- [ ] **Recovery testing**
  - [ ] Monthly: restore backup para staging, validar integrity
  - [ ] Rodrigo sign-off: "Backup OK"

### F. RATE LIMITING & DoS PROTECTION

- [ ] **Cloud Run rate limiting**
  - [ ] API Gateway: max 100 req/min por cliente
  - [ ] WhatsApp webhook: max 10 msg/sec per phone
  - [ ] Throttle: exponential backoff se exceed
  
- [ ] **Input validation**
  - [ ] FTR code regex: `^\d{5}-\d{2}(-\d)?$`
  - [ ] Qty > 0, < 10000 MT (sanity check)
  - [ ] Email format validation
  
- [ ] **Dependency DoS mitigation**
  - [ ] Searates API timeout: 5s max
  - [ ] Fallback: use cached ETA se API down

### G. LOGGING & MONITORING

- [ ] **Cloud Logging**
  - [ ] Cloud Run logs: todas as requisições (method, path, status, latency)
  - [ ] Firestore logs: read/write counts por collection
  - [ ] Error logging: stack trace, user context, recovery action
  
-