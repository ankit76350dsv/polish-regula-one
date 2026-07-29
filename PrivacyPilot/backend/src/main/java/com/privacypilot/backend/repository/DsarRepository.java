package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Dsar;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for data-subject requests ({@link Dsar}, Art. 15–22 GDPR).
 *
 * Every finder is scoped by tenantId so one company can never read another's requests.
 * A DSAR is evidence that a right was handled on time, so there is no hard delete —
 * the {@code deletedFalse} guard is defensive only.
 */
@Repository
public interface DsarRepository extends MongoRepository<Dsar, String> {

    // All requests for one company, most recently recorded first.
    List<Dsar> findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(String tenantId);

    // One request, but only if it belongs to this company (else empty → 404).
    Optional<Dsar> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);
}
