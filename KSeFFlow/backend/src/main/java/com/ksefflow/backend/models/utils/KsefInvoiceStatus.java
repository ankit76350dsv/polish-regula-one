package com.ksefflow.backend.models.utils;

// Lifecycle state machine for a KSeF e-invoice.
//
// Transitions:
//   DRAFT        → PENDING      (admin submits the invoice)
//   PENDING      → SENT         (KSeF API returns a ksefId + UPO)
//   PENDING      → FAILED       (KSeF API returns a hard error — schema/VAT mismatch)
//   PENDING      → OFFLINE_MODE (KSeF API is unreachable or returns 5xx)
//   OFFLINE_MODE → RETRYING     (retry queue picks up the invoice)
//   RETRYING     → SENT         (retry succeeds)
//   RETRYING     → FAILED       (retry exhausted — manual review required)
//   FAILED       → DRAFT        (admin corrects the invoice and re-saves)
public enum KsefInvoiceStatus {

    // Invoice created locally — not yet submitted to KSeF
    DRAFT("Draft",
            "Review the invoice details, then submit it to KSeF when you are ready."),

    // Submitted to KSeF API and awaiting the official KSeF reference ID
    PENDING("Pending",
            "Submitted to KSeF — waiting for confirmation. No action needed; the status updates automatically."),

    // Accepted by KSeF — ksefId and UPO received and stored
    SENT("Sent",
            "Accepted by KSeF. Download the UPO (official confirmation) for your records — no further action required."),

    // Hard rejection from KSeF (e.g. invalid NIP, schema violation) — requires manual correction
    FAILED("Failed",
            "KSeF rejected the invoice. Review the error message, correct the invoice, and submit it again."),

    // Automatic retry in progress after a transient failure
    RETRYING("Retrying",
            "An automatic retry is in progress. No action needed unless it ends in FAILED."),

    // KSeF API was unreachable; invoice queued locally with offline PDF fallback generated
    OFFLINE_MODE("Offline (queued)",
            "KSeF was unavailable, so the invoice is queued and will be retried automatically before its legal deadline. No action needed unless it fails.");

    // Short human-readable name for the status (for the UI badge).
    private final String label;

    // Plain-language guidance telling the user what, if anything, to do next.
    private final String nextStep;

    KsefInvoiceStatus(String label, String nextStep) {
        this.label = label;
        this.nextStep = nextStep;
    }

    public String getLabel() {
        return label;
    }

    public String getNextStep() {
        return nextStep;
    }
}
