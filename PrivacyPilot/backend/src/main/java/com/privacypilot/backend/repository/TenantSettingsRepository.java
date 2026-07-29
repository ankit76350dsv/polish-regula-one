package com.privacypilot.backend.repository;

import com.privacypilot.backend.model.document.TenantSettings;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Database access for the per-company PrivacyPilot settings ({@link TenantSettings}).
 *
 * There is exactly ONE settings document per tenant (the company legal identity, the
 * DPO contact, and the AI preferences). The lookup is therefore by tenantId, and the
 * service creates the row on first save.
 */
@Repository
public interface TenantSettingsRepository extends MongoRepository<TenantSettings, String> {

    // The one settings row for a company (empty until it is first saved).
    Optional<TenantSettings> findByTenantIdAndDeletedFalse(String tenantId);
}
