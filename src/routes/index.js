const express = require('express');
const master = require('../orchestrator/master');
const logger = require('../utils/logger');
const { requireWebhookSecret } = require('../middleware/webhookAuth');

const router = express.Router();

router.use(requireWebhookSecret);

router.post('/digest', async (req, res, next) => {
	try {
		const result = await master.route({ ...req.body, targetAgent: 'monitor' });
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/classificar-doc', async (req, res, next) => {
	try {
		const result = await master.route({ ...req.body, targetAgent: 'documentacao' });
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.get('/rastrear', async (req, res, next) => {
	try {
		const result = await master.route({ ...req.query, targetAgent: 'logistics' });
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/webhook-whatsapp', async (req, res, next) => {
	try {
		const result = await master.route({ ...req.body, channel: 'whatsapp', targetAgent: 'comunicacao' });
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.post('/webhook-gmail', async (req, res, next) => {
	try {
		// The Apps Script Gmail sync's "Testar conexão com o webhook" menu item
		// posts { ping: true } to verify the URL/secret without a real message
		// to process — answer it directly instead of routing a synthetic,
		// mostly-empty message through COMUNICACAO and writing a junk session.
		if (req.body && req.body.ping === true) {
			return res.json({ pong: true });
		}

		const result = await master.route({ ...req.body, channel: 'gmail', targetAgent: 'comunicacao' });
		res.json(result);
	} catch (err) {
		next(err);
	}
});

router.use((err, req, res, _next) => {
	logger.error('Erro ao processar rota', { path: req.path, error: err.message });
	res.status(500).json({ error: 'internal_error' });
});

module.exports = router;
