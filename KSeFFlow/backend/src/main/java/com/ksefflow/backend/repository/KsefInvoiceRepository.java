package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

// Repository for the ksef_invoices collection.
// All methods that accept tenantId enforce multi-tenancy at the query level.
public interface KsefInvoiceRepository extends MongoRepository<KsefInvoice, String> {

    // ── Paginated list with filter ─────────────────────────────────────────────

    // All invoices for a tenant, newest first — default document repository view
    Page<KsefInvoice> findByTenantIdOrderByCreatedAtDesc(String tenantId, Pageable pageable);

    // Filter by status — used by the status-filter dropdown in Invoice Repository
    Page<KsefInvoice> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, KsefInvoiceStatus status, Pageable pageable);

    // Full-text style search on invoice number and buyer fields — used by the search bar
    Page<KsefInvoice> findByTenantIdAndInvoiceNumberContainingIgnoreCaseOrderByCreatedAtDesc(String tenantId, String invoiceNumber, Pageable pageable);

    // ── Offline retry queue ────────────────────────────────────────────────────

    // Returns all invoices in OFFLINE_MODE for a tenant — the retry scheduler consumes this
    List<KsefInvoice> findByTenantIdAndStatus(String tenantId, KsefInvoiceStatus status);

    // Same query platform-wide — used by the SuperAdmin overview and global retry cron
    List<KsefInvoice> findByStatus(KsefInvoiceStatus status);

    // ── Lookup by government reference ────────────────────────────────────────

    // Resolve KSeF ID back to invoice — used when processing UPO callbacks from KSeF
    Optional<KsefInvoice> findByTenantIdAndKsefId(String tenantId, String ksefId);

    // ── Uniqueness check ──────────────────────────────────────────────────────

    // Prevent duplicate invoice numbers within the same tenant
    boolean existsByTenantIdAndInvoiceNumber(String tenantId, String invoiceNumber);

    // Resolve an existing invoice by tenant + number — used by create-draft to
    // decide whether to update an existing DRAFT or reject a finalized duplicate.
    Optional<KsefInvoice> findByTenantIdAndInvoiceNumber(String tenantId, String invoiceNumber);

    // ── Aggregation helpers ────────────────────────────────────────────────────

    // Count per status — used by the Dashboard metric cards
    long countByTenantIdAndStatus(String tenantId, KsefInvoiceStatus status);

    // Total invoice count for a tenant — used in the stats bar
    long countByTenantId(String tenantId);
}
