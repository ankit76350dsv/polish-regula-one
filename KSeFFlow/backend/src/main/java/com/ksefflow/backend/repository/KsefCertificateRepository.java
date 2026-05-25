package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefCertificate;
import com.ksefflow.backend.models.utils.KsefCertificateVerificationStatus;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

// Repository for the ksef_certificates collection.
public interface KsefCertificateRepository extends MongoRepository<KsefCertificate, String> {

    // All certificates for a tenant — used by the Certificate Manager page
    List<KsefCertificate> findByTenantIdOrderByCreatedAtDesc(String tenantId);

    // Active cert for a tenant — used to open KSeF sessions.
    // Expected to return at most one result (only one active=true cert per tenant).
    Optional<KsefCertificate> findByTenantIdAndActiveTrue(String tenantId);

    // Filter by verification status — used by the daily validation cron job
    // to find PENDING certs that need OCSP/CRL checking, and VERIFIED certs
    // that should be re-checked for expiry.
    List<KsefCertificate> findByVerificationStatus(KsefCertificateVerificationStatus status);

    // Expiry-alert query for the background job:
    // "find all VERIFIED certs for this tenant" — service layer filters by validTo
    List<KsefCertificate> findByTenantIdAndVerificationStatus(String tenantId, KsefCertificateVerificationStatus status);

    // Count of certificates per tenant — guards the delete operation
    // (frontend prevents deleting the last certificate)
    long countByTenantId(String tenantId);
}
