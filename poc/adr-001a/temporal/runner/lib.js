// ADR-001A PoC — shared test-runner helper for the frozen 10-test
// execution campaign (TEST_CONTRACT.md). Execution-time code only: not
// imported by any of the frozen definition-only files, does not modify
// them. Connects to the already-running local dev Temporal Server and
// the already-running shared PoC Worker on task queue
// 'adr001a-temporal-poc'.

const { Connection, Client } = require('@temporalio/client');
const { temporal } = require('@temporalio/proto');
const fs = require('fs');
const path = require('path');

const EventType = temporal.api.enums.v1.EventType;

const TASK_QUEUE = 'adr001a-temporal-poc';
const EVIDENCE_DIR = path.join(__dirname, 'evidence');

async function getClient() {
	const connection = await Connection.connect();
	return new Client({ connection });
}

function writeEvidence(testId, data) {
	if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
	const file = path.join(EVIDENCE_DIR, `${testId}.json`);
	fs.writeFileSync(file, JSON.stringify(data, null, 2));
	return file;
}

// Serializes a Temporal History object (payloads included, decoded as
// UTF-8 JSON where possible) into a compact, evidence-friendly array of
// {eventId, eventType, attrs} — avoids dumping raw protobuf Long/Buffer
// objects into the evidence JSON.
function summarizeHistory(history) {
	return (history.events || []).map((e) => ({
		eventId: e.eventId != null ? String(e.eventId) : undefined,
		eventType: EventType[e.eventType] || e.eventType,
		eventTime: e.eventTime,
	}));
}

// Decodes a Temporal `json/plain`-encoded Payload (as found on raw
// ActivityTaskScheduled.input / ActivityTaskCompleted.result payloads)
// back into its original JS value.
function decodeJsonPayload(payload) {
	if (!payload || !payload.data) return undefined;
	const buf = Buffer.isBuffer(payload.data) ? payload.data : Buffer.from(payload.data);
	return JSON.parse(buf.toString('utf8'));
}

module.exports = { getClient, TASK_QUEUE, writeEvidence, summarizeHistory, decodeJsonPayload, EventType, EVIDENCE_DIR };
