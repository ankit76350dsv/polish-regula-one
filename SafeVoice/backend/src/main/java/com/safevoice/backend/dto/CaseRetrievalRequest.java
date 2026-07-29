package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request the anonymous reporter sends to look up their own case.
 *
 * There is only ONE credential: the 64-character access key. No tracking code and no
 * separate PIN — the key alone identifies the case and proves the holder may see it.
 * We hash the key and match it against the stored fingerprint, so the plain key is
 * never stored or compared directly.
 */
@Data
public class CaseRetrievalRequest {

    @NotBlank(message = "Access key is required")
    private String accessKey;
}
