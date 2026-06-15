package com.ksefflow.backend.exceptions;

// Thrown when an invoice submission attempt to the KSeF government API fails.
//
// Distinct from KsefAuthException (session/certificate problems) and
// KsefXmlGenerationException (XML build/validation problems).
// This covers the HTTP POST /online/Invoice/Send call itself:
// network failure, government rejection, malformed response.
//
// Callers (KSeFInvoiceService) catch this to trigger offline fallback mode.
public class KsefSubmissionException extends RuntimeException {

    public KsefSubmissionException(String message) {
        super(message);
    }

    public KsefSubmissionException(String message, Throwable cause) {
        super(message, cause);
    }
}
