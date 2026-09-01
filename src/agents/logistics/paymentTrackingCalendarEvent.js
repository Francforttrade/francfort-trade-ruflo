// Builds the "CHEGADA/Cobrança" Calendar event payload for the payment
// tracking record (task spec section 5) — distinct from calendarEvent.js's
// ROADMAP-scoped `buildEtaCalendarEvent` (a plain internal ETA note per
// booking). This one carries the full cross-referenced description used for
// the arrival/collection alert and is what calendarService.js actually
// creates/updates in the "FRANCFORT – CHEGADAS E COBRANÇAS" calendar.
//
// The event is keyed by `trackingId` (the payment_tracking_meta row id, see
// supabase/migrations/0002_payment_tracking.sql) via Calendar's
// extendedProperties.private — never by title text — so a later update finds
// the same event even if the title changes (buyer corrected, BL replaced).
function buildEventTitle({ ftrCode, buyer, blNumber }) {
	return `CHEGADA/Cobrança | ${ftrCode} | ${buyer} | BL ${blNumber || 'N/D'}`;
}

function formatLine(label, value) {
	return `${label}: ${value === null || value === undefined || value === '' ? '-' : value}`;
}

function buildEventDescription(record) {
	return [
		formatLine('FTR', record.ftrCode),
		formatLine('Invoice', record.invoiceNumber),
		formatLine('Booking', record.bookingId),
		formatLine('BL', record.blNumber),
		formatLine('Vendedor/shipper', record.seller),
		formatLine('Comprador', record.buyer),
		formatLine('Quantidade de contêineres', record.containerCount),
		formatLine('Quantidade em toneladas', record.tonnageMt),
		formatLine('Valor da invoice', record.totalInvoiceUsd),
		formatLine('Valor recebido', record.confirmedPaymentsUsd),
		formatLine('Saldo pendente', record.balance),
		formatLine('Status do pagamento', record.paymentStatus),
		formatLine('Condição de pagamento', record.paymentTerms),
		formatLine('Navio', record.vessel),
		formatLine('Voyage', record.voyage),
		formatLine('ETD', record.etd),
		formatLine('ETA', record.etaCurrent),
		formatLine('Porto de origem', record.originPort),
		formatLine('Porto de destino', record.destinationPort),
		formatLine('Link da linha de controle', record.trackingLink),
		formatLine('Link da thread/e-mail de origem', record.sourceEmailLink),
		formatLine('Última sincronização', record.lastSyncedAt),
	].join('\n');
}

// `record.trackingId` is required and stored in extendedProperties.private
// so calendarService.js can look the event up by that ID (not by title) on
// a later update. Returns a plain payload — no Calendar API call happens
// here, keeping this module pure and unit-testable.
function buildPaymentTrackingCalendarEvent(record) {
	return {
		title: buildEventTitle(record),
		description: buildEventDescription(record),
		date: record.etaCurrent,
		extendedProperties: { private: { trackingId: record.trackingId } },
	};
}

module.exports = { buildEventTitle, buildEventDescription, buildPaymentTrackingCalendarEvent };
