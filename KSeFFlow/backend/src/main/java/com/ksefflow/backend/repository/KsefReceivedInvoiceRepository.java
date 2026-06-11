package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefReceivedInvoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

// Repository for the ksef_received_invoices collection (purchase invoices pulled from KSeF).
// Every method that takes tenantId enforces multi-tenancy at the query level.
public interface KsefReceivedInvoiceRepository extends MongoRepository<KsefReceivedInvoice, String> {

    // Paginated list for the "Received invoices" screen, newest issue date first.
    Page<KsefReceivedInvoice> findByTenantIdAndSoftDeletedFalseOrderByIssueDateDesc(String tenantId, Pageable pageable);

    // Look up one received invoice by its KSeF number, scoped to the tenant.
    Optional<KsefReceivedInvoice> findByTenantIdAndKsefNumber(String tenantId, String ksefNumber);

    // Used during sync to skip invoices we already stored (dedupe).
    boolean existsByTenantIdAndKsefNumber(String tenantId, String ksefNumber);

    // Count for dashboard tiles.
    long countByTenantIdAndSoftDeletedFalse(String tenantId);
}
