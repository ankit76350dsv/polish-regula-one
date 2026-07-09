package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Request body for a reporter asking for the keys to READ their own case.
 *
 * The reporter proves who they are with their single 64-character access key — exactly like
 * the tracking page. We resolve their case from the key and hand back only the data keys that
 * belong to THAT case, so the browser can unlock the text on the user's device.
 */
@Data
public class CaseKeysRequest {

    @NotBlank(message = "Access key is required")
    private String accessKey;
}
