package com.ksefflow.backend.exceptions;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Translates KSeF domain exceptions and common Spring exceptions into
 * structured JSON responses so clients always receive machine-readable errors.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // 400 — bad input: wrong password, invalid file format, missing fields
    @ExceptionHandler(KsefCertificateException.class)
    public ResponseEntity<Map<String, Object>> handleCertificate(KsefCertificateException e) {
        log.warn("[handleCertificate]:1 Certificate error: {}", e.getMessage());
        return ResponseEntity.badRequest().body(errorBody(400, "CERTIFICATE_ERROR", e.getMessage()));
    }

    // 400 — KSeF authentication failed (bad session token, invalid signature, etc.)
    @ExceptionHandler(KsefAuthException.class)
    public ResponseEntity<Map<String, Object>> handleAuth(KsefAuthException e) {
        log.warn("[handleAuth]:1 Auth error: {}", e.getMessage());
        return ResponseEntity.status(400).body(errorBody(400, "AUTH_ERROR", e.getMessage()));
    }

    // 422 — invoice validation or submission rejected by KSeF
    @ExceptionHandler(KsefSubmissionException.class)
    public ResponseEntity<Map<String, Object>> handleSubmission(KsefSubmissionException e) {
        log.warn("[handleSubmission]:1 Submission error: {}", e.getMessage());
        return ResponseEntity.status(422).body(errorBody(422, "SUBMISSION_ERROR", e.getMessage()));
    }

    // 422 — FA(3) XML generation failed (missing fields, invalid VAT values, etc.)
    @ExceptionHandler(KsefXmlGenerationException.class)
    public ResponseEntity<Map<String, Object>> handleXml(KsefXmlGenerationException e) {
        log.warn("[handleXml]:1 XML error: {}", e.getMessage());
        return ResponseEntity.status(422).body(errorBody(422, "XML_ERROR", e.getMessage()));
    }

    // 400 — controller-level input validation (missing required fields, bad values)
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("[handleIllegalArgument]:1 Validation error: {}", e.getMessage());
        return ResponseEntity.badRequest().body(errorBody(400, "VALIDATION_ERROR", e.getMessage()));
    }

    // 400 — @Valid DTO validation failure (e.g. missing sellerAddress / sellerCity).
    // Returns BOTH a per-field list and a combined message so the client can show
    // exactly which fields are wrong instead of a generic "something went wrong".
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleBeanValidation(MethodArgumentNotValidException e) {
        List<Map<String, String>> fieldErrors = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field", fe.getField(),
                        "defaultMessage", fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "is invalid"))
                .collect(Collectors.toList());

        String combined = fieldErrors.stream()
                .map(fe -> fe.get("defaultMessage"))
                .collect(Collectors.joining("; "));

        log.warn("[handleBeanValidation]:1 DTO validation failed: {}", combined);

        Map<String, Object> body = new java.util.HashMap<>(errorBody(400, "VALIDATION_ERROR",
                combined.isBlank() ? "Request validation failed" : combined));
        body.put("errors", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    // 413 — file larger than Spring's multipart limit (spring.servlet.multipart.max-file-size)
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException e) {
        log.warn("[handleMaxUpload]:1 Upload too large: {}", e.getMessage());
        return ResponseEntity.status(413).body(errorBody(413, "FILE_TOO_LARGE",
                "Uploaded file exceeds the maximum allowed size"));
    }

    // 500 — catch-all for anything not handled above
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception e) {
        log.error("[handleGeneric]:1 Unhandled exception: {}", e.getMessage(), e);
        return ResponseEntity.status(500).body(errorBody(500, "INTERNAL_ERROR",
                "An unexpected error occurred. Please try again later."));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private static Map<String, Object> errorBody(int status, String errorCode, String message) {
        return Map.of(
                "success",   false,
                "status",    status,
                "errorCode", errorCode,
                "message",   message
        );
    }
}
