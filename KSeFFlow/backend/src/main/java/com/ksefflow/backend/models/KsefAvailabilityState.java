package com.ksefflow.backend.models;

import com.ksefflow.backend.models.utils.KsefServiceMode;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

// Stored copy of the GLOBAL KSeF availability state (C7).
//
// SIMPLE EXPLANATION (why this exists):
// KSeF can be "online", "unavailable", or in an official "emergency" (tryb awaryjny). This is a
// NATIONAL fact — it is the same for every company on the platform, because it comes from the
// Ministry of Finance, not from any single tenant. We used to keep this only in memory, which
// meant a server restart silently forgot a declared emergency and two servers could disagree.
//
// This document saves that one global value so it SURVIVES restarts and is SHARED across all
// backend instances. There is always exactly ONE row: we use a fixed id ("GLOBAL"), so every
// save overwrites the same record (an upsert), never creating duplicates.
//
// This is operational state, NOT tenant business data — so it is intentionally a single global
// singleton with no tenantId (the whole point is that it applies to all tenants at once).
@Document(collection = "ksef_availability")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KsefAvailabilityState {

    // Fixed primary key — there is only ever one global availability record.
    public static final String GLOBAL_ID = "GLOBAL";

    @Id
    private String id;

    // ONLINE / OFFLINE_UNAVAILABILITY / EMERGENCY
    private KsefServiceMode mode;

    // true when a human (the platform operator) declared this state — the auto-monitor must not
    // override a manual declaration (only an operator can clear an emergency).
    private boolean manual;

    // Short human-readable explanation of how/why the state was set.
    private String reason;

    // Who set it: "auto-monitor" for the background ping, or the operator's email for a manual call.
    private String declaredBy;

    // When the state last actually changed (kept in sync with the in-memory snapshot).
    private LocalDateTime since;

    // When this record was last written to the database (for ops/forensics).
    private LocalDateTime updatedAt;
}
