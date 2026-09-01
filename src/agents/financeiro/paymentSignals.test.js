const { detectSwiftMention, detectPartialPayment, detectPaymentConfirmedLanguage } = require('./paymentSignals');

describe('detectSwiftMention', () => {
	test('detects a SWIFT reference or copy mention', () => {
		expect(detectSwiftMention('Segue SWIFT em anexo')).toBe(true);
		expect(detectSwiftMention('Comprovante de pagamento anexo')).toBe(true);
	});

	test('does not flag unrelated text', () => {
		expect(detectSwiftMention('Confirmação de recebimento do BL')).toBe(false);
	});
});

describe('detectPartialPayment', () => {
	test('detects partial payment language', () => {
		expect(detectPartialPayment('Enviamos partial payment de USD 100.000')).toBe(true);
		expect(detectPartialPayment('Segue pagamento parcial referente à invoice')).toBe(true);
		expect(detectPartialPayment('Saldo pendente a ser quitado em 15 dias')).toBe(true);
	});

	test('does not flag a full-payment message', () => {
		expect(detectPartialPayment('Pagamento integral efetuado hoje')).toBe(false);
	});
});

describe('detectPaymentConfirmedLanguage', () => {
	test('detects bank-credit confirmation language', () => {
		expect(detectPaymentConfirmedLanguage('Crédito confirmado em nossa conta')).toBe(true);
		expect(detectPaymentConfirmedLanguage('Bank credit confirmed today')).toBe(true);
	});

	test('does not flag a bare SWIFT mention as confirmation', () => {
		expect(detectPaymentConfirmedLanguage('Segue SWIFT em anexo para análise')).toBe(false);
	});
});
