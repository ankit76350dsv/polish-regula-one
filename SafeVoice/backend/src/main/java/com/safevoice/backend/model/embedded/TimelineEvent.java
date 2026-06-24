package com.safevoice.backend.model.embedded;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import org.bson.types.ObjectId;

/**
 * Embedded document tracking history timeline nodes for a case report.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TimelineEvent {

    private String id = new ObjectId().toHexString();
    private String title;
    private String description;
    private Instant timestamp;
    private String type; // e.g., "system", "status", "comment", "message", "attachment", "retention"
}
