package com.privacypilot.backend.exception;

import com.privacypilot.backend.dto.AppResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

/**
 * Turns every exception into the standard {@link AppResponse} failure envelope, so the
 * frontend always gets { success:false, message, errorCode, status } — never a raw
 * stack trace (CLAUDE.md: never expose stack traces). One place for all error mapping.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // Thrown by the auth layer (401/403/503) and by services for not-found (404) etc.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<AppResponse<Object>> handleStatus(ResponseStatusException ex) {
        int status = ex.getStatusCode().value();
        String message = ex.getReason() != null ? ex.getReason() : "Request failed";
        String code = switch (status) {
            case 401 -> "UNAUTHENTICATED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 503 -> "SERVICE_UNAVAILABLE";
            default -> "REQUEST_FAILED";
        };
        return ResponseEntity.status(status).body(AppResponse.fail(message, code, status));
    }

    // Bean-validation failures on @Valid request bodies → 400 with the first field message.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AppResponse<Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        if (message.isBlank()) {
            message = "Validation failed";
        }
        return ResponseEntity.badRequest().body(AppResponse.fail(message, "VALIDATION_ERROR", 400));
    }

    // Bad input the service rejected (e.g. an unknown enum code) → 400.
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<AppResponse<Object>> handleBadInput(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(AppResponse.fail(ex.getMessage(), "BAD_REQUEST", 400));
    }

    // Anything unexpected → 500, logged server-side but NEVER leaked to the client.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<AppResponse<Object>> handleUnexpected(Exception ex) {
        log.error("[PrivacyPilot] Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(AppResponse.fail("An unexpected error occurred", "INTERNAL_ERROR", 500));
    }
}
