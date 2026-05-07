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

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.core.env.Environment env;

    // ── 1. Known domain errors ─────────────────────────────────────────────

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex) {
        log.warn("ApiException [{}]: {}", ex.getStatus(), ex.getMessage());
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(ex.getStatus());
        
        if (ex.getStatus() == HttpStatus.TOO_MANY_REQUESTS && ex.getRetryAfterSeconds() != null) {
            builder.header(org.springframework.http.HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
        }
        
        return builder.body(ErrorResponse.of(ex.getMessage(), ex.getStatus().value(), ex.isCaptchaRequired()));
    }

    // ── 2. Bean-validation failures (@Valid / @RequestBody) ────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex, jakarta.servlet.http.HttpServletRequest request) {
        java.util.Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(FieldError::getField, fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value", (v1, v2) -> v1));

        String path = request.getRequestURI();
        String correlationId = request.getHeader("X-Correlation-Id");
        if (correlationId == null) {
            correlationId = (String) request.getAttribute("correlationId");
        }

        log.warn("Validation failed on {}: {}", path, fieldErrors);
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("Validation failed", HttpStatus.BAD_REQUEST.value(), "VALIDATION_ERROR", path, correlationId, fieldErrors));
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


    // ── 5. Spring Data & HTTP Exceptions ───────────────────────────────────

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Database integrity violation: {}", ex.getMessage());
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("A database constraint or integrity violation occurred.", HttpStatus.CONFLICT.value()));
    }

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(org.springframework.http.converter.HttpMessageNotReadableException ex) {
        log.warn("Malformed HTTP message: {}", ex.getMessage());
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("Malformed or unreadable request payload.", HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
        log.warn("Method argument type mismatch: {}", ex.getMessage());
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("Invalid parameter or argument type.", HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(org.springframework.web.bind.MissingServletRequestParameterException ex) {
        log.warn("Missing servlet request parameter: {}", ex.getMessage());
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("Missing required request parameter: " + ex.getParameterName(), HttpStatus.BAD_REQUEST.value()));
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(org.springframework.security.access.AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of("Access denied.", HttpStatus.FORBIDDEN.value()));
    }

    @ExceptionHandler(jakarta.validation.ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(jakarta.validation.ConstraintViolationException ex) {
        log.warn("Constraint violation: {}", ex.getMessage());
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("Validation failed: " + ex.getMessage(), HttpStatus.BAD_REQUEST.value()));
    }

    // ── 6. Catch-all 500 ──────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, jakarta.servlet.http.HttpServletRequest request) {
        String method = request.getMethod();
        String uri = request.getRequestURI();
        String userId = resolveUserId(request);
        String correlationId = request.getHeader("X-Correlation-Id");
        if (correlationId == null) {
            correlationId = (String) request.getAttribute("correlationId");
        }

        org.slf4j.MDC.put("method", method);
        org.slf4j.MDC.put("uri", uri);
        if (userId != null) org.slf4j.MDC.put("userId", userId);
        if (correlationId != null) org.slf4j.MDC.put("correlationId", correlationId);

        try {
            log.error("Unhandled exception [method={} uri={} userId={} correlationId={}]: ",
                method, uri, userId != null ? userId : "anonymous", correlationId != null ? correlationId : "none", ex);
        } finally {
            org.slf4j.MDC.clear();
        }

        boolean isDevOrLocal = false;
        if (env != null) {
            for (String profile : env.getActiveProfiles()) {
                if ("dev".equalsIgnoreCase(profile) || "local".equalsIgnoreCase(profile)) {
                    isDevOrLocal = true;
                    break;
                }
            }
        }

        String msg = "An unexpected error occurred. Please try again later.";
        if (isDevOrLocal) {
            msg = ex.getClass().getSimpleName() + ": " + (ex.getMessage() != null ? ex.getMessage() : "No message");
        }

        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of(msg, HttpStatus.INTERNAL_SERVER_ERROR.value(), "INTERNAL_SERVER_ERROR", uri, correlationId, null));
    }

    private String resolveUserId(jakarta.servlet.http.HttpServletRequest request) {
        Object requestUserId = request.getAttribute("userId");
        if (requestUserId instanceof String userId && !userId.isBlank()) {
            return userId;
        }

        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof String userId && !userId.isBlank()) {
                return userId;
            }
        }

        String legacyHeaderUserId = request.getHeader("X-User-Id");
        if (legacyHeaderUserId != null && !legacyHeaderUserId.isBlank()) {
            return legacyHeaderUserId;
        }

        return null;
    }
}
