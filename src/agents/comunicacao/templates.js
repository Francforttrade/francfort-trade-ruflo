const TEMPLATES = {
	quote_offer: 'Oferta recebida, aguardando confirmação de Rodrigo.',
	booking: 'Booking recebido, notificando comprador/vendedor.',
	invoice: 'Fatura recebida, encaminhando para conferência financeira.',
	bl_document: 'Documento de BL recebido, encaminhando para documentação.',
	ftr_reference: 'FTR referenciada recebida, encaminhando para validação.',
	unknown: 'Mensagem recebida, não foi possível classificar automaticamente.',
};

function getResponseTemplate(intent) {
	return TEMPLATES[intent] || TEMPLATES.unknown;
}

module.exports = { getResponseTemplate, TEMPLATES };
