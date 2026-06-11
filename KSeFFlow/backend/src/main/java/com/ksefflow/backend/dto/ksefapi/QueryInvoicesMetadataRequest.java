package com.ksefflow.backend.dto.ksefapi;

// Request body for POST /invoices/query/metadata — the KSeF endpoint that lists invoice
// metadata (used to discover invoices that were issued TO us, i.e. purchase invoices).
//
// subjectType decides whose point of view we are asking from:
//   "Subject1" = we are the SELLER  → invoices we issued
//   "Subject2" = we are the BUYER   → invoices issued TO us (what "receiving" needs)
//
// dateRange is required by KSeF and may cover at most 3 months.
public record QueryInvoicesMetadataRequest(
        String subjectType,
        DateRange dateRange) {

    /**
     * @param dateType which date to filter on: "Issue", "Invoicing" or "PermanentStorage"
     * @param from     start of the window (ISO-8601, e.g. 2026-06-01T00:00:00)
     * @param to       end of the window (ISO-8601) — optional per KSeF, but we always send it
     */
    public record DateRange(String dateType, String from, String to) {}
}
