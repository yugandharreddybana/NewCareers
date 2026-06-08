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
    @DisplayName("markProcessed stores namespaced key for new Stripe event id")
    void markProcessedNewEvent() {
        when(repository.findByIdempotencyKey("stripe:webhook:evt_123")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyKey.class))).thenAnswer(inv -> inv.getArgument(0));

        idempotency.markProcessed("evt_123");

        ArgumentCaptor<IdempotencyKey> captor = ArgumentCaptor.forClass(IdempotencyKey.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getIdempotencyKey()).isEqualTo("stripe:webhook:evt_123");
        assertThat(captor.getValue().getUserId()).isEqualTo(BillingWebhookIdempotency.WEBHOOK_SCOPE);
        assertThat(captor.getValue().getRequestPath()).isEqualTo("/billing/webhook");
    }

    @Test
    @DisplayName("isProcessed returns true when namespaced key exists")
    void isProcessedDuplicateEvent() {
        when(repository.findByIdempotencyKey("stripe:webhook:evt_dup"))
                .thenReturn(Optional.of(IdempotencyKey.builder().idempotencyKey("stripe:webhook:evt_dup").build()));

        assertThat(idempotency.isProcessed("evt_dup")).isTrue();
    }

    @Test
    @DisplayName("markProcessed tolerates concurrent insert race")
    void markProcessedConcurrentRace() {
        when(repository.findByIdempotencyKey("stripe:webhook:evt_race")).thenReturn(Optional.empty());
        when(repository.save(any(IdempotencyKey.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        idempotency.markProcessed("evt_race");
    }
}
