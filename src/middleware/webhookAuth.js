const crypto = require('crypto');

// Cloud Run's IAM auth can't authenticate external callers like WhatsApp or
// a Gmail Apps Script trigger (they can't mint a Google identity token), so
// the service runs publicly and this shared secret is the real access
// control instead — matches docs/ARQUITETURA.md's "Validar
// X-Webhook-Signature header" security control.
function requireWebhookSecret(req, res, next) {
	const expected = process.env.WEBHOOK_SHARED_SECRET;
	if (!expected) {
		return res.status(500).json({ error: 'webhook_secret_not_configured' });
	}

	const provided = req.get('X-Webhook-Secret') || '';
	const expectedBuffer = Buffer.from(expected);
	const providedBuffer = Buffer.from(provided);

	const matches =
		expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);

	if (!matches) {
		return res.status(401).json({ error: 'invalid_webhook_secret' });
	}

	return next();
}

module.exports = { requireWebhookSecret };
