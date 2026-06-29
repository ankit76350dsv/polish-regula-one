package com.safevoice.backend.exception;

/**
 * Thrown when the readable case reference we built (e.g. "SV/2026/0629/1408") is already
 * used by another case in the same tenant.
 *
 * The reference is built from the minute the report was received, so this only happens
 * when two reports arrive in the SAME minute for the same organisation. Rather than
 * silently change the reference, we stop and ask the reporter to try again in a minute
 * — by then the minute (and therefore the reference) is different and unique again.
 */
public class CaseReferenceConflictException extends RuntimeException {

    public CaseReferenceConflictException(String message) {
        super(message);
    }
}
