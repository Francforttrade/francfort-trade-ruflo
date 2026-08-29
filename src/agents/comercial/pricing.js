const FOB_INCOTERM = 'FOB Santos';
const CFR_INCOTERM = 'CFR';
const CIF_INCOTERM = 'CIF';

// ROADMAP: preço <-25% do histórico é tratado como possível dump; tolerância
// normal de variação de preço é ±20%.
const DUMP_THRESHOLD_RATIO = -0.25;
const HISTORICAL_TOLERANCE_RATIO = 0.2;

function calculateIncotermPrice({ fobUsdPerMt, incoterm, freightUsdPerMt = 0, insuranceRate = 0 }) {
	if (incoterm === FOB_INCOTERM) {
		return fobUsdPerMt;
	}

	const cfr = fobUsdPerMt + freightUsdPerMt;
	if (incoterm === CFR_INCOTERM) {
		return cfr;
	}

	if (incoterm === CIF_INCOTERM) {
		return cfr * (1 + insuranceRate);
	}

	throw new Error(`Incoterm desconhecido: ${incoterm}`);
}

function priceDeviationRatio(unitPriceUsd, historicalAvgPriceUsd) {
	return (unitPriceUsd - historicalAvgPriceUsd) / historicalAvgPriceUsd;
}

function isPriceDump(unitPriceUsd, historicalAvgPriceUsd) {
	return priceDeviationRatio(unitPriceUsd, historicalAvgPriceUsd) <= DUMP_THRESHOLD_RATIO;
}

function isWithinHistoricalTolerance(unitPriceUsd, historicalAvgPriceUsd) {
	return Math.abs(priceDeviationRatio(unitPriceUsd, historicalAvgPriceUsd)) <= HISTORICAL_TOLERANCE_RATIO;
}

function isWithinCreditLimit(totalValueUsd, creditLimitUsd) {
	if (creditLimitUsd == null) {
		return null; // limite desconhecido — precisa checagem manual
	}
	return totalValueUsd <= creditLimitUsd;
}

module.exports = {
	FOB_INCOTERM,
	CFR_INCOTERM,
	CIF_INCOTERM,
	calculateIncotermPrice,
	priceDeviationRatio,
	isPriceDump,
	isWithinHistoricalTolerance,
	isWithinCreditLimit,
};
