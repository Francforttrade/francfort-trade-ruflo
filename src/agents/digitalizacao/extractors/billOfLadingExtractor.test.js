const { extractBillOfLadingFields } = require('./billOfLadingExtractor');

describe('digitalizacao billOfLadingExtractor', () => {
	test('extracts BL number, containers, vessel, ports and consignee name', () => {
		const text = [
			'BILL OF LADING',
			'B/L Number: BL-2026-9981',
			'Consignee: Tassali Trading SPA',
			'Vessel: MSC Amsterdam',
			'Port of Loading: Santos',
			'Port of Discharge: Algiers',
			'Containers: MAEU1234567, MAEU1234568, MAEU1234567',
		].join('\n');

		const result = extractBillOfLadingFields({ text });

		expect(result.bl_number).toBe('BL-2026-9981');
		expect(result.container_numbers).toEqual(['MAEU1234567', 'MAEU1234568']);
		expect(result.consignee_name).toBe('Tassali Trading SPA');
		expect(result.vessel).toBe('MSC Amsterdam');
		expect(result.port_of_loading).toBe('Santos');
		expect(result.port_of_discharge).toBe('Algiers');
		expect(result.consignee_address).toBeNull();
	});

	test('all fields are null/empty when there is no text', () => {
		const result = extractBillOfLadingFields({ text: null });

		expect(result).toEqual({
			bl_number: null,
			container_numbers: [],
			consignee_name: null,
			consignee_address: null,
			vessel: null,
			port_of_loading: null,
			port_of_discharge: null,
		});
	});
});
