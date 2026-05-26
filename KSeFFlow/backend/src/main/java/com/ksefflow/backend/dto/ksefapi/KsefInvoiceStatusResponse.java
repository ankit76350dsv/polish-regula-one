package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

// Response from GET /online/Invoice/Status/{elementReferenceNumber}.
// Once the government processes the invoice, ksefReferenceNumber is the legally
// valid KSeF ID that must be stored for 10 years.
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class KsefInvoiceStatusResponse {

    private InvoiceStatus invoiceStatus;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InvoiceStatus {

        // The permanent legal KSeF reference — format: {sellerNIP}-{YYYYMMDD}-{16-char hex}
        private String ksefReferenceNumber;

        // Human-readable processing result from the government
        private String queryingDescription;

        // ISO-8601 timestamp when KSeF accepted the invoice
        private String acquisitionTimestamp;
    }
}
