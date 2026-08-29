// ROADMAP: "Booking → [containers], BL → [containers]. Validação: count match?"
function containersMatch(bookingContainers = [], blContainers = []) {
	if (bookingContainers.length !== blContainers.length) {
		return false;
	}
	const bookingSet = new Set(bookingContainers);
	return blContainers.every((container) => bookingSet.has(container));
}

module.exports = { containersMatch };
