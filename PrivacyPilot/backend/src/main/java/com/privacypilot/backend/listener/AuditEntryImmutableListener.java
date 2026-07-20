package com.privacypilot.backend.listener;

import com.privacypilot.backend.model.document.AuditEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * Makes the audit trail truly append-only at the DATABASE layer.
 *
 * The AuditService is careful to only ever insert, but the repository still
 * technically exposes save()/delete() and someone could call MongoTemplate
 * directly. This listener is the hard backstop: it runs for EVERY write to the
 * {@link AuditEntry} collection, no matter who triggered it, and:
 *   - blocks DELETE — an audit entry can never be removed;
 *   - blocks UPDATE — an existing entry can never be changed (this also stops a
 *     "soft delete", which is just an update setting the deleted flag).
 * A brand-new insert has no id yet, so it passes through untouched.
 *
 * This is what actually satisfies the "audit logs must be tamper-resistant / kept
 * for 10 years / never bypassed" rules — the guarantee no longer depends on every
 * caller behaving.
 */
@Component
@RequiredArgsConstructor
public class AuditEntryImmutableListener extends AbstractMongoEventListener<AuditEntry> {

    private final MongoTemplate mongoTemplate;

    // Runs just before an audit entry is written. If it already exists in the
    // database, this is an UPDATE attempt — which is not allowed.
    @Override
    public void onBeforeConvert(BeforeConvertEvent<AuditEntry> event) {
        AuditEntry entity = event.getSource();
        // A new insert has no id yet, so there is nothing to protect — let it save.
        if (entity != null && entity.getId() != null) {
            boolean alreadySaved = mongoTemplate.exists(
                    Query.query(Criteria.where("_id").is(entity.getId())),
                    AuditEntry.class);
            if (alreadySaved) {
                throw new UnsupportedOperationException(
                        "Audit entries are immutable and cannot be updated.");
            }
        }
    }

    // Runs just before any delete on the audit collection. Always refuse.
    @Override
    public void onBeforeDelete(BeforeDeleteEvent<AuditEntry> event) {
        throw new UnsupportedOperationException(
                "Audit entries are immutable and cannot be deleted.");
    }
}
