package com.ksefflow.backend.models.utils;


public enum KsefOfflineMode {

    // Seller-side connectivity loss (no internet at issuer).
    OFFLINE24,

    // KSeF API unreachable / returning 5xx — the system-detected fallback.
    OFFLINE_UNAVAILABILITY,

    // Ministry-declared KSeF outage (tryb awaryjny) — 7 business-day window.
    EMERGENCY
}
