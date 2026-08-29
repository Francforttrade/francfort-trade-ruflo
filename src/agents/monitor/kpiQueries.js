const { supabase, TABLES } = require('../../services/supabase');

const LAST_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ROADMAP: "FTRs em análise: contagem".
async function countFtrsInAnalysis() {
	const { count, error } = await supabase
		.from(TABLES.FTR)
		.select('*', { count: 'exact', head: true })
		.eq('status', 'Em análise');
	if (error) {
		throw error;
	}
	return count;
}

// ROADMAP: "FTRs finalizados (último 7 dias): count + revenue USD".
async function getFinalizedFtrsLast7Days() {
	const since = new Date(Date.now() - LAST_7_DAYS_MS).toISOString();
	const { data, error } = await supabase
		.from(TABLES.FTR)
		.select('total_value_usd')
		.eq('status', 'Final')
		.gte('updated_at', since);
	if (error) {
		throw error;
	}
	return { count: data.length, revenue_usd: data.reduce((sum, row) => sum + Number(row.total_value_usd || 0), 0) };
}

// ROADMAP: "Avg ciclo dias (criação → Final)".
async function getAverageCycleDays() {
	const { data, error } = await supabase.from(TABLES.FTR).select('created_at, updated_at').eq('status', 'Final');
	if (error) {
		throw error;
	}
	if (!data.length) {
		return null;
	}
	const totalDays = data.reduce(
		(sum, row) => sum + (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / (24 * 60 * 60 * 1000),
		0
	);
	return totalDays / data.length;
}

module.exports = { countFtrsInAnalysis, getFinalizedFtrsLast7Days, getAverageCycleDays };
