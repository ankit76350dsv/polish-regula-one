package com.ksefflow.backend.dto.ksefapi;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

// Response from POST /online/Invoice/Send.
// The government returns an elementReferenceNumber which is a temporary processing
// reference — NOT yet the final ksefReferenceNumber. Query status to get the KSeF ID.
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class KsefSendInvoiceResponse {

    // Temporary reference used to poll GET /online/Invoice/Status/{elementReferenceNumber}
    private String elementReferenceNumber;

    // 200 = accepted for processing, 4xx = rejected
    private int processingCode;

    private String processingDescription;

    // ISO-8601 timestamp of acceptance at the government gateway
    private String timestamp;
}
