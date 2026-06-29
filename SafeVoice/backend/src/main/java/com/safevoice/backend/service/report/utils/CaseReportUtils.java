package com.safevoice.backend.service.report.utils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;

/**
 * Small helper "toolbox" for whistleblower cases.
 *
 * Why this class exists:
 *  - These methods do NOT touch the database, the audit log, or any tenant data.
 *  - They are pure helpers: same input always gives the same kind of output.
 *  - Keeping them here keeps {@code CaseReportService} focused on business steps,
 *    and lets other parts of the app reuse the SAME key/hash rules safely.
 *
 * Everything is {@code static} so callers can use it without creating an object.
 * The class is {@code final} with a private constructor so nobody can extend it
 * or make an instance by mistake.
 */
public final class CaseReportUtils {

    /**
     * One shared, cryptographically strong random-number source. {@link SecureRandom}
     * is thread-safe, so a single static instance is safe for the whole app and saves
     * us from re-seeding a new generator on every call.
     */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    // Private constructor: this is a utility class, so it must never be instantiated.
    private CaseReportUtils() {
    }

    /**
     * Make ONE cryptographically secure access key: 32 random bytes shown as 64 hex
     * characters. This is the reporter's only credential. We use SecureRandom (a
     * cryptographically strong generator) so keys cannot be guessed or predicted.
     */
    public static String generateAccessKey() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes); // lowercase hex, matches the web app's format
    }

    /**
     * Make a short run of random hex characters. Used only to build a non-secret id
     * for HR grievance cases, which have no access key of their own.
     */
    public static String randomHex(int bytes) {
        byte[] b = new byte[bytes];
        SECURE_RANDOM.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }

    /**
     * Return the SHA-256 fingerprint (64 hex chars) of any text. We store and compare
     * this fingerprint instead of the access key itself, so the key is never kept.
     * SHA-256 is one-way: you cannot turn the fingerprint back into the key.
     */
    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is part of every standard Java runtime, so this should never happen.
            throw new IllegalStateException("SHA-256 algorithm is unavailable", e);
        }
    }

    /**
     * Build a short, non-secret case reference from the key fingerprint, e.g.
     * "SV-1A2B3C4D5E". Staff use this to talk about a case; it is a one-way function
     * of the key and never reveals it.
     */
    public static String caseRefFromHash(String keyHash) {
        return "SV-" + keyHash.substring(0, 10).toUpperCase();
    }

    /**
     * Turn the form's calendar date ("YYYY-MM-DD") into an instant at the start of that
     * day (UTC). Returns null if the reporter left the date empty or it cannot be read,
     * so a missing or odd date never blocks an urgent report.
     */
    public static Instant parseIncidentDate(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(date.trim()).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
