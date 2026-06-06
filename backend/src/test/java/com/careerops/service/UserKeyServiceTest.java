package com.careerops.service;

import com.careerops.model.UserKey;
import com.careerops.repository.UserKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserKeyServiceTest {

    private static final byte[] MASTER_KEK = new byte[32];
    private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Mock UserKeyRepository userKeys;

    private UserKeyService service;

    @BeforeEach
    void setUp() {
        service = UserKeyService.forTest(userKeys, MASTER_KEK);
    }

    @Test
    @DisplayName("provisionForUser stores wrapped 256-bit DEK")
    void provisionForUser_persistsWrappedDek() {
        when(userKeys.existsByUserId(USER_ID)).thenReturn(false);
        when(userKeys.save(any(UserKey.class))).thenAnswer(inv -> inv.getArgument(0));

        service.provisionForUser(USER_ID);

        ArgumentCaptor<UserKey> cap = ArgumentCaptor.forClass(UserKey.class);
        verify(userKeys).save(cap.capture());
        UserKey saved = cap.getValue();
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getEncryptedDek()).isNotBlank();

        when(userKeys.findById(USER_ID)).thenReturn(Optional.of(saved));
        assertThat(service.getUserDek(USER_ID)).hasSize(32);
    }

    @Test
    @DisplayName("provisionForUser is idempotent")
    void provisionForUser_skipsWhenRowExists() {
        when(userKeys.existsByUserId(USER_ID)).thenReturn(true);

        service.provisionForUser(USER_ID);

        verify(userKeys, never()).save(any());
    }
}
