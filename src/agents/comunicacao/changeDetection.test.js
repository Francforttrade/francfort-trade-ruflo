const {
	detectBookingAmendment,
	detectEtaChange,
	detectSplitShipment,
	isChangeNotification,
} = require('./changeDetection');

describe('detectBookingAmendment', () => {
	test.each([
		'Please note this Booking Amendment for FTR 03075-26',
		'Revised booking attached',
		'Change of vessel confirmed',
		'Alteração de booking para o FTR 03075-26',
		'Nova reserva confirmada',
	])('detects "%s"', (text) => {
		expect(detectBookingAmendment(text)).toBe(true);
	});

	test('does not flag unrelated text', () => {
		expect(detectBookingAmendment('Invoice emitida sem alterações')).toBe(false);
	});
});

describe('detectEtaChange', () => {
	test.each(['Revised ETA attached', 'Shipment postponed due to weather', 'Alteração de ETA confirmada'])(
		'detects "%s"',
		(text) => {
			expect(detectEtaChange(text)).toBe(true);
		}
	);

	test('does not flag unrelated text', () => {
		expect(detectEtaChange('Tudo dentro do previsto')).toBe(false);
	});
});

describe('detectSplitShipment', () => {
	test.each(['Split shipment confirmed for this booking', 'Embarque dividido em dois lotes'])(
		'detects "%s"',
		(text) => {
			expect(detectSplitShipment(text)).toBe(true);
		}
	);

	test('does not flag unrelated text', () => {
		expect(detectSplitShipment('Embarque único confirmado')).toBe(false);
	});
});

describe('isChangeNotification', () => {
	test('true when any change keyword is present', () => {
		expect(isChangeNotification('Booking amendment issued')).toBe(true);
	});

	test('false when nothing matches', () => {
		expect(isChangeNotification('Confirmação de recebimento, sem alterações')).toBe(false);
	});
});
