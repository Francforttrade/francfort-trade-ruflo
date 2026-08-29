#!/usr/bin/env bash
# Enables Firestore TTL policies per docs/FIRESTORE_SUPABASE.md.
# Requires the writer to set an `expire_at` Timestamp field on each document
# (created_at + the retention window below) — Firestore TTL deletes based on
# that field's value, not a fixed duration on the collection.
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?set GCP_PROJECT_ID}"

declare -A RETENTION_DAYS=(
	[ftr_processing]=7
	[booking_draft]=14
	[sessions]=3
	[temp_documents]=7
)

for collection in "${!RETENTION_DAYS[@]}"; do
	echo "Enabling TTL on ${collection}.expire_at (${RETENTION_DAYS[$collection]}d retention)"
	gcloud firestore fields ttls update expire_at \
		--collection-group="${collection}" \
		--enable-ttl \
		--project="${PROJECT_ID}"
done

# audit_log is retained 5 years for compliance — no TTL is configured for it.
