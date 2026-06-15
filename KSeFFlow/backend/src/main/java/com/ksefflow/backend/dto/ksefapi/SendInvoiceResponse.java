package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * KSeF 2.0 — 202 response of {@code POST /sessions/online/{referenceNumber}/invoices}.
 * The {@code referenceNumber} is the per-invoice reference used to poll its status and UPO.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record SendInvoiceResponse(
        String referenceNumber) {
}
