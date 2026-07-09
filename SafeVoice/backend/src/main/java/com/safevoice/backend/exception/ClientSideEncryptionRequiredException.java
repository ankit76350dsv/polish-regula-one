package com.safevoice.backend.exception;

/**
 * Raised while SafeVoice's server-side field encryption has been removed and the
 * replacement client-side encrypted payload format has not yet been wired in.
 */
public class ClientSideEncryptionRequiredException extends RuntimeException {

    public ClientSideEncryptionRequiredException(String message) {
        super(message);
    }
}
