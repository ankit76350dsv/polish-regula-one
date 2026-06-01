package com.ksefflow.backend.services;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.models.KsefUpoReceipt;
import com.ksefflow.backend.repository.KsefUpoReceiptRepository;
import com.ksefflow.backend.services.certificate.CertificateCryptoUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

// Stores and retrieves Official Receipts (UPO) returned by the KSeF government API.
//
// A UPO (Urzędowe Poświadczenie Odbioru) is legal proof that the government received
// the invoice. It must be retained for 10 years (Polish VAT Act, Art. 112).
//
// Security: UPO XML is encrypted with AES-256-GCM before storage so the plaintext
// legal document is never persisted unprotected. The SHA-256 hash is stored alongside
// so auditors can verify integrity without needing to decrypt.
@Service
@RequiredArgsConstructor
@Slf4j
public class UPOStorageService {

    private final KsefUpoReceiptRepository ksef_upo_receipts_repo;
    private final CertificateCryptoUtils cryptoUtils;
    private final KsefApiProperties apiProperties;

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Encrypts and persists a UPO XML document received from KSeF.
     *
     * @param invoiceId           the KsefInvoice._id this UPO belongs to
     * @param tenantId            tenant scope
     * @param ksefReferenceNumber the legal KSeF reference returned with the UPO
     * @param upoXml              raw UPO XML from the government API
     * @param upoTimestamp        timestamp extracted from inside the UPO document
     * @return the saved KsefUpoReceipt._id — store as KsefInvoice.upoDocumentId
     */
    public String storeUpo(String invoiceId, String tenantId,
                           String ksefReferenceNumber, String upoXml,
                           LocalDateTime upoTimestamp) {

        log.info("Storing UPO for invoice [{}] tenant [{}] ksefRef [{}]",
                invoiceId, tenantId, ksefReferenceNumber);

        String hash = sha256Hex(upoXml); //! a91ff82bb3918827c1d1aa || cannot be reversed : : always same input → same output
        // AES encryption works ONLY with bytes.
        byte[] encryptedBytes = cryptoUtils.aesEncrypt(upoXml.getBytes(StandardCharsets.UTF_8)); // pass this :: [72, 69, 76, 76, 79]
       // encryptedBytes == [ IV ] + [ Encrypted Data ] + [ Authentication Tag ]
        String encrypted = Base64.getEncoder().encodeToString(encryptedBytes); // Base64 converts binary data into safe text. : [17, 88, 200, 4] ==> "EVjIBA=="

        KsefUpoReceipt receipt = KsefUpoReceipt.builder()
                .tenantId(tenantId)
                .invoiceId(invoiceId)
                .ksefReferenceNumber(ksefReferenceNumber)
                .upoXmlEncrypted(encrypted)
                .upoXmlHash(hash)
                .upoTimestamp(upoTimestamp)
                .environment(apiProperties.getEnvironment())
                .build();

        KsefUpoReceipt saved = ksef_upo_receipts_repo.save(receipt);
        log.debug("UPO stored with id [{}] for invoice [{}]", saved.getId(), invoiceId);
        return saved.getId();
    }

    /**
     * Retrieves the UPO receipt for an invoice without decrypting the XML body.
     * Use this for compliance checks and audit exports where only the reference
     * number and timestamp are needed.
     */
    public Optional<KsefUpoReceipt> findByInvoiceId(String tenantId, String invoiceId) {
        return ksef_upo_receipts_repo.findByTenantIdAndInvoiceId(tenantId, invoiceId);
    }

    /**
     * Decrypts and returns the raw UPO XML.
     * Only call this when the full UPO document is required (e.g., auditor export).
     */
    public Optional<String> getUpoXml(String tenantId, String invoiceId) {
        return ksef_upo_receipts_repo.findByTenantIdAndInvoiceId(tenantId, invoiceId)
                .map(receipt -> {
                    byte[] encryptedBytes = Base64.getDecoder().decode(receipt.getUpoXmlEncrypted());
                    byte[] plaintext = cryptoUtils.aesDecrypt(encryptedBytes);
                    return new String(plaintext, StandardCharsets.UTF_8);
                });
    }

    // ── SHA-256 helper ─────────────────────────────────────────────────────────

    private static String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256"); //! CREATE SHA-256 ENGINE
            //! input.getBytes(StandardCharsets.UTF_8):  STRING ("HELLO") → BYTES ("[72, 69, 76, 76, 79]")
            byte[] bytes = digest.digest(input.getBytes(StandardCharsets.UTF_8));  //output like this:  [-24, 95, -115, -77, ...]
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) sb.append(String.format("%02x", b));
           // bytes = [10, 255, 100] : 0aff64
            return sb.toString();
        } catch (Exception e) {
            // SHA-256 is guaranteed by the Java spec
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
