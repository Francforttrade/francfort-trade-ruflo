const { supabase, TABLES } = require('../../services/supabase');

const HISTORICAL_WINDOW_DAYS = 30;

// ROADMAP: "Supabase query: histórico preços últimos 30 dias".
async function getHistoricalAveragePriceUsd(productType, grade) {
	const since = new Date(Date.now() - HISTORICAL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

	const { data, error } = await supabase
		.from(TABLES.FTR)
		.select('unit_price_usd')
		.eq('product_type', productType)
		.eq('product_grade', grade)
		.gte('created_at', since);

	if (error) {
		throw error;
	}
	if (!data || data.length === 0) {
		return null;
	}

	const sum = data.reduce((acc, row) => acc + Number(row.unit_price_usd), 0);
	return sum / data.length;
}

module.exports = { getHistoricalAveragePriceUsd };
