const { extractPhytosanitaryFields } = require('./phytosanitaryExtractor');

describe('digitalizacao phytosanitaryExtractor', () => {
	test('extracts fields and reports a freshly issued certificate as valid', () => {
		const issuedToday = new Date().toISOString().slice(0, 10);
		const text = ['Product: Peanuts 38/42', 'Quantity: 600 MT', `Issue Date: ${issuedToday}`, 'Lab: Eurofins'].join(
			'\n'
		);

		const result = extractPhytosanitaryFields({ text });

		expect(result.product_description).toBe('Peanuts 38/42');
		expect(result.quantity_mt).toBe(600);
		expect(result.issue_date).toBe(issuedToday);
		expect(result.lab_name).toBe('Eurofins');
		expect(result.is_valid).toBe(true);
		expect(result.days_until_expiry).toBeGreaterThan(0);
	});

	test('reports a long-expired certificate as invalid', () => {
		const result = extractPhytosanitaryFields({ text: 'Issue Date: 2020-01-01' });

		expect(result.is_valid).toBe(false);
		expect(result.days_until_expiry).toBeLessThan(0);
	});

	test('all fields are null when there is no text', () => {
		expect(extractPhytosanitaryFields({ text: null })).toEqual({
			product_description: null,
			quantity_mt: null,
			issue_date: null,
			lab_name: null,
			is_valid: null,
			days_until_expiry: null,
		});
	});
});
