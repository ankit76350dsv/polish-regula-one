package com.privacypilot.backend.model.document;

import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Checks that the audit trail really declares the indexes its queries depend on.
 *
 * WHY THIS TEST EARNS ITS KEEP: without a matching index, MongoDB has to gather every
 * matching row and sort it in memory, which it refuses to do past 32 MB — on a trail kept
 * for ten years that is a guaranteed outage, and it is exactly the bug being fixed. The
 * index shapes are easy to break by accident (get the field order wrong and the index stops
 * helping the sort), so they are pinned here.
 *
 * This reads the annotations through the same resolver the app uses at start-up, so no
 * database is needed.
 */
class AuditEntryIndexesTest {

    /** Resolve the index definitions declared on AuditEntry, exactly as start-up does. */
    private static List<Document> resolvedIndexKeys() {
        MongoMappingContext context = new MongoMappingContext();
        // Tell the mapper which types are plain VALUES (Instant, enums, ...) rather than
        // nested documents. The running app gets this from its Mongo auto-configuration; a
        // hand-built context needs it, or it tries to map Instant as an entity and fails.
        context.setSimpleTypeHolder(MongoCustomConversions.create(config -> { })
                .getSimpleTypeHolder());
        context.setInitialEntitySet(Set.of(AuditEntry.class));
        context.afterPropertiesSet();

        List<Document> keys = new ArrayList<>();
        for (IndexDefinition index : new MongoPersistentEntityIndexResolver(context)
                .resolveIndexFor(AuditEntry.class)) {
            keys.add(index.getIndexKeys());
        }
        return keys;
    }

    @Test
    @DisplayName("declares the company + newest-first index the default screen needs")
    void declaresTenantTimeIndex() {
        // Equality fields first, then the sort field — that order is what lets MongoDB read
        // the rows already in the right order and stop at the row limit.
        assertTrue(resolvedIndexKeys().contains(
                        new Document("tenantId", 1).append("deleted", 1).append("createdAt", -1)),
                () -> "missing tenant+time index; got " + resolvedIndexKeys());
    }

    @Test
    @DisplayName("declares the index for filtering by kind of record")
    void declaresTenantTypeTimeIndex() {
        assertTrue(resolvedIndexKeys().contains(new Document("tenantId", 1)
                        .append("deleted", 1).append("entityType", 1).append("createdAt", -1)),
                () -> "missing tenant+type+time index; got " + resolvedIndexKeys());
    }

    @Test
    @DisplayName("declares the index for one record's full history")
    void declaresTenantEntityTimeIndex() {
        assertTrue(resolvedIndexKeys().contains(new Document("tenantId", 1)
                        .append("deleted", 1).append("entityId", 1).append("createdAt", -1)),
                () -> "missing tenant+entity+time index; got " + resolvedIndexKeys());
    }

    @Test
    @DisplayName("declares the index for 'everything one person did'")
    void declaresActorTimeIndex() {
        assertTrue(resolvedIndexKeys().contains(
                        new Document("createdBy", 1).append("createdAt", -1)),
                () -> "missing actor+time index; got " + resolvedIndexKeys());
    }

    @Test
    @DisplayName("every multi-field audit index ends on createdAt, so the sort is index-backed")
    void everyCompoundIndexEndsOnCreatedAt() {
        List<Document> keys = resolvedIndexKeys();
        // 4 compound (declared on AuditEntry) + 2 single-field: {entityId} on this class and
        // the inherited {tenantId} from BaseDocument. Pinned so an accidental extra index on
        // this write-heavy collection is noticed — every index slows every insert.
        assertEquals(6, keys.size(),
                () -> "unexpected index count — review the shapes; got " + keys);
        for (Document key : keys) {
            // Single-field indexes are simple lookups, not sorts — nothing to check.
            if (key.size() == 1) {
                continue;
            }
            String last = key.keySet().stream().reduce((a, b) -> b).orElseThrow();
            assertEquals("createdAt", last,
                    () -> "index " + key.toJson() + " must end on createdAt to serve the sort");
        }
    }
}
