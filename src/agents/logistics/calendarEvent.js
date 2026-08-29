// ROADMAP: 'Google Calendar event: "BK-000001-26 ETA Algiers"' + "Reminder: 3 dias antes".
// No Google Calendar credentials are configured, so this builds the event
// payload a future integration would send, rather than calling the API.
const REMINDER_DAYS_BEFORE = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function buildEtaCalendarEvent({ bookingId, destinationPort, etaIso }) {
	const reminderDate = new Date(new Date(etaIso).getTime() - REMINDER_DAYS_BEFORE * DAY_MS);
	return {
		title: `${bookingId} ETA ${destinationPort}`,
		date: etaIso,
		reminder_date: reminderDate.toISOString(),
	};
}

module.exports = { REMINDER_DAYS_BEFORE, buildEtaCalendarEvent };
