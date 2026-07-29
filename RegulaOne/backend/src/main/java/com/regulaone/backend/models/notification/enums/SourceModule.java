package com.regulaone.backend.models.notification.enums;

// Which app raised the event. Lets the UI group/filter by product and helps audit.
// The frontend maps these values to display names (e.g. KSEFFLOW → "KSeFFlow").
public enum SourceModule {
    REGULAONE,
    KSEFFLOW,
    WORKPULSE,
    SAFEWORK,
    SAFEVOICE,
    WASTESYNC,
    PRIVACYPILOT
}
