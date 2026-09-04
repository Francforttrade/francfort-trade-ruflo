const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore({
	projectId: process.env.GCP_PROJECT_ID,
	databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
});

const COLLECTIONS = {
	SESSIONS: 'sessions',
	FTR_PROCESSING: 'ftr_processing',
	BOOKING_DRAFT: 'booking_draft',
	AUDIT_LOG: 'audit_log',
	TEMP_DOCUMENTS: 'temp_documents',
	FALHAS_PROCESSAMENTO: 'falhas_processamento',
	DIGITALIZACAO_CACHE: 'digitalizacao_cache',
	DIGITALIZACAO_RATE_LIMITS: 'digitalizacao_rate_limits',
};

module.exports = { firestore, COLLECTIONS };
