package com.careerops.exception;

import java.time.Instant;

/**
 * Task 128 — canonical error envelope returned by every API endpoint on failure.
 *
 * Shape:
 * {
 *   "error":     "Human-readable message",
 *   "status":    400,
 *   "timestamp": "2026-05-01T10:30:00Z"
 * }
 *
 * All handlers in GlobalExceptionHandler produce this record so the frontend
 * and API consumers always get a predictable shape regardless of which layer
 * threw the exception.
 */
import java.util.Map;

public record ErrorResponse(
    String  error,
    int     status,
    Instant timestamp,
    String code,
    String path,
    String correlationId,
    Map<String, String> fieldErrors,
    boolean captchaRequired
) {
    /** Convenience factory — captures "now" automatically. */
    public static ErrorResponse of(String error, int status) {
        return new ErrorResponse(error, status, Instant.now(), null, null, null, null, false);
    }

    public static ErrorResponse of(String error, int status, boolean captchaRequired) {
        return new ErrorResponse(error, status, Instant.now(), null, null, null, null, captchaRequired);
    }

    public static ErrorResponse of(String error, int status, String code, String path, String correlationId, Map<String, String> fieldErrors) {
        return new ErrorResponse(error, status, Instant.now(), code, path, correlationId, fieldErrors, false);
    }
}
