package com.careerops.exception;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

/**
 * Centralised exception handler for the entire application.
 *
 * Rules:
 *  - All responses use the canonical {@link ErrorResponse} record.
 *  - Stack traces NEVER reach clients; they are only logged server-side.
 *  - 4xx → WARN log; 5xx → ERROR log.
 *  - ApiException carries its own HttpStatus, retryAfterSeconds, and captchaRequired flag.
 *  - Validation errors (field + bean) produce a fieldErrors map in the response.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ─── Primary custom exception (used throughout the app) ─────────────────

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, WebRequest req) {
        HttpStatus status = ex.getStatus() != null ? ex.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
        String path = path(req);
        String correlationId = MDC.get("correlationId");

        if (status.is5xxServerError()) {
            log.error("ApiException [{}] {} {}: {}", correlationId, status.value(), path, ex.getMessage(), ex);
        } else {
            log.warn("ApiException [{}] {} {}: {}", correlationId, status.value(), path, ex.getMessage());
        }

        ErrorResponse body = new ErrorResponse(
                ex.getMessage(),
                status.value(),
                java.time.Instant.now(),
                null,
                path,
                correlationId,
                null,
                ex.isCaptchaRequired()
        );

        HttpHeaders headers = new HttpHeaders();
        if (ex.getRetryAfterSeconds() != null) {
            headers.set("Retry-After", String.valueOf(ex.getRetryAfterSeconds()));
        }
        return ResponseEntity.status(status).headers(headers).body(body);
    }

    // ─── Bean validation (@Valid on request bodies) ────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, WebRequest req) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value",
                        (a, b) -> a
                ));
        log.warn("Validation failed [{}]: {} field errors", path(req), fieldErrors.size());
        return ResponseEntity.badRequest().body(new ErrorResponse(
                "Validation failed", 400, java.time.Instant.now(), "VALIDATION_ERROR",
                path(req), MDC.get("correlationId"), fieldErrors, false
        ));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex, WebRequest req) {
        Map<String, String> fieldErrors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(
                        cv -> cv.getPropertyPath().toString(),
                        cv -> cv.getMessage(),
                        (a, b) -> a
                ));
        log.warn("Constraint violation [{}]: {}", path(req), fieldErrors);
        return ResponseEntity.badRequest().body(new ErrorResponse(
                "Constraint violation", 400, java.time.Instant.now(), "CONSTRAINT_VIOLATION",
                path(req), MDC.get("correlationId"), fieldErrors, false
        ));
    }

    // ─── HTTP-level errors ─────────────────────────────────────────────

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException ex, WebRequest req) {
        log.warn("Malformed JSON body [{}]: {}", path(req), ex.getMessage());
        return ResponseEntity.badRequest().body(error(HttpStatus.BAD_REQUEST,
                "Malformed or unreadable request body", "MALFORMED_BODY", req));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, WebRequest req) {
        log.warn("Method not allowed [{}]: {}", path(req), ex.getMessage());
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(error(HttpStatus.METHOD_NOT_ALLOWED, ex.getMessage(), "METHOD_NOT_ALLOWED", req));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleUnsupportedMedia(HttpMediaTypeNotSupportedException ex, WebRequest req) {
        log.warn("Unsupported media type [{}]: {}", path(req), ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(error(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ex.getMessage(), "UNSUPPORTED_MEDIA_TYPE", req));
    }

    // ─── Standard Java / Spring exceptions ─────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex, WebRequest req) {
        log.warn("Bad request [{}]: {}", path(req), ex.getMessage());
        return ResponseEntity.badRequest().body(error(HttpStatus.BAD_REQUEST, ex.getMessage(), "BAD_REQUEST", req));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleConflict(IllegalStateException ex, WebRequest req) {
        log.warn("Conflict [{}]: {}", path(req), ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(error(HttpStatus.CONFLICT, ex.getMessage(), "CONFLICT", req));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException ex, WebRequest req) {
        log.warn("Not found [{}]: {}", path(req), ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(error(HttpStatus.NOT_FOUND, ex.getMessage(), "NOT_FOUND", req));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(AccessDeniedException ex, WebRequest req) {
        log.warn("Access denied [{}]", path(req));
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(error(HttpStatus.FORBIDDEN, "Access denied", "FORBIDDEN", req));
    }

    // ─── Catch-all (must be last) ────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, WebRequest req) {
        log.error("Unhandled exception [{}] {}: {}", MDC.get("correlationId"), path(req), ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(error(HttpStatus.INTERNAL_SERVER_ERROR,
                        "An unexpected error occurred. Please try again.", "INTERNAL_ERROR", req));
    }

    // ─── helpers ───────────────────────────────────────────────

    private ErrorResponse error(HttpStatus status, String message, String code, WebRequest req) {
        return new ErrorResponse(
                message != null ? message : status.getReasonPhrase(),
                status.value(),
                java.time.Instant.now(),
                code,
                path(req),
                MDC.get("correlationId"),
                null,
                false
        );
    }

    private String path(WebRequest req) {
        return req.getDescription(false).replace("uri=", "");
    }
}
