package com.safevoice.backend.model;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation used to flag fields containing sensitive PII data that must
 * be encrypted using AES-256-GCM before writing to the database,
 * and decrypted upon database retrieval.
 */
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface Encrypted {
}
