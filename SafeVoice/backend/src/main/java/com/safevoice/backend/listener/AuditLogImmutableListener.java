package com.safevoice.backend.listener;

import com.safevoice.backend.model.document.AuditLog;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeDeleteEvent;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

/**
 * MongoDB event listener that enforces append-only immutability on {@link AuditLog}.
 * Blocks update operations (before conversion) and delete operations (before deletion).
 */
@Component
public class AuditLogImmutableListener extends AbstractMongoEventListener<AuditLog> {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Override
    public void onBeforeConvert(BeforeConvertEvent<AuditLog> event) {
        AuditLog entity = event.getSource();
        if (entity != null && entity.getId() != null) {
            // Prevent modifying an existing audit log entry
            boolean exists = mongoTemplate.exists(
                    Query.query(Criteria.where("_id").is(entity.getId())),
                    AuditLog.class
            );
            if (exists) {
                throw new UnsupportedOperationException("Audit logs are immutable and cannot be updated.");
            }
        }
    }

    @Override
    public void onBeforeDelete(BeforeDeleteEvent<AuditLog> event) {
        // Prevent deleting from the audit log collection
        throw new UnsupportedOperationException("Audit logs are immutable and cannot be deleted.");
    }
}
