package com.safevoice.backend.exception;

/**
 * Thrown when an AWS KMS operation (make a data key, or unlock a data key) fails.
 *
 * We wrap the low-level AWS error in this simple type so the global handler can answer
 * with a short, safe message (never the AWS internals) and the right HTTP status. This is
 * how we avoid leaking any technical detail to the outside world (CLAUDE.md §17).
 */
public class CryptoOperationException extends RuntimeException {

    public CryptoOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
