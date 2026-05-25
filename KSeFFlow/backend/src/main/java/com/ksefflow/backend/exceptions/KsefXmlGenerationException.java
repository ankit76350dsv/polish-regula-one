package com.ksefflow.backend.exceptions;

// Thrown when FA(3) XML generation or pre-flight validation fails.
// Signals a hard error that the caller must surface — the invoice must be
// corrected before submission to the KSeF government API is re-attempted.
public class KsefXmlGenerationException extends RuntimeException {

    public KsefXmlGenerationException(String message) {
        super(message);
    }

    public KsefXmlGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
