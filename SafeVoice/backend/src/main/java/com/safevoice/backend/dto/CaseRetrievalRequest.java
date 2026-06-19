package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request payload used by public whistleblowers to query their case status/messages.
 */
@Data
public class CaseRetrievalRequest {

    @NotBlank(message = "Tracking code is required")
    private String trackingCode;

    private String pin; // Required for standard cases, blank for LABOUR_DISPUTE
}
