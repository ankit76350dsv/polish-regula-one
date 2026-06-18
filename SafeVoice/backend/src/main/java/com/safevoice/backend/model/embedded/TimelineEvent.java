package com.safevoice.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Embedded document tracking history timeline nodes for a case report.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TimelineEvent {

    private UUID id = UUID.randomUUID();
    private String title;
    private String description;
    private Instant timestamp;
    private String type; // e.g., "system", "status", "comment", "message", "attachment", "retention"
}
