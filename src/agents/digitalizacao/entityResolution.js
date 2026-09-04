const { randomUUID } = require('crypto');
const logger = require('../../utils/logger');
const { supabase, TABLES } = require('../../services/supabase');

// docs/RDIA_PRD.md §11 — which extracted field is this doc type's natural
// entity id, and which table already owns that id as its primary key.
const ENTITY_LOOKUP_BY_DOC_TYPE = {
	BL: { entityType: 'bl', idField: 'bl_number', table: TABLES.BL_DOCUMENTS, idColumn: 'bl_number' },
	Invoice: { entityType: 'invoice', idField: 'invoice_number', table: TABLES.INVOICES, idColumn: 'invoice_number' },
	SWIFT: { entityType: 'payment', idField: 'swift_ref', table: TABLES.PAYMENTS, idColumn: 'swift_reference' },
};

// Pure: given whatever row (if any) already exists for this entity id, is
// this a brand new entity (no row yet — the normal case for a document that
// arrived before its siblings), one that agrees with the FTR the document
// came in under, or one that's tied to a *different* FTR (a real conflict,
// e.g. the same BL number reused/misread across two different shipments)?
function classifyEntityMatch(existingRow, ftrCode) {
	if (!existingRow) {
		return 'new';
	}
	return existingRow.ftr_code === ftrCode ? 'confirmed' : 'ambiguous';
}

async function resolveEntity({ ftrCode, classifiedDocType, extractedFields }) {
	const lookup = ENTITY_LOOKUP_BY_DOC_TYPE[classifiedDocType];
	const entityId = lookup ? (extractedFields || {})[lookup.idField] : null;

	if (!lookup || !entityId) {
		return null;
	}

	const { data, error } = await supabase.from(lookup.table).select(`${lookup.idColumn}, ftr_code`).eq(lookup.idColumn, entityId).maybeSingle();

	// A query error (network blip, transient DB issue) is inconclusive, not
	// evidence this is a new entity — same reasoning as crossValidation.js's
	// checkFtrExists. Treating it as 'new' would persist a confident
	// BELONGS_TO relationship from a lookup that never actually happened,
	// potentially masking a real cross-FTR conflict that a retry would have
	// caught.
	if (error) {
		logger.warn('DIGITALIZACAO: falha ao consultar entidade para resolução, tratando como inconclusivo', {
			ftrCode,
			entityType: lookup.entityType,
			entityId,
			error: error.message,
		});
		return {
			relationship_id: randomUUID(),
			source_entity: { type: lookup.entityType, id: entityId },
			relationship: 'BELONGS_TO',
			target_entity: { type: 'ftr', id: ftrCode },
			confidence: 0,
			status: 'unknown',
			persisted: false,
		};
	}

	const status = classifyEntityMatch(data, ftrCode);
	const relationship = {
		relationship_id: randomUUID(),
		source_entity: { type: lookup.entityType, id: entityId },
		relationship: 'BELONGS_TO',
		target_entity: { type: 'ftr', id: ftrCode },
		confidence: status === 'confirmed' ? 1 : status === 'new' ? 0.6 : 0,
		status,
	};

	// An ambiguous match is a conflict to surface (see errorCodes.js's
	// ENTITY_AMBIGUOUS), never silently recorded as if it were resolved.
	relationship.persisted = false;
	if (status !== 'ambiguous') {
		const { error: insertError } = await supabase.from(TABLES.DOCUMENT_RELATIONSHIPS).insert({
			relationship_id: relationship.relationship_id,
			source_type: relationship.source_entity.type,
			source_id: relationship.source_entity.id,
			relationship: relationship.relationship,
			target_type: relationship.target_entity.type,
			target_id: relationship.target_entity.id,
			confidence: relationship.confidence,
		});

		if (insertError) {
			// The resolution itself (status/confidence) is still valid and
			// returned below — only the persistence to document_relationships
			// failed — but silently swallowing this would let the entity graph
			// silently miss edges with no trace anywhere.
			logger.warn('DIGITALIZACAO: falha ao gravar document_relationships', {
				ftrCode,
				entityType: lookup.entityType,
				entityId,
				error: insertError.message,
			});
		} else {
			relationship.persisted = true;
		}
	}

	return relationship;
}

module.exports = { resolveEntity, classifyEntityMatch };
