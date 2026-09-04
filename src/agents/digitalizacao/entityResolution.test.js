process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key';

const { classifyEntityMatch } = require('./entityResolution');

function makeQueryBuilder({ single, insertResult } = {}) {
	const builder = {
		select: jest.fn(() => builder),
		eq: jest.fn(() => builder),
		maybeSingle: jest.fn().mockResolvedValue(single || { data: null, error: null }),
		insert: jest.fn().mockResolvedValue(insertResult || { data: null, error: null }),
	};
	return builder;
}

function mockSupabaseWith(byTable) {
	jest.doMock('../../services/supabase', () => ({
		supabase: { from: jest.fn((table) => byTable[table] || makeQueryBuilder()) },
		TABLES: jest.requireActual('../../services/supabase').TABLES,
	}));
}

describe('digitalizacao entityResolution', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.dontMock('../../services/supabase');
	});

	describe('classifyEntityMatch (pure)', () => {
		test('no existing row is a new entity', () => {
			expect(classifyEntityMatch(null, '03075-26')).toBe('new');
		});

		test('an existing row under the same FTR is confirmed', () => {
			expect(classifyEntityMatch({ ftr_code: '03075-26' }, '03075-26')).toBe('confirmed');
		});

		test('an existing row under a different FTR is ambiguous', () => {
			expect(classifyEntityMatch({ ftr_code: '03080-26' }, '03075-26')).toBe('ambiguous');
		});
	});

	describe('resolveEntity', () => {
		const { TABLES } = require('../../services/supabase');

		test('returns null for a doc type with no entity id to resolve', async () => {
			const { resolveEntity } = require('./entityResolution');

			const result = await resolveEntity({ ftrCode: '03075-26', classifiedDocType: 'Contract', extractedFields: {} });

			expect(result).toBeNull();
		});

		test('returns null when the field itself is missing', async () => {
			const { resolveEntity } = require('./entityResolution');

			const result = await resolveEntity({ ftrCode: '03075-26', classifiedDocType: 'BL', extractedFields: {} });

			expect(result).toBeNull();
		});

		test('a brand new BL number resolves as "new" and is recorded', async () => {
			const blBuilder = makeQueryBuilder({ single: { data: null, error: null } });
			const relationshipsBuilder = makeQueryBuilder();
			mockSupabaseWith({ [TABLES.BL_DOCUMENTS]: blBuilder, [TABLES.DOCUMENT_RELATIONSHIPS]: relationshipsBuilder });
			const { resolveEntity } = require('./entityResolution');

			const result = await resolveEntity({
				ftrCode: '03075-26',
				classifiedDocType: 'BL',
				extractedFields: { bl_number: 'MAE12345678' },
			});

			expect(result.status).toBe('new');
			expect(result.source_entity).toEqual({ type: 'bl', id: 'MAE12345678' });
			expect(result.target_entity).toEqual({ type: 'ftr', id: '03075-26' });
			expect(result.persisted).toBe(true);
			expect(relationshipsBuilder.insert).toHaveBeenCalledWith(
				expect.objectContaining({ source_type: 'bl', source_id: 'MAE12345678', target_id: '03075-26' })
			);
		});

		test('a failed write to document_relationships is reported via persisted:false, not silently swallowed', async () => {
			const blBuilder = makeQueryBuilder({ single: { data: null, error: null } });
			const relationshipsBuilder = makeQueryBuilder({ insertResult: { data: null, error: { message: 'constraint violation' } } });
			mockSupabaseWith({ [TABLES.BL_DOCUMENTS]: blBuilder, [TABLES.DOCUMENT_RELATIONSHIPS]: relationshipsBuilder });
			const { resolveEntity } = require('./entityResolution');

			const result = await resolveEntity({
				ftrCode: '03075-26',
				classifiedDocType: 'BL',
				extractedFields: { bl_number: 'MAE12345678' },
			});

			expect(result.status).toBe('new');
			expect(result.persisted).toBe(false);
		});

		test('an invoice number already tied to this FTR resolves as "confirmed" and is recorded', async () => {
			const invoiceBuilder = makeQueryBuilder({ single: { data: { ftr_code: '03075-26' }, error: null } });
			const relationshipsBuilder = makeQueryBuilder();
			mockSupabaseWith({ [TABLES.INVOICES]: invoiceBuilder, [TABLES.DOCUMENT_RELATIONSHIPS]: relationshipsBuilder });
			const { resolveEntity } = require('./entityResolution');

			const result = await resolveEntity({
				ftrCode: '03075-26',
				classifiedDocType: 'Invoice',
				extractedFields: { invoice_number: 'INV-03075-001' },
			});

			expect(result.status).toBe('confirmed');
			expect(result.confidence).toBe(1);
			expect(relationshipsBuilder.insert).toHaveBeenCalled();
		});

		test('a SWIFT ref already tied to a different FTR resolves as "ambiguous" and is NOT recorded', async () => {
			const paymentsBuilder = makeQueryBuilder({ single: { data: { ftr_code: '03080-26' }, error: null } });
			const relationshipsBuilder = makeQueryBuilder();
			mockSupabaseWith({ [TABLES.PAYMENTS]: paymentsBuilder, [TABLES.DOCUMENT_RELATIONSHIPS]: relationshipsBuilder });
			const { resolveEntity } = require('./entityResolution');

			const result = await resolveEntity({
				ftrCode: '03075-26',
				classifiedDocType: 'SWIFT',
				extractedFields: { swift_ref: 'ITAU123ABC456XYZ' },
			});

			expect(result.status).toBe('ambiguous');
			expect(result.confidence).toBe(0);
			expect(result.persisted).toBe(false);
			expect(relationshipsBuilder.insert).not.toHaveBeenCalled();
		});
	});
});
