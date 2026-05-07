package com.careerops.exception;

import org.springframework.http.HttpStatus;

/**
 * Task 129 — extended with static convenience factories so service code
 * can throw concise, readable one-liners without repeating HttpStatus imports
 * everywhere.
 *
 * Existing constructor ApiException(HttpStatus, String) is preserved for
 * backward compatibility with all callers already in the codebase.
 */
public class ApiException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    private final HttpStatus status;
    private final Integer retryAfterSeconds;
    private final boolean captchaRequired;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null, false);
    }

    public ApiException(HttpStatus status, String message, Integer retryAfterSeconds) {
        this(status, message, retryAfterSeconds, false);
    }

    public ApiException(HttpStatus status, String message, boolean captchaRequired) {
        this(status, message, null, captchaRequired);
    }

    public ApiException(HttpStatus status, String message, Integer retryAfterSeconds, boolean captchaRequired) {
        super(message);
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;
        this.captchaRequired = captchaRequired;
    }

    public ApiException(HttpStatus status, String message, Throwable cause) {
        super(message, cause);
        this.status = status;
        this.retryAfterSeconds = null;
        this.captchaRequired = false;
    }

    public HttpStatus getStatus() { return status; }
    public Integer getRetryAfterSeconds() { return retryAfterSeconds; }
    public boolean isCaptchaRequired() { return captchaRequired; }

    // ── Convenience factories ──────────────────────────────────────────────

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    public static ApiException internalError(String message) {
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, message);
    }

    public static ApiException tooManyRequests(String message) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, message);
    }

    public static ApiException tooManyRequests(String message, Integer retryAfterSeconds) {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, message, retryAfterSeconds);
    }
}
