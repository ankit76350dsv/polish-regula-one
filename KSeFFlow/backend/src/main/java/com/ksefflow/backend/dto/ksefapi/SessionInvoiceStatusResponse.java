package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — response of {@code GET /sessions/{referenceNumber}/invoices/{invoiceReferenceNumber}}.
 *
 * Once the invoice is accepted, {@code ksefNumber} (the permanent KSeF id) is populated and
 * {@code status.code} reaches the terminal success value. {@code upoDownloadUrl} may be present
 * once the per-invoice UPO is ready.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SessionInvoiceStatusResponse(
        Integer ordinalNumber,
        String invoiceNumber,
        String ksefNumber,
        String referenceNumber,
        String invoiceHash,
        String invoiceFileName,
        String acquisitionDate,
        String invoicingDate,
        String permanentStorageDate,
        String upoDownloadUrl,
        StatusInfo status) {
}
