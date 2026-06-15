package com.ksefflow.backend.dto.ksefapi;

/**
 * KSeF 2.0 — body of {@code POST /sessions/online/{referenceNumber}/invoices}.
 *
 * The invoice is sent encrypted with the session AES key. KSeF verifies integrity using
 * the plaintext hash/size and the ciphertext hash/size.
 *
 * @param invoiceHash             Base64( SHA-256( plaintext FA(3) XML bytes ) )
 * @param invoiceSize             plaintext byte length
 * @param encryptedInvoiceHash    Base64( SHA-256( AES ciphertext bytes ) )
 * @param encryptedInvoiceSize    ciphertext byte length
 * @param encryptedInvoiceContent Base64( AES-CBC ciphertext )
 * @param offlineMode             true when the invoice was issued while KSeF was unavailable
 */
public record SendInvoiceRequest(
        String invoiceHash,
        long invoiceSize,
        String encryptedInvoiceHash,
        long encryptedInvoiceSize,
        String encryptedInvoiceContent,
        Boolean offlineMode) {
}
