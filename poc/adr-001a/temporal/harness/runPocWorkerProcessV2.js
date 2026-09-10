// ADR-001A PoC — TEST-10 "version B" standalone Worker process entry
// point. Identical structure/discipline to runPocWorkerProcess.js
// (require.main === module guard; no run()/createPocWorkerV2() call on
// require()) except it hosts complianceWorkerV2's Worker definition
// (workflows/indexV2.js bundle) instead of V1's.

const { createPocWorkerV2 } = require('../worker/complianceWorkerV2');

async function main() {
	const worker = await createPocWorkerV2();
	await worker.run();
}

if (require.main === module) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

module.exports = { main };
