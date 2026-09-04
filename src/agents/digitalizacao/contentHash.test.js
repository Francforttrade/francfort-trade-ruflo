const { computeContentHash } = require('./contentHash');

describe('digitalizacao contentHash', () => {
	test('returns a stable sha256 hex digest for the same bytes', () => {
		const fileBase64 = Buffer.from('hello world').toString('base64');
		const hash = computeContentHash(fileBase64);

		expect(hash).toBe(computeContentHash(fileBase64));
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test('different bytes produce different hashes', () => {
		const hashA = computeContentHash(Buffer.from('a').toString('base64'));
		const hashB = computeContentHash(Buffer.from('b').toString('base64'));

		expect(hashA).not.toBe(hashB);
	});

	test('returns null when there is no file', () => {
		expect(computeContentHash(null)).toBeNull();
		expect(computeContentHash(undefined)).toBeNull();
		expect(computeContentHash('')).toBeNull();
	});
});
