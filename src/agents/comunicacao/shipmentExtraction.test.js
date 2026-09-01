const {
	extractOriginPort,
	extractDestinationPort,
	extractVessel,
	extractVoyage,
	extractEtd,
	extractEta,
	extractContainerQuantity,
} = require('./shipmentExtraction');

describe('port extraction', () => {
	test('extracts labeled POL/POD', () => {
		expect(extractOriginPort('POL: Santos, Brazil')).toBe('Santos');
		expect(extractDestinationPort('POD: Algiers')).toBe('Algiers');
	});

	test('extracts ports from "from X to Y" phrasing', () => {
		expect(extractOriginPort('Shipment from Santos to Algiers confirmed')).toBe('Santos');
		expect(extractDestinationPort('Shipment from Santos to Algiers confirmed')).toBe('Algiers');
	});

	test('returns null when no port is mentioned', () => {
		expect(extractOriginPort('sem porto mencionado')).toBeNull();
		expect(extractDestinationPort('sem porto mencionado')).toBeNull();
	});
});

describe('vessel/voyage extraction', () => {
	test('extracts vessel name and voyage number', () => {
		expect(extractVessel('Vessel: MSC ISABELLA, Voyage: 26PT045')).toBe('MSC ISABELLA');
		expect(extractVoyage('Vessel: MSC ISABELLA, Voyage: 26PT045')).toBe('26PT045');
	});

	test('extracts vessel written as M/V', () => {
		expect(extractVessel('M/V Seatrade Reefer departing Santos')).toBe('Seatrade Reefer');
	});
});

describe('ETD/ETA extraction', () => {
	test('parses numeric dd/mm/yyyy dates', () => {
		expect(extractEtd('ETD: 25/08/2026')).toBe('2026-08-25');
		expect(extractEta('ETA: 20/09/2026')).toBe('2026-09-20');
	});

	test('parses ISO dates', () => {
		expect(extractEtd('ETD: 2026-08-25')).toBe('2026-08-25');
	});

	test('parses dates with a month name', () => {
		expect(extractEta('ETA: 20 Sep 2026')).toBe('2026-09-20');
		expect(extractEta('ETA: 20 set 2026')).toBe('2026-09-20');
	});

	test('returns null when not present', () => {
		expect(extractEtd('sem data')).toBeNull();
		expect(extractEta('sem data')).toBeNull();
	});
});

describe('container quantity extraction', () => {
	test('extracts a bare container count', () => {
		expect(extractContainerQuantity('24 containers loaded')).toBe(24);
		expect(extractContainerQuantity('10 contêineres embarcados')).toBe(10);
	});

	test('returns null when not present', () => {
		expect(extractContainerQuantity('sem quantidade de contêineres')).toBeNull();
	});
});
