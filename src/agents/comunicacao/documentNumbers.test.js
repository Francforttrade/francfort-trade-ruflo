const { extractInvoiceNumber, extractBookingNumber, extractBlNumber } = require('./documentNumbers');

describe('extractInvoiceNumber', () => {
	test('extracts a labeled invoice number', () => {
		expect(extractInvoiceNumber('Invoice No: INV-03075-001 anexa')).toBe('INV-03075-001');
		expect(extractInvoiceNumber('Fatura: INV-03075-002')).toBe('INV-03075-002');
	});

	test('returns null without a label', () => {
		expect(extractInvoiceNumber('sem referência de fatura aqui')).toBeNull();
	});
});

describe('extractBookingNumber', () => {
	test('extracts a labeled booking number', () => {
		expect(extractBookingNumber('Booking Number: BK-000001-26.')).toBe('BK-000001-26');
		expect(extractBookingNumber('Booking Ref: MAEU998877')).toBe('MAEU998877');
	});

	test('returns null without a label', () => {
		expect(extractBookingNumber('nenhuma reserva mencionada')).toBeNull();
	});
});

describe('extractBlNumber', () => {
	test('extracts a labeled BL number in multiple spellings', () => {
		expect(extractBlNumber('BL: MEDU1234567')).toBe('MEDU1234567');
		expect(extractBlNumber('B/L No. MEDU1234567,')).toBe('MEDU1234567');
		expect(extractBlNumber('Bill of Lading Number: MEDU1234567')).toBe('MEDU1234567');
	});

	test('returns null without a label', () => {
		expect(extractBlNumber('nenhum BL mencionado')).toBeNull();
	});
});
