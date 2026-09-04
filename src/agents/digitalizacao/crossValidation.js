const { supabase, TABLES } = require('../../services/supabase');
const { getAflatoxinLimitPpb } = require('../compliance/marketRequirements');
const { isAflatoxinWithinLimit } = require('../compliance/aflatoxinCheck');
const { isAccreditedLab } = require('../qualidade/accreditedLabs');

// Same normalization documentacao/billOfLading.js's isConsigneeAddressMatching
// uses (trim + lowercase) — good enough for "did the extracted name basically
// match the customer record", not meant to catch minor spelling variants.
function namesMatch(a, b) {
	if (!a || !b) {
		return null;
	}
	return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function checkFtrExists(ftrCode) {
	const { data, error } = await supabase
		.from(TABLES.FTR)
		.select('ftr_code, market, buyer_id, seller_id')
		.eq('ftr_code', ftrCode)
		.maybeSingle();

	// A query error (network blip, transient DB issue) is inconclusive, not
	// proof the FTR doesn't exist — treating it as 'mismatch' would turn a
	// transient failure into a FIELD_CONFLICT escalation that skips
	// EXCECOES's retry/backoff entirely (see index.js's escalate()), for a
	// document that would likely succeed on the very next attempt.
	if (error) {
		return { check: 'ftr_code_exists_in_supabase', result: 'not_checked', detail: { ftrCode, error: error.message }, ftrRow: null };
	}
	if (!data) {
		return { check: 'ftr_code_exists_in_supabase', result: 'mismatch', detail: { ftrCode }, ftrRow: null };
	}
	return { check: 'ftr_code_exists_in_supabase', result: 'match', detail: { ftrCode }, ftrRow: data };
}

async function checkBuyerMatchesCustomer(buyerName, buyerId) {
	if (!buyerName || !buyerId) {
		return { check: 'buyer_matches_customer_record', result: 'not_checked', detail: null };
	}

	const { data, error } = await supabase.from(TABLES.CUSTOMERS).select('name').eq('customer_id', buyerId).maybeSingle();

	if (error || !data) {
		return { check: 'buyer_matches_customer_record', result: 'not_checked', detail: { buyerId } };
	}
	return {
		check: 'buyer_matches_customer_record',
		result: namesMatch(buyerName, data.name) ? 'match' : 'mismatch',
		detail: { extracted: buyerName, on_file: data.name },
	};
}

async function checkSwiftAgainstPayments(ftrCode, extractedAmount) {
	if (extractedAmount == null) {
		return { check: 'swift_amount_matches_payment_record', result: 'not_checked', detail: null };
	}

	const { data, error } = await supabase.from(TABLES.PAYMENTS).select('amount_usd').eq('ftr_code', ftrCode);

	if (error || !data || data.length === 0) {
		return { check: 'swift_amount_matches_payment_record', result: 'not_checked', detail: { ftrCode } };
	}
	const matches = data.some((row) => Number(row.amount_usd) === Number(extractedAmount));
	return {
		check: 'swift_amount_matches_payment_record',
		result: matches ? 'match' : 'mismatch',
		detail: { extracted: extractedAmount, on_file: data.map((row) => Number(row.amount_usd)) },
	};
}

async function checkComplianceDocAgainstEvents(ftrCode, docType, extractedExpiryDate) {
	const { data, error } = await supabase
		.from(TABLES.COMPLIANCE_EVENTS)
		.select('expiry_date')
		.eq('ftr_code', ftrCode)
		.eq('document_type', docType)
		.maybeSingle();

	if (error || !data) {
		return { check: 'compliance_doc_matches_event_record', result: 'not_checked', detail: { ftrCode, docType } };
	}
	const matches = !extractedExpiryDate || data.expiry_date === extractedExpiryDate;
	return {
		check: 'compliance_doc_matches_event_record',
		result: matches ? 'match' : 'mismatch',
		detail: { extracted: extractedExpiryDate, on_file: data.expiry_date },
	};
}

function checkAflatoxin(market, aflatoxinPpb) {
	if (aflatoxinPpb == null || !market) {
		return { check: 'aflatoxin_within_market_limit', result: 'not_checked', detail: null };
	}
	const limitPpb = getAflatoxinLimitPpb(market);
	const withinLimit = isAflatoxinWithinLimit(aflatoxinPpb, limitPpb);
	return {
		check: 'aflatoxin_within_market_limit',
		result: withinLimit === false ? 'mismatch' : withinLimit === true ? 'match' : 'not_checked',
		detail: { aflatoxin_ppb: aflatoxinPpb, limit_ppb: limitPpb, market },
	};
}

function checkLabAccredited(labName) {
	if (!labName) {
		return { check: 'lab_accredited', result: 'not_checked', detail: null };
	}
	return { check: 'lab_accredited', result: isAccreditedLab(labName) ? 'match' : 'mismatch', detail: { labName } };
}

// phytosanitaryExtractor.js already computes is_valid (30-day rule); without
// this check, a well-matched-but-expired certificate has no signal anywhere
// that would stop it from reaching confidence_band: 'auto_accept' —
// is_valid: false is a real, confidently-extracted answer, not a missing
// field, so confidenceScoring.js alone would never catch it.
function checkPhytoValidity(isValid) {
	if (isValid == null) {
		return { check: 'phyto_still_valid', result: 'not_checked', detail: null };
	}
	return { check: 'phyto_still_valid', result: isValid ? 'match' : 'mismatch', detail: { is_valid: isValid } };
}

// Read-only checks only — never a nested master.route() for the same FTR
// (see docs/RDIA_PRD.md's reconciliation of §11, and the original deadlock
// analysis: withFtrLock is not reentrant).
async function validateExtraction({ ftrCode, classifiedDocType, extractedFields, market }) {
	const fields = extractedFields || {};
	const checks = [];

	const ftrCheck = await checkFtrExists(ftrCode);
	checks.push({ check: ftrCheck.check, result: ftrCheck.result, detail: ftrCheck.detail });

	const effectiveMarket = market || (ftrCheck.ftrRow && ftrCheck.ftrRow.market) || null;

	if (classifiedDocType === 'LabReport') {
		checks.push(checkAflatoxin(effectiveMarket, fields.aflatoxin_ppb));
		checks.push(checkLabAccredited(fields.lab_name));
	}

	if (classifiedDocType === 'Phyto') {
		checks.push(checkPhytoValidity(fields.is_valid));
	}

	if (classifiedDocType === 'Invoice' && ftrCheck.ftrRow) {
		checks.push(await checkBuyerMatchesCustomer(fields.buyer_name, ftrCheck.ftrRow.buyer_id));
	}

	if (classifiedDocType === 'SWIFT') {
		checks.push(await checkSwiftAgainstPayments(ftrCode, fields.amount));
	}

	if (classifiedDocType === 'ACID' || classifiedDocType === 'ImportPermit') {
		checks.push(await checkComplianceDocAgainstEvents(ftrCode, classifiedDocType, fields.expiry_date));
	}

	return checks;
}

module.exports = { validateExtraction, namesMatch };
