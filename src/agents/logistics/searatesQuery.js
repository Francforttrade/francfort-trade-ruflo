// ROADMAP: "Query Searates API: carrier, vessel, ETA" — no real Searates
// credentials are configured yet, so this stands in as a mock, same as
// Financeiro's bankQuery, until that integration exists.
async function queryContainerTracking(containerNumber) {
	return { container_number: containerNumber, carrier: null, vessel_name: null, etd: null, eta: null, mocked: true };
}

module.exports = { queryContainerTracking };
