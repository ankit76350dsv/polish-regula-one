package com.safevoice.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Body the public tracking page sends to post one message into a case channel.
 * The web app sends { sender, text }. The case is identified by the id in the URL path.
 */
@Data
public class CaseMessageRequest {

    // Who is writing — e.g. "Anonymous Whistleblower". Used only to label the message.
    private String sender;

    // The message text. Must not be empty.
    @NotBlank(message = "Message text cannot be empty")
    private String text;
}
