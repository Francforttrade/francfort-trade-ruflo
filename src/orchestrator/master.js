const logger = require('../utils/logger');
const comunicacao = require('../agents/comunicacao');
const comercial = require('../agents/comercial');
const contratos = require('../agents/contratos');
const compliance = require('../agents/compliance');
const documentacao = require('../agents/documentacao');
const financeiro = require('../agents/financeiro');
const qualidade = require('../agents/qualidade');
const logistics = require('../agents/logistics');
const comissoes = require('../agents/comissoes');
const excecoes = require('../agents/excecoes');
const monitor = require('../agents/monitor');

const AGENTS = {
	comunicacao,
	comercial,
	contratos,
	compliance,
	documentacao,
	financeiro,
	qualidade,
	logistics,
	comissoes,
	excecoes,
	monitor,
};

const FTR_STATUS = {
	EM_ANALISE: 'Em análise',
	APROVACAO: 'Aprovação',
	EM_REVISAO: 'Em revisão de correção',
	FINAL: 'Final',
};

// One lock per FTR code guards against concurrent phase transitions racing each other.
const ftrLocks = new Map();

async function withFtrLock(ftrCode, fn) {
	const previous = ftrLocks.get(ftrCode) || Promise.resolve();
	let release;
	const current = new Promise((resolve) => {
		release = resolve;
	});
	ftrLocks.set(ftrCode, previous.then(() => current));
	await previous;
	try {
		return await fn();
	} finally {
		release();
		if (ftrLocks.get(ftrCode) === current) {
			ftrLocks.delete(ftrCode);
		}
	}
}

function isValidFtr(message) {
	return Boolean(message && message.ftrCode && message.ftrCode.trim().length > 0);
}

// COMUNICACAO is the intake step that extracts the FTR code from raw text in
// the first place, and MONITOR aggregates across FTRs — neither has one FTR
// to gate on yet, so they skip the validation/mutex that every other agent
// requires.
const AGENTS_WITHOUT_FTR_GATE = new Set(['comunicacao', 'monitor']);

async function route(message) {
	const agent = AGENTS[message.targetAgent];
	if (!agent) {
		logger.warn('Nenhum agente encontrado para a mensagem', { message });
		return AGENTS.excecoes.process({ reason: 'unknown_agent', message });
	}

	if (AGENTS_WITHOUT_FTR_GATE.has(message.targetAgent)) {
		logger.info('Roteando sem gate de FTR', { targetAgent: message.targetAgent });
		return agent.process(message);
	}

	if (!isValidFtr(message)) {
		logger.warn('FTR inválido recebido, encaminhando para excecoes', { message });
		return AGENTS.excecoes.process({ reason: 'invalid_ftr', message });
	}

	return withFtrLock(message.ftrCode, async () => {
		logger.info('Roteando FTR', { ftrCode: message.ftrCode, targetAgent: message.targetAgent });
		return agent.process(message);
	});
}

module.exports = { route, AGENTS, FTR_STATUS };
