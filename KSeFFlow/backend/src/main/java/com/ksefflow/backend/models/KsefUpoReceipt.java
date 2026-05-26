package com.ksefflow.backend.models;

import com.ksefflow.backend.models.utils.KsefEnvironment;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

// Urzędowe Poświadczenie Odbioru (UPO) — Official Receipt issued by the Polish KSeF.
//
// After a successful invoice submission, KSeF returns a UPO XML document that
// serves as legal proof the invoice was received by the government system.
// This document MUST be retained for 10 years (Polish VAT Act, Art. 112).
//
// Security: upoXmlEncrypted stores the UPO XML as AES-256-GCM ciphertext.
// The plaintext UPO is never stored at rest.
//
// Never hard-delete UPO receipts — they are legally required evidence.
@Document(collection = "ksef_upo_receipts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndex(def = "{'tenantId': 1, 'invoiceId': 1}", unique = true)
public class KsefUpoReceipt {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    // References KsefInvoice._id — one UPO per invoice
    @Indexed
    private String invoiceId;

    // The legally valid KSeF reference number for the submitted invoice.
    // Format: {sellerNIP}-{YYYYMMDD}-{16-char hex token}
    private String ksefReferenceNumber;

    // AES-256-GCM encrypted UPO XML received from the KSeF government API.
    // Decrypt with CertificateCryptoUtils using the tenant's encryption key.
    private String upoXmlEncrypted;

    // SHA-256 of the plaintext UPO XML — integrity check without decryption.
    // Verify before presenting to auditors.
    private String upoXmlHash;

    // Timestamp extracted from inside the UPO XML document itself —
    // this is the legally significant timestamp (not createdAt).
    private LocalDateTime upoTimestamp;

    // Which KSeF environment issued this UPO — SANDBOX receipts have no legal effect
    private KsefEnvironment environment;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
