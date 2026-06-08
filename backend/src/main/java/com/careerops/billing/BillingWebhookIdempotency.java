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

    static final UUID WEBHOOK_SCOPE = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final IdempotencyRepository repository;

    public BillingWebhookIdempotency(IdempotencyRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public boolean acquire(String eventId) {
        if (repository.findByIdempotencyKey(eventId).isPresent()) {
            return false;
        }
        try {
            repository.save(IdempotencyKey.builder()
                    .idempotencyKey(eventId)
                    .userId(WEBHOOK_SCOPE)
                    .requestPath("/billing/webhook")
                    .responseStatus(200)
                    .responseBody("accepted")
                    .expiresAt(Instant.now().plus(90, ChronoUnit.DAYS))
                    .build());
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }
}
