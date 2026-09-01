// Reads free-form correspondence for payment-related signals. Per the task
// spec (section 4), these tiers are deliberately kept distinct: a SWIFT copy
// landing in someone's inbox is not the same thing as the bank actually
// crediting the account, and this module never claims the latter — it only
// reports what the *text* says. Whether a credit is real is FINANCEIRO's
// existing bank-query gate (bankQuery.js / releaseGate.js), not a regex.
const SWIFT_MENTION_REGEX = /\bswift\b|\bmt\s?103\b|comprovante\s+(?:de\s+)?(?:pagamento|transfer[êe]ncia)/i;

const PARTIAL_PAYMENT_REGEX = /\bpartial\s+payment\b|\bpagamento\s+parcial\b|\bsaldo\s+(?:remanescente|pendente)\b/i;

// Bank-credit language ("crédito confirmado", "valor creditado", "bank
// credit confirmed") is a stronger signal than a bare SWIFT/receipt mention,
// but it is still just a signal extracted from text — not a substitute for
// the bank-query confirmation gate.
const CREDIT_CONFIRMED_LANGUAGE_REGEX =
	/cr[ée]dito\s+confirmado|valor\s+creditado|bank\s+credit\s+confirmed|pagamento\s+confirmado|payment\s+confirmed/i;

function detectSwiftMention(text) {
	return Boolean(text && SWIFT_MENTION_REGEX.test(text));
}

function detectPartialPayment(text) {
	return Boolean(text && PARTIAL_PAYMENT_REGEX.test(text));
}

// Text-level signal only: the message *claims* the credit is confirmed.
// Callers must still corroborate this against bankQuery's
// queryBankCreditConfirmation before treating a payment as PAGAMENTO
// CONFIRMADO — see paymentStatusService.js.
function detectPaymentConfirmedLanguage(text) {
	return Boolean(text && CREDIT_CONFIRMED_LANGUAGE_REGEX.test(text));
}

module.exports = { detectSwiftMention, detectPartialPayment, detectPaymentConfirmedLanguage };
