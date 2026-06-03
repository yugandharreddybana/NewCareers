package com.careerops.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.time.Instant;
import java.util.Map;

/**
 * Centralised exception handler.
 * - Returns structured JSON error bodies (no stack traces to clients).
 * - Logs stack traces server-side at ERROR level only for 5xx.
 * - Handles common Spring exceptions cleanly.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException ex, WebRequest req) {
        log.warn("Bad request [{}]: {}", path(req), ex.getMessage());
        return error(HttpStatus.BAD_REQUEST, ex.getMessage(), req);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(IllegalStateException ex, WebRequest req) {
        log.warn("Conflict [{}]: {}", path(req), ex.getMessage());
        return error(HttpStatus.CONFLICT, ex.getMessage(), req);
    }

    @ExceptionHandler(java.util.NoSuchElementException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(java.util.NoSuchElementException ex, WebRequest req) {
        log.warn("Not found [{}]: {}", path(req), ex.getMessage());
        return error(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(
            org.springframework.security.access.AccessDeniedException ex, WebRequest req) {
        log.warn("Forbidden [{}]: {}", path(req), ex.getMessage());
        return error(HttpStatus.FORBIDDEN, "Access denied", req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex, WebRequest req) {
        log.error("Unhandled exception [{}]", path(req), ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred. Please try again.", req);
    }

    // ─── helpers ────────────────────────────────────────────

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message, WebRequest req) {
        return ResponseEntity.status(status).body(Map.of(
                "timestamp", Instant.now().toString(),
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", message != null ? message : "No message",
                "path", path(req)
        ));
    }

    private String path(WebRequest req) {
        return req.getDescription(false).replace("uri=", "");
    }
}
