const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('../../services/firestore', () => ({
	firestore: { collection: (...args) => mockCollection(...args) },
	COLLECTIONS: { SESSIONS: 'sessions' },
}));

const { process } = require('./index');

describe('qualidade agent', () => {
	beforeEach(() => {
		mockSet.mockClear();
		mockDoc.mockClear();
		mockCollection.mockClear();
	});

	test('Egypt FTR, lab result 3ppb vs limit 2ppb → FAIL and escalation (ROADMAP example)', async () => {
		const result = await process({ ftrCode: '03080-26', market: 'Egypt', labResultPpb: 3 });

		expect(result.aflatoxin_check).toEqual({ result_ppb: 3, limit_ppb: 2, within_limit: false });
		expect(result.needs_escalation).toBe(true);
	});

	test('parses filename and lab report text, checks lab accreditation and aflatoxin', async () => {
		const result = await process({
			ftrCode: '03075-26',
			market: 'Algeria',
			filename: 'FTR_03075-26_EUROFINS_2026-08-15.pdf',
			reportText: 'Aflatoxin: 3.5 ppb\nMoisture: 8%\nPurity: 99%',
		});

		expect(result.filename_info).toEqual({ ftrCode: '03075-26', labName: 'EUROFINS', date: '2026-08-15' });
		expect(result.lab_accredited).toBe(true);
		expect(result.aflatoxin_check.result_ppb).toBe(3.5);
		expect(result.moisture_pct).toBe(8);
		expect(result.purity_pct).toBe(99);
		expect(result.needs_escalation).toBe(false);
	});

	test('records a buyer approval decision in Firestore', async () => {
		const result = await process({
			action: 'buyer_approval',
			ftrCode: '03075-26',
			approved: true,
			approvedBy: 'ahmed@tassali.dz',
		});

		expect(result.approval.approved).toBe(true);
		expect(mockCollection).toHaveBeenCalledWith('sessions');
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({ ftr_code: '03075-26', type: 'quality_approval', approved: true })
		);
	});
});
