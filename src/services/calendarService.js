// Google Calendar integration for the payment-tracking alerts (task spec
// section 5) — creates/updates one event per FTR+booking+BL+invoice
// combination in a dedicated "FRANCFORT – CHEGADAS E COBRANÇAS" calendar on
// the export@francfort.co account, using Calendar's REST API directly
// (via axios, already a dependency) authenticated with google-auth-library
// rather than pulling in the full googleapis SDK for a handful of calls.
//
// Like bankQuery.js/searatesQuery.js, this needs credentials this repo
// doesn't have (a service account with domain-wide delegation impersonating
// export@francfort.co) — every exported function checks isCalendarConfigured()
// first and returns a clearly-flagged "not configured" result instead of
// throwing, so a missing credential degrades to "needs manual calendar
// entry" rather than crashing the sync.
const axios = require('axios');
const { JWT } = require('google-auth-library');
const logger = require('../utils/logger');
const CONFIG = require('../config');

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_NAME = 'FRANCFORT – CHEGADAS E COBRANÇAS';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

function isCalendarConfigured() {
	return Boolean(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL);
}

function getAuthClient() {
	const credentials = JSON.parse(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY);
	return new JWT({
		email: credentials.client_email,
		key: credentials.private_key,
		scopes: SCOPES,
		subject: process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL,
	});
}

// 7-day-before Calendar notification (task spec section 5/6) as a reminder
// override, alongside a same-day popup. Pure/testable — no network call.
function buildReminderOverrides(alertDaysBefore) {
	return {
		useDefault: false,
		overrides: [
			{ method: 'email', minutes: alertDaysBefore * 24 * 60 },
			{ method: 'popup', minutes: alertDaysBefore * 24 * 60 },
		],
	};
}

// Converts the pure payload from paymentTrackingCalendarEvent.js into a
// Calendar API event body (all-day, since ETA is a date not a timestamp).
// Pure/testable — no network call.
function toCalendarEventBody(eventPayload, alertDaysBefore) {
	return {
		summary: eventPayload.title,
		description: eventPayload.description,
		start: { date: eventPayload.date },
		end: { date: eventPayload.date },
		extendedProperties: eventPayload.extendedProperties,
		reminders: buildReminderOverrides(alertDaysBefore),
	};
}

async function findOrCreateTrackingCalendar(authClient) {
	const list = await axios.get(`${CALENDAR_API_BASE}/users/me/calendarList`, {
		headers: { Authorization: `Bearer ${(await authClient.getAccessToken()).token}` },
	});
	const existing = (list.data.items || []).find((cal) => cal.summary === CALENDAR_NAME);
	if (existing) return existing.id;

	const created = await axios.post(
		`${CALENDAR_API_BASE}/calendars`,
		{ summary: CALENDAR_NAME },
		{ headers: { Authorization: `Bearer ${(await authClient.getAccessToken()).token}` } }
	);
	return created.data.id;
}

async function findEventByTrackingId(authClient, calendarId, trackingId) {
	const response = await axios.get(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
		headers: { Authorization: `Bearer ${(await authClient.getAccessToken()).token}` },
		params: { privateExtendedProperty: `trackingId=${trackingId}` },
	});
	const items = response.data.items || [];
	return items.length > 0 ? items[0] : null;
}

// Creates the event on first sync, or patches the same event (found via its
// extendedProperties.private.trackingId, never by title) on later ETA/booking
// changes — task spec section 5's "não use somente o título do evento para
// localizar ou atualizar registros" and section 7's "não crie evento duplicado".
async function upsertEtaCalendarEvent(eventPayload, { alertDaysBefore = 7 } = {}) {
	if (CONFIG.TEST_MODE) {
		logger.info('[MODO DE TESTE] Evento de Calendar não criado/atualizado — apenas logado', {
			trackingId: eventPayload.extendedProperties?.private?.trackingId,
			title: eventPayload.title,
		});
		return { created: false, updated: false, event_id: null, event_link: null, error: 'test_mode' };
	}

	if (!isCalendarConfigured()) {
		logger.warn('Google Calendar não configurado — evento não criado, registro requer revisão manual', {
			trackingId: eventPayload.extendedProperties?.private?.trackingId,
		});
		return { created: false, updated: false, event_id: null, event_link: null, error: 'calendar_not_configured' };
	}

	try {
		const authClient = getAuthClient();
		const calendarId = await findOrCreateTrackingCalendar(authClient);
		const trackingId = eventPayload.extendedProperties?.private?.trackingId;
		const existing = trackingId ? await findEventByTrackingId(authClient, calendarId, trackingId) : null;
		const body = toCalendarEventBody(eventPayload, alertDaysBefore);
		const token = (await authClient.getAccessToken()).token;

		if (existing) {
			const updated = await axios.patch(
				`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${existing.id}`,
				body,
				{ headers: { Authorization: `Bearer ${token}` } }
			);
			return { created: false, updated: true, event_id: updated.data.id, event_link: updated.data.htmlLink, error: null };
		}

		const inserted = await axios.post(`${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, body, {
			headers: { Authorization: `Bearer ${token}` },
		});
		return { created: true, updated: false, event_id: inserted.data.id, event_link: inserted.data.htmlLink, error: null };
	} catch (err) {
		logger.error('Falha ao sincronizar evento no Google Calendar', { error: err.message });
		return { created: false, updated: false, event_id: null, event_link: null, error: err.message };
	}
}

module.exports = {
	CALENDAR_NAME,
	isCalendarConfigured,
	buildReminderOverrides,
	toCalendarEventBody,
	upsertEtaCalendarEvent,
};
