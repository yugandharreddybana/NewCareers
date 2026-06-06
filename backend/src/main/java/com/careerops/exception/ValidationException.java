package com.careerops.exception;

/**
 * Thrown when permit analytics request parameters fail business validation.
 * Mapped to HTTP 400 by {@link GlobalExceptionHandler}.
 */
public class ValidationException extends RuntimeException {

    public ValidationException(String message) {
        super(message);
    }
}
