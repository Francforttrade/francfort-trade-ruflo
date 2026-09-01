-- Payment tracking / arrival-collection alerting (task spec: "CONTROLE DE
-- RECEBIMENTOS", "HISTÓRICO DE ALTERAÇÕES", "REVISÃO MANUAL").
--
-- Money/status fields already have a single source of truth in 0001's
-- `ftr`, `bookings`, `invoices`, `payments` and `bl_documents` tables — this
-- migration does not duplicate them. What's missing is the *tracking*
-- metadata the spec asks for that has nowhere else to live: one row per
-- FTR+booking+BL+invoice combination (a shipment can split across several of
-- these — see task spec section 3), carrying the Gmail/Calendar linkage,
-- alert bookkeeping, confidence level and manual-review flag. A view then
-- joins everything back together into the full ~35-column control screen.
-- Apply with: supabase db push

CREATE TABLE payment_tracking_meta (
	tracking_id VARCHAR(20) PRIMARY KEY, -- "TRK-000001-26"
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	invoice_number VARCHAR(50) REFERENCES invoices (invoice_number),
	booking_id VARCHAR(20) REFERENCES bookings (booking_id),
	bl_number VARCHAR(50) REFERENCES bl_documents (bl_number),

	-- Per-lot overrides: a split shipment can carry different container/tonnage
	-- figures than the parent FTR/booking row.
	container_count INTEGER,
	tonnage_mt NUMERIC(10, 2),
	payment_terms_override VARCHAR(100),
	payment_due_date DATE,

	payment_status VARCHAR(50) NOT NULL DEFAULT 'SEM_INFORMACAO'
		CHECK (payment_status IN (
			'SEM_INFORMACAO', 'PAGAMENTO_PREVISTO', 'AGUARDANDO_SWIFT', 'SWIFT_RECEBIDO',
			'PAGAMENTO_PARCIAL', 'PAGAMENTO_CONFIRMADO', 'SALDO_PENDENTE', 'VENCIDO', 'REVISAO_MANUAL'
		)), -- kept in sync with src/agents/financeiro/paymentStatusService.js's PAYMENT_STATUS

	eta_previous DATE,
	eta_current DATE,
	last_change_at TIMESTAMP,

	source VARCHAR(50), -- gmail, manual, apps_script_backfill, ...
	source_email_link TEXT,
	gmail_thread_id VARCHAR(100),

	calendar_event_id VARCHAR(255),
	calendar_event_link TEXT,

	alert_sent_at TIMESTAMP,
	alert_sent_for_eta DATE, -- dedup key: an alert already sent for this exact ETA doesn't re-fire (alertService.js)
	alert_status VARCHAR(50) DEFAULT 'NAO_ENVIADO', -- NAO_ENVIADO, ENVIADO, ENVIADO_VENCIDO, ERRO
	alert_recipients TEXT[],
	alert_message_id VARCHAR(100),
	alert_error TEXT,

	confidence_level VARCHAR(20)
		CHECK (confidence_level IN ('MUITO_ALTA', 'ALTA', 'MEDIA_ALTA', 'INSUFICIENTE')),
	needs_manual_review BOOLEAN DEFAULT false,
	manual_review_reason TEXT,

	last_synced_at TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracking_ftr ON payment_tracking_meta (ftr_code);
CREATE INDEX idx_tracking_invoice ON payment_tracking_meta (invoice_number);
CREATE INDEX idx_tracking_booking ON payment_tracking_meta (booking_id);
CREATE INDEX idx_tracking_bl ON payment_tracking_meta (bl_number);
CREATE INDEX idx_tracking_status ON payment_tracking_meta (payment_status);
CREATE INDEX idx_tracking_eta ON payment_tracking_meta (eta_current);
CREATE INDEX idx_tracking_manual_review ON payment_tracking_meta (needs_manual_review) WHERE needs_manual_review = true;

-- HISTÓRICO DE ALTERAÇÕES (task spec section 8) — append-only; a row here is
-- never updated or deleted. Firestore's `audit_log` collection (see
-- src/agents/contratos/auditTrail.js) already covers cross-agent audit
-- events; this table is specifically the field-level before/after trail for
-- a tracking row (booking/BL/ETA/payment changes) that the spec asks to
-- never be able to disappear even after Firestore's 5-year TTL housekeeping.
CREATE TABLE payment_change_history (
	change_id BIGSERIAL PRIMARY KEY,
	changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	actor VARCHAR(100), -- user email, or a process name like "logistics_agent"
	tracking_id VARCHAR(20) REFERENCES payment_tracking_meta (tracking_id),
	ftr_code VARCHAR(20),
	invoice_number VARCHAR(50),
	booking_id VARCHAR(20),
	bl_number VARCHAR(50),
	field_changed VARCHAR(100) NOT NULL,
	old_value TEXT,
	new_value TEXT,
	source VARCHAR(50),
	gmail_thread_id VARCHAR(100),
	source_email_link TEXT,
	calendar_action VARCHAR(50), -- created, updated, cancelled, none
	status VARCHAR(50) DEFAULT 'Success',
	error_message TEXT
);

CREATE INDEX idx_change_history_tracking ON payment_change_history (tracking_id, changed_at DESC);
CREATE INDEX idx_change_history_ftr ON payment_change_history (ftr_code, changed_at DESC);

-- REVISÃO MANUAL (task spec sections 2 and 10) — queue of tracking rows that
-- could not be safely auto-matched/auto-updated (ambiguous FTR, confidence
-- below the auto-update threshold). Resolved rows are kept, not deleted, so
-- the review decision itself is auditable.
CREATE TABLE payment_manual_review (
	review_id BIGSERIAL PRIMARY KEY,
	tracking_id VARCHAR(20) REFERENCES payment_tracking_meta (tracking_id),
	raised_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	reason TEXT NOT NULL,
	confidence_level VARCHAR(20),
	source_email_link TEXT,
	gmail_thread_id VARCHAR(100),
	raw_extracted_fields JSONB,
	resolved BOOLEAN DEFAULT false,
	resolved_at TIMESTAMP,
	resolved_by VARCHAR(100),
	resolution_notes TEXT
);

CREATE INDEX idx_manual_review_open ON payment_manual_review (resolved) WHERE resolved = false;
CREATE INDEX idx_manual_review_tracking ON payment_manual_review (tracking_id);

-- Currency was implicitly always USD in 0001 (`invoices.total_amount_usd`);
-- the spec asks the control sheet to show a currency column, so this adds it
-- as a nullable, defaulted column rather than renaming the existing one.
ALTER TABLE invoices ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'USD';

-- Reconstructs the ~35-column "CONTROLE DE RECEBIMENTOS" control screen by
-- joining the tracking metadata back onto the FTR/customers/invoices/
-- bookings/bl_documents tables that already own each field, plus an
-- aggregate of only the *confirmed* payments against that invoice (a SWIFT
-- copy alone never counts — see payments.bank_credit_confirmed).
CREATE VIEW payment_tracking_view AS
SELECT
	t.tracking_id,
	t.ftr_code,
	t.invoice_number,
	t.booking_id,
	t.bl_number,
	seller.name AS seller_name,
	buyer.name AS buyer_name,
	COALESCE(t.container_count, f.container_count) AS container_count,
	COALESCE(t.tonnage_mt, f.quantity_mt) AS tonnage_mt,
	i.total_amount_usd,
	i.currency,
	COALESCE(confirmed.amount_confirmed_usd, 0) AS amount_received_usd,
	i.total_amount_usd - COALESCE(confirmed.amount_confirmed_usd, 0) AS balance_usd,
	COALESCE(t.payment_terms_override, i.payment_terms) AS payment_terms,
	t.payment_due_date,
	confirmed.last_confirmed_payment_date,
	t.payment_status,
	f.loading_port AS origin_port,
	f.destination_port,
	b.vessel_name,
	b.voyage_number,
	b.etd,
	t.eta_previous,
	t.eta_current,
	t.last_change_at,
	t.source,
	t.source_email_link,
	t.gmail_thread_id,
	t.calendar_event_id,
	t.calendar_event_link,
	t.alert_sent_at,
	t.alert_status,
	t.needs_manual_review,
	t.manual_review_reason,
	t.confidence_level,
	t.last_synced_at
FROM payment_tracking_meta t
JOIN ftr f ON f.ftr_code = t.ftr_code
JOIN customers seller ON seller.customer_id = f.seller_id
JOIN customers buyer ON buyer.customer_id = f.buyer_id
LEFT JOIN invoices i ON i.invoice_number = t.invoice_number
LEFT JOIN bookings b ON b.booking_id = t.booking_id
LEFT JOIN LATERAL (
	SELECT SUM(p.amount_usd) AS amount_confirmed_usd, MAX(p.bank_credit_confirmed_date) AS last_confirmed_payment_date
	FROM payments p
	WHERE p.invoice_number = t.invoice_number AND p.bank_credit_confirmed = true
) confirmed ON true;

ALTER TABLE payment_tracking_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_manual_review ENABLE ROW LEVEL SECURITY;
