const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const TABLES = {
	FTR: 'ftr',
	CUSTOMERS: 'customers',
	BOOKINGS: 'bookings',
	INVOICES: 'invoices',
	PAYMENTS: 'payments',
	BL_DOCUMENTS: 'bl_documents',
	COMPLIANCE_EVENTS: 'compliance_events',
	COMMISSIONS: 'commissions',
	DOCUMENT_RELATIONSHIPS: 'document_relationships',
};

module.exports = { supabase, TABLES };
