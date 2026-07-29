package com.privacypilot.backend.dto.dsar;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * One collection-work task on a DSAR, as sent by the client.
 *
 * The stored {@code DsarTask} has no validation, so this DTO enforces that every task
 * has text. The id is optional: the service keeps it when editing an existing task and
 * generates one for a brand-new task.
 */
@Data
public class DsarTaskRequest {

    // Optional — present when editing an existing task, absent for a new one.
    private String id;

    @NotBlank(message = "task text is required")
    private String text;

    // True once this task has been completed.
    private boolean done;
}
