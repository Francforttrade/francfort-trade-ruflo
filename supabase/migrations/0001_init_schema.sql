-- RUFLO permanent records schema (docs/FIRESTORE_SUPABASE.md).
-- Apply with: supabase db push   (or psql against SUPABASE_URL's connection string)

CREATE TABLE customers (
	customer_id VARCHAR(20) PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	cnpj_or_tax_id VARCHAR(20) UNIQUE NOT NULL,
	type VARCHAR(50) NOT NULL, -- Buyer, Seller, Intermediary, Broker
	country VARCHAR(100),
	contact_name VARCHAR(255),
	contact_email VARCHAR(100),
	contact_phone VARCHAR(20),
	credit_limit_usd NUMERIC(14, 2),
	payment_terms_standard VARCHAR(100),
	market_focus TEXT[],
	active BOOLEAN DEFAULT true,
	last_transaction_date DATE,
	notes TEXT,
	excel_sync_date TIMESTAMP,
	excel_last_modified_date TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_country ON customers (country);
CREATE INDEX idx_customers_type ON customers (type);
CREATE INDEX idx_customers_cnpj ON customers (cnpj_or_tax_id);

CREATE TABLE ftr (
	ftr_code VARCHAR(20) PRIMARY KEY, -- "03075-26"
	seller_id VARCHAR(20) NOT NULL REFERENCES customers (customer_id),
	buyer_id VARCHAR(20) NOT NULL REFERENCES customers (customer_id),
	intermediary_id VARCHAR(20) REFERENCES customers (customer_id),
	product_type VARCHAR(50) NOT NULL, -- Peanuts, Grains, Sugar
	product_grade VARCHAR(20),
	hs_code VARCHAR(20),
	quantity_mt NUMERIC(10, 2) NOT NULL,
	container_count INTEGER,
	unit_price_usd NUMERIC(12, 2) NOT NULL,
	total_value_usd NUMERIC(14, 2) GENERATED ALWAYS AS (quantity_mt * unit_price_usd) STORED,
	incoterm VARCHAR(20) NOT NULL, -- FOB, CFR, CIF
	loading_port VARCHAR(50) DEFAULT 'Santos',
	destination_port VARCHAR(50) NOT NULL,
	creation_date DATE NOT NULL DEFAULT CURRENT_DATE,
	etd_planned DATE,
	eta_expected DATE,
	inspection_date_planned DATE,
	market VARCHAR(50) NOT NULL, -- Egypt, Algeria, Russia, Ukraine, Poland, South Africa, Tunisia
	aflatoxin_limit_ppb NUMERIC(3, 1),
	status VARCHAR(50) NOT NULL DEFAULT 'Em análise',
	status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	created_by VARCHAR(100),
	notes TEXT
);

CREATE INDEX idx_ftr_status ON ftr (status);
CREATE INDEX idx_ftr_market ON ftr (market);
CREATE INDEX idx_ftr_seller ON ftr (seller_id);
CREATE INDEX idx_ftr_buyer ON ftr (buyer_id);
CREATE INDEX idx_ftr_created_at ON ftr (created_at DESC);

CREATE TABLE bookings (
	booking_id VARCHAR(20) PRIMARY KEY, -- "BK-000001-26"
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	etd DATE NOT NULL,
	eta DATE,
	container_count INTEGER NOT NULL,
	container_numbers TEXT[],
	carrier VARCHAR(100), -- Maersk, CMA CGM, Hapag-Lloyd, MSC, Evergreen
	vessel_name VARCHAR(100),
	voyage_number VARCHAR(20),
	freight_rate_usd NUMERIC(12, 2),
	freight_prepaid BOOLEAN DEFAULT false,
	booking_status VARCHAR(50) DEFAULT 'Quoted', -- Quoted, Confirmed, Shipped, Cancelled
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_ftr ON bookings (ftr_code);
CREATE INDEX idx_bookings_etd ON bookings (etd);
CREATE INDEX idx_bookings_status ON bookings (booking_status);

CREATE TABLE invoices (
	invoice_number VARCHAR(50) PRIMARY KEY, -- "INV-03075-001"
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	booking_id VARCHAR(20) REFERENCES bookings (booking_id),
	issuer_id VARCHAR(20) REFERENCES customers (customer_id),
	buyer_id VARCHAR(20) REFERENCES customers (customer_id),
	invoice_date DATE NOT NULL,
	total_amount_usd NUMERIC(14, 2) NOT NULL,
	payment_terms VARCHAR(100),
	bank_account_number VARCHAR(255), -- app-level encrypted; Russia: account only, no bank name
	swift_code VARCHAR(20),
	beneficiary VARCHAR(255),
	special_instructions TEXT,
	invoice_status VARCHAR(50) DEFAULT 'Draft', -- Draft, Issued, Paid, Disputed
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_ftr ON invoices (ftr_code);
CREATE INDEX idx_invoices_status ON invoices (invoice_status);
CREATE INDEX idx_invoices_date ON invoices (invoice_date DESC);

CREATE TABLE payments (
	payment_id VARCHAR(20) PRIMARY KEY, -- "PAY-000001-26"
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	invoice_number VARCHAR(50) REFERENCES invoices (invoice_number),
	amount_usd NUMERIC(14, 2) NOT NULL,
	payment_type VARCHAR(50), -- Advance, Main, Partial
	payment_method VARCHAR(50) NOT NULL, -- SWIFT, LC, CAD, Check
	swift_reference VARCHAR(100) UNIQUE,
	swift_sent_date TIMESTAMP,
	swift_received_date TIMESTAMP,
	bank_credit_confirmed BOOLEAN DEFAULT false, -- GATE: no doc release until true
	bank_credit_confirmed_date TIMESTAMP,
	bank_credit_confirmation_method VARCHAR(100), -- Bank Statement, Email from Bank, Portal Check
	original_documents_released BOOLEAN DEFAULT false,
	original_docs_release_date TIMESTAMP,
	courier_company VARCHAR(100),
	courier_tracking_number VARCHAR(100),
	payment_status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Transit, Received, Cleared, Disputed
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_ftr ON payments (ftr_code);
CREATE INDEX idx_payments_swift ON payments (swift_reference);
CREATE INDEX idx_payments_status ON payments (payment_status);
CREATE INDEX idx_payments_created ON payments (created_at DESC);

CREATE TABLE bl_documents (
	bl_number VARCHAR(50) PRIMARY KEY, -- "MAE12345678"
	bl_type VARCHAR(20) NOT NULL, -- Master, House
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	booking_id VARCHAR(20) REFERENCES bookings (booking_id),
	container_numbers TEXT[] NOT NULL,
	shipper_id VARCHAR(20) REFERENCES customers (customer_id),
	consignee_id VARCHAR(20) REFERENCES customers (customer_id),
	notify_party_id VARCHAR(20) REFERENCES customers (customer_id),
	vessel_name VARCHAR(100),
	voyage_number VARCHAR(20),
	port_of_loading VARCHAR(50),
	port_of_discharge VARCHAR(50),
	freight_prepaid BOOLEAN,
	freight_collect BOOLEAN,
	marks_and_numbers TEXT,
	description_goods TEXT,
	weight_kg NUMERIC(12, 2),
	volume_cbm NUMERIC(12, 2),
	bl_date DATE NOT NULL,
	onboard_date DATE,
	bl_status VARCHAR(50) DEFAULT 'Draft', -- Draft, Issued, Telex Released, Original Delivered
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bl_ftr ON bl_documents (ftr_code);
CREATE INDEX idx_bl_booking ON bl_documents (booking_id);
CREATE INDEX idx_bl_status ON bl_documents (bl_status);

CREATE TABLE compliance_events (
	compliance_id VARCHAR(20) PRIMARY KEY, -- "CMP-030075-26"
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	market VARCHAR(50) NOT NULL,
	document_type VARCHAR(100), -- ACID, Import Permit, Phyto, Fumigation, Aflatoxin, Quality, CO
	status VARCHAR(50) NOT NULL, -- Pending, Obtained, Expired, Failed
	expiry_date DATE,
	issued_by VARCHAR(255),
	reference_number VARCHAR(100),
	aflatoxin_limit_ppb NUMERIC(3, 1),
	lab_result_ppb NUMERIC(3, 1),
	lab_name VARCHAR(255),
	test_date DATE,
	aflatoxin_result_status VARCHAR(50), -- Pass, Fail, Pending
	buyer_approved BOOLEAN,
	approval_date DATE,
	approved_by VARCHAR(100),
	alert_sent BOOLEAN DEFAULT false,
	alert_sent_date TIMESTAMP,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- days_until_expiry is computed on read (expiry_date - CURRENT_DATE) rather than
-- stored: Postgres generated columns require an IMMUTABLE expression and CURRENT_DATE
-- is not immutable.
CREATE VIEW compliance_events_with_expiry AS
SELECT *, (expiry_date - CURRENT_DATE) AS days_until_expiry
FROM compliance_events;

CREATE INDEX idx_compliance_ftr ON compliance_events (ftr_code);
CREATE INDEX idx_compliance_market ON compliance_events (market);
CREATE INDEX idx_compliance_status ON compliance_events (status);
CREATE INDEX idx_compliance_expiry ON compliance_events (expiry_date);

CREATE TABLE commissions (
	commission_id VARCHAR(20) PRIMARY KEY, -- "COM-000001-26"
	ftr_code VARCHAR(20) NOT NULL REFERENCES ftr (ftr_code),
	beneficiary_id VARCHAR(20) NOT NULL REFERENCES customers (customer_id),
	commission_base_usd NUMERIC(14, 2) NOT NULL,
	commission_type VARCHAR(50) NOT NULL, -- Percentage, Per MT, Flat Fee
	commission_rate NUMERIC(6, 4),
	commission_amount_usd NUMERIC(14, 2) NOT NULL,
	invoice_generated BOOLEAN DEFAULT false,
	invoice_number VARCHAR(50),
	invoice_date DATE,
	payment_status VARCHAR(50) DEFAULT 'Pending', -- Pending, Invoiced, Paid, Disputed
	payment_date DATE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_commissions_ftr ON commissions (ftr_code);
CREATE INDEX idx_commissions_beneficiary ON commissions (beneficiary_id);
CREATE INDEX idx_commissions_status ON commissions (payment_status);

-- RLS placeholder (ROADMAP semana 1): enabled with no policies yet, so all access
-- is denied until the auth model is defined and policies are added per table.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ftr ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
