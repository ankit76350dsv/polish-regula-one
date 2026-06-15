package com.ksefflow.backend.exceptions;

// Thrown when the KSeF government API authentication flow fails.
// Covers: network errors, invalid challenge response, bad signature,
// government API returning a non-2xx status, and expired session.
public class KsefAuthException extends RuntimeException {

    public KsefAuthException(String message) {
        super(message);
    }

    public KsefAuthException(String message, Throwable cause) {
        super(message, cause);
    }
}
