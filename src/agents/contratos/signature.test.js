const { isSignatureComplete } = require('./signature');

describe('contratos signature', () => {
	test('is complete only when both parties signed', () => {
		expect(isSignatureComplete({ sellerSigned: true, buyerSigned: true })).toBe(true);
		expect(isSignatureComplete({ sellerSigned: true, buyerSigned: false })).toBe(false);
		expect(isSignatureComplete({})).toBe(false);
		expect(isSignatureComplete()).toBe(false);
	});
});
