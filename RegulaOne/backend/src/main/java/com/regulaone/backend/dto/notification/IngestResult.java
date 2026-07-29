package com.regulaone.backend.dto.notification;

import lombok.Builder;
import lombok.Data;

// Returned by the internal ingest API so the publisher knows the outcome.
@Data
@Builder
public class IngestResult {
    private boolean accepted;        // false when suppressed as a duplicate (idempotency)
    private int recipientCount;      // how many in-app notifications were created
    private String dedupeKey;
    private String message;
}
