# RUFLO: FIRESTORE vs SUPABASE STRATEGY

---

## 🎯 DECISÃO ARQUITETURAL

### Por que DUAL DATABASE?

**Firestore** = Cache + Working Memory (EPHEMERAL)
- Estado corrente de processamento FTR
- Rascunhos em progresso
- Sessões + Audit trail (write-heavy)
- Mutex locks para evitar race conditions
- TTL policy (auto-delete após expiração)

**Supabase PostgreSQL** = Permanent Records (PERSISTENT)
- Master data: FTR, Booking, Invoice, BL, Payment (APPEND-ONLY)
- Customer database (sync com Excel)
- Relações complexas (FK constraints)
- Full-text search (compliance alerts)
- Compliance archive (5-year retention)

---

## 📊 FIRESTORE SCHEMA (CACHE + STATE)

### Collection: `ftr_processing`

**Propósito:** Estado corrente de uma operação FTR (durante processamento)

```javascript
// Document ID: ftr_code (ex: "03075-26")
{
  ftr_code: "03075-26",
  current_status: "Em análise",  // Enum: 5 valores
  current_phase: "INTAKE",       // Enum: INTAKE, NEGOTIATION, COMPLIANCE, DOCUMENTATION, PAYMENT, FINAL
  
  // Fila de agentes a executar
  agent_queue: [
    { agent: "COMERCIAL", priority: 1, scheduled_time: "2026-08-16T10:00:00Z" },
    { agent: "COMPLIANCE", priority: 2, scheduled_time: "2026-08-16T14:00:00Z" }
  ],
  
  // Mutex lock para evitar race condition (múltiplos Cloud Run workers)
  lock_acquired_by: "cloud-run-worker-3",
  lock_timestamp: "2026-08-16T09:30:00Z",
  lock_ttl_seconds: 300,  // Expired após 5 min (fallback)
  
  // Last update timestamp
  last_updated: "2026-08-16T09:35:00Z",
  updated_by: "claude@anthropic.com",
  
  // Contadores para retry logic
  retry_count: 0,
  last_error: null
}
```

**TTL Policy:** 7 dias (auto-delete após processamento completo)

**Índices recomendados:**
```
- Composite: (current_status, last_updated) DESC
- Single: current_phase
```

---

### Collection: `booking_draft`

**Propósito:** Rascunho de booking antes de confirmar com armador

```javascript
// Document ID: booking_id (ex: "BK-000001-26")
{
  booking_id: "BK-000001-26",
  ftr_code: "03075-26",
  
  draft_data: {
    shipment_date_etd: "2026-08-25",
    container_count: 24,
    destination_port: "Algiers",
    freight_rate_usd: 1500,
    carrier_preference: "Maersk",
    notes: "Prefer reefer vessel for peanuts"
  },
  
  status: "pending_confirmation",  // pending_confirmation, confirmed, cancelled
  created_at: "2026-08-16T09:00:00Z",
  updated_at: "2026-08-16T09:30:00Z",
  created_by: "rodrigo@francfort.co"
}
```

**TTL Policy:** 14 dias (booking típico confirma em 7-10 dias)

---

### Collection: `sessions`

**Propósito:** Rastreabilidade de sessões de processamento (user activity)

```javascript
// Document ID: session_id (ex: "sess-20260816-123456")
{
  session_id: "sess-20260816-123456",
  user_email: "rodrigo@francfort.co",
  user_ip: "192.168.1.100",
  
  processed_ftrs: ["03075-26", "03067-26"],
  processed_at: "2026-08-16T10:00:00Z",
  total_ftrs_processed: 2,
  
  status: "completed",  // active, paused, completed
  session_start: "2026-08-16T09:00:00Z",
  session_end: "2026-08-16T10:30:00Z"
}
```

**TTL Policy:** 3 dias

---

### Collection: `audit_log`

**Propósito:** Completa auditoria de todas as operações (NÃO deletar)

```javascript
// Document ID: audit_id (ex: "AUD-1629108600-001")
{
  audit_id: "AUD-1629108600-001",
  timestamp: "2026-08-16T09:35:00Z",
  user_email: "rodrigo@francfort.co",
  ip_address: "192.168.1.100",
  
  operation: "release_documents",  // create_ftr, update_payment, release_docs, etc
  resource_type: "FTR",  // FTR, Booking, Invoice, Payment, etc
  resource_id: "03075-26",
  
  change_description: "Released original documents to DHL",
  
  before_state: {
    original_docs_released: false,
    payment_status: "Received"
  },
  after_state: {
    original_docs_released: true,
    release_date: "2026-08-16T09:35:00Z",
    courier: "DHL",
    tracking: "1234567890"
  },
  
  status: "Success",  // Success, Failed, Pending
  error_message: null
}
```

**TTL Policy:** 5 ANOS (não deletar, compliance requerimento)

**Índices:**
```
- Composite: (resource_type, timestamp) DESC
- Composite: (user_email, timestamp) DESC
- Single: resource_id (lookup todas as operações de 1 FTR)
```

---

### Collection: `temp_documents`

**Propósito:** Documentos temporários (PDF, files) durante assembly

```javascript
// Document ID: temp_doc_id (ex: "temp-03075-26-BL-123456")
{
  temp_doc_id: "temp-03075-26-BL-123456",
  ftr_code: "03075-26",
  
  document_type: "BL",  // BL, Invoice, CO, Phyto, etc
  content: "base64_encoded_pdf_content",  // ou URL ao Google Drive
  file_size_bytes: 245678,
  
  created_at: "2026-08-16T09:00:00Z",
  created_by: "DOCUMENTACAO_agent"
}
```

**TTL Policy:** 7 dias (após validação, move para Google Drive)

---

## 🐘 SUPABASE PostgreSQL SCHEMA (PERMANENT)

### Table: `ftr` (Master)

```sql
CREATE TABLE ftr (
  ftr_code VARCHAR(20) PRIMARY KEY,  -- "03075-26"
  
  -- Relacionamentos
  seller_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  buyer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  intermediary_id VARCHAR(20) REFERENCES customers(customer_id),
  
  -- Produto
  product_type VARCHAR(50) NOT NULL,  -- "Peanuts", "Grains", "Sugar"
  product_grade VARCHAR(20),  -- "38/42", "40/50"
  hs_code VARCHAR(20),  -- "1202.41.90"
  
  -- Quantidade & Valor
  quantity_mt NUMERIC(10,2) NOT NULL,
  container_count INTEGER,
  unit_price_usd NUMERIC(12,2) NOT NULL,
  total_value_usd NUMERIC(14,2) GENERATED ALWAYS AS (quantity_mt * unit_price_usd),
  
  -- Incoterm & Localização
  incoterm VARCHAR(20) NOT NULL,  -- FOB, CFR, CIF
  loading_port VARCHAR(50) DEFAULT 'Santos',
  destination_port VARCHAR(50) NOT NULL,
  
  -- Datas
  creation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  etd_planned DATE,
  eta_expected DATE,
  inspection_date_planned DATE,
  
  -- Compliance
  market VARCHAR(50) NOT NULL,  -- Egypt, Algeria, Russia, Ukraine, Poland, etc
  aflatoxin_limit_ppb NUMERIC(3,1),
  
  -- Status workflow
  status VARCHAR(50) NOT NULL DEFAULT 'Em análise',
  status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  notes TEXT,
  
  -- Índices
  INDEX idx_ftr_status (status),
  INDEX idx_ftr_market (market),
  INDEX idx_ftr_seller (seller_id),
  INDEX idx_ftr_buyer (buyer_id),
  INDEX idx_ftr_created_at (created_at DESC)
);
```

---

### Table: `customers` (Master - SINCRONIZA COM EXCEL)

```sql
CREATE TABLE customers (
  customer_id VARCHAR(20) PRIMARY KEY,  -- "CUST-000001" ou CNPJ
  
  name VARCHAR(255) NOT NULL,
  cnpj_or_tax_id VARCHAR(20) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL,  -- "Buyer", "Seller", "Intermediary", "Broker"
  country VARCHAR(100),
  
  contact_name VARCHAR(255),
  contact_email VARCHAR(100),
  contact_phone VARCHAR(20),
  
  credit_limit_usd NUMERIC(14,2),
  payment_terms_standard VARCHAR(100),
  
  market_focus TEXT[],  -- ARRAY: ["Peanuts", "Grains"]
  
  active BOOLEAN DEFAULT true,
  last_transaction_date DATE,
  
  notes TEXT,
  
  -- Sincronização com Excel
  excel_sync_date TIMESTAMP,
  excel_last_modified_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_customers_country (country),
  INDEX idx_customers_type (type),
  INDEX idx_customers_cnpj (cnpj_or_tax_id)
);
```

---

### Table: `bookings`

```sql
CREATE TABLE bookings (
  booking_id VARCHAR(20) PRIMARY KEY,  -- "BK-000001-26"
  ftr_code VARCHAR(20) NOT NULL REFERENCES ftr(ftr_code),
  
  etd DATE NOT NULL,
  eta DATE,
  container_count INTEGER NOT NULL,
  container_numbers TEXT[],  -- ARRAY: ["MAEU1234567", "MAEU1234568"]
  
  carrier VARCHAR(100),  -- Maersk, CMA CGM, Hapag-Lloyd, MSC, Evergreen
  vessel_name VARCHAR(100),
  voyage_number VARCHAR(20),
  
  freight_rate_usd NUMERIC(12,2),
  freight_prepaid BOOLEAN DEFAULT false,
  
  booking_status VARCHAR(50) DEFAULT 'Quoted',  -- Quoted, Confirmed, Shipped, Cancelled
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_bookings_ftr (ftr_code),
  INDEX idx_bookings_etd (etd),
  INDEX idx_bookings_status (booking_status)
);
```

---

### Table: `invoices`

```sql
CREATE TABLE invoices (
  invoice_number VARCHAR(50) PRIMARY KEY,  -- "INV-03075-001"
  ftr_code VARCHAR(20) NOT NULL REFERENCES ftr(ftr_code),
  booking_id VARCHAR(20) REFERENCES bookings(booking_id),
  
  issuer_id VARCHAR(20) REFERENCES customers(customer_id),
  buyer_id VARCHAR(20) REFERENCES customers(customer_id),
  
  invoice_date DATE NOT NULL,
  total_amount_usd NUMERIC(14,2) NOT NULL,
  
  payment_terms VARCHAR(100),
  
  -- CRITICAL: Bank account encrypted
  bank_account_number VARCHAR(255),  -- PGP encrypted
  swift_code VARCHAR(20),
  beneficiary VARCHAR(255),
  
  -- Russia rule: account ONLY, no bank name
  special_instructions TEXT,
  
  invoice_status VARCHAR(50) DEFAULT 'Draft',  -- Draft, Issued, Paid, Disputed
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_invoices_ftr (ftr_code),
  INDEX idx_invoices_status (invoice_status),
  INDEX idx_invoices_date (invoice_date DESC)
);
```

---

### Table: `payments` (CRÍTICO)

```sql
CREATE TABLE payments (
  payment_id VARCHAR(20) PRIMARY KEY,  -- "PAY-000001-26"
  ftr_code VARCHAR(20) NOT NULL REFERENCES ftr(ftr_code),
  invoice_number VARCHAR(50) REFERENCES invoices(invoice_number),
  
  amount_usd NUMERIC(14,2) NOT NULL,
  
  payment_type VARCHAR(50),  -- Advance, Main, Partial
  payment_method VARCHAR(50) NOT NULL,  -- SWIFT, LC, CAD, Check
  
  swift_reference VARCHAR(100) UNIQUE,  -- Deve ser único
  swift_sent_date TIMESTAMP,
  swift_received_date TIMESTAMP,
  
  -- GATE CRÍTICO
  bank_credit_confirmed BOOLEAN DEFAULT false,
  bank_credit_confirmed_date TIMESTAMP,
  bank_credit_confirmation_method VARCHAR(100),  -- Bank Statement, Email, Portal
  
  original_documents_released BOOLEAN DEFAULT false,
  original_docs_release_date TIMESTAMP,
  courier_company VARCHAR(100),
  courier_tracking_number VARCHAR(100),
  
  payment_status VARCHAR(50) DEFAULT 'Pending',  -- Pending, In Transit, Received, Cleared, Disputed
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_payments_ftr (ftr_code),
  INDEX idx_payments_swift (swift_reference),
  INDEX idx_payments_status (payment_status),
  INDEX idx_payments_created (created_at DESC)
);
```

---

### Table: `bl_documents`

```sql
CREATE TABLE bl_documents (
  bl_number VARCHAR(50) PRIMARY KEY,  -- "MAE12345678"
  bl_type VARCHAR(20) NOT NULL,  -- Master, House
  ftr_code VARCHAR(20) NOT NULL REFERENCES ftr(ftr_code),
  booking_id VARCHAR(20) REFERENCES bookings(booking_id),
  
  container_numbers TEXT[] NOT NULL,  -- ARRAY: ["MAEU1234567", "MAEU1234568"]
  
  shipper_id VARCHAR(20) REFERENCES customers(customer_id),
  consignee_id VARCHAR(20) REFERENCES customers(customer_id),
  notify_party_id VARCHAR(20) REFERENCES customers(customer_id),
  
  vessel_name VARCHAR(100),
  voyage_number VARCHAR(20),
  
  port_of_loading VARCHAR(50),
  port_of_discharge VARCHAR(50),
  
  freight_prepaid BOOLEAN,
  
  marks_and_numbers TEXT,
  description_goods TEXT,
  
  weight_kg NUMERIC(12,2),
  volume_cbm NUMERIC(12,2),
  
  bl_date DATE NOT NULL,
  onboard_date DATE,
  
  bl_status VARCHAR(50) DEFAULT 'Draft',  -- Draft, Issued, Telex Released, Original Delivered
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_bl_ftr (ftr_code),
  INDEX idx_bl_booking (booking_id),
  INDEX idx_bl_status (bl_status),
  INDEX idx_bl_bl_number (bl_number)
);
```

---

### Table: `compliance_events`

```sql
CREATE TABLE compliance_events (
  compliance_id VARCHAR(20) PRIMARY KEY,  -- "CMP-030075-26"
  ftr_code VARCHAR(20) NOT NULL REFERENCES ftr(ftr_code),
  
  market VARCHAR(50) NOT NULL,
  
  document_type VARCHAR(100),  -- ACID, Import Permit, Phyto, Fumigation, Aflatoxin, Quality, CO
  status VARCHAR(50) NOT NULL,  -- Pending, Obtained, Expired, Failed
  
  expiry_date DATE,
  issued_by VARCHAR(255),
  reference_number VARCHAR(100),
  
  -- Aflatoxin specifics
  aflatoxin_limit_ppb NUMERIC(3,1),
  lab_result_ppb NUMERIC(3,1),
  lab_name VARCHAR(255),
  test_date DATE,
  aflatoxin_result_status VARCHAR(50),  -- Pass, Fail, Pending
  
  -- Quality approval
  buyer_approved BOOLEAN,
  approval_date DATE,
  approved_by VARCHAR(100),
  
  -- Alert tracking
  alert_sent BOOLEAN DEFAULT false,
  alert_sent_date TIMESTAMP,
  days_until_expiry INTEGER GENERATED ALWAYS AS (EXTRACT(DAY FROM (expiry_date - CURRENT_DATE))),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_compliance_ftr (ftr_code),
  INDEX idx_compliance_market (market),
  INDEX idx_compliance_status (status),
  INDEX idx_compliance_expiry (expiry_date)
);
```

---

### Table: `commissions`

```sql
CREATE TABLE commissions (
  commission_id VARCHAR(20) PRIMARY KEY,  -- "COM-000001-26"
  ftr_code VARCHAR(20) NOT NULL REFERENCES ftr(ftr_code),
  
  beneficiary_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
  
  commission_base_usd NUMERIC(14,2) NOT NULL,
  commission_type VARCHAR(50) NOT NULL,  -- Percentage, Per MT, Flat Fee
  commission_rate NUMERIC(6,4),  -- 0.5 untuk 0.5%, atau 25 untuk USD 25/MT
  commission_amount_usd NUMERIC(14,2) NOT NULL,
  
  invoice_generated BOOLEAN DEFAULT false,
  invoice_number VARCHAR(50),
  invoice_date DATE,
  
  payment_status VARCHAR(50) DEFAULT 'Pending',  -- Pending, Invoiced, Paid, Disputed
  payment_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_commissions_ftr (ftr_code),
  INDEX idx_commissions_beneficiary (beneficiary_id),
  INDEX idx_commissions_status (payment_status)
);
```

---

## 🔄 DATA FLOW: FIRESTORE ↔ SUPABASE

### Scenario 1: Create FTR

```
1. Email chegou → COMUNICACAO + MASTER validam em FIRESTORE
   - Firestore: ftr_processing {ftr_code: "03075-26", status: "Em análise"}
   
2. COMERCIAL gera quote (rascunho)
   - Firestore: temp_documents {ftr_code: "03075-26", doc: "offer.pdf"}
   
3. Seller aprovado → SUPABASE persist
   - Supabase: INSERT ftr {ftr_code, seller_id, buyer_id, qty, price, market, status}
   - Supabase: INSERT customers (se novo cliente)
   
4. Limpar Firestore (opcional)
   - Firestore: delete temp_documents (após copiar para Google Drive)
```

### Scenario 2: Payment Gate (CRÍTICO)

```
1. Invoice emitida → SUPABASE
   - Supabase: invoices {invoice_number, bank_account_encrypted}
   
2. SWIFT enviado → email recebido → FINANCEIRO valida
   - Supabase UPDATE payments: swift_reference, swift_sent_date
   
3. Bank credit confirma (email/portal)
   - Supabase UPDATE payments: bank_credit_confirmed = true
   
   ⚠️ GATE LOCK: Se bank_credit_confirmed = false → FINANCEIRO agent BLOCKS release
   
4. ✅ Liberar originais
   - Supabase UPDATE payments: original_documents_released = true, release_date, courier
   - Firestore AUDIT_LOG: {operation: "release_documents", user: "rodrigo@", timestamp}
   - Email: DHL tracking + Supabase payment_status = "Cleared"
```

### Scenario 3: Compliance Calendar Alert

```
Daily job (MONITOR agent):
1. Query Supabase: compliance_events WHERE expiry_date <= CURRENT_DATE + 7 DAYS AND alert_sent = false
2. Para cada evento:
   - Enviar email Rodrigo: "ACID expira em 3 dias (FTR 03075-26)"
   - Supabase UPDATE compliance_events: alert_sent = true, alert_sent_date = now()
3. Firestore AUDIT_LOG: {operation: "compliance_alert_sent", ...}
```

---

## 📈 QUERY EXAMPLES

### Firestore (Cloud Firestore SDK)

```javascript
// Obter estado corrente de uma FTR
const doc = await db.collection('ftr_processing').doc('03075-26').get();
const { current_status, agent_queue } = doc.data();

// Listar FTRs em processamento (últimas 24h)
const query = await db.collection('ftr_processing')
  .where('last_updated', '>=', new Date(Date.now() - 86400000))
  .orderBy('last_updated', 'desc')
  .get();

// Audit trail de uma FTR
const auditDocs = await db.collection('audit_log')
  .where('resource_type', '==', 'FTR')
  .where('resource_id', '==', '03075-26')
  .orderBy('timestamp', 'desc')
  .get();
```

### Supabase PostgreSQL

```sql
-- Revenue por market (últimos 30 dias)
SELECT 
  f.market,
  COUNT(*) as ftr_count,
  SUM(f.total_value_usd) as total_revenue
FROM ftr f
WHERE f.created_at >= CURRENT_DATE - 30
GROUP BY f.market
ORDER BY total_revenue DESC;

-- Pagamentos pendentes (>7 dias antes arrival)
SELECT 
  f.ftr_code,
  p.invoice_number,
  p.amount_usd,
  b.eta,
  EXTRACT(DAY FROM (b.eta - NOW())) as days_until_arrival
FROM payments p
JOIN ftr f ON p.ftr_code = f.ftr_code
JOIN bookings b ON f.ftr_code = b.ftr_code
WHERE p.payment_status != 'Cleared'
  AND b.eta < NOW() + INTERVAL 7 DAY
ORDER BY days_until_arrival ASC;

-- Clientes com crédito vencido
SELECT 
  c.customer_id,
  c.name,
  COUNT(f.ftr_code) as open_ftrs,
  SUM(f.total_value_usd) as total_exposure
FROM customers c
LEFT JOIN ftr f ON c.customer_id = f.buyer_id AND f.status != 'Final'
WHERE c.type = 'Buyer'
  AND c.credit_limit_usd > 0
GROUP BY c.customer_id, c.name
HAVING SUM(f.total_value_usd) > c.credit_limit_usd;

-- Compliance alerts (ACID expira em 7 dias)
SELECT 
  c.compliance_id,
  f.ftr_code,
  c.document_type,
  c.expiry_date,
  EXTRACT(DAY FROM (c.expiry_date - CURRENT_DATE)) as days_until_expiry
FROM compliance_events c
JOIN ftr f ON c.ftr_code = f.ftr_code
WHERE c.status IN ('Obtained', 'Pending')
  AND c.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
  AND c.alert_sent = false
ORDER BY c.expiry_date ASC;
```

---

## 🚀 MIGRATION STRATEGY (Day 1)

1. **Firestore:** Criar collections vazias (TTL policies pronto)
2. **Supabase:** Schema DDL completo + índices
3. **Apps Script:** Conectar a Supabase `customers` table (pull lista)
4. **First FTR:** Processar 03075-26 end-to-end (Firestore → Supabase)
5. **Audit:** Validar audit_log capturou todas operações
6. **Backup:** Testar backup diário (Firestore export, pg_dump)

---

## 📝 PRÓXIMOS PASSOS

- [ ] Confirmar Firestore projeto + Supabase connection string
- [ ] Deploy DDL Supabase (ou eu posso escrever script de migração)
- [ ] Teste de conectividade Cloud Run ↔ Firestore ↔ Supabase
- [ ] Upload Excel clientes → seed `customers` table
