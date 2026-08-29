// ROADMAP: "Checklist: BL ✓, CO ✓, Phyto ✓, Fumigation ✓, Invoice ✓, Quality ✓" — SLA 48h before ETD.
const REQUIRED_DOCUMENTS = ['BL', 'CO', 'Phyto', 'Fumigation', 'Invoice', 'Quality'];
const SLA_HOURS_BEFORE_ETD = 48;

function buildDocumentChecklist(presentDocuments = {}) {
	const items = REQUIRED_DOCUMENTS.map((document) => ({ document, present: Boolean(presentDocuments[document]) }));
	return { items, complete: items.every((item) => item.present) };
}

function isWithinDocumentationSla(etdIso, now = new Date()) {
	const hoursUntilEtd = (new Date(etdIso).getTime() - now.getTime()) / (1000 * 60 * 60);
	return hoursUntilEtd >= SLA_HOURS_BEFORE_ETD;
}

module.exports = { REQUIRED_DOCUMENTS, SLA_HOURS_BEFORE_ETD, buildDocumentChecklist, isWithinDocumentationSla };
