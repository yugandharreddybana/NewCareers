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

    /** Reserved scope — never used for user Idempotency-Key headers. */
    static final UUID WEBHOOK_SCOPE = UUID.fromString("00000000-0000-0000-0000-000000000001");

    /** Namespace prefix so Stripe event IDs cannot collide with HTTP idempotency keys. */
    public static final String STORAGE_KEY_PREFIX = "stripe:webhook:";

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

    @Transactional(readOnly = true)
    public boolean isProcessed(String stripeEventId) {
        return repository.findByIdempotencyKey(toStorageKey(stripeEventId)).isPresent();
    }

    @Transactional
    public void markProcessed(String stripeEventId) {
        String storageKey = toStorageKey(stripeEventId);
        if (isProcessed(stripeEventId)) {
            return;
        }
        try {
            repository.save(IdempotencyKey.builder()
                    .idempotencyKey(storageKey)
                    .userId(WEBHOOK_SCOPE)
                    .requestPath("/billing/webhook")
                    .responseStatus(200)
                    .responseBody("processed")
                    .expiresAt(Instant.now().plus(90, ChronoUnit.DAYS))
                    .build());
        } catch (DataIntegrityViolationException ex) {
            // concurrent duplicate — safe to ignore
        }
    }
}
