const { process } = require('./index');

describe('compliance agent', () => {
	test('Egypt FTR with a passing lab result and ACID present', async () => {
		const result = await process({
			ftrCode: '03080-26',
			market: 'Egypt',
			labResultPpb: 1.2,
			presentDocuments: { ACID: true },
		});

		expect(result.aflatoxin_check).toEqual({ limit_ppb: 2, result_ppb: 1.2, within_limit: true });
		expect(result.checklist.complete).toBe(true);
	});

	test('Algeria FTR with a missing import permit flags the checklist as incomplete', async () => {
		const result = await process({
			ftrCode: '03075-26',
			market: 'Algeria',
			presentDocuments: {},
		});

		expect(result.checklist.complete).toBe(false);
		expect(result.checklist.items[0]).toEqual({ document: 'Import Permit', present: false });
	});

	test('Russia FTR with a failing lab result flags aflatoxin out of limit', async () => {
		const result = await process({
			ftrCode: '03081-26',
			market: 'Russia',
			labResultPpb: 8,
			presentDocuments: { Phyto: true, Certificate: true },
		});

		expect(result.aflatoxin_check.within_limit).toBe(false);
	});

	test('flags documents that need a renewal alert within 7 days', async () => {
		const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
		const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

		const result = await process({
			ftrCode: '03075-26',
			market: 'Algeria',
			presentDocuments: { 'Import Permit': true },
			expiryDates: { 'Import Permit': soon, Phyto: later },
		});

		const importPermitAlert = result.alerts.find((a) => a.document === 'Import Permit');
		const phytoAlert = result.alerts.find((a) => a.document === 'Phyto');
		expect(importPermitAlert.needs_alert).toBe(true);
		expect(phytoAlert.needs_alert).toBe(false);
	});

	test('rejects an unmapped market', async () => {
		await expect(process({ ftrCode: '03075-26', market: 'Narnia' })).rejects.toThrow(/desconhecido/);
	});
});
