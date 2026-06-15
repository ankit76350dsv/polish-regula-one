package com.regulaone.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

/**
 * Standardised API envelope returned by every endpoint.
 *
 * Shape:
 * {
 *   "success"  : true | false,
 *   "message"  : "Human-readable outcome description",
 *   "data"     : <payload — null on errors>,
 *   "errorCode": "MACHINE_READABLE_CODE" — null on success,
 *   "status"   : <HTTP status code mirror>
 * }
 *
 * Usage in controllers:
 *   return ResponseEntity.ok(AppResponse.success("User invited", userResponse));
 *   return ResponseEntity.badRequest().body(AppResponse.error("Not found", "RESOURCE_NOT_FOUND", 404));
 *
 * The frontend api.js transparently unwraps the envelope:
 *   if success=true  → returns data
 *   if success=false → throws Error(message) with errorCode attached
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AppResponse<T> {

    private boolean success;
    private String  message;
    private T       data;
    private String  errorCode;
    private int     status;

    // ── Factory helpers ───────────────────────────────────────────────────────

    public static <T> AppResponse<T> success(String message, T data) {
        return AppResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .status(200)
                .build();
    }

    public static <T> AppResponse<T> success(String message) {
        return AppResponse.<T>builder()
                .success(true)
                .message(message)
                .status(200)
                .build();
    }

    public static <T> AppResponse<T> created(String message, T data) {
        return AppResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .status(201)
                .build();
    }

    public static <T> AppResponse<T> error(String message, String errorCode, int status) {
        return AppResponse.<T>builder()
                .success(false)
                .message(message)
                .errorCode(errorCode)
                .status(status)
                .build();
    }
}
