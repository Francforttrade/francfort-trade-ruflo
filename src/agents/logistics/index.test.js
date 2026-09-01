const { process } = require('./index');

describe('logistics agent', () => {
	test('queries container tracking when a container number is given', async () => {
		const result = await process({ ftrCode: '03075-26', containerNumber: 'MAEU1234567' });
		expect(result.tracking.container_number).toBe('MAEU1234567');
	});

	test('flags a container count mismatch between booking and BL', async () => {
		const result = await process({
			ftrCode: '03075-26',
			bookingContainers: ['MAEU1234567', 'MAEU1234568'],
			blContainers: ['MAEU1234567'],
		});

		expect(result.container_check).toEqual({ matches: false });
	});

	test('builds the ETA calendar event when booking, port and ETA are given', async () => {
		const result = await process({
			ftrCode: '03075-26',
			bookingId: 'BK-000001-26',
			destinationPort: 'Algiers',
			etaDate: '2026-09-20T00:00:00Z',
		});

		expect(result.calendar_event.title).toBe('BK-000001-26 ETA Algiers');
	});

	test('flags demurrage risk when the reference date is well past ETA + free time', async () => {
		const farFutureEta = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
		const result = await process({ ftrCode: '03075-26', etaDate: farFutureEta });

		expect(result.demurrage.at_risk).toBe(true);
	});

	test('returns null sections when no relevant data is provided', async () => {
		const result = await process({ ftrCode: '03075-26' });
		expect(result.tracking).toBeNull();
		expect(result.container_check).toBeNull();
		expect(result.calendar_event).toBeNull();
		expect(result.payment_tracking_calendar).toBeNull();
		expect(result.demurrage).toBeNull();
	});

	test('attempts the payment-tracking Calendar event when tracking identity fields are given', async () => {
		// NB: `process` in this scope is the imported agent function (see the
		// destructured require above), not Node's global — use globalThis to
		// reach the real env.
		const nodeProcess = globalThis.process;
		const originalKey = nodeProcess.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY;
		const originalEmail = nodeProcess.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;
		delete nodeProcess.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY;
		delete nodeProcess.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

		const result = await process({
			ftrCode: '03075-26',
			trackingId: 'TRK-000001-26',
			buyer: 'AGROTRADE RUS LLC',
			etaDate: '2026-09-20',
		});

		expect(result.payment_tracking_calendar).toEqual(
			expect.objectContaining({ created: false, error: 'calendar_not_configured' })
		);

		if (originalKey) nodeProcess.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY = originalKey;
		if (originalEmail) nodeProcess.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL = originalEmail;
	});
});
