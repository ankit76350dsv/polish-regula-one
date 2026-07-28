package com.privacypilot.backend.dto.breach;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * One fix-it action on a breach, as sent by the client.
 *
 * The stored {@code RemediationItem} has no validation, so this DTO enforces that
 * every action has text. The id is optional: the service keeps it when editing an
 * existing item and generates one for a brand-new item.
 */
@Data
public class RemediationItemRequest {

    // Optional — present when editing an existing action, absent for a new one.
    private String id;

    @NotBlank(message = "remediation text is required")
    private String text;

    // Whether this step has been completed.
    private boolean done;
}
