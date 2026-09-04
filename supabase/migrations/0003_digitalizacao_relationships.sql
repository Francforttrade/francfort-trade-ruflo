-- DIGITALIZACAO Entity Resolution (docs/RDIA_PRD.md §11/§12) — lets a
-- booking/BL/invoice/payment extracted from one document be linked back to
-- the FTR it belongs to, even when that FTR's own row doesn't reference the
-- document directly. Read-only lookups against `ftr`/`bookings`/`invoices`/
-- `bl_documents`/`payments` decide the relationship; this table is just the
-- resulting edge, kept even when the source document is reprocessed later.
-- Apply with: supabase db push

CREATE TABLE document_relationships (
	relationship_id VARCHAR(36) PRIMARY KEY, -- UUID
	source_type VARCHAR(50) NOT NULL, -- bl, invoice, payment, ...
	source_id VARCHAR(100) NOT NULL, -- bl_number, invoice_number, swift_reference, ...
	relationship VARCHAR(50) NOT NULL, -- BELONGS_TO, ...
	target_type VARCHAR(50) NOT NULL, -- ftr
	target_id VARCHAR(100) NOT NULL, -- ftr_code
	confidence NUMERIC(4, 3) NOT NULL,
	evidence TEXT[], -- e.g. ["content_hash:<sha256>"]
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_relationships_source ON document_relationships (source_type, source_id);
CREATE INDEX idx_document_relationships_target ON document_relationships (target_type, target_id);

-- An ambiguous match (same source_id already tied to a *different* FTR) is
-- never written here — see src/agents/digitalizacao/entityResolution.js —
-- so every row in this table is either confirmed against an existing record
-- or a new candidate link, never a contradiction.
ALTER TABLE document_relationships ENABLE ROW LEVEL SECURITY;
