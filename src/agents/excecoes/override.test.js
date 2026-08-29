const { buildOverrideAuditEntry } = require('./override');

describe('excecoes override', () => {
	test('builds the note in the ROADMAP example format', () => {
		const entry = buildOverrideAuditEntry({
			ftrCode: '03075-26',
			approvedBy: 'Rodrigo',
			approvedAt: '2026-09-01T14:30:00Z',
		});
		expect(entry.note).toBe('Rodrigo override @ 2026-09-01T14:30:00.000Z');
		expect(entry.ftr_code).toBe('03075-26');
	});
});
