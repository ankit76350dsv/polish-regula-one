package com.ksefflow.backend.models;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

// A PURCHASE invoice — one that another company issued to THIS tenant and that we pulled down
// from KSeF (faktura otrzymana). From 1 Feb 2026 every taxpayer must be able to receive these,
// even if they never issue invoices themselves.
//
// We store the metadata (so the user can browse a list quickly) plus, once requested, the full
// invoice XML — encrypted at rest (AES-256-GCM) just like outgoing invoices and UPOs.
//
// Legal retention: 10 years (Polish VAT Act, Art. 112). Never hard-delete — use softDeleted.
@Document(collection = "ksef_received_invoices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
// One row per (tenant, KSeF number). Unique so syncing twice never creates duplicates.
@CompoundIndex(def = "{'tenantId': 1, 'ksefNumber': 1}", unique = true)
public class KsefReceivedInvoice {

    @Id
    private String id;

    // ── Multi-tenancy ──────────────────────────────────────────────────────────
    @Indexed
    private String tenantId;

    // ── Identity (from KSeF metadata) ──────────────────────────────────────────

    // The permanent KSeF number assigned to the invoice — the key we use to fetch the XML.
    private String ksefNumber;

    // The seller's own invoice number (e.g. "FV/2026/06/0007").
    private String invoiceNumber;

    // Kept as the raw ISO strings KSeF returns (they may include a time/zone) to avoid lossy parsing.
    private String issueDate;
    private String acquisitionDate;

    // ── Parties ─────────────────────────────────────────────────────────────────
    private String sellerNip;
    private String sellerName;
    private String buyerIdentifier; // usually this tenant's NIP
    private String buyerName;

    // ── Money ────────────────────────────────────────────────────────────────────
    private BigDecimal netAmount;
    private BigDecimal vatAmount;
    private BigDecimal grossAmount;
    private String currency;

    // ── Classification ─────────────────────────────────────────────────────────
    private String invoiceType;   // Vat / Kor / Zal …
    private String invoicingMode; // Online / Offline
    private boolean selfInvoicing;
    private boolean hasAttachment;

    // ── Full document (filled in on demand) ──────────────────────────────────────

    // The full invoice XML, AES-256-GCM encrypted then Base64-encoded. Null until first fetched.
    private String xmlContentEncrypted;
    // SHA-256 of the plaintext XML — lets auditors verify integrity without decrypting.
    private String xmlHash;

    // ── Bookkeeping ──────────────────────────────────────────────────────────────
    private String ksefEnvironment;
    private LocalDateTime fetchedAt; // when the metadata was synced from KSeF

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt;

    @Builder.Default
    private boolean softDeleted = false;
    private LocalDateTime deletedAt;
}
