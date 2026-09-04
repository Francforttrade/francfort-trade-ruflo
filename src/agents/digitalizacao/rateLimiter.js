const { FieldValue } = require('@google-cloud/firestore');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const CONFIG = require('../../config');

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function ftrDocId(ftrCode) {
	return `ftr-${ftrCode}`;
}

function dayDocId() {
	return `day-${todayKey()}`;
}

async function getCallCounts(ftrCode) {
	const collection = firestore.collection(COLLECTIONS.DIGITALIZACAO_RATE_LIMITS);
	const [ftrDoc, dayDoc] = await Promise.all([collection.doc(ftrDocId(ftrCode)).get(), collection.doc(dayDocId()).get()]);

	return {
		perFtr: ftrDoc.exists ? ftrDoc.data().count || 0 : 0,
		perDay: dayDoc.exists ? dayDoc.data().count || 0 : 0,
	};
}

// A soft ceiling, not a security control: over-cap degrades to manual
// review (see index.js) instead of failing the request, so a brief race
// between concurrent requests slightly overshooting the cap is an accepted
// cost, not something worth a Firestore transaction to prevent.
async function isUnderPaidCallCap(ftrCode) {
	const { perFtr, perDay } = await getCallCounts(ftrCode);
	return perFtr < CONFIG.DIGITALIZACAO.MAX_PAID_CALLS_PER_FTR && perDay < CONFIG.DIGITALIZACAO.MAX_PAID_CALLS_PER_DAY;
}

async function recordPaidCall(ftrCode) {
	const collection = firestore.collection(COLLECTIONS.DIGITALIZACAO_RATE_LIMITS);
	await Promise.all([
		collection.doc(ftrDocId(ftrCode)).set({ count: FieldValue.increment(1) }, { merge: true }),
		collection.doc(dayDocId()).set({ count: FieldValue.increment(1) }, { merge: true }),
	]);
}

module.exports = { isUnderPaidCallCap, recordPaidCall, getCallCounts };
