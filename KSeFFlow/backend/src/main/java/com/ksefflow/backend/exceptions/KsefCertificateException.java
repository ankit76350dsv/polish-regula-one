package com.ksefflow.backend.exceptions;

// Thrown when certificate operations fail — invalid .pfx, wrong password,
// decryption error, expired cert, or missing active certificate for a tenant.
// This is a RuntimeException so callers are not forced to declare it,
// but it is always caught by the global exception handler and mapped to 4xx/5xx.
public class KsefCertificateException extends RuntimeException {

    public KsefCertificateException(String message) {
        super(message);
    }

    public KsefCertificateException(String message, Throwable cause) {
        super(message, cause);
    }
}
