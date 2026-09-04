// services/supabase.js calls createClient() at require-time, and TABLES
// (used below via requireActual to avoid duplicating the table-name map) is
// exported from that same module — so these need to be set even though
// every actual query in these tests goes through the mock, not a real client.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key';

function makeQueryBuilder({ single, list } = {}) {
	const builder = {
		select: jest.fn(() => builder),
		eq: jest.fn(() => builder),
		maybeSingle: jest.fn().mockResolvedValue(single || { data: null, error: null }),
		then: (resolve) => resolve(list || { data: [], error: null }),
	};
	return builder;
}

function mockSupabaseWith(byTable) {
	jest.doMock('../../services/supabase', () => ({
		supabase: { from: jest.fn((table) => byTable[table] || makeQueryBuilder()) },
		TABLES: jest.requireActual('../../services/supabase').TABLES,
	}));
}

describe('digitalizacao crossValidation', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.dontMock('../../services/supabase');
	});

	describe('namesMatch', () => {
		test('matches case/whitespace-insensitively', () => {
			const { namesMatch } = require('./crossValidation');
			expect(namesMatch('  Tassali Trading SPA  ', 'tassali trading spa')).toBe(true);
			expect(namesMatch('Tassali Trading SPA', 'Agrotrade Rus')).toBe(false);
		});

		test('returns null when either side is missing', () => {
			const { namesMatch } = require('./crossValidation');
			expect(namesMatch(null, 'Acme')).toBeNull();
			expect(namesMatch('Acme', null)).toBeNull();
		});
	});

	describe('validateExtraction', () => {
		const { TABLES } = require('../../services/supabase');

		test('flags a missing FTR and skips every doc-type-specific check', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: null, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '99999-99',
				classifiedDocType: 'Invoice',
				extractedFields: { buyer_name: 'Acme' },
			});

			expect(result).toEqual([
				{ check: 'ftr_code_exists_in_supabase', result: 'mismatch', detail: { ftrCode: '99999-99' } },
			]);
		});

		test('a Supabase error checking the FTR is inconclusive, not a mismatch (never a FIELD_CONFLICT trigger)', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: null, error: { message: 'network timeout' } } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'Contract',
				extractedFields: {},
			});

			expect(result).toEqual([
				{
					check: 'ftr_code_exists_in_supabase',
					result: 'not_checked',
					detail: { ftrCode: '03075-26', error: 'network timeout' },
				},
			]);
		});

		test('LabReport: aflatoxin over the market limit and an unaccredited lab both mismatch', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03080-26', market: 'Egypt' }, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03080-26',
				classifiedDocType: 'LabReport',
				extractedFields: { aflatoxin_ppb: 3, lab_name: 'Unknown Lab' },
			});

			const aflatoxin = result.find((c) => c.check === 'aflatoxin_within_market_limit');
			const lab = result.find((c) => c.check === 'lab_accredited');
			expect(aflatoxin).toEqual({
				check: 'aflatoxin_within_market_limit',
				result: 'mismatch',
				detail: { aflatoxin_ppb: 3, limit_ppb: 2, market: 'Egypt' },
			});
			expect(lab.result).toBe('mismatch');
		});

		test('LabReport falls back to the FTR record market when context.market is not given', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03080-26', market: 'Egypt' }, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03080-26',
				classifiedDocType: 'LabReport',
				extractedFields: { aflatoxin_ppb: 1, lab_name: 'Eurofins' },
			});

			const aflatoxin = result.find((c) => c.check === 'aflatoxin_within_market_limit');
			expect(aflatoxin.result).toBe('match');
			expect(aflatoxin.detail.market).toBe('Egypt');
		});

		test('Invoice: buyer name mismatch against the customer on file', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({
					single: { data: { ftr_code: '03075-26', buyer_id: 'CUST-1' }, error: null },
				}),
				[TABLES.CUSTOMERS]: makeQueryBuilder({ single: { data: { name: 'Tassali Trading SPA' }, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'Invoice',
				extractedFields: { buyer_name: 'Some Other Company' },
			});

			const buyerCheck = result.find((c) => c.check === 'buyer_matches_customer_record');
			expect(buyerCheck.result).toBe('mismatch');
		});

		test('SWIFT: amount matches an existing payment row for the FTR', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03075-26' }, error: null } }),
				[TABLES.PAYMENTS]: makeQueryBuilder({ list: { data: [{ amount_usd: 250000 }], error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'SWIFT',
				extractedFields: { amount: 250000 },
			});

			const swiftCheck = result.find((c) => c.check === 'swift_amount_matches_payment_record');
			expect(swiftCheck.result).toBe('match');
		});

		test('ACID: expiry date mismatches the compliance_events record', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03080-26' }, error: null } }),
				[TABLES.COMPLIANCE_EVENTS]: makeQueryBuilder({
					single: { data: { expiry_date: '2026-10-01' }, error: null },
				}),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03080-26',
				classifiedDocType: 'ACID',
				extractedFields: { expiry_date: '2026-11-15' },
			});

			const complianceCheck = result.find((c) => c.check === 'compliance_doc_matches_event_record');
			expect(complianceCheck.result).toBe('mismatch');
		});

		test('Phyto: an expired certificate mismatches even though is_valid was confidently extracted', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03075-26' }, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'Phyto',
				extractedFields: { is_valid: false, issue_date: '2020-01-01' },
			});

			const phytoCheck = result.find((c) => c.check === 'phyto_still_valid');
			expect(phytoCheck.result).toBe('mismatch');
		});

		test('Phyto: a currently valid certificate matches', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03075-26' }, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'Phyto',
				extractedFields: { is_valid: true },
			});

			const phytoCheck = result.find((c) => c.check === 'phyto_still_valid');
			expect(phytoCheck.result).toBe('match');
		});

		test('ImportPermit is queried against compliance_events as "Import Permit" (with a space), not the JS-style enum value', async () => {
			const complianceBuilder = makeQueryBuilder({ single: { data: { expiry_date: '2026-11-15' }, error: null } });
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03075-26' }, error: null } }),
				[TABLES.COMPLIANCE_EVENTS]: complianceBuilder,
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'ImportPermit',
				extractedFields: { expiry_date: '2026-11-15' },
			});

			expect(complianceBuilder.eq).toHaveBeenCalledWith('document_type', 'Import Permit');
			const complianceCheck = result.find((c) => c.check === 'compliance_doc_matches_event_record');
			expect(complianceCheck.result).toBe('match');
		});

		test('unrelated doc types only run the FTR existence check', async () => {
			mockSupabaseWith({
				[TABLES.FTR]: makeQueryBuilder({ single: { data: { ftr_code: '03075-26' }, error: null } }),
			});
			const { validateExtraction } = require('./crossValidation');

			const result = await validateExtraction({
				ftrCode: '03075-26',
				classifiedDocType: 'Contract',
				extractedFields: {},
			});

			expect(result).toHaveLength(1);
			expect(result[0].check).toBe('ftr_code_exists_in_supabase');
		});
	});
});
