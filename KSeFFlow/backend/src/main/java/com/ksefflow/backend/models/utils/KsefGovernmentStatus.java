package com.ksefflow.backend.models.utils;

// Operational status of the connection to the Polish KSeF government API.
//
// Used by the retry queue to decide whether to attempt invoice submission,
// and by the frontend Integration Center to display the current API health.
//
// DOWNTIME_SIM is a developer/test state that simulates a government outage
// so offline fallback paths can be tested without waiting for a real outage.
public enum KsefGovernmentStatus {

    // KSeF API is reachable and responding within SLA latency
    CONNECTED,

    // KSeF API is reachable but returning 429 / 503 — rate-limited or degraded
    RESTRICTED,

    // KSeF API is unreachable — invoices enter OFFLINE_MODE
    DISCONNECTED,

    // Developer/test mode: simulates government downtime for offline path testing
    DOWNTIME_SIM
}
