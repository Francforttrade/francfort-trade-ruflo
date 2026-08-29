// ROADMAP: "valida formato (ITAU123ABC456XYZ)" — 4-letter bank code, 3-digit
// segment, 3-letter segment, 3-digit segment, 3-letter reference tail.
const SWIFT_REFERENCE_REGEX = /^[A-Z]{4}\d{3}[A-Z]{3}\d{3}[A-Z]{3}$/;

function isValidSwiftReference(swiftReference) {
	return typeof swiftReference === 'string' && SWIFT_REFERENCE_REGEX.test(swiftReference);
}

module.exports = { SWIFT_REFERENCE_REGEX, isValidSwiftReference };
