const logger = require('../../utils/logger');
const { queryContainerTracking } = require('./searatesQuery');
const { containersMatch } = require('./containerLinking');
const { buildEtaCalendarEvent } = require('./calendarEvent');
const { hasDemurrageRisk, demurrageDeadline } = require('./demurrage');

// LOGISTICS: ETD/ETA tracking, container number lookup, carrier coordination, Searates integration. SLA: Daily 07:00.
async function process(context) {
	const { ftrCode, bookingId, containerNumber, bookingContainers, blContainers, destinationPort, etaDate, freeTimeDays } =
		context;

	const tracking = containerNumber ? await queryContainerTracking(containerNumber) : null;

	const containerCheck =
		bookingContainers && blContainers ? { matches: containersMatch(bookingContainers, blContainers) } : null;

	if (containerCheck && !containerCheck.matches) {
		logger.warn('Contagem de containers entre booking e BL não bate', { ftrCode, bookingContainers, blContainers });
	}

	const calendarEvent =
		bookingId && destinationPort && etaDate
			? buildEtaCalendarEvent({ bookingId, destinationPort, etaIso: etaDate })
			: null;

	const demurrage = etaDate
		? {
				deadline: demurrageDeadline(etaDate, freeTimeDays).toISOString(),
				at_risk: hasDemurrageRisk(etaDate, new Date(), freeTimeDays),
			}
		: null;

	if (demurrage && demurrage.at_risk) {
		logger.warn('Risco de demurrage — free time pode ter expirado', { ftrCode, bookingId, demurrage });
	}

	return {
		agent: 'logistics',
		ftr_code: ftrCode,
		tracking,
		container_check: containerCheck,
		calendar_event: calendarEvent,
		demurrage,
	};
}

module.exports = { process };
