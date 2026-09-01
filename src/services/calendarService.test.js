const { isCalendarConfigured, buildReminderOverrides, toCalendarEventBody, upsertEtaCalendarEvent } = require('./calendarService');

describe('isCalendarConfigured', () => {
	const original = { ...process.env };

	afterEach(() => {
		process.env = { ...original };
	});

	test('false when credentials are missing', () => {
		delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY;
		delete process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;
		expect(isCalendarConfigured()).toBe(false);
	});

	test('true once both env vars are set', () => {
		process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY = '{}';
		process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL = 'export@francfort.co';
		expect(isCalendarConfigured()).toBe(true);
	});
});

describe('buildReminderOverrides', () => {
	test('converts days-before into minutes for email + popup', () => {
		expect(buildReminderOverrides(7)).toEqual({
			useDefault: false,
			overrides: [
				{ method: 'email', minutes: 7 * 24 * 60 },
				{ method: 'popup', minutes: 7 * 24 * 60 },
			],
		});
	});
});

describe('toCalendarEventBody', () => {
	test('builds an all-day event body carrying the tracking id', () => {
		const body = toCalendarEventBody(
			{
				title: 'CHEGADA/Cobrança | 03073-26 | X | BL Y',
				description: 'FTR: 03073-26',
				date: '2026-09-20',
				extendedProperties: { private: { trackingId: 'TRK-000001-26' } },
			},
			7
		);

		expect(body.start).toEqual({ date: '2026-09-20' });
		expect(body.end).toEqual({ date: '2026-09-20' });
		expect(body.extendedProperties.private.trackingId).toBe('TRK-000001-26');
	});
});

describe('upsertEtaCalendarEvent without credentials', () => {
	const original = { ...process.env };

	afterEach(() => {
		process.env = { ...original };
	});

	test('returns a not-configured result instead of throwing', async () => {
		delete process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY;
		delete process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

		const result = await upsertEtaCalendarEvent({
			title: 'x',
			description: 'y',
			date: '2026-09-20',
			extendedProperties: { private: { trackingId: 'TRK-000001-26' } },
		});

		expect(result).toEqual({ created: false, updated: false, event_id: null, event_link: null, error: 'calendar_not_configured' });
	});
});
