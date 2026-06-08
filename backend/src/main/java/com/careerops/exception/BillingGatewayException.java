package com.careerops.exception;

import org.springframework.http.HttpStatus;

/**
 * Stripe or billing-provider failure. Mapped to a non-409 HTTP status in {@link GlobalExceptionHandler}.
 */
public class BillingGatewayException extends RuntimeException {

    private final HttpStatus status;

    public BillingGatewayException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public BillingGatewayException(String message, HttpStatus status, Throwable cause) {
        super(message, cause);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
