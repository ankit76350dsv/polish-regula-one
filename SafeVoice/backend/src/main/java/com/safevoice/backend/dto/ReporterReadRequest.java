package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Body a reporter sends to mark message(s) in their own case as read (readByReporter).
 *
 * The reporter has no login — they prove ownership with their 64-character access key (the same
 * secret used on the tracking page), taken in the BODY (never the URL) so it stays out of logs.
 */
@Data
public class ReporterReadRequest {

    // The reporter's one-and-only credential (their case access key).
    @NotBlank(message = "Access key is required")
    private String accessKey;

    // OPTIONAL: a single message to mark read. Omit to mark the whole thread read (e.g. on reply).
    private String messageId;
}
