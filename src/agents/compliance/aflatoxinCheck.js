function isAflatoxinWithinLimit(labResultPpb, limitPpb) {
	if (labResultPpb == null || limitPpb == null) {
		return null;
	}
	return labResultPpb <= limitPpb;
}

module.exports = { isAflatoxinWithinLimit };
