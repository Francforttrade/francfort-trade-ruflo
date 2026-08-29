// ROADMAP example: "Ação necessária: FTR 03075-26 agente FINANCEIRO falhou (motivo: SWIFT timeout)".
function buildEscalationMessage({ ftrCode, agent, reason }) {
	return `Ação necessária: FTR ${ftrCode} agente ${(agent || '').toUpperCase()} falhou (motivo: ${reason})`;
}

module.exports = { buildEscalationMessage };
