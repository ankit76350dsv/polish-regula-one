package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.Transfer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Database access for third-country transfer records ({@link Transfer}, Art. 44–49).
 *
 * The transfer feature itself is not wired up yet — this repository exists so the
 * Vendor service can check "is this processor still used by a transfer?" before it
 * lets a vendor be deleted (referential integrity). When the full Transfer API is
 * built, its finders can be added here.
 */
@Repository
public interface TransferRepository extends MongoRepository<Transfer, String> {

    // True if a live transfer in this company still points at the given vendor. Used
    // to block deleting a processor that a transfer record still depends on.
    boolean existsByTenantIdAndVendorIdAndDeletedFalse(String tenantId, String vendorId);
}
