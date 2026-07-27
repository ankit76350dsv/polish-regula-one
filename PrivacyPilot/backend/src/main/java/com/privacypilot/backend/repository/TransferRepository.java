package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Transfer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Database access for third-country transfer records ({@link Transfer}, Art. 44–49).
 *
 * Every finder is scoped by tenantId and excludes soft-deleted rows, so one company
 * can never read another's transfers and "archived" ones stay out of the live views
 * while remaining on disk for the retention rules.
 */
@Repository
public interface TransferRepository extends MongoRepository<Transfer, String> {

    // All live transfers for one company, newest change first.
    List<Transfer> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    // One live transfer, but only if it belongs to this company (else empty → 404).
    Optional<Transfer> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    // True if a live transfer in this company still points at the given vendor. Used
    // to block deleting a processor that a transfer record still depends on.
    boolean existsByTenantIdAndVendorIdAndDeletedFalse(String tenantId, String vendorId);
}
