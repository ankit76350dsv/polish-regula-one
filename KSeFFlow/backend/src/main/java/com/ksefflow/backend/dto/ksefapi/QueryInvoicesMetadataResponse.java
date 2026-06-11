package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.util.List;

// Response from POST /invoices/query/metadata. We keep only the fields we use; KSeF may add
// more over time, so ignoreUnknown=true keeps us forward-compatible (extra fields are dropped,
// never an error).
@JsonIgnoreProperties(ignoreUnknown = true)
public record QueryInvoicesMetadataResponse(
        // true when there are more pages after this one (ask again with a higher pageOffset).
        boolean hasMore,
        // true when KSeF cut the result short because it was too large.
        boolean isTruncated,
        // the actual list of invoice metadata records on this page.
        List<InvoiceMetadata> invoices) {

    // One invoice's metadata (no full XML — that is fetched separately by KSeF number).
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record InvoiceMetadata(
            String ksefNumber,
            String invoiceNumber,
            String issueDate,
            String acquisitionDate,
            Party seller,
            Party buyer,
            BigDecimal netAmount,
            BigDecimal vatAmount,
            BigDecimal grossAmount,
            String currency,
            String invoicingMode,
            String invoiceType,
            Boolean isSelfInvoicing,
            Boolean hasAttachment) {}

    // Seller carries "nip"; buyer carries "identifier". We map both to one shape and read
    // whichever field is present.
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Party(String nip, String identifier, String name) {
        // The single best identifier for this party (NIP for a seller, identifier for a buyer).
        public String bestIdentifier() {
            return nip != null ? nip : identifier;
        }
    }
}
