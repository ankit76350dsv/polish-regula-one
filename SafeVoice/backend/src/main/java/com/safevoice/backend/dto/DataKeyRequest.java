package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body for "give me a one-time key to lock a report for this organisation".
 *
 * The reporter has no account, so the only thing we need is WHICH organisation the report is
 * for. The server checks that organisation is real and active before making a key, which stops
 * strangers from making the server call AWS KMS for made-up organisations.
 */
@Data
public class DataKeyRequest {

    @NotBlank(message = "Tenant id is required")
    private String tenantId;
}
