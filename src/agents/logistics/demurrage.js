// The ROADMAP literally says "Se ETA confirmada < ETD + free_time (14 dias),
// calcular demurrage", but that flags fast transits rather than overdue
// pickups. Demurrage is actually charged when a container isn't picked up
// within `freeTimeDays` of ETA (arrival) — so this checks a reference date
// (default: now) against ETA + free time instead of the ROADMAP's literal
// ETD-based formula.
const DEFAULT_FREE_TIME_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function demurrageDeadline(etaIso, freeTimeDays = DEFAULT_FREE_TIME_DAYS) {
	return new Date(new Date(etaIso).getTime() + freeTimeDays * DAY_MS);
}

function hasDemurrageRisk(etaIso, referenceDate = new Date(), freeTimeDays = DEFAULT_FREE_TIME_DAYS) {
	return new Date(referenceDate) > demurrageDeadline(etaIso, freeTimeDays);
}

module.exports = { DEFAULT_FREE_TIME_DAYS, demurrageDeadline, hasDemurrageRisk };
