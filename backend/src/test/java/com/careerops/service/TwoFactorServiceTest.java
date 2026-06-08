package com.careerops.service;

import com.careerops.exception.ApiException;
import com.careerops.repository.UserRepository;
import com.careerops.repository.UserTwoFactorRepository;
import com.careerops.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwoFactorServiceTest {

    @Mock UserTwoFactorRepository repo;
    @Mock UserRepository users;
    @Mock PasswordEncoder encoder;
    @Mock AuditLogService audit;
    @Mock JwtService jwt;

    @InjectMocks TwoFactorService service;

    UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "rolloutEnabled", false);
        ReflectionTestUtils.setField(service, "masterKekEncoded",
                "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=");
        ReflectionTestUtils.setField(service, "issuerName", "CareerOps");
    }

    @Test
    @DisplayName("getStatus reports rollout flag")
    void getStatusRolloutFlag() {
        when(repo.findById(userId)).thenReturn(Optional.empty());

        var status = service.getStatus(userId);

        assertThat(status.enabled()).isFalse();
        assertThat(status.rolloutEnabled()).isFalse();
    }

    @Test
    @DisplayName("beginSetup is forbidden when rollout disabled")
    void beginSetupForbiddenWhenRolloutOff() {
        assertThatThrownBy(() -> service.beginSetup(userId))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not available");
    }

    @Test
    @DisplayName("isEnabled is false when no row")
    void isEnabledFalse() {
        when(repo.findById(userId)).thenReturn(Optional.empty());
        assertThat(service.isEnabled(userId)).isFalse();
    }
}
