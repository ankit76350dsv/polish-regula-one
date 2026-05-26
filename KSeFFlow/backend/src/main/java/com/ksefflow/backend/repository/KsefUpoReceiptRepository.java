package com.ksefflow.backend.repository;

import com.ksefflow.backend.models.KsefUpoReceipt;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

// Repository for the ksef_upo_receipts collection.
// UPO receipts are legal documents — queries filter by tenantId for isolation.
public interface KsefUpoReceiptRepository extends MongoRepository<KsefUpoReceipt, String> {

    Optional<KsefUpoReceipt> findByTenantIdAndInvoiceId(String tenantId, String invoiceId);

    Optional<KsefUpoReceipt> findByTenantIdAndKsefReferenceNumber(String tenantId, String ksefReferenceNumber);

    boolean existsByTenantIdAndInvoiceId(String tenantId, String invoiceId);
}
