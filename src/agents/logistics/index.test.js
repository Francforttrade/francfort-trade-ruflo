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
		expect(result.demurrage).toBeNull();
	});
});
