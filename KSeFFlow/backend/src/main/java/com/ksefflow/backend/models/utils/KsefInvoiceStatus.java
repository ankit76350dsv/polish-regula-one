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
    DRAFT,

    // Submitted to KSeF API and awaiting the official KSeF reference ID
    PENDING,

    // Accepted by KSeF — ksefId and UPO received and stored
    SENT,

    // Hard rejection from KSeF (e.g. invalid NIP, schema violation) — requires manual correction
    FAILED,

    // Automatic retry in progress after a transient failure
    RETRYING,

    // KSeF API was unreachable; invoice queued locally with offline PDF fallback generated
    OFFLINE_MODE
}
