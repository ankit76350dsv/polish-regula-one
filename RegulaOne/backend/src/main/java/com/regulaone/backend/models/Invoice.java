package com.regulaone.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// Immutable financial record created whenever a tenant is assigned a plan.
// Stored in its own collection so billing history can be queried and exported
// independently from tenant configuration data.
//
// Invoice number format: INV-YYYY-NNNN (global sequence, padded to 4 digits)
// Currency: ISO 4217 code stored with each record so historical invoices are
//           unaffected if the platform later supports multiple currencies.
@Document(collection = "plan_invoices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Invoice {

    @Id
    private String id;

    // @DBRef links to the tenant this invoice belongs to.
    // Allows future cross-tenant financial reporting without embedding tenant data.
    @DBRef
    private Tenant tenant;

    // Human-readable invoice reference shown in the UI and on downloaded PDFs.
    private String invoiceNumber;

    // Package name snapshotted at invoice creation time.
    // The AppPackage document may be renamed or deleted later — the invoice must
    // always reflect what the tenant actually purchased.
    private String packageName;

    private BigDecimal amount;

    @Builder.Default
    private String currency = "EUR";

    private InvoiceStatus status;

    // Billing period — the window of service this invoice covers.
    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
