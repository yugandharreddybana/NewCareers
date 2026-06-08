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
    @DisplayName("acquire returns true and persists key for new event id")
    void acquireNewEvent() {
        when(repository.findByIdempotencyKey("evt_123")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyKey.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThat(idempotency.acquire("evt_123")).isTrue();

        ArgumentCaptor<IdempotencyKey> captor = ArgumentCaptor.forClass(IdempotencyKey.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getIdempotencyKey()).isEqualTo("evt_123");
        assertThat(captor.getValue().getUserId()).isEqualTo(BillingWebhookIdempotency.WEBHOOK_SCOPE);
        assertThat(captor.getValue().getRequestPath()).isEqualTo("/billing/webhook");
    }

    @Test
    @DisplayName("acquire returns false when event id already exists")
    void acquireDuplicateEvent() {
        when(repository.findByIdempotencyKey("evt_dup"))
                .thenReturn(Optional.of(IdempotencyKey.builder().idempotencyKey("evt_dup").build()));

        assertThat(idempotency.acquire("evt_dup")).isFalse();
    }

    @Test
    @DisplayName("acquire returns false on concurrent insert race")
    void acquireConcurrentRace() {
        when(repository.findByIdempotencyKey("evt_race")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyKey.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThat(idempotency.acquire("evt_race")).isFalse();
    }
}
