package com.careerops.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.stream.Collectors;

/**
 * Task 127 — full global exception handler.
 *
 * Every exception that escapes a controller is caught here and converted into
 * a consistent {@link ErrorResponse} envelope:
 *
 *   { "error": "...", "status": 4xx/5xx, "timestamp": "..." }
 *
 * Handled cases:
 *  1. ApiException           — known domain errors (404, 400, 403, 409, …)
 *  2. MethodArgumentNotValidException — @Valid bean-validation failures
 *  3. MaxUploadSizeExceededException  — file too large (Spring multipart limit)
 *  4. IllegalArgumentException        — misuse of public APIs / bad input
 *  5. Exception (catch-all)           — unexpected 500s; detail suppressed in body
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ── 1. Known domain errors ─────────────────────────────────────────────

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex) {
        log.warn("ApiException [{}]: {}", ex.getStatus(), ex.getMessage());
        return ResponseEntity
            .status(ex.getStatus())
            .body(ErrorResponse.of(ex.getMessage(), ex.getStatus().value()));
    }

    // ── 2. Bean-validation failures (@Valid / @RequestBody) ────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining("; "));
        String message = detail.isBlank() ? "Validation failed" : detail;
        log.warn("Validation failed: {}", message);
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of(message, HttpStatus.BAD_REQUEST.value()));
    }

    // ── 3. File too large ──────────────────────────────────────────────────

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleFileSize(MaxUploadSizeExceededException ex) {
        log.warn("Upload too large: {}", ex.getMessage());
        return ResponseEntity
            .status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(ErrorResponse.of("File exceeds the maximum allowed upload size",
                HttpStatus.PAYLOAD_TOO_LARGE.value()));
    }

    // ── 4. Bad arguments ───────────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArg(IllegalArgumentException ex) {
        log.warn("IllegalArgument: {}", ex.getMessage());
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of(ex.getMessage(), HttpStatus.BAD_REQUEST.value()));
    }

    // ── 5. Catch-all 500 ──────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        // Log the full stack trace server-side; never leak it to the client
        log.error("Unhandled exception", ex);
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of("An unexpected error occurred. Please try again later.",
                HttpStatus.INTERNAL_SERVER_ERROR.value()));
    }
}
