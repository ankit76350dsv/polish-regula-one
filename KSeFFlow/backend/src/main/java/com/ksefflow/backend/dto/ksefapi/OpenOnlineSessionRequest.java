package com.ksefflow.backend.dto.ksefapi;

/**
 * KSeF 2.0 — body of {@code POST /sessions/online}. Declares the invoice schema for the
 * session and the encryption material used for every invoice sent within it.
 */
public record OpenOnlineSessionRequest(
        FormCode formCode,
        EncryptionInfo encryption) {
}
