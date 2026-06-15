package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefGovernmentSession;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

// Repository for the ksef_government_sessions collection.
// One document per tenant — upserted on every session open/close.
public interface KsefGovernmentSessionRepository extends MongoRepository<KsefGovernmentSession, String> {

    // Primary lookup — retrieve the current session record for a tenant
    Optional<KsefGovernmentSession> findByTenantId(String tenantId);

    // Check if a tenant currently has an active session — used before invoice submission
    boolean existsByTenantIdAndActiveTrue(String tenantId);
}
