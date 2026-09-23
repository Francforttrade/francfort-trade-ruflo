// ADR-001A PoC — TEST-04 standalone Worker process entry point.
//
// This file exists so a real, killable OS-level child process can host a
// Temporal Worker (an in-process Worker object cannot meaningfully
// simulate "the Worker process was killed"). It calls worker.run() ONLY
// when executed directly as its own process (`node runPocWorkerProcess.js`)
// — the `require.main === module` guard below means merely require()-ing
// this file (e.g. for static inspection) never calls run() or
// createPocWorker(). Not executed in this step.

const { createPocWorker } = require('../worker/complianceWorker');

async function main() {
	const worker = await createPocWorker();
	await worker.run();
}

if (require.main === module) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}

module.exports = { main };
