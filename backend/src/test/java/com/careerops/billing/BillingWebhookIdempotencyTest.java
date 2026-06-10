package com.careerops.billing;

import com.careerops.model.IdempotencyKey;
import com.careerops.repository.IdempotencyRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BillingWebhookIdempotencyTest {

    @Mock IdempotencyRepository repository;

    @InjectMocks BillingWebhookIdempotency idempotency;

    @Test
    @DisplayName("tryAcquire stores processing state for a new Stripe event id")
    void tryAcquireNewEvent() {
        when(repository.saveAndFlush(any(IdempotencyKey.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(idempotency.tryAcquire("evt_123")).isTrue();

        ArgumentCaptor<IdempotencyKey> captor = ArgumentCaptor.forClass(IdempotencyKey.class);
        verify(repository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getIdempotencyKey()).isEqualTo("stripe:webhook:evt_123");
        assertThat(captor.getValue().getUserId()).isEqualTo(BillingWebhookIdempotency.WEBHOOK_SCOPE);
        assertThat(captor.getValue().getResponseStatus()).isEqualTo(BillingWebhookIdempotency.STATUS_PROCESSING);
    }

    @Test
    @DisplayName("tryAcquire returns false for a concurrent duplicate insert")
    void tryAcquireConcurrentRace() {
        when(repository.saveAndFlush(any(IdempotencyKey.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThat(idempotency.tryAcquire("evt_race")).isFalse();
    }

    @Test
    @DisplayName("markCompleted updates processing row to completed")
    void markCompletedUpdatesRow() {
        IdempotencyKey key = IdempotencyKey.builder()
                .idempotencyKey("stripe:webhook:evt_done")
                .responseStatus(BillingWebhookIdempotency.STATUS_PROCESSING)
                .build();
        when(repository.findByIdempotencyKey("stripe:webhook:evt_done")).thenReturn(Optional.of(key));
        when(repository.save(key)).thenReturn(key);

        idempotency.markCompleted("evt_done");

        assertThat(key.getResponseStatus()).isEqualTo(BillingWebhookIdempotency.STATUS_COMPLETED);
        assertThat(key.getResponseBody()).isEqualTo("processed");
    }

    @Test
    @DisplayName("release deletes idempotency row so Stripe can retry")
    void releaseDeletesRow() {
        idempotency.release("evt_retry");

        verify(repository).deleteByIdempotencyKey("stripe:webhook:evt_retry");
    }
}
