package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Body a reporter sends to download ONE file from their own case thread.
 *
 * The reporter has no login — they prove ownership with their 64-character access key, the
 * same secret they use on the tracking page. We take the key in the request BODY (not the URL)
 * so it never lands in server logs or browser history. The server re-checks the key, finds the
 * message + attachment, and streams the file back.
 */
@Data
public class ReporterAttachmentRequest {

    // The reporter's one-and-only credential (their case access key).
    @NotBlank(message = "Access key is required")
    private String accessKey;

    // Which message in the thread the file is attached to.
    @NotBlank(message = "Message id is required")
    private String messageId;

    // Which file on that message to download.
    @NotBlank(message = "Attachment id is required")
    private String attachmentId;
}
