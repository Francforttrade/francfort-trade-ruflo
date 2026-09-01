require('dotenv').config();

const express = require('express');
const logger = require('./src/utils/logger');
const routes = require('./src/routes');

// Google Cloud client libraries (Firestore included) can reject an internal
// promise that our own try/catch never sees (e.g. parallel credential-lookup
// strategies in google-auth-library). Node terminates the process on any
// unhandled rejection since v15, which would take down in-flight requests
// too — log and keep the server alive instead.
process.on('unhandledRejection', (reason) => {
	logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : reason });
});

const app = express();
const port = process.env.PORT || 3000;

// Express's default json() body limit is 100kb. The Gmail Apps Script intake
// (apps-script/gmail-sync) embeds attachments up to 3MB as base64 in the
// webhook payload, which inflates by ~33% plus JSON overhead — well past the
// default and rejected with a 413 before it ever reaches our routes.
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.use(routes);

app.listen(port, () => {
	logger.info(`Ruflo server listening on port ${port}`);
});