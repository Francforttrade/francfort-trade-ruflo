const { normalizeTableRows } = require('./tableExtractor');

describe('digitalizacao tableExtractor', () => {
	test('passes through an array of row objects', () => {
		const rows = [{ container_number: 'MAEU1234567', quantity_mt: 25 }];

		expect(normalizeTableRows(rows)).toEqual(rows);
	});

	test('drops non-object entries (e.g. a raw array-of-arrays row)', () => {
		const rows = [{ a: 1 }, ['not', 'an', 'object'], null, { b: 2 }];

		expect(normalizeTableRows(rows)).toEqual([{ a: 1 }, { b: 2 }]);
	});

	test('returns null for empty, missing, or non-array input', () => {
		expect(normalizeTableRows(null)).toBeNull();
		expect(normalizeTableRows(undefined)).toBeNull();
		expect(normalizeTableRows([])).toBeNull();
		expect(normalizeTableRows('not an array')).toBeNull();
	});
});
