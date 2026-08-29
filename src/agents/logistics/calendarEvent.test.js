const { buildEtaCalendarEvent } = require('./calendarEvent');

describe('logistics calendarEvent', () => {
	test('builds the ETA event title and a 3-day-before reminder (ROADMAP example)', () => {
		const event = buildEtaCalendarEvent({
			bookingId: 'BK-000001-26',
			destinationPort: 'Algiers',
			etaIso: '2026-09-20T00:00:00Z',
		});

		expect(event.title).toBe('BK-000001-26 ETA Algiers');
		expect(event.date).toBe('2026-09-20T00:00:00Z');
		expect(event.reminder_date).toBe('2026-09-17T00:00:00.000Z');
	});
});
