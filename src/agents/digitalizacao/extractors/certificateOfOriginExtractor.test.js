const { extractCertificateOfOriginFields } = require('./certificateOfOriginExtractor');

describe('digitalizacao certificateOfOriginExtractor', () => {
	test('extracts exporter, consignee, product, quantity and origin', () => {
		const text = [
			'CERTIFICATE OF ORIGIN',
			'Exporter: Francfort Trade',
			'Consignee: Tassali Trading SPA',
			'Product: Peanuts 38/42',
			'Quantity: 600 MT',
			'Country of Origin: Brazil',
		].join('\n');

		const result = extractCertificateOfOriginFields({ text });

		expect(result).toEqual({
			exporter_name: 'Francfort Trade',
			consignee_name: 'Tassali Trading SPA',
			product_description: 'Peanuts 38/42',
			quantity_mt: 600,
			country_of_origin: 'Brazil',
		});
	});

	test('all fields are null when there is no text', () => {
		expect(extractCertificateOfOriginFields({ text: null })).toEqual({
			exporter_name: null,
			consignee_name: null,
			product_description: null,
			quantity_mt: null,
			country_of_origin: null,
		});
	});
});
