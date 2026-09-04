const { firestore, COLLECTIONS } = require('../../services/firestore');
const CONFIG = require('../../config');

const DAY_MS = 24 * 60 * 60 * 1000;

// Caches the *extraction output* (text/table rows), not the final per-FTR
// result — cross-validation and entity resolution still have to run fresh
// on every request even for a cache-hit document, since they depend on
// whatever FTR/context this particular request came in under, not on the
// document's bytes alone.
async function getCached(contentHash) {
	if (!contentHash) {
		return null;
	}

	const doc = await firestore.collection(COLLECTIONS.DIGITALIZACAO_CACHE).doc(contentHash).get();
	if (!doc.exists) {
		return null;
	}

	const data = doc.data();
	const ttlMs = CONFIG.DIGITALIZACAO.CACHE_TTL_DAYS * DAY_MS;
	const ageMs = Date.now() - new Date(data.cached_at).getTime();
	if (ageMs > ttlMs) {
		return null;
	}

	return { extractedText: data.extracted_text, tableRows: data.table_rows || null };
}

// first_seen_ftr_code is kept even on a later overwrite (never updated) so a
// hash that resurfaces under a *different* FTR later is still visible as a
// signal (possible reused/misattributed attachment), even though the
// extraction itself is skipped either way.
async function setCached(contentHash, { extractedText, tableRows }, ftrCode) {
	if (!contentHash) {
		return;
	}

	const ref = firestore.collection(COLLECTIONS.DIGITALIZACAO_CACHE).doc(contentHash);
	const existing = await ref.get();

	await ref.set(
		{
			extracted_text: extractedText,
			table_rows: tableRows || null,
			cached_at: new Date().toISOString(),
			first_seen_ftr_code: existing.exists ? existing.data().first_seen_ftr_code : ftrCode,
		},
		{ merge: true }
	);
}

module.exports = { getCached, setCached };
