const { buildComplianceChecklist } = require('./checklist');

describe('compliance checklist', () => {
	test('Algeria import permit missing → checklist incomplete (ROADMAP compliance test)', () => {
		const result = buildComplianceChecklist('Algeria', {});
		expect(result.complete).toBe(false);
		expect(result.items).toEqual([{ document: 'Import Permit', present: false }]);
	});

	test('Algeria with the import permit present is complete', () => {
		const result = buildComplianceChecklist('Algeria', { 'Import Permit': true });
		expect(result.complete).toBe(true);
	});

	test('rejects an unmapped market', () => {
		expect(() => buildComplianceChecklist('Narnia', {})).toThrow(/desconhecido/);
	});
});
