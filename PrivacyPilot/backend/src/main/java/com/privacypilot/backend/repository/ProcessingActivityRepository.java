package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.ProcessingActivity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for ROPA entries ({@link ProcessingActivity}).
 *
 * EVERY finder is scoped by tenantId and excludes soft-deleted rows, so one company
 * can never read another's register and "archived" (soft-deleted) entries stay out
 * of the live views while remaining on disk for the 10-year retention rule.
 */
@Repository
public interface ProcessingActivityRepository extends MongoRepository<ProcessingActivity, String> {

    // All live entries for one company, newest change first.
    List<ProcessingActivity> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    // One live entry, but only if it belongs to this company (else empty → 404).
    Optional<ProcessingActivity> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    // True if any live activity in this company still lists the given vendor in its
    // vendorIds (Mongo matches an array that contains the value). Used to block
    // deleting a processor that an activity still relies on (Art. 28 link).
    boolean existsByTenantIdAndVendorIdsAndDeletedFalse(String tenantId, String vendorId);

    // True if any live activity in this company still lists the given transfer in its
    // transferIds. Used to block deleting a transfer that an activity still relies on
    // (Art. 30(1)(e) link).
    boolean existsByTenantIdAndTransferIdsAndDeletedFalse(String tenantId, String transferId);
}
