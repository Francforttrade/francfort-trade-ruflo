// Normalizes the many ways an FTR code shows up in free-form text into the
// canonical form already used as the primary key across this codebase:
// supabase/migrations/0001_init_schema.sql's `ftr.ftr_code` and
// config/schemas.json's FTR.ftr_code both store "03075-26" — 5-digit code,
// dash, 2-digit year, optional "-N" amendment suffix — with no "FTR-"
// prefix. Introducing a differently-shaped canonical form here would break
// every FK/document-ID lookup already keyed on the bare format, so this
// module normalizes *to* that existing shape rather than inventing a new one.
//
// Recognized input variations (see task spec): "FTR-03073-26", "FTR 03073-26",
// "FTR03073-26", "03073-26", "3073-26", "FTR-3073-26", "FTR 3073/26",
// "3073/26" — including a missing leading zero and "/" used instead of "-"
// before the year.
const FTR_CANDIDATE_REGEX = /\bFTR[\s.-]*(\d{3,5})[\s/-](\d{2})(?:[\s/-](\d{1,2}))?\b|\b(\d{4,5})[\s/-](\d{2})(?:[\s/-](\d{1,2}))?\b/gi;

function toCanonical(digits, year, amendment) {
	const code = digits.padStart(5, '0');
	const base = `${code}-${year}`;
	return amendment ? `${base}-${amendment}` : base;
}

// Returns every distinct normalized FTR code mentioned in the text, in the
// order first seen. Distinct codes (not just distinct raw strings) are what
// matter for ambiguity detection downstream.
function extractAllFtrCandidates(text) {
	if (!text) return [];

	const seen = new Set();
	const results = [];
	let match;
	FTR_CANDIDATE_REGEX.lastIndex = 0;
	while ((match = FTR_CANDIDATE_REGEX.exec(text)) !== null) {
		const digits = match[1] || match[4];
		const year = match[2] || match[5];
		const amendment = match[3] || match[6] || null;
		if (!digits || !year) continue;

		const normalized = toCanonical(digits, year, amendment);
		if (!seen.has(normalized)) {
			seen.add(normalized);
			results.push(normalized);
		}
	}
	return results;
}

// Single-value convenience for the common case. Returns null when there is
// no candidate *or* when multiple distinct FTR codes are mentioned — callers
// that need to know "which, if any" should use extractAllFtrCandidates and
// the ambiguity flag themselves instead of guessing.
function normalizeFtr(text) {
	const candidates = extractAllFtrCandidates(text);
	return candidates.length === 1 ? candidates[0] : null;
}

// True when the text mentions more than one distinct FTR code — the task
// spec requires flagging these as "REVISÃO MANUAL" instead of guessing.
function isFtrAmbiguous(text) {
	return extractAllFtrCandidates(text).length > 1;
}

module.exports = { normalizeFtr, extractAllFtrCandidates, isFtrAmbiguous };
