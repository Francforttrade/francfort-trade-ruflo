const { buildDocumentChecklist, isWithinDocumentationSla } = require('./checklist');

describe('documentacao checklist', () => {
	test('is complete only when all six documents are present', () => {
		const complete = buildDocumentChecklist({ BL: true, CO: true, Phyto: true, Fumigation: true, Invoice: true, Quality: true });
		expect(complete.complete).toBe(true);

		const incomplete = buildDocumentChecklist({ BL: true, CO: true });
		expect(incomplete.complete).toBe(false);
		expect(incomplete.items.find((i) => i.document === 'Phyto').present).toBe(false);
	});

	test('flags SLA breach when less than 48h remain before ETD', () => {
		const now = new Date('2026-08-20T00:00:00Z');
		expect(isWithinDocumentationSla('2026-08-23T00:00:00Z', now)).toBe(true); // 72h ahead
		expect(isWithinDocumentationSla('2026-08-21T00:00:00Z', now)).toBe(false); // 24h ahead
	});
});
