package com.privacypilot.backend.config;

import com.privacypilot.backend.model.document.AuditEntry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.IndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Creates the database indexes this app needs, once, when the app starts.
 *
 * WHY THIS CLASS IS NECESSARY (and not just the annotations):
 * The {@code @Indexed} and {@code @CompoundIndex} notes on the model classes are only a
 * DESCRIPTION of the indexes we want. Spring Data stopped creating them automatically some
 * versions ago — {@code spring.data.mongodb.auto-index-creation} defaults to OFF — so those
 * notes had never actually produced an index in the database. Every audit query was
 * therefore reading the whole collection and sorting it in memory, which is exactly the
 * failure this fixes (MongoDB refuses to sort more than 32 MB that way, and the trail is
 * kept for ten years).
 *
 * WHY NOT JUST SWITCH THE SETTING ON: this app shares one database cluster with the rest of
 * the RegulaOne platform. Turning on blanket auto-creation would let start-up build indexes
 * for anything that happens to be annotated, whenever it changes. Doing it here instead
 * means the list is explicit, reviewable, and logged.
 *
 * SAFE TO RUN EVERY TIME: {@code ensureIndex} does nothing when the index already exists,
 * so a restart is harmless. It runs AFTER the app is ready, so a slow index build on a big
 * collection cannot delay start-up or hold up health checks. If creation fails (for example
 * the database user lacks the right), the error is logged loudly and the app keeps running
 * — a missing index makes queries slow, but refusing to start would take the service down
 * completely, which is worse.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MongoIndexConfig {

    private final MongoTemplate mongoTemplate;

    // Every document class whose indexes we want created. Add new collections here.
    private static final List<Class<?>> INDEXED_DOCUMENTS = List.of(AuditEntry.class);

    @EventListener(ApplicationReadyEvent.class)
    public void createIndexes() {
        MappingContext<? extends MongoPersistentEntity<?>, MongoPersistentProperty> mapping =
                mongoTemplate.getConverter().getMappingContext();
        IndexResolver resolver = new MongoPersistentEntityIndexResolver(mapping);

        for (Class<?> documentType : INDEXED_DOCUMENTS) {
            IndexOperations indexOps = mongoTemplate.indexOps(documentType);
            for (IndexDefinition index : resolver.resolveIndexFor(documentType)) {
                try {
                    // Already there → no-op. Missing → created (in the background on a
                    // replica set, so live traffic keeps working while it builds).
                    indexOps.createIndex(index);
                    log.info("[MongoIndexConfig] index ready on {}: {}",
                            documentType.getSimpleName(), index.getIndexKeys().toJson());
                } catch (RuntimeException e) {
                    // Never take the service down over an index. Log it so it gets fixed.
                    log.error("[MongoIndexConfig] COULD NOT create index on {} ({}): {} — "
                                    + "audit queries will be slow until this is resolved",
                            documentType.getSimpleName(), index.getIndexKeys().toJson(),
                            e.getMessage());
                }
            }
        }
    }
}
