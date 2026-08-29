// ROADMAP "Regulatory calendar" / "Aflatoxin spec mapping":
// - Egypt: ACID (CargoX/USDA), aflatoxin ≤2ppb
// - Algeria: Import permit, livre circulação, ACID optional (limit per the
//   config/schemas.json worked example, since the ROADMAP section doesn't
//   restate it explicitly)
// - Russia: aflatoxin ≤5ppb (B1); the ROADMAP's "5/10ppb" also names a
//   10ppb total-aflatoxin ceiling, tracked separately once a lab reports it
const MARKET_REQUIREMENTS = {
	Egypt: { aflatoxinLimitPpb: 2, requiredDocuments: ['ACID'] },
	Algeria: { aflatoxinLimitPpb: 5, requiredDocuments: ['Import Permit'] },
	Russia: { aflatoxinLimitPpb: 5, requiredDocuments: ['Phyto', 'Certificate'] },
};

function getMarketRequirements(market) {
	return MARKET_REQUIREMENTS[market] || null;
}

function getAflatoxinLimitPpb(market) {
	const requirements = getMarketRequirements(market);
	return requirements ? requirements.aflatoxinLimitPpb : null;
}

module.exports = { MARKET_REQUIREMENTS, getMarketRequirements, getAflatoxinLimitPpb };
