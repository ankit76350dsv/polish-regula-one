package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Breach;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for personal-data breach cases ({@link Breach}, Art. 33–34 GDPR).
 *
 * Every finder is scoped by tenantId so one company can never read another's breach
 * register. Breaches are accountability evidence (Art. 33(5)) kept for the long term;
 * there is no hard delete — the {@code deletedFalse} guard is defensive only.
 */
@Repository
public interface BreachRepository extends MongoRepository<Breach, String> {

    // All breaches for one company, most recently RECORDED first (stable ordering that
    // does not jump around when a remediation item is ticked).
    List<Breach> findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(String tenantId);

    // One breach, but only if it belongs to this company (else empty → 404).
    Optional<Breach> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);
}
