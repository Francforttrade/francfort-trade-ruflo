// End-to-end integration test for the FASE 1-6 flow from docs/ROADMAP.md,
// driving every phase through the real master.route() + agents, using the
// FTR 03075-26 example from config/schemas.json. Firestore and Supabase are
// mocked at the service boundary — no real GCP/Supabase credentials exist in
// this environment — but the agents, parsing, business rules and
// orchestrator run unmocked.

const mockFirestoreSet = jest.fn().mockResolvedValue(undefined);
const mockFirestoreDoc = jest.fn(() => ({ set: mockFirestoreSet }));
const mockFirestoreCollection = jest.fn(() => ({ doc: mockFirestoreDoc }));

jest.mock('../../src/services/firestore', () => ({
	firestore: { collection: (...args) => mockFirestoreCollection(...args) },
	COLLECTIONS: {
		SESSIONS: 'sessions',
		FTR_PROCESSING: 'ftr_processing',
		BOOKING_DRAFT: 'booking_draft',
		AUDIT_LOG: 'audit_log',
		TEMP_DOCUMENTS: 'temp_documents',
		FALHAS_PROCESSAMENTO: 'falhas_processamento',
	},
}));

// A single thenable query-builder stub covers every Supabase call shape used
// across the agents (comercial's pricing lookup, monitor's KPI queries):
// consumers destructure whichever of {data, error, count} they need, and an
// empty/zero result is a value every one of them already handles.
function mockMakeSupabaseQueryBuilder() {
	const builder = {
		select: () => builder,
		eq: () => builder,
		gte: () => builder,
		then: (resolve) => resolve({ data: [], error: null, count: 0 }),
	};
	return builder;
}

jest.mock('../../src/services/supabase', () => ({
	supabase: { from: jest.fn(() => mockMakeSupabaseQueryBuilder()) },
	TABLES: { FTR: 'ftr', CUSTOMERS: 'customers', BOOKINGS: 'bookings' },
}));

const master = require('../../src/orchestrator/master');

const FTR_CODE = '03075-26';

const SELLER = { name: 'Teknofert', cnpj: '12.345.678/0001-90' };
const BUYER = { name: 'SARL Tassali', country: 'Algeria', credit_limit_usd: 750000 };
const PRODUCT = { type: 'Peanuts', grade: '38/42' };
const QUANTITY = { mt: 600 };

describe('RUFLO end-to-end: FTR 03075-26 (docs/ROADMAP.md FASE 1-6)', () => {
	test('walks the full lifecycle from intake to commission, matching every phase gate', async () => {
		// FASE 1: INTAKE & VALIDAÇÃO (COMUNICACAO + MASTER)
		const intake = await master.route({
			targetAgent: 'comunicacao',
			channel: 'whatsapp',
			from: '+5511999999999',
			body: `Oferta de 600 MT peanuts 38/42, FTR ${FTR_CODE}`,
			threadId: `thread-${FTR_CODE}`,
		});
		expect(intake.ftr_code).toBe(FTR_CODE);
		expect(intake.intent).toBe('quote_offer');

		// FASE 2: NEGOCIAÇÃO (COMERCIAL + CONTRATOS)
		const quote = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'comercial',
			seller: SELLER,
			buyer: BUYER,
			product: PRODUCT,
			quantity: QUANTITY,
			incoterm: 'CFR',
			unitPriceUsd: 1250,
			freightUsdPerMt: 0,
			paymentTerms: '15% adv + 85% CAD at sight',
		});
		expect(quote.total_value_usd).toBe(750000);
		expect(quote.credit_check.within_limit).toBe(true); // 750000 <= buyer credit_limit_usd

		const contract = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'contratos',
			buyer: BUYER,
			sellerSigned: true,
			buyerSigned: true,
			body: 'Seller: Teknofert\nBuyer: SARL Tassali\n600 MT peanuts 38/42\nUSD 1250/MT\nCFR',
		});
		expect(contract.signature_check).toEqual({ complete: true });
		expect(contract.new_ftr_code).toBeNull(); // no amendment in this run

		// FASE 3: COMPLIANCE & LOGISTICS
		const compliance = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'compliance',
			market: 'Algeria',
			labResultPpb: 3.5,
			presentDocuments: { 'Import Permit': true },
		});
		expect(compliance.checklist.complete).toBe(true);
		expect(compliance.aflatoxin_check.within_limit).toBe(true); // 3.5 <= Algeria's 5ppb

		const logistics = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'logistics',
			bookingId: 'BK-000001-26',
			destinationPort: 'Algiers',
			etaDate: '2026-09-20T00:00:00Z',
			bookingContainers: ['MAEU1234567', 'MAEU1234568'],
			blContainers: ['MAEU1234567', 'MAEU1234568'],
		});
		expect(logistics.container_check).toEqual({ matches: true });
		expect(logistics.calendar_event.title).toBe('BK-000001-26 ETA Algiers');

		// FASE 4: DOCUMENTAÇÃO & QUALIDADE
		const blDoc = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'documentacao',
			docType: 'BL',
			blNumber: 'MAE12345678',
			blType: 'Master',
			shipper: { name: 'Francfort Trade' },
			consignee: { name: 'SARL Tassali', address: 'Algiers, Algeria' },
			buyer: { address: 'Algiers, Algeria' },
			vessel: { name: 'Seatrade Reefer', voyage: '2026-345' },
			portOfLoading: 'Santos',
			portOfDischarge: 'Algiers',
			containerNumbers: ['MAEU1234567', 'MAEU1234568'],
			descriptionGoods: 'Peanuts 38/42 Grade, 25kg bags',
			weightKg: 600000,
		});
		expect(blDoc.consignee_address_matches_buyer).toBe(true);
		expect(Buffer.from(blDoc.pdf_base64, 'base64').slice(0, 5).toString()).toBe('%PDF-');

		const docChecklist = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'documentacao',
			presentDocuments: { BL: true, CO: true, Phyto: true, Fumigation: true, Invoice: true, Quality: true },
			etd: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
		});
		expect(docChecklist.checklist.complete).toBe(true);
		expect(docChecklist.within_sla).toBe(true);

		const quality = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'qualidade',
			market: 'Algeria',
			filename: `FTR_${FTR_CODE}_EUROFINS_2026-08-15.pdf`,
			reportText: 'Aflatoxin: 3.5 ppb\nMoisture: 8%\nPurity: 99%',
		});
		expect(quality.lab_accredited).toBe(true);
		expect(quality.needs_escalation).toBe(false);

		const buyerApproval = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'qualidade',
			action: 'buyer_approval',
			approved: true,
			approvedBy: 'ahmed@tassali.dz',
		});
		expect(buyerApproval.approval.approved).toBe(true);

		// FASE 5: PAGAMENTO & LIBERAÇÃO DOCS (FINANCEIRO) — GATE CRÍTICO
		const payment = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'financeiro',
			swiftReference: 'ITAU123ABC456XYZ',
			invoiceStatus: 'Issued',
			paymentStatus: 'Received',
			userEmail: 'rodrigo@francfort.co',
		});
		expect(payment.release_flag).toBe(true);
		expect(payment.audit_id).toMatch(/^AUD-/);
		expect(mockFirestoreCollection).toHaveBeenCalledWith('audit_log');

		// FASE 6: COMISSÃO & RASTREAMENTO (COMISSOES + MONITOR)
		const commission = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'comissoes',
			commissionType: 'Per MT',
			commissionRate: 25,
			quantityMt: QUANTITY.mt,
			sequence: 1,
		});
		expect(commission.commission_amount_usd).toBe(15000);
		expect(commission.commission_id).toMatch(/^COM-000001-\d{2}$/);

		const monitor = await master.route({
			targetAgent: 'monitor',
			paymentsOnTime: 95,
			paymentsTotal: 100,
			docsOnTime: 98,
			docsTotal: 100,
		});
		expect(monitor.dashboard.alerts.payment_sla_at_risk).toBe(false);
	});

	test('EXCECOES: a FINANCEIRO failure that exhausts retries writes to the DLQ and escalates', async () => {
		const failure = await master.route({
			ftrCode: FTR_CODE,
			targetAgent: 'excecoes',
			action: 'record_failure',
			agent: 'financeiro',
			errorMsg: 'SWIFT timeout',
			retryCount: 3,
		});

		expect(failure.retry).toBe(false);
		expect(failure.escalation_message).toBe(`Ação necessária: FTR ${FTR_CODE} agente FINANCEIRO falhou (motivo: SWIFT timeout)`);
		expect(mockFirestoreCollection).toHaveBeenCalledWith('falhas_processamento');
	});
});
