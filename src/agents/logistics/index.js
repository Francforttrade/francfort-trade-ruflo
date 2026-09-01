const logger = require('../../utils/logger');
const { queryContainerTracking } = require('./searatesQuery');
const { containersMatch } = require('./containerLinking');
const { buildEtaCalendarEvent } = require('./calendarEvent');
const { buildPaymentTrackingCalendarEvent } = require('./paymentTrackingCalendarEvent');
const { upsertEtaCalendarEvent } = require('../../services/calendarService');
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

	// Task spec section 5: one "CHEGADA/Cobrança" Calendar event per tracking
	// row, upserted by trackingId (never by title) so a later ETA/booking
	// amendment updates the same event instead of creating a duplicate. Only
	// fires when the caller supplies the payment-tracking identity fields —
	// the plain ETA note above (`calendarEvent`) still runs independently of
	// this for callers that don't have those yet.
	let paymentTrackingCalendar = null;
	if (context.trackingId && context.buyer && etaDate) {
		const eventPayload = buildPaymentTrackingCalendarEvent({ ...context, etaCurrent: etaDate });
		paymentTrackingCalendar = await upsertEtaCalendarEvent(eventPayload, { alertDaysBefore: context.alertDaysBefore });
	}

	return {
		agent: 'logistics',
		ftr_code: ftrCode,
		tracking,
		container_check: containerCheck,
		calendar_event: calendarEvent,
		payment_tracking_calendar: paymentTrackingCalendar,
		demurrage,
	};
}

module.exports = { process };
