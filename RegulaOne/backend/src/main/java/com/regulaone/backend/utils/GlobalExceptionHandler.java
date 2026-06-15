package com.regulaone.backend.utils;

import com.regulaone.backend.dto.AppResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<AppResponse<Void>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("[GlobalExceptionHandler] IllegalArgumentException: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(AppResponse.error(e.getMessage(), "INVALID_REQUEST", 400));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<AppResponse<Void>> handleIllegalState(IllegalStateException e) {
        log.warn("[GlobalExceptionHandler] IllegalStateException: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(AppResponse.error(e.getMessage(), "INVALID_STATE", 400));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<AppResponse<Void>> handleResourceNotFound(ResourceNotFoundException e) {
        log.warn("[GlobalExceptionHandler] ResourceNotFoundException: {}", e.getMessage());
        return ResponseEntity.status(404)
                .body(AppResponse.error(e.getMessage(), "RESOURCE_NOT_FOUND", 404));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<AppResponse<Void>> handleBadCredentials(BadCredentialsException e) {
        log.warn("[GlobalExceptionHandler] BadCredentialsException: {}", e.getMessage());
        return ResponseEntity.status(401)
                .body(AppResponse.error("Invalid email or password", "INVALID_CREDENTIALS", 401));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<AppResponse<Void>> handleAccessDenied(AccessDeniedException e) {
        log.warn("[GlobalExceptionHandler] AccessDeniedException: {}", e.getMessage());
        return ResponseEntity.status(403)
                .body(AppResponse.error(
                        "Access denied. You do not have permission to access this resource.",
                        "ACCESS_DENIED", 403));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AppResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String errors = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.warn("[GlobalExceptionHandler] Validation failed: {}", errors);
        return ResponseEntity.badRequest()
                .body(AppResponse.error(errors, "VALIDATION_ERROR", 400));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<AppResponse<Void>> handleGeneric(Exception e) {
        log.error("[GlobalExceptionHandler] Unhandled exception: {}", e.getMessage(), e);
        return ResponseEntity.status(500)
                .body(AppResponse.error(
                        "An unexpected error occurred. Please try again later.",
                        "INTERNAL_ERROR", 500));
    }
}
