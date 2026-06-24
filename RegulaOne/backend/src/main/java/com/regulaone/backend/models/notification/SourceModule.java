package com.regulaone.backend.models.notification;

// Which app raised the event. Lets the UI group/filter by product and helps audit.
public enum SourceModule {
    REGULAONE,
    KSEFFLOW,
    WORKPULSE,
    SAFEWORK,
    SAFEVOICE,
    WASTESYNC,
    PRIVACYPILOT
}
