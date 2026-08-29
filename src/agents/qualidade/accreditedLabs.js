// ROADMAP: "Validação: lab acreditado? (eurofins.com?)".
const ACCREDITED_LABS = ['Eurofins'];

function isAccreditedLab(labName) {
	return ACCREDITED_LABS.some((name) => (labName || '').toLowerCase() === name.toLowerCase());
}

module.exports = { ACCREDITED_LABS, isAccreditedLab };
