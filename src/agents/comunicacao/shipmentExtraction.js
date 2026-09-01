// Extracts shipment-schedule fields (ports, vessel/voyage, ETD/ETA,
// container count) from free-form booking/BL correspondence. Every function
// returns null rather than guessing when the text doesn't contain a
// recognizable, labeled value — per the task spec, "não invente informações
// ausentes".
const MONTHS_PT_EN = {
	jan: '01',
	fev: '02',
	feb: '02',
	mar: '03',
	abr: '04',
	apr: '04',
	mai: '05',
	may: '05',
	jun: '06',
	jul: '07',
	ago: '08',
	aug: '08',
	set: '09',
	sep: '09',
	out: '10',
	oct: '10',
	nov: '11',
	dez: '12',
	dec: '12',
};

// Port/vessel names are captured as a run of capitalized words (a proper
// noun), not "everything up to the next comma" — free-form sentences like
// "to Algiers confirmed" or "Reefer departing Santos" have no punctuation
// boundary to stop at, so a lazy-to-comma capture would swallow the verb
// that follows. Stopping at the first lowercase-initial word is a
// deliberate heuristic trade-off: it correctly excludes trailing prose but
// will under-capture a name that itself starts lowercase.
//
// This capture must stay case-sensitive, while the label ahead of it
// ("POL:", "vessel:", "from") must stay case-insensitive — one RegExp can't
// mix flags, so labels are matched separately and the proper-noun regex is
// then applied to the text remaining after the label.
const PROPER_NOUN_REGEX = /^[A-ZÀ-Ý][A-Za-zÀ-ÿ0-9.'-]*(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ0-9.'-]*)*/;

const PORT_ORIGIN_LABEL_REGEX = /(?:port\s+of\s+loading|pol|porto\s+de\s+origem|porto\s+de\s+embarque)/i;
const PORT_DEST_LABEL_REGEX = /(?:port\s+of\s+discharge|pod|porto\s+de\s+destino|porto\s+de\s+descarga)/i;
const VESSEL_LABEL_REGEX = /(?:vessel\s*(?:name)?|m\/?v|navio)/i;
const FROM_LABEL_REGEX = /\bfrom\s+/i;
const TO_LABEL_REGEX = /^\s+to\s+/i;

const VOYAGE_REGEX = /(?:voyage|v[oó]y\.?|viagem)\s*(?:number|no\.?|n[o°]?\.?)?\s*[:#]?\s*([A-Z0-9-]+)/i;

function captureProperNounAfterLabel(text, labelRegex) {
	const labelMatch = labelRegex.exec(text);
	if (!labelMatch) return null;
	const remainder = text.slice(labelMatch.index + labelMatch[0].length).replace(/^[\s:#"]+/, '');
	const nounMatch = remainder.match(PROPER_NOUN_REGEX);
	return nounMatch ? cleanText(nounMatch[0]) : null;
}

function extractFromToPorts(text) {
	const fromMatch = FROM_LABEL_REGEX.exec(text);
	if (!fromMatch) return { origin: null, destination: null };

	const afterFrom = text.slice(fromMatch.index + fromMatch[0].length);
	const originMatch = afterFrom.match(PROPER_NOUN_REGEX);
	if (!originMatch) return { origin: null, destination: null };

	const afterOrigin = afterFrom.slice(originMatch[0].length);
	const toMatch = TO_LABEL_REGEX.exec(afterOrigin);
	if (!toMatch) return { origin: cleanText(originMatch[0]), destination: null };

	const afterTo = afterOrigin.slice(toMatch[0].length);
	const destMatch = afterTo.match(PROPER_NOUN_REGEX);
	return { origin: cleanText(originMatch[0]), destination: destMatch ? cleanText(destMatch[0]) : null };
}

const ETD_REGEX = /\betd\s*[:#]?\s*(\d{1,2}[\s/.-][A-Za-zÀ-ÿ0-9]{1,9}[\s/.-]\d{2,4}|\d{4}-\d{2}-\d{2})/i;
const ETA_REGEX = /\beta\s*[:#]?\s*(\d{1,2}[\s/.-][A-Za-zÀ-ÿ0-9]{1,9}[\s/.-]\d{2,4}|\d{4}-\d{2}-\d{2})/i;

const CONTAINER_QTY_REGEX = /(\d+)\s*(?:x\s*)?(?:x40|x20)?['’]?\s*(?:containers?|cont[êe]ineres?|cntrs?)\b/i;

function cleanText(value) {
	return value ? value.trim().replace(/\s{2,}/g, ' ') : null;
}

function extractOriginPort(text) {
	if (!text) return null;
	const labeled = captureProperNounAfterLabel(text, PORT_ORIGIN_LABEL_REGEX);
	return labeled || extractFromToPorts(text).origin;
}

function extractDestinationPort(text) {
	if (!text) return null;
	const labeled = captureProperNounAfterLabel(text, PORT_DEST_LABEL_REGEX);
	return labeled || extractFromToPorts(text).destination;
}

function extractVessel(text) {
	if (!text) return null;
	return captureProperNounAfterLabel(text, VESSEL_LABEL_REGEX);
}

function extractVoyage(text) {
	if (!text) return null;
	const match = text.match(VOYAGE_REGEX);
	return match ? match[1].trim().toUpperCase() : null;
}

// Parses a date fragment already isolated by ETD_REGEX/ETA_REGEX into an ISO
// (yyyy-mm-dd) string. Returns null instead of an invalid guess when the
// fragment doesn't resolve to a real calendar date.
function parseDateFragment(fragment) {
	if (!fragment) return null;

	const isoMatch = fragment.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) return fragment;

	const numericMatch = fragment.match(/^(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{2,4})$/);
	if (numericMatch) {
		const [, day, month, yearRaw] = numericMatch;
		const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	const monthNameMatch = fragment.match(/^(\d{1,2})[\s/.-]([A-Za-zÀ-ÿ]{3,})[\s/.-](\d{2,4})$/);
	if (monthNameMatch) {
		const [, day, monthName, yearRaw] = monthNameMatch;
		const month = MONTHS_PT_EN[monthName.toLowerCase().slice(0, 3)];
		if (!month) return null;
		const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
		return `${year}-${month}-${day.padStart(2, '0')}`;
	}

	return null;
}

function extractEtd(text) {
	if (!text) return null;
	const match = text.match(ETD_REGEX);
	return match ? parseDateFragment(match[1]) : null;
}

function extractEta(text) {
	if (!text) return null;
	const match = text.match(ETA_REGEX);
	return match ? parseDateFragment(match[1]) : null;
}

function extractContainerQuantity(text) {
	if (!text) return null;
	const match = text.match(CONTAINER_QTY_REGEX);
	return match ? parseInt(match[1], 10) : null;
}

module.exports = {
	extractOriginPort,
	extractDestinationPort,
	extractVessel,
	extractVoyage,
	extractEtd,
	extractEta,
	extractContainerQuantity,
	parseDateFragment,
};
