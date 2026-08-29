// EXCECOES: Retry with backoff, DLQ management, manual escalation. SLA: Immediate.
async function process(context) {
	return { agent: 'excecoes', status: 'not_implemented', context };
}

module.exports = { process };
