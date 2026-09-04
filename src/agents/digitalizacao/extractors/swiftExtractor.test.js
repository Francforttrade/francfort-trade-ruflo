const { extractSwiftFields } = require('./swiftExtractor');

describe('digitalizacao swiftExtractor', () => {
	test('extracts and masks a SWIFT confirmation', () => {
		const text = [
			'SWIFT MT103 CONFIRMATION',
			'Reference: ITAU123ABC456XYZ',
			'Ordering Bank: Itau Unibanco',
			'Value Date: 2026-09-10',
			'Amount: USD 250000.00',
			'Account Number: 00123456789',
		].join('\n');

		const result = extractSwiftFields({ text });

		expect(result.swift_ref).toBe('ITAU123ABC456XYZ');
		expect(result.ordering_bank).toBe('Itau Unibanco');
		expect(result.value_date).toBe('2026-09-10');
		expect(result.amount).toBe(250000);
		expect(result.currency).toBe('USD');
		expect(result.beneficiary_account_masked).toBe('****6789');
	});

	test('leaves a 4-digit-or-shorter account as-is (nothing left to mask)', () => {
		const result = extractSwiftFields({ text: 'Account: 12' });

		expect(result.beneficiary_account_masked).toBe('12');
	});

	test('all fields are null when there is no text', () => {
		expect(extractSwiftFields({ text: null })).toEqual({
			swift_ref: null,
			amount: null,
			currency: null,
			value_date: null,
			ordering_bank: null,
			beneficiary_account_masked: null,
		});
	});
});
