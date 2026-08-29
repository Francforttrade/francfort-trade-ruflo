// COMUNICACAO: Parse email/WhatsApp, extract FTR/Booking/Invoice, route to MASTER. SLA: <5min.
async function process(context) {
	return { agent: 'comunicacao', status: 'not_implemented', context };
}

module.exports = { process };
