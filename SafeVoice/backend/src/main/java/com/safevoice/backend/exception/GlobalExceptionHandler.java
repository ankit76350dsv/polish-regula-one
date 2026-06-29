package com.safevoice.backend.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Turns backend errors into a small, predictable JSON shape that the web app already
 * knows how to read:
 *
 *   { "success": false, "message": "...", "errorCode": "NOT_FOUND", "status": 404 }
 *
 * The web app's HTTP client reads "errorCode" to decide what to show (for example, a
 * "NOT_FOUND" turns into a gentle "no case found for that key" message instead of a
 * scary technical error). Keeping a stable shape here is what makes that possible.
 *
 * IMPORTANT: We never put stack traces or internal details in the response body.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Build the response body in the exact shape the frontend expects.
     */
    private Map<String, Object> body(String message, String errorCode, HttpStatus status) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", false);
        out.put("message", message);
        out.put("errorCode", errorCode);
        out.put("status", status.value());
        return out;
    }

    /**
     * A case could not be found for the given access key (or it was the wrong key).
     * Answered as 404 with errorCode "NOT_FOUND".
     */
    @ExceptionHandler(CaseNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(CaseNotFoundException ex) {
        log.info("[handleNotFound]: case lookup failed (no detail logged to protect anonymity)");
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(body("No case was found for the provided access key.", "NOT_FOUND", HttpStatus.NOT_FOUND));
    }

    /**
     * Two reports arrived in the same minute for the same organisation, so the readable
     * case reference (built from that minute) would clash. Answered as 409 Conflict with
     * errorCode "CASE_REFERENCE_CONFLICT" and a message telling the reporter to wait a
     * minute and submit again — by then the reference is different and unique.
     */
    @ExceptionHandler(CaseReferenceConflictException.class)
    public ResponseEntity<Map<String, Object>> handleReferenceConflict(CaseReferenceConflictException ex) {
        log.info("[handleReferenceConflict]: duplicate case reference in the same minute");
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(body(ex.getMessage(), "CASE_REFERENCE_CONFLICT", HttpStatus.CONFLICT));
    }

    /**
     * The report named an organisation (tenant) that does not exist or is switched off.
     * Answered as 404 with errorCode "TENANT_NOT_FOUND".
     */
    @ExceptionHandler(TenantNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleTenantNotFound(TenantNotFoundException ex) {
        log.info("[handleTenantNotFound]: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(body("The organisation for this report was not found.", "TENANT_NOT_FOUND", HttpStatus.NOT_FOUND));
    }

    /**
     * The request body failed validation (a required field was missing or blank).
     * Answered as 400 with errorCode "VALIDATION" and a combined, readable message.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        if (message.isBlank()) {
            message = "The request was invalid.";
        }
        log.info("[handleValidation]: rejected invalid submission: {}", message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(body(message, "VALIDATION", HttpStatus.BAD_REQUEST));
    }

    /**
     * Bad input that we rejected by hand (e.g. an unknown category label).
     * Answered as 400 with errorCode "INVALID_REQUEST".
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        log.info("[handleIllegalArgument]: rejected request: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(body(ex.getMessage(), "INVALID_REQUEST", HttpStatus.BAD_REQUEST));
    }
}
