package com.careerops.exception;

/**
 * Thrown when a Stripe webhook event cannot be processed. Causes HTTP 500 so Stripe retries.
 * Idempotency is recorded only after successful processing.
 */
public class WebhookProcessingException extends RuntimeException {

    public WebhookProcessingException(String message) {
        super(message);
    }
}
