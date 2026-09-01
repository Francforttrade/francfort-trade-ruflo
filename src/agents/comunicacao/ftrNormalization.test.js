const { normalizeFtr, extractAllFtrCandidates, isFtrAmbiguous } = require('./ftrNormalization');

describe('normalizeFtr', () => {
	const variations = [
		'FTR-03073-26',
		'FTR 03073-26',
		'FTR03073-26',
		'03073-26',
		'3073-26',
		'FTR-3073-26',
		'FTR 3073/26',
		'3073/26',
	];

	test.each(variations)('normalizes "%s" to 03073-26', (variant) => {
		expect(normalizeFtr(`Referente ao contrato ${variant}, favor confirmar.`)).toBe('03073-26');
	});

	test('preserves an amendment suffix', () => {
		expect(normalizeFtr('FTR 03075-26-1 revisado')).toBe('03075-26-1');
	});

	test('returns null when no FTR-shaped code is present', () => {
		expect(normalizeFtr('mensagem sem nenhum código')).toBeNull();
	});

	test('returns null (not a guess) when two distinct FTR codes are mentioned', () => {
		expect(normalizeFtr('FTR 03073-26 e FTR 03080-26 no mesmo lote')).toBeNull();
	});

	test('is not confused by a repeated mention of the same code', () => {
		expect(normalizeFtr('FTR 03073-26 ... assunto: FTR-03073-26')).toBe('03073-26');
	});
});

describe('extractAllFtrCandidates', () => {
	test('returns distinct normalized codes in first-seen order', () => {
		expect(extractAllFtrCandidates('FTR 3073/26 depois FTR-03080-26 e de novo 3073-26')).toEqual([
			'03073-26',
			'03080-26',
		]);
	});

	test('returns an empty array for text with nothing to match', () => {
		expect(extractAllFtrCandidates('')).toEqual([]);
		expect(extractAllFtrCandidates(null)).toEqual([]);
	});
});

describe('isFtrAmbiguous', () => {
	test('flags text mentioning more than one FTR code', () => {
		expect(isFtrAmbiguous('FTR 03073-26 e FTR 03080-26')).toBe(true);
	});

	test('does not flag a single code repeated', () => {
		expect(isFtrAmbiguous('FTR 03073-26 ... FTR-03073-26')).toBe(false);
	});
});
