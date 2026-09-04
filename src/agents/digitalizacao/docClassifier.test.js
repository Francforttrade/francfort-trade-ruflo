const { classifyDocument } = require('./docClassifier');

describe('digitalizacao docClassifier', () => {
	test('trusts docTypeHint when provided, without reading the text', () => {
		const result = classifyDocument({ filename: 'random.pdf', text: 'unrelated content', docTypeHint: 'SWIFT' });

		expect(result).toEqual({ docType: 'SWIFT', confidence: 0.9, source: 'hint' });
	});

	test('ignores an unrecognized docTypeHint and falls back to the heuristic', () => {
		const result = classifyDocument({ filename: '', text: 'Invoice Number: INV-01', docTypeHint: 'NotARealType' });

		expect(result.docType).toBe('Invoice');
	});

	test('classifies a lab report from keywords in the text', () => {
		const result = classifyDocument({
			filename: 'FTR_03075-26_EUROFINS_2026-08-15.pdf',
			text: 'Aflatoxin: 3.5 ppb\nMoisture: 8%\nPurity: 99%',
		});

		expect(result.docType).toBe('LabReport');
		expect(result.confidence).toBeGreaterThan(0.5);
	});

	test('classifies a bill of lading from keywords', () => {
		const result = classifyDocument({
			filename: 'bl_maeu.pdf',
			text: 'BILL OF LADING\nConsignee: Tassali Trading\nVessel: MSC Amsterdam\nPort of Loading: Santos',
		});

		expect(result.docType).toBe('BL');
	});

	test('returns null with zero confidence when nothing matches', () => {
		const result = classifyDocument({ filename: 'random.pdf', text: 'lorem ipsum dolor sit amet' });

		expect(result).toEqual({ docType: null, confidence: 0, source: 'heuristic' });
	});

	test('higher keyword overlap yields higher confidence, capped below 1', () => {
		const weak = classifyDocument({ filename: '', text: 'invoice' });
		const strong = classifyDocument({ filename: '', text: 'commercial invoice fatura invoice number' });

		expect(strong.confidence).toBeGreaterThan(weak.confidence);
		expect(strong.confidence).toBeLessThan(1);
	});
});
