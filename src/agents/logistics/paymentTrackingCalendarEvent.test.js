const { buildEventTitle, buildPaymentTrackingCalendarEvent } = require('./paymentTrackingCalendarEvent');

describe('buildEventTitle', () => {
	test('matches the spec format', () => {
		expect(buildEventTitle({ ftrCode: 'FTR-03073-26', buyer: 'AGROTRADE RUS LLC', blNumber: 'MEDU1234567' })).toBe(
			'CHEGADA/Cobrança | FTR-03073-26 | AGROTRADE RUS LLC | BL MEDU1234567'
		);
	});

	test('falls back when the BL is not yet known', () => {
		expect(buildEventTitle({ ftrCode: '03073-26', buyer: 'AGROTRADE RUS LLC', blNumber: null })).toBe(
			'CHEGADA/Cobrança | 03073-26 | AGROTRADE RUS LLC | BL N/D'
		);
	});
});

describe('buildPaymentTrackingCalendarEvent', () => {
	test('carries the tracking id in extendedProperties.private for later lookup', () => {
		const event = buildPaymentTrackingCalendarEvent({
			trackingId: 'TRK-000001-26',
			ftrCode: '03073-26',
			buyer: 'AGROTRADE RUS LLC',
			blNumber: 'MEDU1234567',
			etaCurrent: '2026-09-20',
			paymentStatus: 'PAGAMENTO_PARCIAL',
			balance: 250000,
		});

		expect(event.extendedProperties.private.trackingId).toBe('TRK-000001-26');
		expect(event.date).toBe('2026-09-20');
		expect(event.description).toContain('Status do pagamento: PAGAMENTO_PARCIAL');
		expect(event.description).toContain('Saldo pendente: 250000');
	});

	test('renders missing fields as a dash instead of "undefined"', () => {
		const event = buildPaymentTrackingCalendarEvent({ trackingId: 'TRK-000002-26', ftrCode: '03080-26', buyer: 'X' });
		expect(event.description).toContain('Invoice: -');
		expect(event.description).not.toContain('undefined');
	});
});
