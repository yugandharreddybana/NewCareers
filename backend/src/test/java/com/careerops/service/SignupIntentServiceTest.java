package com.careerops.service;

import com.careerops.dto.AuthDtos.SignupIntentRequest;
import com.careerops.dto.AuthDtos.SignupIntentResponse;
import com.careerops.dto.ConsentDtos.SignupConsentsRequest;
import com.careerops.exception.ApiException;
import com.careerops.model.SignupIntent;
import com.careerops.repository.SignupIntentRepository;
import com.careerops.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SignupIntentServiceTest {

    @Mock SignupIntentRepository intents;
    @Mock UserRepository users;
    @Mock PasswordEncoder encoder;
    @Mock CaptchaService captcha;
    @Mock AuthService authService;

    @InjectMocks SignupIntentService service;

    private SignupConsentsRequest consents;

    @BeforeEach
    void setUp() {
        consents = new SignupConsentsRequest(true, true, false, false);
    }

    @Test
    @DisplayName("create stores bcrypt hash and returns opaque id")
    void createIntent() {
        when(users.existsByEmail("signup@example.com")).thenReturn(false);
        when(encoder.encode("Secure1Pass")).thenReturn("bcrypt-hash");
        UUID id = UUID.randomUUID();
        when(intents.save(any(SignupIntent.class))).thenAnswer(inv -> {
            SignupIntent intent = inv.getArgument(0);
            intent.setId(id);
            intent.setExpiresAt(Instant.now().plusSeconds(1800));
            return intent;
        });

        SignupIntentResponse response = service.create(new SignupIntentRequest(
                "signup@example.com", "Secure1Pass", consents, "Ada", null));

        assertThat(response.signupIntentId()).isEqualTo(id);
        ArgumentCaptor<SignupIntent> cap = ArgumentCaptor.forClass(SignupIntent.class);
        verify(intents).save(cap.capture());
        assertThat(cap.getValue().getPasswordHash()).isEqualTo("bcrypt-hash");
        assertThat(cap.getValue().getEmail()).isEqualTo("signup@example.com");
    }

    @Test
    @DisplayName("exists returns opaque response for any id")
    void existsOpaqueResponse() {
        UUID id = UUID.randomUUID();
        when(intents.findById(id)).thenReturn(Optional.empty());

        var response = service.exists(id);

        assertThat(response.exists()).isTrue();
        assertThat(response.active()).isTrue();
    }

    @Test
    @DisplayName("create rejects missing AI processing consent")
    void createRejectsMissingAiConsent() {
        SignupConsentsRequest noAi = new SignupConsentsRequest(true, false, false, false);

        assertThatThrownBy(() -> service.create(new SignupIntentRequest(
                "signup@example.com", "Secure1Pass", noAi, "Ada", null)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("AI processing consent");
    }

    @Test
    @DisplayName("consume rejects expired intent")
    void consumeExpired() {
        UUID id = UUID.randomUUID();
        SignupIntent intent = SignupIntent.builder()
                .id(id)
                .email("signup@example.com")
                .passwordHash("hash")
                .termsAccepted(true)
                .aiProcessingAccepted(true)
                .marketingAccepted(false)
                .analyticsAccepted(false)
                .expiresAt(Instant.now().minusSeconds(60))
                .build();
        when(intents.findByIdAndEmail(id, "signup@example.com")).thenReturn(Optional.of(intent));

        assertThatThrownBy(() -> service.consume(id, "signup@example.com"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expired");
    }

    @Test
    @DisplayName("consume returns hash and marks intent used")
    void consumeSuccess() {
        UUID id = UUID.randomUUID();
        SignupIntent intent = SignupIntent.builder()
                .id(id)
                .email("signup@example.com")
                .passwordHash("stored-hash")
                .termsAccepted(true)
                .aiProcessingAccepted(true)
                .marketingAccepted(false)
                .analyticsAccepted(false)
                .expiresAt(Instant.now().plusSeconds(600))
                .build();
        when(intents.findByIdAndEmail(id, "signup@example.com")).thenReturn(Optional.of(intent));

        SignupIntentService.ConsumedSignupIntent consumed = service.consume(id, "signup@example.com");

        assertThat(consumed.passwordHash()).isEqualTo("stored-hash");
        verify(intents).save(intent);
        assertThat(intent.getConsumedAt()).isNotNull();
    }
}
