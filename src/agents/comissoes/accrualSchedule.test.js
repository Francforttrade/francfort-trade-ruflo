const { isAccrualDay } = require('./accrualSchedule');

describe('comissoes accrualSchedule', () => {
	test('is an accrual day on the 10th and 25th (ROADMAP: "Monthly accrual on days 10/25")', () => {
		expect(isAccrualDay(new Date('2026-08-10'))).toBe(true);
		expect(isAccrualDay(new Date('2026-08-25'))).toBe(true);
	});

	test('is not an accrual day on any other date', () => {
		expect(isAccrualDay(new Date('2026-08-11'))).toBe(false);
		expect(isAccrualDay(new Date('2026-08-01'))).toBe(false);
	});
});
