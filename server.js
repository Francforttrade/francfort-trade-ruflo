require('dotenv').config();

const express = require('express');
const logger = require('./src/utils/logger');
const routes = require('./src/routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.use(routes);

app.listen(port, () => {
	logger.info(`Ruflo server listening on port ${port}`);
});