const crypto = require('crypto');

// Dedup key for the cache (chunk 2a) and an audit-correlation id — computed
// over the raw bytes, not the base64 text, so re-encoding the same file
// never changes the hash.
function computeContentHash(fileBase64) {
	if (!fileBase64) {
		return null;
	}
	return crypto.createHash('sha256').update(fileBase64, 'base64').digest('hex');
}

module.exports = { computeContentHash };
