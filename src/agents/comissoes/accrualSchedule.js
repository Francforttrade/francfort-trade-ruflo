// ROADMAP: "Monthly accrual on days 10/25".
const ACCRUAL_DAYS = [10, 25];

function isAccrualDay(date = new Date()) {
	return ACCRUAL_DAYS.includes(date.getDate());
}

module.exports = { ACCRUAL_DAYS, isAccrualDay };
