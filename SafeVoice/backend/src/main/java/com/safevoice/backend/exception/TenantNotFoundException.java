package com.safevoice.backend.exception;

/**
 * Thrown when a report is submitted for a tenant id that does not exist (or is not
 * active) in the SafeVoice tenant registry. Turned into a clear 404 response so the
 * caller knows the organisation is unknown, without leaking any other detail.
 */
public class TenantNotFoundException extends RuntimeException {

    public TenantNotFoundException(String message) {
        super(message);
    }
}
