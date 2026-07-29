package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Vendor;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for processors / sub-processors ({@link Vendor}, Art. 28 GDPR).
 *
 * Every finder is scoped by tenantId and excludes soft-deleted rows, so one company
 * can never read another's supplier list and "archived" vendors stay out of the live
 * views while remaining on disk for the retention rules.
 */
@Repository
public interface VendorRepository extends MongoRepository<Vendor, String> {

    // All live processors for one company, newest change first.
    List<Vendor> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    // One live processor, but only if it belongs to this company (else empty → 404).
    Optional<Vendor> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);
}
