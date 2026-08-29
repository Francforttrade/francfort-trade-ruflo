// ROADMAP: Firestore collection `falhas_processamento`, campos FTR, agent,
// error_msg, timestamp, retry_count.
function buildDlqEntry({ ftrCode, agent, errorMsg, retryCount }) {
	return {
		ftr_code: ftrCode,
		agent,
		error_msg: errorMsg,
		timestamp: new Date().toISOString(),
		retry_count: retryCount,
	};
}

module.exports = { buildDlqEntry };
