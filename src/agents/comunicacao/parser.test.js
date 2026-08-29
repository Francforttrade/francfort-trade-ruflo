const {
	parseMessage,
	extractFtrCode,
	extractQuantityMt,
	extractGrade,
	extractProductType,
	classifyIntent,
} = require('./parser');

describe('comunicacao parser', () => {
	test('parses "Oferta de 600 MT peanuts 38/42" per the ROADMAP example', () => {
		const result = parseMessage('Oferta de 600 MT peanuts 38/42');
		expect(result.quantity.mt).toBe(600);
		expect(result.product.grade).toBe('38/42');
		expect(result.product.type).toBe('Peanuts');
		expect(result.intent).toBe('quote_offer');
	});

	test('extracts FTR code with amendment suffix', () => {
		expect(extractFtrCode('Referente à FTR 03075-26-1, favor confirmar')).toBe('03075-26-1');
		expect(extractFtrCode('sem código aqui')).toBeNull();
	});

	test('extracts quantity in MT with comma decimals', () => {
		expect(extractQuantityMt('600 MT')).toBe(600);
		expect(extractQuantityMt('27,5 MT')).toBe(27.5);
		expect(extractQuantityMt('sem quantidade')).toBeNull();
	});

	test('extracts grade', () => {
		expect(extractGrade('grade 38/42 confirmado')).toBe('38/42');
		expect(extractGrade('sem grade')).toBeNull();
	});

	test('extracts product type in english and portuguese', () => {
		expect(extractProductType('peanuts 38/42')).toBe('Peanuts');
		expect(extractProductType('amendoim tipo exportação')).toBe('Peanuts');
		expect(extractProductType('grãos diversos')).toBe('Grains');
		expect(extractProductType('sugar refinado')).toBe('Sugar');
		expect(extractProductType('nada reconhecível')).toBeNull();
	});

	test('classifies intent with booking/invoice/BL taking priority over a bare FTR mention', () => {
		expect(classifyIntent('Booking confirmado para FTR 03075-26')).toBe('booking');
		expect(classifyIntent('Invoice emitida para FTR 03075-26')).toBe('invoice');
		expect(classifyIntent('BL emitido para FTR 03075-26')).toBe('bl_document');
		expect(classifyIntent('FTR 03075-26 aguardando análise')).toBe('ftr_reference');
		expect(classifyIntent('mensagem sem nenhum padrão conhecido')).toBe('unknown');
	});

	test('extracts labeled seller/buyer', () => {
		const result = parseMessage('Seller: Teknofert\nBuyer: SARL Tassali');
		expect(result.seller).toBe('Teknofert');
		expect(result.buyer).toBe('SARL Tassali');
	});
});
