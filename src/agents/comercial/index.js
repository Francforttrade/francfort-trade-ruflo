const logger = require('../../utils/logger');
const { calculateIncotermPrice, isPriceDump, isWithinHistoricalTolerance, isWithinCreditLimit } = require('./pricing');
const { generateOfferText } = require('./quoteTemplate');
const { getHistoricalAveragePriceUsd } = require('./pricingLookup');
const { isSellerReviewOverdue, needsEscalation } = require('./negotiation');

// COMERCIAL: Quote generation, pricing validation, T&C negotiation. SLA: 24h response.
async function process(context) {
	const { seller, buyer, product, quantity, incoterm, unitPriceUsd, freightUsdPerMt, insuranceRate, paymentTerms, previousQuoteSentAt } = context;

	const totalValueUsd = unitPriceUsd * quantity.mt;

	const historicalAvgPriceUsd = await getHistoricalAveragePriceUsd(product.type, product.grade);
	const priceCheck =
		historicalAvgPriceUsd == null
			? { historical_avg_usd: null, is_dump: false, within_tolerance: null }
			: {
					historical_avg_usd: historicalAvgPriceUsd,
					is_dump: isPriceDump(unitPriceUsd, historicalAvgPriceUsd),
					within_tolerance: isWithinHistoricalTolerance(unitPriceUsd, historicalAvgPriceUsd),
				};

	if (priceCheck.is_dump) {
		logger.warn('Possível price dump detectado', { unitPriceUsd, historicalAvgPriceUsd });
	}

	const creditCheck = {
		within_limit: isWithinCreditLimit(totalValueUsd, buyer && buyer.credit_limit_usd),
	};

	const incotermPriceUsd = calculateIncotermPrice({
		fobUsdPerMt: unitPriceUsd,
		incoterm,
		freightUsdPerMt: freightUsdPerMt || 0,
		insuranceRate: insuranceRate || 0,
	});

	const offerText = generateOfferText({
		seller: seller && seller.name,
		buyer: buyer && buyer.name,
		product,
		quantity,
		incoterm,
		unitPriceUsd: incotermPriceUsd,
		totalValueUsd,
		paymentTerms,
	});

	const negotiation = previousQuoteSentAt
		? {
				seller_review_overdue: isSellerReviewOverdue(previousQuoteSentAt),
				needs_escalation: needsEscalation(previousQuoteSentAt),
			}
		: null;

	return {
		agent: 'comercial',
		offer_text: offerText,
		unit_price_usd: incotermPriceUsd,
		total_value_usd: totalValueUsd,
		price_check: priceCheck,
		credit_check: creditCheck,
		negotiation,
	};
}

module.exports = { process };
