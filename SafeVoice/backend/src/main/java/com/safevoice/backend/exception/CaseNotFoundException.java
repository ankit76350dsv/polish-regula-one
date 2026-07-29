package com.safevoice.backend.exception;

/**
 * Thrown when a case cannot be found for the supplied access key (or case reference).
 *
 * We use one single "not found" answer for BOTH "the key is wrong" and "no such case".
 * This is on purpose: telling the two apart would let someone probe which keys exist,
 * which would weaken the anonymity guarantee. The web app turns this into a friendly
 * "we could not find a case for that key" message.
 */
public class CaseNotFoundException extends RuntimeException {

    public CaseNotFoundException(String message) {
        super(message);
    }
}
