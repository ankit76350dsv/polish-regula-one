package com.privacypilot.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * The standard response envelope for EVERY PrivacyPilot API call.
 *
 * It matches the shape the RegulaOne platform and the frontend already use:
 *   { success, message, data, errorCode, status }
 * The frontend's HTTP client unwraps `data` on success and reads message/errorCode
 * on failure, so keeping this exact shape means it works with no changes.
 *
 * Null fields are dropped from the JSON so a success response has no errorCode and
 * a failure response has no data.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AppResponse<T>(boolean success, String message, T data, String errorCode, Integer status) {

    // Success with a payload.
    public static <T> AppResponse<T> ok(T data) {
        return new AppResponse<>(true, null, data, null, 200);
    }

    // Success with a payload and a human message.
    public static <T> AppResponse<T> ok(T data, String message) {
        return new AppResponse<>(true, message, data, null, 200);
    }

    // Failure — carries a readable message, a machine code, and the HTTP status.
    public static <T> AppResponse<T> fail(String message, String errorCode, int status) {
        return new AppResponse<>(false, message, null, errorCode, status);
    }
}
