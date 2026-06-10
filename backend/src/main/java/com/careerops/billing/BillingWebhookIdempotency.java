package com.careerops.billing;

import com.careerops.model.IdempotencyKey;
import com.careerops.repository.IdempotencyRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class BillingWebhookIdempotency {

    /** Reserved scope, never used for user Idempotency-Key headers. */
    static final UUID WEBHOOK_SCOPE = UUID.fromString("00000000-0000-0000-0000-000000000001");

    /** Namespace prefix so Stripe event IDs cannot collide with HTTP idempotency keys. */
    public static final String STORAGE_KEY_PREFIX = "stripe:webhook:";

    /** In-flight webhook — handler has not completed yet. */
    public static final int STATUS_PROCESSING = 102;

    /** Handler completed successfully. */
    public static final int STATUS_COMPLETED = 200;

    private final IdempotencyRepository repository;

    public BillingWebhookIdempotency(IdempotencyRepository repository) {
        this.repository = repository;
    }

    static String toStorageKey(String stripeEventId) {
        if (stripeEventId == null || stripeEventId.isBlank()) {
            throw new IllegalArgumentException("Stripe event id required");
        }
        return STORAGE_KEY_PREFIX + stripeEventId;
    }

    @Transactional
    public boolean tryAcquire(String stripeEventId) {
        String storageKey = toStorageKey(stripeEventId);
        try {
            repository.saveAndFlush(IdempotencyKey.builder()
                    .idempotencyKey(storageKey)
                    .userId(WEBHOOK_SCOPE)
                    .requestPath("/billing/webhook")
                    .responseStatus(STATUS_PROCESSING)
                    .responseBody("processing")
                    .expiresAt(Instant.now().plus(90, ChronoUnit.DAYS))
                    .build());
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }

    @Transactional
    public void markCompleted(String stripeEventId) {
        String storageKey = toStorageKey(stripeEventId);
        IdempotencyKey key = repository.findByIdempotencyKey(storageKey)
                .orElseThrow(() -> new IllegalStateException("Missing webhook idempotency row for " + stripeEventId));
        key.setResponseStatus(STATUS_COMPLETED);
        key.setResponseBody("processed");
        repository.save(key);
    }

    @Transactional
    public void release(String stripeEventId) {
        repository.deleteByIdempotencyKey(toStorageKey(stripeEventId));
    }
}
