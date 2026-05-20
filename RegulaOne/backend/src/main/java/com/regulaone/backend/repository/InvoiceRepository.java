package com.regulaone.backend.repository;

import com.regulaone.backend.models.Invoice;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

// Repository for the invoices collection.
// Spring Data derives all queries from method names — no manual query writing needed.
public interface InvoiceRepository extends MongoRepository<Invoice, String> {

    // Returns all invoices for a tenant, newest first — used by GET /api/admin/billing.
    // Matches on the tenant's MongoDB document id via the @DBRef field.
    List<Invoice> findByTenant_IdOrderByCreatedAtDesc(String tenantId);
}
