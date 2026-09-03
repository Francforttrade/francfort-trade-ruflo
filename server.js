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
// (apps-script/gmail-sync) embeds attachments up to 3MB as base64 EACH, with
// no cap on how many one email can carry — an email with several attachments
// still blows past a 10mb limit (#22) once summed and base64-inflated by
// ~33%. 25mb leaves headroom under Cloud Run's own ~32MB request ceiling.
app.use(express.json({ limit: '25mb' }));

// A body that still exceeds the limit above throws before any route runs,
// so it never reaches routes/index.js's error handler — without this it
// falls through to Express's default handler, which returns a raw HTML
// error page instead of JSON (and gmail-sync only logs the HTML as-is).
app.use((err, req, res, next) => {
	if (err.type === 'entity.too.large') {
		logger.warn('Payload recusado por exceder o limite', { path: req.path, limit: err.limit, length: err.length });
		return res.status(413).json({ error: 'payload_too_large' });
	}
	return next(err);
});

app.get('/health', (req, res) => {
	res.json({ status: 'ok' });
});

app.use(routes);

app.listen(port, () => {
	logger.info(`Ruflo server listening on port ${port}`);
});