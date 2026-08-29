const express = require('express');
const master = require('../orchestrator/master');
const logger = require('../utils/logger');

const router = express.Router();

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
		const result = await master.route({ ...req.body, targetAgent: 'comunicacao' });
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
