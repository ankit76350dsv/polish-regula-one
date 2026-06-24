package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefEnvironment;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.models.utils.KsefOfflineMode;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefPaymentStatus;
import com.ksefflow.backend.models.utils.KsefUpoStatus;
import com.ksefflow.backend.models.utils.KsefVatRate;


import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

// Core e-invoice document for the KSeFFlow module.
//
// Each invoice maps to a single FA(3)-schema XML submission to the Polish KSeF API.
// The document stores both the business data (buyer/seller/items) and the full
// KSeF submission state (ksefId, UPO reference, retry metadata, offline fallback).
//
// Multi-tenancy: every query MUST filter by tenantId.
// KSeFFlow is a separate service from RegulaOne; tenantId is a plain String
// referencing the MongoDB document ID managed by the RegulaOne auth service.
//
// Legal retention requirement: 10 years (Polish VAT Act, Art. 112).
// Do NOT hard-delete invoices — use a softDeleted flag when needed.
//
// FA(3) format number: FV/YYYY/MM/SEQUENCE  e.g. FV/2026/05/0001
@Document(collection = "ksef_invoices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
// Compound index speeds up the tenant-scoped list query (GET /invoices?tenantId=X&status=Y)
@CompoundIndex(def = "{'tenantId': 1, 'status': 1, 'createdAt': -1}")
public class KsefInvoice {

    @Id
    private String id;

    // ── Multi-tenancy ──────────────────────────────────────────────────────────

    // References Tenant._id in the RegulaOne service (String, not @DBRef — separate service)
    @Indexed
    private String tenantId;

    // ── Invoice identity ───────────────────────────────────────────────────────

    // FA(3)-compliant invoice number: FV/YYYY/MM/SEQUENCE — unique within tenant
    @Indexed
    private String invoiceNumber;

    private LocalDate issueDate;
    private LocalDate dueDate;

    // ── Seller (snapshotted from tenant at creation time) ──────────────────────
    // Snapshot is required: tenant address/name may change, but issued invoices
    // must preserve the exact seller details as at the time of issue.

    private String sellerName;
    private String sellerNip;       // Polish tax ID — 10 digits, no dashes
    private String sellerAddress;
    private String sellerPostalCode;
    private String sellerCity;

    // ── Buyer ─────────────────────────────────────────────────────────────────

    private String buyerName;
    private String buyerNip;        // Polish tax ID of the purchasing entity
    private String buyerAddress;
    private String buyerPostalCode;
    private String buyerCity;

    // ── Financials ────────────────────────────────────────────────────────────

    // Default PLN — legally required reporting currency for Polish VAT
    @Builder.Default
    private KsefCurrency currency = KsefCurrency.PLN;

    // The money rate to change a foreign currency into PLN. Only used (and required by
    // KSeF) when the invoice is NOT in PLN. Goes into the FA(3) field KursWalutyZ.
    private BigDecimal exchangeRate;

    // The law text that says why the sale has no VAT (is exempt). Must be filled when the
    // invoice has any exempt (zw) line. Goes into the FA(3) field P_19A.
    private String exemptionLegalBasis;

    // All monetary values use BigDecimal to prevent floating-point rounding errors
    // in VAT calculations (required by Polish accounting law).
    private BigDecimal totalNet;
    private BigDecimal totalVat;
    private BigDecimal totalGross;

    private KsefPaymentMethod paymentMethod;

    // IBAN format bank account — required when paymentMethod == SPLIT_PAYMENT
    private String bankAccount;

    @Builder.Default
    private KsefPaymentStatus paymentStatus = KsefPaymentStatus.UNPAID;

    private String notes;

    // ── Line items ─────────────────────────────────────────────────────────────
    // Embedded (not a separate collection) — items only exist in the context of
    // their parent invoice and are always loaded together.

    @Builder.Default
    private List<InvoiceItem> items = new ArrayList<>();

    // ── KSeF submission state ──────────────────────────────────────────────────

    @Builder.Default
    private KsefInvoiceStatus status = KsefInvoiceStatus.DRAFT;

    // Full ordered timeline of every status change this invoice went through
    // (DRAFT → PENDING → SENT → ...), each entry with its own timestamp and a short note.
    // Appended via recordStatus(...) at every transition and NEVER edited or removed, so the
    // complete lifecycle is preserved for audit and can be shown in the UI.
    @Builder.Default
    private List<StatusHistoryEntry> statusHistory = new ArrayList<>();

    // Official KSeF reference ID returned after successful submission.
    // Format: {sellerNIP}-{YYYYMMDD}-{16-char hex token}
    // Null until status transitions to SENT.
    private String ksefId;

    @Builder.Default
    private KsefUpoStatus upoStatus = KsefUpoStatus.NONE;

    // Timestamp from the UPO XML document issued by KSeF — legally significant
    private LocalDateTime upoTimestamp;

    // Reference ID of the KsefUpoDocument stored in encrypted S3 storage
    private String upoDocumentId;

    // ── Offline fallback / compliance ──────────────────────────────────────────

    // Which offline mode the invoice was issued under — drives the legal submission
    // deadline (offline24 / KSeF-unavailability → next business day; emergency → 7 business days).
    private KsefOfflineMode offlineMode;

    // When the invoice was FIRST issued offline — legally significant. Set once, never
    // overwritten on subsequent retries, and RETAINED after the invoice is later registered.
    private LocalDateTime offlineIssuedAt;

    // Legal deadline by which this invoice must be accepted by KSeF. The retry job must
    // succeed before this; a breach is a compliance exposure and must be escalated.
    private LocalDateTime ksefSubmissionDeadline;

    // CODE I QR ("OFFLINE") — lets the buyer verify the invoice CONTENT in KSeF once it is
    // uploaded (encodes the FA(3) XML hash + MF verification link). Retained for audit.
    private String qrCodeInvoice;

    // CODE II QR ("CERTYFIKAT") — certificate seal proving the ISSUER's identity BEFORE the
    // invoice reaches KSeF. Sealed server-side with the tenant's KSeF certificate. Retained.
    private String qrCodeCertificate;

    // Total number of times this invoice has been submitted or retried.
    // Used by the retry scheduler to enforce exponential backoff limits.
    @Builder.Default
    private int submissionAttempts = 0;

    // Last HTTP error or KSeF rejection message — displayed in the Offline Queue UI
    private String lastErrorMessage;

    // Timestamp of the most recent retry attempt — used for backoff calculations
    private LocalDateTime lastRetryAt;

    // COMPUTED, NOT STORED: the earliest time the automatic retry job will next try to send this
    // invoice to KSeF (lastRetryAt + exponential backoff). Populated on the read path for
    // OFFLINE_MODE/RETRYING invoices so the Offline Queue can show "next automatic retry at …".
    @org.springframework.data.annotation.Transient
    private LocalDateTime nextRetryAt;

    // ── Correction (faktura korygująca, FA(3) RodzajFaktury = KOR) ──────────────
    // When true, this invoice CORRECTS an earlier invoice. The fields below point at the
    // original invoice and explain the correction — they fill the FA(3) DaneFaKorygowanej
    // block (DataWystFaKorygowanej / NrFaKorygowanej / NrKSeFFaKorygowanej), PrzyczynaKorekty
    // and TypKorekty. A normal invoice leaves correction=false and these fields null.
    @Builder.Default
    private boolean correction = false;

    // Our own id of the original invoice being corrected (internal link, not sent to KSeF).
    private String correctedInvoiceId;

    // The KSeF number of the original invoice (FA(3) NrKSeFFaKorygowanej).
    private String correctedKsefNumber;

    // The original invoice's number / P_2 (FA(3) NrFaKorygowanej).
    private String correctedInvoiceNumber;

    // The original invoice's issue date (FA(3) DataWystFaKorygowanej).
    private LocalDate correctedIssueDate;

    // Why the invoice is being corrected (FA(3) PrzyczynaKorekty).
    private String correctionReason;

    // KSeF correction type: 1, 2 or 3 (FA(3) TypKorekty). Optional.
    private Integer correctionType;

    // ── XML compliance ─────────────────────────────────────────────────────────

    // SHA-256 of the FA(3) XML submitted to KSeF — stored for tamper-evidence audit.
    // Recalculate on demand and compare against this hash to detect corruption.
    private String fa3XmlHash;

    // Encrypted S3 path where the generated FA(3) XML is archived.
    // Must be retained for 10 years per Polish tax law.
    private String fa3XmlStoragePath;

    // ── KSeF API metadata ──────────────────────────────────────────────────────

    // Which environment was active when the invoice was submitted —
    // SANDBOX submissions have no legal effect and must never appear in tax records.
    private KsefEnvironment ksefEnvironment;

    // Timestamps for the full submission round-trip — stored for SLA measurement
    private LocalDateTime submittedToKsefAt;
    private LocalDateTime receivedFromKsefAt;

    // ── Ownership & audit ──────────────────────────────────────────────────────

    // References User._id in the RegulaOne service
    private String createdByUserId;
    private String lastModifiedByUserId;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt;

    // Soft delete — never hard-delete invoices (10-year legal retention)
    @Builder.Default
    private boolean softDeleted = false;

    private LocalDateTime deletedAt;

    // ── Status history helper ───────────────────────────────────────────────────

    /**
     * Records a status change in ONE place: updates the current status, stamps updatedAt,
     * and APPENDS an immutable entry to {@link #statusHistory} so the full lifecycle timeline
     * (DRAFT → PENDING → SENT → ...) is preserved. Call this instead of {@code setStatus(...)}
     * at every real transition.
     *
     * @param newStatus the status the invoice is moving into
     * @param note      short human-readable reason (e.g. "Submitted to KSeF")
     * @param changedBy who triggered it — a user email, or "SYSTEM" for automated jobs
     */
    public void recordStatus(KsefInvoiceStatus newStatus, String note, String changedBy) {
        LocalDateTime now = LocalDateTime.now();
        this.status = newStatus;
        this.updatedAt = now;
        if (this.statusHistory == null) {
            this.statusHistory = new ArrayList<>();
        }
        this.statusHistory.add(StatusHistoryEntry.builder()
                .status(newStatus)
                .timestamp(now)
                .note(note)
                .changedBy(changedBy)
                .build());
    }

    // ── Embedded: one status-change record ─────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusHistoryEntry {

        // The status the invoice moved INTO at this point in time.
        private KsefInvoiceStatus status;

        // When the change happened.
        private LocalDateTime timestamp;

        // Short human-readable reason for the change (e.g. "Accepted by KSeF").
        private String note;

        // Who caused it — a user email, or "SYSTEM" for automated transitions (e.g. the retry job).
        private String changedBy;
    }

    // ── Embedded: invoice line item ───────────────────────────────────────────

    // Static inner class keeps InvoiceItem scoped to KsefInvoice.
    // Mirror of how PackageDetails/PackageHistory are embedded in Tenant.
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InvoiceItem {

        // Client-generated UUID used for React key prop and partial-update targeting
        private String itemId;

        private String productName;

        // BigDecimal quantity supports fractional units (e.g., 1.5 hours)
        @Builder.Default
        private BigDecimal quantity = BigDecimal.ONE;

        // Net price per unit — before VAT
        private BigDecimal unitPrice;

        @Builder.Default
        private KsefVatRate vatRate = KsefVatRate.VAT_23;

        // Computed fields — stored (not recalculated) so historical invoices
        // remain accurate if VAT rates are legislated to change.
        private BigDecimal netAmount;   // unitPrice × quantity
        private BigDecimal vatAmount;   // netAmount × vatRate.getMultiplier()
        private BigDecimal grossAmount; // netAmount + vatAmount

        // Optional fields aligned with FA(3) schema
        // Polish unit of measure e.g. "szt." (pieces), "godz." (hours), "kg"
        private String unit;

        // PKWiU goods/services classification code — required for some VAT rates in FA(3)
        private String pkwiuCode;
    }
}
