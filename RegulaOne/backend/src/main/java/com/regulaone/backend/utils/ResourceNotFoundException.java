package com.regulaone.backend.utils;

/**
 * Thrown when a requested resource cannot be found in the database.
 * GlobalExceptionHandler maps this to HTTP 404 with a meaningful message.
 *
 * Using a dedicated exception (vs IllegalArgumentException) makes the intent
 * unambiguous: 404 = not found, 400 = bad input.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
