// Matches config/schemas.json FTR.ftr_code pattern: "03075-26", "03075-26-1".
const FTR_VERSION_REGEX = /^(\d{5}-\d{2})(?:-(\d+))?$/;

// ROADMAP: "Versioning (FTR 03075-26, 03075-26-1, 03075-26-2)".
function nextFtrVersion(ftrCode) {
	const match = typeof ftrCode === 'string' && ftrCode.match(FTR_VERSION_REGEX);
	if (!match) {
		throw new Error(`FTR code inválido para versionamento: ${ftrCode}`);
	}

	const [, base, suffix] = match;
	const nextSuffix = suffix ? parseInt(suffix, 10) + 1 : 1;
	return `${base}-${nextSuffix}`;
}

module.exports = { nextFtrVersion };
